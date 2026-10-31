import { Hono } from "hono";
import { createApp, type CreateAppOptions } from "@groot/core/app";
import { bootstrap, type BootstrapOptions } from "@groot/core/bootstrap";
import { env, type Env } from "@groot/core/env";
import type { AppEnv } from "@groot/core/types";
import { jwtAuthMiddleware } from "@groot/core/middlewares/jwt-auth.middleware";
import authRoutes from "@groot/core/auth/auth.routes";
import passkeyRoutes from "@groot/core/passkey/passkey.routes";
import appSettingsRoutes from "@groot/core/settings/app-settings.routes";
import { firstOwner } from "./api/auth/first-owner";
import demoRoutes from "./api/demo/demo.routes";
import embedRoutes from "./api/embed/embed.routes";
import feedbackRoutes from "./api/feedback/feedback.routes";
import mediaRoutes from "./api/media/media.routes";
import projectRoutes from "./api/projects/projects.routes";
import { appConfig } from "./config";
import { memoryStorage } from "@groot/core/storage/memory";
import { adapterMedia, type MediaStore } from "./lib/media";
import { setRuntime } from "./runtime";

/** What a runtime supplies: its env source and adapters. Everything else is the app's. */
export type WebRuntime = Omit<BootstrapOptions, "config"> & {
  /** Where report attachments live: R2 on Workers, local disk on Node. Default: memory (tests, scripts). */
  media?: MediaStore | ((env: Env) => MediaStore);
};

/** The public submit endpoint: any website may post to it, without credentials. */
export const SUBMIT_PATH = "/api/v1/feedback";

/**
 * Paths the server answers; everything else is the dashboard SPA. Mirrors
 * `assets.run_worker_first` in wrangler.jsonc, for the Node dev server.
 */
const SERVER_PATHS = [
  "/api/*",
  "/health",
  "/ready",
  "/embed.js",
  "/embed-capture.js",
  "/embed-record.js",
  "/replay-player.js",
  "/replay/*",
  "/f/*",
  "/demo",
];

export function isServerPath(path: string): boolean {
  return SERVER_PATHS.some((p) => (p.endsWith("*") ? path.startsWith(p.slice(0, -1)) : path === p));
}

/**
 * The one boot sequence for the Node and Workers entries and the test setup:
 * bootstrap core with the app config, set the app runtime, build the HTTP app.
 */
export function startWebApp({ media, ...runtime }: WebRuntime) {
  bootstrap({ ...runtime, config: appConfig });
  const store = typeof media === "function" ? media(env) : (media ?? adapterMedia(memoryStorage()));
  setRuntime(store, runtime.env);
  return createWebApp();
}

/** The HTTP app shared by the Node and Workers entries. */
export function createWebApp(
  options: Omit<CreateAppOptions, "routes" | "openCorsPaths" | "uploadPaths"> = {},
) {
  return createApp({
    ...options,
    openCorsPaths: [SUBMIT_PATH],
    uploadPaths: [SUBMIT_PATH],
    routes(app) {
      // Public: the widget, its scripts, media and the demo page.
      app.route(SUBMIT_PATH, feedbackRoutes);
      app.route("/", embedRoutes); // /embed.js, /embed-capture.js, /embed-record.js
      app.route("/", mediaRoutes); // /f/*, /replay/*, /replay-player.js
      app.route("/", demoRoutes); // /demo

      // Auth (core): password + passkeys. The first sign-in creates the owner.
      app.post("/api/v1/auth/login", firstOwner);
      app.route("/api/v1/auth", authRoutes);
      app.route("/api/v1/passkey", passkeyRoutes);

      // Dashboard API (JWT cookie or bearer token).
      const api = new Hono<AppEnv>();
      api.use(jwtAuthMiddleware);
      api.route("/projects", projectRoutes);
      api.route("/settings", appSettingsRoutes);
      app.route("/api/v1", api);
    },
  });
}
