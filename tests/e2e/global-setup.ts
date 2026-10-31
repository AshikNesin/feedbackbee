import { seed } from "../../scripts/seed";

/**
 * Make sure the e2e login user exists. Same throwaway database as the
 * webServer in playwright.config.ts (`data/e2e.db` unless overridden), so
 * the user is visible to the server under test.
 */
async function globalSetup() {
  process.env.DATABASE_URL ??= "file:./data/e2e.db";
  await seed();
  console.log("E2E seed: test user ready");
}

export default globalSetup;
