import crypto from 'node:crypto';

import { buildVerificationPlan } from './build-verification-plan.mjs';
import { stableIdAlgorithm, normalizeStableSpecPath } from './stable-id.mjs';
import { validateStableIdCensus } from './stable-id-census.mjs';
import {
  canonicalJson,
  validateImpactManifest,
  validateVerificationCatalog,
} from './verification-plan-schema.mjs';

const CONTROLLER = Object.freeze({ id: 'atlas-protected-hosted-controller-v2', version: 2 });
const SANDBOX_POLICY_ID = 'atlas-candidate-census-sandbox-v1';
const PROTECTED_HOSTED_WORKER_POLICY = Object.freeze({
  id: 'atlas-protected-hosted-workers-v1',
  version: 1,
  hostedShards: 1,
  workersPerShard: 1,
});
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const DATA_CAPABILITIES = new Set(['qualification_fixture', 'bounded_real_world', 'real_fullworld']);
const PLAYWRIGHT_SPEC = /^e2e\/tests\/[^/]+\.spec\.mjs$/;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function exactSha(value, label) {
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase 40-character SHA`);
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} digest must be sha256:<64 lowercase hex>`);
  return value;
}

function stableCoordinates(id) {
  const first = id.indexOf('::');
  const second = first < 0 ? -1 : id.indexOf('::', first + 2);
  if (first <= 0 || second <= first + 2 || second >= id.length - 2) {
    throw new TypeError(`candidate census stable ID is malformed: ${id}`);
  }
  const project = id.slice(0, first);
  const spec = id.slice(first + 2, second);
  if (normalizeStableSpecPath(spec) !== spec) throw new TypeError(`candidate census stable ID spec is not canonical: ${spec}`);
  return { project, spec };
}

function matchesSpecPattern(pattern, spec) {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  return new RegExp(`^${expression}$`).test(spec);
}

function supportsCandidateId(id, catalogs) {
  const { project, spec } = stableCoordinates(id);
  for (const catalog of catalogs) {
    for (const group of Object.values(catalog.groups)) {
      if (!group.capabilities.browser || !group.projects.includes(project)) continue;
      if (group.specs.some((pattern) => matchesSpecPattern(pattern, spec))) return true;
    }
  }
  return false;
}

function validateCandidateCensus(candidate, candidateHeadSha, catalogs) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || candidate.schemaVersion !== 1) {
    throw new TypeError('candidate census sandbox result requires schemaVersion 1');
  }
  if (candidate.status !== 'success') throw new TypeError('candidate census sandbox did not succeed');
  if (exactSha(candidate.candidateHeadSha, 'candidate census candidate head') !== candidateHeadSha) {
    throw new TypeError('candidate census candidate head mismatch');
  }
  if (candidate.sandboxPolicyId !== SANDBOX_POLICY_ID) throw new TypeError('candidate census sandbox policy is not protected');
  const census = validateStableIdCensus(candidate.census);
  for (const id of census.stableTestIds) {
    if (!supportsCandidateId(id, catalogs)) throw new TypeError(`candidate census stable ID is unsupported by the protected/candidate catalog: ${id}`);
  }
  return freeze({
    schemaVersion: 1,
    status: 'success',
    candidateHeadSha,
    sandboxPolicyId: SANDBOX_POLICY_ID,
    census,
    digest: digest({
      schemaVersion: 1,
      status: 'success',
      candidateHeadSha,
      sandboxPolicyId: SANDBOX_POLICY_ID,
      censusDigest: census.digest,
    }),
  });
}

function deriveCandidateStableIdModifications(changedPaths, protectedStableTestIds, candidateStableTestIds) {
  const candidateSet = new Set(candidateStableTestIds);
  const shared = protectedStableTestIds.filter((id) => candidateSet.has(id));
  if (shared.length === 0) return [];
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) return [...shared].sort();

  const changedSpecs = new Set(changedPaths.filter((path) => PLAYWRIGHT_SPEC.test(path)));
  const sharedE2eInfrastructureChanged = changedPaths.some((path) => path.startsWith('e2e/') && !PLAYWRIGHT_SPEC.test(path));
  if (sharedE2eInfrastructureChanged) return [...shared].sort();

  return shared
    .filter((id) => changedSpecs.has(stableCoordinates(id).spec))
    .sort();
}

function validateProductIdentities(input, requiredCapabilities) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('product identities must be an object');
  const selected = {};
  for (const capability of requiredCapabilities) {
    if (!DATA_CAPABILITIES.has(capability)) throw new TypeError(`product capability is unsupported: ${capability}`);
    const identity = input[capability];
    if (!identity || typeof identity !== 'object' || Array.isArray(identity)
      || typeof identity.id !== 'string' || identity.id.length === 0) {
      throw new TypeError(`product identity for ${capability} is required`);
    }
    selected[capability] = {
      id: identity.id,
      digest: exactDigest(identity.digest, `product ${capability}`),
    };
  }
  return freeze(selected);
}

export function buildProtectedHostedPlan(input) {
  if (!input || typeof input !== 'object' || input.repository !== 'Oteryn/Oteryn-Atlas') {
    throw new TypeError('repository must be Oteryn/Oteryn-Atlas');
  }
  if (!Number.isSafeInteger(Number(input.prNumber)) || Number(input.prNumber) < 1) throw new TypeError('prNumber must be a positive integer');
  const protectedBaseSha = exactSha(input.protectedBaseSha, 'protectedBaseSha');
  const candidateHeadSha = exactSha(input.candidateHeadSha, 'candidateHeadSha');
  const mergeBaseSha = exactSha(input.mergeBaseSha, 'mergeBaseSha');

  const trustedCatalog = validateVerificationCatalog(input.trustedVerificationCatalog);
  const candidateCatalog = validateVerificationCatalog(input.candidateVerificationCatalog);
  const trustedImpact = validateImpactManifest(input.trustedImpactManifest, trustedCatalog);
  const candidateImpact = validateImpactManifest(input.candidateImpactManifest, candidateCatalog);
  const protectedCensus = validateStableIdCensus(input.protectedCensus);
  const candidateCensus = validateCandidateCensus(input.candidateCensus, candidateHeadSha, [trustedCatalog, candidateCatalog]);

  const protectedSet = new Set(protectedCensus.stableTestIds);
  const candidateStableIdAdditions = candidateCensus.census.stableTestIds.filter((id) => !protectedSet.has(id));
  const widenedStableIds = [...new Set([...protectedCensus.stableTestIds, ...candidateStableIdAdditions])].sort();

  const basePlan = buildVerificationPlan({
    repository: input.repository,
    headSha: candidateHeadSha,
    integrationBaseSha: protectedBaseSha,
    mergeBaseSha,
    changedFiles: input.changedFiles,
    trustedImpactManifest: trustedImpact,
    candidateImpactManifest: candidateImpact,
    trustedVerificationCatalog: trustedCatalog,
    candidateVerificationCatalog: candidateCatalog,
    protectedStableTestIds: widenedStableIds,
  });
  const candidateStableIdModifications = deriveCandidateStableIdModifications(
    basePlan.changedPaths,
    protectedCensus.stableTestIds,
    candidateCensus.census.stableTestIds,
  );

  const productIdentities = validateProductIdentities(input.productIdentities, basePlan.requiredDataCapabilities);
  const protectedCensusDigest = protectedCensus.digest;
  const candidateCensusDigest = candidateCensus.digest;
  const trustedImpactManifestDigest = digest(trustedImpact);
  const candidateImpactManifestDigest = digest(candidateImpact);
  const trustedVerificationCatalogDigest = digest(trustedCatalog);
  const candidateVerificationCatalogDigest = digest(candidateCatalog);
  const stableIdAlgorithmDigest = digest(stableIdAlgorithm);
  const productIdentitiesDigest = digest(productIdentities);
  const workerPolicyDigest = digest(PROTECTED_HOSTED_WORKER_POLICY);
  const executionPolicy = {
    controllerId: CONTROLLER.id,
    retries: 0,
    selectiveExecution: false,
    workerPolicyDigest,
    requiredGroupIds: basePlan.requiredGroupIds,
    requiredDataCapabilities: basePlan.requiredDataCapabilities,
    requiresRealFullWorld: basePlan.requiresRealFullWorld,
  };
  const executionPolicyDigest = digest(executionPolicy);

  const core = {
    schemaVersion: 2,
    controller: { ...CONTROLLER, sourceSha: protectedBaseSha },
    repository: input.repository,
    prNumber: Number(input.prNumber),
    protectedBaseSha,
    candidateHeadSha,
    integrationBaseSha: protectedBaseSha,
    mergeBaseSha,
    diffIdentity: basePlan.diffIdentity,
    changedPaths: basePlan.changedPaths,
    changedPathsDigest: basePlan.changedPathsDigest,
    trustedImpactManifestDigest,
    candidateImpactManifestDigest,
    trustedVerificationCatalogDigest,
    candidateVerificationCatalogDigest,
    impactPolicyDigest: basePlan.impactPolicyDigest,
    verificationCatalogDigest: basePlan.verificationCatalogDigest,
    stableIdAlgorithm,
    stableIdAlgorithmDigest,
    protectedCensusDigest,
    candidateCensusDigest,
    candidateStableIdAdditions,
    candidateStableIdModifications,
    profile: basePlan.profile,
    impactDomains: basePlan.impactDomains,
    appliedCrossDomainEscalations: basePlan.appliedCrossDomainEscalations,
    requiredGroupIds: basePlan.requiredGroupIds,
    groups: basePlan.groups,
    stableTestIds: basePlan.stableTestIds,
    expectedStableTestIdsDigest: basePlan.expectedStableTestIdsDigest,
    requiredVisualGroupIds: basePlan.requiredVisualGroupIds,
    resourceClasses: basePlan.resourceClasses,
    requiredDataCapabilities: basePlan.requiredDataCapabilities,
    requiresRealFullWorld: basePlan.requiresRealFullWorld,
    productIdentities,
    productIdentitiesDigest,
    workerPolicy: PROTECTED_HOSTED_WORKER_POLICY,
    workerPolicyId: PROTECTED_HOSTED_WORKER_POLICY.id,
    workerPolicyDigest,
    retryPolicy: { retries: 0 },
    requiredEvidence: basePlan.requiredEvidence,
    requiresNativeHardware: basePlan.requiresNativeHardware,
    exclusive: basePlan.exclusive,
    selectiveExecution: false,
    lowerBoundMode: 'protected-v2-widen-only',
    executionPolicyDigest,
  };
  return freeze({ ...core, planDigest: digest(core) });
}

export const protectedCandidateCensusSandboxPolicy = Object.freeze({
  id: SANDBOX_POLICY_ID,
  network: 'none',
  repositoryMount: 'read-only',
  secrets: false,
  lan: false,
});

export const protectedHostedWorkerPolicy = PROTECTED_HOSTED_WORKER_POLICY;
