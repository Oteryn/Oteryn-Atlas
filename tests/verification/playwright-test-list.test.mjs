import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { normalizeSummaryScenario } from '../../e2e/summary-reporter.mjs';
import { parsePlaywrightStableTestIds } from '../../tools/verification/parse-playwright-test-list.mjs';

test('Playwright list parser emits sorted path-normalized stable IDs', () => {
  const ids = parsePlaywrightStableTestIds(`Listing tests:\n  [mobile-chromium] › mobile.spec.mjs:10:1 › mobile FullWorld exposes drawers\n  [desktop-chromium] › desktop.spec.mjs:10:1 › desktop FullWorld qualifies\nTotal: 2 tests in 2 files\n`);
  assert.deepEqual(ids, [
    'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop FullWorld qualifies',
    'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile FullWorld exposes drawers',
  ]);
});

test('census and runtime reporter use the same stable-ID boundaries for long paths and titles', () => {
  const spec = `${'nested/'.repeat(80)}long-boundary.spec.mjs`;
  const title = `scenario ${'x'.repeat(700)}`;
  const ids = parsePlaywrightStableTestIds(`  [desktop-chromium] › ${spec}:10:1 › ${title}\n`);
  const scenario = normalizeSummaryScenario({
    project: 'desktop-chromium',
    file: `C:\\work\\Oteryn-Atlas\\e2e\\tests\\${spec.replaceAll('/', '\\')}`,
    title,
    status: 'passed',
    durationMs: 1,
    retry: 0,
  });

  assert.equal(ids[0], scenario.stableTestId);
});

test('Playwright list parser rejects an empty or duplicate census', () => {
  assert.throws(() => parsePlaywrightStableTestIds('Listing tests:\nTotal: 0 tests\n'), /contains no scenarios/);
  assert.throws(() => parsePlaywrightStableTestIds(`  [desktop-chromium] › desktop.spec.mjs:10:1 › title\n  [desktop-chromium] › desktop.spec.mjs:10:1 › title\n`), /duplicate stable IDs/);
});


test('Playwright list parser CLI uses a platform-safe file URL entrypoint', () => {
  const moduleUrl = new URL('../../tools/verification/parse-playwright-test-list.mjs', import.meta.url);
  const source = fs.readFileSync(moduleUrl, 'utf8');
  assert.match(source, /pathToFileURL/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-playwright-list-'));
  const input = path.join(dir, 'list.txt');
  try {
    fs.writeFileSync(input, '  [desktop-chromium] › desktop.spec.mjs:10:1 › desktop FullWorld qualifies\n');
    const output = execFileSync(process.execPath, [fileURLToPath(moduleUrl), input], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(output), [
      'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop FullWorld qualifies',
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
