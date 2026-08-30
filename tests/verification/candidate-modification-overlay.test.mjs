import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { buildProtectedHostedExecutionContract } from '../../tools/verification/protected-hosted-execution.mjs';
import { buildProtectedPlaywrightSelection } from '../../tools/verification/protected-playwright-selection.mjs';
import { buildProtectedHostedShardSummary } from '../../tools/verification/protected-hosted-shard-summary.mjs';
import { validateProtectedHostedFanIn } from '../../tools/verification/protected-hosted-fan-in.mjs';

const head = 'b'.repeat(40);
const controllerSha = 'a'.repeat(40);
const idA = 'desktop-chromium::e2e/tests/desktop.spec.mjs::suite › A';
const idB = 'desktop-chromium::e2e/tests/desktop.spec.mjs::suite › B';
const planSemanticDigest = `sha256:${'1'.repeat(64)}`;
const planInstanceDigest = `sha256:${'2'.repeat(64)}`;
const authorityDigest = `sha256:${'3'.repeat(64)}`;
const environmentDigest = `sha256:${'4'.repeat(64)}`;
const expectedDigest = `sha256:${'5'.repeat(64)}`;
const productDigest = `sha256:${'6'.repeat(64)}`;
const workerDigest = `sha256:${'7'.repeat(64)}`;
const executionDigest = `sha256:${'8'.repeat(64)}`;
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function group() {
  return {
    id: 'e2e.full',
    specs: ['e2e/tests/desktop.spec.mjs'],
    projects: ['desktop-chromium'],
    stableTestIds: [],
    capabilities: {
      browser: true,
      hosted: true,
      requiresPublication: true,
      dataCapability: 'qualification_fixture',
      visualReview: false,
      specialistReason: null,
    },
  };
}

function plan(overrides = {}) {
  return {
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
    requiredGroupIds: ['e2e.full'],
    groups: [group()],
    stableTestIds: [idA, idB],
    candidateStableIdAdditions: [idB],
    candidateStableIdModifications: [idA],
    requiredDataCapabilities: ['qualification_fixture'],
    requiresRealFullWorld: false,
    ...overrides,
  };
}

function summaryFor(id) {
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
    },
    projects: [{ name: 'desktop-chromium' }],
    scenarios: [{ stableTestId: id, status: 'passed', retry: 0, skipReason: null }],
  };
}

const playwrightList = [
  'Listing tests:',
  '  [desktop-chromium] › desktop.spec.mjs:10:3 › suite › A',
  '  [desktop-chromium] › desktop.spec.mjs:20:3 › suite › B',
  'Total: 2 tests in 1 file',
].join('\n');

test('execution keeps the protected lower-bound and adds a candidate-modification overlay', () => {
  const result = buildProtectedHostedExecutionContract(plan(), { currentHeadSha: head });
  assert.deepEqual(result.hosted.protectedStableTestIds, [idA]);
  assert.deepEqual(result.hosted.candidateAdditionalStableTestIds, [idB]);
  assert.deepEqual(result.hosted.candidateModifiedStableTestIds, [idA]);
  assert.deepEqual(result.hosted.partitions, [{
    dataCapability: 'qualification_fixture',
    groupIds: ['e2e.full'],
    stableTestIds: [idA, idB].sort(),
    protectedStableTestIds: [idA],
    candidateAdditionalStableTestIds: [idB],
    candidateModifiedStableTestIds: [idA],
  }]);
});

test('candidate-modifications selection executes only the changed shared IDs from candidate body', () => {
  const execution = buildProtectedHostedExecutionContract(plan(), { currentHeadSha: head });
  const result = buildProtectedPlaywrightSelection(playwrightList, execution, { placement: 'candidate-modifications' });
  assert.deepEqual(result.stableTestIds, [idA]);
  assert.match(result.testListText, /suite › A/);
  assert.doesNotMatch(result.testListText, /suite › B/);
});

test('shard evidence proves candidate modifications separately without duplicating the logical census', () => {
  const execution = buildProtectedHostedExecutionContract(plan(), { currentHeadSha: head });
  const result = buildProtectedHostedShardSummary({
    plan: plan(),
    execution,
    sourceSummaries: [
      { placement: 'protected', dataCapability: 'qualification_fixture', summary: summaryFor(idA) },
      { placement: 'candidate-modifications', dataCapability: 'qualification_fixture', summary: summaryFor(idA) },
      { placement: 'candidate-additions', dataCapability: 'qualification_fixture', summary: summaryFor(idB) },
    ],
    shardIndex: 0,
    shardCount: 1,
  });
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.planSemanticDigest, planSemanticDigest);
  assert.equal(result.planInstanceDigest, planInstanceDigest);
  assert.equal(result.authorityDigest, authorityDigest);
  assert.equal(result.environmentDigest, environmentDigest);
  assert.deepEqual(result.executedStableTestIds, [idA, idB].sort());
  assert.deepEqual(result.candidateModifiedStableTestIdsProven, [idA]);
});

test('fan-in requires exact candidate-modification proof in addition to the logical stable-ID census', () => {
  const hostedDigest = digest([idA, idB].sort());
  const execution = buildProtectedHostedExecutionContract(plan(), { currentHeadSha: head });
  const shard = buildProtectedHostedShardSummary({
    plan: plan(),
    execution,
    sourceSummaries: [
      { placement: 'protected', dataCapability: 'qualification_fixture', summary: summaryFor(idA) },
      { placement: 'candidate-modifications', dataCapability: 'qualification_fixture', summary: summaryFor(idA) },
      { placement: 'candidate-additions', dataCapability: 'qualification_fixture', summary: summaryFor(idB) },
    ],
    shardIndex: 0,
    shardCount: 1,
  });
  const result = validateProtectedHostedFanIn(plan(), [shard], {
    currentHeadSha: head,
    expectedStableTestIds: [idA, idB],
    expectedStableTestIdsDigest: hostedDigest,
  });
  assert.deepEqual(result.executedStableTestIds, [idA, idB].sort());
  assert.deepEqual(result.candidateModifiedStableTestIdsProven, [idA]);

  const withoutOverlay = { ...shard, candidateModifiedStableTestIdsProven: [] };
  assert.throws(() => validateProtectedHostedFanIn(plan(), [withoutOverlay], {
    currentHeadSha: head,
    expectedStableTestIds: [idA, idB],
    expectedStableTestIdsDigest: hostedDigest,
  }), /candidate.*modification|modified.*stable/i);
});
