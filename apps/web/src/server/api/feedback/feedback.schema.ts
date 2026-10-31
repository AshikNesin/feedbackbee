import { z } from "zod";
import { Boom, ErrorCode } from "@groot/core/errors";
import type { AppContext } from "@groot/core/types";
import { FEEDBACK_KINDS, type FeedbackMetadata } from "../../db/schema";

/**
 * The public submit form (`POST /api/v1/feedback`, docs/CONTRACT.md). Every
 * message reads after the field name ("text is required"), because the widget
 * and the Android SDK show it to the reporter as-is.
 */

export const LIMITS = {
  text: 5000,
  images: 5,
  imageBytes: 10 * 1024 * 1024,
  imagesBytes: 50 * 1024 * 1024,
  recordingBytes: 200 * 1024 * 1024,
  audioBytes: 25 * 1024 * 1024,
  seconds: 300,
} as const;

const blankToUndefined = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const requiredText = (max: number) =>
  z.preprocess(
    blankToUndefined,
    z.string({ error: "is required" }).max(max, `must be at most ${max} characters`),
  );

/** Optional context: a value over its cap is dropped, never fails the report. */
const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = blankToUndefined(value);
    return text !== undefined && text.length <= max ? text : undefined;
  }, z.string().optional());

const optionalNumber = z.preprocess((value) => {
  const text = blankToUndefined(value);
  return text === undefined ? undefined : Number(text);
}, z.number({ error: "must be a number" }).optional());

/** Repeated file parts, empty ones dropped. A text value where a file belongs is ignored. */
const files = z.preprocess(
  (value) =>
    (value === undefined ? [] : Array.isArray(value) ? value : [value]).filter(
      (part): part is File => part instanceof File && part.size > 0,
    ),
  z.array(z.instanceof(File)),
);

// Reporter context: a small untrusted JSON object of scalar values.
const METADATA_MAX_BYTES = 4096;
const METADATA_MAX_KEYS = 20;
const METADATA_KEY = /^[A-Za-z0-9_.-]{1,40}$/;
const METADATA_VALUE_MAX = 500;

const metadata = z.preprocess(blankToUndefined, z.string().optional()).transform((raw, ctx) => {
  if (raw === undefined) return null;
  const issue = (message: string) => {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  };
  if (raw.length > METADATA_MAX_BYTES) return issue(`exceeds ${METADATA_MAX_BYTES} bytes`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return issue("must be a valid JSON object");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return issue("must be a JSON object");
  }
  const entries = Object.entries(parsed);
  if (entries.length > METADATA_MAX_KEYS) return issue(`allows at most ${METADATA_MAX_KEYS} keys`);
  const normalized: FeedbackMetadata = {};
  for (const [key, value] of entries) {
    const name = key.slice(0, 40);
    if (!METADATA_KEY.test(key)) return issue(`key "${name}" is not allowed`);
    if (typeof value === "string" && value.length > METADATA_VALUE_MAX) {
      return issue(`value for "${name}" exceeds ${METADATA_VALUE_MAX} chars`);
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return issue(`value for "${name}" must be finite`);
    }
    if (!["string", "number", "boolean"].includes(typeof value)) {
      return issue("values must be strings, numbers, or booleans");
    }
    normalized[key] = value as string | number | boolean;
  }
  return normalized;
});

const seconds = (field: "media" | "audio") =>
  `${field}_seconds must be between 0 and ${LIMITS.seconds}`;

export const submissionSchema = z
  .object({
    project: requiredText(64),
    kind: z.enum(FEEDBACK_KINDS, { error: `must be one of ${FEEDBACK_KINDS.join(", ")}` }),
    text: requiredText(LIMITS.text),
    email: optionalText(320),
    reporter_name: optionalText(120),
    reporter_id: optionalText(128),
    metadata,
    url: optionalText(2048),
    screen_w: optionalNumber,
    screen_h: optionalNumber,
    app_version: optionalText(64),
    os_name: optionalText(32),
    os_version: optionalText(64),
    device_model: optionalText(128),
    image: files,
    media: files,
    media_seconds: optionalNumber,
    audio: files,
    audio_seconds: optionalNumber,
  })
  .superRefine((form, ctx) => {
    const inRange = (n: number | undefined) => n !== undefined && n >= 0 && n <= LIMITS.seconds;
    if (form.image.length > LIMITS.images) {
      ctx.addIssue({
        code: "custom",
        path: ["image"],
        message: `allows at most ${LIMITS.images} images`,
      });
    }
    if (form.media.length > 1) {
      ctx.addIssue({ code: "custom", path: ["media"], message: "allows one recording per report" });
    }
    if (form.audio.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["audio"],
        message: "allows one voice note per report",
      });
    }
    if (form.media.length > 0 && !inRange(form.media_seconds)) {
      ctx.addIssue({ code: "custom", path: [], message: `${seconds("media")} with media` });
    }
    if (form.audio.length > 0 && !inRange(form.audio_seconds)) {
      ctx.addIssue({ code: "custom", path: [], message: `${seconds("audio")} with audio` });
    }
  });

export type Submission = z.output<typeof submissionSchema>;

/** Parse and validate the multipart body; a 400 carries the first problem as a readable message. */
export async function parseSubmission(c: AppContext): Promise<Submission> {
  let body: unknown;
  try {
    body = await c.req.parseBody({ all: true });
  } catch {
    throw Boom.badRequest("invalid form data", undefined, ErrorCode.VALIDATION_ERROR.code);
  }
  const result = submissionSchema.safeParse(body);
  if (result.success) return result.data;
  const details: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join(".") || "form";
    details[field] = [...(details[field] ?? []), issue.message];
  }
  const first = result.error.issues[0]!;
  const field = first.path.join(".");
  const message = field ? `${field} ${first.message}` : first.message;
  throw Boom.badRequest(message, details, ErrorCode.VALIDATION_ERROR.code);
}
