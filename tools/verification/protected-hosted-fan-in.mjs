import { canonicalJson } from './verification-plan-schema.mjs';
import { validateEvidenceManifest, validateEvidenceStableIdUnion } from './evidence-manifest.mjs';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function exactSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase SHA`);
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function stableIds(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value];
}

function buildEvidenceSummary(expectedEvidenceIds, manifests, plannedStableTestIds) {
  const executedEvidenceIds = manifests.filter(({ disposition }) => disposition === 'EXECUTED').map(({ evidenceId }) => evidenceId).sort();
  const reusedEvidenceIds = manifests.filter(({ disposition }) => disposition === 'REUSED').map(({ evidenceId }) => evidenceId).sort();
  const actualEvidenceIds = manifests.map(({ evidenceId }) => evidenceId).sort();
  const expectedSet = new Set(expectedEvidenceIds);
  const actualSet = new Set(actualEvidenceIds);
  const missingEvidenceIds = expectedEvidenceIds.filter((id) => !actualSet.has(id)).sort();
  const unexpectedEvidenceIds = actualEvidenceIds.filter((id) => !expectedSet.has(id)).sort();
  const planned = new Set(plannedStableTestIds);
  const executed = new Set(manifests.filter(({ disposition }) => disposition === 'EXECUTED').flatMap(({ stableTestIds }) => stableTestIds));
  const reused = new Set(manifests.filter(({ disposition }) => disposition === 'REUSED').flatMap(({ stableTestIds }) => stableTestIds));
  const proven = new Set([...executed, ...reused]);
  const missing = [...planned].filter((id) => !proven.has(id));
  const unexpected = [...proven].filter((id) => !planned.has(id));
  return Object.freeze({
    expectedEvidenceIds: Object.freeze([...expectedEvidenceIds].sort()),
    executedEvidenceIds: Object.freeze(executedEvidenceIds),
    reusedEvidenceIds: Object.freeze(reusedEvidenceIds),
    missingEvidenceIds: Object.freeze(missingEvidenceIds),
    unexpectedEvidenceIds: Object.freeze(unexpectedEvidenceIds),
    stableTestIds: Object.freeze({
      planned: planned.size, executed: executed.size, reused: reused.size, missing: missing.length, unexpected: unexpected.length,
    }),
  });
}

function sameIdentity(summary, plan, field, label) {
  const planned = exactDigest(plan[field], `plan ${label}`);
  const actual = exactDigest(summary[field], `summary ${label}`);
  if (actual !== planned) throw new TypeError(`fan-in ${label} mismatch`);
}

export function validateProtectedHostedFanIn(plan, summaries, {
  currentHeadSha,
  expectedStableTestIds = plan?.stableTestIds,
  expectedStableTestIdsDigest = plan?.expectedStableTestIdsDigest,
} = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 3) {
    throw new TypeError('fan-in requires protected hosted plan schemaVersion 3');
  }
  if (plan.controller?.id !== 'atlas-protected-hosted-controller-v3' || plan.controller?.version !== 3) {
    throw new TypeError('fan-in controller identity is invalid');
  }
  const controllerSourceSha = exactSha(plan.controller.sourceSha, 'plan controller source SHA');
  const candidateHeadSha = exactSha(plan.candidateHeadSha, 'plan candidate head');
  if (exactSha(currentHeadSha, 'current PR head') !== candidateHeadSha) throw new TypeError('fan-in current PR head is stale');
  const planSemanticDigest = exactDigest(plan.planSemanticDigest, 'plan semantic digest');
  const planInstanceDigest = exactDigest(plan.planInstanceDigest, 'plan instance digest');
  const authorityDigest = exactDigest(plan.authorityDigest, 'plan authority digest');
  const environmentDigest = exactDigest(plan.environmentDigest, 'plan environment digest');
  const planExpectedDigest = exactDigest(plan.expectedStableTestIdsDigest, 'plan expected stable-ID digest');
  const expectedDigest = exactDigest(expectedStableTestIdsDigest, 'fan-in expected stable-ID digest');
  const expected = stableIds(expectedStableTestIds, 'fan-in expected stable IDs').sort();
  const expectedSet = new Set(expected);
  const plannedModifications = stableIds(plan.candidateStableIdModifications ?? [], 'plan candidate-modification stable IDs', true).sort();
  const expectedModifications = plannedModifications.filter((id) => expectedSet.has(id)).sort();
  exactDigest(plan.productIdentitiesDigest, 'plan product identities digest');
  exactDigest(plan.workerPolicyDigest, 'plan worker policy digest');
  exactDigest(plan.executionPolicyDigest, 'plan execution policy digest');
  if (plan.retryPolicy?.retries !== 0) throw new TypeError('fan-in plan retries must be zero');
  if (plan.selectiveExecution !== false) throw new TypeError('fan-in plan selective execution must remain disabled');
  if (!Array.isArray(summaries) || summaries.length === 0) throw new TypeError('fan-in requires shard summaries');

  let shardCount = null;
  const shardIndexes = new Set();
  const executed = [];
  const seenStableIds = new Set();
  const candidateModifiedStableTestIdsProven = [];
  const seenModifiedStableIds = new Set();

  for (const summary of summaries) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary) || summary.schemaVersion !== 2) {
      throw new TypeError('fan-in summary schema is invalid');
    }
    if (summary.status !== 'success') throw new TypeError('fan-in summary status is not success');
    if (summary.cancelled !== false) throw new TypeError('fan-in cancelled evidence cannot satisfy qualification');
    if (summary.retries !== 0) throw new TypeError('fan-in retries must be zero');
    if (exactSha(summary.candidateHeadSha, 'summary candidate head') !== candidateHeadSha) throw new TypeError('fan-in candidate head mismatch');
    if (exactSha(summary.controllerSourceSha, 'summary controller source SHA') !== controllerSourceSha) throw new TypeError('fan-in controller identity mismatch');
    if (exactDigest(summary.planSemanticDigest, 'summary plan semantic digest') !== planSemanticDigest) throw new TypeError('fan-in plan semantic digest mismatch');
    if (exactDigest(summary.planInstanceDigest, 'summary plan instance digest') !== planInstanceDigest) throw new TypeError('fan-in plan instance digest mismatch');
    if (exactDigest(summary.authorityDigest, 'summary authority digest') !== authorityDigest) throw new TypeError('fan-in authority digest mismatch');
    if (exactDigest(summary.environmentDigest, 'summary environment digest') !== environmentDigest) throw new TypeError('fan-in environment digest mismatch');
    if (exactDigest(summary.planExpectedStableTestIdsDigest, 'summary full-plan expected stable-ID digest') !== planExpectedDigest) {
      throw new TypeError('fan-in full-plan expected stable-ID digest mismatch');
    }
    if (exactDigest(summary.expectedStableTestIdsDigest, 'summary placement expected stable-ID digest') !== expectedDigest) {
      throw new TypeError('fan-in expected stable-ID digest mismatch');
    }
    sameIdentity(summary, plan, 'productIdentitiesDigest', 'product identities digest');
    sameIdentity(summary, plan, 'workerPolicyDigest', 'worker policy digest');
    sameIdentity(summary, plan, 'executionPolicyDigest', 'execution policy digest');

    if (!Number.isSafeInteger(summary.shardCount) || summary.shardCount < 1
      || !Number.isSafeInteger(summary.shardIndex) || summary.shardIndex < 0 || summary.shardIndex >= summary.shardCount) {
      throw new TypeError('fan-in shard identity is invalid');
    }
    if (shardCount == null) shardCount = summary.shardCount;
    if (summary.shardCount !== shardCount) throw new TypeError('fan-in sibling shard count mismatch');
    if (shardIndexes.has(summary.shardIndex)) throw new TypeError(`fan-in duplicate shard index: ${summary.shardIndex}`);
    shardIndexes.add(summary.shardIndex);

    const skipped = stableIds(summary.skippedStableTestIds, 'skipped stable IDs', true);
    if (skipped.length) throw new TypeError(`fan-in skipped stable IDs are forbidden: ${skipped.join(', ')}`);
    for (const id of stableIds(summary.executedStableTestIds, 'executed stable IDs', true)) {
      if (seenStableIds.has(id)) throw new TypeError(`fan-in duplicate stable ID: ${id}`);
      seenStableIds.add(id);
      executed.push(id);
    }
    for (const id of stableIds(summary.candidateModifiedStableTestIdsProven ?? [], 'candidate-modification proven stable IDs', true)) {
      if (seenModifiedStableIds.has(id)) throw new TypeError(`fan-in duplicate candidate-modification stable ID: ${id}`);
      if (!expectedModifications.includes(id)) throw new TypeError(`fan-in unexpected candidate-modification stable ID: ${id}`);
      seenModifiedStableIds.add(id);
      candidateModifiedStableTestIdsProven.push(id);
    }
  }

  if (summaries.length !== shardCount) throw new TypeError(`fan-in partial sibling evidence: expected ${shardCount} shards, received ${summaries.length}`);
  for (let index = 0; index < shardCount; index += 1) {
    if (!shardIndexes.has(index)) throw new TypeError(`fan-in missing sibling shard index: ${index}`);
  }

  const unexpected = executed.filter((id) => !expected.includes(id)).sort();
  if (unexpected.length) throw new TypeError(`fan-in unexpected stable IDs: ${unexpected.join(', ')}`);
  const missing = expected.filter((id) => !seenStableIds.has(id));
  if (missing.length) throw new TypeError(`fan-in missing stable IDs: ${missing.join(', ')}`);
  const missingModifications = expectedModifications.filter((id) => !seenModifiedStableIds.has(id));
  if (missingModifications.length) {
    throw new TypeError(`fan-in missing candidate-modification stable IDs: ${missingModifications.join(', ')}`);
  }

  return Object.freeze({
    status: 'success',
    candidateHeadSha,
    planSemanticDigest,
    planInstanceDigest,
    authorityDigest,
    environmentDigest,
    expectedStableTestIdsDigest: expectedDigest,
    executedStableTestIds: Object.freeze([...executed].sort()),
    candidateModifiedStableTestIdsProven: Object.freeze([...candidateModifiedStableTestIdsProven].sort()),
  });
}

export function validateProtectedHostedEvidenceFanIn(plan, execution, lifecycle, evidenceManifests, {
  currentHeadSha,
} = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 3) {
    throw new TypeError('evidence fan-in requires protected hosted plan schemaVersion 3');
  }
  if (!execution || typeof execution !== 'object' || Array.isArray(execution) || execution.schemaVersion !== 2) {
    throw new TypeError('evidence fan-in requires protected hosted execution schemaVersion 2');
  }
  if (!lifecycle || typeof lifecycle !== 'object' || Array.isArray(lifecycle) || lifecycle.schemaVersion !== 1
    || !Array.isArray(lifecycle.expectedEvidence) || ['BLOCKED', 'REINTEGRATE'].includes(lifecycle.disposition)) {
    throw new TypeError('evidence fan-in lifecycle decision is invalid');
  }
  const candidateHeadSha = exactSha(plan.candidateHeadSha, 'evidence fan-in candidate head');
  if (exactSha(currentHeadSha, 'evidence fan-in current head') !== candidateHeadSha) {
    throw new TypeError('evidence fan-in current PR head is stale');
  }
  if (lifecycle.candidateHeadSha !== candidateHeadSha || lifecycle.candidateMutationRequired !== false) {
    throw new TypeError('evidence fan-in lifecycle candidate identity is invalid');
  }
  const expectedById = new Map();
  for (const expected of lifecycle.expectedEvidence) {
    if (!expected || typeof expected !== 'object' || typeof expected.evidenceId !== 'string'
      || expectedById.has(expected.evidenceId)) throw new TypeError('evidence fan-in expected evidence set is invalid');
    expectedById.set(expected.evidenceId, expected);
  }
  const manifests = evidenceManifests.map(validateEvidenceManifest);
  const actualById = new Map();
  for (const manifest of manifests) {
    if (actualById.has(manifest.evidenceId)) throw new TypeError(`evidence fan-in duplicate evidence ID: ${manifest.evidenceId}`);
    actualById.set(manifest.evidenceId, manifest);
  }
  const expectedIds = [...expectedById.keys()].sort();
  const actualIds = [...actualById.keys()].sort();
  if (canonicalJson(expectedIds) !== canonicalJson(actualIds)) {
    throw new TypeError(`evidence fan-in exact evidence set mismatch; expected=${expectedIds.join(',')}; actual=${actualIds.join(',')}`);
  }

  const planSemanticDigest = exactDigest(plan.planSemanticDigest, 'evidence fan-in plan semantic digest');
  const planInstanceDigest = exactDigest(plan.planInstanceDigest, 'evidence fan-in plan instance digest');
  const authorityDigest = exactDigest(plan.authorityDigest, 'evidence fan-in authority digest');
  const environmentDigest = exactDigest(plan.environmentDigest, 'evidence fan-in environment digest');
  const executionPolicyDigest = exactDigest(plan.executionPolicyDigest, 'evidence fan-in execution policy digest');
  const environment = actualById.get('ENVIRONMENT_QUALIFICATION');
  const zeroWork = expectedIds.length === 0;
  if (zeroWork) {
    const hostedStableTestIds = stableIds(execution.hosted?.stableTestIds ?? [], 'zero-work hosted stable IDs', true);
    const specialistStableTestIds = stableIds(execution.specialist?.stableTestIds ?? [], 'zero-work specialist stable IDs', true);
    const reviewGroupIds = Array.isArray(execution.review?.groupIds) ? execution.review.groupIds : [];
    if (plan.profile !== 'none' || hostedStableTestIds.length !== 0 || specialistStableTestIds.length !== 0
      || reviewGroupIds.length !== 0 || actualIds.length !== 0 || environment) {
      throw new TypeError('evidence fan-in zero-work contract contains executable obligations');
    }
    return Object.freeze({
      schemaVersion: 1,
      status: 'success',
      candidateHeadSha,
      planSemanticDigest,
      planInstanceDigest,
      authorityDigest,
      environmentDigest,
      executedStableTestIds: Object.freeze([]),
      executedEvidenceIds: Object.freeze([]),
      reusedEvidenceIds: Object.freeze([]),
      evidenceSummary: buildEvidenceSummary(expectedIds, manifests, execution.hosted?.stableTestIds ?? []),
    });
  }
  if (!environment) throw new TypeError('evidence fan-in environment evidence is missing');

  for (const evidenceId of expectedIds) {
    const expected = expectedById.get(evidenceId);
    const manifest = actualById.get(evidenceId);
    if (manifest.result !== 'SUCCESS' || !['EXECUTED', 'REUSED'].includes(manifest.disposition)) {
      throw new TypeError(`evidence fan-in unsuccessful disposition: ${evidenceId}`);
    }
    if (manifest.candidateHeadSha !== candidateHeadSha
      || manifest.planSemanticDigest !== planSemanticDigest
      || manifest.planInstanceDigest !== planInstanceDigest
      || manifest.authorityDigest !== authorityDigest
      || manifest.environmentDigest !== expected.environmentDigest
      || manifest.executionPolicyDigest !== executionPolicyDigest
      || manifest.evidenceSemanticDigest !== expected.evidenceSemanticDigest) {
      throw new TypeError(`evidence fan-in identity mismatch: ${evidenceId}`);
    }
    if (canonicalJson(manifest.productIdentities) !== canonicalJson(expected.productIdentities)
      || canonicalJson(manifest.stableTestIds) !== canonicalJson(expected.stableTestIds)
      || canonicalJson(manifest.dependencies.paths) !== canonicalJson(expected.dependencies.paths)
      || canonicalJson(manifest.dependencies.dataCapabilities) !== canonicalJson(expected.dependencies.dataCapabilities)
      || canonicalJson(manifest.dependencies.evidenceSemanticDigests)
        !== canonicalJson(expected.dependencies.evidenceSemanticDigests)) {
      throw new TypeError(`evidence fan-in dependency or test-set mismatch: ${evidenceId}`);
    }
    if (evidenceId === 'ENVIRONMENT_QUALIFICATION') {
      if (manifest.environmentDigest !== environmentDigest
        || manifest.dependencies.evidenceDigests.length !== 0
        || manifest.dependencies.evidenceSemanticDigests.length !== 0) {
        throw new TypeError('evidence fan-in environment dependency closure is invalid');
      }
    } else if (canonicalJson(manifest.dependencies.evidenceDigests) !== canonicalJson([environment.evidenceDigest])
      || canonicalJson(manifest.dependencies.evidenceSemanticDigests) !== canonicalJson([environment.evidenceSemanticDigest])) {
      throw new TypeError(`evidence fan-in hosted environment dependency mismatch: ${evidenceId}`);
    }
  }

  const hosted = manifests.filter(({ evidenceId }) => evidenceId !== 'ENVIRONMENT_QUALIFICATION');
  validateEvidenceStableIdUnion(execution.hosted.stableTestIds, hosted);
  return Object.freeze({
    schemaVersion: 1,
    status: 'success',
    candidateHeadSha,
    planSemanticDigest,
    planInstanceDigest,
    authorityDigest,
    environmentDigest,
    executedStableTestIds: Object.freeze([...execution.hosted.stableTestIds].sort()),
    executedEvidenceIds: Object.freeze(hosted.filter(({ disposition }) => disposition === 'EXECUTED').map(({ evidenceId }) => evidenceId).sort()),
    reusedEvidenceIds: Object.freeze(manifests.filter(({ disposition }) => disposition === 'REUSED').map(({ evidenceId }) => evidenceId).sort()),
    evidenceSummary: buildEvidenceSummary(expectedIds, manifests, execution.hosted.stableTestIds),
  });
}