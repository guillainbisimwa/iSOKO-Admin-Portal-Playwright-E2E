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
- **Including live login / negative OAuth tests** (`@live` — requires credentials in `.env`):
  ```bash
  npm run test:live
  ```

UI mode:

```bash
npx playwright test --ui
```

## Refresh selectors (codegen)

The hosted OAuth form may change wording or semantics. Capture stable locators with:

```bash
npm run codegen
```

Interact with **Continue with Admin OAuth**, complete the authorize step, then copy `getByRole` / `getByPlaceholder` output into `[tests/admin-portal-signin.spec.ts](tests/admin-portal-signin.spec.ts)`.

The bundled admin portal exposes `api.dev.isoko.africa/v1/oauth2/*` endpoints — the OAuth form selectors in `[fillOAuthPasswordForm](tests/admin-portal-signin.spec.ts)` mirror the shared email/phone credential layout used elsewhere; refresh them locally if copy changes upstream.

## Notes

Authorize path is `**/v1/oauth2/authorize`** on the configured `OAUTH_BASE_URL`; this matches the admin portal frontend bundle shipped at the time these tests were added.