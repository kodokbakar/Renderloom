import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("New Session Creation Flow", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/#/dashboard");
    });

    test("opens new session modal, fills form, and launches studio session", async ({
      page,
    }) => {
      // Click New Session
      const newSessionBtn = page.locator('[data-testid="new-session-btn"]');
      await newSessionBtn.click();

      // Modal is visible
      const modal = page.locator('[data-testid="new-session-modal"]');
      await expect(modal).toBeVisible();

      // Fill Name
      const nameInput = page.locator('[data-testid="new-session-name-input"]');
      await nameInput.fill("Geometric Architecture Poster");

      // Select Aspect Ratio 16:9
      const ratioBtn169 = page.locator('[data-testid="ratio-btn-16:9"]');
      await ratioBtn169.click();
      await expect(ratioBtn169).toHaveClass(/active/);

      // Enter Initial Prompt
      const promptInput = page.locator(
        '[data-testid="new-session-prompt-input"]',
      );
      await promptInput.fill("Vector illustration of brutalist pavilion");

      // Submit
      const submitBtn = page.locator('[data-testid="create-session-submit"]');
      await submitBtn.click();

      // Modal closes and studio opens
      await expect(modal).not.toBeVisible();
      await expect(page.locator(".workspace-brand")).toBeVisible();
      await expect(page.locator(".session-name")).toHaveText(
        "Geometric Architecture Poster",
      );
    });
  });
}
