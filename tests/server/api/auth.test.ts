import { describe, expect, it } from "vite-plus/test";
import { adminHeaders, api, createTestApp, signIn } from "../helpers";

const app = createTestApp();

describe("auth API", () => {
  it("logs in with a cookie and a bearer token", async () => {
    const { token, cookie, email } = await signIn(app);
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/);
    const me = await api<{ email: string }>(app, "/api/v1/auth/me", { token });
    expect(me.status).toBe(200);
    expect(me.body.data?.email).toBe(email);
    const viaCookie = await api(app, "/api/v1/auth/me", {
      headers: { cookie: cookie!.split(";")[0]! },
    });
    expect(viaCookie.status).toBe(200);
  });

  it("rejects wrong credentials and missing tokens", async () => {
    const { email } = await signIn(app);
    const bad = await api(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "wrong-password" },
    });
    expect(bad.status).toBe(401);
    const unknown = await api(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email: "nobody@example.com", password: "whatever-1" },
    });
    expect(unknown.status).toBe(401);
    expect((await api(app, "/api/v1/auth/me")).status).toBe(401);
    expect((await api(app, "/api/v1/auth/me", { token: "garbage" })).status).toBe(401);
    expect((await api(app, "/api/v1/todos")).status).toBe(401);
  });

  it("validates the login payload", async () => {
    const response = await api(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email: "nope", password: "x" },
    });
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("VALIDATION_ERROR");
  });

  it("logs out by clearing the cookie", async () => {
    const { token } = await signIn(app);
    const response = await api(app, "/api/v1/auth/logout", { method: "POST", token });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/token=;|Max-Age=0/);
  });

  it("guards user management behind the admin key", async () => {
    const payload = { email: "new@example.com", password: "long-enough-pw", name: "New" };
    expect((await api(app, "/api/v1/auth/users", { method: "POST", json: payload })).status).toBe(
      401,
    );
    expect(
      (
        await api(app, "/api/v1/auth/users", {
          method: "POST",
          json: payload,
          headers: { "x-admin-auth-key": "wrong" },
        })
      ).status,
    ).toBe(403);

    const created = await api<{ id: number; email: string }>(app, "/api/v1/auth/users", {
      method: "POST",
      json: payload,
      headers: adminHeaders(),
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ email: "new@example.com", name: "New" });
    expect(created.body.data).not.toHaveProperty("password");

    const duplicate = await api(app, "/api/v1/auth/users", {
      method: "POST",
      json: payload,
      headers: adminHeaders(),
    });
    expect(duplicate.status).toBe(409);

    const list = await api<Array<{ email: string }>>(app, "/api/v1/auth/users", {
      headers: adminHeaders(),
    });
    expect(list.body.data?.some((u) => u.email === "new@example.com")).toBe(true);
  });
});
