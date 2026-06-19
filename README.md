# iSOKO Admin Portal — Playwright E2E

Minimal standalone suite for `[https://isoko-admin-portal.vercel.app/signin](https://isoko-admin-portal.vercel.app/signin)`.

## Prerequisites

Install browsers once:

```bash
npm install
npx playwright install
```

If the Playwright Chromium download fails (some networks block `cdn.playwright.dev`), install Google Chrome locally and temporarily point Playwright at the stable channel inside `use` (`channel: 'chrome'`) — see `[playwright.config.ts](playwright.config.ts)` comments — or vendor a local browser path following the Playwright “Google Chrome” channel docs.

## Configure

Copy `.env.example` to `.env` and adjust:

- `PLAYWRIGHT_BASE_URL` — admin app origin (defaults to production Vercel URL).
- `OAUTH_BASE_URL` — authorize host (defaults to `https://api.dev.isoko.africa`), must match redirects from the deployed admin portal.
- `ADMIN_SIGNIN_EMAIL` / `ADMIN_SIGNIN_PASSWORD` — optional; alternatively `ISOKO_EMAIL` / `ISOKO_PASSWORD` match naming used elsewhere.

Never commit `.env`.

## Running tests

- **Smoke + OAuth redirect only** (safe for CI, no secrets):
  ```bash
  npm run test:ci
  ```
- **Including live login, OAuth negative cases, and instance admin dashboard** (`@live` — requires credentials in `.env`):
  ```bash
  npm run test:live
  ```

### What runs where

The catalog covers **202** cases: **189** read from the source workbook (across 13 sections) plus
**13** delete-feature checks that are inserted per section (see "Delete-feature coverage" below).
Live automated specs run the read-only / reversible-write cases; each test title is prefixed with its
workbook TC ID (e.g. `IA-FM01-F01-TC01 ...`) so results map straight back to the Excel rows. Test Case
IDs are trimmed of the leading whitespace present in the source sheet.

| Area | Spec file |
|------|-----------|
| Shared OAuth / login helpers | `tests/auth-flow.ts` |
| One-time login + saved session (`storageState`) | `tests/auth.setup.ts` |
| Logged-in fixture + shared UI helpers | `tests/portal.ts` |
| Login (happy path, invalid password, guard) | `tests/login.spec.ts` |
| Dashboard metrics + nav access | `tests/dashboard-nav.spec.ts` |
| User management (list/search/view) | `tests/users.spec.ts` |
| Roles & permissions (reversible writes) | `tests/roles-permissions.spec.ts` |
| Locations & location levels (reversible writes) | `tests/locations.spec.ts` |
| User-list export | `tests/export-userlist.spec.ts` |
| Association management | `tests/associations.spec.ts` |
| Admin order management | `tests/orders.spec.ts` |
| Email/SMS templates | `tests/templates.spec.ts` |
| Blocked cases (registered as skips so they show in the report) | `tests/blocked.spec.ts` |
| Single source of truth for all TC metadata | `tests/test-catalog.ts` |

UI mode:

```bash
npx playwright test --ui
```

## Execute all test cases and fill the workbook

1. Run the full suite (generates `reports/results.json` and the HTML report):
   ```bash
   npm test
   ```
   The browser cache and a shared run stamp are picked up automatically; if Playwright cannot find
   its browsers, prefix with `PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"`.
2. Merge the results into a filled copy of the workbook:
   ```bash
   npm run fill
   ```
   This reads `reports/results.json` + `tests/test-catalog.ts` and writes:
   - `reports/test-cases-filled.xlsx` — a copy of the source sheet with column **G** Tester Result
     (`Pass` / `Fail` / `Pending Testing`), **I** comment, **O** actual completion date, **P** testing date.
   - `reports/SUMMARY.md` — per-section Pass / Fail / Pending counts.

   The source workbook defaults to `~/Downloads/test-cases.xlsx`; override with `SRC_XLSX=/path/to.xlsx`.
3. Or do both in one step:
   ```bash
   npm run run-and-fill
   ```

### Result classification

- **Pass / Fail** — automatically executed read-only or reversible-write checks. A genuinely missing
  UI element (e.g. no export button, no user filters) is recorded as **Fail** with an explanatory
  comment, never silently passed.
- **Pending Testing** — cases that need test data the primary admin cannot safely produce (deactivated
  admin login, non-admin login, bulk/irreversible/notification actions, 10k-row export, etc.), plus
  any case skipped at runtime because a precondition was not met. The four sections added in this
  revision (Product Category/Sub-category/Commodity, Service Category & Type, Measurement Unit &
  Metrics, Admin Product Listing) are recorded here for manual verification — the listing section is
  blocked because every action mutates live listings or fires notifications.

### Delete-feature coverage

The portal exposes no hard **Delete** anywhere (only Activate/Deactivate, or Approve/Suspend for
associations). To make this explicit, a `Delete <entity>` case is appended inside each section that
supports add/update/view (roles, users, location levels, locations, associations, categories,
sub-categories, commodities, service categories, service types, metrics, units, product listings).
These carry `mode: 'gap'` in the catalog and are written into the filled sheet as **Fail** with a
comment explaining the missing delete action.

Reversible-write tests create throwaway `E2E_TEMP_*` entities and **deactivate** them in cleanup
(the portal has no hard delete), using only the primary admin credentials.

## Viewing reports

- **Graphical (HTML):**
  ```bash
  npm run report
  ```
  opens `playwright-report/index.html`.
- **CLI:** the `list` reporter prints results during `npm test`; `reports/SUMMARY.md` holds the
  per-section tally.

## Refresh selectors (codegen)

The hosted OAuth form may change wording or semantics. Capture stable locators with:

```bash
npm run codegen
```

Interact with **Continue with Admin OAuth**, complete the authorize step, then copy `getByRole` / `getByPlaceholder` output into `[tests/auth-flow.ts](tests/auth-flow.ts)` (`fillOAuthPasswordForm`).

The bundled admin portal exposes `api.dev.isoko.africa/v1/oauth2/*` endpoints — those selectors mirror the shared email/phone credential layout used elsewhere; refresh them locally if copy changes upstream.

## Notes

The browser hits `**/v1/oauth2/authorize`** on `OAUTH_BASE_URL`, then the IdP may redirect to **`/v1/oauth2/login`** before returning to the admin app. After a successful code exchange the SPA routes to **`/isoko/association`** (instance admin dashboard).

npm test            # run the whole suite (writes results.json + HTML report)
npm run fill        # produce reports/test-cases-filled.xlsx + SUMMARY.md
npm run run-and-fill # both in one step
npm run report      # open the graphical HTML report