import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  outputDir: "./node_modules/.cache/playwright-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"], viewport: { width: 393, height: 851 } },
    },
  ],
  webServer: [
    {
      command: "bun run src/server/index.ts",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: "bun x vite --port 5173",
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
});
