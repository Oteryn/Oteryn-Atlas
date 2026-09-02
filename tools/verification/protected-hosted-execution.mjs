import crypto from 'node:crypto';

import { canonicalJson } from './verification-plan-schema.mjs';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

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
  if (typeof value !== 'string' || !SHA.test(value)) throw new TypeError(`${label} must be an exact lowercase SHA`);
  return value;
}

function exactDigest(value, label) {
  if (typeof value !== 'string' || !SHA256.test(value)) throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

const PROTECTED_PROMOTION_QUALIFICATIONS = freeze({
  'fix/issue-179-bounded-real-row-framing': {
    id: 'bounded-real-row-framing-v1',
    headRef: 'fix/issue-179-bounded-real-row-framing',
    changedFiles: [
      'tests/verification/bounded-real-world.test.mjs',
      'tests/verification/protected-hosted-product-identities.test.mjs',
      'tools/verification/bounded-real-world.mjs',
      'tools/verification/protected-hosted-product-identities.json',
    ],
    expectedProductDigest: 'sha256:a19f0371eb5afcdf8c40156d732d5602e970400ec9369607f901e2f0a58c92b6',
  },
  'fix/issue-179-qualification-trust-descriptor': {
    id: 'qualification-trust-descriptor-v1',
    headRef: 'fix/issue-179-qualification-trust-descriptor',
    changedFiles: [
      '.github/workflows/protected-hosted-executor.yml',
      'tests/verification/protected-hosted-compose-promotion.test.mjs',
      'tests/verification/qualification-world.test.mjs',
      'tools/verification/qualification-world.mjs',
    ],
    expectedProductDigest: 'sha256:f53f1dcb8961c42e82191644b7628cfb4f30641344c8876f4178d37a94dd4cd5',
  },

  'fix/issue-179-qualification-functional-fixture': {
    id: 'qualification-functional-fixture-v1',
    headRef: 'fix/issue-179-qualification-functional-fixture',
    changedFiles: [
      'e2e/support/creature-presentation-fixtures.mjs',
      'e2e/tests/audit-desktop.spec.mjs',
      'e2e/tests/creature-interaction-desktop.spec.mjs',
      'e2e/tests/creature-presentation-desktop.spec.mjs',
      'e2e/tests/creatures-desktop.spec.mjs',
      'e2e/tests/desktop.spec.mjs',
      'e2e/tests/farm-explorer-desktop.spec.mjs',
      'e2e/tests/farm-explorer-mobile.spec.mjs',
      'e2e/tests/geometry-desktop.spec.mjs',
      'e2e/tests/geometry-mobile.spec.mjs',
      'e2e/tests/mobile.spec.mjs',
      'e2e/tests/performance-desktop.spec.mjs',
      'e2e/tests/race-desktop.spec.mjs',
      'e2e/tests/runtime.mjs',
      'e2e/tests/soak-desktop.spec.mjs',
      'e2e/tests/state-desktop.spec.mjs',
      'e2e/tests/stress-desktop.spec.mjs',
      'e2e/tests/visual-desktop.spec.mjs',
      'e2e/tests/visual-mobile.spec.mjs',
      'src/browser/semantic-search.mjs',
      'tests/verification/protected-hosted-product-identities.test.mjs',
      'tests/verification/qualification-semantic-source-trust.test.mjs',
      'tests/verification/qualification-world.test.mjs',
      'tools/verification/protected-hosted-product-identities.json',
      'tools/verification/qualification-fixture-definition.mjs',
      'tools/verification/qualification-world.mjs',
      'web/fullworld-farm-explorer.mjs',
      'web/fullworld-search.mjs',
    ],
    expectedProductDigest: 'sha256:2f457583f21cd3ebf8d995c1cc520ea099b277dace69453db08d568de7584613',
    candidateCensusMount: {
      sourceTree: 'exact-candidate-checkout',
      containerRoot: '/candidate',
      readOnly: true,
      dependencySource: '/protected-e2e-node-modules/node_modules',
      dependencyTarget: 'e2e/node_modules',
      dependencyLinkPhase: 'host-before-readonly-mount',
    },
    deterministicRuntimeShim: {
      command: 'python',
      target: '/usr/bin/python3',
      shimRoot: '/tmp/atlas-python-bin',
      pycacheRoot: '/tmp/atlas-python-pycache',
      network: 'none',
      rootFilesystem: 'read-only',
    },
    gateProof: {
      kind: 'complete-hosted-browser-v1',
      workflowPath: '.github/workflows/protected-execution-promotion-qualification.yml',
      event: 'pull_request_target',
      jobName: 'Publish functional qualification fixture compatibility evidence',
      statusContext: 'atlas-protected-product-qualification',
      statusDescription: 'Protected GitHub-hosted complete qualification functional safety net',
    },
  },
});

const PROTECTED_AUTHORITY_REPIN_QUALIFICATIONS = freeze({
  'fix/issue-179-qualification-live-digest-authority': {
    id: 'qualification-live-digest-authority-v1',
    headRef: 'fix/issue-179-qualification-live-digest-authority',
    changedFiles: [
      'tests/verification/protected-hosted-execution.test.mjs',
      'tools/verification/protected-hosted-execution.mjs',
    ],
    sourceHeadRef: 'fix/issue-179-qualification-functional-fixture',
    gateProof: {
      kind: 'complete-hosted-browser-authority-repin-v1',
      workflowPath: '.github/workflows/protected-execution-promotion-qualification.yml',
      event: 'pull_request_target',
      jobName: 'Publish protected qualification authority repin evidence',
      statusContext: 'atlas-protected-product-qualification',
      statusDescription: 'Protected GitHub-hosted qualification authority repin safety net',
    },
  },
});

export function resolveProtectedAuthorityRepinQualification(headRef) {
  if (typeof headRef !== 'string' || headRef.length === 0) {
    throw new TypeError('protected authority repin head ref must be non-empty');
  }
  const qualification = PROTECTED_AUTHORITY_REPIN_QUALIFICATIONS[headRef];
  if (!qualification) throw new TypeError(`unsupported protected authority repin qualification: ${headRef}`);
  return qualification;
}

export function resolveProtectedPromotionQualification(headRef) {
  if (typeof headRef !== 'string' || headRef.length === 0) {
    throw new TypeError('protected promotion head ref must be non-empty');
  }
  const qualification = PROTECTED_PROMOTION_QUALIFICATIONS[headRef];
  if (!qualification) throw new TypeError(`unsupported protected promotion qualification: ${headRef}`);
  exactDigest(qualification.expectedProductDigest, 'protected promotion product digest');
  return qualification;
}

function exactDigestReplacement(trustedSource, candidateSource, previousDigest, label) {
  if (typeof trustedSource !== 'string' || typeof candidateSource !== 'string') {
    throw new TypeError(`${label} authority repin sources must be UTF-8 text`);
  }
  const first = trustedSource.indexOf(previousDigest);
  if (first < 0 || trustedSource.indexOf(previousDigest, first + previousDigest.length) >= 0) {
    throw new TypeError(`${label} authority repin protected bytes must contain the previous digest exactly once`);
  }
  const prefix = trustedSource.slice(0, first);
  const suffix = trustedSource.slice(first + previousDigest.length);
  if (!candidateSource.startsWith(prefix) || !candidateSource.endsWith(suffix)) {
    throw new TypeError(`${label} authority repin must be a digest-only byte replacement`);
  }
  const replacement = candidateSource.slice(prefix.length, candidateSource.length - suffix.length);
  const nextDigest = exactDigest(replacement, `${label} authority repin replacement digest`);
  if (nextDigest === previousDigest) throw new TypeError(`${label} authority repin digest must change`);
  if (`${prefix}${nextDigest}${suffix}` !== candidateSource) {
    throw new TypeError(`${label} authority repin contains bytes outside the digest replacement`);
  }
  return nextDigest;
}

export function validateProtectedAuthorityRepinSources({
  authorityHeadRef,
  trustedModuleSource,
  candidateModuleSource,
  trustedTestSource,
  candidateTestSource,
} = {}) {
  const authority = resolveProtectedAuthorityRepinQualification(authorityHeadRef);
  const sourceQualification = resolveProtectedPromotionQualification(authority.sourceHeadRef);
  const previousProductDigest = exactDigest(sourceQualification.expectedProductDigest, 'protected authority repin previous product digest');
  const expectedProductDigest = exactDigestReplacement(
    trustedModuleSource,
    candidateModuleSource,
    previousProductDigest,
    'protected hosted execution module',
  );
  const mirroredDigest = exactDigestReplacement(
    trustedTestSource,
    candidateTestSource,
    previousProductDigest,
    'protected hosted execution mirror test',
  );
  if (mirroredDigest !== expectedProductDigest) {
    throw new TypeError('protected authority repin module and mirror test digests differ');
  }
  return freeze({
    id: authority.id,
    headRef: authority.headRef,
    changedFiles: [...authority.changedFiles],
    sourceHeadRef: authority.sourceHeadRef,
    previousProductDigest,
    expectedProductDigest,
    gateProof: authority.gateProof,
  });
}

function exactStableIds(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value].sort();
}

function coordinates(id) {
  const first = id.indexOf('::');
  const second = first < 0 ? -1 : id.indexOf('::', first + 2);
  if (first <= 0 || second <= first + 2 || second >= id.length - 2) throw new TypeError(`stable ID is malformed: ${id}`);
  return { project: id.slice(0, first), spec: id.slice(first + 2, second) };
}

function matchesSpecPattern(pattern, spec) {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  return new RegExp(`^${expression}$`).test(spec);
}

function isSpecialistGroup(group) {
  return group.capabilities.browser
    && !group.capabilities.hosted
    && group.capabilities.dataCapability === 'real_fullworld'
    && group.capabilities.specialistReason === 'real-fullworld-product';
}

function isReviewGroup(group) {
  return group.capabilities.browser
    && !group.capabilities.hosted
    && group.capabilities.dataCapability !== 'real_fullworld'
    && group.capabilities.visualReview === true
    && group.capabilities.specialistReason === 'private-visual';
}

function validateGroup(group, requiredIds) {
  if (!group || typeof group !== 'object' || Array.isArray(group) || typeof group.id !== 'string' || !requiredIds.has(group.id)) {
    throw new TypeError('selected execution group is invalid');
  }
  if (!Array.isArray(group.specs) || !Array.isArray(group.projects) || !group.capabilities || typeof group.capabilities !== 'object') {
    throw new TypeError(`selected execution group ${group.id} is malformed`);
  }
  const capabilities = group.capabilities;
  if (typeof capabilities.browser !== 'boolean' || typeof capabilities.hosted !== 'boolean'
    || typeof capabilities.requiresPublication !== 'boolean' || typeof capabilities.dataCapability !== 'string'
    || typeof capabilities.visualReview !== 'boolean') {
    throw new TypeError(`selected execution group ${group.id} capabilities are malformed`);
  }
  if (!capabilities.browser && group.projects.length) throw new TypeError(`selected execution group ${group.id} browser capability conflicts with projects`);
  if (capabilities.browser && !capabilities.hosted && !isSpecialistGroup(group) && !isReviewGroup(group)) {
    throw new TypeError(`non-hosted browser group ${group.id} must be explicit real_fullworld specialist work or bounded visual review`);
  }
  return group;
}

function groupMatchesStableId(group, id) {
  if (!group.capabilities.browser) return false;
  const { project, spec } = coordinates(id);
  return group.projects.includes(project) && group.specs.some((pattern) => matchesSpecPattern(pattern, spec));
}

function partitionByCandidateAdditions(stableTestIds, candidateAdditionSet) {
  const protectedStableTestIds = stableTestIds.filter((id) => !candidateAdditionSet.has(id));
  const candidateAdditionalStableTestIds = stableTestIds.filter((id) => candidateAdditionSet.has(id));
  return { protectedStableTestIds, candidateAdditionalStableTestIds };
}

function partitionHostedByDataCapability(hostedGroups, hostedStableTestIds, candidateAdditionSet, candidateModificationSet) {
  const stableIdCapability = new Map();
  for (const id of hostedStableTestIds) {
    const capabilities = [...new Set(hostedGroups
      .filter((group) => groupMatchesStableId(group, id))
      .map((group) => group.capabilities.dataCapability))]
      .sort();
    if (capabilities.length !== 1) {
      throw new TypeError(`planned stable ID has ambiguous hosted data capability: ${id}`);
    }
    stableIdCapability.set(id, capabilities[0]);
  }

  return [...new Set(hostedGroups.map((group) => group.capabilities.dataCapability))]
    .sort()
    .map((dataCapability) => {
      const stableTestIds = hostedStableTestIds.filter((id) => stableIdCapability.get(id) === dataCapability);
      const candidateModifiedStableTestIds = stableTestIds.filter((id) => candidateModificationSet.has(id));
      return {
        dataCapability,
        groupIds: hostedGroups.filter((group) => group.capabilities.dataCapability === dataCapability).map((group) => group.id).sort(),
        stableTestIds,
        ...partitionByCandidateAdditions(stableTestIds, candidateAdditionSet),
        ...(candidateModifiedStableTestIds.length ? { candidateModifiedStableTestIds } : {}),
      };
    });
}

export function buildProtectedHostedExecutionContract(plan, { currentHeadSha } = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 3) {
    throw new TypeError('protected hosted execution requires plan schemaVersion 3');
  }
  if (plan.controller?.id !== 'atlas-protected-hosted-controller-v3' || plan.controller?.version !== 3) {
    throw new TypeError('protected hosted execution controller identity is invalid');
  }
  const controllerSourceSha = exactSha(plan.controller.sourceSha, 'controller source SHA');
  const candidateHeadSha = exactSha(plan.candidateHeadSha, 'candidate head SHA');
  if (exactSha(currentHeadSha, 'current PR head') !== candidateHeadSha) {
    throw new TypeError('protected hosted execution current PR head is stale');
  }
  const planSemanticDigest = exactDigest(plan.planSemanticDigest, 'plan semantic digest');
  const planInstanceDigest = exactDigest(plan.planInstanceDigest, 'plan instance digest');
  const authorityDigest = exactDigest(plan.authorityDigest, 'plan authority digest');
  const environmentDigest = exactDigest(plan.environmentDigest, 'plan environment digest');
  const expectedStableTestIdsDigest = exactDigest(plan.expectedStableTestIdsDigest, 'expected stable-ID digest');
  const productIdentitiesDigest = exactDigest(plan.productIdentitiesDigest, 'product identities digest');
  const workerPolicyDigest = exactDigest(plan.workerPolicyDigest, 'worker policy digest');
  const executionPolicyDigest = exactDigest(plan.executionPolicyDigest, 'execution policy digest');
  if (plan.retryPolicy?.retries !== 0) throw new TypeError('protected hosted execution retries must be zero');
  if (plan.selectiveExecution !== false) throw new TypeError('protected hosted execution selective execution must remain disabled');
  if (!Array.isArray(plan.requiredGroupIds) || new Set(plan.requiredGroupIds).size !== plan.requiredGroupIds.length) {
    throw new TypeError('protected hosted execution required group IDs are invalid');
  }
  const zeroWork = plan.requiredGroupIds.length === 0;
  if (zeroWork && plan.profile !== 'none') {
    throw new TypeError('protected hosted execution zero-work plan must be profile none');
  }
  if (!Array.isArray(plan.groups) || plan.groups.length !== plan.requiredGroupIds.length) {
    throw new TypeError('protected hosted execution selected groups must exactly match required group IDs');
  }

  const requiredIds = new Set(plan.requiredGroupIds);
  const groups = plan.groups.map((group) => validateGroup(group, requiredIds));
  if (new Set(groups.map((group) => group.id)).size !== groups.length
    || groups.some((group) => !requiredIds.has(group.id))
    || plan.requiredGroupIds.some((id) => !groups.some((group) => group.id === id))) {
    throw new TypeError('protected hosted execution selected groups do not exactly match required group IDs');
  }

  const hostedGroups = groups.filter((group) => group.capabilities.browser && group.capabilities.hosted);
  const specialistGroups = groups.filter(isSpecialistGroup);
  const reviewGroups = groups.filter(isReviewGroup);
  const requiresRealFullWorld = specialistGroups.length > 0;
  if (Boolean(plan.requiresRealFullWorld) !== requiresRealFullWorld) {
    throw new TypeError('protected hosted execution real_fullworld placement conflicts with plan');
  }

  const stableTestIds = exactStableIds(plan.stableTestIds, 'planned stable IDs', { allowEmpty: zeroWork });
  if (zeroWork && (stableTestIds.length !== 0
    || (plan.candidateStableIdAdditions ?? []).length !== 0
    || (plan.candidateStableIdModifications ?? []).length !== 0
    || (plan.requiredDataCapabilities ?? []).length !== 0
    || Boolean(plan.requiresRealFullWorld))) {
    throw new TypeError('protected hosted execution zero-work plan contains executable obligations');
  }
  const stableTestIdSet = new Set(stableTestIds);
  const candidateStableIdAdditions = exactStableIds(plan.candidateStableIdAdditions ?? [], 'candidate stable-ID additions', { allowEmpty: true });
  const candidateStableIdModifications = exactStableIds(plan.candidateStableIdModifications ?? [], 'candidate stable-ID modifications', { allowEmpty: true });
  for (const id of candidateStableIdAdditions) {
    if (!stableTestIdSet.has(id)) throw new TypeError(`candidate stable-ID addition is not in the exact planned census: ${id}`);
  }
  const candidateAdditionSet = new Set(candidateStableIdAdditions);
  for (const id of candidateStableIdModifications) {
    if (!stableTestIdSet.has(id)) throw new TypeError(`candidate stable-ID modification is not in the exact planned census: ${id}`);
    if (candidateAdditionSet.has(id)) throw new TypeError(`candidate stable-ID modification cannot also be an addition: ${id}`);
  }
  const candidateModificationSet = new Set(candidateStableIdModifications);

  const hostedStableTestIds = [];
  const specialistStableTestIds = [];
  const reviewStableTestIds = [];
  for (const id of stableTestIds) {
    const placements = new Set();
    if (hostedGroups.some((group) => groupMatchesStableId(group, id))) placements.add('hosted');
    if (specialistGroups.some((group) => groupMatchesStableId(group, id))) placements.add('specialist');
    if (reviewGroups.some((group) => groupMatchesStableId(group, id))) reviewStableTestIds.push(id);
    if (placements.size === 0) throw new TypeError(`planned stable ID has no selected machine execution placement: ${id}`);
    if (placements.size !== 1) throw new TypeError(`planned stable ID has ambiguous machine execution placement: ${id}`);
    if (placements.has('hosted')) hostedStableTestIds.push(id);
    else specialistStableTestIds.push(id);
  }

  hostedStableTestIds.sort();
  specialistStableTestIds.sort();
  reviewStableTestIds.sort();
  const hostedSet = new Set(hostedStableTestIds);
  const specialistSet = new Set(specialistStableTestIds);
  const hostedCandidateModifiedStableTestIds = candidateStableIdModifications.filter((id) => hostedSet.has(id));
  const specialistCandidateModifiedStableTestIds = candidateStableIdModifications.filter((id) => specialistSet.has(id));
  const hostedExpectedStableTestIdsDigest = digest(hostedStableTestIds);
  const specialistExpectedStableTestIdsDigest = digest(specialistStableTestIds);
  const hostedSourcePartition = partitionByCandidateAdditions(hostedStableTestIds, candidateAdditionSet);
  const specialistSourcePartition = partitionByCandidateAdditions(specialistStableTestIds, candidateAdditionSet);
  const hostedPartitions = partitionHostedByDataCapability(hostedGroups, hostedStableTestIds, candidateAdditionSet, candidateModificationSet);

  return freeze({
    schemaVersion: 2,
    controllerSourceSha,
    candidateHeadSha,
    planSemanticDigest,
    planInstanceDigest,
    authorityDigest,
    environmentDigest,
    expectedStableTestIdsDigest,
    hostedExpectedStableTestIdsDigest,
    specialistExpectedStableTestIdsDigest,
    productIdentitiesDigest,
    workerPolicyDigest,
    executionPolicyDigest,
    retries: 0,
    selectiveExecution: false,
    hosted: {
      groupIds: hostedGroups.map((group) => group.id).sort(),
      stableTestIds: hostedStableTestIds,
      ...hostedSourcePartition,
      candidateModifiedStableTestIds: hostedCandidateModifiedStableTestIds,
      partitions: hostedPartitions,
    },
    specialist: {
      groupIds: specialistGroups.map((group) => group.id).sort(),
      stableTestIds: specialistStableTestIds,
      ...specialistSourcePartition,
      candidateModifiedStableTestIds: specialistCandidateModifiedStableTestIds,
    },
    review: {
      groupIds: reviewGroups.map((group) => group.id).sort(),
      stableTestIds: reviewStableTestIds,
    },
  });
}
