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
const log = (...a) => console.log('[edit]', ...a);
const shot = async (p, n) => { try { await p.screenshot({ path: path.join(shotDir, `${n}.png`), fullPage: true }); } catch {} };

async function dump(page) {
  return {
    url: page.url(),
    inputs: await page.locator('input, textarea').evaluateAll(els => els.map(e => ({ type: e.getAttribute('type'), placeholder: e.getAttribute('placeholder'), checked: e.checked, role: e.getAttribute('role') }))).catch(() => []),
    checkboxes: await page.locator('input[type="checkbox"], [role="switch"], [role="checkbox"]').count().catch(() => 0),
    buttons: (await page.getByRole('button').allInnerTexts().catch(() => [])).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
    labels: (await page.locator('label').allInnerTexts().catch(() => [])).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 40),
    modalText: (await page.locator('div.fixed.inset-0').first().innerText().catch(() => '')).slice(0, 1200),
  };
}
async function closeModal(page) {
  const c = page.getByRole('button', { name: /^(Cancel|Close)$/i }).first();
  if (await c.count().catch(() => 0)) await c.click().catch(() => {});
  await page.waitForTimeout(500);
}
async function nav(page, text) {
  await closeModal(page);
  await page.locator('nav a, aside a').filter({ hasText: new RegExp(`^${text}$`, 'i') }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const out = {};
try {
  await page.goto(`${BASE}/signin`, { waitUntil: 'domcontentloaded' });
  await page.locator('a, button').filter({ hasText: /Continue with Admin OAuth/i }).first().click({ timeout: 20000 });
  await page.waitForURL(u => new URL(u).origin === OAUTH_ORIGIN, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder(/email or phone/i).or(page.locator('input[type="email"], input[name="email"], input[type="text"]').first()).first().fill(EMAIL, { timeout: 15000 });
  await page.locator('input[type="password"]').first().fill(PASSWORD, { timeout: 10000 });
  await page.getByRole('button', { name: /sign in|log ?in|continue/i }).first().click();
  await page.waitForURL(u => { try { const x = new URL(u); return x.origin === new URL(BASE).origin && x.origin !== OAUTH_ORIGIN; } catch { return false; } }, { timeout: 90000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  log('logged in');

  await nav(page, 'Roles');
  await page.getByRole('button', { name: /^Edit$/ }).first().click(); await page.waitForTimeout(1800);
  out.editRole = await dump(page); await shot(page, 'edit-role');

  await nav(page, 'Location Levels');
  await page.getByRole('button', { name: /^Edit$/ }).first().click(); await page.waitForTimeout(1800);
  out.editLevel = await dump(page); await shot(page, 'edit-level');

  await nav(page, 'Locations');
  await page.getByRole('button', { name: /^Edit$/ }).first().click(); await page.waitForTimeout(1800);
  out.editLocation = await dump(page); await shot(page, 'edit-location');
} catch (e) {
  out.error = String(e).slice(0, 300);
  await shot(page, 'edit-ERROR');
} finally {
  fs.writeFileSync(path.join(outDir, 'discovery-edit.json'), JSON.stringify(out, null, 2));
  await browser.close();
  log('wrote reports/discovery-edit.json');
}
