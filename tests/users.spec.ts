import { test, expect, ensureLoggedIn, gotoSection, tableRowCount, listSearchBox, controlExists } from './portal';

/** USER MANAGEMENT section (list / search / filter / view + edit-restriction). */
test.describe('USER MANAGEMENT @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await gotoSection(page, 'Users');
  });

  test('IA-FM01-F15-TC01 View User List', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /Users/i })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    expect(await tableRowCount(page), 'User list should render at least one row').toBeGreaterThan(0);
    // Key attribute columns.
    const head = (await page.locator('table thead').innerText().catch(() => '')).toLowerCase();
    expect(head).toMatch(/name|email|role|status/);
  });

  test('IA-FM01-F15-TC02 Search User by Name or Email', async ({ page }) => {
    const before = await tableRowCount(page);
    expect(before).toBeGreaterThan(0);
    const firstRowText = (await page.locator('table tbody tr').first().innerText()).trim();
    const term = (firstRowText.match(/[A-Za-z]{3,}/) || ['a'])[0];

    const box = listSearchBox(page);
    await box.fill(term);
    await box.press('Enter');
    await page.waitForTimeout(1500);

    const after = await tableRowCount(page);
    expect(after, 'Search should return at least one matching row').toBeGreaterThan(0);
    const bodyText = (await page.locator('table tbody').innerText()).toLowerCase();
    expect(bodyText).toContain(term.toLowerCase());
  });

  test('IA-FM01-F15-TC03 Filter Users by Location', async ({ page }) => {
    const hasFilter = await controlExists(page, /location|country|filter/i);
    expect(hasFilter, 'No location/country filter control is present on the Users list').toBeTruthy();
  });

  test('IA-FM01-F15-TC04 Filter Users by Role', async ({ page }) => {
    const hasFilter = await controlExists(page, /role|filter/i);
    expect(hasFilter, 'No role filter control is present on the Users list').toBeTruthy();
  });

  test('IA-FM01-F15-TC05 Filter Users by Status', async ({ page }) => {
    const hasFilter = await controlExists(page, /status|active|inactive|suspended|filter/i);
    expect(hasFilter, 'No status filter control is present on the Users list').toBeTruthy();
  });

  test('IA-FM01-F15-TC06 View User Profile Details', async ({ page }) => {
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/users\/[^/]+$/);
    await expect(page.getByRole('button', { name: /Back to Users/i })).toBeVisible();
    // Profile shows identifying details.
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toMatch(/email|phone|role|status|name/);
  });

  test('IA-FM01-F15-TC08 Restriction on User profile edits', async ({ page }) => {
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await expect.poll(() => page.url(), { timeout: 15_000 }).toMatch(/\/users\/[^/]+$/);

    // The profile view exposes no enabled editor for phone/email (only the global search box exists).
    const editableFields = await page
      .locator('input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])')
      .evaluateAll(els =>
        els.filter(e => {
          const p = (e.getAttribute('placeholder') || '').toLowerCase();
          return !p.includes('search');
        }).length,
      )
      .catch(() => 0);
    const hasEmailPhoneEditor = await page
      .locator('input[type="email"], input[type="tel"], input[name*="email" i], input[name*="phone" i]')
      .count()
      .catch(() => 0);

    expect(
      editableFields === 0 && hasEmailPhoneEditor === 0,
      'Phone/email appear to be editable on the user profile, but the spec requires them to be blocked',
    ).toBeTruthy();
  });
});
