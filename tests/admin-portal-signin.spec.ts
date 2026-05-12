import { test, expect } from '@playwright/test';
import {
  ADMIN_BASE_URL,
  adminCredentials,
  clickContinueWithAdminOAuth,
  fillOAuthPasswordForm,
  oauthOrigin,
  regexEscape,
  waitForOAuthAuthorize,
} from './auth-flow';

test.describe('Admin portal /signin', () => {
  test('renders marketing shell and OAuth CTA', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveTitle(/Sign In/i);

    await expect(
      page.getByRole('heading', { level: 1, name: /Admin Portal/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /sign in/i }),
    ).toBeVisible();

    const oauthCta = page
      .locator('a, button')
      .filter({ hasText: /Continue with Admin OAuth/i })
      .first();
    await expect(oauthCta).toBeVisible();
  });

  test('OAuth CTA navigates to hosted authorize endpoint', async ({ page }) => {
    await page.goto('/signin');
    await clickContinueWithAdminOAuth(page);
    await waitForOAuthAuthorize(page);
  });

  /*
   * Password reset via hosted OAuth is intentionally not automated here — it triggers email-dependent
   * flows and varies by tenant policy; use manual or API-backed resets for those cases.
   */
});

test.describe('Live credential flows (@live)', { tag: '@live' }, () => {
  test.beforeEach(() => {
    test.skip(!adminCredentials(), 'Set ADMIN_SIGNIN_EMAIL and ADMIN_SIGNIN_PASSWORD (or ISOKO_EMAIL / ISOKO_PASSWORD)');
  });

  test('logs in with valid administrator credentials', async ({ page }) => {
    const creds = adminCredentials()!;
    await page.goto('/signin');
    await clickContinueWithAdminOAuth(page);
    await waitForOAuthAuthorize(page);
    await fillOAuthPasswordForm(page, creds.email, creds.password);

    const adminOrigin = new URL(ADMIN_BASE_URL).origin;
    await page.waitForURL(
      url => {
        try {
          const u = new URL(url);
          const onAdminApp = u.origin === adminOrigin;
          const leftOAuthHost = u.origin !== oauthOrigin();
          return onAdminApp && leftOAuthHost;
        } catch {
          return false;
        }
      },
      { timeout: 90_000 },
    );

    expect(new URL(page.url()).origin).toBe(adminOrigin);
    expect(new URL(page.url()).pathname).not.toBe('/signin');
  });

  test('rejects invalid password on OAuth form', async ({ page }) => {
    const creds = adminCredentials()!;
    await page.goto('/signin');
    await clickContinueWithAdminOAuth(page);
    await waitForOAuthAuthorize(page);
    await fillOAuthPasswordForm(page, creds.email, 'definitely-not-the-real-password-123');

    await expect.poll(() => page.url(), { timeout: 35_000 }).toMatch(
      new RegExp(`^${regexEscape(oauthOrigin())}`),
    );

    const errorLocator = page
      .getByRole('alert')
      .or(
        page.getByText(
          /invalid|incorrect|wrong password|credential|Unauthorized|authentication failed|sign in failed/i,
        ),
      );

    await expect(errorLocator.first()).toBeVisible({ timeout: 25_000 });
  });
});
