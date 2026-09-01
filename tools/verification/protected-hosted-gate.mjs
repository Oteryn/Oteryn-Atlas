import {
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  nonEmptyString,
} from './anti-loop-common.mjs';
import { validateEvidenceManifest } from './evidence-manifest.mjs';
import { validateProtectedExecutionEnvironmentQualification } from './protected-execution-environment.mjs';
import { resolveProtectedPromotionQualification } from './protected-hosted-execution.mjs';
import { validateProtectedHostedEvidenceFanIn } from './protected-hosted-fan-in.mjs';
import {
  validateProtectedVerificationState,
  verificationStateArtifactName,
} from './protected-verification-state.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';

const EXECUTOR_WORKFLOW_PATH = '.github/workflows/protected-hosted-executor.yml';
const PRODUCER_EVENTS = new Set(['workflow_run']);
const SUCCESS_PROGRESS = new Set(['QUALIFIED', 'MERGE_READY']);

function exactPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer`);
  return value;
}

function exactArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')
    || new Set(value).size !== value.length) throw new TypeError(`${label} is invalid`);
  return [...value].sort();
}

function exactObject(value, expected, label) {
  if (canonicalJson(value) !== canonicalJson(expected)) throw new TypeError(`${label} mismatch`);
}

function validateLivePr(pr, {
  repository,
  prNumber,
  candidateHeadSha,
  protectedBaseSha,
}) {
  if (!isPlainObject(pr)
    || pr.number !== prNumber
    || pr.state !== 'open'
    || pr.merged === true
    || pr.base?.ref !== 'main'
    || pr.base?.repo?.full_name !== repository
    || pr.head?.repo?.full_name !== repository) {
    throw new TypeError('protected hosted gate live PR identity is invalid');
  }
  if (exactSha(pr.head.sha, 'protected hosted gate live PR head') !== candidateHeadSha) {
    throw new TypeError('protected hosted gate live PR head is stale');
  }
  if (exactSha(pr.base.sha, 'protected hosted gate live PR base') !== protectedBaseSha) {
    throw new TypeError('protected hosted gate live PR base is stale');
  }
  return undefined;
}

function validateProducerRun(run, state, repository) {
  if (!isPlainObject(run)
    || run.status !== 'completed'
    || run.conclusion !== 'success'
    || run.path !== EXECUTOR_WORKFLOW_PATH
    || !PRODUCER_EVENTS.has(run.event)
    || run.repository?.full_name !== repository) {
    throw new TypeError('protected hosted gate producer run is not authoritative successful executor evidence');
  }
  const runId = exactPositiveInteger(Number(run.id), 'protected hosted gate producer run ID');
  const runAttempt = exactPositiveInteger(Number(run.run_attempt), 'protected hosted gate producer run attempt');
  if (state.producer.repository !== repository
    || state.producer.runId !== runId
    || state.producer.runAttempt !== runAttempt
    || state.producer.workflowPath !== run.path
    || state.producer.event !== run.event) {
    throw new TypeError('protected hosted gate state producer identity mismatch');
  }
  return { runId, runAttempt };
}

function validateAvailability(manifest, now) {
  if (manifest.availability.revoked) throw new TypeError(`protected hosted gate evidence is revoked: ${manifest.evidenceId}`);
  if (Date.parse(manifest.availability.expiresAt) <= now) {
    throw new TypeError(`protected hosted gate evidence is expired: ${manifest.evidenceId}`);
  }
}
function expectedHostedProducts(plan, execution) {
  const capabilities = exactArray(
    execution.hosted.partitions.map(({ dataCapability }) => dataCapability),
    'protected hosted gate hosted data capabilities',
  );
  return Object.fromEntries(capabilities.map((capability) => {
    const identity = plan.productIdentities[capability];
    if (!isPlainObject(identity)) throw new TypeError(`protected hosted gate product identity is missing: ${capability}`);
    return [capability, identity];
  }));
}

function validateFanInEvidence(payload, state, now) {
  const evidence = validateEvidenceManifest(payload.evidenceManifest);
  validateAvailability(evidence, now);
  if (evidence.evidenceId !== 'FANIN:HOSTED'
    || evidence.evidenceType !== 'FANIN'
    || evidence.result !== 'SUCCESS'
    || evidence.disposition !== 'EXECUTED') {
    throw new TypeError('protected hosted gate fan-in evidence identity/result is invalid');
  }
  const { plan, execution } = state;
  if (evidence.candidateHeadSha !== plan.candidateHeadSha
    || evidence.planSemanticDigest !== plan.planSemanticDigest
    || evidence.planInstanceDigest !== plan.planInstanceDigest
    || evidence.authorityDigest !== plan.authorityDigest
    || evidence.environmentDigest !== plan.environmentDigest
    || evidence.executionPolicyDigest !== plan.executionPolicyDigest) {
    throw new TypeError('protected hosted gate fan-in evidence plan identity mismatch');
  }
  exactObject(evidence.productIdentities, expectedHostedProducts(plan, execution), 'protected hosted gate fan-in products');
  exactObject(evidence.stableTestIds, [...execution.hosted.stableTestIds].sort(), 'protected hosted gate fan-in stable IDs');
  exactObject(
    evidence.dependencies.evidenceDigests,
    state.evidenceManifests.map(({ evidenceDigest }) => evidenceDigest).sort(),
    'protected hosted gate fan-in dependency evidence bytes',
  );
  exactObject(
    evidence.dependencies.evidenceSemanticDigests,
    state.evidenceManifests.map(({ evidenceSemanticDigest }) => evidenceSemanticDigest).sort(),
    'protected hosted gate fan-in dependency semantic identities',
  );
  exactObject(evidence.dependencies.paths, [], 'protected hosted gate fan-in dependency paths');
  exactObject(
    evidence.dependencies.dataCapabilities,
    Object.keys(expectedHostedProducts(plan, execution)).sort(),
    'protected hosted gate fan-in data capabilities',
  );
  return evidence;
}
export function validateProtectedHostedGate(input) {
  if (!isPlainObject(input)) throw new TypeError('protected hosted gate input is invalid');
  const repository = nonEmptyString(input.expectedRepository, 'protected hosted gate repository');
  if (repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('protected hosted gate repository is invalid');
  const prNumber = exactPositiveInteger(input.expectedPrNumber, 'protected hosted gate PR number');
  const candidateHeadSha = exactSha(input.expectedCandidateHeadSha, 'protected hosted gate candidate head');
  const protectedBaseSha = exactSha(input.expectedProtectedBaseSha, 'protected hosted gate protected base');
  const expectedArtifactName = nonEmptyString(input.expectedArtifactName, 'protected hosted gate artifact name');
  const canonicalArtifactName = `protected-hosted-fan-in-${protectedBaseSha}-${candidateHeadSha}`;
  if (expectedArtifactName !== canonicalArtifactName) {
    throw new TypeError('protected hosted gate exact artifact name mismatch');
  }
  const now = Date.parse(input.now);
  if (!Number.isFinite(now)) throw new TypeError('protected hosted gate current time is invalid');

  const state = validateProtectedVerificationState(input.state);
  if (state.repository !== repository
    || state.prNumber !== prNumber
    || state.candidateHeadSha !== candidateHeadSha
    || state.plan.protectedBaseSha !== protectedBaseSha) {
    throw new TypeError('protected hosted gate state repository/PR/head/base identity mismatch');
  }
  if (!SUCCESS_PROGRESS.has(state.progress.status)) {
    throw new TypeError('protected hosted gate state is not qualified or merge-ready');
  }
  validateLivePr(input.livePr, {
    repository, prNumber, candidateHeadSha, protectedBaseSha,
  });
  validateProducerRun(input.producerRun, state, repository);
  if (state.plan.controller?.sourceSha !== protectedBaseSha) throw new TypeError('protected hosted gate controller authority is not the protected base');

  const payload = input.payload;
  if (!isPlainObject(payload)
    || payload.schemaVersion !== 2
    || payload.status !== 'success'
    || payload.candidateHeadSha !== candidateHeadSha
    || payload.protectedBaseSha !== protectedBaseSha
    || payload.controllerSourceSha !== state.plan.controller?.sourceSha) {
    throw new TypeError('protected hosted gate payload identity/status is invalid');
  }
  for (const [field, value] of [
    ['planSemanticDigest', state.plan.planSemanticDigest],
    ['planInstanceDigest', state.plan.planInstanceDigest],
    ['authorityDigest', state.plan.authorityDigest],
    ['environmentDigest', state.plan.environmentDigest],
  ]) {
    if (exactDigest(payload[field], `protected hosted gate payload ${field}`) !== value) {
      throw new TypeError(`protected hosted gate payload ${field} mismatch`);
    }
  }
  if (exactDigest(payload.stateDigest, 'protected hosted gate payload state digest') !== state.stateDigest) {
    throw new TypeError('protected hosted gate payload state digest mismatch');
  }
  if (payload.stateArtifactName !== verificationStateArtifactName(prNumber, candidateHeadSha)) {
    throw new TypeError('protected hosted gate payload state artifact name mismatch');
  }
  if (payload.disposition !== state.lifecycle.disposition
    || payload.heavyExecutionsRequired !== state.lifecycle.heavyExecutionsRequired) {
    throw new TypeError('protected hosted gate payload lifecycle summary mismatch');
  }

  const result = validateProtectedHostedEvidenceFanIn(
    state.plan,
    state.execution,
    state.lifecycle,
    state.evidenceManifests,
    { currentHeadSha: candidateHeadSha },
  );
  exactObject(payload.executedStableTestIds, result.executedStableTestIds, 'protected hosted gate executed stable IDs');
  exactObject(payload.executedEvidenceIds, result.executedEvidenceIds, 'protected hosted gate executed evidence IDs');
  exactObject(payload.reusedEvidenceIds, result.reusedEvidenceIds, 'protected hosted gate reused evidence IDs');
  exactObject(payload.specialistStableTestIds, state.execution.specialist.stableTestIds, 'protected hosted gate specialist IDs');
  exactObject(payload.reviewGroupIds, state.execution.review.groupIds, 'protected hosted gate review groups');

  for (const manifest of state.evidenceManifests.map(validateEvidenceManifest)) validateAvailability(manifest, now);
  validateProtectedExecutionEnvironmentQualification(
    state.environmentQualification,
    { environmentDigest: state.plan.environmentDigest },
  );
  validateFanInEvidence(payload, state, now);
  return deepFreeze({
    schemaVersion: 1,
    status: 'success',
    repository,
    prNumber,
    protectedBaseSha,
    candidateHeadSha,
    disposition: state.lifecycle.disposition,
    heavyExecutionsRequired: state.lifecycle.heavyExecutionsRequired,
    executedStableTestIds: result.executedStableTestIds,
    executedEvidenceIds: result.executedEvidenceIds,
    reusedEvidenceIds: result.reusedEvidenceIds,
    stateDigest: state.stateDigest,
    fanInEvidenceDigest: payload.evidenceManifest.evidenceDigest,
  });
}


export function validateProtectedProductQualificationGate(input) {
  if (!isPlainObject(input)) throw new TypeError('protected product qualification gate input is invalid');
  const repository = nonEmptyString(input.expectedRepository, 'protected product qualification gate repository');
  if (repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('protected product qualification gate repository is invalid');
  const prNumber = exactPositiveInteger(input.expectedPrNumber, 'protected product qualification gate PR number');
  const candidateHeadSha = exactSha(input.expectedCandidateHeadSha, 'protected product qualification gate candidate head');
  const protectedBaseSha = exactSha(input.expectedProtectedBaseSha, 'protected product qualification gate protected base');

  validateLivePr(input.livePr, {
    repository, prNumber, candidateHeadSha, protectedBaseSha,
  });
  const headRef = nonEmptyString(input.livePr.head?.ref, 'protected product qualification gate head ref');
  const qualification = resolveProtectedPromotionQualification(headRef);
  const proof = qualification.gateProof;
  if (!isPlainObject(proof) || proof.kind !== 'complete-hosted-browser-v1') {
    throw new TypeError('protected product qualification is not a complete hosted browser gate proof');
  }
  if (qualification.headRef !== headRef) throw new TypeError('protected product qualification head ref mismatch');

  const status = input.status;
  if (!isPlainObject(status)
    || status.state !== 'success'
    || status.context !== proof.statusContext
    || status.description !== proof.statusDescription
    || status.creator?.login !== 'github-actions[bot]') {
    throw new TypeError('protected product qualification commit status is not authoritative');
  }

  const run = input.producerRun;
  if (!isPlainObject(run)
    || run.status !== 'completed'
    || run.conclusion !== 'success'
    || run.path !== proof.workflowPath
    || run.event !== proof.event
    || run.repository?.full_name !== repository
    || run.head_branch !== 'main') {
    throw new TypeError('protected product qualification producer run is not authoritative');
  }
  const runId = exactPositiveInteger(Number(run.id), 'protected product qualification producer run ID');
  const runAttempt = exactPositiveInteger(Number(run.run_attempt), 'protected product qualification producer run attempt');
  if (runAttempt !== 1) throw new TypeError('protected product qualification producer run must be attempt 1');
  if (exactSha(run.head_sha, 'protected product qualification producer base') !== protectedBaseSha) {
    throw new TypeError('protected product qualification producer base is stale');
  }
  const expectedTarget = `https://github.com/${repository}/actions/runs/${runId}`;
  if (status.target_url !== expectedTarget) throw new TypeError('protected product qualification status target run mismatch');

  const associations = Array.isArray(run.pull_requests) ? run.pull_requests : [];
  const association = associations.find((item) => item?.number === prNumber);
  if (!association
    || association.head?.repo?.full_name !== repository
    || association.base?.repo?.full_name !== repository
    || exactSha(association.head?.sha, 'protected product qualification associated head') !== candidateHeadSha
    || exactSha(association.base?.sha, 'protected product qualification associated base') !== protectedBaseSha) {
    throw new TypeError('protected product qualification producer PR association mismatch');
  }

  const jobs = input.producerJobs?.jobs;
  if (!Array.isArray(jobs)) throw new TypeError('protected product qualification producer jobs are invalid');
  const proofJobs = jobs.filter((job) => job?.name === proof.jobName);
  if (proofJobs.length !== 1
    || proofJobs[0].status !== 'completed'
    || proofJobs[0].conclusion !== 'success') {
    throw new TypeError('protected product qualification complete browser proof job is not successful');
  }

  return deepFreeze({
    schemaVersion: 1,
    status: 'success',
    mode: 'protected-product-qualification',
    repository,
    prNumber,
    protectedBaseSha,
    candidateHeadSha,
    qualificationId: qualification.id,
    productDigest: qualification.expectedProductDigest,
    producerRunId: runId,
    producerRunAttempt: runAttempt,
  });
}
