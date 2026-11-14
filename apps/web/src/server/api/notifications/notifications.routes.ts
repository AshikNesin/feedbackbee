import { Hono } from "hono";
import type { AppEnv } from "@groot/core/types";
import { ok } from "@groot/core/utils/api-response.utils";
import { parseBody } from "@groot/core/utils/controller.utils";
import { notificationSettingsSchema } from "./notifications.schema";
import * as service from "./notifications.service";

/** Dashboard API: `/api/v1/notifications`. Mounted behind the JWT middleware. */
const router = new Hono<AppEnv>();

router.get("/", async (c) =>
  ok(c, {
    configured: service.pushoverConfigured(),
    settings: await service.getNotificationSettings(),
  }),
);

router.put("/", async (c) => {
  const settings = await parseBody(c, notificationSettingsSchema);
  return ok(c, {
    configured: service.pushoverConfigured(),
    settings: await service.saveNotificationSettings(settings),
  });
});

router.post("/test", async (c) => ok(c, await service.sendTestNotification()));

export default router;
