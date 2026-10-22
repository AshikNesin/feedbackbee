// Applies D1 migrations to the isolated test database before any test runs.
import { applyD1Migrations, env, type D1Migration } from "cloudflare:test";

const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;
await applyD1Migrations(env.DB, migrations);
