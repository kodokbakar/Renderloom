import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Studio Workspace & Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/#/studio");
    });

    test("renders studio branding and logotype with craft badges", async ({
      page,
    }) => {
      const brandHeader = page.locator(".workspace-brand");
      await expect(brandHeader).toBeVisible();

      // Brand title and studio badge
      await expect(brandHeader.locator(".brand-title")).toHaveText(
        "Renderloom",
      );
      await expect(brandHeader.locator(".brand-badge")).toHaveText("STUDIO");
      await expect(brandHeader.locator(".brand-tagline")).toHaveText(
        "Review Workspace",
      );
    });

    test("displays active session title and monospace slug badge", async ({
      page,
    }) => {
      const sessionInfo = page.locator(".workspace-session-info");
      await expect(sessionInfo).toBeVisible();

      const sessionName = sessionInfo.locator(".session-name");
      await expect(sessionName).toHaveText("Studio Brand Identity");

      const slugBadge = sessionInfo.locator(".session-slug-badge");
      await expect(slugBadge).toHaveText("studio-brand-identity");
    });

    test("toggles session prompt drawer visibility with animated transition", async ({
      page,
    }) => {
      const promptBtn = page.locator(".btn-toggle-prompt");
      await expect(promptBtn).toBeVisible();
      await expect(promptBtn).toHaveText("View Prompt");
      await expect(page.locator("#workspace-prompt-drawer")).not.toBeVisible();

      // Click to open prompt drawer
      await promptBtn.click();
      await expect(promptBtn).toHaveText("Hide Prompt");
      await expect(promptBtn).toHaveClass(/active/);

      const drawer = page.locator("#workspace-prompt-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer.locator(".prompt-drawer-content")).toContainText(
        "High precision geometric atelier logo with luminous amber accents.",
      );

      // Click again to collapse
      await promptBtn.click();
      await expect(promptBtn).toHaveText("View Prompt");
      await expect(page.locator("#workspace-prompt-drawer")).not.toBeVisible();
    });

    test("switches active session using session dropdown", async ({ page }) => {
      const sessionSelect = page.locator("#session-select");
      await expect(sessionSelect).toBeVisible();
      await expect(sessionSelect).toHaveValue("studio-brand-identity");

      // Switch to second session
      await sessionSelect.selectOption("minimal-geometric-icons");
      await expect(page.locator(".session-name")).toHaveText(
        "Minimal Geometric Icons",
      );
      await expect(page.locator(".session-slug-badge")).toHaveText(
        "minimal-geometric-icons",
      );
    });

    test("renders parameters in studio controls", async ({ page }) => {
      const controls = page.locator(".studio-controls");
      await expect(controls).toBeVisible();

      await expect(
        controls.locator('[data-testid="studio-provider-select"]'),
      ).toHaveValue("anthropic");
      await expect(
        controls.locator('[data-testid="studio-model-select"]'),
      ).toHaveValue("claude-3-5-sonnet");
      await expect(
        controls.locator('[data-testid="studio-style-select"]'),
      ).toHaveValue("tech-minimal");
      await expect(
        controls.locator('[data-testid="studio-ratio-1:1"]'),
      ).toHaveClass(/active/);
      await expect(
        controls.locator('[data-testid="candidate-count-4"]'),
      ).toHaveClass(/active/);
    });
  });
}
