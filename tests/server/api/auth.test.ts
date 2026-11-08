import { pbkdf2Sync, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";
import { db, users } from "@groot/core/database";
import { needsRehash } from "@groot/core/utils/password.utils";
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

  it("upgrades a hash made with an older iteration count on the next login", async () => {
    const { user, email, password } = await signIn(app);
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(password, salt, 1_000, 32, "sha256");
    const old = ["pbkdf2-sha256", "1000", salt.toString("base64url"), hash.toString("base64url")];
    await db
      .update(users)
      .set({ password: old.join("$") })
      .where(eq(users.id, user.id));

    const login = await api(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email, password },
    });
    expect(login.status).toBe(200);

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row!.password).not.toBe(old.join("$"));
    expect(needsRehash(row!.password)).toBe(false);
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

  it("codes only the session guard's 401 as SESSION_INVALID", async () => {
    const { email, token } = await signIn(app);
    const tampered = `${token.slice(0, -2)}xx`;
    for (const rejected of [
      await api(app, "/api/v1/auth/me"),
      await api(app, "/api/v1/auth/me", { token: tampered }),
      await api(app, "/api/v1/bots", { token: "garbage" }),
    ]) {
      expect(rejected.status).toBe(401);
      expect(rejected.body.error?.code).toBe("SESSION_INVALID");
    }

    const wrongPassword = await api(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email, password: "wrong-password" },
    });
    const noAdminKey = await api(app, "/api/v1/auth/users", { token });
    for (const refused of [wrongPassword, noAdminKey]) {
      expect(refused.status).toBe(401);
      expect(refused.body.error?.code).toBe("UNAUTHORIZED");
    }
  });

  it("refuses a valid token whose account is gone", async () => {
    const { token, user } = await signIn(app);
    await db.delete(users).where(eq(users.id, user.id));
    const gone = await api(app, "/api/v1/auth/me", { token });
    expect(gone.status).toBe(401);
    expect(gone.body.error?.code).toBe("SESSION_INVALID");
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
