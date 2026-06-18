import { test, expect, ensureLoggedIn, gotoSection, controlExists } from './portal';

/**
 * EXPORT USERLIST section. Every case depends on an export/download affordance on the Users list.
 * Each test verifies that affordance (and, for filtered variants, the relevant filter) is present.
 */
const EXPORT_RX = /export|download|\.xls|csv|spreadsheet/i;

const cases: Array<{ id: string; title: string; need: 'export' | 'export+filter'; filterRx?: RegExp }> = [
  { id: 'IA-FM01-F15-TC14', title: 'Export All Users', need: 'export' },
  { id: 'IA-FM01-F15-TC16', title: 'File Naming Convention', need: 'export' },
  { id: 'IA-FM01-F15-TC17', title: 'XLS File Opens Correctly', need: 'export' },
  { id: 'IA-FM01-F15-TC18', title: 'Header Row Validation', need: 'export' },
  { id: 'IA-FM01-F15-TC19', title: 'User Count Validation', need: 'export' },
  { id: 'IA-FM01-F15-TC20', title: 'Data Formatting Validation', need: 'export' },
  { id: 'IA-FM01-F15-TC21', title: 'Export Filtered by Location', need: 'export+filter', filterRx: /location|country/i },
  { id: 'IA-FM01-F15-TC22', title: 'Export Filtered by Association', need: 'export+filter', filterRx: /association/i },
  { id: 'IA-FM01-F15-TC23', title: 'Export Filtered by Role', need: 'export+filter', filterRx: /role/i },
  { id: 'IA-FM01-F15-TC24', title: 'Export Filtered by Status', need: 'export+filter', filterRx: /status|active|inactive/i },
  { id: 'IA-FM01-F15-TC25', title: 'Export Filtered by Date Range', need: 'export+filter', filterRx: /date|from|to|range/i },
  { id: 'IA-FM01-F15-TC26', title: 'Export with Multiple Filters', need: 'export+filter', filterRx: /filter/i },
  { id: 'IA-FM01-F15-TC27', title: 'Export Empty Result Set', need: 'export' },
];

test.describe('EXPORT USERLIST @live', { tag: '@live' }, () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedIn(page);
    await gotoSection(page, 'Users');
  });

  for (const c of cases) {
    test(`${c.id} ${c.title}`, async ({ page }) => {
      const hasExport = await controlExists(page, EXPORT_RX);
      expect(hasExport, 'No export/download control is present on the Users list').toBeTruthy();

      if (c.need === 'export+filter') {
        const hasFilter = await controlExists(page, c.filterRx!);
        expect(hasFilter, `No matching filter control (${c.filterRx}) on the Users list`).toBeTruthy();
      }
    });
  }
});
