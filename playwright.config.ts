import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests do v2 — opt-in.
 *
 * Para rodar:
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 *   npm run dev   (em outro terminal)
 *   npx playwright test
 */

export default defineConfig({
  testDir: './tests/smoke',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: 0,
  workers: 4,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-iphone', use: { ...devices['iPhone 13'] } },
  ],
})
