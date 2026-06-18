import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { adminCredentials } from './auth-flow';

export { expect };

/** Storage-state authenticated test. The `setup` project logs in once and persists session. */
export const test = base;

export function rx(literal: string): RegExp {
  return new RegExp(`^${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

function isDashboardUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.pathname.replace(/\/$/, '') === '/isoko/association';
  } catch {
    return false;
  }
}

/**
 * Ensure we are on an authenticated dashboard. The shared storage state usually keeps us signed in,
 * but if the access token expired mid-run we re-authenticate. Re-login is tolerant of the IdP
 * auto-approving (skipping the password form) when its session is still alive.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto('/isoko/association', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);

  const navAssociations = page.locator('nav a, aside a').filter({ hasText: /^Associations$/ }).first();
  if (await navAssociations.isVisible().catch(() => false)) return;

  const cta = page.locator('a, button').filter({ hasText: /Continue with Admin OAuth/i }).first();
  if (await cta.count().catch(() => 0)) {
    const creds = adminCredentials();
    if (!creds) {
      test.skip(true, 'Set ADMIN_SIGNIN_EMAIL / ADMIN_SIGNIN_PASSWORD in .env');
      return;
    }
    await cta.click().catch(() => {});
    // Either the OAuth password form appears, or the IdP auto-approves straight back to the dashboard.
    const passwordField = page.locator('input[type="password"]').first();
    const outcome = await Promise.race([
      passwordField.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'form').catch(() => ''),
      page.waitForURL(u => isDashboardUrl(u), { timeout: 20_000 }).then(() => 'dash').catch(() => ''),
    ]);
    if (outcome === 'form') {
      await page.getByPlaceholder(/email or phone/i).first().fill(creds.email).catch(() => {});
      await passwordField.fill(creds.password).catch(() => {});
      await page.getByRole('button', { name: /sign in|log ?in/i }).first().click().catch(() => {});
    }
    await page.waitForURL(u => isDashboardUrl(u), { timeout: 90_000 }).catch(() => {});
  }

  await expect(navAssociations).toBeVisible({ timeout: 30_000 });
}

/** Close the custom modal overlay (Cancel/Close, then click outside as a fallback). */
export async function closeModal(page: Page): Promise<void> {
  const overlay = page.locator('div.fixed.inset-0').first();
  if (!(await overlay.count().catch(() => 0))) return;
  const cancel = page.getByRole('button', { name: /^(Cancel|Close)$/i }).first();
  if (await cancel.count().catch(() => 0)) {
    await cancel.click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
  if (await overlay.count().catch(() => 0)) {
    await page.mouse.click(4, 4).catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * Click a modal submit button (Create / Update) and wait for the overlay to close. Some forms keep
 * the modal open briefly after the request resolves, so we wait for the overlay to detach and fall
 * back to an explicit close if it lingers. This prevents the overlay from intercepting later clicks.
 */
export async function submitModal(page: Page, buttonRx: RegExp): Promise<void> {
  const overlay = page.locator('div.fixed.inset-0').first();
  await page.getByRole('button', { name: buttonRx }).first().click().catch(() => {});
  await overlay
    .waitFor({ state: 'detached', timeout: 6000 })
    .catch(async () => {
      // request may have succeeded without auto-closing; dismiss it ourselves.
      await closeModal(page);
    });
  await page.waitForTimeout(600);
}

/** Navigate to a sidebar section by its visible label and wait for the page heading. */
export async function gotoSection(page: Page, label: string, headingRx?: RegExp): Promise<void> {
  await closeModal(page);
  const link = page.locator('nav a, aside a').filter({ hasText: rx(label) }).first();
  await expect(link).toBeVisible({ timeout: 20_000 });
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: headingRx ?? rx(label) })).toBeVisible({
    timeout: 25_000,
  });
  await page.waitForTimeout(900);
}

/** Number of body rows in the first data table on the page. */
export async function tableRowCount(page: Page): Promise<number> {
  return page.locator('table tbody tr').count().catch(() => 0);
}

/** The primary on-page search box (prefers a descriptive placeholder over the global one). */
export function listSearchBox(page: Page): Locator {
  const descriptive = page.locator(
    'input[placeholder*="Search by" i], input[placeholder*="name" i], input[placeholder*="product" i]',
  );
  return descriptive.first();
}

/**
 * True if a real action control (button / combobox / select / non-sidebar link) in the page's
 * main content matches the regex. The sidebar navigation is deliberately excluded so that links
 * like "Roles" or "Locations" are not mistaken for filter/export controls.
 */
export async function controlExists(page: Page, re: RegExp): Promise<boolean> {
  const main = page.locator('main, [role="main"]').first();
  const scope = (await main.count().catch(() => 0)) ? main : page.locator('body');

  const byRoleBtn = await scope.getByRole('button', { name: re }).count().catch(() => 0);
  const byCombo = await scope.getByRole('combobox', { name: re }).count().catch(() => 0);
  const byNonNavLink = await page
    .locator('a:not(nav a):not(aside a)')
    .filter({ hasText: re })
    .count()
    .catch(() => 0);
  // selects only count as a filter affordance (and only when probing for a filter).
  const probesFilter = /filter|status|role|location|country|date|association|sort/i.test(re.source);
  const bySelect = probesFilter ? await scope.locator('select').count().catch(() => 0) : 0;

  return byRoleBtn + byCombo + byNonNavLink + bySelect > 0;
}

/** Open the row-level "Add" modal for config sections (Add Role / Add Level / Add Location, ...). */
export async function openAddModal(page: Page, addButtonRx: RegExp): Promise<void> {
  await page.getByRole('button', { name: addButtonRx }).first().click();
  await expect(page.locator('div.fixed.inset-0').first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
}
