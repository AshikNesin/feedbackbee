import { newToken } from "./crypto.ts";

// APP_SECRET encrypts GitHub PATs at rest. When the env var is absent (deploy-button
// installs, quick local runs), a random secret is generated once and persisted in D1
// so ciphertexts stay decryptable across restarts. The env var always wins.
export async function getAppSecret(db: D1Database, envSecret?: string): Promise<string> {
  if (envSecret && envSecret.length >= 16) return envSecret;
  const row = await db
    .prepare("SELECT value FROM app_secret WHERE key = 'app'")
    .first<{ value: string }>();
  if (row) return row.value;
  const fresh = newToken();
  await db
    .prepare("INSERT OR IGNORE INTO app_secret (key, value) VALUES ('app', ?)")
    .bind(fresh)
    .run();
  const reread = await db
    .prepare("SELECT value FROM app_secret WHERE key = 'app'")
    .first<{ value: string }>();
  return reread?.value ?? fresh;
}
