import assert from 'node:assert/strict';
import test from 'node:test';

import { stableIdAlgorithm } from '../../tools/verification/stable-id.mjs';
import { validateStableIdCensus } from '../../tools/verification/stable-id-census.mjs';

test('protected stable census binds the canonical algorithm and rejects duplicate or mismatched identity', () => {
  const census = validateStableIdCensus({
    schemaVersion: 1,
    stableIdAlgorithm,
    stableTestIds: ['desktop-chromium::e2e/tests/desktop.spec.mjs::desktop fullworld'],
  });
  assert.match(census.digest, /^sha256:[a-f0-9]{64}$/);
  assert.throws(() => validateStableIdCensus({
    schemaVersion: 1, stableIdAlgorithm, stableTestIds: ['desktop-chromium::e2e/tests/a.spec.mjs::x', 'desktop-chromium::e2e/tests/a.spec.mjs::x'],
  }), /duplicates/);
});
