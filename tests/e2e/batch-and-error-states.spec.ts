import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Batch Progress, Error Handling, and Empty States", () => {
    test("displays batch progress indicator with telemetry and cancel button", async ({
      page,
    }) => {
      await setupMockRoutes(page);
      await page.goto("/#/studio");

      const indicator = page.locator(".batch-progress-indicator");
      await expect(indicator).toBeVisible();

      // Check progress status text
      await expect(indicator.locator(".batch-status-text")).toContainText(
        "Generating Batch",
      );

      // Check progress percentage
      await expect(indicator.locator(".batch-percent")).toBeVisible();

      // Cancel batch button is present
      const cancelBtn = indicator.locator(".btn-cancel-batch");
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();
    });

    test("displays sanitized failure details and retry trigger on failed candidate card", async ({
      page,
    }) => {
      await setupMockRoutes(page);
      await page.goto("/#/studio");

      const failedCard = page.locator(
        '.candidate-card[data-candidate-id="cand-3"]',
      );
      await expect(failedCard).toBeVisible();

      // Sanitized snippet
      const snippet = failedCard.locator(".failure-snippet");
      await expect(snippet).toBeVisible();
      await expect(snippet).toContainText("AST validation failed");

      // Retry action button on card
      const retryBtn = failedCard.locator(".btn-card-retry");
      await expect(retryBtn).toBeVisible();
      await retryBtn.click();
    });

    test("displays diagnostic error card in modal when inspecting failed candidate", async ({
      page,
    }) => {
      await setupMockRoutes(page);
      await page.goto("/#/studio");

      const failedCard = page.locator(
        '.candidate-card[data-candidate-id="cand-3"]',
      );
      // Select and inspect failed card
      await failedCard.click();
      await page.keyboard.press("Enter");

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();

      const errorCard = modal.locator('.error-card[role="alert"]');
      await expect(errorCard).toBeVisible();
      await expect(errorCard.locator(".error-code-badge")).toHaveText(
        "AST_VALIDATION_ERROR",
      );
      await expect(errorCard.locator(".error-message-text")).toContainText(
        "Invalid JSX element",
      );

      const modalRetryBtn = errorCard.locator(".btn-retry-action");
      await expect(modalRetryBtn).toBeVisible();
    });

    test("renders empty state slate when session contains no candidates", async ({
      page,
    }) => {
      await setupMockRoutes(page, { emptySession: true });
      await page.goto("/#/studio");

      const emptyState = page.locator(
        '.empty-state[data-empty-type="new-session"]',
      );
      await expect(emptyState).toBeVisible();
      await expect(emptyState.locator(".empty-state-title")).toHaveText(
        "No candidates yet",
      );
      await expect(emptyState.locator(".empty-state-message")).toContainText(
        "Start a new generation",
      );
    });
  });
}
