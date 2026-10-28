import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, FeedbackRow } from "../types.ts";
import { isReplayKey, kind as parseKind, mediaExt, mediaKind, num, sniffRole, str } from "../lib/validate.ts";
import { checkRate } from "../lib/rate.ts";
import { insertFeedback, markIssueCreated, markIssueError, projectBySlug } from "../db/queries.ts";
import { createIssueForProject, issueBody, issueLabels, issueTitle } from "../lib/github.ts";
import { newId } from "../lib/crypto.ts";

const MAX_SCREENSHOT = 10 * 1024 * 1024;
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

  let mediaKey: string | null = null;
  let mediaKindValue: "none" | "screenshot" | "recording" = "none";
  let mediaSeconds: number | null = null;
  const mediaFile = form.get("media");
  if (mediaFile instanceof File && mediaFile.size > 0) {
    const declared = mediaKind(form.get("media_kind"));
    if (!declared || declared === "none") return bad("media_kind is required with media");

    const cap = declared === "screenshot" ? MAX_SCREENSHOT : MAX_RECORDING;
    if (mediaFile.size > cap) return bad(`media exceeds ${Math.floor(cap / 1024 / 1024)} MB cap`, 413);

    if (declared === "recording") {
      const secs = num(form.get("media_seconds"));
      if (secs === null || secs < 0 || secs > MAX_SECONDS) return bad("media_seconds 0-300 required for recordings");
      mediaSeconds = secs;
    }

    const head = new Uint8Array(await mediaFile.slice(0, 16).arrayBuffer());
    const sniffed = sniffRole(head, declared);
    if (!sniffed) return bad("media content does not match media_kind", 415);

    mediaKindValue = declared;
    const ext = mediaExt(sniffed.mime);
    mediaKey = `p/${project.id}/f/${newId()}.${ext}`;
    const bytes = await mediaFile.arrayBuffer();
    await c.env.MEDIA.put(mediaKey, bytes, {
      httpMetadata: { contentType: sniffed.mime, cacheControl: "public, max-age=31536000, immutable" },
    });
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
    await c.env.MEDIA.put(audioKey, await audioFile.arrayBuffer(), {
      httpMetadata: { contentType: sniffed.mime, cacheControl: "public, max-age=31536000, immutable" },
    });
  }

  const ua = c.req.header("user-agent");
  const row = await insertFeedback(c.env.DB, {
    project_id: project.id,
    kind,
    text,
    reporter_email: str(form.get("email"), 320),
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
  });

  const mediaBase = c.env.MEDIA_BASE || new URL(c.req.url).origin;
  const mediaUrl = mediaKey ? `${mediaBase}/${isReplayKey(mediaKey) ? "replay" : "f"}/${mediaKey}` : null;
  const audioUrl = audioKey ? `${mediaBase}/f/${audioKey}` : null;
  const dashboardBase = c.env.DASHBOARD_BASE || new URL(c.req.url).origin;
  const dashboardUrl = `${dashboardBase}/#${project.slug}/${row.id}`;
  const imageUrl = mediaKindValue === "screenshot" ? mediaUrl : null;
  const labels = issueLabels(row.kind, project.labels_map);
  const issue = await createIssueForProject(
    c.env,
    project,
    issueTitle(row),
    issueBody(row, {
      images: imageUrl ? [imageUrl] : [],
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
