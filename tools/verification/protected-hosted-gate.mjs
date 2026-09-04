import {
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  nonEmptyString,
} from './anti-loop-common.mjs';
import { validateEvidenceManifest } from './evidence-manifest.mjs';
import { validateProtectedExecutionEnvironmentQualification } from './protected-execution-environment.mjs';
import { validateProtectedHostedEvidenceFanIn } from './protected-hosted-fan-in.mjs';
import {
  validateProtectedVerificationState,
  verificationStateArtifactName,
} from './protected-verification-state.mjs';
import { canonicalJson } from './verification-plan-schema.mjs';

const EXECUTOR_WORKFLOW_PATH = '.github/workflows/protected-hosted-executor.yml';
const QUALIFICATION_REPAIR_WORKFLOW_PATH = '.github/workflows/protected-qualification-repair.yml';
const QUALIFICATION_REPAIR_STATUS_CONTEXT = 'atlas-protected-product-qualification';
const QUALIFICATION_REPAIR_STATUS_DESCRIPTION = 'Protected GitHub-hosted qualification repair safety net';
const QUALIFICATION_REPAIR_JOB_NAME = 'Protected qualification repair';
const PRODUCER_EVENTS = new Set(['workflow_run', 'workflow_dispatch']);
const SUCCESS_PROGRESS = new Set(['QUALIFIED', 'MERGE_READY']);

function exactPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${label} must be a positive integer`);
  return value;
}

function validateAssociatedRepository(repo, liveRepo, expectedRepository, label) {
  if (!isPlainObject(repo)) throw new TypeError(`${label} is invalid`);
  if (Object.hasOwn(repo, 'id')) {
    const repositoryId = exactPositiveInteger(repo.id, `${label} ID`);
    const liveRepositoryId = exactPositiveInteger(liveRepo?.id, `${label} live PR ID`);
    if (repositoryId !== liveRepositoryId) throw new TypeError(`${label} ID mismatch`);
  } else if (repo.full_name !== expectedRepository) {
    throw new TypeError(`${label} full name mismatch`);
  }
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
  requireBaseSha = true,
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
  if (requireBaseSha && exactSha(pr.base.sha, 'protected hosted gate live PR base') !== protectedBaseSha) {
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
    repository, prNumber, candidateHeadSha, protectedBaseSha, requireBaseSha: false,
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
  if (!isPlainObject(input)) throw new TypeError('protected qualification repair gate input is invalid');
  const repository = nonEmptyString(input.expectedRepository, 'protected qualification repair gate repository');
  if (repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('protected qualification repair gate repository is invalid');
  const prNumber = exactPositiveInteger(input.expectedPrNumber, 'protected qualification repair gate PR number');
  const candidateHeadSha = exactSha(input.expectedCandidateHeadSha, 'protected qualification repair gate candidate head');
  const protectedBaseSha = exactSha(input.expectedProtectedBaseSha, 'protected qualification repair gate protected base');

  validateLivePr(input.livePr, { repository, prNumber, candidateHeadSha, protectedBaseSha });
  const candidateHeadRef = nonEmptyString(input.livePr?.head?.ref, 'protected qualification repair candidate head ref');

  const status = input.status;
  if (!isPlainObject(status)
    || status.state !== 'success'
    || status.context !== QUALIFICATION_REPAIR_STATUS_CONTEXT
    || status.description !== QUALIFICATION_REPAIR_STATUS_DESCRIPTION
    || status.creator?.login !== 'github-actions[bot]') {
    throw new TypeError('protected qualification repair commit status is not authoritative');
  }

  const run = input.producerRun;
  if (!isPlainObject(run)
    || run.status !== 'completed'
    || run.conclusion !== 'success'
    || run.path !== QUALIFICATION_REPAIR_WORKFLOW_PATH
    || run.event !== 'pull_request_target'
    || run.repository?.full_name !== repository) {
    throw new TypeError('protected qualification repair producer run is not authoritative');
  }
  const runId = exactPositiveInteger(Number(run.id), 'protected qualification repair producer run ID');
  const runAttempt = exactPositiveInteger(Number(run.run_attempt), 'protected qualification repair producer run attempt');
  if (runAttempt !== 1) throw new TypeError('protected qualification repair producer run must be attempt 1');
  const producerHeadSha = exactSha(run.head_sha, 'protected qualification repair producer head');
  const candidateRunIdentity = run.head_branch === candidateHeadRef && producerHeadSha === candidateHeadSha;
  const protectedBaseRunIdentity = run.head_branch === 'main' && producerHeadSha === protectedBaseSha;
  if (!candidateRunIdentity && !protectedBaseRunIdentity) {
    throw new TypeError('protected qualification repair producer head is stale');
  }
  const expectedTarget = `https://github.com/${repository}/actions/runs/${runId}`;
  if (status.target_url !== expectedTarget) throw new TypeError('protected qualification repair status target run mismatch');

  const associations = Array.isArray(run.pull_requests) ? run.pull_requests : [];
  const association = associations.find((item) => item?.number === prNumber);
  if (!association) throw new TypeError('protected qualification repair producer PR association mismatch');
  validateAssociatedRepository(
    association.head?.repo,
    input.livePr?.head?.repo,
    repository,
    'protected qualification repair associated head repository',
  );
  validateAssociatedRepository(
    association.base?.repo,
    input.livePr?.base?.repo,
    repository,
    'protected qualification repair associated base repository',
  );
  if (exactSha(association.head?.sha, 'protected qualification repair associated head') !== candidateHeadSha
    || exactSha(association.base?.sha, 'protected qualification repair associated base') !== protectedBaseSha) {
    throw new TypeError('protected qualification repair producer PR association mismatch');
  }

  const jobs = input.producerJobs?.jobs;
  if (!Array.isArray(jobs)) throw new TypeError('protected qualification repair producer jobs are invalid');
  const proofJobs = jobs.filter((job) => job?.name === QUALIFICATION_REPAIR_JOB_NAME);
  if (proofJobs.length !== 1
    || proofJobs[0].status !== 'completed'
    || proofJobs[0].conclusion !== 'success') {
    throw new TypeError('protected qualification repair proof job is not successful');
  }

  return deepFreeze({
    schemaVersion: 1,
    status: 'success',
    mode: 'protected-qualification-repair',
    repository,
    prNumber,
    protectedBaseSha,
    candidateHeadSha,
    producerRunId: runId,
    producerRunAttempt: runAttempt,
  });
}

const LEGACY_TRANSITION_BOOTSTRAP = deepFreeze({
  id: 'authority-repin-recovery-stabilization-v1',
  protectedBaseSha: 'e31015d0880e9f81a4b96f990658490af45e8fa6',
  headRef: 'feat/issue-179-legacy-transition-qualifier',
  workflowPath: '.github/workflows/legacy-molehill-transition-qualification.yml',
  event: 'pull_request',
  heavyJobName: 'Capture exact-head legacy transition evidence',
  allowedNonEvidenceFailureJobName: 'Publish reviewed atlas-local-e2e transition status',
  prNumber: 303,
  changedFiles: [
    '.github/workflows/ci.yml',
    '.github/workflows/merge-authority-audit.yml',
    '.github/workflows/merge-group-gate.yml',
    '.github/workflows/protected-execution-promotion-qualification.yml',
    'docs/migration/legacy-atlas-extraction-provenance.json',
    'tests/verification/ci-workflow-contract.test.mjs',
    'tests/verification/merge-queue-gate-contract.test.mjs',
    'tests/verification/pr-browser-trust.test.mjs',
    'tests/verification/protected-anti-loop-workflow-integration.test.mjs',
    'tests/verification/protected-authority-repin-recovery.test.mjs',
    'tests/verification/protected-hosted-execution.test.mjs',
    'tests/verification/selfhosted-compose-contract.test.mjs',
    'tools/governance/verify_extraction_provenance.py',
    'tools/verification/protected-hosted-execution.mjs',
    'tools/verification/protected-hosted-gate.mjs',
  ],
});

export function validateLegacyTransitionBootstrapGate(input) {
  if (!isPlainObject(input)) throw new TypeError('legacy transition bootstrap gate input is invalid');
  const repository = nonEmptyString(input.expectedRepository, 'legacy transition bootstrap repository');
  if (repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('legacy transition bootstrap repository is invalid');
  const prNumber = exactPositiveInteger(input.expectedPrNumber, 'legacy transition bootstrap PR number');
  const candidateHeadSha = exactSha(input.expectedCandidateHeadSha, 'legacy transition bootstrap candidate head');
  const protectedBaseSha = exactSha(input.expectedProtectedBaseSha, 'legacy transition bootstrap protected base');
  if (protectedBaseSha !== LEGACY_TRANSITION_BOOTSTRAP.protectedBaseSha) {
    throw new TypeError('legacy transition bootstrap protected base is not the one-shot authority base');
  }
  validateLivePr(input.livePr, { repository, prNumber, candidateHeadSha, protectedBaseSha });
  if (input.livePr.head?.ref !== LEGACY_TRANSITION_BOOTSTRAP.headRef) {
    throw new TypeError('legacy transition bootstrap head ref is not preauthorized');
  }
  const changedFiles = exactArray(input.changedFiles, 'legacy transition bootstrap changed files');
  exactObject(changedFiles, LEGACY_TRANSITION_BOOTSTRAP.changedFiles, 'legacy transition bootstrap exact changed files');

  const run = input.producerRun;
  if (!isPlainObject(run)
    || run.status !== 'completed'
    || !new Set(['success', 'failure']).has(run.conclusion)
    || run.path !== LEGACY_TRANSITION_BOOTSTRAP.workflowPath
    || run.event !== LEGACY_TRANSITION_BOOTSTRAP.event
    || run.repository?.full_name !== repository
    || run.head_branch !== LEGACY_TRANSITION_BOOTSTRAP.headRef) {
    throw new TypeError('legacy transition bootstrap producer run is not authoritative');
  }
  const runId = exactPositiveInteger(Number(run.id), 'legacy transition bootstrap producer run ID');
  const runAttempt = exactPositiveInteger(Number(run.run_attempt), 'legacy transition bootstrap producer run attempt');
  if (runAttempt !== 1) throw new TypeError('legacy transition bootstrap producer run must be attempt 1');
  if (exactSha(run.head_sha, 'legacy transition bootstrap producer head') !== candidateHeadSha) {
    throw new TypeError('legacy transition bootstrap producer head is stale');
  }
  const runRepositoryId = exactPositiveInteger(Number(run.repository?.id), 'legacy transition bootstrap producer repository ID');
  const association = (Array.isArray(run.pull_requests) ? run.pull_requests : []).find((item) => item?.number === prNumber);
  if (!association
    || Number(association.head?.repo?.id) !== runRepositoryId
    || Number(association.base?.repo?.id) !== runRepositoryId
    || association.head?.ref !== LEGACY_TRANSITION_BOOTSTRAP.headRef
    || association.base?.ref !== 'main'
    || exactSha(association.head?.sha, 'legacy transition bootstrap associated head') !== candidateHeadSha
    || exactSha(association.base?.sha, 'legacy transition bootstrap associated base') !== protectedBaseSha) {
    throw new TypeError('legacy transition bootstrap producer PR association mismatch');
  }

  const jobs = input.producerJobs?.jobs;
  if (!Array.isArray(jobs)) throw new TypeError('legacy transition bootstrap producer jobs are invalid');
  const heavy = jobs.filter((job) => job?.name === LEGACY_TRANSITION_BOOTSTRAP.heavyJobName);
  if (heavy.length !== 1 || heavy[0].status !== 'completed' || heavy[0].conclusion !== 'success') {
    throw new TypeError('legacy transition bootstrap heavy exact-head proof is not successful');
  }
  const unexpectedFailures = jobs.filter((job) => job?.status === 'completed' && job?.conclusion === 'failure'
    && job?.name !== LEGACY_TRANSITION_BOOTSTRAP.allowedNonEvidenceFailureJobName);
  if (unexpectedFailures.length !== 0) {
    throw new TypeError('legacy transition bootstrap has an unexpected failed producer job');
  }
  if (run.conclusion === 'failure') {
    const allowedFailures = jobs.filter((job) => job?.status === 'completed' && job?.conclusion === 'failure'
      && job?.name === LEGACY_TRANSITION_BOOTSTRAP.allowedNonEvidenceFailureJobName);
    if (allowedFailures.length !== 1) {
      throw new TypeError('legacy transition bootstrap failed run is not visual-review-only');
    }
  }

  return deepFreeze({
    schemaVersion: 1,
    status: 'success',
    mode: 'legacy-transition-heavy-proof-exact-base-only',
    repository,
    prNumber,
    protectedBaseSha,
    candidateHeadSha,
    headRef: LEGACY_TRANSITION_BOOTSTRAP.headRef,
    producerRunId: runId,
    producerRunAttempt: runAttempt,
  });
}

export function validateLegacyTransitionMergeGroupBootstrapGate(input) {
  if (!isPlainObject(input)) throw new TypeError('legacy transition merge-group bootstrap input is invalid');
  const repository = nonEmptyString(input.expectedRepository, 'legacy transition merge-group repository');
  if (repository !== 'Oteryn/Oteryn-Atlas') throw new TypeError('legacy transition merge-group repository is invalid');
  const prNumber = exactPositiveInteger(input.expectedPrNumber, 'legacy transition merge-group PR number');
  if (prNumber !== LEGACY_TRANSITION_BOOTSTRAP.prNumber) {
    throw new TypeError('legacy transition merge-group PR number is not preauthorized');
  }
  const protectedBaseSha = exactSha(input.expectedProtectedBaseSha, 'legacy transition merge-group protected base');
  if (protectedBaseSha !== LEGACY_TRANSITION_BOOTSTRAP.protectedBaseSha) {
    throw new TypeError('legacy transition merge-group protected base is not preauthorized');
  }
  const syntheticHeadSha = exactSha(input.expectedSyntheticHeadSha, 'legacy transition merge-group synthetic head');
  const currentMainSha = exactSha(input.currentMainSha, 'legacy transition merge-group current main');
  if (currentMainSha !== protectedBaseSha) {
    throw new TypeError('legacy transition merge-group current main is stale');
  }

  const mergeGroup = input.mergeGroup;
  const expectedQueueHeadRef = `refs/heads/gh-readonly-queue/main/pr-${prNumber}-${protectedBaseSha}`;
  if (!isPlainObject(mergeGroup)
    || mergeGroup.baseRef !== 'refs/heads/main'
    || mergeGroup.headRef !== expectedQueueHeadRef
    || exactSha(mergeGroup.baseSha, 'legacy transition merge-group event base') !== protectedBaseSha
    || exactSha(mergeGroup.headSha, 'legacy transition merge-group event head') !== syntheticHeadSha) {
    throw new TypeError('legacy transition merge-group queue head ref or event identity mismatch');
  }

  const syntheticCommit = input.syntheticCommit;
  if (!isPlainObject(syntheticCommit)
    || exactSha(syntheticCommit.sha, 'legacy transition synthetic commit') !== syntheticHeadSha
    || !Array.isArray(syntheticCommit.parents)
    || syntheticCommit.parents.length !== 1
    || exactSha(syntheticCommit.parents[0]?.sha, 'legacy transition synthetic parent') !== protectedBaseSha) {
    throw new TypeError('legacy transition synthetic commit parent identity mismatch');
  }
  const syntheticTreeSha = exactSha(syntheticCommit.tree?.sha, 'legacy transition synthetic tree');

  const candidateHeadSha = exactSha(input.livePr?.head?.sha, 'legacy transition merge-group candidate head');
  const candidateCommit = input.candidateCommit;
  if (!isPlainObject(candidateCommit)
    || exactSha(candidateCommit.sha, 'legacy transition candidate commit') !== candidateHeadSha) {
    throw new TypeError('legacy transition merge-group candidate commit identity mismatch');
  }
  const candidateTreeSha = exactSha(candidateCommit.tree?.sha, 'legacy transition candidate tree');
  if (candidateTreeSha !== syntheticTreeSha) {
    throw new TypeError('legacy transition merge-group synthetic tree does not equal exact candidate tree');
  }

  const protectedProof = validateLegacyTransitionBootstrapGate({
    producerRun: input.producerRun,
    producerJobs: input.producerJobs,
    livePr: input.livePr,
    changedFiles: input.changedFiles,
    expectedRepository: repository,
    expectedPrNumber: prNumber,
    expectedCandidateHeadSha: candidateHeadSha,
    expectedProtectedBaseSha: protectedBaseSha,
  });

  return deepFreeze({
    ...protectedProof,
    mode: 'legacy-transition-merge-group-heavy-proof-exact-base-only',
    syntheticHeadSha,
    treeSha: syntheticTreeSha,
  });
}
