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
const fixtureId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::fixture';
const boundedId = 'desktop-chromium::e2e/tests/bounded.spec.mjs::bounded';
const boundedAdditionId = 'desktop-chromium::e2e/tests/bounded.spec.mjs::bounded addition';

const plan = {
  schemaVersion: 2,
  controller: { id: 'atlas-protected-hosted-controller-v2', version: 2, sourceSha: controllerSha },
  candidateHeadSha: head,
  planDigest,
  expectedStableTestIdsDigest: expectedDigest,
  productIdentitiesDigest: productDigest,
  workerPolicyDigest: workerDigest,
  executionPolicyDigest: executionDigest,
  workerPolicy: { id: 'atlas-protected-hosted-workers-v1', version: 1, hostedShards: 2, workersPerShard: 1 },
  retryPolicy: { retries: 0 },
  selectiveExecution: false,
};

const execution = {
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
    groupIds: ['e2e.full', 'integration.bounded'],
    stableTestIds: [fixtureId, boundedId, boundedAdditionId],
    protectedStableTestIds: [fixtureId, boundedId],
    candidateAdditionalStableTestIds: [boundedAdditionId],
    partitions: [
      {
        dataCapability: 'qualification_fixture',
        groupIds: ['e2e.full'],
        stableTestIds: [fixtureId],
        protectedStableTestIds: [fixtureId],
        candidateAdditionalStableTestIds: [],
      },
      {
        dataCapability: 'bounded_real_world',
        groupIds: ['integration.bounded'],
        stableTestIds: [boundedId, boundedAdditionId],
        protectedStableTestIds: [boundedId],
        candidateAdditionalStableTestIds: [boundedAdditionId],
      },
    ],
  },
  specialist: { groupIds: [], stableTestIds: [] },
  review: { groupIds: [], stableTestIds: [] },
};

function summaryFor(id) {
  return {
    status: 'passed',
    metadata: {
      targetMode: 'checkout-overlay', expectedRevision: head, verificationPlanSha256: planDigest,
      browserContainer, workers: 1,
    },
    scenarios: [{ stableTestId: id, status: 'passed', retry: 0, skipReason: null }],
  };
}

const sources = [
  { placement: 'protected', dataCapability: 'qualification_fixture', summary: summaryFor(fixtureId) },
  { placement: 'protected', dataCapability: 'bounded_real_world', summary: summaryFor(boundedId) },
  { placement: 'candidate-additions', dataCapability: 'bounded_real_world', summary: summaryFor(boundedAdditionId) },
];

test('protected shard validator accepts the exact required source summary for every nonempty data-capability placement', () => {
  const result = buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: sources, shardIndex: 0, shardCount: 2,
  });
  assert.deepEqual(result.executedStableTestIds, [boundedAdditionId, boundedId, fixtureId].sort());
});

test('protected shard validator rejects missing duplicate mismatched and unsupported capability source summaries', () => {
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: sources.slice(1), shardIndex: 0, shardCount: 2,
  }), /missing|qualification_fixture/i);
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: [...sources, sources[1]], shardIndex: 0, shardCount: 2,
  }), /duplicate|bounded_real_world/i);
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: [
      sources[0],
      { ...sources[1], summary: summaryFor(fixtureId) },
      sources[2],
    ], shardIndex: 0, shardCount: 2,
  }), /unexpected|bounded_real_world/i);
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: [...sources, {
      placement: 'protected', dataCapability: 'real_fullworld', summary: summaryFor(fixtureId),
    }], shardIndex: 0, shardCount: 2,
  }), /real_fullworld|unsupported|capability/i);
});
