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
  });
}
