import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";

/** The app's database on Workers: Drizzle over the request's D1 binding. */
export function openD1(binding: D1Database) {
  return drizzle(binding);
}
