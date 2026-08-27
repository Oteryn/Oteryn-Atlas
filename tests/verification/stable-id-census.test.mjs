import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  STABLE_TEST_ID_ALGORITHM,
  validateStableIdCensus,
} from '../../tools/verification/stable-id-census.mjs';

const expectedDigest = 'sha256:0240f75aaa5a72eedcf6066681c22dfcbd1402426f445232e03d8c0e25857d0a';

test('full safety-net census is exact, versioned and bound to the canonical stable-ID algorithm', () => {
  const census = JSON.parse(fs.readFileSync(new URL('../../tools/verification/full-safety-net-stable-ids.json', import.meta.url), 'utf8'));
  const result = validateStableIdCensus(census);

  assert.equal(result.algorithm.id, STABLE_TEST_ID_ALGORITHM.id);
  assert.equal(result.algorithm.version, STABLE_TEST_ID_ALGORITHM.version);
  assert.equal(result.count, 71);
  assert.equal(result.digest, expectedDigest);
  assert.deepEqual(result.stableTestIds, [...result.stableTestIds].sort());
});

test('stable-ID census rejects algorithm drift, duplicate IDs and forged digests', () => {
  const valid = {
    schemaVersion: 1,
    algorithm: STABLE_TEST_ID_ALGORITHM,
    stableTestIds: [
      'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop FullWorld qualifies',
      'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile FullWorld qualifies',
    ],
  };
  const accepted = validateStableIdCensus(valid);

  assert.throws(
    () => validateStableIdCensus({ ...valid, algorithm: { ...valid.algorithm, version: valid.algorithm.version + 1 } }),
    /algorithm identity mismatch/,
  );
  assert.throws(
    () => validateStableIdCensus({ ...valid, stableTestIds: [valid.stableTestIds[0], valid.stableTestIds[0]] }),
    /duplicate stable test ID/,
  );
  assert.throws(
    () => validateStableIdCensus({ ...valid, digest: accepted.digest.replace(/.$/, '0') }),
    /digest mismatch/,
  );
});
