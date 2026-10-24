import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Studio Generation Controls & Flow", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page, { idleSession: true });
      await page.goto("/#/studio");
    });

    test("adjusts generation parameters and triggers batch generation", async ({
      page,
    }) => {
      const controls = page.locator(".studio-controls");
      await expect(controls).toBeVisible();

      // Style selector and swatches
      const styleSelect = page.locator('[data-testid="studio-style-select"]');
      await expect(styleSelect).toBeVisible();
      await expect(
        page.locator('[data-testid="style-swatches"]'),
      ).toBeVisible();

      // Aspect ratio
      const ratioBtn = page.locator('[data-testid="studio-ratio-16:9"]');
      await ratioBtn.click();
      await expect(ratioBtn).toHaveClass(/active/);

      // Candidate count
      const countBtn = page.locator('[data-testid="candidate-count-3"]');
      await countBtn.click();
      await expect(countBtn).toHaveClass(/active/);

      // Prompt textarea
      const promptInput = page.locator('[data-testid="studio-prompt-input"]');
      await promptInput.fill(
        "Luminous isometric vector rendering of studio hardware telemetry",
      );

      // Verify char counter updated
      const charCounter = page.locator('[data-testid="prompt-char-count"]');
      await expect(charCounter).toContainText("64 / 4000");

      // Click Generate
      const generateBtn = page.locator('[data-testid="generate-btn"]');
      await expect(generateBtn).toBeEnabled();
      await generateBtn.click();

      // Batch Progress Indicator is visible
      const progressIndicator = page.locator(".batch-progress-indicator");
      await expect(progressIndicator).toBeVisible();
    });
  });
}
