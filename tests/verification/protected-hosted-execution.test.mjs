import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  buildProtectedHostedExecutionContract,
  buildProtectedPromotionBrowserIdentity,
  resolveProtectedPromotionQualification,
} from '../../tools/verification/protected-hosted-execution.mjs';

const head = 'b'.repeat(40);
const controllerSha = 'a'.repeat(40);
const planSemanticDigest = `sha256:${'1'.repeat(64)}`;
const planInstanceDigest = `sha256:${'2'.repeat(64)}`;
const authorityDigest = `sha256:${'3'.repeat(64)}`;
const environmentDigest = `sha256:${'4'.repeat(64)}`;
const stableDigest = `sha256:${'5'.repeat(64)}`;
const productDigest = `sha256:${'6'.repeat(64)}`;
const workerDigest = `sha256:${'7'.repeat(64)}`;
const executionDigest = `sha256:${'8'.repeat(64)}`;
const hostedId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::hosted';
const boundedHostedId = 'desktop-chromium::e2e/tests/creature-gameplay-real-desktop.spec.mjs::bounded real';
const candidateAdditionalId = 'desktop-chromium::e2e/tests/desktop.spec.mjs::candidate addition';
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

function boundedHostedGroup() {
  return {
    id: 'integration.creature-gameplay',
    specs: ['e2e/tests/creature-gameplay-real-desktop.spec.mjs'],
    projects: ['desktop-chromium'],
    stableTestIds: [],
    capabilities: capabilities({ dataCapability: 'bounded_real_world' }),
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
    schemaVersion: 3,
    controller: { id: 'atlas-protected-hosted-controller-v3', version: 3, sourceSha: controllerSha },
    candidateHeadSha: head,
    planSemanticDigest,
    planInstanceDigest,
    authorityDigest,
    environmentDigest,
    expectedStableTestIdsDigest: stableDigest,
    productIdentitiesDigest: productDigest,
    workerPolicyDigest: workerDigest,
    executionPolicyDigest: executionDigest,
    retryPolicy: { retries: 0 },
    selectiveExecution: false,
    requiredGroupIds: ['e2e.full'],
    groups: [hostedGroup()],
    stableTestIds: [hostedId],
    candidateStableIdAdditions: [],
    requiredDataCapabilities: ['qualification_fixture'],
    requiresRealFullWorld: false,
    ...overrides,
  };
}

test('hosted execution contract copies exact protected selection and binds the hosted placement digest', () => {
  const result = buildProtectedHostedExecutionContract(plan(), { currentHeadSha: head });
  assert.equal(result.candidateHeadSha, head);
  assert.equal(result.schemaVersion, 2);
  assert.equal(result.planSemanticDigest, planSemanticDigest);
  assert.equal(result.planInstanceDigest, planInstanceDigest);
  assert.equal(result.authorityDigest, authorityDigest);
  assert.equal(result.environmentDigest, environmentDigest);
  assert.equal(result.expectedStableTestIdsDigest, stableDigest);
  assert.equal(result.hostedExpectedStableTestIdsDigest, digest([hostedId]));
  assert.equal(result.specialistExpectedStableTestIdsDigest, digest([]));
  assert.equal(result.retries, 0);
  assert.equal(result.selectiveExecution, false);
  assert.deepEqual(result.hosted.groupIds, ['e2e.full']);
  assert.deepEqual(result.hosted.stableTestIds, [hostedId]);
  assert.deepEqual(result.hosted.protectedStableTestIds, [hostedId]);
  assert.deepEqual(result.hosted.candidateAdditionalStableTestIds, []);
  assert.deepEqual(result.specialist.groupIds, []);
  assert.deepEqual(result.specialist.stableTestIds, []);
  assert.deepEqual(result.review.groupIds, []);
});

test('hosted execution requires semantic, instance, authority and environment identities', () => {
  for (const field of ['planSemanticDigest', 'planInstanceDigest', 'authorityDigest', 'environmentDigest']) {
    assert.throws(
      () => buildProtectedHostedExecutionContract(plan({ [field]: undefined }), { currentHeadSha: head }),
      new RegExp(field.replace(/[A-Z]/g, (letter) => `.*${letter.toLowerCase()}`), 'i'),
    );
  }
});

test('candidate test bodies can widen only through new stable IDs; protected IDs stay protected-body work', () => {
  const result = buildProtectedHostedExecutionContract(plan({
    stableTestIds: [hostedId, candidateAdditionalId],
    candidateStableIdAdditions: [candidateAdditionalId],
  }), { currentHeadSha: head });
  assert.deepEqual(result.hosted.stableTestIds, [candidateAdditionalId, hostedId].sort());
  assert.deepEqual(result.hosted.protectedStableTestIds, [hostedId]);
  assert.deepEqual(result.hosted.candidateAdditionalStableTestIds, [candidateAdditionalId]);
});

test('candidate-addition identity must be unique and belong to the exact planned census', () => {
  const orphan = 'desktop-chromium::e2e/tests/desktop.spec.mjs::not planned';
  assert.throws(() => buildProtectedHostedExecutionContract(plan({ candidateStableIdAdditions: [orphan] }), { currentHeadSha: head }), /candidate.*addition|planned/i);
  assert.throws(() => buildProtectedHostedExecutionContract(plan({
    stableTestIds: [hostedId, candidateAdditionalId],
    candidateStableIdAdditions: [candidateAdditionalId, candidateAdditionalId],
  }), { currentHeadSha: head }), /candidate.*addition|duplicate/i);
});

test('executor rejects a stale PR head before execution', () => {
  assert.throws(() => buildProtectedHostedExecutionContract(plan(), { currentHeadSha: 'c'.repeat(40) }), /stale|current.*head/i);
});

test('hosted execution partitions exact stable IDs by data capability', () => {
  const result = buildProtectedHostedExecutionContract(plan({
    requiredGroupIds: ['e2e.full', 'integration.creature-gameplay'],
    groups: [hostedGroup(), boundedHostedGroup()],
    stableTestIds: [hostedId, boundedHostedId],
    requiredDataCapabilities: ['bounded_real_world', 'qualification_fixture'],
  }), { currentHeadSha: head });

  assert.deepEqual(result.hosted.partitions, [
    {
      dataCapability: 'bounded_real_world',
      groupIds: ['integration.creature-gameplay'],
      stableTestIds: [boundedHostedId],
      protectedStableTestIds: [boundedHostedId],
      candidateAdditionalStableTestIds: [],
    },
    {
      dataCapability: 'qualification_fixture',
      groupIds: ['e2e.full'],
      stableTestIds: [hostedId],
      protectedStableTestIds: [hostedId],
      candidateAdditionalStableTestIds: [],
    },
  ]);
});

test('hosted stable ID cannot span multiple data capabilities', () => {
  const overlappingBounded = {
    ...boundedHostedGroup(),
    id: 'integration.overlapping-bounded',
    specs: ['e2e/tests/desktop.spec.mjs'],
  };
  assert.throws(() => buildProtectedHostedExecutionContract(plan({
    requiredGroupIds: ['e2e.full', overlappingBounded.id],
    groups: [hostedGroup(), overlappingBounded],
    stableTestIds: [hostedId],
    requiredDataCapabilities: ['bounded_real_world', 'qualification_fixture'],
  }), { currentHeadSha: head }), /data.*capability|ambiguous/i);
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

test('protected promotion qualification registry binds exact hosted proof for bounded-real row framing', () => {
  const spec = resolveProtectedPromotionQualification('fix/issue-179-bounded-real-row-framing');
  assert.deepEqual(spec, {
    id: 'bounded-real-row-framing-v1',
    headRef: 'fix/issue-179-bounded-real-row-framing',
    changedFiles: [
      'tests/verification/bounded-real-world.test.mjs',
      'tests/verification/protected-hosted-product-identities.test.mjs',
      'tools/verification/bounded-real-world.mjs',
      'tools/verification/protected-hosted-product-identities.json',
    ],
    expectedProductDigest: 'sha256:a19f0371eb5afcdf8c40156d732d5602e970400ec9369607f901e2f0a58c92b6',
  });
  assert.equal(Object.isFrozen(spec), true);
  assert.equal(Object.isFrozen(spec.changedFiles), true);
  assert.throws(() => resolveProtectedPromotionQualification('fix/issue-179-unknown'), /unsupported.*promotion/i);
});

test('protected promotion qualification registry binds exact hosted proof for qualification trust descriptor', () => {
  const spec = resolveProtectedPromotionQualification('fix/issue-179-qualification-trust-descriptor');
  assert.deepEqual(spec, {
    id: 'qualification-trust-descriptor-v1',
    headRef: 'fix/issue-179-qualification-trust-descriptor',
    changedFiles: [
      '.github/workflows/protected-hosted-executor.yml',
      'tests/verification/protected-hosted-compose-promotion.test.mjs',
      'tests/verification/qualification-world.test.mjs',
      'tools/verification/qualification-world.mjs',
    ],
    expectedProductDigest: 'sha256:f53f1dcb8961c42e82191644b7628cfb4f30641344c8876f4178d37a94dd4cd5',
  });
  assert.equal(Object.isFrozen(spec), true);
  assert.equal(Object.isFrozen(spec.changedFiles), true);
});

test('protected promotion qualification registry binds exact functional qualification fixture repair', () => {
  const spec = resolveProtectedPromotionQualification('fix/issue-179-qualification-functional-fixture');
  assert.deepEqual(spec, {
    id: 'qualification-functional-fixture-v1',
    headRef: 'fix/issue-179-qualification-functional-fixture',
    changedFiles: [
      'e2e/support/creature-presentation-fixtures.mjs',
      'e2e/tests/audit-desktop.spec.mjs',
      'e2e/tests/creature-interaction-desktop.spec.mjs',
      'e2e/tests/creature-presentation-desktop.spec.mjs',
      'e2e/tests/creatures-desktop.spec.mjs',
      'e2e/tests/desktop.spec.mjs',
      'e2e/tests/farm-explorer-desktop.spec.mjs',
      'e2e/tests/farm-explorer-mobile.spec.mjs',
      'e2e/tests/geometry-desktop.spec.mjs',
      'e2e/tests/geometry-mobile.spec.mjs',
      'e2e/tests/mobile.spec.mjs',
      'e2e/tests/performance-desktop.spec.mjs',
      'e2e/tests/race-desktop.spec.mjs',
      'e2e/tests/runtime.mjs',
      'e2e/tests/soak-desktop.spec.mjs',
      'e2e/tests/state-desktop.spec.mjs',
      'e2e/tests/stress-desktop.spec.mjs',
      'e2e/tests/visual-desktop.spec.mjs',
      'e2e/tests/visual-mobile.spec.mjs',
      'src/browser/semantic-search.mjs',
      'tests/verification/protected-hosted-product-identities.test.mjs',
      'tests/verification/qualification-semantic-source-trust.test.mjs',
      'tests/verification/qualification-world.test.mjs',
      'tools/verification/protected-hosted-product-identities.json',
      'tools/verification/qualification-fixture-definition.mjs',
      'tools/verification/qualification-world.mjs',
      'web/fullworld-farm-explorer.mjs',
      'web/fullworld-search.mjs',
    ],
    expectedProductDigest: 'sha256:7bac8358ecb8e44d05636f9657c318fa6bb6f22445143237c8fa207d45be820b',
    candidateCensusMount: {
      sourceTree: 'exact-candidate-checkout',
      containerRoot: '/candidate',
      readOnly: true,
      dependencySource: '/protected-e2e-node-modules/node_modules',
      dependencyTarget: 'e2e/node_modules',
      dependencyLinkPhase: 'host-before-readonly-mount',
    },
    deterministicRuntimeShim: {
      command: 'python',
      target: '/usr/bin/python3',
      shimRoot: '/tmp/atlas-python-bin',
      pycacheRoot: '/tmp/atlas-python-pycache',
      network: 'none',
      rootFilesystem: 'read-only',
    },
  });
  assert.equal(Object.isFrozen(spec), true);
  assert.equal(Object.isFrozen(spec.changedFiles), true);
});

test('functional qualification promotion browser proof binds exact candidate, protected base, run and pinned environment', () => {
  const identity = buildProtectedPromotionBrowserIdentity({
    headRef: 'fix/issue-179-qualification-functional-fixture',
    candidateHeadSha: 'c'.repeat(40),
    protectedBaseSha: 'd'.repeat(40),
    prNumber: 268,
    runId: 123456,
    runAttempt: 2,
    environmentImage: `mcr.microsoft.com/playwright:v1.62.0-noble@sha256:${'e'.repeat(64)}`,
  });
  assert.deepEqual(Object.keys(identity).sort(), [
    'authorityDigest',
    'environmentDigest',
    'planInstanceDigest',
    'planSemanticDigest',
  ]);
  for (const value of Object.values(identity)) assert.match(value, /^sha256:[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(identity), true);

  const rerun = buildProtectedPromotionBrowserIdentity({
    headRef: 'fix/issue-179-qualification-functional-fixture',
    candidateHeadSha: 'c'.repeat(40),
    protectedBaseSha: 'd'.repeat(40),
    prNumber: 268,
    runId: 123456,
    runAttempt: 3,
    environmentImage: `mcr.microsoft.com/playwright:v1.62.0-noble@sha256:${'e'.repeat(64)}`,
  });
  assert.equal(rerun.planSemanticDigest, identity.planSemanticDigest);
  assert.equal(rerun.authorityDigest, identity.authorityDigest);
  assert.equal(rerun.environmentDigest, identity.environmentDigest);
  assert.notEqual(rerun.planInstanceDigest, identity.planInstanceDigest);

  assert.throws(() => buildProtectedPromotionBrowserIdentity({
    headRef: 'fix/issue-179-qualification-functional-fixture',
    candidateHeadSha: 'c'.repeat(40),
    protectedBaseSha: 'd'.repeat(40),
    prNumber: 268,
    runId: 123456,
    runAttempt: 1,
    environmentImage: 'mcr.microsoft.com/playwright:v1.62.0-noble',
  }), /pinned.*sha256/i);
});

test('functional qualification registry binds protected dependencies before the read-only candidate mount', () => {
  const spec = resolveProtectedPromotionQualification('fix/issue-179-qualification-functional-fixture');
  assert.deepEqual(spec.candidateCensusMount, {
    sourceTree: 'exact-candidate-checkout',
    containerRoot: '/candidate',
    readOnly: true,
    dependencySource: '/protected-e2e-node-modules/node_modules',
    dependencyTarget: 'e2e/node_modules',
    dependencyLinkPhase: 'host-before-readonly-mount',
  });
  assert.equal(Object.isFrozen(spec.candidateCensusMount), true);
});

test('functional qualification registry pins the deterministic Python compatibility shim', () => {
  const spec = resolveProtectedPromotionQualification('fix/issue-179-qualification-functional-fixture');
  assert.deepEqual(spec.deterministicRuntimeShim, {
    command: 'python',
    target: '/usr/bin/python3',
    shimRoot: '/tmp/atlas-python-bin',
    pycacheRoot: '/tmp/atlas-python-pycache',
    network: 'none',
    rootFilesystem: 'read-only',
  });
  assert.equal(Object.isFrozen(spec.deterministicRuntimeShim), true);
});

test('strict profile-none plan produces an exact zero-work execution contract', () => {
  const zero = plan({
    profile: 'none',
    requiredGroupIds: [],
    groups: [],
    stableTestIds: [],
    candidateStableIdAdditions: [],
    candidateStableIdModifications: [],
    requiredDataCapabilities: [],
    requiresRealFullWorld: false,
  });
  const result = buildProtectedHostedExecutionContract(zero, { currentHeadSha: head });
  assert.deepEqual(result.hosted.groupIds, []);
  assert.deepEqual(result.hosted.stableTestIds, []);
  assert.deepEqual(result.hosted.partitions, []);
  assert.deepEqual(result.specialist.groupIds, []);
  assert.deepEqual(result.specialist.stableTestIds, []);
  assert.deepEqual(result.review.groupIds, []);
  assert.equal(result.hostedExpectedStableTestIdsDigest, digest([]));
  assert.equal(result.specialistExpectedStableTestIdsDigest, digest([]));
});

test('empty required groups fail closed unless the protected plan is exactly profile none', () => {
  for (const overrides of [
    { requiredGroupIds: [], groups: [], stableTestIds: [] },
    { profile: 'none', requiredGroupIds: [], groups: [], stableTestIds: [hostedId] },
    { profile: 'none', requiredGroupIds: [], groups: [hostedGroup()], stableTestIds: [] },
  ]) {
    assert.throws(() => buildProtectedHostedExecutionContract(plan(overrides), { currentHeadSha: head }), /zero.work|profile.none|required group|selected group|stable/i);
  }
});
