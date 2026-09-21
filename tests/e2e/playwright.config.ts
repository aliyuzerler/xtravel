import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright konfigürasyonu.
 *
 * Çalıştırma:
 *   cd tests/e2e && npx playwright test
 *   cd tests/e2e && npx playwright test --headed
 *   cd tests/e2e && PWDEBUG=1 npx playwright test
 *
 * CI'da:
 *   API + Web ayakta olmalı (webServer config)
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // E2E — sıralı çalıştır (DB state paylaşımı)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // E2E tek worker — race condition önlemek
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ...(process.env.CI ? [['github' as any]] : []),
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.WEB_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      'Accept-Language': 'tr-TR,tr;q=0.9',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobil testleri
    // { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    // { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.CI
    ? {
        command: 'cd ../../apps/web && npm run build && npm start',
        port: 3001,
        timeout: 120_000,
        reuseExistingServer: false,
      }
    : undefined,
});
