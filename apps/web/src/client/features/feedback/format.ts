import type { FeedbackKind } from "../../../server/wire-types";

export const KIND_LABELS: Record<FeedbackKind, string> = {
  issue: "Issue",
  feature_request: "Feature request",
  other: "Other",
};

/** `m:ss` for a recording or voice-note length. */
export function clock(seconds: number | null): string {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** `host/path` of a page URL, for one-line display. */
export function pagePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

/** "Chrome on macOS" from a user agent, or null. */
export function browser(ua: string | null): string | null {
  if (!ua) return null;
  const name = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return [name, os].filter(Boolean).join(" on ") || null;
}

export const isReplay = (key: string | null) => !!key && key.endsWith(".rrweb.gz");
