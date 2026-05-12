import { expect, type Page } from '@playwright/test';

/** Default aligns with playwright.config.ts */
export const ADMIN_BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://isoko-admin-portal.vercel.app';

/** Authorize endpoint discovered from shipped admin bundle (api.dev.isoko.africa/v1/oauth2/authorize). */
export function oauthOrigin(): string {
  const raw = process.env.OAUTH_BASE_URL ?? 'https://api.dev.isoko.africa';
  return new URL(raw).origin;
}

export function regexEscape(origin: string) {
  return origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function adminCredentials(): { email: string; password: string } | null {
  const email =
    process.env.ADMIN_SIGNIN_EMAIL ??
    process.env.ISOKO_EMAIL ??
    '';
  const password =
    process.env.ADMIN_SIGNIN_PASSWORD ??
    process.env.ISOKO_PASSWORD ??
    '';
  if (!email.trim() || !password) return null;
  return { email: email.trim(), password: password.trim() };
}

export async function clickContinueWithAdminOAuth(page: Page) {
  const cta = page
    .locator('a, button')
    .filter({ hasText: /Continue with Admin OAuth/i })
    .first();
  await expect(cta).toBeVisible({ timeout: 15_000 });
  await cta.click();
}

/** Paths on OAUTH_BASE_URL after starting Admin OAuth (authorize may 302 to /v1/oauth2/login). */
function isHostedOAuthNavigationUrl(url: URL): boolean {
  if (url.origin !== oauthOrigin()) return false;
  const p = url.pathname;
  return (
    p.startsWith('/v1/oauth2/authorize') ||
    p.startsWith('/v1/oauth2/login') ||
    p.startsWith('/oauth2/authorize') ||
    p === '/login' ||
    p.startsWith('/login/')
  );
}

export async function waitForOAuthAuthorize(page: Page) {
  await page.waitForURL(isHostedOAuthNavigationUrl, {
    timeout: 25_000,
    waitUntil: 'domcontentloaded',
  });
}

/** Selectors refined after inspecting the OAuth HTML (see README: codegen). */
export async function fillOAuthPasswordForm(page: Page, email: string, password: string) {
  const emailInput = page.getByPlaceholder(/email or phone/i);
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await emailInput.fill(email);

  const passwordInput = page.locator('input[type="password"]').first();
  await expect(passwordInput).toBeVisible({ timeout: 10_000 });
  await passwordInput.fill(password);

  await page.getByRole('button', { name: /sign in|login/i }).click();
}

/** Post–OAuth callback the app replaces history onto the instance admin dashboard (see bundle: dl="/isoko/association"). */
export async function waitForInstanceAdminAssociationDashboard(page: Page) {
  const adminOrigin = new URL(ADMIN_BASE_URL).origin;
  await page.waitForURL(
    url => {
      try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/$/, '') || '/';
        return u.origin === adminOrigin && path === '/isoko/association';
      } catch {
        return false;
      }
    },
    { timeout: 90_000, waitUntil: 'domcontentloaded' },
  );
}

/**
 * Full browser login for the association (instance) admin area: /signin → hosted OAuth → /isoko/association.
 */
export async function loginInstanceAdminViaOAuth(
  page: Page,
  creds: { email: string; password: string },
) {
  await page.goto('/signin');
  await clickContinueWithAdminOAuth(page);
  await waitForOAuthAuthorize(page);
  await fillOAuthPasswordForm(page, creds.email, creds.password);
  await waitForInstanceAdminAssociationDashboard(page);
}
