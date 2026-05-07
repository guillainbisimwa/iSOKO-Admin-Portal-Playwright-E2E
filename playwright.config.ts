import path from 'path';
import dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://isoko-admin-portal.vercel.app';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // channel: 'chrome', // Uncomment if Chromium downloads fail and Google Chrome is installed locally.
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
