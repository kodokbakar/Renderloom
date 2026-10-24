import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Candidate Inspection & Preview Modal", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/");
    });

    test("opens preview modal on inspect overlay trigger and shows candidate details", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.hover();

      const inspectBtn = card1.locator(".btn-inspect-overlay");
      await expect(inspectBtn).toBeVisible();
      await inspectBtn.click();

      // Modal dialog is open
      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Geometric Monogram",
      );
      await expect(modal.locator(".status-badge")).toHaveText("Completed");
    });

    test("switches between Image Preview, JSX Source, and SVG Source tabs", async ({
      page,
    }) => {
      // Open modal for Candidate 1
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.locator(".btn-inspect-overlay").click();

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      const tabBar = modal.locator('.preview-tab-bar[role="tablist"]');
      const imageTab = tabBar.locator('button[role="tab"]').nth(0);
      const jsxTab = tabBar.locator('button[role="tab"]').nth(1);
      const svgTab = tabBar.locator('button[role="tab"]').nth(2);

      // Default is image tab
      await expect(imageTab).toHaveAttribute("aria-selected", "true");
      await expect(modal.locator(".image-preview-container")).toBeVisible();

      // Switch to JSX Source tab
      await jsxTab.click();
      await expect(jsxTab).toHaveAttribute("aria-selected", "true");
      await expect(imageTab).toHaveAttribute("aria-selected", "false");
      const sourceViewer = modal.locator(".source-viewer");
      await expect(sourceViewer).toBeVisible();
      await expect(sourceViewer).toContainText("RenderloomAtelierLogo");

      // Switch to SVG Source tab
      await svgTab.click();
      await expect(svgTab).toHaveAttribute("aria-selected", "true");
      await expect(sourceViewer).toContainText("<svg");

      // Switch back to Image tab
      await imageTab.click();
      await expect(imageTab).toHaveAttribute("aria-selected", "true");
      await expect(modal.locator(".image-preview-container")).toBeVisible();
    });

    test("navigates next and previous candidates using modal header buttons", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.locator(".btn-inspect-overlay").click();

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Geometric Monogram",
      );

      // Click Next Candidate button
      const nextBtn = modal.locator('button[aria-label="Next Candidate"]');
      await expect(nextBtn).toBeVisible();
      await nextBtn.click();

      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Architectural Emblem",
      );

      // Click Previous Candidate button
      const prevBtn = modal.locator('button[aria-label="Previous Candidate"]');
      await expect(prevBtn).toBeVisible();
      await prevBtn.click();

      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Geometric Monogram",
      );
    });

    test("closes preview modal using close button and Escape key", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.locator(".btn-inspect-overlay").click();

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();

      // Close with close button
      const closeBtn = modal.locator(".btn-modal-close");
      await closeBtn.click();
      await expect(modal).not.toBeVisible();

      // Re-open and close with Escape key
      await card1.locator(".btn-inspect-overlay").click();
      await expect(modal).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(modal).not.toBeVisible();
    });

    test("displays version history and allows viewing historical version", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.locator(".btn-inspect-overlay").click();

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      const versionList = modal.locator(".version-history-list");
      await expect(versionList).toBeVisible();

      const versionItems = versionList.locator(".version-item");
      await expect(versionItems).toHaveCount(2);

      // Click v1 (historical version item at index 1 since list is sorted desc by versionNumber)
      await versionItems.nth(1).click();

      // Historical view banner appears
      const banner = modal.locator(".historical-view-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText("Viewing historical version");
      await expect(banner.locator(".btn-restore-banner")).toBeVisible();
    });

    test("navigates candidates inside preview modal via keyboard arrows with boundary enforcement", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.locator(".btn-inspect-overlay").click();

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Geometric Monogram",
      );

      // At first candidate (index 0), Previous Candidate button is not present
      await expect(
        modal.locator('button[aria-label="Previous Candidate"]'),
      ).toHaveCount(0);

      // Pressing ArrowLeft at boundary does nothing
      await page.keyboard.press("ArrowLeft");
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Geometric Monogram",
      );

      // Navigate right through candidates
      await page.keyboard.press("ArrowRight");
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Architectural Emblem",
      );

      await page.keyboard.press("ArrowRight");
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Abstract Wireframe",
      );

      await page.keyboard.press("ArrowRight");
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Precision Lattice",
      );

      // At last candidate, Next Candidate button is not present
      await expect(
        modal.locator('button[aria-label="Next Candidate"]'),
      ).toHaveCount(0);

      // Pressing ArrowRight at end boundary does nothing
      await page.keyboard.press("ArrowRight");
      await expect(modal.locator(".preview-candidate-title")).toHaveText(
        "Precision Lattice",
      );
    });

    test("dismisses preview modal on backdrop click outside dialog", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await card1.locator(".btn-inspect-overlay").click();

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();

      // Click top-left edge of backdrop outside the modal dialog
      const backdrop = page.locator(".preview-modal-backdrop");
      await backdrop.click({ position: { x: 5, y: 5 } });

      await expect(modal).not.toBeVisible();
    });
  });
}
