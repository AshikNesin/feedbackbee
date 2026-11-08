import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { Boom } from "@groot/core/errors";
import {
  batchAll,
  db,
  feedback,
  feedbackImages,
  projects,
  type Feedback,
  type FeedbackState,
  type FeedbackStatus,
  type Project,
} from "../../db";
import { createIssue, issueBody, issueLabels, issueTitle } from "../../lib/github";
import { statusFromIssue } from "../../lib/issue-status";
import { isReplayKey, mediaKey, sniff, type MediaRole } from "../../lib/media";
import { originAllowed } from "../../lib/origins";
import { runtime } from "../../runtime";
import {
  editGithubIssue,
  fetchGithubIssues,
  ISSUE_BATCH,
  updateGithubIssue,
} from "../github/github.client";
import { safeGithubError } from "../github/github.service";
import { findProjectBySlug } from "../projects/projects.service";
import type { UpdateFeedbackInput } from "../projects/projects.schema";
import { LIMITS, type Submission } from "./feedback.schema";

type FeedbackItem = Feedback & { images: string[] };
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

/** The media and dashboard links an issue body points at. */
function issueLinks(project: Project, row: Feedback, imageKeys: string[], origin: string) {
  const { mediaBase = origin, dashboardBase = origin } = runtime();
  return {
    images: imageKeys.map((key) => `${mediaBase}/f/${key}`),
    recording: row.recordingKey
      ? `${mediaBase}/${isReplayKey(row.recordingKey) ? "replay" : "f"}/${row.recordingKey}`
      : null,
    audio: row.audioKey ? `${mediaBase}/f/${row.audioKey}` : null,
    dashboard: `${dashboardBase}/app/projects/${project.slug}?feedback=${row.id}`,
  };
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
    status: "open",
    createdAt: new Date(),
  };
  await batchAll([
    db.insert(feedback).values(row),
    ...images.map((image, position) =>
      db.insert(feedbackImages).values({ feedbackId: row.id, position, key: image.key }),
    ),
  ]);

  const issue = await createIssue(project.githubRepo, {
    title: issueTitle(row),
    labels: issueLabels(row.kind, project.labels),
    body: issueBody(
      row,
      issueLinks(
        project,
        row,
        images.map((image) => image.key),
        request.origin,
      ),
    ),
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
  status?: FeedbackStatus,
): Promise<FeedbackPage> {
  const rows = await db
    .select()
    .from(feedback)
    .where(
      and(
        eq(feedback.projectId, projectId),
        status ? eq(feedback.status, status) : undefined,
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

/** One report of a project, with its image keys in order. */
export async function getFeedback(projectId: string, feedbackId: string): Promise<FeedbackItem> {
  const [row] = await db
    .select()
    .from(feedback)
    .where(and(eq(feedback.id, feedbackId), eq(feedback.projectId, projectId)))
    .limit(1);
  if (!row) throw Boom.notFound("Feedback not found");
  const images = await db
    .select({ key: feedbackImages.key })
    .from(feedbackImages)
    .where(eq(feedbackImages.feedbackId, row.id))
    .orderBy(asc(feedbackImages.position));
  return { ...row, images: images.map((image) => image.key) };
}

/**
 * Edit a report from the dashboard or the mobile apps: status, kind, text.
 * GitHub is updated first, so a failure leaves both sides unchanged; the
 * webhook that follows is a no-op. A text or kind edit rewrites the issue's
 * title and body (re-rendered like at submit, so nothing private is added) and
 * swaps the kind label. Reports without an issue change locally only.
 */
export async function updateFeedback(
  project: Project,
  feedbackId: string,
  input: UpdateFeedbackInput,
  origin: string,
): Promise<FeedbackItem> {
  const current = await getFeedback(project.id, feedbackId);
  const next: Feedback = {
    ...current,
    status: input.status ?? current.status,
    kind: input.kind ?? current.kind,
    text: input.text ?? current.text,
  };
  const contentChanged = next.text !== current.text || next.kind !== current.kind;
  const statusChanged = next.status !== current.status;
  if (!contentChanged && !statusChanged) return current;

  if (current.issueNumber) {
    try {
      if (contentChanged) {
        const before = issueLabels(current.kind, project.labels)[0];
        const after = issueLabels(next.kind, project.labels)[0];
        await editGithubIssue(project.githubRepo, current.issueNumber, {
          title: issueTitle(next),
          body: issueBody(next, issueLinks(project, next, current.images, origin)),
          addLabel: after !== before ? after : undefined,
          removeLabel: after !== before ? before : undefined,
        });
      }
      if (statusChanged) {
        await updateGithubIssue(project.githubRepo, current.issueNumber, next.status);
      }
    } catch (error) {
      throw Boom.unavailable(`Couldn't update the GitHub issue: ${safeGithubError(error)}`);
    }
  }
  await db
    .update(feedback)
    .set({ status: next.status, kind: next.kind, text: next.text })
    .where(eq(feedback.id, current.id));
  return { ...next, images: current.images };
}

/**
 * Delete a report from FeedbackBee. Like deleting a project, its GitHub issue
 * and media stay: the issue links to the media, so removing it would break the
 * issue. Close the issue first (Won't fix) if it should go too.
 */
export async function deleteFeedback(projectId: string, feedbackId: string): Promise<void> {
  const { id } = await getFeedback(projectId, feedbackId);
  await batchAll([
    db.delete(feedbackImages).where(eq(feedbackImages.feedbackId, id)),
    db.delete(feedback).where(eq(feedback.id, id)),
  ]);
}

type TrackedRow = { id: string; status: FeedbackStatus; issueNumber: number | null };

/** Read the issues of `rows` from GitHub and store any status that changed. */
async function pullStatuses(repo: string, rows: TrackedRow[]): Promise<number> {
  let updated = 0;
  for (let i = 0; i < rows.length; i += ISSUE_BATCH) {
    const chunk = rows.slice(i, i + ISSUE_BATCH);
    const issues = await fetchGithubIssues(
      repo,
      chunk.flatMap((row) => (row.issueNumber ? [row.issueNumber] : [])),
    );
    const changed = chunk.flatMap((row) => {
      const issue = row.issueNumber ? issues.get(row.issueNumber) : undefined;
      const status = issue && statusFromIssue(issue);
      return status && status !== row.status
        ? [db.update(feedback).set({ status }).where(eq(feedback.id, row.id))]
        : [];
    });
    await batchAll(changed);
    updated += changed.length;
  }
  return updated;
}

/** Feedback checked per manual sync: newest first, bounded by Workers' subrequest limit. */
const SYNC_LIMIT = 500;

/** "Sync from GitHub": refresh the statuses of a project's most recent filed reports. */
export async function syncProjectStatuses(
  project: Project,
): Promise<{ checked: number; updated: number }> {
  const rows = await db
    .select({ id: feedback.id, status: feedback.status, issueNumber: feedback.issueNumber })
    .from(feedback)
    .where(and(eq(feedback.projectId, project.id), isNotNull(feedback.issueNumber)))
    .orderBy(desc(feedback.createdAt))
    .limit(SYNC_LIMIT);
  try {
    return { checked: rows.length, updated: await pullStatuses(project.githubRepo, rows) };
  } catch (error) {
    throw Boom.unavailable(safeGithubError(error));
  }
}

/**
 * An `issues` webhook: refresh the reports filed as that issue. The payload is
 * only a signal; the current state is read back from GitHub, so out-of-order
 * deliveries cannot leave a stale status.
 */
export async function syncIssueStatus(repo: string, issueNumber: number): Promise<number> {
  const rows = await db
    .select({
      id: feedback.id,
      status: feedback.status,
      issueNumber: feedback.issueNumber,
      githubRepo: projects.githubRepo,
    })
    .from(feedback)
    .innerJoin(projects, eq(projects.id, feedback.projectId))
    .where(
      and(
        eq(feedback.issueNumber, issueNumber),
        sql`lower(${projects.githubRepo}) = ${repo.toLowerCase()}`,
      ),
    );
  if (rows.length === 0) return 0;
  return pullStatuses(rows[0]!.githubRepo, rows);
}
