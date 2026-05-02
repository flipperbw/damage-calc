import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'mobile-iphone-13',
      // iPhone 13 device defaults to webkit; force chromium since we only
      // install chromium browsers locally.
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
