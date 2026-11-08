import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { Boom } from "@groot/core/errors";
import type { AppEnv } from "@groot/core/types";
import { ok } from "@groot/core/utils/api-response.utils";
import { parseBody } from "@groot/core/utils/controller.utils";
import { getApp, listRepositories } from "./github.client";
import { decryptPrivateKey, verifyWebhookSignature } from "./github.crypto";
import { syncIssueStatus } from "../feedback/feedback.service";
import { runtime } from "../../runtime";
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
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(runtime().publicOrigin ?? c.req.url).origin)
    throw Boom.forbidden("Cross-origin GitHub setup is not allowed");
  c.header("Cache-Control", "no-store");
  await next();
});

router.get("/", async (c) => ok(c, await service.settings()));
router.get("/repositories", async (c) => ok(c, (await getApp()) ? await listRepositories() : []));
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

const issueEventSchema = z.object({
  issue: z.object({ number: z.number().int().positive() }),
  repository: z.object({ full_name: z.string().min(3).max(200) }),
});

/** GitHub → FeedbackBee status sync. Public, authenticated by the webhook signature. */
githubCallbacks.post("/webhook", async (c) => {
  const body = await c.req.text();
  const app = await getApp();
  if (!app?.webhookSecret) throw Boom.notFound("Webhooks are not enabled");
  const secret = await decryptPrivateKey(app.webhookSecret);
  if (!(await verifyWebhookSignature(secret, body, c.req.header("x-hub-signature-256"))))
    throw Boom.unauthorized("Invalid webhook signature");
  // `ping` and any other event the app was subscribed to by hand: acknowledged, ignored.
  if (c.req.header("x-github-event") !== "issues") return c.body(null, 204);
  const event = issueEventSchema.safeParse(JSON.parse(body));
  if (!event.success) throw Boom.badRequest("Unexpected issues payload");
  await syncIssueStatus(event.data.repository.full_name, event.data.issue.number);
  return c.body(null, 204);
});
export default router;
