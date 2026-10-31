import { Hono } from "hono";
import { Boom, ErrorCode } from "@groot/core/errors";
import { ok } from "@groot/core/utils/api-response.utils";
import { clientIp } from "@groot/core/utils/controller.utils";
import type { AppEnv } from "@groot/core/types";
import { checkRate } from "../../lib/rate-limit";
import { parseSubmission } from "./feedback.schema";
import { submitFeedback } from "./feedback.service";

/**
 * `POST /api/v1/feedback`: the public submit endpoint the web widget and the
 * Android SDK post to (docs/CONTRACT.md). No auth, CORS `*` (`openCorsPaths`),
 * multipart with its own size caps (`uploadPaths`), 20 reports/hour per
 * project and IP.
 */
const router = new Hono<AppEnv>();

router.post("/", async (c) => {
  const input = await parseSubmission(c);

  const rate = await checkRate(`fb:${input.project}:${clientIp(c)}`);
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
