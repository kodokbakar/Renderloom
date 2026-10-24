import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Responsive Viewports", () => {
    test("renders desktop layout with multi-column candidate gallery and side-by-side inspection", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await setupMockRoutes(page);
      await page.goto("/");

      const grid = page.locator(".candidate-gallery-grid");
      await expect(grid).toBeVisible();

      // In desktop, grid items are rendered across multiple columns
      const firstCardBox = await page
        .locator('.candidate-card[data-candidate-id="cand-1"]')
        .boundingBox();
      const secondCardBox = await page
        .locator('.candidate-card[data-candidate-id="cand-2"]')
        .boundingBox();

      expect(firstCardBox).not.toBeNull();
      expect(secondCardBox).not.toBeNull();
      if (firstCardBox && secondCardBox) {
        // Different x position means cards sit side-by-side
        expect(secondCardBox.x).toBeGreaterThan(firstCardBox.x);
      }

      // Open preview modal
      await page.locator('.candidate-card[data-candidate-id="cand-1"]').click();
      await page.keyboard.press("Enter");

      const modalBody = page.locator(".preview-modal-body");
      await expect(modalBody).toBeVisible();
      const modalBox = await modalBody.boundingBox();
      const mainContentBox = await page
        .locator(".preview-main-content")
        .boundingBox();
      const sidebarBox = await page.locator(".preview-sidebar").boundingBox();

      expect(modalBox).not.toBeNull();
      expect(mainContentBox).not.toBeNull();
      expect(sidebarBox).not.toBeNull();

      if (mainContentBox && sidebarBox) {
        // Desktop sidebar sits to the right of main content
        expect(sidebarBox.x).toBeGreaterThan(mainContentBox.x);
      }
    });

    test("renders mobile layout with stacked single-column exhibition and responsive modal", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await setupMockRoutes(page);
      await page.goto("/");

      const grid = page.locator(".candidate-gallery-grid");
      await expect(grid).toBeVisible();

      const firstCardBox = await page
        .locator('.candidate-card[data-candidate-id="cand-1"]')
        .boundingBox();
      const secondCardBox = await page
        .locator('.candidate-card[data-candidate-id="cand-2"]')
        .boundingBox();

      expect(firstCardBox).not.toBeNull();
      expect(secondCardBox).not.toBeNull();
      if (firstCardBox && secondCardBox) {
        // Mobile cards stack vertically: same or nearly same x, card 2 is below card 1
        expect(Math.abs(secondCardBox.x - firstCardBox.x)).toBeLessThan(5);
        expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y);
      }

      // Open preview modal on mobile
      await page.locator('.candidate-card[data-candidate-id="cand-1"]').click();
      await page.keyboard.press("Enter");

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();

      const mainContentBox = await page
        .locator(".preview-main-content")
        .boundingBox();
      const sidebarBox = await page.locator(".preview-sidebar").boundingBox();

      expect(mainContentBox).not.toBeNull();
      expect(sidebarBox).not.toBeNull();

      if (mainContentBox && sidebarBox) {
        // Mobile layout stacks sidebar vertically below or at same x
        expect(Math.abs(sidebarBox.x - mainContentBox.x)).toBeLessThan(15);
      }
    });

    test("handles preview modal layout, tab navigation, and dismissal on mobile viewport", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await setupMockRoutes(page);
      await page.goto("/");

      // Open preview modal
      await page.locator('.candidate-card[data-candidate-id="cand-1"]').click();
      await page.keyboard.press("Enter");

      const modal = page.locator('.preview-modal-dialog[role="dialog"]');
      await expect(modal).toBeVisible();

      // Modal dialog width fits within mobile viewport
      const modalBox = await modal.boundingBox();
      expect(modalBox).not.toBeNull();
      if (modalBox) {
        expect(modalBox.width).toBeLessThanOrEqual(375);
      }

      // Switch to JSX tab in mobile modal
      const tabBar = modal.locator('.preview-tab-bar[role="tablist"]');
      const jsxTab = tabBar.locator('button[role="tab"]').nth(1);
      await jsxTab.click();
      await expect(jsxTab).toHaveAttribute("aria-selected", "true");

      const sourceViewer = modal.locator(".source-viewer");
      await expect(sourceViewer).toBeVisible();

      // Close modal on mobile via close button
      const closeBtn = modal.locator(".btn-modal-close");
      await closeBtn.click();
      await expect(modal).not.toBeVisible();
    });
  });
}
