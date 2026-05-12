import { test, expect } from '@playwright/test';
import { adminCredentials, loginInstanceAdminViaOAuth } from './auth-flow';

test.describe('Instance admin dashboard (@live)', { tag: '@live' }, () => {
  test.beforeEach(() => {
    test.skip(
      !adminCredentials(),
      'Set ADMIN_SIGNIN_EMAIL and ADMIN_SIGNIN_PASSWORD (or ISOKO_EMAIL / ISOKO_PASSWORD)',
    );
  });

  test('logs in as instance admin and views association dashboard metrics', async ({ page }) => {
    const creds = adminCredentials()!;
    await loginInstanceAdminViaOAuth(page, creds);

    await expect(page.getByRole('heading', { level: 1, name: /Associations/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Manage and view all registered associations')).toBeVisible();

    await expect(page.getByText('Total Associations')).toBeVisible();
    await expect(page.getByText('Registered associations', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Associations')).toBeVisible();
    await expect(page.getByText('Currently active')).toBeVisible();
    await expect(page.getByText('Pending Approval')).toBeVisible();
    await expect(page.getByText('Awaiting review')).toBeVisible();

    await expect(page.getByRole('heading', { name: /Associations Management/i })).toBeVisible();
  });
});
