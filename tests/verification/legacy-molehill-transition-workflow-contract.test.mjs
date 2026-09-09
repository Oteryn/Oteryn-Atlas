import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePlaywrightStableTestIds } from '../../tools/verification/parse-playwright-test-list.mjs';

test('Playwright stable-ID parser preserves UTF-8 and rejects duplicate identities', () => {
  const row = '  [desktop-chromium] › desktop.spec.mjs:1:1 › exact Unicode α evidence';
  const ids = parsePlaywrightStableTestIds(row);
  assert.deepEqual(JSON.parse(Buffer.from(JSON.stringify(ids), 'utf8').toString('utf8')), ids);
  assert.equal(ids.length, 1);
  assert.match(ids[0], /Unicode α evidence$/);
  assert.throws(() => parsePlaywrightStableTestIds(`${row}\n${row}`), /duplicate/);
});
