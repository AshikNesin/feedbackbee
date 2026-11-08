import { eq, lt, lte, gt, and, or, isNull, isNotNull, sql } from "drizzle-orm";
import { db, kv as kvTable } from "../database";

/**
 * Key-value storage on the `kv` table. Values are JSON; `ttlMs` sets an
 * expiry that is enforced on read and swept by the job tick.
 */
export interface KvStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
  /**
   * Insert only: write the entry when no live one holds `key` (an expired one
   * is replaced). Resolves false, writing nothing, when the key is taken. One
   * statement, so two concurrent adds cannot both win.
   */
  add<T = unknown>(key: string, value: T, ttlMs?: number): Promise<boolean>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  /**
   * Remove a live entry and return its value, in one statement: of any number
   * of concurrent `take`s of one key, exactly one gets the value. `undefined`
   * when the key is missing or expired. For single-use tokens and challenges.
   */
  take<T = unknown>(key: string): Promise<T | undefined>;
  /**
   * Claim `key` for `intervalMs`, in one compare-and-set upsert: true for at
   * most one caller per interval across every process and isolate, false
   * while an earlier claim is younger than `intervalMs`. The value is the
   * claim time (epoch ms), so `get(key)` reads the last claim.
   */
  claim(key: string, intervalMs: number): Promise<boolean>;
  /** Every live entry whose key starts with `prefix` (keys returned without the namespace). */
  list<T = unknown>(prefix?: string): Promise<Array<{ key: string; value: T }>>;
  /** Delete every entry whose key starts with `prefix`. Returns the count. */
  clear(prefix?: string): Promise<number>;
}

/**
 * Keys starting with `prefix`, case-sensitively. Not `LIKE`: SQLite's LIKE
 * ignores ASCII case, so `clear("user:")` would also delete `User:1`.
 */
function keyStartsWith(prefix: string) {
  return sql`substr(${kvTable.key}, 1, length(${prefix})) = ${prefix}`;
}

export function createKvStore(namespace = ""): KvStore {
  const full = (key: string) => `${namespace}${key}`;

  return {
    async get<T>(key: string): Promise<T | undefined> {
      const [row] = await db
        .select()
        .from(kvTable)
        .where(eq(kvTable.key, full(key)))
        .limit(1);
      if (!row) return undefined;
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
        await db.delete(kvTable).where(eq(kvTable.key, full(key)));
        return undefined;
      }
      return JSON.parse(row.value) as T;
    },

    async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
      const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;
      const encoded = JSON.stringify(value);
      await db
        .insert(kvTable)
        .values({ key: full(key), value: encoded, expiresAt })
        .onConflictDoUpdate({ target: kvTable.key, set: { value: encoded, expiresAt } });
    },

    async add<T>(key: string, value: T, ttlMs?: number): Promise<boolean> {
      const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;
      const encoded = JSON.stringify(value);
      const written = await db
        .insert(kvTable)
        .values({ key: full(key), value: encoded, expiresAt })
        .onConflictDoUpdate({
          target: kvTable.key,
          set: { value: encoded, expiresAt },
          setWhere: and(isNotNull(kvTable.expiresAt), lte(kvTable.expiresAt, new Date())),
        })
        .returning({ key: kvTable.key });
      return written.length > 0;
    },

    async has(key: string): Promise<boolean> {
      return (await this.get(key)) !== undefined;
    },

    async delete(key: string): Promise<boolean> {
      const deleted = await db
        .delete(kvTable)
        .where(eq(kvTable.key, full(key)))
        .returning();
      return deleted.length > 0;
    },

    async take<T>(key: string): Promise<T | undefined> {
      const [row] = await db
        .delete(kvTable)
        .where(
          and(
            eq(kvTable.key, full(key)),
            or(isNull(kvTable.expiresAt), gt(kvTable.expiresAt, new Date())),
          ),
        )
        .returning({ value: kvTable.value });
      return row ? (JSON.parse(row.value) as T) : undefined;
    },

    async claim(key: string, intervalMs: number): Promise<boolean> {
      const nowMs = Date.now();
      const value = JSON.stringify(nowMs);
      // The row expires when the claim does, so the sweep removes stale keys.
      const expiresAt = new Date(nowMs + intervalMs);
      const claimed = await db
        .insert(kvTable)
        .values({ key: full(key), value, expiresAt })
        .onConflictDoUpdate({
          target: kvTable.key,
          set: { value, expiresAt },
          setWhere: sql`CAST(${kvTable.value} AS INTEGER) <= ${nowMs - intervalMs}`,
        })
        .returning({ key: kvTable.key });
      return claimed.length > 0;
    },

    async list<T>(prefix = ""): Promise<Array<{ key: string; value: T }>> {
      const rows = await db
        .select()
        .from(kvTable)
        .where(keyStartsWith(full(prefix)));
      const now = Date.now();
      return rows
        .filter((row) => !row.expiresAt || row.expiresAt.getTime() > now)
        .map((row) => ({
          key: row.key.slice(namespace.length),
          value: JSON.parse(row.value) as T,
        }));
    },

    async clear(prefix = ""): Promise<number> {
      const deleted = await db
        .delete(kvTable)
        .where(keyStartsWith(full(prefix)))
        .returning();
      return deleted.length;
    },
  };
}

/** Default (un-namespaced) store. */
export const kv: KvStore = createKvStore();

/** A store whose keys are prefixed with `namespace:`. */
export const createNamespaceKv = (namespace: string): KvStore => createKvStore(`${namespace}:`);

/** Delete expired entries. Called from the job tick's housekeeping. */
export async function purgeExpiredKv(): Promise<number> {
  const deleted = await db
    .delete(kvTable)
    .where(and(isNotNull(kvTable.expiresAt), lt(kvTable.expiresAt, new Date())))
    .returning();
  return deleted.length;
}
