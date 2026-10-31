import { test, expect } from "@playwright/test";

test.describe("Logout (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("demo@example.com");
    await page.getByLabel(/password/i).fill("demo@example.com");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL(/\/(todos|dashboard)/);
  });

  async function openUserMenu(page: import("@playwright/test").Page) {
    // Sidebar footer trigger: avatar initial + user name + ellipsis icon
    await page
      .getByRole("button", { name: /demo user/i })
      .last()
      .click();
  }

  test("can log out from the user menu", async ({ page }) => {
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: /log out/i }).click();

    await expect(page).toHaveURL(/.*login.*/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("protected pages redirect to login after logout", async ({ page }) => {
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: /log out/i }).click();
    await expect(page).toHaveURL(/.*login.*/);

    // Session is gone — navigating to a protected page bounces back to /login
    await page.goto("/todos");
    await expect(page).toHaveURL(/.*login.*/);
  });
});
