import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProtectedFanIn } from '../../tools/verification/protected-fan-in-bootstrap.mjs';

const head = 'b'.repeat(40);
const planDigest = `sha256:${'1'.repeat(64)}`;
const plan = {
  candidateHeadSha: head,
  planDigest,
  stableTestIds: ['desktop::e2e/tests/a.spec.mjs::a', 'desktop::e2e/tests/b.spec.mjs::b'],
};

function shard(ids, overrides = {}) {
  return { status: 'success', candidateHeadSha: head, planDigest, executedStableTestIds: ids, ...overrides };
}

test('protected fan-in accepts only exact stable-ID set equality', () => {
  const result = validateProtectedFanIn(plan, [shard([plan.stableTestIds[0]]), shard([plan.stableTestIds[1]])]);
  assert.equal(result.status, 'success');
  assert.deepEqual(result.executedStableTestIds, plan.stableTestIds);
});

test('protected fan-in rejects missing, unexpected and duplicate IDs', () => {
  assert.throws(() => validateProtectedFanIn(plan, [shard([plan.stableTestIds[0]])]), /missing/);
  assert.throws(() => validateProtectedFanIn(plan, [shard([...plan.stableTestIds, 'desktop::e2e/tests/c.spec.mjs::c'])]), /unexpected/);
  assert.throws(() => validateProtectedFanIn(plan, [shard([plan.stableTestIds[0]]), shard(plan.stableTestIds)]), /duplicate/);
});

test('protected fan-in rejects stale, cancelled and identity-mismatched evidence', () => {
  assert.throws(() => validateProtectedFanIn(plan, [shard(plan.stableTestIds, { candidateHeadSha: 'c'.repeat(40) })]), /head/);
  assert.throws(() => validateProtectedFanIn(plan, [shard(plan.stableTestIds, { planDigest: `sha256:${'2'.repeat(64)}` })]), /plan/);
  assert.throws(() => validateProtectedFanIn(plan, [shard(plan.stableTestIds, { status: 'cancelled' })]), /status/);
});
