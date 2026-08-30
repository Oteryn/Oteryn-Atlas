import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProtectedHostedShardSummary } from '../../tools/verification/protected-hosted-shard-summary.mjs';

const head = 'b'.repeat(40);
const controllerSha = 'a'.repeat(40);
const planSemanticDigest = `sha256:${'1'.repeat(64)}`;
const planInstanceDigest = `sha256:${'2'.repeat(64)}`;
const authorityDigest = `sha256:${'3'.repeat(64)}`;
const environmentDigest = `sha256:${'4'.repeat(64)}`;
const expectedDigest = `sha256:${'5'.repeat(64)}`;
const productDigest = `sha256:${'6'.repeat(64)}`;
const workerDigest = `sha256:${'7'.repeat(64)}`;
const executionDigest = `sha256:${'8'.repeat(64)}`;
const hostedDigest = `sha256:${'9'.repeat(64)}`;
const specialistDigest = `sha256:${'a'.repeat(64)}`;
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
const fixtureId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::fixture';
const boundedId = 'desktop-chromium::e2e/tests/bounded.spec.mjs::bounded';
const boundedAdditionId = 'desktop-chromium::e2e/tests/bounded.spec.mjs::bounded addition';

const plan = {
  schemaVersion: 3,
  controller: { id: 'atlas-protected-hosted-controller-v3', version: 3, sourceSha: controllerSha },
  candidateHeadSha: head,
  planSemanticDigest,
  planInstanceDigest,
  authorityDigest,
  environmentDigest,
  expectedStableTestIdsDigest: expectedDigest,
  productIdentitiesDigest: productDigest,
  workerPolicyDigest: workerDigest,
  executionPolicyDigest: executionDigest,
  workerPolicy: { id: 'atlas-protected-hosted-workers-v1', version: 1, hostedShards: 1, workersPerShard: 1 },
  retryPolicy: { retries: 0 },
  selectiveExecution: false,
};

const execution = {
  schemaVersion: 2,
  controllerSourceSha: controllerSha,
  candidateHeadSha: head,
  planSemanticDigest,
  planInstanceDigest,
  authorityDigest,
  environmentDigest,
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

function summaryFor(id, overrides = {}) {
  return {
    status: 'passed',
    metadata: {
      targetMode: 'checkout-overlay',
      expectedRevision: head,
      planSemanticDigest,
      planInstanceDigest,
      authorityDigest,
      environmentDigest,
      browserContainer,
      workers: 1,
      ...overrides,
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
    plan, execution, sourceSummaries: sources, shardIndex: 0, shardCount: 1,
  });
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.planSemanticDigest, planSemanticDigest);
  assert.equal(result.planInstanceDigest, planInstanceDigest);
  assert.equal(result.authorityDigest, authorityDigest);
  assert.equal(result.environmentDigest, environmentDigest);
  assert.deepEqual(result.executedStableTestIds, [boundedAdditionId, boundedId, fixtureId].sort());
});

test('protected shard validator rejects missing duplicate mismatched and unsupported capability source summaries', () => {
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: sources.slice(1), shardIndex: 0, shardCount: 1,
  }), /missing|qualification_fixture/i);
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: [...sources, sources[1]], shardIndex: 0, shardCount: 1,
  }), /duplicate|bounded_real_world/i);
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: [
      sources[0],
      { ...sources[1], summary: summaryFor(fixtureId) },
      sources[2],
    ], shardIndex: 0, shardCount: 1,
  }), /duplicate|unexpected|bounded_real_world/i);
  assert.throws(() => buildProtectedHostedShardSummary({
    plan, execution, sourceSummaries: [...sources, {
      placement: 'protected', dataCapability: 'real_fullworld', summary: summaryFor(fixtureId),
    }], shardIndex: 0, shardCount: 1,
  }), /real_fullworld|unsupported|capability/i);
});

test('protected shard validator rejects any semantic, instance, authority, or environment mismatch', () => {
  for (const field of ['planSemanticDigest', 'planInstanceDigest', 'authorityDigest', 'environmentDigest']) {
    const mismatched = `sha256:${'f'.repeat(64)}`;
    assert.throws(() => buildProtectedHostedShardSummary({
      plan,
      execution,
      sourceSummaries: [
        { ...sources[0], summary: summaryFor(fixtureId, { [field]: mismatched }) },
        sources[1],
        sources[2],
      ],
      shardIndex: 0,
      shardCount: 1,
    }), /mismatch|digest|identity/i);
  }
});
