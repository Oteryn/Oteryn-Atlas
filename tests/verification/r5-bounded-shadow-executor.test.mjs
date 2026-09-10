import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { planShadow } from '../../tools/verification/run-verification-shadow.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const baseSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const treeSha = 'c'.repeat(40);

function candidate(path) {
  return {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 187,
    baseSha,
    headSha,
    treeSha,
    changedFiles: [{ path, status: 'modified' }],
  };
}

test('R5 shadow plans hosted bounded depth groups instead of rejecting them by group id', () => {
  for (const path of [
    'e2e/tests/performance-desktop.spec.mjs',
    'e2e/tests/soak-desktop.spec.mjs',
    'e2e/tests/stress-desktop.spec.mjs',
  ]) {
    assert.doesNotThrow(
      () => planShadow({ candidate: candidate(path), root, protectedRoot: root }),
      path,
    );
  }
});

test('R5 shadow remains fail-closed for specialist real-fullworld execution', () => {
  assert.throws(
    () => planShadow({
      candidate: candidate('e2e/tests/fullworld-animation-census-desktop.spec.mjs'),
      root,
      protectedRoot: root,
    }),
    /executor unavailable|real[_ -]?fullworld|specialist/i,
  );
});
