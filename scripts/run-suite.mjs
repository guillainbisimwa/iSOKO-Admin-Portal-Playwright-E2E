/**
 * Live suite runner that executes each spec file as a SEPARATE Playwright invocation.
 *
 * Why: the portal's OAuth access token lives only a few minutes. A single end-to-end run
 * (~12 min) outlives the token, so the session drops mid-run and later specs fail at the
 * login/navigation step. Running one spec at a time means every spec re-runs the `setup`
 * project (a fresh login) first and then finishes well inside the token lifetime.
 *
 * Each invocation writes its own JSON report into reports/partial/, and fill-results.mjs
 * merges them. Spec failures do not abort the batch.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const testsDir = path.join(root, 'tests');
const partialDir = path.join(root, 'reports', 'partial');

// Fresh partial dir each batch.
fs.rmSync(partialDir, { recursive: true, force: true });
fs.mkdirSync(partialDir, { recursive: true });

const specs = fs
  .readdirSync(testsDir)
  .filter(f => f.endsWith('.spec.ts'))
  .sort();

const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.env.HOME || '', 'Library/Caches/ms-playwright');

const summary = [];
for (const spec of specs) {
  const name = spec.replace(/\.spec\.ts$/, '');
  const jsonOut = path.join(partialDir, `${name}.json`);
  console.log(`\n=== Running ${spec} ===`);
  const res = spawnSync(
    'npx',
    ['playwright', 'test', '--project=setup', '--project=chromium', spec, '--reporter=json'],
    {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browsersPath,
        PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut,
      },
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  // The json reporter writes the file; spawn stdout also carries JSON when OUTPUT_NAME is unset.
  if (!fs.existsSync(jsonOut) && res.stdout) {
    try {
      JSON.parse(res.stdout);
      fs.writeFileSync(jsonOut, res.stdout);
    } catch {
      /* stdout was not JSON; reporter already wrote the file or the run errored */
    }
  }
  summary.push({ spec, exit: res.status });
  console.log(`--- ${spec} exit=${res.status}`);
}

console.log('\n==== Batch summary ====');
for (const s of summary) console.log(`${s.exit === 0 ? 'ok  ' : 'fail'} ${s.spec}`);
console.log(`\nPartial reports in ${partialDir}`);
