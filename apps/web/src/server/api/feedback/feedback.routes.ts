import { Hono } from "hono";
import { Boom, ErrorCode } from "@groot/core/errors";
import { ok } from "@groot/core/utils/api-response.utils";
import { clientIp } from "@groot/core/utils/controller.utils";
import { findUserById } from "@groot/core/auth/auth.service";
import { verifySessionToken } from "@groot/core/session";
import type { AppContext, AppEnv } from "@groot/core/types";
import { checkRate } from "../../lib/rate-limit";
import { parseSubmission } from "./feedback.schema";
import { submitFeedback } from "./feedback.service";

/**
 * `POST /api/v1/feedback`: the public submit endpoint the web widget and the
 * Android SDK post to (docs/CONTRACT.md). No auth, CORS `*` (`openCorsPaths`),
 * multipart with its own size caps (`uploadPaths`), 20 reports/hour per
 * project and IP. The signed-in owner (the mobile apps send their session as
 * `Authorization: Bearer`) is not rate-limited.
 */
const router = new Hono<AppEnv>();

/**
 * A valid session in `Authorization: Bearer` for an account that still
 * exists (the same check as the dashboard's session guard). Anything else is
 * an anonymous reporter.
 */
async function fromOwner(c: AppContext): Promise<boolean> {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  try {
    const { userId } = await verifySessionToken(header.slice("Bearer ".length));
    return (await findUserById(userId)) !== null;
  } catch {
    return false;
  }
}

router.post("/", async (c) => {
  const input = await parseSubmission(c);

  const rate = (await fromOwner(c))
    ? { allowed: true as const }
    : await checkRate(`fb:${input.project}:${clientIp(c)}`);
  if (!rate.allowed) {
    c.header("Retry-After", String(rate.retryAfter));
    throw Boom.tooManyRequests(
      "too many submissions, try again later",
      undefined,
      ErrorCode.RATE_LIMIT_EXCEEDED.code,
    );
  }

  const result = await submitFeedback(input, {
    origin: new URL(c.req.url).origin,
    callerOrigin: c.req.header("origin"),
    userAgent: c.req.header("user-agent"),
  });
  return ok(c, result, result.state === "created" ? 201 : 202);
});

export default router;
