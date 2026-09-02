import {
  canonicalDigest,
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  sortedUniqueStrings,
} from './anti-loop-common.mjs';
import { classifyBaseAdvance } from './base-advance-compatibility.mjs';
import {
  buildEvidenceManifest,
  buildEvidenceSemanticDigest,
  validateEvidenceManifest,
} from './evidence-manifest.mjs';
import { resolveReusableEvidence } from './evidence-reuse.mjs';
import { classifyVerificationFailure } from './verification-failure-classification.mjs';
import { advanceProgress } from './verification-progress-state.mjs';

const ENVIRONMENT_EVIDENCE_ID = 'ENVIRONMENT_QUALIFICATION';
const TERMINAL_BREAKERS = new Set(['STALLED', 'ARCHITECTURE_STABILIZATION_REQUIRED']);
const REUSABLE_PROGRESS = new Set(['QUALIFIED', 'BASE_COMPATIBILITY', 'MERGE_READY']);

function validatePlan(plan) {
  if (!isPlainObject(plan) || plan.schemaVersion !== 3) throw new TypeError('lifecycle requires protected plan schemaVersion 3');
  exactSha(plan.protectedBaseSha, 'lifecycle protected base SHA');
  exactSha(plan.candidateHeadSha, 'lifecycle candidate head SHA');
  exactDigest(plan.planSemanticDigest, 'lifecycle plan semantic digest');
  exactDigest(plan.planInstanceDigest, 'lifecycle plan instance digest');
  exactDigest(plan.authorityDigest, 'lifecycle authority digest');
  exactDigest(plan.environmentDigest, 'lifecycle environment digest');
  exactDigest(plan.executionPolicyDigest, 'lifecycle execution policy digest');
  if (!isPlainObject(plan.productIdentities)) throw new TypeError('lifecycle product identities are invalid');
  return plan;
}

function validateExecution(execution) {
  if (!isPlainObject(execution) || execution.schemaVersion !== 2 || !isPlainObject(execution.hosted)) {
    throw new TypeError('lifecycle requires protected hosted execution schemaVersion 2');
  }
  sortedUniqueStrings(execution.hosted.stableTestIds ?? [], 'lifecycle hosted stable IDs');
  if (!Array.isArray(execution.hosted.partitions)) throw new TypeError('lifecycle hosted partitions are invalid');
  return execution;
}

function selectedProducts(plan, capabilities) {
  return Object.fromEntries(capabilities.map((capability) => {
    const identity = plan.productIdentities[capability];
    if (!isPlainObject(identity) || typeof identity.id !== 'string') {
      throw new TypeError(`lifecycle product identity is missing: ${capability}`);
    }
    exactDigest(identity.digest, `lifecycle ${capability} product digest`);
    return [capability, identity];
  }));
}

function buildExpectedEvidence(plan, execution) {
  const hostedStableTestIds = sortedUniqueStrings(execution.hosted.stableTestIds ?? [], 'lifecycle hosted stable IDs');
  if (hostedStableTestIds.length === 0) return [];
  const environment = {
    evidenceId: ENVIRONMENT_EVIDENCE_ID,
    evidenceType: 'ENVIRONMENT_QUALIFICATION',
    candidateHeadSha: plan.candidateHeadSha,
    authorityDigest: plan.authorityDigest,
    environmentDigest: plan.environmentDigest,
    productIdentities: {},
    stableTestIds: [],
    executionPolicyDigest: plan.executionPolicyDigest,
    dependencies: {
      evidenceDigests: [],
      evidenceSemanticDigests: [],
      paths: [
        'tools/verification/protected-execution-environment-probe.mjs',
        'tools/verification/protected-execution-environment.json',
      ],
      dataCapabilities: [],
    },
  };
  environment.evidenceSemanticDigest = buildEvidenceSemanticDigest(environment);

  const shardCount = Number(plan.workerPolicy?.hostedShards ?? 1);
  if (!Number.isSafeInteger(shardCount) || shardCount < 1) throw new TypeError('lifecycle hosted shard count is invalid');
  const capabilityByStableId = new Map();
  for (const partition of execution.hosted.partitions) {
    if (!isPlainObject(partition) || typeof partition.dataCapability !== 'string') {
      throw new TypeError('lifecycle hosted partition is invalid');
    }
    for (const id of sortedUniqueStrings(partition.stableTestIds ?? [], 'lifecycle partition stable IDs')) {
      if (capabilityByStableId.has(id)) throw new TypeError(`lifecycle stable ID has duplicate data-capability placement: ${id}`);
      capabilityByStableId.set(id, partition.dataCapability);
    }
  }
  for (const id of hostedStableTestIds) {
    if (!capabilityByStableId.has(id)) throw new TypeError(`lifecycle stable ID has no data-capability placement: ${id}`);
  }

  const shards = [];
  for (let index = 0; index < shardCount; index += 1) {
    const stableTestIds = hostedStableTestIds.filter((_, stableIndex) => stableIndex % shardCount === index);
    if (stableTestIds.length === 0) continue;
    const capabilities = [...new Set(stableTestIds.map((id) => capabilityByStableId.get(id)))].sort();
    const node = {
      evidenceId: `HOSTED_FUNCTIONAL:SHARD_${index + 1}`,
      evidenceType: 'HOSTED_FUNCTIONAL',
      candidateHeadSha: plan.candidateHeadSha,
      authorityDigest: plan.authorityDigest,
      environmentDigest: plan.environmentDigest,
      productIdentities: selectedProducts(plan, capabilities),
      stableTestIds,
      executionPolicyDigest: plan.executionPolicyDigest,
      dependencies: {
        evidenceDigests: [],
        evidenceSemanticDigests: [environment.evidenceSemanticDigest],
        paths: [],
        dataCapabilities: capabilities,
      },
    };
    node.evidenceSemanticDigest = buildEvidenceSemanticDigest(node);
    shards.push(node);
  }
  return [environment, ...shards];
}

function evidenceDeclaration(node) {
  return {
    id: node.evidenceId,
    dependencyPaths: node.dependencies.paths,
    dependsOnAuthority: true,
    dependsOnEnvironment: true,
    productCapabilities: node.dependencies.dataCapabilities,
  };
}

function syntheticCompatibility(previousPlan, currentPlan, disposition, reason, affectedEvidenceIds) {
  const core = {
    schemaVersion: 1,
    disposition,
    affectedEvidenceIds: [...affectedEvidenceIds].sort(),
    reasons: [reason],
    oldBaseSha: previousPlan?.protectedBaseSha ?? currentPlan.protectedBaseSha,
    newBaseSha: currentPlan.protectedBaseSha,
    changedPaths: [],
  };
  return { ...core, compatibilityDigest: canonicalDigest(core) };
}

function decisionProgress(previousProgress, disposition, affectedEvidenceIds, heavyExecutionsRequired) {
  const history = Array.isArray(previousProgress?.history) ? previousProgress.history : [];
  if (disposition === 'REUSE') {
    return deepFreeze({ schemaVersion: 1, status: 'MERGE_READY', history, heavyExecutionsRequired: 0 });
  }
  if (disposition === 'REINTEGRATE') {
    return deepFreeze({
      schemaVersion: 1,
      status: 'BLOCKED_CANDIDATE',
      history,
      nextAttemptAllowed: false,
      candidateMutationRequired: true,
    });
  }
  return deepFreeze({
    schemaVersion: 1,
    status: 'EXECUTING',
    history,
    heavyExecutionsRequired,
    affectedEvidenceIds: [...affectedEvidenceIds],
  });
}

export function planProtectedVerificationLifecycle(input) {
  if (!isPlainObject(input)) throw new TypeError('protected verification lifecycle input is invalid');
  const currentPlan = validatePlan(input.currentPlan);
  const currentExecution = validateExecution(input.currentExecution);
  const expectedEvidence = buildExpectedEvidence(currentPlan, currentExecution);
  const hostedIds = expectedEvidence.filter(({ evidenceId }) => evidenceId !== ENVIRONMENT_EVIDENCE_ID).map(({ evidenceId }) => evidenceId);
  const previousState = input.previousState;
  const previousProgress = isPlainObject(previousState?.progress) ? previousState.progress : null;
  const sameSemanticInputs = previousState?.plan?.planSemanticDigest === currentPlan.planSemanticDigest;

  if (previousProgress?.status === 'ARCHITECTURE_STABILIZATION_REQUIRED'
    || (previousProgress?.status === 'STALLED' && sameSemanticInputs)) {
    return deepFreeze({
      schemaVersion: 1,
      disposition: 'BLOCKED',
      candidateHeadSha: currentPlan.candidateHeadSha,
      executeEnvironment: false,
      executeHostedEvidenceIds: [],
      reuseEvidenceIds: [],
      heavyExecutionsRequired: 0,
      candidateMutationRequired: false,
      circuitBreaker: previousProgress.circuitBreaker ?? previousProgress.status,
      progress: previousProgress,
      expectedEvidence,
    });
  }

  if (expectedEvidence.length === 0) {
    const compatibility = syntheticCompatibility(
      isPlainObject(previousState?.plan) ? previousState.plan : null,
      currentPlan,
      'REUSE',
      'protected plan has no executable evidence obligations',
      [],
    );
    return deepFreeze({
      schemaVersion: 1,
      disposition: 'REUSE',
      candidateHeadSha: currentPlan.candidateHeadSha,
      executeEnvironment: false,
      executeHostedEvidenceIds: [],
      reuseEvidenceIds: [],
      heavyExecutionsRequired: 0,
      candidateMutationRequired: false,
      compatibilityDigest: compatibility.compatibilityDigest,
      affectedEvidenceIds: [],
      reasons: compatibility.reasons,
      progress: decisionProgress(previousProgress, 'REUSE', [], 0),
      expectedEvidence: [],
      reuseSources: [],
    });
  }

  let compatibility;
  const previousPlan = isPlainObject(previousState?.plan) ? previousState.plan : null;
  const previousExecution = isPlainObject(previousState?.execution) ? previousState.execution : null;
  const previousManifests = Array.isArray(previousState?.evidenceManifests) ? previousState.evidenceManifests : [];
  const canConsiderReuse = previousPlan
    && previousExecution
    && REUSABLE_PROGRESS.has(previousProgress?.status);

  if (!canConsiderReuse) {
    compatibility = syntheticCompatibility(
      previousPlan,
      currentPlan,
      'FULL_RERUN',
      previousPlan?.candidateHeadSha && previousPlan.candidateHeadSha !== currentPlan.candidateHeadSha
        ? 'candidate head changed'
        : 'no qualified reusable lifecycle state exists',
      expectedEvidence.map(({ evidenceId }) => evidenceId),
    );
  } else {
    const baseAdvance = isPlainObject(input.baseAdvance) ? input.baseAdvance : {};
    compatibility = classifyBaseAdvance({
      oldBaseSha: previousPlan.protectedBaseSha,
      newBaseSha: currentPlan.protectedBaseSha,
      changedPaths: baseAdvance.changedPaths ?? [],
      mergeStatus: baseAdvance.mergeStatus ?? 'clean',
      previousIdentities: {
        authorityDigest: previousPlan.authorityDigest,
        environmentDigest: previousPlan.environmentDigest,
        products: previousPlan.productIdentities,
      },
      currentIdentities: {
        authorityDigest: currentPlan.authorityDigest,
        environmentDigest: currentPlan.environmentDigest,
        products: currentPlan.productIdentities,
      },
      authorityPaths: baseAdvance.authorityPaths ?? ['.github/workflows/protected-', 'tools/verification/', 'e2e/'],
      candidateRequiredPaths: baseAdvance.candidateRequiredPaths ?? [],
      evidence: expectedEvidence.map(evidenceDeclaration),
    });
  }

  if (compatibility.disposition === 'REINTEGRATE') {
    return deepFreeze({
      schemaVersion: 1,
      disposition: 'REINTEGRATE',
      candidateHeadSha: currentPlan.candidateHeadSha,
      executeEnvironment: false,
      executeHostedEvidenceIds: [],
      reuseEvidenceIds: [],
      heavyExecutionsRequired: 0,
      candidateMutationRequired: true,
      compatibilityDigest: compatibility.compatibilityDigest,
      reasons: compatibility.reasons,
      progress: decisionProgress(previousProgress, 'REINTEGRATE', compatibility.affectedEvidenceIds, 0),
      expectedEvidence,
      reuseSources: [],
    });
  }

  const sourceById = new Map();
  for (const raw of previousManifests) {
    try {
      const manifest = validateEvidenceManifest(raw);
      if (!sourceById.has(manifest.evidenceId)) sourceById.set(manifest.evidenceId, manifest);
    } catch {
      // Invalid prior evidence is not reusable. Execution remains fail-closed.
    }
  }
  const availableEvidenceDigests = Array.isArray(input.availableEvidenceDigests)
    ? input.availableEvidenceDigests
    : [];
  const now = input.now;
  const reuseEvidenceIds = [];
  const reuseSources = [];
  const rejectionReasons = [];
  let environmentReusable = false;

  for (const node of expectedEvidence) {
    if (node.evidenceId !== ENVIRONMENT_EVIDENCE_ID && !environmentReusable) {
      rejectionReasons.push(`${node.evidenceId}:DEPENDENCY_ENVIRONMENT_NOT_REUSABLE`);
      continue;
    }
    const source = sourceById.get(node.evidenceId);
    if (!source) {
      rejectionReasons.push(`${node.evidenceId}:SOURCE_EVIDENCE_MISSING`);
      continue;
    }
    const result = resolveReusableEvidence({
      ...node,
      planSemanticDigest: currentPlan.planSemanticDigest,
      allowPlanSemanticRebinding: true,
      now,
      availableEvidenceDigests,
      affectedEvidenceIds: compatibility.affectedEvidenceIds,
    }, source);
    if (!result.reusable) {
      rejectionReasons.push(`${node.evidenceId}:${result.reason}`);
      continue;
    }
    reuseEvidenceIds.push(node.evidenceId);
    reuseSources.push({
      evidenceId: node.evidenceId,
      sourceEvidenceDigest: result.sourceEvidenceDigest,
      evidenceSemanticDigest: result.evidenceSemanticDigest,
    });
    if (node.evidenceId === ENVIRONMENT_EVIDENCE_ID) environmentReusable = true;
  }

  const reuseSet = new Set(reuseEvidenceIds);
  const executeEnvironment = expectedEvidence.some(({ evidenceId }) => evidenceId === ENVIRONMENT_EVIDENCE_ID)
    && !reuseSet.has(ENVIRONMENT_EVIDENCE_ID);
  const executeHostedEvidenceIds = hostedIds.filter((id) => !reuseSet.has(id));
  const heavyExecutionsRequired = executeHostedEvidenceIds.length;
  let disposition;
  if (expectedEvidence.length > 0 && reuseEvidenceIds.length === expectedEvidence.length) disposition = 'REUSE';
  else if (reuseEvidenceIds.length > 0) disposition = 'PARTIAL_RERUN';
  else disposition = 'FULL_RERUN';

  return deepFreeze({
    schemaVersion: 1,
    disposition,
    candidateHeadSha: currentPlan.candidateHeadSha,
    executeEnvironment,
    executeHostedEvidenceIds,
    reuseEvidenceIds,
    heavyExecutionsRequired,
    candidateMutationRequired: false,
    compatibilityDigest: compatibility.compatibilityDigest,
    affectedEvidenceIds: compatibility.affectedEvidenceIds,
    reasons: [...compatibility.reasons, ...rejectionReasons],
    progress: decisionProgress(previousProgress, disposition, compatibility.affectedEvidenceIds, heavyExecutionsRequired),
    expectedEvidence,
    reuseSources,
  });
}

export function materializeReusedEvidence(input) {
  if (!isPlainObject(input)) throw new TypeError('reused evidence materialization input is invalid');
  const currentPlan = validatePlan(input.currentPlan);
  const decision = input.decision;
  if (!isPlainObject(decision) || !Array.isArray(decision.reuseEvidenceIds)) {
    throw new TypeError('reused evidence materialization decision is invalid');
  }
  const sourceById = new Map((input.sourceEvidenceManifests ?? []).map((candidate) => {
    const manifest = validateEvidenceManifest(candidate);
    return [manifest.evidenceId, manifest];
  }));
  const expectedById = new Map((decision.expectedEvidence ?? []).map((node) => [node.evidenceId, node]));
  const pending = new Set(decision.reuseEvidenceIds);
  const materialized = [];

  while (pending.size > 0) {
    let advanced = false;
    for (const evidenceId of [...pending]) {
      const source = sourceById.get(evidenceId);
      const expected = expectedById.get(evidenceId);
      if (!source || !expected) throw new TypeError(`reused evidence source/expectation is missing: ${evidenceId}`);
      const dependencyDigests = [];
      let dependenciesReady = true;
      for (const semanticDigest of expected.dependencies.evidenceSemanticDigests) {
        const dependency = materialized.find((manifest) => manifest.evidenceSemanticDigest === semanticDigest);
        if (!dependency) {
          dependenciesReady = false;
          break;
        }
        dependencyDigests.push(dependency.evidenceDigest);
      }
      if (!dependenciesReady) continue;
      const manifest = buildEvidenceManifest({
        evidenceId: expected.evidenceId,
        evidenceType: expected.evidenceType,
        result: 'SUCCESS',
        disposition: 'REUSED',
        candidateHeadSha: currentPlan.candidateHeadSha,
        planSemanticDigest: currentPlan.planSemanticDigest,
        planInstanceDigest: currentPlan.planInstanceDigest,
        authorityDigest: currentPlan.authorityDigest,
        environmentDigest: expected.environmentDigest,
        productIdentities: expected.productIdentities,
        stableTestIds: expected.stableTestIds,
        executionPolicyDigest: currentPlan.executionPolicyDigest,
        runProvenance: input.runProvenance,
        dependencies: {
          evidenceDigests: dependencyDigests,
          evidenceSemanticDigests: expected.dependencies.evidenceSemanticDigests,
          paths: expected.dependencies.paths,
          dataCapabilities: expected.dependencies.dataCapabilities,
        },
        availability: source.availability,
        sourceEvidenceDigest: source.evidenceDigest,
        compatibilityDigest: decision.compatibilityDigest,
      });
      if (manifest.evidenceSemanticDigest !== source.evidenceSemanticDigest) {
        throw new TypeError(`reused evidence semantic identity changed during rebinding: ${evidenceId}`);
      }
      materialized.push(manifest);
      pending.delete(evidenceId);
      advanced = true;
    }
    if (!advanced) throw new TypeError('reused evidence dependency graph is incomplete or cyclic');
  }
  return deepFreeze(materialized);
}

export function buildQualifiedProgress(progress) {
  return advanceProgress(progress, { event: 'EVIDENCE_QUALIFIED' });
}

export function recordWorkflowFailure(input) {
  if (!isPlainObject(input)) throw new TypeError('workflow failure record input is invalid');
  const currentPlan = validatePlan(input.currentPlan);
  const classified = classifyVerificationFailure({
    stage: input.stage,
    code: input.code,
    expectedCandidateHeadSha: currentPlan.candidateHeadSha,
    currentCandidateHeadSha: input.currentCandidateHeadSha,
    planSemanticDigest: currentPlan.planSemanticDigest,
    authorityDigest: currentPlan.authorityDigest,
    environmentDigest: currentPlan.environmentDigest,
    sourceOwnership: input.sourceOwnership,
    integrationCompatible: input.integrationCompatible,
  });
  const progress = advanceProgress(input.progress, {
    event: 'FAILED',
    failure: {
      candidateHeadSha: currentPlan.candidateHeadSha,
      planSemanticDigest: currentPlan.planSemanticDigest,
      failureClass: classified.failureClass,
      failureSignature: classified.failureSignature,
      stage: classified.stage,
      code: classified.code,
    },
  });
  return deepFreeze({
    ...progress,
    failureClass: classified.failureClass,
    failureSignature: classified.failureSignature,
    owner: classified.owner,
    retryable: classified.retryable,
    candidateMutationAllowed: classified.candidateMutationAllowed,
  });
}
