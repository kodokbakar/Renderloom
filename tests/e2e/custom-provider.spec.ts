import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Custom LLM Provider Flow", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/#/dashboard");
    });

    test("configures custom provider without API key, creates session with custom model, and initiates generation", async ({
      page,
    }) => {
      // 1. Open API key modal
      const openBtn = page.locator('[data-testid="open-api-keys-btn"]');
      await openBtn.click();

      const modal = page.locator('[data-testid="api-key-modal"]');
      await expect(modal).toBeVisible();

      // 2. Custom provider card
      const customCard = page.locator('[data-testid="provider-card-custom"]');
      await expect(customCard).toBeVisible();
      await expect(customCard.locator(".provider-name")).toHaveText(
        "Custom (OpenAI-Compatible)",
      );

      // 3. Fill Custom Base URL without entering API key
      const baseUrlInput = page.locator('[data-testid="baseurl-input-custom"]');
      await baseUrlInput.fill("http://localhost:11434/v1");

      // 4. Test connection
      const testBtn = page.locator('[data-testid="test-btn-custom"]');
      await testBtn.click();

      const testResult = page.locator('[data-testid="test-result-custom"]');
      await expect(testResult).toBeVisible();
      await expect(testResult).toContainText("Connection verified (42ms)");

      // 5. Save configuration
      const saveBtn = page.locator('[data-testid="save-btn-custom"]');
      await expect(saveBtn).toBeEnabled();
      await saveBtn.click();

      const banner = page.locator(".modal-alert-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("Saved configuration for Custom");

      // 6. Close modal
      const doneBtn = page.locator('[data-testid="api-key-modal-done"]');
      await doneBtn.click();
      await expect(modal).not.toBeVisible();

      // 7. Open New Session Modal
      const newSessionBtn = page.locator('[data-testid="new-session-btn"]');
      await newSessionBtn.click();

      const sessionModal = page.locator('[data-testid="new-session-modal"]');
      await expect(sessionModal).toBeVisible();

      // 8. Fill Session Name
      const nameInput = page.locator('[data-testid="new-session-name-input"]');
      await nameInput.fill("Local Ollama Poster");

      // 9. Select Custom Provider
      const providerSelect = page.locator(
        '[data-testid="new-session-provider-select"]',
      );
      await providerSelect.selectOption("custom");

      // 10. Type custom model ID
      const customModelInput = page.locator(
        '[data-testid="new-session-custom-model-input"]',
      );
      await expect(customModelInput).toBeVisible();
      await customModelInput.fill("qwen2.5-coder:14b");

      // 11. Launch session
      const submitBtn = page.locator('[data-testid="create-session-submit"]');
      await submitBtn.click();

      // 12. Studio workspace loaded
      await expect(sessionModal).not.toBeVisible();
      await expect(page.locator(".workspace-brand")).toBeVisible();

      // 13. Studio controls display custom model input
      const studioModelInput = page.locator(
        '[data-testid="studio-custom-model-input"]',
      );
      await expect(studioModelInput).toBeVisible();
      await expect(studioModelInput).toHaveValue("qwen2.5-coder:14b");

      // 14. Trigger generation
      const promptInput = page.locator('[data-testid="studio-prompt-input"]');
      await promptInput.fill("Abstract vector wave in neon amber");

      const generateBtn = page.locator('[data-testid="generate-btn"]');
      await generateBtn.click();

      await expect(generateBtn).toBeDisabled();
    });
  });
}
