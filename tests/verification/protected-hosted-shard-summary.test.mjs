import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProtectedHostedShardSummary } from '../../tools/verification/protected-hosted-shard-summary.mjs';

const head = 'b'.repeat(40);
const controllerSha = 'a'.repeat(40);
const planDigest = `sha256:${'1'.repeat(64)}`;
const expectedDigest = `sha256:${'2'.repeat(64)}`;
const productDigest = `sha256:${'3'.repeat(64)}`;
const workerDigest = `sha256:${'4'.repeat(64)}`;
const executionDigest = `sha256:${'5'.repeat(64)}`;
const hostedDigest = `sha256:${'6'.repeat(64)}`;
const specialistDigest = `sha256:${'7'.repeat(64)}`;
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const idA = 'desktop-chromium::e2e/tests/desktop.spec.mjs::A';
const idB = 'desktop-chromium::e2e/tests/desktop.spec.mjs::B';

function plan() {
  return {
    schemaVersion: 2,
    controller: { id: 'atlas-protected-hosted-controller-v2', version: 2, sourceSha: controllerSha },
    candidateHeadSha: head,
    planDigest,
    expectedStableTestIdsDigest: expectedDigest,
    productIdentitiesDigest: productDigest,
    workerPolicyDigest: workerDigest,
    executionPolicyDigest: executionDigest,
    workerPolicy: { id: 'atlas-protected-hosted-workers-v1', version: 1, hostedShards: 1, workersPerShard: 1 },
    retryPolicy: { retries: 0 },
    selectiveExecution: false,
  };
}

function execution() {
  return {
    schemaVersion: 1,
    controllerSourceSha: controllerSha,
    candidateHeadSha: head,
    planDigest,
    expectedStableTestIdsDigest: expectedDigest,
    hostedExpectedStableTestIdsDigest: hostedDigest,
    specialistExpectedStableTestIdsDigest: specialistDigest,
    productIdentitiesDigest: productDigest,
    workerPolicyDigest: workerDigest,
    executionPolicyDigest: executionDigest,
    retries: 0,
    selectiveExecution: false,
    hosted: {
      groupIds: ['e2e.full'],
      stableTestIds: [idA, idB],
      protectedStableTestIds: [idA],
      candidateAdditionalStableTestIds: [idB],
    },
    specialist: { groupIds: [], stableTestIds: [] },
    review: { groupIds: [], stableTestIds: [] },
  };
}

function summaryFor(id, overrides = {}) {
  return {
    status: 'passed',
    metadata: {
      targetMode: 'checkout-overlay',
      expectedRevision: head,
      verificationPlanSha256: planDigest,
      browserContainer,
      workers: 1,
    },
    projects: [{ name: 'desktop-chromium' }],
    scenarios: [{ stableTestId: id, status: 'passed', retry: 0, skipReason: null }],
    ...overrides,
  };
}

const summary = (overrides = {}) => summaryFor(idA, overrides);

test('protected shard summary binds exact plan/controller/product/worker and hosted-placement identities', () => {
  const result = buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary(), shardIndex: 0, shardCount: 1 });
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.status, 'success');
  assert.equal(result.cancelled, false);
  assert.equal(result.candidateHeadSha, head);
  assert.equal(result.controllerSourceSha, controllerSha);
  assert.equal(result.planDigest, planDigest);
  assert.equal(result.planExpectedStableTestIdsDigest, expectedDigest);
  assert.equal(result.expectedStableTestIdsDigest, hostedDigest);
  assert.equal(result.productIdentitiesDigest, productDigest);
  assert.equal(result.workerPolicyDigest, workerDigest);
  assert.equal(result.executionPolicyDigest, executionDigest);
  assert.equal(result.shardIndex, 0);
  assert.equal(result.shardCount, 1);
  assert.equal(result.retries, 0);
  assert.deepEqual(result.skippedStableTestIds, []);
  assert.deepEqual(result.executedStableTestIds, [idA]);
});

test('protected shard evidence unions protected-body and candidate-addition Playwright runs', () => {
  const result = buildProtectedHostedShardSummary({
    plan: plan(),
    execution: execution(),
    summaries: [summaryFor(idA), summaryFor(idB)],
    shardIndex: 0,
    shardCount: 1,
  });
  assert.deepEqual(result.executedStableTestIds, [idA, idB]);
});

test('duplicate stable IDs across protected and candidate-addition summaries fail closed', () => {
  assert.throws(() => buildProtectedHostedShardSummary({
    plan: plan(), execution: execution(), summaries: [summaryFor(idA), summaryFor(idA)], shardIndex: 0, shardCount: 1,
  }), /duplicate/i);
});

test('failed cancelled skipped retried or duplicate scenario evidence fails closed', () => {
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary({ status: 'failed' }), shardIndex: 0, shardCount: 1 }), /status|passed/i);
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary({ cancelled: true }), shardIndex: 0, shardCount: 1 }), /cancel/i);
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary({ scenarios: [{ stableTestId: idA, status: 'skipped', retry: 0, skipReason: 'skip' }] }), shardIndex: 0, shardCount: 1 }), /skip/i);
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary({ scenarios: [{ stableTestId: idA, status: 'passed', retry: 1, skipReason: null }] }), shardIndex: 0, shardCount: 1 }), /retr/i);
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary({ scenarios: [summary().scenarios[0], summary().scenarios[0]] }), shardIndex: 0, shardCount: 1 }), /duplicate/i);
});

test('wrong revision plan digest browser container worker count or shard policy fails closed', () => {
  const cases = [
    { metadata: { ...summary().metadata, expectedRevision: 'c'.repeat(40) } },
    { metadata: { ...summary().metadata, verificationPlanSha256: `sha256:${'9'.repeat(64)}` } },
    { metadata: { ...summary().metadata, browserContainer: 'candidate-controlled' } },
    { metadata: { ...summary().metadata, workers: 2 } },
  ];
  for (const overrides of cases) {
    assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary(overrides), shardIndex: 0, shardCount: 1 }), /revision|plan|browser|worker|mismatch/i);
  }
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary(), shardIndex: 0, shardCount: 2 }), /shard|worker.*policy/i);
});

test('wrong hosted placement digest and unexpected or specialist stable IDs fail closed', () => {
  const badExecution = execution();
  badExecution.hostedExpectedStableTestIdsDigest = 'not-a-digest';
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: badExecution, summary: summary(), shardIndex: 0, shardCount: 1 }), /hosted.*digest/i);

  const unexpected = 'desktop-chromium::e2e/tests/desktop.spec.mjs::C';
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: execution(), summary: summary({ scenarios: [{ stableTestId: unexpected, status: 'passed', retry: 0, skipReason: null }] }), shardIndex: 0, shardCount: 1 }), /unexpected|hosted/i);
  const value = execution();
  value.specialist = { groupIds: ['fullworld.animation-census'], stableTestIds: [idB] };
  value.hosted = { groupIds: ['e2e.full'], stableTestIds: [idA], protectedStableTestIds: [idA], candidateAdditionalStableTestIds: [] };
  assert.throws(() => buildProtectedHostedShardSummary({ plan: plan(), execution: value, summary: summaryFor(idB), shardIndex: 0, shardCount: 1 }), /unexpected|hosted/i);
});
