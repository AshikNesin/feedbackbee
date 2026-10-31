import { describe, expect, it } from "vite-plus/test";
import { Hono } from "hono";
import { createApp } from "@groot/core/app";
import { db, users } from "@groot/core/database";
import { Boom } from "@groot/core/errors";
import type { AppEnv } from "@groot/core/types";
import { ok } from "@groot/core/utils/api-response.utils";
import { parseBody } from "@groot/core/utils/controller.utils";
import { z } from "zod";
import { api } from "../helpers";

function buildApp(readiness?: () => string | undefined) {
  return createApp({
    readiness,
    routes(app) {
      const r = new Hono<AppEnv>();
      r.get("/ok", (c) => ok(c, { hello: "world" }));
      r.get("/boom", () => {
        throw Boom.forbidden("nope");
      });
      r.get("/crash", () => {
        throw new Error("kaboom");
      });
      r.get("/duplicate", async (c) => {
        const row = { email: "dupe@example.com", password: "x" };
        await db.insert(users).values(row);
        await db.insert(users).values(row);
        return ok(c, {});
      });
      r.post("/validate", async (c) =>
        ok(c, await parseBody(c, z.object({ name: z.string().min(2) }))),
      );
      app.route("/api/v1/t", r);
    },
  });
}

describe("createApp", () => {
  it("serves health and readiness", async () => {
    const app = buildApp();
    const health = await api(app, "/health");
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: "ok" });
    expect((await api(app, "/ready")).body).toEqual({ ready: true });
  });

  it("reports a readiness reason with 503", async () => {
    let ready = false;
    const app = buildApp(() => (ready ? undefined : "warming up"));
    expect(await api(app, "/ready")).toMatchObject({
      status: 503,
      body: { ready: false, reason: "warming up" },
    });
    expect((await api(app, "/health")).body).toMatchObject({
      status: "not_ready",
      reason: "warming up",
    });
    ready = true;
    expect((await api(app, "/ready")).status).toBe(200);
  });

  it("wraps data in the success envelope and tags the request id", async () => {
    const response = await api(buildApp(), "/api/v1/t/ok", {
      headers: { "x-request-id": "abc-123" },
    });
    expect(response.body).toEqual({ success: true, data: { hello: "world" } });
    expect(response.headers.get("x-request-id")).toBe("abc-123");
  });

  it("formats HttpErrors, validation errors, 404s and crashes consistently", async () => {
    const app = buildApp();
    expect(await api(app, "/api/v1/t/boom")).toMatchObject({
      status: 403,
      body: { success: false, error: { code: "FORBIDDEN", message: "nope" } },
    });
    const invalid = await api(app, "/api/v1/t/validate", { method: "POST", json: { name: "x" } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { name: [expect.any(String)] },
    });
    const badJson = await api(app, "/api/v1/t/validate", {
      method: "POST",
      body: "{nope",
      headers: { "content-type": "application/json" },
    });
    expect(badJson.status).toBe(400);
    expect(await api(app, "/api/v1/missing")).toMatchObject({
      status: 404,
      body: { error: { code: "NOT_FOUND" } },
    });
    const crash = await api(app, "/api/v1/t/crash");
    expect(crash.status).toBe(500);
    expect(crash.body.error?.code).toBe("INTERNAL_ERROR");
  });

  it("maps UNIQUE violations to a 409 conflict envelope", async () => {
    const app = buildApp();
    const duplicate = await api(app, "/api/v1/t/duplicate");
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatchObject({
      code: "CONFLICT",
      message: "A record with this email already exists",
    });
  });

  it("limits JSON bodies on API routes", async () => {
    const response = await api(buildApp(), "/api/v1/t/validate", {
      method: "POST",
      json: { name: "x".repeat(2 * 1024 * 1024) },
    });
    expect(response.status).toBe(413);
  });
});
