import { Hono } from "hono";
import { adminAuthMiddleware } from "../middlewares/admin-auth.middleware";
import { authRateLimiter } from "../middlewares/rate-limit.middleware";
import { parseBody, requireUser } from "../utils/controller.utils";
import { endSession, requireSession, startSession } from "../session";
import { ok } from "../utils/api-response.utils";
import * as authService from "./auth.service";
import { createUserSchema, loginSchema } from "./auth.schema";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

router.post("/login", authRateLimiter, async (c) => {
  const body = await parseBody(c, loginSchema);
  return ok(c, await startSession(c, await authService.authenticate(body)));
});

// First-run setup: open only while no account exists, so a fresh deploy can
// create its first user from the browser instead of via the admin API.
router.get("/setup", async (c) => {
  return ok(c, { needsSetup: !(await authService.hasAnyUser()) });
});

router.post("/setup", authRateLimiter, async (c) => {
  const body = await parseBody(c, createUserSchema);
  return ok(c, await startSession(c, await authService.setupFirstUser(body)), 201);
});

router.post("/logout", requireSession, (c) => {
  endSession(c);
  return ok(c, { status: "logged out" });
});

router.get("/me", requireSession, async (c) => {
  const { userId } = requireUser(c);
  return ok(c, await authService.getUserById({ userId }));
});

// Admin-only user management (X-Admin-Auth-Key header).
router.post("/users", adminAuthMiddleware, async (c) => {
  const body = await parseBody(c, createUserSchema);
  return ok(c, await authService.createUser(body), 201);
});

router.get("/users", adminAuthMiddleware, async (c) => {
  return ok(c, await authService.getAllUsers());
});

export default router;
