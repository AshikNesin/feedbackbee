import { test, expect } from "@playwright/test";

test.describe("App settings (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("demo@example.com");
    await page.getByLabel(/password/i).fill("demo@example.com");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page.waitForURL(/\/(todos|dashboard)/);
  });

  test("create, edit, and persist a setting through the full round trip", async ({ page }) => {
    await page.goto("/settings");
    const key = `e2e.setting.${Date.now()}`;

    // Create — the editor should open with the new setting auto-selected
    await page.getByRole("button", { name: /add setting/i }).click();
    await page.getByPlaceholder(/featureflags/i).fill(key);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByRole("heading", { name: key })).toBeVisible();

    // Edit the description and the JSON value, then save
    await page.getByLabel("Description").fill("created by e2e test");
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type('{"enabled": true}');
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/updated successfully/i)).toBeVisible();

    // Persistence: a full reload forces a fresh fetch from the server
    await page.reload();
    await page.getByRole("button", { name: key }).click();
    await expect(page.getByLabel("Description")).toHaveValue("created by e2e test");
    await expect(page.locator(".cm-content")).toContainText('"enabled": true');

    // Delete via the confirm dialog — the list should drop the entry
    await page.getByRole("button", { name: /^delete$/i }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(/no setting selected/i)).toBeVisible();
    await expect(page.getByRole("button", { name: key })).not.toBeVisible();
  });
});
