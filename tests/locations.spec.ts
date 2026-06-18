import { test, expect, ensureLoggedIn, gotoSection, closeModal, openAddModal, submitModal } from './portal';

/**
 * LOCATION AND LOCATION LEVEL section.
 *
 * Reversible writes only: throwaway levels/locations (E2E_TEMP_*) are created then DEACTIVATED in
 * cleanup (no hard-delete exists). The Add/Edit forms use free-text ID fields (no dropdowns).
 */
// Shared across workers via env so create -> edit -> deactivate target the same entities.
const STAMP = process.env.E2E_STAMP || String(Date.now());
const LEVEL_NAME = `E2E_TEMP_LVL_${STAMP}`;
const CHILD_LEVEL_NAME = `E2E_TEMP_CLVL_${STAMP}`;
const LOC_NAME = `E2E_TEMP_LOC_${STAMP}`;
const CHILD_LOC_NAME = `E2E_TEMP_CLOC_${STAMP}`;

const created: Array<{ section: string; name: string }> = [];

// Not serial: with fullyParallel=false these run sequentially in declaration order within one
// worker, but a single failing assertion does not abort the remaining cases.

async function ensureLevel(page: any, name: string, parentId?: string) {
  await gotoSection(page, 'Location Levels', /Location Levels/i);
  if (await page.locator('tr', { hasText: name }).first().count()) return;
  await openAddModal(page, /Add Level/i);
  await page.getByPlaceholder('e.g. County').fill(name);
  if (parentId) await page.getByPlaceholder('e.g. 1').first().fill(parentId);
  await submitModal(page, /^Create$/);
}

async function ensureLocation(page: any, name: string) {
  await gotoSection(page, 'Locations', /Locations/i);
  if (await page.locator('tr', { hasText: name }).first().count()) return;
  await openAddModal(page, /Add Location/i);
  await page.getByPlaceholder('e.g. Nairobi').fill(name);
  await page.getByPlaceholder('e.g. NBO').fill(`E${String(STAMP).slice(-5)}`);
  await page.getByPlaceholder('e.g. 2').fill('1');
  await submitModal(page, /^Create$/);
}

async function deactivateByName(page: any, section: string, name: string) {
  await gotoSection(page, section, section === 'Location Levels' ? /Location Levels/i : /Locations/i);
  const row = page.locator('tr', { hasText: name }).first();
  if (!(await row.count())) return;
  await row.getByRole('button', { name: /^Edit$/ }).click();
  const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
  if ((await active.count()) && (await active.isChecked())) await active.uncheck();
  await submitModal(page, /^Update$/);
}

test.describe('LOCATION AND LOCATION LEVEL @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      await ensureLoggedIn(page);
      for (const c of created) await deactivateByName(page, c.section, c.name).catch(() => {});
    } catch {
      /* ignore */
    } finally {
      await page.close();
    }
  });

  // ---------- Location Levels ----------
  test('IA-FM01-F10-TC01 Create location level (no parent)', async ({ page }) => {
    await gotoSection(page, 'Location Levels', /Location Levels/i);
    await openAddModal(page, /Add Level/i);
    await page.getByPlaceholder('e.g. County').fill(LEVEL_NAME);
    await submitModal(page, /^Create$/);
    created.push({ section: 'Location Levels', name: LEVEL_NAME });
    await expect(page.locator('table').getByText(LEVEL_NAME, { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('IA-FM01-F10-TC02 Create Child Location Level', async ({ page }) => {
    await gotoSection(page, 'Location Levels', /Location Levels/i);
    await openAddModal(page, /Add Level/i);
    await page.getByPlaceholder('e.g. County').fill(CHILD_LEVEL_NAME);
    await page.getByPlaceholder('e.g. 1').first().fill('1'); // Parent ID (optional)
    await submitModal(page, /^Create$/);
    created.push({ section: 'Location Levels', name: CHILD_LEVEL_NAME });
    await expect(page.locator('table').getByText(CHILD_LEVEL_NAME, { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('IA-FM01-F10-TC03 Create Location Level Without Name', async ({ page }) => {
    await gotoSection(page, 'Location Levels', /Location Levels/i);
    const before = await page.locator('table tbody tr').count();
    await openAddModal(page, /Add Level/i);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1200);
    const modalOpen = await page.locator('div.fixed.inset-0').count();
    const errVisible = await page.getByText(/required|cannot be empty|enter|name is|please/i).count().catch(() => 0);
    await closeModal(page);
    const after = await page.locator('table tbody tr').count();
    expect(modalOpen > 0 || errVisible > 0 || after === before, 'Empty level name should be rejected').toBeTruthy();
  });

  test('IA-FM01-F10-TC04 Create Duplicate Location Level', async ({ page }) => {
    await gotoSection(page, 'Location Levels', /Location Levels/i);
    const existing = (await page.locator('table tbody tr td').first().innerText().catch(() => '')).trim();
    test.skip(!existing, 'No existing level to duplicate');
    const before = await page.locator('table tbody tr', { hasText: existing }).count();
    await openAddModal(page, /Add Level/i);
    await page.getByPlaceholder('e.g. County').fill(existing);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1500);
    const modalOpen = await page.locator('div.fixed.inset-0').count();
    const errVisible = await page.getByText(/exist|duplicate|already|taken|unique/i).count().catch(() => 0);
    await closeModal(page);
    const after = await page.locator('table tbody tr', { hasText: existing }).count();
    expect(modalOpen > 0 || errVisible > 0 || after === before, 'Duplicate level should be prevented').toBeTruthy();
  });

  test('IA-FM01-F10-TC05 Deactivate Location Level', async ({ page }) => {
    await ensureLevel(page, LEVEL_NAME);
    if (!created.find(c => c.name === LEVEL_NAME)) created.push({ section: 'Location Levels', name: LEVEL_NAME });
    const row = page.locator('tr', { hasText: LEVEL_NAME }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    if (await active.isChecked()) await active.uncheck();
    await submitModal(page, /^Update$/);
    const r2 = page.locator('tr', { hasText: LEVEL_NAME }).first();
    if (await r2.count()) {
      await r2.getByRole('button', { name: /^Edit$/ }).click();
      await expect(page.locator('div.fixed.inset-0 input[type="checkbox"]').first()).not.toBeChecked();
      await closeModal(page);
    }
  });

  test('IA-FM01-F10-TC06 Activate Location Level', async ({ page }) => {
    await ensureLevel(page, LEVEL_NAME);
    const row = page.locator('tr', { hasText: LEVEL_NAME }).first();
    test.skip(!(await row.count()), 'Temp level not visible (may be hidden while inactive)');
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    if (!(await active.isChecked())) await active.check();
    await submitModal(page, /^Update$/);
    const r2 = page.locator('tr', { hasText: LEVEL_NAME }).first();
    await r2.getByRole('button', { name: /^Edit$/ }).click();
    await expect(page.locator('div.fixed.inset-0 input[type="checkbox"]').first()).toBeChecked();
    await closeModal(page);
  });

  test('IA-FM01-F10-TC08 Visibility of Inactive Levels', async ({ page }) => {
    // Deactivate the child level, then confirm whether the list hides inactive entries.
    await ensureLevel(page, CHILD_LEVEL_NAME, '1');
    if (!created.find(c => c.name === CHILD_LEVEL_NAME)) created.push({ section: 'Location Levels', name: CHILD_LEVEL_NAME });
    const row = page.locator('tr', { hasText: CHILD_LEVEL_NAME }).first();
    test.skip(!(await row.count()), 'Child level from TC02 not available');
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    if (await active.isChecked()) await active.uncheck();
    await submitModal(page, /^Update$/);
    const stillListed = await page.locator('table tbody tr', { hasText: CHILD_LEVEL_NAME }).count();
    expect(stillListed, 'Inactive level should not be visible in the default list').toBe(0);
  });

  // ---------- Locations ----------
  test('IA-FM01-F10-TC09 Create Parent Location (no parent)', async ({ page }) => {
    await gotoSection(page, 'Locations', /Locations/i);
    await openAddModal(page, /Add Location/i);
    await page.getByPlaceholder('e.g. Nairobi').fill(LOC_NAME);
    await page.getByPlaceholder('e.g. NBO').fill(`E${STAMP % 100000}`);
    await page.getByPlaceholder('e.g. 2').fill('1'); // Level ID
    await submitModal(page, /^Create$/);
    created.push({ section: 'Locations', name: LOC_NAME });
    await expect(page.locator('table').getByText(LOC_NAME, { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('IA-FM01-F10-TC10 Create child location', async ({ page }) => {
    await gotoSection(page, 'Locations', /Locations/i);
    await openAddModal(page, /Add Location/i);
    await page.getByPlaceholder('e.g. Nairobi').fill(CHILD_LOC_NAME);
    await page.getByPlaceholder('e.g. NBO').fill(`C${STAMP % 100000}`);
    await page.getByPlaceholder('e.g. 2').fill('1'); // Level ID
    await page.getByPlaceholder('e.g. 1').first().fill('1'); // Parent ID (optional)
    await submitModal(page, /^Create$/);
    created.push({ section: 'Locations', name: CHILD_LOC_NAME });
    await expect(page.locator('table').getByText(CHILD_LOC_NAME, { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('IA-FM01-F10-TC11 Create Location Under Inactive Level', async ({ page }) => {
    await gotoSection(page, 'Locations', /Locations/i);
    await openAddModal(page, /Add Location/i);
    // The form takes a free-text "Level ID" - there is no selectable options list to exclude inactive levels.
    const hasLevelSelect = await page.locator('div.fixed.inset-0 select, div.fixed.inset-0 [role="combobox"]').count();
    await closeModal(page);
    expect(
      hasLevelSelect > 0,
      'Location form uses a free-text Level ID (no options list), so inactive-level exclusion cannot be enforced/verified here',
    ).toBeTruthy();
  });

  test('IA-FM01-F10-TC12 Create Location with Missing Fields', async ({ page }) => {
    await gotoSection(page, 'Locations', /Locations/i);
    const before = await page.locator('table tbody tr').count();
    await openAddModal(page, /Add Location/i);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1200);
    const modalOpen = await page.locator('div.fixed.inset-0').count();
    const errVisible = await page.getByText(/required|cannot be empty|enter|please|invalid/i).count().catch(() => 0);
    await closeModal(page);
    const after = await page.locator('table tbody tr').count();
    expect(modalOpen > 0 || errVisible > 0 || after === before, 'Empty location should be rejected').toBeTruthy();
  });

  test('IA-FM01-F10-TC13 Create Duplicate Location', async ({ page }) => {
    await gotoSection(page, 'Locations', /Locations/i);
    const existing = (await page.locator('table tbody tr td').first().innerText().catch(() => '')).trim();
    test.skip(!existing, 'No existing location to duplicate');
    const before = await page.locator('table tbody tr', { hasText: existing }).count();
    await openAddModal(page, /Add Location/i);
    await page.getByPlaceholder('e.g. Nairobi').fill(existing);
    await page.getByPlaceholder('e.g. NBO').fill(`D${STAMP % 100000}`);
    await page.getByPlaceholder('e.g. 2').fill('1');
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1500);
    const modalOpen = await page.locator('div.fixed.inset-0').count();
    const errVisible = await page.getByText(/exist|duplicate|already|taken|unique/i).count().catch(() => 0);
    await closeModal(page);
    const after = await page.locator('table tbody tr', { hasText: existing }).count();
    expect(modalOpen > 0 || errVisible > 0 || after === before, 'Duplicate location should be prevented').toBeTruthy();
  });

  test('IA-FM01-F10-TC14 Change Parent Location', async ({ page }) => {
    await ensureLocation(page, LOC_NAME);
    if (!created.find(c => c.name === LOC_NAME)) created.push({ section: 'Locations', name: LOC_NAME });
    const row = page.locator('tr', { hasText: LOC_NAME }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const parent = page.locator('div.fixed.inset-0').getByPlaceholder('e.g. 1').first();
    await expect(parent).toBeVisible();
    await parent.fill('1');
    await submitModal(page, /^Update$/);
    // revert parent to empty
    const r2 = page.locator('tr', { hasText: LOC_NAME }).first();
    if (await r2.count()) {
      await r2.getByRole('button', { name: /^Edit$/ }).click();
      await page.locator('div.fixed.inset-0').getByPlaceholder('e.g. 1').first().fill('');
      await submitModal(page, /^Update$/);
    }
  });

  test('IA-FM01-F10-TC15 Deactivate Location', async ({ page }) => {
    await ensureLocation(page, LOC_NAME);
    if (!created.find(c => c.name === LOC_NAME)) created.push({ section: 'Locations', name: LOC_NAME });
    const row = page.locator('tr', { hasText: LOC_NAME }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    if (await active.isChecked()) await active.uncheck();
    await submitModal(page, /^Update$/);
  });

  test('IA-FM01-F10-TC16 Activate Location', async ({ page }) => {
    await ensureLocation(page, LOC_NAME);
    const row = page.locator('tr', { hasText: LOC_NAME }).first();
    test.skip(!(await row.count()), 'Temp location not visible (may be hidden while inactive)');
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    if (!(await active.isChecked())) await active.check();
    await submitModal(page, /^Update$/);
    const r2 = page.locator('tr', { hasText: LOC_NAME }).first();
    await r2.getByRole('button', { name: /^Edit$/ }).click();
    await expect(page.locator('div.fixed.inset-0 input[type="checkbox"]').first()).toBeChecked();
    await closeModal(page);
  });
});
