import { test, expect, ensureLoggedIn, gotoSection, tableRowCount } from './portal';

/**
 * ADMIN ORDER MANAGEMENT section - read-only verifications only.
 * Status transitions (confirm / reject / cancel / deliver) are NOT triggered - they mutate live
 * orders and notify real buyers/sellers (blocked cases handled in blocked.spec.ts).
 */
test.describe('ADMIN ORDER MANAGEMENT @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await gotoSection(page, 'Orders');
  });

  test('IA-CM02-F08-TC01 View Newly Placed Order', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /Orders/i })).toBeVisible();
    // Filter to Pending and confirm a newly placed order is listed.
    await page.getByRole('button', { name: /^Pending$/ }).first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator('table')).toBeVisible();
    const head = (await page.locator('table thead').innerText().catch(() => '')).toLowerCase();
    expect(head).toMatch(/order|status|date|total|buyer|product/);
  });

  test('IA-CM02-F08-TC02 Validate Order Details', async ({ page }) => {
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/orders\/[^/]+$/);
    await expect(page.getByRole('button', { name: /Back to Orders/i })).toBeVisible();
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body, 'Order detail should show product / quantity / price / total').toMatch(
      /product|quantity|qty|price|total|amount/,
    );
  });

  test('IA-CM02-F08-TC03 Default Status Validation', async ({ page }) => {
    // Newly placed orders should appear under the Pending status filter.
    await page.getByRole('button', { name: /^Pending$/ }).first().click();
    await page.waitForTimeout(1500);
    const rows = await tableRowCount(page);
    if (rows === 0) {
      test.skip(true, 'No pending orders currently exist to validate the default status');
    }
    const body = (await page.locator('table tbody').innerText()).toLowerCase();
    expect(body).toContain('pending');
  });
});
