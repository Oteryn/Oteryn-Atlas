import {
  canonicalDigest,
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  nonEmptyString,
} from './anti-loop-common.mjs';
import { validateEvidenceManifest } from './evidence-manifest.mjs';
import { VERIFICATION_STATES } from './verification-progress-state.mjs';

const WORKFLOW_PATH = '.github/workflows/protected-hosted-executor.yml';
const EVENTS = new Set(['pull_request', 'workflow_run', 'workflow_dispatch']);

function exactPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer`);
  return value;
}

function normalizeProducer(value) {
  if (!isPlainObject(value)) throw new TypeError('verification state producer is invalid');
  const workflowPath = nonEmptyString(value.workflowPath, 'verification state workflow path');
  if (workflowPath !== WORKFLOW_PATH) throw new TypeError('verification state workflow path is not authoritative');
  const event = nonEmptyString(value.event, 'verification state producer event');
  if (!EVENTS.has(event)) throw new TypeError('verification state producer event is invalid');
  return {
    repository: nonEmptyString(value.repository, 'verification state producer repository'),
    runId: exactPositiveInteger(value.runId, 'verification state producer run ID'),
    runAttempt: exactPositiveInteger(value.runAttempt, 'verification state producer run attempt'),
    workflowPath,
    event,
  };
}

function normalizeProgress(value) {
  if (!isPlainObject(value) || value.schemaVersion !== 1 || !VERIFICATION_STATES.includes(value.status)
    || !Array.isArray(value.history)) throw new TypeError('verification state progress is invalid');
  return structuredClone(value);
}

function normalizePlan(value, candidateHeadSha) {
  if (!isPlainObject(value) || value.schemaVersion !== 3
    || exactSha(value.candidateHeadSha, 'verification state plan candidate head') !== candidateHeadSha) {
    throw new TypeError('verification state plan is invalid');
  }
  exactDigest(value.planSemanticDigest, 'verification state plan semantic digest');
  exactDigest(value.planInstanceDigest, 'verification state plan instance digest');
  exactDigest(value.authorityDigest, 'verification state authority digest');
  exactDigest(value.environmentDigest, 'verification state environment digest');
  return structuredClone(value);
}

function normalizeExecution(value, candidateHeadSha) {
  if (!isPlainObject(value) || value.schemaVersion !== 2
    || exactSha(value.candidateHeadSha, 'verification state execution candidate head') !== candidateHeadSha) {
    throw new TypeError('verification state execution is invalid');
  }
  return structuredClone(value);
}

function normalizeLifecycle(value, candidateHeadSha) {
  if (!isPlainObject(value) || value.schemaVersion !== 1
    || exactSha(value.candidateHeadSha, 'verification state lifecycle candidate head') !== candidateHeadSha
    || typeof value.disposition !== 'string') {
    throw new TypeError('verification state lifecycle decision is invalid');
  }
  return structuredClone(value);
}

function normalizeEvidence(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`);
  return value.map(validateEvidenceManifest);
}

function evidenceArchive(current, archive) {
  const byDigest = new Map();
  for (const manifest of [...archive, ...current]) {
    if (!byDigest.has(manifest.evidenceDigest)) byDigest.set(manifest.evidenceDigest, manifest);
  }
  const values = [...byDigest.values()].sort((left, right) => left.evidenceDigest.localeCompare(right.evidenceDigest));
  const available = new Set(values.map(({ evidenceDigest }) => evidenceDigest));
  for (const manifest of values) {
    for (const dependencyDigest of manifest.dependencies.evidenceDigests) {
      if (!available.has(dependencyDigest)) {
        throw new TypeError(`verification state dependency evidence bytes are unavailable: ${dependencyDigest}`);
      }
    }
    if (manifest.disposition === 'REUSED' && !available.has(manifest.sourceEvidenceDigest)) {
      throw new TypeError(`verification state reused source evidence bytes are unavailable: ${manifest.sourceEvidenceDigest}`);
    }
  }
  return values;
}

function normalizeEnvironmentQualification(value) {
  if (value === null) return null;
  if (!isPlainObject(value) || value.schemaVersion !== 1 || value.status !== 'QUALIFIED') {
    throw new TypeError('verification state environment qualification is invalid');
  }
  return structuredClone(value);
}

function normalizeCore(input) {
  if (!isPlainObject(input) || input.schemaVersion !== undefined && input.schemaVersion !== 1) {
    throw new TypeError('verification state input is invalid');
  }
  const repository = nonEmptyString(input.repository, 'verification state repository');
  if (repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('verification state repository is invalid');
  const prNumber = exactPositiveInteger(input.prNumber, 'verification state PR number');
  const candidateHeadSha = exactSha(input.candidateHeadSha, 'verification state candidate head');
  const plan = normalizePlan(input.plan, candidateHeadSha);
  if (plan.repository !== repository || plan.prNumber !== prNumber) throw new TypeError('verification state plan repository/PR mismatch');
  const execution = normalizeExecution(input.execution, candidateHeadSha);
  const lifecycle = normalizeLifecycle(input.lifecycle, candidateHeadSha);
  const progress = normalizeProgress(input.progress);
  const current = normalizeEvidence(input.evidenceManifests ?? [], 'verification state current evidence');
  const currentIds = current.map(({ evidenceId }) => evidenceId);
  if (new Set(currentIds).size !== currentIds.length) throw new TypeError('verification state current evidence IDs are duplicated');
  const archiveInput = normalizeEvidence(input.evidenceArchive ?? [], 'verification state evidence archive');
  const archive = evidenceArchive(current, archiveInput);
  const producer = normalizeProducer(input.producer);
  if (producer.repository !== repository) throw new TypeError('verification state producer repository mismatch');
  return {
    schemaVersion: 1,
    repository,
    prNumber,
    candidateHeadSha,
    plan,
    execution,
    lifecycle,
    progress,
    evidenceManifests: current,
    evidenceArchive: archive,
    environmentQualification: normalizeEnvironmentQualification(input.environmentQualification ?? null),
    producer,
  };
}

export function verificationStateArtifactName(prNumber, candidateHeadSha) {
  return `protected-verification-state-pr-${exactPositiveInteger(prNumber, 'verification state artifact PR number')}-${exactSha(candidateHeadSha, 'verification state artifact candidate head')}`;
}

export function buildProtectedVerificationState(input) {
  const core = normalizeCore(input);
  return deepFreeze({ ...core, stateDigest: canonicalDigest(core) });
}

export function validateProtectedVerificationState(candidate) {
  if (!isPlainObject(candidate) || candidate.schemaVersion !== 1) throw new TypeError('verification state schema is invalid');
  const rebuilt = buildProtectedVerificationState(candidate);
  if (exactDigest(candidate.stateDigest, 'verification state digest') !== rebuilt.stateDigest) {
    throw new TypeError('verification state digest mismatch');
  }
  return rebuilt;
}

export function availableVerificationEvidenceDigests(stateCandidate) {
  const state = validateProtectedVerificationState(stateCandidate);
  return deepFreeze(state.evidenceArchive.map(({ evidenceDigest }) => evidenceDigest).sort());
}
