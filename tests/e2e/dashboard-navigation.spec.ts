import { expect, test } from "@playwright/test";
import { setupMockRoutes } from "./fixtures";

if (process.env.PLAYWRIGHT_TEST) {
  test.describe("Workspace Dashboard & Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await setupMockRoutes(page);
      await page.goto("/#/dashboard");
    });

    test("renders workspace dashboard branding and metrics", async ({
      page,
    }) => {
      const brand = page.locator(".dashboard-brand");
      await expect(brand).toBeVisible();
      await expect(brand.locator(".brand-title")).toHaveText("Renderloom");
      await expect(brand.locator(".brand-tagline")).toHaveText(
        "Workspace Dashboard",
      );

      // Metrics cards
      const sessionsMetric = page.locator(
        '[data-testid="metric-total-sessions"]',
      );
      await expect(sessionsMetric).toBeVisible();
      await expect(sessionsMetric.locator(".metric-value")).toHaveText("2");

      const candidatesMetric = page.locator(
        '[data-testid="metric-total-candidates"]',
      );
      await expect(candidatesMetric).toBeVisible();

      // Action buttons
      await expect(
        page.locator('[data-testid="new-session-btn"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="open-api-keys-btn"]'),
      ).toBeVisible();
    });

    test("lists session cards with metadata and filters by search query", async ({
      page,
    }) => {
      const cards = page.locator('[data-testid="session-card"]');
      await expect(cards).toHaveCount(2);

      // Search for specific session
      const searchInput = page.locator('[data-testid="session-search-input"]');
      await searchInput.fill("minimal");

      await expect(cards).toHaveCount(1);
      await expect(cards.first().locator(".session-card-title")).toHaveText(
        "Minimal Geometric Icons",
      );

      // Clear search
      await searchInput.fill("");
      await expect(cards).toHaveCount(2);
    });

    test("displays empty state when search query matches no sessions", async ({
      page,
    }) => {
      const searchInput = page.locator('[data-testid="session-search-input"]');
      await searchInput.fill("nonexistent-search-term-12345");

      const emptyState = page.locator('[data-testid="dashboard-empty-state"]');
      await expect(emptyState).toBeVisible();
      await expect(emptyState.locator(".empty-title")).toHaveText(
        "No matching sessions",
      );
      await expect(emptyState.locator(".empty-desc")).toContainText(
        'No sessions found matching "nonexistent-search-term-12345".',
      );

      // Cards should not be rendered
      await expect(page.locator('[data-testid="session-card"]')).toHaveCount(0);

      // Clearing search restores sessions
      await searchInput.fill("");
      await expect(page.locator('[data-testid="session-card"]')).toHaveCount(2);
    });

    test("filters sessions by style preset dropdown", async ({ page }) => {
      const styleSelect = page.locator('[data-testid="style-filter-select"]');
      await styleSelect.selectOption("tech-minimal");

      const cards = page.locator('[data-testid="session-card"]');
      await expect(cards).toHaveCount(1);
      await expect(cards.first().locator(".session-card-title")).toHaveText(
        "Studio Brand Identity",
      );
    });

    test("navigates into Studio view from card and back to dashboard", async ({
      page,
    }) => {
      const openBtn = page
        .locator(
          '[data-testid="session-card"][data-session-id="studio-brand-identity"]',
        )
        .locator('[data-testid="open-studio-btn"]');
      await openBtn.click();

      // Assert transition to Studio view
      await expect(page.locator(".workspace-brand")).toBeVisible();
      await expect(page.locator(".session-name")).toHaveText(
        "Studio Brand Identity",
      );
      await expect(page.locator(".studio-controls")).toBeVisible();

      // Click Back to Dashboard
      const backBtn = page.locator('[data-testid="nav-dashboard-btn"]');
      await expect(backBtn).toBeVisible();
      await backBtn.click();

      // Assert return to Dashboard
      await expect(page.locator(".dashboard-brand")).toBeVisible();
      await expect(page.locator('[data-testid="session-grid"]')).toBeVisible();
    });
  });
}
