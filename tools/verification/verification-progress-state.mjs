import {
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  nonEmptyString,
} from './anti-loop-common.mjs';
import { FAILURE_CLASSES } from './verification-failure-classification.mjs';

export const VERIFICATION_STATES = deepFreeze([
  'DISCOVERED',
  'AUTHORITY_PREFLIGHT',
  'ENVIRONMENT_QUALIFIED',
  'PLANNED',
  'EXECUTING',
  'FANIN',
  'QUALIFIED',
  'BASE_COMPATIBILITY',
  'MERGE_READY',
  'DONE',
  'BLOCKED_CANDIDATE',
  'BLOCKED_AUTHORITY',
  'BLOCKED_ENVIRONMENT',
  'BLOCKED_PRODUCT',
  'BLOCKED_EXTERNAL',
  'STALLED',
  'ARCHITECTURE_STABILIZATION_REQUIRED',
]);

const TRANSITIONS = Object.freeze({
  'DISCOVERED:START_AUTHORITY_PREFLIGHT': 'AUTHORITY_PREFLIGHT',
  'AUTHORITY_PREFLIGHT:ENVIRONMENT_QUALIFIED': 'ENVIRONMENT_QUALIFIED',
  'ENVIRONMENT_QUALIFIED:PLAN_BUILT': 'PLANNED',
  'PLANNED:EXECUTION_STARTED': 'EXECUTING',
  'EXECUTING:EXECUTION_COMPLETED': 'FANIN',
  'FANIN:EVIDENCE_QUALIFIED': 'QUALIFIED',
  'QUALIFIED:BASE_UNCHANGED': 'MERGE_READY',
  'QUALIFIED:BASE_ADVANCED': 'BASE_COMPATIBILITY',
  'MERGE_READY:MERGED': 'DONE',
});

const BLOCKED = Object.freeze({
  CANDIDATE_FAILURE: 'BLOCKED_CANDIDATE',
  AUTHORITY_FAILURE: 'BLOCKED_AUTHORITY',
  ENVIRONMENT_FAILURE: 'BLOCKED_ENVIRONMENT',
  PRODUCT_FAILURE: 'BLOCKED_PRODUCT',
  EXTERNAL_FAILURE: 'BLOCKED_EXTERNAL',
  STALE_CANDIDATE: 'BLOCKED_CANDIDATE',
  INTEGRATION_INCOMPATIBILITY: 'BLOCKED_CANDIDATE',
});

const CONTROL_PLANE_CLASSES = new Set(['AUTHORITY_FAILURE', 'ENVIRONMENT_FAILURE']);
const CLOSEOUT_STAGES = new Set([
  'AUTHORITY_PREFLIGHT',
  'ENVIRONMENT_QUALIFICATION',
  'FANIN',
  'BASE_COMPATIBILITY',
  'MERGE_READY',
  'CLOSEOUT',
]);

function normalizeFailure(failure) {
  if (!isPlainObject(failure) || !FAILURE_CLASSES.includes(failure.failureClass)) {
    throw new TypeError('verification progress failure class is invalid');
  }
  return {
    candidateHeadSha: exactSha(failure.candidateHeadSha, 'progress candidate head SHA'),
    planSemanticDigest: exactDigest(failure.planSemanticDigest, 'progress semantic digest'),
    failureClass: failure.failureClass,
    failureSignature: exactDigest(failure.failureSignature, 'progress failure signature'),
    stage: nonEmptyString(failure.stage, 'progress failure stage'),
    ...(failure.code === undefined ? {} : { code: nonEmptyString(failure.code, 'progress failure code') }),
  };
}

function normalizeProgress(progress) {
  if (!isPlainObject(progress) || !VERIFICATION_STATES.includes(progress.status)
    || !Array.isArray(progress.history)) {
    throw new TypeError('verification progress state is invalid');
  }
  return {
    ...progress,
    history: progress.history.map(normalizeFailure),
  };
}

function resolveFailure(progress, event) {
  const failure = normalizeFailure(event.failure);
  const history = [...progress.history, failure];
  const controlPlaneDefects = history.filter((entry) => (
    CONTROL_PLANE_CLASSES.has(entry.failureClass) && CLOSEOUT_STAGES.has(entry.stage)
  ));
  if (controlPlaneDefects.length >= 3) {
    return deepFreeze({
      ...progress,
      status: 'ARCHITECTURE_STABILIZATION_REQUIRED',
      history,
      nextAttemptAllowed: false,
      circuitBreaker: 'SERIAL_CONTROL_PLANE_DEFECTS',
    });
  }

  const identical = history.filter((entry) => (
    entry.candidateHeadSha === failure.candidateHeadSha
    && entry.planSemanticDigest === failure.planSemanticDigest
    && entry.failureClass === failure.failureClass
    && entry.failureSignature === failure.failureSignature
  ));
  if (identical.length >= 2) {
    return deepFreeze({
      ...progress,
      status: 'STALLED',
      history,
      nextAttemptAllowed: false,
      circuitBreaker: 'UNCHANGED_DETERMINISTIC_FAILURE',
    });
  }

  return deepFreeze({
    ...progress,
    status: BLOCKED[failure.failureClass],
    history,
    nextAttemptAllowed: true,
    circuitBreaker: null,
  });
}

export function advanceProgress(progressCandidate, event) {
  const progress = normalizeProgress(progressCandidate);
  if (!isPlainObject(event) || typeof event.event !== 'string') throw new TypeError('verification progress event is invalid');
  if (event.event === 'FAILED') return resolveFailure(progress, event);

  if (progress.status === 'BASE_COMPATIBILITY' && event.event === 'BASE_COMPATIBILITY_RESOLVED') {
    const disposition = event.compatibilityDisposition;
    if (disposition === 'REUSE') {
      return deepFreeze({ ...progress, status: 'MERGE_READY', heavyExecutionsRequired: 0 });
    }
    if (disposition === 'PARTIAL_RERUN') {
      const heavyExecutionsRequired = Array.isArray(event.affectedEvidenceIds)
        ? Math.max(1, event.affectedEvidenceIds.length)
        : 1;
      return deepFreeze({ ...progress, status: 'EXECUTING', heavyExecutionsRequired });
    }
    if (disposition === 'FULL_RERUN') {
      const heavyExecutionsRequired = event.heavyExecutionsRequired;
      if (heavyExecutionsRequired !== undefined
        && (!Number.isInteger(heavyExecutionsRequired) || heavyExecutionsRequired < 1)) {
        throw new TypeError('full rerun heavy execution count must be a positive integer when known');
      }
      return deepFreeze({
        ...progress,
        status: 'EXECUTING',
        heavyExecutionsRequired: heavyExecutionsRequired ?? null,
      });
    }
    if (disposition === 'REINTEGRATE') {
      return deepFreeze({ ...progress, status: 'BLOCKED_CANDIDATE', nextAttemptAllowed: false, candidateMutationRequired: true });
    }
    throw new TypeError('base compatibility disposition is invalid');
  }

  const next = TRANSITIONS[`${progress.status}:${event.event}`];
  if (!next) throw new TypeError(`invalid verification progress transition: ${progress.status} -> ${event.event}`);
  return deepFreeze({ ...progress, status: next });
}
