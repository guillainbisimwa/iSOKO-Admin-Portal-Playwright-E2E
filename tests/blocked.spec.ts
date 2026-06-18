import { test } from '@playwright/test';
import { BLOCKED_CASES } from './test-catalog';

/**
 * Blocked / not-automatically-executed cases. Registered as skipped so they appear in the report
 * (and in results.json) with the reason; scripts/fill-results.mjs records these as "Pending Testing"
 * plus the explanatory note in the workbook.
 */
test.describe('BLOCKED CASES (not auto-executed) @blocked', { tag: '@blocked' }, () => {
  for (const tc of BLOCKED_CASES) {
    test(`${tc.id} ${tc.title}`, () => {
      test.skip(true, tc.note ?? 'Blocked');
    });
  }
});
