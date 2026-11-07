import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { Boom } from "@groot/core/errors";
import type { AppEnv } from "@groot/core/types";
import { ok } from "@groot/core/utils/api-response.utils";
import { parseBody } from "@groot/core/utils/controller.utils";
import { listRepositories } from "./github.client";
import * as service from "./github.service";

const FLOW_COOKIE = "feedbackbee_github_flow";
const COOKIE_PATH = "/api/v1/github";
const manifestSchema = z.object({
  organization: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/)
    .optional(),
});
const callbackSchema = z.object({ state: z.string().min(32).max(100) });
const router = new Hono<AppEnv>();

router.use(async (c, next) => {
  await service.requireOwner(c.get("user")!.userId);
  if (c.req.method !== "GET") {
    const origin = c.req.header("origin");
    if (origin && origin !== service.publicOrigin(new URL(c.req.url).origin))
      throw Boom.forbidden("Cross-origin GitHub setup is not allowed");
  }
  c.header("Cache-Control", "no-store");
  await next();
});

router.get("/", async (c) => ok(c, await service.settings()));
router.get("/repositories", async (c) => ok(c, await listRepositories()));
router.post("/manifest", async (c) => {
  const input = await parseBody(c, manifestSchema);
  const result = await service.startManifest(
    c.get("user")!.userId,
    service.publicOrigin(new URL(c.req.url).origin),
    input.organization,
  );
  setCookie(c, FLOW_COOKIE, result.binding, {
    path: COOKIE_PATH,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
  });
  return ok(c, { url: result.url, manifest: result.manifest });
});
router.post("/install", async (c) => {
  service.publicOrigin(new URL(c.req.url).origin);
  const result = await service.startInstallation(c.get("user")!.userId);
  setCookie(c, FLOW_COOKIE, result.binding, {
    path: COOKIE_PATH,
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600,
  });
  return ok(c, { url: result.url });
});
router.post("/disconnect", async (c) => ok(c, await service.disconnect()));

/** The auth cookie is Strict; only the short-lived, browser-bound setup capability crosses this redirect. */
export const githubCallbacks = new Hono<AppEnv>();
for (const kind of ["callback", "installed"] as const) {
  githubCallbacks.get(`/${kind}`, async (c) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    const binding = getCookie(c, FLOW_COOKIE);
    deleteCookie(c, FLOW_COOKIE, { path: COOKIE_PATH, secure: true });
    try {
      if (!binding) throw Boom.badRequest("Missing GitHub setup cookie");
      const query = callbackSchema.parse(c.req.query());
      if (kind === "callback") {
        const code = z.string().min(1).max(200).parse(c.req.query("code"));
        await service.completeManifest(query.state, binding, code);
      } else {
        const id = z.coerce.number().int().positive().parse(c.req.query("installation_id"));
        await service.completeInstallation(query.state, binding, id);
      }
      return c.redirect(`/app/settings?github=${kind === "callback" ? "connected" : "installed"}`);
    } catch {
      return c.redirect("/app/settings?github=error");
    }
  });
}
export default router;
