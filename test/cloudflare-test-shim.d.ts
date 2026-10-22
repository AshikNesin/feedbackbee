declare module "cloudflare:test" {
  export const SELF: Fetcher;
  export const env: { DB: D1Database; MEDIA: R2Bucket; GITHUB_TOKEN: string; TEST_MIGRATIONS: D1Migration[] };
  export type D1Migration = { name: string; sql: string };
  export function applyD1Migrations(db: D1Database, migrations: D1Migration[]): Promise<void>;
}
