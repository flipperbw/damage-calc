import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Short timeouts on purpose — UI flows here are all sub-second. A bad
  // selector should fail fast, not soak 30 s. Tuned to leave headroom for
  // WebKit (slower than chromium under parallel load) without enabling
  // 30 s soaks for genuine bugs.
  timeout: 12_000,
  expect: { timeout: 3500 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    actionTimeout: 5000,
    navigationTimeout: 8000,
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'mobile-webkit',
      // iPhone 13 viewport on actual WebKit — matches iOS Safari/Brave on
      // a real device, not chromium pretending to be mobile.
      use: { ...devices['iPhone 13'] },
    },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
