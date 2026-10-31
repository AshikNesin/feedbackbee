import type { StorageAdapter } from "@groot/core/storage";

/**
 * Report attachments (images, recordings, voice notes) and how they are
 * stored. Not groot's `StorageAdapter` on Workers: that buffers whole objects,
 * and a 200 MB recording would blow the Worker's 128 MB memory ceiling, so R2
 * gets the request's File stream and serves the object's stream back.
 */
export interface MediaStore {
  put(key: string, file: Blob, contentType: string): Promise<void>;
  get(key: string): Promise<StoredMedia | null>;
}

export interface StoredMedia {
  body: ReadableStream | Uint8Array<ArrayBuffer>;
  contentType: string;
  etag?: string;
}

/** Media is immutable once uploaded (keys are random), so it caches forever. */
export const MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable";

/** The subset of a Workers R2 binding the media store needs. */
export interface MediaBucket {
  put(
    key: string,
    value: Blob,
    options: { httpMetadata: { contentType: string; cacheControl: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{
    body: ReadableStream;
    httpEtag: string;
    httpMetadata?: { contentType?: string };
  } | null>;
}

/** Workers: stream straight to and from the R2 bucket. */
export function r2Media(bucket: MediaBucket): MediaStore {
  return {
    async put(key, file, contentType) {
      await bucket.put(key, file, {
        httpMetadata: { contentType, cacheControl: MEDIA_CACHE_CONTROL },
      });
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return null;
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType ?? contentTypeFor(key),
        etag: object.httpEtag,
      };
    },
  };
}

/** Node (`pnpm dev`): groot's storage adapter (local disk). Buffers, which is fine off Workers. */
export function adapterMedia(adapter: StorageAdapter): MediaStore {
  return {
    async put(key, file, contentType) {
      await adapter.put(key, file, { contentType });
    },
    async get(key) {
      const found = await adapter.get(key);
      if (!found) return null;
      // The local adapter derives types from extensions it knows; ours are listed here.
      return { body: found.bytes, contentType: contentTypeFor(key) };
    },
  };
}

// ---------------------------------------------------------------------------
// What an upload is, decided from its bytes rather than the client's claim.

/** Web recordings are rrweb DOM replays (gzipped JSON), watched at /replay/<key>. */
export const REPLAY_MIME = "application/gzip";
const REPLAY_EXT = "rrweb.gz";

export type MediaRole = "image" | "recording" | "audio";

const MAGIC: Array<{ bytes: number[]; mime: string; role: MediaRole | "webm" }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", role: "image" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", role: "image" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp", role: "image" },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: "video/webm", role: "webm" },
  { bytes: [0x1f, 0x8b], mime: REPLAY_MIME, role: "recording" },
  { bytes: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4", role: "recording" },
  { bytes: [0x4f, 0x70, 0x75, 0x73], mime: "audio/ogg", role: "audio" },
  { bytes: [0xff, 0xfb], mime: "audio/mpeg", role: "audio" },
  { bytes: [0x49, 0x44, 0x33], mime: "audio/mpeg", role: "audio" },
  {
    bytes: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41],
    mime: "audio/mp4",
    role: "audio",
  },
];

/**
 * The content type of an upload in `role`, from its first 16 bytes, or null
 * when the bytes are not an accepted format for that role. WebM carries video
 * and audio alike, so its role comes from the part it was sent in.
 */
export async function sniff(file: Blob, role: MediaRole): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const m of MAGIC) {
    if (!m.bytes.every((b, i) => head[i] === b)) continue;
    if (m.role === "webm")
      return role === "audio" ? "audio/webm" : role === "recording" ? "video/webm" : null;
    if (m.role === role) return m.mime;
  }
  return null;
}

export function isReplayKey(key: string | null | undefined): boolean {
  return !!key && key.endsWith(`.${REPLAY_EXT}`);
}

/** A fresh object key for an attachment of `projectId`. */
export function mediaKey(projectId: string, contentType: string): string {
  const ext = contentType === REPLAY_MIME ? REPLAY_EXT : (contentType.split("/")[1] ?? "bin");
  return `p/${projectId}/f/${crypto.randomUUID()}.${ext}`;
}

const TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  webm: "video/webm",
  mp4: "video/mp4",
  ogg: "audio/ogg",
  mpeg: "audio/mpeg",
  gz: REPLAY_MIME,
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop() ?? "";
  return Object.hasOwn(TYPE_BY_EXT, ext) ? TYPE_BY_EXT[ext]! : "application/octet-stream";
}
