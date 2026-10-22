import { Hono } from "hono";
import type { Env } from "../types.ts";

export const mediaRoutes = new Hono<{ Bindings: Env }>();

mediaRoutes.get("/f/*", async (c) => {
  const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/f\//, ""));
  if (!key.startsWith("p/")) return c.text("not found", 404);
  const obj = await c.env.MEDIA.get(key);
  if (!obj) return c.text("not found", 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});
