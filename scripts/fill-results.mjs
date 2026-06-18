import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SRC = process.env.SRC_XLSX ?? path.join(os.homedir(), 'Downloads', 'test-cases.xlsx');
const RESULTS = path.join(root, 'reports', 'results.json');
const OUT = path.join(root, 'reports', 'test-cases-filled.xlsx');
const SUMMARY = path.join(root, 'reports', 'SUMMARY.md');

// Columns in the source workbook.
const COL = { TESTER_RESULT: 7 /* G */, COMMENT: 9 /* I */, ACTUAL_COMPLETION: 15 /* O */, TESTING_DATE: 16 /* P */ };

// ---- load the test catalog (compiled on the fly from the TS source via a tiny parse) ----
// We import the catalog data directly by reading the TS file's exported array through a JSON mirror.
const catalog = await loadCatalog();

// ---- parse Playwright JSON results ----
const byId = new Map(); // id -> { status: 'passed'|'failed'|'skipped', message }
if (fs.existsSync(RESULTS)) {
  const data = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
  for (const spec of collectSpecs(data.suites ?? [])) {
    const id = (spec.title || '').trim().split(/\s+/)[0];
    if (!id) continue;
    const results = (spec.tests ?? []).flatMap(t => (t.results ?? []).map(r => r));
    const statuses = results.map(r => r.status);
    let status = 'failed';
    if (statuses.length && statuses.every(s => s === 'skipped')) status = 'skipped';
    else if (spec.ok) status = 'passed';
    const errObj = results.find(r => r.error || (r.errors && r.errors.length));
    let message = '';
    if (status === 'failed' && errObj) {
      const raw = errObj.error?.message || errObj.errors?.[0]?.message || '';
      message = stripAnsi(raw).split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
    } else if (status === 'skipped') {
      const ann = (spec.annotations || []).find(a => a.type === 'skip');
      message = ann?.description || '';
    }
    byId.set(id, { status, message });
  }
}

const today = new Date();

// ---- write into the workbook ----
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.worksheets[0];

const tally = {}; // section -> {pass, fail, blocked, pending}
const rowsByResult = { Pass: [], Fail: [], 'Pending Testing': [] };

for (const tc of catalog) {
  let testerResult = 'Pending Testing';
  let comment = '';

  const r = byId.get(tc.id);
  if (tc.mode === 'blocked') {
    testerResult = 'Pending Testing';
    comment = tc.note || (r?.message ?? 'Blocked - not auto-executed');
  } else if (r) {
    if (r.status === 'passed') {
      testerResult = 'Pass';
      comment = tc.checks
        ? `Pass - ${tc.checks}`
        : 'Pass - automated check passed against the live portal.';
    } else if (r.status === 'skipped') {
      testerResult = 'Pending Testing';
      const why = r.message || 'precondition not met';
      comment = tc.checks
        ? `Pending - ${tc.checks} Skipped at runtime: ${why}`
        : `Pending - skipped at runtime: ${why}`;
    } else {
      testerResult = 'Fail';
      const reason = tc.failReason || (tc.checks ? `${tc.checks} did not behave as expected` : 'automated check failed');
      comment = r.message ? `Fail - ${reason} (runtime: ${r.message})` : `Fail - ${reason}.`;
    }
  } else {
    testerResult = 'Pending Testing';
    comment = 'Not executed (no result captured - login/setup may have been skipped).';
  }

  const row = ws.getRow(tc.row);
  setCell(row, COL.TESTER_RESULT, testerResult);
  setCell(row, COL.COMMENT, comment);
  if (testerResult === 'Pass' || testerResult === 'Fail') {
    setDate(row, COL.ACTUAL_COMPLETION, today);
    setDate(row, COL.TESTING_DATE, today);
  }
  row.commit();

  const t = (tally[tc.section] = tally[tc.section] || { Pass: 0, Fail: 0, 'Pending Testing': 0 });
  t[testerResult] += 1;
  rowsByResult[testerResult].push(tc.id);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await wb.xlsx.writeFile(OUT);

// ---- summary ----
const totals = { Pass: 0, Fail: 0, 'Pending Testing': 0 };
let md = `# iSOKO Admin Portal - Test Execution Summary\n\n`;
md += `- Source workbook: \`${SRC}\`\n`;
md += `- Filled workbook: \`reports/test-cases-filled.xlsx\`\n`;
md += `- Run date: ${today.toISOString().slice(0, 10)}\n`;
md += `- Total cases: ${catalog.length}\n\n`;
md += `| Section | Pass | Fail | Pending/Blocked |\n|---|---:|---:|---:|\n`;
for (const [section, t] of Object.entries(tally)) {
  totals.Pass += t.Pass;
  totals.Fail += t.Fail;
  totals['Pending Testing'] += t['Pending Testing'];
  md += `| ${section} | ${t.Pass} | ${t.Fail} | ${t['Pending Testing']} |\n`;
}
md += `| **TOTAL** | **${totals.Pass}** | **${totals.Fail}** | **${totals['Pending Testing']}** |\n`;
fs.writeFileSync(SUMMARY, md);

console.log('Filled workbook ->', OUT);
console.log(`Pass: ${totals.Pass}  Fail: ${totals.Fail}  Pending/Blocked: ${totals['Pending Testing']}  (of ${catalog.length})`);
console.log('Summary ->', SUMMARY);

// ---------------- helpers ----------------
function setCell(row, col, value) {
  const cell = row.getCell(col);
  cell.value = value;
}
function setDate(row, col, date) {
  const cell = row.getCell(col);
  cell.value = new Date(date);
  cell.numFmt = 'yyyy-mm-dd';
}
function stripAnsi(s) {
  return String(s).replace(/\u001b\[[0-9;]*m/g, '');
}
function collectSpecs(suites, acc = []) {
  for (const s of suites) {
    if (s.specs) acc.push(...s.specs);
    if (s.suites) collectSpecs(s.suites, acc);
  }
  return acc;
}

async function loadCatalog() {
  // Read the TS catalog and evaluate the TEST_CASES array literal safely.
  const tsPath = path.join(root, 'tests', 'test-catalog.ts');
  const src = fs.readFileSync(tsPath, 'utf8');
  const start = src.indexOf('export const TEST_CASES');
  // Skip past the type annotation (TestCase[]) to the actual array assignment.
  const arrStart = src.indexOf('= [', start) + 2;
  // find matching closing bracket for the array
  let depth = 0;
  let end = -1;
  for (let i = arrStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const arrLiteral = src.slice(arrStart, end + 1);
  // The literal references constant note strings; expose them by extracting their definitions.
  const constDefs = [...src.matchAll(/const (BLOCK_[A-Z_]+)\s*=\s*\n?\s*'([^']*)';/g)]
    .map(m => `const ${m[1]} = ${JSON.stringify(m[2])};`)
    .join('\n');
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${constDefs}\nreturn ${arrLiteral};`);
  return fn();
}
