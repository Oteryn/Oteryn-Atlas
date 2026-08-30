import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEvidenceManifest } from '../../tools/verification/evidence-manifest.mjs';
import {
  buildProtectedWorkflowFailureState,
  buildProtectedWorkflowSuccessState,
  decideProtectedWorkflowLifecycle,
  materializeProtectedWorkflowReuse,
} from '../../tools/verification/protected-verification-workflow.mjs';
import { buildProtectedVerificationState } from '../../tools/verification/protected-verification-state.mjs';

const sha = (character) => character.repeat(40);
const digest = (character) => `sha256:${character.repeat(64)}`;
const ids = ['desktop-chromium::e2e/tests/desktop.spec.mjs::loads atlas'];
const producer = (runId) => ({ repository: 'Oteryn/Oteryn-Atlas', runId, runAttempt: 1, workflowPath: '.github/workflows/protected-hosted-executor.yml', event: 'pull_request' });

function plan(overrides = {}) {
  return { schemaVersion: 3, repository: 'Oteryn/Oteryn-Atlas', prNumber: 273,
    protectedBaseSha: sha('a'), candidateHeadSha: sha('c'), planSemanticDigest: digest('1'),
    planInstanceDigest: digest('2'), authorityDigest: digest('3'), environmentDigest: digest('4'),
    executionPolicyDigest: digest('5'), productIdentities: { qualification_fixture: { id: 'fixture', digest: digest('6') } },
    workerPolicy: { hostedShards: 1 }, stableTestIds: ids, ...overrides };
}
function execution() { return { schemaVersion: 2, candidateHeadSha: sha('c'), hosted: { stableTestIds: ids, partitions: [{ dataCapability: 'qualification_fixture', stableTestIds: ids }] } }; }
function evidence(currentPlan, lifecycle) {
  const [environmentExpected, hostedExpected] = lifecycle.expectedEvidence;
  const environment = buildEvidenceManifest({ ...environmentExpected, result: 'SUCCESS', disposition: 'EXECUTED',
    planSemanticDigest: currentPlan.planSemanticDigest, planInstanceDigest: currentPlan.planInstanceDigest,
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 1, runAttempt: 1, jobName: 'environment', artifactName: 'environment' },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false } });
  const hosted = buildEvidenceManifest({ ...hostedExpected, result: 'SUCCESS', disposition: 'EXECUTED',
    planSemanticDigest: currentPlan.planSemanticDigest, planInstanceDigest: currentPlan.planInstanceDigest,
    dependencies: { ...hostedExpected.dependencies, evidenceDigests: [environment.evidenceDigest] },
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 1, runAttempt: 1, jobName: 'hosted', artifactName: 'hosted' },
    availability: { expiresAt: '2099-01-01T00:00:00.000Z', revoked: false } });
  return [environment, hosted];
}
function qualifiedState(currentPlan, currentExecution, lifecycle, manifests) {
  return buildProtectedVerificationState({ repository: 'Oteryn/Oteryn-Atlas', prNumber: 273, candidateHeadSha: sha('c'),
    plan: currentPlan, execution: currentExecution, lifecycle,
    progress: { schemaVersion: 1, status: 'QUALIFIED', history: [] }, evidenceManifests: manifests,
    evidenceArchive: manifests, environmentQualification: { schemaVersion: 1, status: 'QUALIFIED' }, producer: producer(1) });
}

test('workflow adapter executes once then reuses exact state with zero heavy work', () => {
  const firstPlan = plan(); const currentExecution = execution();
  const first = decideProtectedWorkflowLifecycle({ currentPlan: firstPlan, currentExecution, previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z' });
  const manifests = evidence(firstPlan, first);
  const prior = qualifiedState(firstPlan, currentExecution, first, manifests);
  const nextPlan = plan({ protectedBaseSha: sha('b'), planInstanceDigest: digest('7') });
  const next = decideProtectedWorkflowLifecycle({ currentPlan: nextPlan, currentExecution, previousState: prior,
    baseAdvance: { changedPaths: ['README.md'], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z' });
  assert.equal(next.disposition, 'REUSE'); assert.equal(next.heavyExecutionsRequired, 0);
  const reuse = materializeProtectedWorkflowReuse({ currentPlan: nextPlan, lifecycle: next, previousState: prior,
    runProvenance: { repository: 'Oteryn/Oteryn-Atlas', runId: 2, runAttempt: 1, jobName: 'reuse', artifactName: 'reuse' } });
  const success = buildProtectedWorkflowSuccessState({ currentPlan: nextPlan, currentExecution, lifecycle: next,
    evidenceManifests: reuse.evidenceManifests, environmentQualification: reuse.environmentQualification,
    previousState: prior, currentHeadSha: sha('c'), producer: producer(2) });
  assert.equal(success.state.progress.status, 'MERGE_READY');
  assert.equal(success.result.reusedEvidenceIds.length, 2);
  assert.ok(success.state.evidenceArchive.length > success.state.evidenceManifests.length);
});

test('workflow failure state preserves history and activates deterministic circuit breaker', () => {
  const currentPlan = plan(); const currentExecution = execution();
  const lifecycle = decideProtectedWorkflowLifecycle({ currentPlan, currentExecution, previousState: null,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z' });
  const first = buildProtectedWorkflowFailureState({ currentPlan, currentExecution, lifecycle, previousState: null,
    stage: 'ENVIRONMENT_QUALIFICATION', code: 'PYTHON_SHIM_MISSING', sourceOwnership: 'environment',
    currentCandidateHeadSha: sha('c'), producer: producer(1) });
  assert.equal(first.progress.status, 'BLOCKED_ENVIRONMENT');
  const secondLifecycle = decideProtectedWorkflowLifecycle({ currentPlan, currentExecution, previousState: first,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z' });
  const second = buildProtectedWorkflowFailureState({ currentPlan, currentExecution, lifecycle: secondLifecycle, previousState: first,
    stage: 'ENVIRONMENT_QUALIFICATION', code: 'PYTHON_SHIM_MISSING', sourceOwnership: 'environment',
    currentCandidateHeadSha: sha('c'), producer: producer(2) });
  assert.equal(second.progress.status, 'STALLED');
  const blocked = decideProtectedWorkflowLifecycle({ currentPlan, currentExecution, previousState: second,
    baseAdvance: { changedPaths: [], mergeStatus: 'clean' }, now: '2026-08-30T00:00:00.000Z' });
  assert.equal(blocked.disposition, 'BLOCKED'); assert.equal(blocked.heavyExecutionsRequired, 0);
});
