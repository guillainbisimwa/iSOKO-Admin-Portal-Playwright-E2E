import path from 'path';
import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://isoko-admin-portal.vercel.app';

const storageState = path.resolve(__dirname, 'reports', '.auth', 'state.json');

export default defineConfig({
  testDir: './tests',
  // Live, stateful suite. Two workers keeps the whole run well inside the OAuth token lifetime;
  // temp-entity names are shared across workers via the E2E_STAMP env var (see specs), so
  // create -> edit -> deactivate chains stay consistent regardless of worker assignment.
  fullyParallel: false,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // channel: 'chrome', // Uncomment if Chromium downloads fail and Google Chrome is installed locally.
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState },
      dependencies: ['setup'],
      // login.spec.ts overrides storageState with an empty one to exercise the real sign-in flow.
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
