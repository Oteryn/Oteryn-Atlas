import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceManifest } from '../../tools/verification/evidence-manifest.mjs';
import { REQUIRED_ENVIRONMENT_CHECKS } from '../../tools/verification/protected-execution-environment.mjs';
import { planProtectedVerificationLifecycle } from '../../tools/verification/protected-verification-lifecycle.mjs';
import { buildProtectedWorkflowSuccessState } from '../../tools/verification/protected-verification-workflow.mjs';
import { validateProtectedHostedGate } from '../../tools/verification/protected-hosted-gate.mjs';

const sha = (character) => character.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;
const NOW = '2026-08-30T12:00:00.000Z';
const IDS = ['desktop-chromium::e2e/tests/desktop.spec.mjs::loads atlas'];
const REPOSITORY = 'Oteryn/Oteryn-Atlas';

function plan(overrides = {}) {
  return {
    schemaVersion: 3,
    controller: { id: 'atlas-protected-hosted-controller-v3', version: 3, sourceSha: sha('a') },
    repository: REPOSITORY,
    prNumber: 273,
    protectedBaseSha: sha('a'),
    candidateHeadSha: sha('c'),
    planSemanticDigest: digest('1'),
    planInstanceDigest: digest('2'),
    authorityDigest: digest('3'),
    environmentDigest: digest('4'),
    executionPolicyDigest: digest('5'),
    productIdentities: {
      qualification_fixture: { id: 'atlas-qualification-world-v2', digest: digest('6') },
    },
    stableTestIds: IDS,
    workerPolicy: { hostedShards: 1 },
    ...overrides,
  };
}

function execution() {
  return {
    schemaVersion: 2,
    candidateHeadSha: sha('c'),
    controllerSourceSha: sha('a'),
    hosted: {
      stableTestIds: IDS,
      partitions: [{ dataCapability: 'qualification_fixture', stableTestIds: IDS }],
    },
    specialist: { stableTestIds: [] },
    review: { groupIds: [] },
  };
}

function environmentQualification(currentPlan) {
  return {
    schemaVersion: 1,
    status: 'QUALIFIED',
    environmentDigest: currentPlan.environmentDigest,
    checks: Object.fromEntries(REQUIRED_ENVIRONMENT_CHECKS.map((key) => [key, true])),
    probeDigest: digest('7'),
  };
}

function evidence(currentPlan, lifecycle) {
  const [environmentExpected, hostedExpected] = lifecycle.expectedEvidence;
  const environment = buildEvidenceManifest({
    ...environmentExpected,
    result: 'SUCCESS',
    disposition: 'EXECUTED',
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    runProvenance: {
      repository: REPOSITORY, runId: 100, runAttempt: 1,
      jobName: 'environment-qualification', artifactName: 'environment',
    },
    availability: { expiresAt: '2026-09-10T12:00:00.000Z', revoked: false },
  });
  const hosted = buildEvidenceManifest({
    ...hostedExpected,
    result: 'SUCCESS',
    disposition: 'EXECUTED',
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    runProvenance: {
      repository: REPOSITORY, runId: 100, runAttempt: 1,
      jobName: 'hosted-shards', artifactName: 'hosted',
    },
    dependencies: { ...hostedExpected.dependencies, evidenceDigests: [environment.evidenceDigest] },
    availability: { expiresAt: '2026-09-10T12:00:00.000Z', revoked: false },
  });
  return [environment, hosted];
}
function fixture(overrides = {}) {
  const currentPlan = overrides.plan ?? plan();
  const currentExecution = overrides.execution ?? execution();
  const lifecycle = planProtectedVerificationLifecycle({
    currentPlan,
    currentExecution,
    previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' },
    now: NOW,
  });
  const manifests = evidence(currentPlan, lifecycle);
  const producer = {
    repository: REPOSITORY,
    runId: 100,
    runAttempt: 1,
    workflowPath: '.github/workflows/protected-hosted-executor.yml',
    event: 'workflow_run',
  };
  const success = buildProtectedWorkflowSuccessState({
    currentPlan,
    currentExecution,
    lifecycle,
    evidenceManifests: manifests,
    environmentQualification: environmentQualification(currentPlan),
    previousState: null,
    currentHeadSha: currentPlan.candidateHeadSha,
    producer,
  });
  const capabilities = ['qualification_fixture'];
  const fanInEvidence = buildEvidenceManifest({
    evidenceId: 'FANIN:HOSTED', evidenceType: 'FANIN', result: 'SUCCESS', disposition: 'EXECUTED',
    candidateHeadSha: currentPlan.candidateHeadSha,
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    authorityDigest: currentPlan.authorityDigest,
    environmentDigest: currentPlan.environmentDigest,
    productIdentities: { qualification_fixture: currentPlan.productIdentities.qualification_fixture },
    stableTestIds: currentExecution.hosted.stableTestIds,
    executionPolicyDigest: currentPlan.executionPolicyDigest,
    runProvenance: {
      repository: REPOSITORY, runId: 100, runAttempt: 1,
      jobName: 'fan-in',
      artifactName: `protected-hosted-fan-in-${currentPlan.protectedBaseSha}-${currentPlan.candidateHeadSha}`,
    },
    dependencies: {
      evidenceDigests: manifests.map(({ evidenceDigest }) => evidenceDigest).sort(),
      evidenceSemanticDigests: manifests.map(({ evidenceSemanticDigest }) => evidenceSemanticDigest).sort(),
      paths: [], dataCapabilities: capabilities,
    },
    availability: { expiresAt: '2026-09-10T12:00:00.000Z', revoked: false },
  });
  const payload = {
    ...success.result,
    schemaVersion: 2,
    protectedBaseSha: currentPlan.protectedBaseSha,
    controllerSourceSha: currentPlan.controller.sourceSha,
    disposition: lifecycle.disposition,
    heavyExecutionsRequired: lifecycle.heavyExecutionsRequired,
    evidenceManifest: fanInEvidence,
    stateDigest: success.state.stateDigest,
    stateArtifactName: `protected-verification-state-pr-273-${currentPlan.candidateHeadSha}`,
    specialistStableTestIds: [],
    reviewGroupIds: [],
  };
  const livePr = {
    number: 273,
    state: 'open',
    merged: false,
    base: { ref: 'main', sha: currentPlan.protectedBaseSha, repo: { full_name: REPOSITORY } },
    head: { sha: currentPlan.candidateHeadSha, repo: { full_name: REPOSITORY } },
    labels: [],
  };
  const producerRun = {
    id: 100, run_attempt: 1, path: '.github/workflows/protected-hosted-executor.yml',
    event: 'workflow_run', status: 'completed', conclusion: 'success',
    repository: { full_name: REPOSITORY },
  };
  return {
    payload, state: success.state, livePr, producerRun,
    expectedRepository: REPOSITORY, expectedPrNumber: 273,
    expectedCandidateHeadSha: currentPlan.candidateHeadSha,
    expectedProtectedBaseSha: currentPlan.protectedBaseSha,
    expectedArtifactName: `protected-hosted-fan-in-${currentPlan.protectedBaseSha}-${currentPlan.candidateHeadSha}`,
    now: NOW,
    ...overrides,
  };
}
test('accepts exact live PR, successful producer, state bytes and mixed fan-in identities', () => {
  const result = validateProtectedHostedGate(fixture());
  assert.equal(result.status, 'success');
  assert.equal(result.candidateHeadSha, sha('c'));
  assert.deepEqual(result.executedEvidenceIds, ['HOSTED_FUNCTIONAL:SHARD_1']);
  assert.deepEqual(result.reusedEvidenceIds, []);
});

test('rejects stale PR base/head and non-authoritative producer state', () => {
  const valid = fixture();
  assert.throws(() => validateProtectedHostedGate(fixture({
    livePr: { ...valid.livePr, head: { ...valid.livePr.head, sha: sha('d') } },
  })), /head|stale/i);
  assert.throws(() => validateProtectedHostedGate(fixture({
    livePr: { ...valid.livePr, base: { ...valid.livePr.base, sha: sha('b') } },
  })), /base|stale/i);
  assert.throws(() => validateProtectedHostedGate(fixture({
    producerRun: { ...valid.producerRun, conclusion: 'failure' },
  })), /producer/i);
  assert.throws(() => validateProtectedHostedGate(fixture({
    producerRun: { ...valid.producerRun, path: '.github/workflows/ci.yml' },
  })), /producer|workflow/i);
});

test('rejects tampered state, fan-in evidence, expired evidence and wrong exact artifact name', () => {
  const valid = fixture();
  assert.throws(() => validateProtectedHostedGate(fixture({
    state: { ...valid.state, prNumber: 274 },
  })), /state|digest/i);
  assert.throws(() => validateProtectedHostedGate(fixture({
    payload: { ...valid.payload, stateDigest: digest('f') },
  })), /state/i);
  const tamperedEvidence = { ...valid.payload.evidenceManifest, planInstanceDigest: digest('f') };
  assert.throws(() => validateProtectedHostedGate(fixture({
    payload: { ...valid.payload, evidenceManifest: tamperedEvidence },
  })), /manifest|digest|identity/i);
  const expired = buildEvidenceManifest({
    ...valid.payload.evidenceManifest,
    availability: { expiresAt: '2020-01-01T00:00:00.000Z', revoked: false },
  });
  assert.throws(() => validateProtectedHostedGate(fixture({
    payload: { ...valid.payload, evidenceManifest: expired },
  })), /expired/i);
  assert.throws(() => validateProtectedHostedGate(fixture({
    expectedArtifactName: `protected-hosted-fan-in-${sha('b')}-${sha('c')}`,
  })), /artifact/i);
});

test('rejects candidate-controlled producer events and candidate controller authority', () => {
  const valid = fixture();
  assert.throws(() => validateProtectedHostedGate({
    ...valid,
    producerRun: { ...valid.producerRun, event: 'pull_request' },
  }), /producer/i);
  const candidateAuthorityPlan = plan({
    controller: { id: 'atlas-protected-hosted-controller-v3', version: 3, sourceSha: sha('c') },
  });
  assert.throws(() => validateProtectedHostedGate(fixture({ plan: candidateAuthorityPlan })), /controller|authority|base/i);
});
