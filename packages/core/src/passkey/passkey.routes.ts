import { Hono } from "hono";
import { requireSession, startSession } from "../session";
import { authRateLimiter } from "../middlewares/rate-limit.middleware";
import { parseBody, parseId, requireUser } from "../utils/controller.utils";
import { ok, noContent } from "../utils/api-response.utils";
import * as passkeyService from "./passkey.service";
import {
  generateAuthenticationOptionsSchema,
  updatePasskeyNameSchema,
  verifyAuthenticationSchema,
  verifyRegistrationSchema,
} from "./passkey.schema";
import type { AppEnv } from "../types";

const router = new Hono<AppEnv>();

// Registration (signed in)
router.post("/register/options", requireSession, async (c) => {
  const { userId } = requireUser(c);
  return ok(c, await passkeyService.generateRegistrationOptions({ userId }));
});

router.post("/register/verify", requireSession, async (c) => {
  const { userId } = requireUser(c);
  const payload = await parseBody(c, verifyRegistrationSchema);
  return ok(
    c,
    await passkeyService.verifyRegistration({
      userId,
      response: payload.response,
      credentialName: payload.credentialName,
    }),
  );
});

// Login (public)
router.post("/login/options", authRateLimiter, async (c) => {
  const body = await parseBody(c, generateAuthenticationOptionsSchema);
  return ok(c, await passkeyService.generateAuthenticationOptions({ email: body.email }));
});

router.post("/login/verify", authRateLimiter, async (c) => {
  const body = await parseBody(c, verifyAuthenticationSchema);
  const user = await passkeyService.authenticatePasskey({ response: body.response });
  return ok(c, await startSession(c, user));
});

// Management (signed in)
router.get("/list", requireSession, async (c) => {
  const { userId } = requireUser(c);
  return ok(c, await passkeyService.listPasskeys({ userId }));
});

router.delete("/:id", requireSession, async (c) => {
  const { userId } = requireUser(c);
  await passkeyService.deletePasskey({ userId, passkeyId: parseId(c.req.param("id")) });
  return noContent(c);
});

router.patch("/:id", requireSession, async (c) => {
  const { userId } = requireUser(c);
  const payload = await parseBody(c, updatePasskeyNameSchema);
  return ok(
    c,
    await passkeyService.updatePasskeyName({
      userId,
      passkeyId: parseId(c.req.param("id")),
      credentialName: payload.credentialName,
    }),
  );
});

export default router;
