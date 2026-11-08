import { eq } from "drizzle-orm";
import { db, users, type User } from "../database";
import { Boom } from "../errors";
import { issueSession } from "../session/token";
import { hashPassword, needsRehash, verifyPassword } from "../utils/password.utils";
import type { CreateUserDTO, LoginDTO, SignInResponse } from "./auth.schema";

export type PublicUser = Pick<User, "id" | "email" | "name" | "createdAt">;

/** A well-formed hash that matches nothing, so login timing is identical for unknown emails. */
const DUMMY_HASH = `pbkdf2-sha256$100000$${"A".repeat(22)}$${"A".repeat(43)}`;

const publicColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  createdAt: users.createdAt,
};

/** The public columns of a user record: never the password hash. */
export function toPublicUser(user: PublicUser): PublicUser {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export async function findUserById(id: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

/**
 * Check an email and password: the account on a match, a plain 401 otherwise
 * (never `SESSION_INVALID`). The route signs it in with `startSession`.
 */
export async function authenticate(data: LoginDTO): Promise<PublicUser> {
  const user = await findUserByEmail(data.email);
  const isValid = await verifyPassword(data.password, user?.password ?? DUMMY_HASH);
  if (!user || !isValid) {
    throw Boom.unauthorized("Invalid email or password");
  }
  // Re-hash a PBKDF2 hash made with an older iteration count now that we hold
  // the password. (verifyPassword accepts only pbkdf2-sha256 hashes.)
  if (needsRehash(user.password)) {
    await db
      .update(users)
      .set({ password: await hashPassword(data.password) })
      .where(eq(users.id, user.id));
  }
  return toPublicUser(user);
}

/**
 * @deprecated Use `authenticate`, then `startSession` from
 * `@groot/core/session`, which also sets the cookie.
 */
export async function login(data: LoginDTO): Promise<SignInResponse> {
  return issueSession(await authenticate(data));
}

export async function createUser(data: CreateUserDTO): Promise<PublicUser> {
  if (await findUserByEmail(data.email)) {
    throw Boom.conflict("User with this email already exists");
  }

  const [user] = await db
    .insert(users)
    .values({ email: data.email, password: await hashPassword(data.password), name: data.name })
    .returning(publicColumns);
  return user!;
}

/** True once any account exists — first-run setup is closed from then on. */
export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ id: users.id }).from(users).limit(1);
  return row !== undefined;
}

/**
 * First-run setup: create the very first account. Refused once any account
 * exists. Two racing requests can both insert (no transactions in core), so
 * whoever is not the lowest id removes its own row and is refused — exactly
 * one setup wins. The route signs the account in with `startSession`.
 */
export async function setupFirstUser(data: CreateUserDTO): Promise<PublicUser> {
  const closed = () => Boom.forbidden("Setup is already complete. Sign in instead.");
  if (await hasAnyUser()) throw closed();

  const user = await createUser(data);
  const [first] = await db.select({ id: users.id }).from(users).orderBy(users.id).limit(1);
  if (first?.id !== user.id) {
    await db.delete(users).where(eq(users.id, user.id));
    throw closed();
  }
  return user;
}

/**
 * @deprecated Use `setupFirstUser`, then `startSession` from
 * `@groot/core/session`, which also sets the cookie.
 */
export async function createFirstUser(data: CreateUserDTO): Promise<SignInResponse> {
  return issueSession(await setupFirstUser(data));
}

export async function getUserById({ userId }: { userId: number }): Promise<PublicUser> {
  const user = await findUserById(userId);
  if (!user) {
    throw Boom.notFound(`User with identifier '${userId}' not found`);
  }
  return toPublicUser(user);
}

export async function getAllUsers(): Promise<PublicUser[]> {
  return db.select(publicColumns).from(users).orderBy(users.id);
}
