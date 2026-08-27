import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProtectedHostedFanIn } from '../../tools/verification/protected-hosted-fan-in.mjs';

const head = 'b'.repeat(40);
const otherHead = 'c'.repeat(40);
const idA = 'desktop-chromium::e2e/tests/desktop.spec.mjs::A';
const idB = 'desktop-chromium::e2e/tests/desktop.spec.mjs::B';
const planDigest = `sha256:${'1'.repeat(64)}`;
const expectedDigest = `sha256:${'2'.repeat(64)}`;
const productDigest = `sha256:${'3'.repeat(64)}`;
const workerDigest = `sha256:${'4'.repeat(64)}`;
const executionDigest = `sha256:${'5'.repeat(64)}`;
const hostedDigest = `sha256:${'6'.repeat(64)}`;
const controllerSha = 'a'.repeat(40);

function plan() {
  return {
    schemaVersion: 2,
    controller: { id: 'atlas-protected-hosted-controller-v2', version: 2, sourceSha: controllerSha },
    candidateHeadSha: head,
    stableTestIds: [idA, idB],
    expectedStableTestIdsDigest: expectedDigest,
    productIdentitiesDigest: productDigest,
    workerPolicyDigest: workerDigest,
    executionPolicyDigest: executionDigest,
    retryPolicy: { retries: 0 },
    selectiveExecution: false,
    planDigest,
  };
}

function summary(shardIndex, ids, overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'success',
    cancelled: false,
    candidateHeadSha: head,
    controllerSourceSha: controllerSha,
    planDigest,
    planExpectedStableTestIdsDigest: expectedDigest,
    expectedStableTestIdsDigest: expectedDigest,
    productIdentitiesDigest: productDigest,
    workerPolicyDigest: workerDigest,
    executionPolicyDigest: executionDigest,
    shardIndex,
    shardCount: 2,
    retries: 0,
    skippedStableTestIds: [],
    executedStableTestIds: ids,
    ...overrides,
  };
}

test('fan-in accepts only complete exact-head exact-ID zero-retry sibling evidence', () => {
  const result = validateProtectedHostedFanIn(plan(), [summary(0, [idA]), summary(1, [idB])], { currentHeadSha: head });
  assert.equal(result.status, 'success');
  assert.equal(result.candidateHeadSha, head);
  assert.equal(result.planDigest, planDigest);
  assert.deepEqual(result.executedStableTestIds, [idA, idB]);
});

test('fan-in can validate an explicitly bound hosted placement without pretending it is the full plan census', () => {
  const summaries = [
    summary(0, [idA], { expectedStableTestIdsDigest: hostedDigest }),
    summary(1, [], { expectedStableTestIdsDigest: hostedDigest }),
  ];
  const result = validateProtectedHostedFanIn(plan(), summaries, {
    currentHeadSha: head,
    expectedStableTestIds: [idA],
    expectedStableTestIdsDigest: hostedDigest,
  });
  assert.equal(result.expectedStableTestIdsDigest, hostedDigest);
  assert.deepEqual(result.executedStableTestIds, [idA]);
});

test('fan-in rejects stale current head and stale summary head', () => {
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA]), summary(1, [idB])], { currentHeadSha: otherHead }), /current.*head|stale/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], { candidateHeadSha: otherHead }), summary(1, [idB])], { currentHeadSha: head }), /head/i);
});

test('fan-in rejects missing unexpected and duplicate stable IDs', () => {
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA]), summary(1, [])], { currentHeadSha: head }), /missing|stable/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA]), summary(1, [idB, 'desktop-chromium::e2e/tests/desktop.spec.mjs::C'])], { currentHeadSha: head }), /unexpected/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA]), summary(1, [idA, idB])], { currentHeadSha: head }), /duplicate/i);
});

test('fan-in rejects retries skips cancellation and non-success evidence', () => {
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], { retries: 1 }), summary(1, [idB])], { currentHeadSha: head }), /retr/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], { skippedStableTestIds: [idB] }), summary(1, [idB])], { currentHeadSha: head }), /skip/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], { cancelled: true }), summary(1, [idB])], { currentHeadSha: head }), /cancel/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], { status: 'failed' }), summary(1, [idB])], { currentHeadSha: head }), /status|success/i);
});

test('fan-in rejects partial or duplicate sibling shard evidence', () => {
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA, idB])], { currentHeadSha: head }), /shard|sibling|partial/i);
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA]), summary(0, [idB])], { currentHeadSha: head }), /shard|duplicate/i);
});

test('fan-in rejects wrong plan controller product worker execution and placement identities', () => {
  const cases = [
    { planDigest: `sha256:${'7'.repeat(64)}` },
    { controllerSourceSha: 'd'.repeat(40) },
    { expectedStableTestIdsDigest: `sha256:${'8'.repeat(64)}` },
    { productIdentitiesDigest: `sha256:${'9'.repeat(64)}` },
    { workerPolicyDigest: `sha256:${'0'.repeat(64)}` },
    { executionPolicyDigest: `sha256:${'a'.repeat(64)}` },
  ];
  for (const overrides of cases) {
    assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], overrides), summary(1, [idB])], { currentHeadSha: head }), /mismatch|identity|digest|controller/i);
  }
  assert.throws(() => validateProtectedHostedFanIn(plan(), [summary(0, [idA], { expectedStableTestIdsDigest: hostedDigest }), summary(1, [], { expectedStableTestIdsDigest: hostedDigest })], {
    currentHeadSha: head,
    expectedStableTestIds: [idA],
    expectedStableTestIdsDigest: `sha256:${'b'.repeat(64)}`,
  }), /digest|mismatch/i);
});
