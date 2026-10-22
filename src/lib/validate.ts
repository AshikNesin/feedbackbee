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

const MAGIC: Array<{ bytes: number[]; mime: string; media: "screenshot" | "recording" }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", media: "screenshot" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", media: "screenshot" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp", media: "screenshot" },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: "video/webm", media: "recording" },
  { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4", media: "recording" },
];

export function sniffMedia(head: Uint8Array): { mime: string; media: "screenshot" | "recording" } | null {
  for (const m of MAGIC) {
    if (m.bytes.every((b, i) => head[i] === b)) return { mime: m.mime, media: m.media };
  }
  return null;
}
