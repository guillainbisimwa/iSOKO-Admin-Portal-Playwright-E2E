import { test, expect, ensureLoggedIn, gotoSection, tableRowCount, controlExists } from './portal';

/**
 * ASSOCIATION MANAGEMENT section - read-only verifications only.
 * Approve / Decline / Request Info / Suspend / Edit are NOT triggered (irreversible / notify real users).
 */
test.describe('ASSOCIATION MANAGEMENT @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await gotoSection(page, 'Associations');
  });

  test('IA-CM05-F01-TC01 View Associations List', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Associations Management/i })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    expect(await tableRowCount(page)).toBeGreaterThan(0);
    const head = (await page.locator('table thead').innerText().catch(() => '')).toLowerCase();
    expect(head).toMatch(/association|country|status|member|manager/);
  });

  test('IA-CM05-F01-TC02 Search Association', async ({ page }) => {
    const firstRow = (await page.locator('table tbody tr').first().innerText()).trim();
    const term = (firstRow.match(/[A-Za-z]{3,}/) || ['a'])[0];
    const search = page.getByPlaceholder(/search/i).last();
    await search.fill(term);
    await search.press('Enter');
    await page.waitForTimeout(1500);
    const body = (await page.locator('table tbody').innerText()).toLowerCase();
    expect(body, 'Search results should contain the searched term').toContain(term.toLowerCase());
  });

  test('IA-CM05-F01-TC03 Filter Associations by Location', async ({ page }) => {
    const hasLocationFilter = await controlExists(page, /country|location/i);
    expect(
      hasLocationFilter,
      'No country/location filter control on the Associations list (only status tabs exist)',
    ).toBeTruthy();
  });

  test('IA-CM05-F01-TC04 Filter Associations by Status', async ({ page }) => {
    // Status tabs: Pending Review / Approved / Rejected / Information Requested.
    const approved = page.getByRole('button', { name: /Approved/i }).first();
    await expect(approved).toBeVisible();
    await approved.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('table')).toBeVisible();
    // Switch back to Pending Review.
    await page.getByRole('button', { name: /Pending Review/i }).first().click();
    await page.waitForTimeout(800);
  });

  test('IA-CM05-F01-TC05 Review Association Registration Application', async ({ page }) => {
    await page.getByRole('button', { name: /Pending Review/i }).first().click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/associations\/[^/]+$/);
    await expect(page.getByRole('button', { name: /Back to Associations/i })).toBeVisible();
    // Application details + review actions are available (not clicked).
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/association code|country|members|status|email/);
    await expect(page.getByRole('button', { name: /Approve|Decline|Request Info/i }).first()).toBeVisible();
  });

  test('IA-CM05-F01-TC10 View Association Profile', async ({ page }) => {
    await page.getByRole('button', { name: /Approved/i }).first().click();
    await page.waitForTimeout(1000);
    const view = page.getByRole('button', { name: /^View$/ }).first();
    test.skip(!(await view.count()), 'No approved association available to view');
    await view.click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/associations\/[^/]+$/);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/association code|country|founded|members|email|address/);
  });

  test('IA-CM05-F01-TC12 Monitor Association Members', async ({ page }) => {
    await page.getByRole('button', { name: /Approved/i }).first().click();
    await page.waitForTimeout(1000);
    const view = page.getByRole('button', { name: /^View$/ }).first();
    test.skip(!(await view.count()), 'No association available to view');
    await view.click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/associations\/[^/]+$/);

    // A members surface (tab, heading, list or count) should be present on the profile.
    const membersTab = page.getByRole('tab', { name: /members/i });
    const membersText = page.getByText(/members/i);
    const hasMembers = (await membersTab.count()) > 0 || (await membersText.count()) > 0;
    expect(hasMembers, 'No members section/list is present on the association profile').toBeTruthy();
  });

  test('IA-CM05-F01-TC16 Verify Association Marketplace Page', async ({ page }) => {
    const hasMarketplace =
      (await controlExists(page, /marketplace/i)) ||
      (await page.getByText(/marketplace/i).count().catch(() => 0)) > 0;
    expect(
      hasMarketplace,
      'No marketplace view is exposed in the instance admin portal',
    ).toBeTruthy();
  });
});
