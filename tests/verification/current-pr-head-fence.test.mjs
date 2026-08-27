import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCurrentPrHead } from '../../tools/verification/assert-current-pr-head.mjs';

const expected = 'a'.repeat(40);
function payload(overrides = {}) {
  return { number: 190, base: { repo: { full_name: 'Oteryn/Oteryn-Atlas' } }, head: { sha: expected }, ...overrides };
}

test('current PR head fence accepts only the exact expected head', () => {
  assert.deepEqual(assertCurrentPrHead(payload(), { repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: expected }), {
    repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: expected, currentHeadSha: expected, status: 'current',
  });
});

test('current PR head fence rejects superseded and mismatched identities', () => {
  assert.throws(() => assertCurrentPrHead(payload({ head: { sha: 'b'.repeat(40) } }), { repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: expected }), /superseded/);
  assert.throws(() => assertCurrentPrHead(payload({ number: 191 }), { repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: expected }), /PR number/);
  assert.throws(() => assertCurrentPrHead(payload({ base: { repo: { full_name: 'Other/Repo' } } }), { repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: expected }), /repository/);
});

test('current PR head fence fails closed on malformed input', () => {
  assert.throws(() => assertCurrentPrHead({}, { repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: expected }));
  assert.throws(() => assertCurrentPrHead(payload(), { repository: 'Oteryn/Oteryn-Atlas', prNumber: 190, expectedHeadSha: 'not-a-sha' }), /expectedHeadSha/);
});
