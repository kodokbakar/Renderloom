import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Candidate Gallery & Card Interaction", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/");
    });

    test("renders all candidate cards in architectural exhibition grid", async ({
      page,
    }) => {
      const gallery = page.locator(".candidate-gallery");
      await expect(gallery).toBeVisible();

      const cards = gallery.locator(".candidate-card");
      await expect(cards).toHaveCount(4);

      // Candidate 1 checks
      const card1 = cards.nth(0);
      await expect(card1).toHaveAttribute("data-candidate-id", "cand-1");
      await expect(card1.locator(".candidate-name")).toHaveText(
        "Geometric Monogram",
      );
      await expect(card1.locator(".candidate-duration")).toHaveText("1.9s");
      await expect(card1.locator(".status-badge")).toHaveText("Completed");

      // Candidate 2 checks
      const card2 = cards.nth(1);
      await expect(card2).toHaveAttribute("data-candidate-id", "cand-2");
      await expect(card2.locator(".candidate-name")).toHaveText(
        "Architectural Emblem",
      );
      await expect(card2.locator(".candidate-duration")).toHaveText("2.1s");

      // Candidate 3 (failed) checks
      const card3 = cards.nth(2);
      await expect(card3).toHaveAttribute("data-candidate-id", "cand-3");
      await expect(card3.locator(".candidate-name")).toHaveText(
        "Abstract Wireframe",
      );
      await expect(card3.locator(".status-badge")).toHaveText("Failed");

      // Candidate 4 (generating) checks
      const card4 = cards.nth(3);
      await expect(card4).toHaveAttribute("data-candidate-id", "cand-4");
      await expect(card4.locator(".status-badge")).toHaveText("Generating");
    });

    test("selects candidate card with mouse click and reflects aria-pressed state", async ({
      page,
    }) => {
      const card2 = page.locator('.candidate-card[data-candidate-id="cand-2"]');
      await expect(card2).toBeVisible();

      // Click card to select
      await card2.click();
      await expect(card2).toHaveClass(/selected/);
      await expect(card2).toHaveAttribute("aria-pressed", "true");

      // Candidate 1 is no longer selected
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      await expect(card1).not.toHaveClass(/selected/);
      await expect(card1).toHaveAttribute("aria-pressed", "false");
    });

    test("navigates candidate selection via keyboard arrow keys", async ({
      page,
    }) => {
      const card1 = page.locator('.candidate-card[data-candidate-id="cand-1"]');
      const card2 = page.locator('.candidate-card[data-candidate-id="cand-2"]');

      // Focus card 1
      await card1.focus();
      await expect(card1).toHaveClass(/selected/);

      // Press ArrowRight to navigate to card 2
      await page.keyboard.press("ArrowRight");
      await expect(card2).toHaveClass(/selected/);
      await expect(card2).toHaveAttribute("aria-pressed", "true");

      // Press ArrowLeft to return to card 1
      await page.keyboard.press("ArrowLeft");
      await expect(card1).toHaveClass(/selected/);
      await expect(card1).toHaveAttribute("aria-pressed", "true");
    });
  });
}
