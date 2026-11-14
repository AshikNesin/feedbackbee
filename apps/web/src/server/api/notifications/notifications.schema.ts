import { z } from "zod";
import { FEEDBACK_KINDS } from "../../db/schema";

/** `HH:MM`, 24-hour. */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

const timeZone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone");

/**
 * Push notification preferences (Pushover). The Pushover credentials are not
 * here: they are the `PUSHOVER_USER_KEY` / `PUSHOVER_API_TOKEN` env vars.
 *
 * Every field has a default, so a stored value from an older version (or none
 * at all) parses into a complete settings object.
 */
export const notificationSettingsSchema = z.object({
  /** Master switch. */
  enabled: z.boolean().default(true),
  /** When: which events send a notification. */
  events: z
    .object({
      /** A report arrived (and its GitHub issue was filed, or failed). */
      newFeedback: z.boolean().default(true),
      /** A report was stored but its GitHub issue could not be filed. */
      issueError: z.boolean().default(true),
      /** A report's status changed on GitHub (issue closed, reopened, labelled in progress). */
      statusChange: z.boolean().default(false),
    })
    .prefault({}),
  /** Which kinds of feedback notify. */
  kinds: z
    .array(z.enum(FEEDBACK_KINDS))
    .max(FEEDBACK_KINDS.length)
    .default([...FEEDBACK_KINDS]),
  /** Which projects notify, by id. Empty: every project, including new ones. */
  projectIds: z.array(z.string().min(1).max(100)).max(500).default([]),
  /** What: the parts of a report included in the message. */
  content: z
    .object({
      /** The feedback text. */
      text: z.boolean().default(true),
      /** The reporter's name and email. Sent to Pushover, so off by default. */
      reporter: z.boolean().default(false),
      /** Page URL, app version, OS and device. */
      context: z.boolean().default(false),
    })
    .prefault({}),
  /** Pushover priority: -2 no alert, -1 quiet, 0 normal, 1 high (bypasses the phone's quiet hours). */
  priority: z.union([z.literal(-2), z.literal(-1), z.literal(0), z.literal(1)]).default(0),
  /** A daily window in which notifications are sent silently (priority -2) or not at all. */
  quietHours: z
    .object({
      enabled: z.boolean().default(false),
      start: clockTime.default("22:00"),
      end: clockTime.default("07:00"),
      timeZone: timeZone.default("UTC"),
      mode: z.enum(["silent", "skip"]).default("silent"),
    })
    .prefault({}),
});

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>;
