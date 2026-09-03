import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceManifest } from '../../tools/verification/evidence-manifest.mjs';
import { validateProtectedHostedEvidenceFanIn } from '../../tools/verification/protected-hosted-fan-in.mjs';
import {
  materializeReusedEvidence,
  planProtectedVerificationLifecycle,
} from '../../tools/verification/protected-verification-lifecycle.mjs';

const sha = (character) => character.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;
const ids = ['desktop-chromium::e2e/tests/desktop.spec.mjs::loads atlas'];

function plan(overrides = {}) {
  return {
    schemaVersion: 3,
    repository: 'Oteryn/Oteryn-Atlas',
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
    stableTestIds: ids,
    workerPolicy: { hostedShards: 1 },
    ...overrides,
  };
}

function execution() {
  return {
    schemaVersion: 2,
    candidateHeadSha: sha('c'),
    hosted: {
      stableTestIds: ids,
      partitions: [{ dataCapability: 'qualification_fixture', stableTestIds: ids }],
    },
  };
}

function executedEvidence(currentPlan, lifecycle) {
  const [environmentExpected, hostedExpected] = lifecycle.expectedEvidence;
  const environment = buildEvidenceManifest({
    ...environmentExpected,
    result: 'SUCCESS', disposition: 'EXECUTED',
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 100, runAttempt: 1, jobName: 'environment', artifactName: 'environment' },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false },
  });
  const hosted = buildEvidenceManifest({
    ...hostedExpected,
    result: 'SUCCESS', disposition: 'EXECUTED',
    planSemanticDigest: currentPlan.planSemanticDigest,
    planInstanceDigest: currentPlan.planInstanceDigest,
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 100, runAttempt: 1, jobName: 'hosted-shards', artifactName: 'hosted-shard-1' },
    dependencies: {
      ...hostedExpected.dependencies,
      evidenceDigests: [environment.evidenceDigest],
    },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false },
  });
  return [environment, hosted];
}

test('exact EXECUTED evidence satisfies the same versioned fan-in path', () => {
  const currentPlan = plan();
  const currentExecution = execution();
  const lifecycle = planProtectedVerificationLifecycle({
    currentPlan, currentExecution, previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z',
  });
  const result = validateProtectedHostedEvidenceFanIn(
    currentPlan, currentExecution, lifecycle, executedEvidence(currentPlan, lifecycle),
    { currentHeadSha: currentPlan.candidateHeadSha },
  );
  assert.equal(result.status, 'success');
  assert.deepEqual(result.executedEvidenceIds, ['HOSTED_FUNCTIONAL:SHARD_1']);
  assert.deepEqual(result.reusedEvidenceIds, []);
  assert.deepEqual(result.executedStableTestIds, ids);
  assert.deepEqual(result.evidenceSummary, {
    expectedEvidenceIds: ['ENVIRONMENT_QUALIFICATION', 'HOSTED_FUNCTIONAL:SHARD_1'],
    executedEvidenceIds: ['ENVIRONMENT_QUALIFICATION', 'HOSTED_FUNCTIONAL:SHARD_1'],
    reusedEvidenceIds: [],
    missingEvidenceIds: [],
    unexpectedEvidenceIds: [],
    stableTestIds: { planned: 1, executed: 1, reused: 0, missing: 0, unexpected: 0 },
  });
});

test('rebound REUSED evidence satisfies the same fan-in while preserving exact current instance identity', () => {
  const previousPlan = plan();
  const currentPlan = plan({ protectedBaseSha: sha('b'), planInstanceDigest: digest('7') });
  const currentExecution = execution();
  const priorDecision = planProtectedVerificationLifecycle({
    currentPlan: previousPlan, currentExecution, previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z',
  });
  const sources = executedEvidence(previousPlan, priorDecision);
  const previousState = {
    schemaVersion: 1, plan: previousPlan, execution: currentExecution,
    progress: { schemaVersion: 1, status: 'QUALIFIED', history: [] },
    evidenceManifests: sources,
  };
  const lifecycle = planProtectedVerificationLifecycle({
    currentPlan, currentExecution, previousState,
    baseAdvance: { changedPaths: ['README.md'], mergeStatus: 'clean' },
    availableEvidenceDigests: sources.flatMap((manifest) => [manifest.evidenceDigest, ...manifest.dependencies.evidenceDigests]),
    now: '2026-08-30T00:00:00.000Z',
  });
  assert.equal(lifecycle.disposition, 'REUSE');
  const reused = materializeReusedEvidence({
    currentPlan, decision: lifecycle, sourceEvidenceManifests: sources,
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 101, runAttempt: 1, jobName: 'reuse-evidence', artifactName: 'reuse' },
  });
  const result = validateProtectedHostedEvidenceFanIn(
    currentPlan, currentExecution, lifecycle, reused,
    { currentHeadSha: currentPlan.candidateHeadSha },
  );
  assert.deepEqual(result.executedEvidenceIds, []);
  assert.deepEqual(result.reusedEvidenceIds, ['ENVIRONMENT_QUALIFICATION', 'HOSTED_FUNCTIONAL:SHARD_1']);
  assert.deepEqual(result.evidenceSummary, {
    expectedEvidenceIds: ['ENVIRONMENT_QUALIFICATION', 'HOSTED_FUNCTIONAL:SHARD_1'],
    executedEvidenceIds: [],
    reusedEvidenceIds: ['ENVIRONMENT_QUALIFICATION', 'HOSTED_FUNCTIONAL:SHARD_1'],
    missingEvidenceIds: [],
    unexpectedEvidenceIds: [],
    stableTestIds: { planned: 1, executed: 0, reused: 1, missing: 0, unexpected: 0 },
  });
  assert.ok(reused.every((manifest) => manifest.planInstanceDigest === currentPlan.planInstanceDigest));
});

test('missing, duplicate, stale-instance or broken dependency evidence fails closed', () => {
  const currentPlan = plan();
  const currentExecution = execution();
  const lifecycle = planProtectedVerificationLifecycle({
    currentPlan, currentExecution, previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z',
  });
  const manifests = executedEvidence(currentPlan, lifecycle);
  assert.throws(() => validateProtectedHostedEvidenceFanIn(currentPlan, currentExecution, lifecycle, manifests.slice(0, 1), { currentHeadSha: currentPlan.candidateHeadSha }), /exact evidence set/i);
  assert.throws(() => validateProtectedHostedEvidenceFanIn(currentPlan, currentExecution, lifecycle, [...manifests, manifests[1]], { currentHeadSha: currentPlan.candidateHeadSha }), /duplicate/i);
  const stale = buildEvidenceManifest({ ...manifests[1], planInstanceDigest: digest('9') });
  assert.throws(() => validateProtectedHostedEvidenceFanIn(currentPlan, currentExecution, lifecycle, [manifests[0], stale], { currentHeadSha: currentPlan.candidateHeadSha }), /identity/i);
  const broken = buildEvidenceManifest({ ...manifests[1], dependencies: { ...manifests[1].dependencies, evidenceDigests: [] } });
  assert.throws(() => validateProtectedHostedEvidenceFanIn(currentPlan, currentExecution, lifecycle, [manifests[0], broken], { currentHeadSha: currentPlan.candidateHeadSha }), /dependency/i);
});

test('zero-work lifecycle fan-in succeeds only with an exact empty evidence set', () => {
  const currentPlan = plan({ stableTestIds: [], profile: 'none' });
  const currentExecution = {
    schemaVersion: 2,
    candidateHeadSha: sha('c'),
    hosted: { stableTestIds: [], partitions: [] },
    specialist: { stableTestIds: [] },
    review: { groupIds: [] },
  };
  const lifecycle = planProtectedVerificationLifecycle({
    currentPlan, currentExecution, previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z',
  });
  const result = validateProtectedHostedEvidenceFanIn(
    currentPlan, currentExecution, lifecycle, [], { currentHeadSha: currentPlan.candidateHeadSha },
  );
  assert.equal(result.status, 'success');
  assert.deepEqual(result.executedStableTestIds, []);
  assert.deepEqual(result.executedEvidenceIds, []);
  assert.deepEqual(result.reusedEvidenceIds, []);
  assert.deepEqual(result.evidenceSummary, {
    expectedEvidenceIds: [], executedEvidenceIds: [], reusedEvidenceIds: [], missingEvidenceIds: [], unexpectedEvidenceIds: [],
    stableTestIds: { planned: 0, executed: 0, reused: 0, missing: 0, unexpected: 0 },
  });
  assert.throws(() => validateProtectedHostedEvidenceFanIn(
    currentPlan, currentExecution, lifecycle, executedEvidence(plan(), planProtectedVerificationLifecycle({
      currentPlan: plan(), currentExecution: execution(), previousState: null,
      baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z',
    })), { currentHeadSha: currentPlan.candidateHeadSha },
  ), /exact evidence set|zero.work/i);
});
