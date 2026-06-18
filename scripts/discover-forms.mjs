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
const log = (...a) => console.log('[forms]', ...a);
const shot = async (p, n) => { try { await p.screenshot({ path: path.join(shotDir, `${n}.png`), fullPage: true }); } catch {} };

async function dumpControls(page) {
  return {
    url: page.url(),
    inputs: await page.locator('input, textarea').evaluateAll(els => els.map(e => ({ tag: e.tagName.toLowerCase(), type: e.getAttribute('type'), name: e.getAttribute('name'), placeholder: e.getAttribute('placeholder'), disabled: e.disabled, readonly: e.readOnly }))).catch(() => []),
    selects: await page.locator('select').evaluateAll(els => els.map(e => ({ name: e.getAttribute('name') }))).catch(() => []),
    comboboxes: (await page.getByRole('combobox').count().catch(() => 0)),
    buttons: (await page.getByRole('button').allInnerTexts().catch(() => [])).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
    dialogHeadings: (await page.locator('[role="dialog"] h1, [role="dialog"] h2, [role="dialog"] h3').allInnerTexts().catch(() => [])).map(s => s.trim()),
    labels: (await page.locator('label').allInnerTexts().catch(() => [])).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 30),
  };
}

async function closeModal(page) {
  // custom modal overlay; close via Cancel/X, fall back to overlay click
  const cancel = page.getByRole('button', { name: /^(Cancel|Close)$/i }).first();
  if (await cancel.count().catch(() => 0)) {
    await cancel.click().catch(() => {});
  }
  await page.waitForTimeout(600);
  // if overlay still present, click top-left corner outside the panel
  const overlay = page.locator('div.fixed.inset-0').first();
  if (await overlay.count().catch(() => 0)) {
    await page.mouse.click(5, 5).catch(() => {});
    await page.waitForTimeout(400);
  }
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

  // USERS page detail
  await nav(page, 'Users');
  out.usersList = await dumpControls(page);
  // open first row View
  try {
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await page.waitForTimeout(2500);
    out.userDetail = await dumpControls(page);
    await shot(page, 'form-user-detail');
  } catch (e) { out.userDetail = { error: String(e).slice(0, 150) }; }

  // ROLES -> Add Role
  await nav(page, 'Roles');
  out.rolesList = await dumpControls(page);
  try {
    await page.getByRole('button', { name: /Add Role/i }).click();
    await page.waitForTimeout(2000);
    out.addRole = await dumpControls(page);
    await shot(page, 'form-add-role');
  } catch (e) { out.addRole = { error: String(e).slice(0, 150) }; }

  // LOCATION LEVELS -> Add Level
  await nav(page, 'Location Levels');
  try {
    await page.getByRole('button', { name: /Add Level/i }).click();
    await page.waitForTimeout(2000);
    out.addLevel = await dumpControls(page);
    await shot(page, 'form-add-level');
  } catch (e) { out.addLevel = { error: String(e).slice(0, 150) }; }

  // LOCATIONS -> Add Location
  await nav(page, 'Locations');
  try {
    await page.getByRole('button', { name: /Add Location/i }).click();
    await page.waitForTimeout(2000);
    out.addLocation = await dumpControls(page);
    await shot(page, 'form-add-location');
  } catch (e) { out.addLocation = { error: String(e).slice(0, 150) }; }

  // ASSOCIATIONS -> first View detail
  await nav(page, 'Associations');
  out.assocList = await dumpControls(page);
  try {
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await page.waitForTimeout(2500);
    out.assocDetail = await dumpControls(page);
    await shot(page, 'form-assoc-detail');
  } catch (e) { out.assocDetail = { error: String(e).slice(0, 150) }; }

  // ORDERS -> first View detail
  await nav(page, 'Orders');
  out.ordersList = await dumpControls(page);
  try {
    await page.getByRole('button', { name: /^View$/ }).first().click();
    await page.waitForTimeout(2500);
    out.orderDetail = await dumpControls(page);
    await shot(page, 'form-order-detail');
  } catch (e) { out.orderDetail = { error: String(e).slice(0, 150) }; }
} catch (e) {
  out.error = String(e);
  await shot(page, 'forms-ERROR');
} finally {
  fs.writeFileSync(path.join(outDir, 'discovery-forms.json'), JSON.stringify(out, null, 2));
  await browser.close();
  log('wrote reports/discovery-forms.json');
}
