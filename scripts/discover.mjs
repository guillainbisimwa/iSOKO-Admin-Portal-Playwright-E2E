import { chromium } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

const BASE = (process.env.PLAYWRIGHT_BASE_URL ?? 'https://isoko-admin-portal.vercel.app').replace(/\/$/, '');
const OAUTH_ORIGIN = new URL(process.env.OAUTH_BASE_URL ?? 'https://api.dev.isoko.africa').origin;
const EMAIL = process.env.ADMIN_SIGNIN_EMAIL || process.env.ISOKO_EMAIL || '';
const PASSWORD = process.env.ADMIN_SIGNIN_PASSWORD || process.env.ISOKO_PASSWORD || '';

const outDir = path.join(root, 'reports');
const shotDir = path.join(outDir, 'discovery-shots');
fs.mkdirSync(shotDir, { recursive: true });
const log = (...a) => console.log('[discover]', ...a);
const shot = async (page, name) => { try { await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true }); } catch {} };

async function snapshot(page) {
  await page.waitForTimeout(1500);
  return {
    url: page.url(),
    h1: (await page.locator('h1').allInnerTexts().catch(() => [])).map(s => s.trim()),
    headings: (await page.locator('h1,h2,h3').allInnerTexts().catch(() => [])).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 15),
    tables: await page.locator('table').count().catch(() => 0),
    bodyRows: await page.locator('table tbody tr').count().catch(() => 0),
    searchPlaceholders: await page.locator('input[placeholder]').evaluateAll(els => els.map(e => e.getAttribute('placeholder'))).catch(() => []),
    buttons: (await page.getByRole('button').allInnerTexts().catch(() => [])).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 30),
    links: (await page.getByRole('link').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean).slice(0, 30),
    tabs: (await page.getByRole('tab').allInnerTexts().catch(() => [])).map(s => s.trim()).filter(Boolean),
    comboboxes: await page.getByRole('combobox').count().catch(() => 0),
    selects: await page.locator('select').count().catch(() => 0),
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const result = { base: BASE, loginOk: false, finalUrl: '', nav: [], routes: {}, error: null };

try {
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('a, button').filter({ hasText: /Continue with Admin OAuth/i }).first().click({ timeout: 20000 });
  await page.waitForURL(u => new URL(u).origin === OAUTH_ORIGIN, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/email or phone/i).or(page.locator('input[type="email"], input[name="email"], input[type="text"]').first()).first().fill(EMAIL, { timeout: 15000 });
  await page.locator('input[type="password"]').first().fill(PASSWORD, { timeout: 10000 });
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).first().click();
  await page.waitForURL(u => { try { const x = new URL(u); return x.origin === new URL(BASE).origin && x.origin !== OAUTH_ORIGIN; } catch { return false; } }, { timeout: 90000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  result.loginOk = true;
  result.finalUrl = page.url();
  log('logged in ->', result.finalUrl);
  await shot(page, '00-dashboard');

  // sidebar nav link texts
  const navLinks = await page.locator('nav a, aside a').all();
  const navTexts = [];
  for (const l of navLinks) {
    const t = (await l.innerText().catch(() => '')).trim().replace(/\s+/g, ' ');
    const href = await l.getAttribute('href').catch(() => null);
    if (t && href && href.startsWith('/')) navTexts.push({ text: t, href });
  }
  result.nav = navTexts;
  log('nav', navTexts.map(n => n.text).join(' | '));

  // dashboard snapshot
  result.routes['__dashboard__'] = await snapshot(page);

  // click each nav item (client-side routing)
  for (const n of navTexts) {
    try {
      const link = page.locator('nav a, aside a').filter({ hasText: new RegExp(`^${n.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
      await link.click({ timeout: 10000 });
      await page.waitForTimeout(2000);
      const snap = await snapshot(page);
      result.routes[n.text] = snap;
      await shot(page, `nav-${n.text.replace(/[^a-z0-9]+/gi, '_')}`);
      log('clicked', n.text, '->', snap.url, 'rows', snap.bodyRows, 'btns', snap.buttons.slice(0, 6).join(','));
    } catch (e) {
      result.routes[n.text] = { error: String(e).slice(0, 200) };
      log('FAIL', n.text, String(e).slice(0, 80));
    }
  }
} catch (e) {
  result.error = String(e);
  await shot(page, 'ERROR');
  log('ERROR', e);
} finally {
  fs.writeFileSync(path.join(outDir, 'discovery.json'), JSON.stringify(result, null, 2));
  await browser.close();
  log('wrote reports/discovery.json');
}
