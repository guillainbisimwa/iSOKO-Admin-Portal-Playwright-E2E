import { test, expect, ensureLoggedIn } from './portal';

/**
 * EMAIL AND SMS TEMPLATE CONFIGURATION section.
 * Only TC01 (view template list) is automated read-only; all edit cases are blocked (would change
 * live notification templates) and are handled in blocked.spec.ts.
 */
test.describe('EMAIL/SMS TEMPLATES @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('IA-FM01-F22-TC01 View list of email Templates', async ({ page }) => {
    const navLink = page
      .locator('nav a, aside a')
      .filter({ hasText: /template|email|notification|sms|messaging/i });
    const hasNav = (await navLink.count()) > 0;
    if (hasNav) {
      await navLink.first().click();
      await page.waitForTimeout(1500);
      await expect(page.locator('table, [role="list"]').first()).toBeVisible({ timeout: 10_000 });
      return;
    }
    expect(
      hasNav,
      'No Email/SMS template configuration section is exposed in the instance admin portal navigation',
    ).toBeTruthy();
  });
});
