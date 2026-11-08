import { describe, expect, it } from "vite-plus/test";
import { api, createTestApp } from "../helpers";

// Each test file gets a fresh database, so this one starts with no users.
const app = createTestApp();
const payload = { email: "owner@example.com", password: "long-enough-pw", name: "Owner" };

describe("first-run setup", () => {
  it("creates the first user, signs it in, then closes", async () => {
    const before = await api<{ needsSetup: boolean }>(app, "/api/v1/auth/setup");
    expect(before.body.data).toEqual({ needsSetup: true });

    const invalid = await api(app, "/api/v1/auth/setup", {
      method: "POST",
      json: { email: "nope", password: "x" },
    });
    expect(invalid.status).toBe(400);

    const created = await api<{ token: string; user: { email: string } }>(
      app,
      "/api/v1/auth/setup",
      { method: "POST", json: payload },
    );
    expect(created.status).toBe(201);
    expect(created.body.data?.user).toMatchObject({ email: payload.email, name: "Owner" });
    expect(created.headers.get("set-cookie")).toMatch(/^token=/);

    const me = await api<{ email: string }>(app, "/api/v1/auth/me", {
      token: created.body.data!.token,
    });
    expect(me.body.data?.email).toBe(payload.email);

    const after = await api<{ needsSetup: boolean }>(app, "/api/v1/auth/setup");
    expect(after.body.data).toEqual({ needsSetup: false });

    const again = await api(app, "/api/v1/auth/setup", {
      method: "POST",
      json: { ...payload, email: "intruder@example.com" },
    });
    expect(again.status).toBe(403);
    const login = await api(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email: "intruder@example.com", password: payload.password },
    });
    expect(login.status).toBe(401);
  });
});
