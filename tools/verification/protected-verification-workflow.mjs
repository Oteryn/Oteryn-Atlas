import { deepFreeze, isPlainObject } from './anti-loop-common.mjs';
import { validateProtectedHostedEvidenceFanIn } from './protected-hosted-fan-in.mjs';
import {
  materializeReusedEvidence,
  planProtectedVerificationLifecycle,
  recordWorkflowFailure,
} from './protected-verification-lifecycle.mjs';
import {
  availableVerificationEvidenceDigests,
  buildProtectedVerificationState,
  validateProtectedVerificationState,
} from './protected-verification-state.mjs';

function optionalState(candidate) {
  return candidate === null || candidate === undefined ? null : validateProtectedVerificationState(candidate);
}

export function decideProtectedWorkflowLifecycle(input) {
  if (!isPlainObject(input)) throw new TypeError('protected workflow lifecycle input is invalid');
  const previousState = optionalState(input.previousState);
  return planProtectedVerificationLifecycle({
    currentPlan: input.currentPlan,
    currentExecution: input.currentExecution,
    previousState,
    baseAdvance: input.baseAdvance,
    availableEvidenceDigests: previousState ? availableVerificationEvidenceDigests(previousState) : [],
    now: input.now,
  });
}

export function materializeProtectedWorkflowReuse(input) {
  if (!isPlainObject(input)) throw new TypeError('protected workflow reuse input is invalid');
  const previousState = validateProtectedVerificationState(input.previousState);
  const evidenceManifests = materializeReusedEvidence({
    currentPlan: input.currentPlan,
    decision: input.lifecycle,
    sourceEvidenceManifests: previousState.evidenceManifests,
    runProvenance: input.runProvenance,
  });
  const environmentReused = evidenceManifests.some(({ evidenceId }) => evidenceId === 'ENVIRONMENT_QUALIFICATION');
  if (environmentReused && previousState.environmentQualification === null) {
    throw new TypeError('reused environment evidence has no exact qualification bytes');
  }
  return deepFreeze({
    evidenceManifests,
    environmentQualification: environmentReused ? previousState.environmentQualification : null,
    evidenceArchive: previousState.evidenceArchive,
  });
}

function mergedArchive(previousState, currentEvidence) {
  return [
    ...(previousState?.evidenceArchive ?? []),
    ...(previousState?.evidenceManifests ?? []),
    ...currentEvidence,
  ];
}

export function buildProtectedWorkflowSuccessState(input) {
  if (!isPlainObject(input)) throw new TypeError('protected workflow success-state input is invalid');
  const previousState = optionalState(input.previousState);
  const result = validateProtectedHostedEvidenceFanIn(
    input.currentPlan,
    input.currentExecution,
    input.lifecycle,
    input.evidenceManifests,
    { currentHeadSha: input.currentHeadSha },
  );
  const progress = {
    schemaVersion: 1,
    status: input.lifecycle.disposition === 'REUSE' ? 'MERGE_READY' : 'QUALIFIED',
    history: Array.isArray(input.lifecycle.progress?.history) ? input.lifecycle.progress.history : [],
    heavyExecutionsRequired: input.lifecycle.heavyExecutionsRequired,
  };
  return deepFreeze({
    result,
    state: buildProtectedVerificationState({
      repository: input.currentPlan.repository,
      prNumber: input.currentPlan.prNumber,
      candidateHeadSha: input.currentPlan.candidateHeadSha,
      plan: input.currentPlan,
      execution: input.currentExecution,
      lifecycle: input.lifecycle,
      progress,
      evidenceManifests: input.evidenceManifests,
      evidenceArchive: mergedArchive(previousState, input.evidenceManifests),
      environmentQualification: input.environmentQualification,
      producer: input.producer,
    }),
  });
}

export function buildProtectedWorkflowFailureState(input) {
  if (!isPlainObject(input)) throw new TypeError('protected workflow failure-state input is invalid');
  const previousState = optionalState(input.previousState);
  const baseProgress = isPlainObject(input.lifecycle?.progress)
    ? input.lifecycle.progress
    : { schemaVersion: 1, status: 'EXECUTING', history: previousState?.progress?.history ?? [] };
  const progress = recordWorkflowFailure({
    progress: { ...baseProgress, status: 'EXECUTING', history: baseProgress.history ?? [] },
    currentPlan: input.currentPlan,
    stage: input.stage,
    code: input.code,
    sourceOwnership: input.sourceOwnership,
    currentCandidateHeadSha: input.currentCandidateHeadSha,
    integrationCompatible: input.integrationCompatible,
  });
  const evidenceManifests = Array.isArray(input.evidenceManifests)
    ? input.evidenceManifests
    : previousState?.evidenceManifests ?? [];
  return buildProtectedVerificationState({
    repository: input.currentPlan.repository,
    prNumber: input.currentPlan.prNumber,
    candidateHeadSha: input.currentPlan.candidateHeadSha,
    plan: input.currentPlan,
    execution: input.currentExecution,
    lifecycle: input.lifecycle,
    progress,
    evidenceManifests,
    evidenceArchive: mergedArchive(previousState, evidenceManifests),
    environmentQualification: input.environmentQualification ?? previousState?.environmentQualification ?? null,
    producer: input.producer,
  });
}
