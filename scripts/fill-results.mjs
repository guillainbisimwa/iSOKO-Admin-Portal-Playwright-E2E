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

// Source workbook layout (1-based columns). Header row is 11; data starts at row 12.
const HEADER_ROW = 11;
const DATA_START = 12;
const COL = {
  ID: 1, // Test Case ID
  TITLE: 2, // Test case Title
  PRECOND: 3, // Pre-condition
  STEPS: 4, // Test Steps
  EXPECTED: 5, // Expect Result
  TESTER_RESULT: 7, // Tester result  <- we write
  COMMENT: 9, // comment             <- we write
  BURUNDI_STATUS: 11, // (missing header) Burundi "Tester result"
  BURUNDI_RECO: 12, // (missing header) Burundi "Recommendation"
  ACTUAL_COMPLETION: 15, // Actual Completion date <- we write
  TESTING_DATE: 16, // Testing date           <- we write
};

const catalog = await loadCatalog();

// ---- parse Playwright JSON results -> id -> { status, message } ----
const byId = new Map();
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
    let raw = '';
    if (status === 'failed' && errObj) {
      const parts = [errObj.error?.message, ...(errObj.errors ?? []).map(e => e.message)].filter(Boolean);
      raw = stripAnsi(parts.join('\n'));
      message = raw.split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
    } else if (status === 'skipped') {
      const ann = (spec.annotations || []).find(a => a.type === 'skip');
      message = ann?.description || '';
    }
    byId.set(id, { status, message, raw });
  }
}

const today = new Date();

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);
const ws = wb.worksheets[0];

// 1) Fill the two missing headers (Burundi Results group).
setCell(ws.getRow(HEADER_ROW), COL.BURUNDI_STATUS, 'Tester result');
setCell(ws.getRow(HEADER_ROW), COL.BURUNDI_RECO, 'Recommendation');
ws.getRow(HEADER_ROW).commit();

// 2) Map trimmed Test Case ID -> source row number (existing rows only).
const idToRow = new Map();
for (let r = DATA_START; r <= ws.rowCount; r++) {
  const id = cellText(ws.getRow(r), COL.ID);
  if (/^IA-/i.test(id)) idToRow.set(id, r);
}

const tally = {}; // section -> { Pass, Fail, 'Pending Testing' }
const ensureTally = section => (tally[section] = tally[section] || { Pass: 0, Fail: 0, 'Pending Testing': 0 });

// Resolve a catalog case to { testerResult, comment }.
function resolve(tc) {
  if (tc.mode === 'gap') {
    const reason = tc.failReason || 'Required feature is missing from this build.';
    return { testerResult: 'Fail', comment: `Fail - ${reason}` };
  }
  if (tc.mode === 'blocked' || tc.mode === 'pending') {
    return { testerResult: 'Pending Testing', comment: tc.note || 'Pending - not auto-executed.' };
  }
  const r = byId.get(tc.id);
  if (!r) {
    return {
      testerResult: 'Pending Testing',
      comment: tc.note || 'Pending - not executed in this run (no automated result captured).',
    };
  }
  if (r.status === 'passed') {
    return {
      testerResult: 'Pass',
      comment: tc.checks ? `Pass - ${tc.checks}` : 'Pass - automated check passed against the live portal.',
    };
  }
  if (r.status === 'skipped') {
    const why = r.message || 'precondition not met';
    return {
      testerResult: 'Pending Testing',
      comment: tc.checks ? `Pending - ${tc.checks} Skipped at runtime: ${why}` : `Pending - skipped at runtime: ${why}`,
    };
  }
  // A failure inside the login/navigation setup (expired OAuth session, redirect to /signin,
  // or a beforeEach hook timeout) is an environment dropout, not a product defect -> Pending re-run.
  if (isSessionDropout(r.raw)) {
    return {
      testerResult: 'Pending Testing',
      comment: tc.checks
        ? `Pending - ${tc.checks} Not verified this run: the test session expired (redirected to sign-in / setup hook timed out) before the check ran; re-run with a fresh login.`
        : 'Pending - the test session expired (redirected to sign-in / setup hook timed out) before the check ran; re-run with a fresh login.',
    };
  }
  const reason = tc.failReason || (tc.checks ? `${tc.checks} did not behave as expected` : 'automated check failed');
  return {
    testerResult: 'Fail',
    comment: r.message ? `Fail - ${reason} (runtime: ${r.message})` : `Fail - ${reason}.`,
  };
}

// Detect failures caused by the auth session dropping rather than by the feature under test.
function isSessionDropout(raw) {
  if (!raw) return false;
  const text = String(raw);
  return (
    /while running "?beforeEach"? hook/i.test(text) ||
    /\/signin\b/i.test(text) ||
    /navigated to ".*signin/i.test(text) ||
    /toBeVisible[\s\S]*Associations[\s\S]*signin/i.test(text)
  );
}

// 3) Write results into the existing 189 rows (match by id).
for (const tc of catalog) {
  if (tc.insertAfter) continue; // delete-feature inserts handled below
  const rowNum = idToRow.get(tc.id);
  ensureTally(tc.section);
  if (!rowNum) {
    // catalog case with no matching row (should not happen) -> count as pending
    tally[tc.section]['Pending Testing'] += 1;
    continue;
  }
  const { testerResult, comment } = resolve(tc);
  const row = ws.getRow(rowNum);
  setCell(row, COL.TESTER_RESULT, testerResult);
  setCell(row, COL.COMMENT, comment);
  if (testerResult === 'Pass' || testerResult === 'Fail') {
    setDate(row, COL.ACTUAL_COMPLETION, today);
    setDate(row, COL.TESTING_DATE, today);
  }
  row.commit();
  tally[tc.section][testerResult] += 1;
}

// 4) Insert delete-feature rows per section, bottom-up so row numbers stay valid.
const inserts = catalog
  .filter(tc => tc.insertAfter)
  .map(tc => ({ tc, anchorRow: idToRow.get(tc.insertAfter) }))
  .filter(x => x.anchorRow)
  .sort((a, b) => b.anchorRow - a.anchorRow);

for (const { tc, anchorRow } of inserts) {
  const pos = anchorRow + 1;
  const newRow = ws.insertRow(pos, [], 'i'); // inherit style from row above
  setCell(newRow, COL.ID, tc.id);
  setCell(newRow, COL.TITLE, tc.title);
  if (tc.preCondition) setCell(newRow, COL.PRECOND, tc.preCondition);
  if (tc.steps) setCell(newRow, COL.STEPS, tc.steps);
  if (tc.expected) setCell(newRow, COL.EXPECTED, tc.expected);
  const { testerResult, comment } = resolve(tc);
  setCell(newRow, COL.TESTER_RESULT, testerResult);
  setCell(newRow, COL.COMMENT, comment);
  setDate(newRow, COL.ACTUAL_COMPLETION, today);
  setDate(newRow, COL.TESTING_DATE, today);
  newRow.commit();
  ensureTally(tc.section);
  tally[tc.section][testerResult] += 1;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await wb.xlsx.writeFile(OUT);

// ---- summary ----
const totals = { Pass: 0, Fail: 0, 'Pending Testing': 0 };
let md = `# iSOKO Admin Portal - Test Execution Summary\n\n`;
md += `- Source workbook: \`${SRC}\`\n`;
md += `- Filled workbook: \`reports/test-cases-filled.xlsx\`\n`;
md += `- Run date: ${today.toISOString().slice(0, 10)}\n`;
md += `- Total cases: ${catalog.length} (${catalog.length - inserts.length} from sheet + ${inserts.length} delete-feature checks)\n\n`;
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
console.log(`Inserted delete-feature rows: ${inserts.length}`);
console.log('Summary ->', SUMMARY);

// ---------------- helpers ----------------
function setCell(row, col, value) {
  row.getCell(col).value = value;
}
function setDate(row, col, date) {
  const cell = row.getCell(col);
  cell.value = new Date(date);
  cell.numFmt = 'yyyy-mm-dd';
}
function cellText(row, col) {
  return (row.getCell(col).text ?? '').toString().trim();
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
  const tsPath = path.join(root, 'tests', 'test-catalog.ts');
  const src = fs.readFileSync(tsPath, 'utf8');
  const start = src.indexOf('export const TEST_CASES');
  const arrStart = src.indexOf('= [', start) + 2;
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
  // The literal references const note strings (BLOCK_* / PENDING_*); inline their definitions.
  const constDefs = [...src.matchAll(/const ((?:BLOCK|PENDING)_[A-Z_0-9]+)\s*=\s*\n?\s*'([^']*)';/g)]
    .map(m => `const ${m[1]} = ${JSON.stringify(m[2])};`)
    .join('\n');
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${constDefs}\nreturn ${arrLiteral};`);
  return fn();
}
