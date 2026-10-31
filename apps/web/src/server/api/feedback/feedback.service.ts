import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { Boom } from "@groot/core/errors";
import {
  batchAll,
  db,
  feedback,
  feedbackImages,
  type Feedback,
  type FeedbackState,
} from "../../db";
import { createIssue, issueBody, issueLabels, issueTitle } from "../../lib/github";
import { isReplayKey, mediaKey, sniff, type MediaRole } from "../../lib/media";
import { originAllowed } from "../../lib/origins";
import { runtime } from "../../runtime";
import { findProjectBySlug } from "../projects/projects.service";
import { LIMITS, type Submission } from "./feedback.schema";

export type FeedbackItem = Feedback & { images: string[] };
export type FeedbackPage = { items: FeedbackItem[]; hasMore: boolean };

export interface SubmitResult {
  id: string;
  state: FeedbackState;
  issueUrl?: string;
  /** Why the issue could not be filed; the report itself is stored. */
  error?: string;
}

interface Attachment {
  file: File;
  contentType: string;
  key: string;
}

const mb = (bytes: number) => Math.floor(bytes / 1024 / 1024);

/** Check an upload's size and bytes, and give it a key. Nothing is stored yet. */
async function attachment(
  projectId: string,
  file: File,
  role: MediaRole,
  maxBytes: number,
  name: string,
): Promise<Attachment> {
  if (file.size > maxBytes) throw Boom.entityTooLarge(`${name} must be under ${mb(maxBytes)} MB`);
  const contentType = await sniff(file, role);
  if (!contentType) throw Boom.unsupportedMediaType(`${name} content is not a supported format`);
  return { file, contentType, key: mediaKey(projectId, contentType) };
}

/**
 * Store a report and file its GitHub issue. Every attachment is checked before
 * any is stored, so a rejected report leaves nothing behind. The issue is
 * created while the request is open; when GitHub fails, the report is kept
 * with `state: "issue_error"` and the reason.
 */
export async function submitFeedback(
  input: Submission,
  request: {
    /** This deployment's origin, the default base for links in the issue. */
    origin: string;
    /** The caller's Origin header: set by browsers, absent from native apps. */
    callerOrigin?: string;
    userAgent?: string;
  },
): Promise<SubmitResult> {
  const project = await findProjectBySlug(input.project);
  if (!project) throw Boom.notFound("unknown project");
  if (
    project.allowedOrigins.length > 0 &&
    request.callerOrigin !== undefined &&
    !originAllowed(request.callerOrigin, project.allowedOrigins)
  ) {
    throw Boom.forbidden(
      "this site is not allowed to send feedback to this project",
      undefined,
      "ORIGIN_NOT_ALLOWED",
    );
  }

  const imagesBytes = input.image.reduce((sum, file) => sum + file.size, 0);
  if (imagesBytes > LIMITS.imagesBytes) {
    throw Boom.entityTooLarge(`images exceed ${mb(LIMITS.imagesBytes)} MB combined`);
  }
  const images: Attachment[] = [];
  for (const file of input.image) {
    images.push(await attachment(project.id, file, "image", LIMITS.imageBytes, "each image"));
  }
  const recording = input.media[0]
    ? await attachment(project.id, input.media[0], "recording", LIMITS.recordingBytes, "media")
    : null;
  const audio = input.audio[0]
    ? await attachment(project.id, input.audio[0], "audio", LIMITS.audioBytes, "audio")
    : null;

  // One at a time: R2 takes each File as a stream, so memory stays flat.
  const { media } = runtime();
  for (const item of [...images, recording, audio]) {
    if (item) await media.put(item.key, item.file, item.contentType);
  }

  const row: Feedback = {
    id: crypto.randomUUID(),
    projectId: project.id,
    kind: input.kind,
    text: input.text,
    reporterEmail: input.email ?? null,
    reporterName: input.reporter_name ?? null,
    reporterId: input.reporter_id ?? null,
    metadata: input.metadata,
    url: input.url ?? null,
    userAgent: request.userAgent?.slice(0, 500) ?? null,
    screenW: input.screen_w ?? null,
    screenH: input.screen_h ?? null,
    appVersion: input.app_version ?? null,
    osName: input.os_name ?? null,
    osVersion: input.os_version ?? null,
    deviceModel: input.device_model ?? null,
    recordingKey: recording?.key ?? null,
    recordingSeconds: recording ? (input.media_seconds ?? null) : null,
    audioKey: audio?.key ?? null,
    audioSeconds: audio ? (input.audio_seconds ?? null) : null,
    state: "pending",
    issueNumber: null,
    issueUrl: null,
    issueError: null,
    createdAt: new Date(),
  };
  await batchAll([
    db.insert(feedback).values(row),
    ...images.map((image, position) =>
      db.insert(feedbackImages).values({ feedbackId: row.id, position, key: image.key }),
    ),
  ]);

  const { githubToken, mediaBase = request.origin, dashboardBase = request.origin } = runtime();
  const issue = await createIssue(githubToken, project.githubRepo, {
    title: issueTitle(row),
    labels: issueLabels(row.kind, project.labels),
    body: issueBody(row, {
      images: images.map((image) => `${mediaBase}/f/${image.key}`),
      recording: row.recordingKey
        ? `${mediaBase}/${isReplayKey(row.recordingKey) ? "replay" : "f"}/${row.recordingKey}`
        : null,
      audio: row.audioKey ? `${mediaBase}/f/${row.audioKey}` : null,
      dashboard: `${dashboardBase}/app/projects/${project.slug}?feedback=${row.id}`,
    }),
  });

  if (!issue.ok) {
    await db
      .update(feedback)
      .set({ state: "issue_error", issueError: issue.error })
      .where(eq(feedback.id, row.id));
    return { id: row.id, state: "issue_error", error: issue.error };
  }
  await db
    .update(feedback)
    .set({ state: "created", issueNumber: issue.number, issueUrl: issue.url, issueError: null })
    .where(eq(feedback.id, row.id));
  return { id: row.id, state: "created", issueUrl: issue.url };
}

/** One page of a project's feedback, newest first, each with its image keys in order. */
export async function listFeedback(
  projectId: string,
  before?: number,
  limit = 25,
): Promise<FeedbackPage> {
  const rows = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.projectId, projectId),
        before ? lt(feedback.createdAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(feedback.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);

  const imagesById = new Map<string, string[]>();
  if (page.length > 0) {
    const images = await db
      .select()
      .from(feedbackImages)
      .where(
        inArray(
          feedbackImages.feedbackId,
          page.map((row) => row.id),
        ),
      )
      .orderBy(asc(feedbackImages.feedbackId), asc(feedbackImages.position));
    for (const image of images) {
      imagesById.set(image.feedbackId, [...(imagesById.get(image.feedbackId) ?? []), image.key]);
    }
  }
  return {
    items: page.map((row) => ({ ...row, images: imagesById.get(row.id) ?? [] })),
    hasMore: rows.length > limit,
  };
}
