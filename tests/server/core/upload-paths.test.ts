import { describe, expect, it } from "vite-plus/test";
import { createApp } from "@groot/core/app";

function buildApp() {
  return createApp({
    bodyLimitBytes: 16,
    uploadPaths: ["/api/v1/feedback", "/api/v1/media/*"],
    routes(app) {
      const echo = async (c: { req: { text(): Promise<string> }; json(v: unknown): Response }) =>
        c.json({ size: (await c.req.text()).length });
      app.post("/api/v1/feedback", echo as never);
      app.post("/api/v1/media/upload", echo as never);
      app.post("/api/v1/notes", echo as never);
    },
  });
}

const post = (path: string, size: number) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) },
    body: "x".repeat(size),
  });

describe("createApp uploadPaths", () => {
  it("skips the JSON body limit on upload endpoints (exact and prefix)", async () => {
    const app = buildApp();
    expect((await app.fetch(post("/api/v1/feedback", 64))).status).toBe(200);
    expect((await app.fetch(post("/api/v1/media/upload", 64))).status).toBe(200);
  });

  it("keeps the limit on every other API route", async () => {
    const app = buildApp();
    expect((await app.fetch(post("/api/v1/notes", 64))).status).toBe(413);
    expect((await app.fetch(post("/api/v1/notes", 8))).status).toBe(200);
    expect((await app.fetch(post("/api/v1/feedbackx", 64))).status).toBe(413);
  });
});
