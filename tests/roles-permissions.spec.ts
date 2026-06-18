import { test, expect, ensureLoggedIn, gotoSection, closeModal, openAddModal, submitModal } from './portal';

/**
 * ROLE AND PERMISSION ASSIGNMENT section.
 *
 * Reversible writes only: a throwaway role (E2E_TEMP_*) is created and then DEACTIVATED in cleanup
 * (the portal exposes no hard-delete). Permission-assignment cases assert the permission UI exists;
 * it does not in this build, so they fail with an explanatory message.
 */
// Shared across workers via env so create -> edit -> deactivate target the same role.
const STAMP = process.env.E2E_STAMP || String(Date.now());
const ROLE_NAME = `E2E_TEMP_ROLE_${STAMP}`;
const NAME_INPUT = 'e.g. Administrator';

// Not serial: with fullyParallel=false these run sequentially in declaration order within one
// worker, but a single failing assertion does not abort the remaining cases.
async function ensureRole(page: any) {
  const row = page.locator('tr', { hasText: ROLE_NAME }).first();
  if (await row.count()) return;
  await openAddModal(page, /Add Role/i);
  await page.getByPlaceholder(NAME_INPUT).fill(ROLE_NAME);
  await submitModal(page, /^Create$/);
}

test.describe('ROLE AND PERMISSION ASSIGNMENT @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await gotoSection(page, 'Roles');
  });

  test.afterAll(async ({ browser }) => {
    // Best-effort cleanup: deactivate the temp role so it is no longer usable.
    const page = await browser.newPage();
    try {
      await ensureLoggedIn(page);
      await gotoSection(page, 'Roles');
      const row = page.locator('tr', { hasText: ROLE_NAME }).first();
      if (await row.count()) {
        await row.getByRole('button', { name: /^Edit$/ }).click();
        const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
        if ((await active.count()) && (await active.isChecked())) await active.uncheck();
        await submitModal(page, /^Update$/);
      }
    } catch {
      /* ignore cleanup errors */
    } finally {
      await page.close();
    }
  });

  test('IA-FM01-F03-TC01 Create New Role', async ({ page }) => {
    await openAddModal(page, /Add Role/i);
    await page.getByPlaceholder(NAME_INPUT).fill(ROLE_NAME);
    await submitModal(page, /^Create$/);
    // Role is present after creation (or already present if a prior worker created the shared name).
    await expect(page.locator('table').getByText(ROLE_NAME, { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('IA-FM01-F03-TC02 Create Role with Missing Mandatory Fields', async ({ page }) => {
    const rowsBefore = await page.locator('table tbody tr').count();
    await openAddModal(page, /Add Role/i);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1200);

    const modalStillOpen = await page.locator('div.fixed.inset-0').count();
    const errorVisible = await page
      .getByText(/required|cannot be empty|enter a|name is|please/i)
      .count()
      .catch(() => 0);
    await closeModal(page);
    const rowsAfter = await page.locator('table tbody tr').count();
    expect(
      modalStillOpen > 0 || errorVisible > 0 || rowsAfter === rowsBefore,
      'Empty role name should be rejected (modal stays open / validation error / no row added)',
    ).toBeTruthy();
  });

  test('IA-FM01-F03-TC03 Create Duplicate Role', async ({ page }) => {
    const existing = (await page.locator('table tbody tr td').first().innerText().catch(() => '')).trim();
    test.skip(!existing, 'No existing role to duplicate');
    const dupCountBefore = await page.locator('table tbody tr', { hasText: existing }).count();

    await openAddModal(page, /Add Role/i);
    await page.getByPlaceholder(NAME_INPUT).fill(existing);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForTimeout(1500);

    const modalStillOpen = await page.locator('div.fixed.inset-0').count();
    const errorVisible = await page
      .getByText(/exist|duplicate|already|taken|unique/i)
      .count()
      .catch(() => 0);
    await closeModal(page);
    const dupCountAfter = await page.locator('table tbody tr', { hasText: existing }).count();
    expect(
      modalStillOpen > 0 || errorVisible > 0 || dupCountAfter === dupCountBefore,
      'Duplicate role name should be prevented',
    ).toBeTruthy();
  });

  test('IA-FM01-F03-TC04 Edit Role Details', async ({ page }) => {
    await ensureRole(page);
    const row = page.locator('tr', { hasText: ROLE_NAME }).first();
    await expect(row, 'Temp role from TC01 should exist').toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const input = page.getByPlaceholder(NAME_INPUT);
    const renamed = `${ROLE_NAME}_E`;
    await input.fill(renamed);
    await submitModal(page, /^Update$/);
    await expect(page.locator('table').getByText(renamed, { exact: false })).toBeVisible({ timeout: 10_000 });

    // revert the name
    const row2 = page.locator('tr', { hasText: renamed }).first();
    await row2.getByRole('button', { name: /^Edit$/ }).click();
    await page.getByPlaceholder(NAME_INPUT).fill(ROLE_NAME);
    await submitModal(page, /^Update$/);
  });

  test('IA-FM01-F03-TC05 View Role Details', async ({ page }) => {
    await ensureRole(page);
    const row = page.locator('tr', { hasText: ROLE_NAME }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const modal = page.locator('div.fixed.inset-0').first();
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/Role Name/i)).toBeVisible();
    await expect(modal.getByText(/^Active$/i)).toBeVisible();
    await closeModal(page);
  });

  test('IA-FM01-F03-TC06 Deactivate Role', async ({ page }) => {
    await ensureRole(page);
    const row = page.locator('tr', { hasText: ROLE_NAME }).first();
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    await expect(active).toBeVisible();
    if (await active.isChecked()) await active.uncheck();
    await submitModal(page, /^Update$/);
    // re-open and confirm it is now unchecked
    const row2 = page.locator('tr', { hasText: ROLE_NAME }).first();
    await row2.getByRole('button', { name: /^Edit$/ }).click();
    await expect(page.locator('div.fixed.inset-0 input[type="checkbox"]').first()).not.toBeChecked();
    await closeModal(page);
  });

  test('IA-FM01-F03-TC07 Reactivate Role', async ({ page }) => {
    await ensureRole(page);
    const row = page.locator('tr', { hasText: ROLE_NAME }).first();
    await row.getByRole('button', { name: /^Edit$/ }).click();
    const active = page.locator('div.fixed.inset-0 input[type="checkbox"]').first();
    await expect(active).toBeVisible();
    if (!(await active.isChecked())) await active.check();
    await submitModal(page, /^Update$/);
    const row2 = page.locator('tr', { hasText: ROLE_NAME }).first();
    await row2.getByRole('button', { name: /^Edit$/ }).click();
    await expect(page.locator('div.fixed.inset-0 input[type="checkbox"]').first()).toBeChecked();
    await closeModal(page);
  });

  for (const tc of [
    { id: 'IA-FM01-F03-TC08', title: 'Assign Permission to Role' },
    { id: 'IA-FM01-F03-TC09', title: 'Assign Multiple Permissions' },
    { id: 'IA-FM01-F03-TC10', title: 'Remove Permission' },
    { id: 'IA-FM01-F03-TC11', title: 'Remove All Permissions' },
  ]) {
    test(`${tc.id} ${tc.title}`, async ({ page }) => {
      await ensureRole(page);
      const row = page.locator('tr', { hasText: ROLE_NAME }).first();
      await row.getByRole('button', { name: /^Edit$/ }).click();
      await expect(page.locator('div.fixed.inset-0')).toBeVisible();
      // A permission editor would expose permission text and multiple toggles beyond the single "Active" switch.
      const permissionText = await page.locator('div.fixed.inset-0').getByText(/permission/i).count().catch(() => 0);
      const toggles = await page.locator('div.fixed.inset-0 input[type="checkbox"]').count().catch(() => 0);
      await closeModal(page);
      expect(
        permissionText > 0 || toggles > 1,
        'No permission-assignment UI is present in the role editor (only an Active toggle exists)',
      ).toBeTruthy();
    });
  }
});
