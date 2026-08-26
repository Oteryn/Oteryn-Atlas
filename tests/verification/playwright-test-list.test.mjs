import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePlaywrightStableTestIds } from '../../tools/verification/parse-playwright-test-list.mjs';

test('Playwright list parser emits sorted path-normalized stable IDs', () => {
  const ids = parsePlaywrightStableTestIds(`Listing tests:\n  [mobile-chromium] › mobile.spec.mjs:10:1 › mobile FullWorld exposes drawers\n  [desktop-chromium] › desktop.spec.mjs:10:1 › desktop FullWorld qualifies\nTotal: 2 tests in 2 files\n`);
  assert.deepEqual(ids, [
    'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop FullWorld qualifies',
    'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile FullWorld exposes drawers',
  ]);
});

test('Playwright list parser rejects an empty or duplicate census', () => {
  assert.throws(() => parsePlaywrightStableTestIds('Listing tests:\nTotal: 0 tests\n'), /contains no scenarios/);
  assert.throws(() => parsePlaywrightStableTestIds(`  [desktop-chromium] › desktop.spec.mjs:10:1 › title\n  [desktop-chromium] › desktop.spec.mjs:10:1 › title\n`), /duplicate stable IDs/);
});
