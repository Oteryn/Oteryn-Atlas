import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { buildProtectedHostedExecutionContract } from '../../tools/verification/protected-hosted-execution.mjs';

const head = 'b'.repeat(40);
const controllerSha = 'a'.repeat(40);
const planDigest = `sha256:${'1'.repeat(64)}`;
const stableDigest = `sha256:${'2'.repeat(64)}`;
const productDigest = `sha256:${'3'.repeat(64)}`;
const workerDigest = `sha256:${'4'.repeat(64)}`;
const executionDigest = `sha256:${'5'.repeat(64)}`;
const hostedId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::hosted';
const specialistId = 'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::specialist';

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function capabilities(overrides = {}) {
  return {
    browser: true,
    hosted: true,
    requiresPublication: true,
    dataCapability: 'qualification_fixture',
    visualReview: false,
    specialistReason: null,
    ...overrides,
  };
}

function hostedGroup() {
  return {
    id: 'e2e.full',
    specs: ['e2e/tests/desktop.spec.mjs'],
    projects: ['desktop-chromium'],
    stableTestIds: [],
    capabilities: capabilities(),
  };
}

function reviewGroup() {
  return {
    id: 'visual.creatures',
    specs: ['e2e/tests/desktop.spec.mjs'],
    projects: ['desktop-chromium'],
    stableTestIds: [],
    capabilities: capabilities({
      hosted: false,
      dataCapability: 'bounded_real_world',
      visualReview: true,
      specialistReason: 'private-visual',
    }),
  };
}

function plan(overrides = {}) {
  return {
    schemaVersion: 2,
    controller: { id: 'atlas-protected-hosted-controller-v2', version: 2, sourceSha: controllerSha },
    candidateHeadSha: head,
    planDigest,
    expectedStableTestIdsDigest: stableDigest,
    productIdentitiesDigest: productDigest,
    workerPolicyDigest: workerDigest,
    executionPolicyDigest: executionDigest,
    retryPolicy: { retries: 0 },
    selectiveExecution: false,
    requiredGroupIds: ['e2e.full'],
    groups: [hostedGroup()],
    stableTestIds: [hostedId],
    requiredDataCapabilities: ['qualification_fixture'],
    requiresRealFullWorld: false,
    ...overrides,
  };
}

test('hosted execution contract copies exact protected selection and binds the hosted placement digest', () => {
  const result = buildProtectedHostedExecutionContract(plan(), { currentHeadSha: head });
  assert.equal(result.candidateHeadSha, head);
  assert.equal(result.planDigest, planDigest);
  assert.equal(result.expectedStableTestIdsDigest, stableDigest);
  assert.equal(result.hostedExpectedStableTestIdsDigest, digest([hostedId]));
  assert.equal(result.specialistExpectedStableTestIdsDigest, digest([]));
  assert.equal(result.retries, 0);
  assert.equal(result.selectiveExecution, false);
  assert.deepEqual(result.hosted.groupIds, ['e2e.full']);
  assert.deepEqual(result.hosted.stableTestIds, [hostedId]);
  assert.deepEqual(result.specialist.groupIds, []);
  assert.deepEqual(result.specialist.stableTestIds, []);
  assert.deepEqual(result.review.groupIds, []);
});

test('executor rejects a stale PR head before execution', () => {
  assert.throws(() => buildProtectedHostedExecutionContract(plan(), { currentHeadSha: 'c'.repeat(40) }), /stale|current.*head/i);
});

test('only explicit real_fullworld groups become specialist execution', () => {
  const invalid = hostedGroup();
  invalid.capabilities = capabilities({ hosted: false, dataCapability: 'bounded_real_world', specialistReason: 'private-visual' });
  assert.throws(() => buildProtectedHostedExecutionContract(plan({ groups: [invalid] }), { currentHeadSha: head }), /visual|real_fullworld|specialist/i);

  const specialist = {
    id: 'fullworld.animation-census',
    specs: ['e2e/tests/fullworld-animation-census-desktop.spec.mjs'],
    projects: ['desktop-chromium'],
    stableTestIds: [],
    capabilities: capabilities({ hosted: false, dataCapability: 'real_fullworld', specialistReason: 'real-fullworld-product' }),
  };
  const result = buildProtectedHostedExecutionContract(plan({
    requiredGroupIds: ['e2e.full', specialist.id],
    groups: [hostedGroup(), specialist],
    stableTestIds: [hostedId, specialistId],
    requiredDataCapabilities: ['qualification_fixture', 'real_fullworld'],
    requiresRealFullWorld: true,
  }), { currentHeadSha: head });
  assert.deepEqual(result.hosted.stableTestIds, [hostedId]);
  assert.deepEqual(result.specialist.groupIds, [specialist.id]);
  assert.deepEqual(result.specialist.stableTestIds, [specialistId]);
  assert.equal(result.specialistExpectedStableTestIdsDigest, digest([specialistId]));
});

test('private bounded visual review is recorded as review obligation and never routed to specialist execution', () => {
  const result = buildProtectedHostedExecutionContract(plan({
    requiredGroupIds: ['e2e.full', 'visual.creatures'],
    groups: [hostedGroup(), reviewGroup()],
    requiredDataCapabilities: ['bounded_real_world', 'qualification_fixture'],
    requiresRealFullWorld: false,
  }), { currentHeadSha: head });
  assert.deepEqual(result.hosted.stableTestIds, [hostedId]);
  assert.deepEqual(result.specialist.groupIds, []);
  assert.deepEqual(result.specialist.stableTestIds, []);
  assert.deepEqual(result.review.groupIds, ['visual.creatures']);
  assert.deepEqual(result.review.stableTestIds, [hostedId]);
});

test('every planned stable ID must resolve to exactly one machine execution placement', () => {
  const unsupported = 'desktop-chromium::e2e/tests/not-selected.spec.mjs::orphan';
  assert.throws(() => buildProtectedHostedExecutionContract(plan({ stableTestIds: [hostedId, unsupported] }), { currentHeadSha: head }), /stable.*placement|selected.*group/i);

  const specialist = {
    id: 'fullworld.overlap',
    specs: ['e2e/tests/desktop.spec.mjs'],
    projects: ['desktop-chromium'],
    stableTestIds: [],
    capabilities: capabilities({ hosted: false, dataCapability: 'real_fullworld', specialistReason: 'real-fullworld-product' }),
  };
  assert.throws(() => buildProtectedHostedExecutionContract(plan({
    requiredGroupIds: ['e2e.full', specialist.id],
    groups: [hostedGroup(), specialist],
    requiredDataCapabilities: ['qualification_fixture', 'real_fullworld'],
    requiresRealFullWorld: true,
  }), { currentHeadSha: head }), /ambiguous|placement/i);
});
