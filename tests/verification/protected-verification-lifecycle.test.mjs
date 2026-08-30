import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceManifest } from '../../tools/verification/evidence-manifest.mjs';
import {
  buildQualifiedProgress,
  materializeReusedEvidence,
  planProtectedVerificationLifecycle,
  recordWorkflowFailure,
} from '../../tools/verification/protected-verification-lifecycle.mjs';

const sha = (character) => character.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;
const NOW = '2026-08-30T12:00:00.000Z';
const EXPIRES = '2026-09-10T12:00:00.000Z';
const IDS = [
  'desktop-chromium::e2e/tests/desktop.spec.mjs::loads atlas',
  'mobile-chromium::e2e/tests/mobile.spec.mjs::loads atlas',
];

function plan({
  base = sha('a'),
  candidate = sha('c'),
  semantic = digest('1'),
  instance = digest('2'),
  authority = digest('3'),
  environment = digest('4'),
  product = digest('5'),
} = {}) {
  return {
    schemaVersion: 3,
    protectedBaseSha: base,
    candidateHeadSha: candidate,
    planSemanticDigest: semantic,
    planInstanceDigest: instance,
    authorityDigest: authority,
    environmentDigest: environment,
    executionPolicyDigest: digest('6'),
    productIdentities: {
      qualification_fixture: { id: 'atlas-qualification-world-v2', digest: product },
    },
    stableTestIds: IDS,
    workerPolicy: { hostedShards: 1 },
  };
}

function execution() {
  return {
    schemaVersion: 2,
    hosted: {
      stableTestIds: IDS,
      partitions: [{
        dataCapability: 'qualification_fixture',
        stableTestIds: IDS,
      }],
    },
  };
}

function evidence(currentPlan = plan()) {
  const environment = buildEvidenceManifest({
    evidenceId: 'ENVIRONMENT_QUALIFICATION',
    evidenceType: 'ENVIRONMENT_QUALIFICATION',
    result: 'SUCCESS',
    disposition: 'EXECUTED',
    candidateHeadSha: currentPlan.candidateHeadSha,
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    authorityDigest: currentPlan.authorityDigest,
    environmentDigest: currentPlan.environmentDigest,
    productIdentities: {},
    stableTestIds: [],
    executionPolicyDigest: currentPlan.executionPolicyDigest,
    runProvenance: {
      repository: 'Oteryn/Oteryn-Atlas', runId: 100, runAttempt: 1,
      jobName: 'environment-qualification', artifactName: 'environment',
    },
    dependencies: {
      evidenceDigests: [],
      paths: ['tools/verification/protected-execution-environment-probe.mjs', 'tools/verification/protected-execution-environment.json'],
      dataCapabilities: [],
    },
    availability: { expiresAt: EXPIRES, revoked: false },
  });
  const hosted = buildEvidenceManifest({
    evidenceId: 'HOSTED_FUNCTIONAL:SHARD_1',
    evidenceType: 'HOSTED_FUNCTIONAL',
    result: 'SUCCESS',
    disposition: 'EXECUTED',
    candidateHeadSha: currentPlan.candidateHeadSha,
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    authorityDigest: currentPlan.authorityDigest,
    environmentDigest: currentPlan.environmentDigest,
    productIdentities: currentPlan.productIdentities,
    stableTestIds: IDS,
    executionPolicyDigest: currentPlan.executionPolicyDigest,
    runProvenance: {
      repository: 'Oteryn/Oteryn-Atlas', runId: 100, runAttempt: 1,
      jobName: 'hosted-shards', artifactName: 'hosted-shard-1',
    },
    dependencies: {
      evidenceDigests: [environment.evidenceDigest],
      evidenceSemanticDigests: [environment.evidenceSemanticDigest],
      paths: [],
      dataCapabilities: ['qualification_fixture'],
    },
    availability: { expiresAt: EXPIRES, revoked: false },
  });
  return { environment, hosted };
}

function previousState(previousPlan = plan(), overrides = {}) {
  const manifests = evidence(previousPlan);
  return {
    schemaVersion: 1,
    plan: previousPlan,
    execution: execution(),
    progress: buildQualifiedProgress({ schemaVersion: 1, status: 'FANIN', history: [] }),
    evidenceManifests: [manifests.environment, manifests.hosted],
    ...overrides,
  };
}

function available(state) {
  return state.evidenceManifests.flatMap((manifest) => [manifest.evidenceDigest, ...manifest.dependencies.evidenceDigests]);
}

test('first qualification executes environment and hosted evidence', () => {
  const decision = planProtectedVerificationLifecycle({
    currentPlan: plan(), currentExecution: execution(), previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: NOW,
  });
  assert.equal(decision.disposition, 'FULL_RERUN');
  assert.equal(decision.executeEnvironment, true);
  assert.deepEqual(decision.executeHostedEvidenceIds, ['HOSTED_FUNCTIONAL:SHARD_1']);
  assert.equal(decision.heavyExecutionsRequired, 1);
  assert.deepEqual(decision.reuseEvidenceIds, []);
});

test('qualified candidate plus unrelated base advance reuses exact evidence with zero heavy execution', () => {
  const prior = previousState();
  const current = plan({ base: sha('b'), instance: digest('7') });
  const decision = planProtectedVerificationLifecycle({
    currentPlan: current,
    currentExecution: execution(),
    previousState: prior,
    baseAdvance: { changedPaths: ['docs/operations/readme.md'], mergeStatus: 'clean' },
    availableEvidenceDigests: available(prior),
    now: NOW,
  });
  assert.equal(decision.candidateHeadSha, prior.plan.candidateHeadSha);
  assert.equal(decision.disposition, 'REUSE');
  assert.equal(decision.executeEnvironment, false);
  assert.deepEqual(decision.executeHostedEvidenceIds, []);
  assert.deepEqual(decision.reuseEvidenceIds, ['ENVIRONMENT_QUALIFICATION', 'HOSTED_FUNCTIONAL:SHARD_1']);
  assert.equal(decision.heavyExecutionsRequired, 0);

  const rebound = materializeReusedEvidence({
    currentPlan: current,
    decision,
    sourceEvidenceManifests: prior.evidenceManifests,
    runProvenance: {
      repository: 'Oteryn/Oteryn-Atlas', runId: 101, runAttempt: 1,
      jobName: 'preflight', artifactName: 'protected-verification-state-pr-1-head',
    },
  });
  assert.equal(rebound.length, 2);
  assert.ok(rebound.every((manifest) => manifest.disposition === 'REUSED'));
  assert.ok(rebound.every((manifest) => manifest.planInstanceDigest === current.planInstanceDigest));
  assert.deepEqual(rebound[1].dependencies.evidenceDigests, [rebound[0].evidenceDigest]);
});

test('product-only base movement reuses environment but reruns only hosted evidence', () => {
  const prior = previousState();
  const current = plan({
    base: sha('b'), semantic: digest('8'), instance: digest('9'), product: digest('a'),
  });
  const decision = planProtectedVerificationLifecycle({
    currentPlan: current,
    currentExecution: execution(),
    previousState: prior,
    baseAdvance: { changedPaths: ['data/bounded-world/source.bin'], mergeStatus: 'clean' },
    availableEvidenceDigests: available(prior),
    now: NOW,
  });
  assert.equal(decision.disposition, 'PARTIAL_RERUN');
  assert.equal(decision.executeEnvironment, false);
  assert.deepEqual(decision.executeHostedEvidenceIds, ['HOSTED_FUNCTIONAL:SHARD_1']);
  assert.deepEqual(decision.reuseEvidenceIds, ['ENVIRONMENT_QUALIFICATION']);
  assert.equal(decision.heavyExecutionsRequired, 1);
});

test('authority change forces full rerun and merge conflict requires reintegration', () => {
  const prior = previousState();
  const authorityChanged = plan({ base: sha('b'), semantic: digest('8'), instance: digest('9'), authority: digest('a') });
  const full = planProtectedVerificationLifecycle({
    currentPlan: authorityChanged, currentExecution: execution(), previousState: prior,
    baseAdvance: { changedPaths: ['tools/verification/stable-id.mjs'], mergeStatus: 'clean' },
    availableEvidenceDigests: available(prior), now: NOW,
  });
  assert.equal(full.disposition, 'FULL_RERUN');
  assert.equal(full.heavyExecutionsRequired, 1);

  const conflict = planProtectedVerificationLifecycle({
    currentPlan: plan({ base: sha('b'), instance: digest('7') }), currentExecution: execution(), previousState: prior,
    baseAdvance: { changedPaths: ['src/browser/runtime.mjs'], mergeStatus: 'conflict' },
    availableEvidenceDigests: available(prior), now: NOW,
  });
  assert.equal(conflict.disposition, 'REINTEGRATE');
  assert.equal(conflict.candidateMutationRequired, true);
  assert.equal(conflict.heavyExecutionsRequired, 0);
});

test('revoked, unavailable or dependency-missing evidence executes rather than reuses', () => {
  const revoked = previousState();
  revoked.evidenceManifests = revoked.evidenceManifests.map((manifest) => (
    manifest.evidenceId === 'ENVIRONMENT_QUALIFICATION'
      ? buildEvidenceManifest({ ...manifest, availability: { ...manifest.availability, revoked: true } })
      : manifest
  ));
  const current = plan({ base: sha('b'), instance: digest('7') });
  const decision = planProtectedVerificationLifecycle({
    currentPlan: current, currentExecution: execution(), previousState: revoked,
    baseAdvance: { changedPaths: ['README.md'], mergeStatus: 'clean' },
    availableEvidenceDigests: available(revoked), now: NOW,
  });
  assert.equal(decision.disposition, 'FULL_RERUN');
  assert.equal(decision.executeEnvironment, true);
  assert.equal(decision.heavyExecutionsRequired, 1);

  const prior = previousState();
  const unavailable = planProtectedVerificationLifecycle({
    currentPlan: current, currentExecution: execution(), previousState: prior,
    baseAdvance: { changedPaths: ['README.md'], mergeStatus: 'clean' },
    availableEvidenceDigests: [prior.evidenceManifests[1].evidenceDigest], now: NOW,
  });
  assert.equal(unavailable.disposition, 'FULL_RERUN');
});

test('actual workflow failures feed ownership and executable circuit breakers', () => {
  const currentPlan = plan();
  let progress = { schemaVersion: 1, status: 'EXECUTING', history: [] };
  progress = recordWorkflowFailure({
    progress, currentPlan, stage: 'ENVIRONMENT_QUALIFICATION', code: 'PYTHON_SHIM_MISSING',
    sourceOwnership: 'environment', currentCandidateHeadSha: currentPlan.candidateHeadSha,
  });
  assert.equal(progress.status, 'BLOCKED_ENVIRONMENT');
  assert.equal(progress.candidateMutationAllowed, false);

  progress = recordWorkflowFailure({
    progress: { ...progress, status: 'EXECUTING' }, currentPlan,
    stage: 'ENVIRONMENT_QUALIFICATION', code: 'PYTHON_SHIM_MISSING',
    sourceOwnership: 'environment', currentCandidateHeadSha: currentPlan.candidateHeadSha,
  });
  assert.equal(progress.status, 'STALLED');
  assert.equal(progress.nextAttemptAllowed, false);

  const blocked = planProtectedVerificationLifecycle({
    currentPlan, currentExecution: execution(),
    previousState: previousState(currentPlan, { progress }),
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: NOW,
  });
  assert.equal(blocked.disposition, 'BLOCKED');
  assert.equal(blocked.heavyExecutionsRequired, 0);
  assert.equal(blocked.circuitBreaker, 'UNCHANGED_DETERMINISTIC_FAILURE');
});
