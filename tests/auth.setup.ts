import { test as setup } from '@playwright/test';
import path from 'path';
import { adminCredentials, loginInstanceAdminViaOAuth } from './auth-flow';

export const STORAGE_STATE = path.resolve(__dirname, '..', 'reports', '.auth', 'state.json');

setup('authenticate', async ({ page }) => {
  const creds = adminCredentials();
  setup.skip(!creds, 'Set ADMIN_SIGNIN_EMAIL / ADMIN_SIGNIN_PASSWORD (or ISOKO_*) in .env');

  await loginInstanceAdminViaOAuth(page, creds!);
  await page.context().storageState({ path: STORAGE_STATE });
});
