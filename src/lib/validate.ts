import type { FeedbackKind, MediaKind } from "../types.ts";

const FEEDBACK_KINDS: readonly FeedbackKind[] = ["bug", "idea", "feedback"];
const MEDIA_KINDS: readonly MediaKind[] = ["none", "screenshot", "recording"];

export function str(v: File | string | null, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.length > max) return null;
  return t;
}

export function num(v: File | string | null): number | null {
  if (typeof v !== "string" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function kind(v: File | string | null): FeedbackKind | null {
  return typeof v === "string" && (FEEDBACK_KINDS as readonly string[]).includes(v)
    ? (v as FeedbackKind)
    : null;
}

export function mediaKind(v: File | string | null): MediaKind | null {
  return typeof v === "string" && (MEDIA_KINDS as readonly string[]).includes(v)
    ? (v as MediaKind)
    : null;
}

export function slugOk(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug);
}

export function repoOk(repo: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo);
}

// Web recordings are rrweb DOM replays (gzipped JSON), not video: capturing
// the page this way needs no screen-share prompt. Served via /replay/<key>.
export const REPLAY_MIME = "application/gzip";
const REPLAY_EXT = "rrweb.gz";

export function isReplayKey(key: string | null): boolean {
  return !!key && key.endsWith(`.${REPLAY_EXT}`);
}

export function mediaExt(mime: string): string {
  return mime === REPLAY_MIME ? REPLAY_EXT : (mime.split("/")[1] ?? "bin");
}

type SniffedRole = "screenshot" | "recording" | "audio" | "webm";
const MAGIC: Array<{ bytes: number[]; mime: string; media: SniffedRole }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", media: "screenshot" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", media: "screenshot" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp", media: "screenshot" },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: "video/webm", media: "webm" },
  { bytes: [0x1f, 0x8b], mime: REPLAY_MIME, media: "recording" },
  { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4", media: "recording" },
  { bytes: [0x4f, 0x70, 0x75, 0x73], mime: "audio/ogg", media: "audio" },
  { bytes: [0xff, 0xfb], mime: "audio/mpeg", media: "audio" },
  { bytes: [0x49, 0x44, 0x33], mime: "audio/mpeg", media: "audio" },
  { bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41], mime: "audio/mp4", media: "audio" },
];

// WebM is a container for both video and audio. Role comes from the declared
// part, so a voice note in webm passes the audio check and a screen recording
// in webm passes the recording check.
export function sniffRole(head: Uint8Array, declared: "screenshot" | "recording" | "audio"): { mime: string } | null {
  for (const m of MAGIC) {
    if (!m.bytes.every((b, i) => head[i] === b)) continue;
    if (m.media === "webm") {
      return { mime: declared === "audio" ? "audio/webm" : "video/webm" };
    }
    if (m.media === declared) return { mime: m.mime };
  }
  return null;
}

