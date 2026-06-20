import { test, expect, ensureLoggedIn, gotoSection } from './portal';

/** DASHBOARD AND NAVIGATION MENU ACCESS section. */
test.describe('DASHBOARD AND NAVIGATION @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
  });

  test('IA-AL01-F02-TC01 Dashboard Metrics Load Correctly', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /Associations/i })).toBeVisible();
    // Metric cards on the association admin dashboard.
    await expect(page.getByText('Total Associations')).toBeVisible();
    await expect(page.getByText('Active Associations')).toBeVisible();
    await expect(page.getByText('Pending Approval')).toBeVisible();

    // At least one metric renders a numeric value.
    const metricNumbers = await page
      .locator('text=/^\\d[\\d,]*$/')
      .count()
      .catch(() => 0);
    expect(metricNumbers).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: /Associations Management/i })).toBeVisible();
  });

  test('IA-AL01-F02-TC02 View top rated items', async ({ page }) => {
    // Expected by the spec: dashboard surfaces "top rated" associations/sellers/products.
    const topRated = page.getByText(/top[-\s]?rated|top sellers|top products|highest rated/i);
    await expect(
      topRated.first(),
      'No "top rated" section is present on the instance admin dashboard',
    ).toBeVisible({ timeout: 8000 });
  });

  test('IA-AL01-F02-TC03 Access to Authorized Sections', async ({ page }) => {
    // Instance admin should reach the core management areas. The sidebar groups several of these
    // under collapsible menus ("Users & Roles", "Locations", ...), so we verify reachability by
    // navigating to each section and confirming its page heading rather than relying on a flat link.
    const sections: Array<[string, RegExp]> = [
      ['Users', /Users/i],
      ['Orders', /Orders/i],
      ['Roles', /Roles/i],
      ['Locations', /Locations/i],
    ];
    for (const [label, headingRx] of sections) {
      await gotoSection(page, label, headingRx);
      await expect(
        page.getByRole('heading', { level: 1, name: headingRx }),
        `Authorized section "${label}" should load`,
      ).toBeVisible();
    }
  });
});
