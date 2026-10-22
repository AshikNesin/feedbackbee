import { Hono } from "hono";
import type { Env } from "../types.ts";
import { hashPassword, newId, newToken, verifyPassword } from "../lib/crypto.ts";

export const authRoutes = new Hono<{ Bindings: Env }>();

const SESSION_DAYS = 14;

async function adminByEmail(db: D1Database, email: string) {
  return db.prepare("SELECT * FROM admin WHERE email = ?").bind(email).first<{
    id: string;
    email: string;
    password_hash: string;
  }>();
}

async function ensureFirstAdmin(env: Env, email: string, password: string) {
  const db = env.DB;
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM admin").first<{ n: number }>();
  if (existing && existing.n > 0) return null;
  const row = { id: newId(), email, password_hash: await hashPassword(password), created_at: Date.now() };
  await db
    .prepare("INSERT INTO admin (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .bind(row.id, row.email, row.password_hash, row.created_at)
    .run();
  return row;
}

async function startSession(db: D1Database, adminId: string) {
  const token = newToken();
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  await db.prepare("INSERT INTO session (token, admin_id, expires_at) VALUES (?, ?, ?)").bind(token, adminId, expires).run();
  return { token, expires };
}

authRoutes.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email || !password) return c.json({ error: "email and password required" }, 400);

  const seeded = await ensureFirstAdmin(c.env, email, password);
  if (seeded) {
    const s = await startSession(c.env.DB, seeded.id);
    setCookie(c, s.token, s.expires);
    return c.json({ ok: true });
  }

  const admin = await adminByEmail(c.env.DB, email);
  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const s = await startSession(c.env.DB, admin.id);
  setCookie(c, s.token, s.expires);
  return c.json({ ok: true });
});

authRoutes.post("/auth/logout", async (c) => {
  const token = readCookie(c.req.header("cookie"));
  if (token) await c.env.DB.prepare("DELETE FROM session WHERE token = ?").bind(token).run();
  c.header("set-cookie", "fb_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  return c.json({ ok: true });
});

import type { Context } from "hono";

export function setCookie(c: Context, token: string, expires: number) {
  const expiresUtc = new Date(expires).toUTCString();
  c.header("set-cookie", `fb_session=${token}; Path=/; Expires=${expiresUtc}; HttpOnly; SameSite=Lax`);
}

export function readCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "fb_session") return rest.join("=");
  }
  return null;
}

export async function requireAdmin(db: D1Database, cookieHeader: string | undefined): Promise<boolean> {
  const token = readCookie(cookieHeader);
  if (!token) return false;
  const row = await db
    .prepare("SELECT admin_id FROM session WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now())
    .first<{ admin_id: string }>();
  return row !== null;
}
