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

| Area | Spec file | Tag |
|------|-----------|-----|
| Sign-in shell, OAuth redirect | `[tests/admin-portal-signin.spec.ts](tests/admin-portal-signin.spec.ts)` | CI + `@live` for credential flows |
| Shared OAuth / login helpers | `[tests/auth-flow.ts](tests/auth-flow.ts)` | imported by specs |
| Instance admin dashboard (post-login metrics on `/isoko/association`) | `[tests/admin-portal-instance-dashboard.spec.ts](tests/admin-portal-instance-dashboard.spec.ts)` | `@live` only |

UI mode:

```bash
npx playwright test --ui
```

## Refresh selectors (codegen)

The hosted OAuth form may change wording or semantics. Capture stable locators with:

```bash
npm run codegen
```

Interact with **Continue with Admin OAuth**, complete the authorize step, then copy `getByRole` / `getByPlaceholder` output into `[tests/auth-flow.ts](tests/auth-flow.ts)` (`fillOAuthPasswordForm`).

The bundled admin portal exposes `api.dev.isoko.africa/v1/oauth2/*` endpoints — those selectors mirror the shared email/phone credential layout used elsewhere; refresh them locally if copy changes upstream.

## Notes

The browser hits `**/v1/oauth2/authorize`** on `OAUTH_BASE_URL`, then the IdP may redirect to **`/v1/oauth2/login`** before returning to the admin app. After a successful code exchange the SPA routes to **`/isoko/association`** (instance admin dashboard).