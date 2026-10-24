import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("API Key Management Modal", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/#/dashboard");
    });

    test("opens API key modal, tests connection, and saves key", async ({
      page,
    }) => {
      // Open modal
      const openBtn = page.locator('[data-testid="open-api-keys-btn"]');
      await openBtn.click();

      const modal = page.locator('[data-testid="api-key-modal"]');
      await expect(modal).toBeVisible();

      // Provider cards
      const anthropicCard = page.locator(
        '[data-testid="provider-card-anthropic"]',
      );
      await expect(anthropicCard).toBeVisible();
      await expect(anthropicCard.locator(".provider-name")).toHaveText(
        "Anthropic",
      );

      // Enter API key
      const keyInput = page.locator('[data-testid="key-input-anthropic"]');
      await keyInput.fill("sk-ant-api03-testkey12345678901234");

      // Test connection
      const testBtn = page.locator('[data-testid="test-btn-anthropic"]');
      await testBtn.click();

      const testResult = page.locator('[data-testid="test-result-anthropic"]');
      await expect(testResult).toBeVisible();
      await expect(testResult).toContainText("Connection verified (42ms)");

      // Save key
      const saveBtn = page.locator('[data-testid="save-btn-anthropic"]');
      await saveBtn.click();

      // Feedback banner
      const banner = page.locator(".modal-alert-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("Saved API key for Anthropic");

      // Close modal
      const doneBtn = page.locator('[data-testid="api-key-modal-done"]');
      await doneBtn.click();
      await expect(modal).not.toBeVisible();
    });
  });
}
