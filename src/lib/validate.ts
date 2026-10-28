import type { FeedbackKind, MediaKind } from "../types.ts";

const FEEDBACK_KINDS: readonly FeedbackKind[] = ["issue", "feature_request", "other"];
// Old clients still send the pre-1.1 kind names; mapped once, here, so the
// stored value and every response use only the new names.
const LEGACY_KINDS: Record<string, FeedbackKind> = {
  bug: "issue",
  idea: "feature_request",
  feedback: "other",
};
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
  if (typeof v !== "string") return null;
  if ((FEEDBACK_KINDS as readonly string[]).includes(v)) return v as FeedbackKind;
  return LEGACY_KINDS[v] ?? null;
}

export function mediaKind(v: File | string | null): MediaKind | null {
  return typeof v === "string" && (MEDIA_KINDS as readonly string[]).includes(v)
    ? (v as MediaKind)
    : null;
}

// Reporter context (contract v1.1): a small untrusted JSON object. Valid input
// is normalized through one JSON round-trip, so what lands in D1 is stable
// regardless of key order or whitespace the client sent.
export const METADATA_MAX_BYTES = 4096;
const METADATA_MAX_KEYS = 20;
const METADATA_KEY = /^[A-Za-z0-9_.-]{1,40}$/;
const METADATA_VALUE_MAX = 500;

export function metadata(
  v: File | string | null,
): { ok: true; json: string } | { ok: false; error: string } {
  if (typeof v !== "string") return { ok: false, error: "metadata must be a JSON object" };
  const raw = v.trim();
  if (!raw) return { ok: false, error: "metadata must be a JSON object" };
  if (raw.length > METADATA_MAX_BYTES) {
    return { ok: false, error: `metadata exceeds ${METADATA_MAX_BYTES} bytes` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "metadata must be a valid JSON object" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "metadata must be a JSON object" };
  }
  const obj = parsed as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length > METADATA_MAX_KEYS) {
    return { ok: false, error: `metadata allows at most ${METADATA_MAX_KEYS} keys` };
  }
  const normalized: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    if (!METADATA_KEY.test(key)) {
      return { ok: false, error: `metadata key "${key.slice(0, 40)}" is not allowed` };
    }
    const value = obj[key];
    if (typeof value === "string") {
      if (value.length > METADATA_VALUE_MAX) {
        return { ok: false, error: `metadata value for "${key.slice(0, 40)}" exceeds ${METADATA_VALUE_MAX} chars` };
      }
      normalized[key] = value;
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return { ok: false, error: `metadata value for "${key.slice(0, 40)}" must be finite` };
      }
      normalized[key] = value;
    } else if (typeof value === "boolean") {
      normalized[key] = value;
    } else {
      return { ok: false, error: "metadata values must be strings, numbers, or booleans" };
    }
  }
  return { ok: true, json: JSON.stringify(normalized) };
}

export const REPORTER_NAME_MAX = 120;
export const REPORTER_ID_MAX = 128;

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

