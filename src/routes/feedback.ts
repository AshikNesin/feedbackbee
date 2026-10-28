import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, FeedbackRow } from "../types.ts";
import {
  isReplayKey,
  kind as parseKind,
  mediaExt,
  mediaKind,
  metadata as parseMetadata,
  num,
  REPORTER_ID_MAX,
  REPORTER_NAME_MAX,
  sniffRole,
  str,
} from "../lib/validate.ts";
import { checkRate } from "../lib/rate.ts";
import { insertFeedback, markIssueCreated, markIssueError, projectBySlug } from "../db/queries.ts";
import { createIssueForProject, issueBody, issueLabels, issueTitle } from "../lib/github.ts";
import { newId } from "../lib/crypto.ts";

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_IMAGES_BYTES = 50 * 1024 * 1024;
const MAX_RECORDING = 200 * 1024 * 1024;
const MAX_AUDIO = 25 * 1024 * 1024;
const MAX_SECONDS = 300;

export const feedbackRoutes = new Hono<{ Bindings: Env }>();

feedbackRoutes.use("/api/feedback", cors({ origin: "*" }));

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

feedbackRoutes.post("/api/feedback", async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return bad("invalid form data");

  const slug = str(form.get("project"), 64);
  const kind = parseKind(form.get("kind"));
  const text = str(form.get("text"), 5000);
  if (!slug || !kind || !text) return bad("project, kind, and text (1-5000 chars) are required");

  const metaPart = form.get("metadata");
  const hasMetadata = typeof metaPart === "string" && metaPart.trim() !== "";
  const meta = hasMetadata ? parseMetadata(metaPart) : { ok: true as const, json: null };
  if (!meta.ok) return bad(meta.error);

  const ip =
    c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rate = await checkRate(c.env.DB, `fb:${slug}:${ip}`);
  if (!rate.allowed) {
    return c.json(
      { error: "too many submissions, try again later" },
      429,
      { "Retry-After": String(rate.retryAfter) },
    );
  }

  const project = await projectBySlug(c.env.DB, slug);
  if (!project) return bad("unknown project", 404);

  // media is either a recording (video/replay, at most one) or a legacy
  // screenshot (old Android builds and cached widgets) that counts as the
  // first image. New clients send repeatable `image` parts instead.
  const mediaParts = form.getAll("media").filter((v): v is File => v instanceof File && v.size > 0);
  const mediaDeclared = mediaKind(form.get("media_kind"));
  if (mediaParts.length > 0 && (!mediaDeclared || mediaDeclared === "none")) {
    return bad("media_kind is required with media");
  }

  let mediaKey: string | null = null;
  let mediaKindValue: "none" | "recording" = "none";
  let mediaSeconds: number | null = null;
  // Legacy screenshots lead the image list; `image` parts follow in form order.
  const imageFiles: File[] =
    mediaDeclared === "recording" ? [] : mediaParts.slice();
  imageFiles.push(...form.getAll("image").filter((v): v is File => v instanceof File && v.size > 0));

  if (mediaDeclared === "recording") {
    if (mediaParts.length > 1) return bad("only one recording per report");
    const mediaFile = mediaParts[0];
    if (mediaFile) {
      if (mediaFile.size > MAX_RECORDING) return bad(`media exceeds ${Math.floor(MAX_RECORDING / 1024 / 1024)} MB cap`, 413);
      const secs = num(form.get("media_seconds"));
      if (secs === null || secs < 0 || secs > MAX_SECONDS) return bad("media_seconds 0-300 required for recordings");
      mediaSeconds = secs;
      const head = new Uint8Array(await mediaFile.slice(0, 16).arrayBuffer());
      const sniffed = sniffRole(head, "recording");
      if (!sniffed) return bad("media content does not match media_kind", 415);
      mediaKindValue = "recording";
      mediaKey = `p/${project.id}/f/${newId()}.${mediaExt(sniffed.mime)}`;
      await c.env.MEDIA.put(mediaKey, mediaFile, {
        httpMetadata: { contentType: sniffed.mime, cacheControl: "public, max-age=31536000, immutable" },
      });
    }
  }

  if (imageFiles.length > MAX_IMAGES) return bad(`at most ${MAX_IMAGES} images`);
  const totalImageBytes = imageFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalImageBytes > MAX_IMAGES_BYTES) {
    return bad(`images exceed ${Math.floor(MAX_IMAGES_BYTES / 1024 / 1024)} MB combined cap`, 413);
  }
  const imageKeys: string[] = [];
  for (const file of imageFiles) {
    if (file.size > MAX_IMAGE) return bad(`each image must be under ${Math.floor(MAX_IMAGE / 1024 / 1024)} MB`, 413);
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const sniffed = sniffRole(head, "screenshot");
    if (!sniffed || !sniffed.mime.startsWith("image/")) return bad("image content not recognized", 415);
    const key = `p/${project.id}/f/${newId()}.${mediaExt(sniffed.mime)}`;
    // The File goes straight to R2: five buffered images would risk the
    // worker's 128 MB memory ceiling.
    await c.env.MEDIA.put(key, file, {
      httpMetadata: { contentType: sniffed.mime, cacheControl: "public, max-age=31536000, immutable" },
    });
    imageKeys.push(key);
  }

  const audioFile = form.get("audio");
  let audioKey: string | null = null;
  let audioSeconds: number | null = null;
  if (audioFile instanceof File && audioFile.size > 0) {
    const secs = num(form.get("audio_seconds"));
    if (secs === null || secs < 0 || secs > MAX_SECONDS) return bad("audio_seconds 0-300 required with audio");
    if (audioFile.size > MAX_AUDIO) return bad(`audio exceeds ${Math.floor(MAX_AUDIO / 1024 / 1024)} MB cap`, 413);
    const head = new Uint8Array(await audioFile.slice(0, 16).arrayBuffer());
    const sniffed = sniffRole(head, "audio");
    if (!sniffed) return bad("audio content not recognized", 415);
    audioSeconds = secs;
    const ext = sniffed.mime.split("/")[1];
    audioKey = `p/${project.id}/f/${newId()}.${ext}`;
    await c.env.MEDIA.put(audioKey, audioFile, {
      httpMetadata: { contentType: sniffed.mime, cacheControl: "public, max-age=31536000, immutable" },
    });
  }

  const ua = c.req.header("user-agent");
  const row = await insertFeedback(
    c.env.DB,
    {
      project_id: project.id,
      kind,
      text,
      reporter_email: str(form.get("email"), 320),
      reporter_name: str(form.get("reporter_name"), REPORTER_NAME_MAX),
      reporter_id: str(form.get("reporter_id"), REPORTER_ID_MAX),
      metadata: meta.json,
      url: str(form.get("url"), 2048),
      user_agent: ua ? ua.slice(0, 500) : null,
      screen_w: num(form.get("screen_w")),
      screen_h: num(form.get("screen_h")),
      media_kind: mediaKindValue,
      media_key: mediaKey,
      media_seconds: mediaSeconds,
      audio_key: audioKey,
      audio_seconds: audioSeconds,
      app_version: str(form.get("app_version"), 64),
      os_name: str(form.get("os_name"), 32),
      os_version: str(form.get("os_version"), 64),
      device_model: str(form.get("device_model"), 128),
    },
    imageKeys,
  );

  const mediaBase = c.env.MEDIA_BASE || new URL(c.req.url).origin;
  const mediaUrl = mediaKey ? `${mediaBase}/${isReplayKey(mediaKey) ? "replay" : "f"}/${mediaKey}` : null;
  const audioUrl = audioKey ? `${mediaBase}/f/${audioKey}` : null;
  const dashboardBase = c.env.DASHBOARD_BASE || new URL(c.req.url).origin;
  const dashboardUrl = `${dashboardBase}/#${project.slug}/${row.id}`;
  const imageUrls = imageKeys.map((key) => `${mediaBase}/f/${key}`);
  const labels = issueLabels(row.kind, project.labels_map);
  const issue = await createIssueForProject(
    c.env,
    project,
    issueTitle(row),
    issueBody(row, {
      images: imageUrls,
      media: mediaKindValue === "recording" ? mediaUrl : null,
      audio: audioUrl,
      dashboard: dashboardUrl,
    }),
    labels,
  );

  let body: { id: string; state: FeedbackRow["state"]; issueUrl?: string; error?: string };
  let status: 201 | 202;
  if (issue.ok) {
    await markIssueCreated(c.env.DB, row.id, issue.number, issue.url);
    body = { id: row.id, state: "created", issueUrl: issue.url };
    status = 201;
  } else {
    await markIssueError(c.env.DB, row.id, issue.error);
    body = { id: row.id, state: "pending", error: issue.error };
    status = 202;
  }
  return c.json(body, status);
});
