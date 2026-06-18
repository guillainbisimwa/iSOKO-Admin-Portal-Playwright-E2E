import { test, expect } from '@playwright/test';
import {
  ADMIN_BASE_URL,
  adminCredentials,
  clickContinueWithAdminOAuth,
  fillOAuthPasswordForm,
  oauthOrigin,
  regexEscape,
  waitForOAuthAuthorize,
  waitForInstanceAdminAssociationDashboard,
} from './auth-flow';

/**
 * LOG IN section (test-cases.xlsx). These run logged-out, so they override the shared
 * authenticated storage state with a clean one.
 */
test.describe('LOG IN @live', { tag: '@live' }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(() => {
    test.skip(!adminCredentials(), 'Set ADMIN_SIGNIN_EMAIL / ADMIN_SIGNIN_PASSWORD in .env');
  });

  test('IA-FM01-F01-TC01 Successful Login by Active Instance Admin', async ({ page }) => {
    const creds = adminCredentials()!;
    await page.goto('/signin');
    await expect(page).toHaveTitle(/Sign In/i);
    await clickContinueWithAdminOAuth(page);
    await waitForOAuthAuthorize(page);
    await fillOAuthPasswordForm(page, creds.email, creds.password);
    await waitForInstanceAdminAssociationDashboard(page);

    await expect(page.getByRole('heading', { level: 1, name: /Associations/i })).toBeVisible({
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe('/isoko/association');
  });

  test('IA-FM01-F01-TC02 Login with Incorrect Password', async ({ page }) => {
    const creds = adminCredentials()!;
    await page.goto('/signin');
    await clickContinueWithAdminOAuth(page);
    await waitForOAuthAuthorize(page);
    await fillOAuthPasswordForm(page, creds.email, 'definitely-not-the-real-password-123');

    // Must stay on the OAuth host (not reach the admin dashboard) and surface an error.
    await expect
      .poll(() => page.url(), { timeout: 35_000 })
      .toMatch(new RegExp(`^${regexEscape(oauthOrigin())}`));

    const error = page
      .getByRole('alert')
      .or(
        page.getByText(
          /invalid|incorrect|wrong password|credential|unauthorized|authentication failed|sign in failed|try again/i,
        ),
      );
    await expect(error.first()).toBeVisible({ timeout: 25_000 });
    expect(new URL(page.url()).pathname).not.toBe('/isoko/association');
  });

  test('IA-FM01-F01-TC06 Unauthorized Access to System Admin URLs', async ({ page }) => {
    // Deep-link to a protected admin route without a session -> must be bounced to sign-in.
    await page.goto('/isoko/association/users', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const url = new URL(page.url());
    const onSignin = /signin/i.test(url.pathname) || url.origin === oauthOrigin();
    const ctaVisible = await page
      .locator('a, button')
      .filter({ hasText: /Continue with Admin OAuth/i })
      .count();

    expect(
      onSignin || ctaVisible > 0,
      `Expected redirect to sign-in for an unauthenticated protected route, got ${page.url()}`,
    ).toBeTruthy();
    expect(new URL(ADMIN_BASE_URL).origin).toBe(new URL(ADMIN_BASE_URL).origin);
  });
});
