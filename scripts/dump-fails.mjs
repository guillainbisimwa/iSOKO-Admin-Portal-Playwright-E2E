import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'reports', 'partial');

const target = process.argv[2]; // optional spec name filter

function collectSpecs(suites, acc = []) {
  for (const s of suites) {
    if (s.specs) acc.push(...s.specs);
    if (s.suites) collectSpecs(s.suites, acc);
  }
  return acc;
}
const stripAnsi = s => String(s).replace(/\u001b\[[0-9;]*m/g, '');

for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.json')) continue;
  if (target && !f.includes(target)) continue;
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const spec of collectSpecs(data.suites ?? [])) {
    const id = (spec.title || '').trim().split(/\s+/)[0];
    const results = (spec.tests ?? []).flatMap(t => t.results ?? []);
    const statuses = results.map(r => r.status);
    let status = 'failed';
    if (statuses.length && statuses.every(s => s === 'skipped')) status = 'skipped';
    else if (spec.ok) status = 'passed';
    if (status !== 'failed') continue;
    const errObj = results.find(r => r.error || (r.errors && r.errors.length));
    const raw = stripAnsi(errObj?.error?.message || errObj?.errors?.[0]?.message || '');
    const first = raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3).join(' | ');
    console.log(`[${f}] ${spec.title}\n    ${first}\n`);
  }
}
