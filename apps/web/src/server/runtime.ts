import type { EnvSource } from "@groot/core/env";
import type { MediaStore } from "./lib/media";

/**
 * FeedbackBee's runtime pieces beyond what groot's `bootstrap()` wires: the
 * media store and the app's own settings. Set once by `startWebApp()`; services
 * read them through `runtime()` and never touch Workers bindings directly, so
 * the same code runs on Workers (R2) and Node (local disk).
 */
export interface AppRuntime {
  media: MediaStore;
  /** Base64 32-byte encryption key, kept outside the database. */
  encryptionKey?: string;
  /** Canonical origin for GitHub redirects. */
  publicOrigin?: string;
  /** Public origin for media links in GitHub issues. Default: the request's origin. */
  mediaBase?: string;
  /** Public origin of the dashboard for the "view in FeedbackBee" link. Default: the request's origin. */
  dashboardBase?: string;
}

let current: AppRuntime | undefined;

export function setRuntime(media: MediaStore, env: EnvSource): void {
  current = {
    media,
    encryptionKey: env.FEEDBACKBEE_ENCRYPTION_KEY || undefined,
    publicOrigin: env.ORIGIN?.replace(/\/+$/, "") || undefined,
    mediaBase: env.MEDIA_BASE?.replace(/\/+$/, "") || undefined,
    dashboardBase: env.DASHBOARD_BASE?.replace(/\/+$/, "") || undefined,
  };
}

export function runtime(): AppRuntime {
  if (!current) throw new Error("App runtime is not set. Boot through startWebApp().");
  return current;
}
