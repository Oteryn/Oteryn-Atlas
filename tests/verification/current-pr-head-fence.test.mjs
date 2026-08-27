import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCurrentPrHead } from '../../tools/verification/assert-current-pr-head.mjs';

const expected = 'a'.repeat(40);

function payload(overrides = {}) {
  return {
    number: 206,
    base: { repo: { full_name: 'Oteryn/Oteryn-Atlas' } },
    head: { sha: expected },
    ...overrides,
  };
}

test('current PR head fence accepts only the exact expected head', () => {
  const result = assertCurrentPrHead(payload(), {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: expected,
  });
  assert.deepEqual(result, {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: expected,
    currentHeadSha: expected,
    status: 'current',
  });
});

test('current PR head fence rejects a superseded workflow head', () => {
  assert.throws(() => assertCurrentPrHead(payload({ head: { sha: 'b'.repeat(40) } }), {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: expected,
  }), /superseded PR head/);
});

test('current PR head fence rejects payload identity mismatches', () => {
  assert.throws(() => assertCurrentPrHead(payload({ number: 207 }), {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: expected,
  }), /PR number/);
  assert.throws(() => assertCurrentPrHead(payload({ base: { repo: { full_name: 'Other/Repo' } } }), {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: expected,
  }), /repository/);
});

test('current PR head fence fails closed on malformed input', () => {
  assert.throws(() => assertCurrentPrHead({}, {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: expected,
  }));
  assert.throws(() => assertCurrentPrHead(payload(), {
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    expectedHeadSha: 'not-a-sha',
  }), /expectedHeadSha/);
});
