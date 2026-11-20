import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests load the real extension (built with `npm run build:e2e`)
 * into Chromium. Run with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
