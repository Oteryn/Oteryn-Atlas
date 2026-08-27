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

function exactStableIds(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must be non-empty stable IDs`);
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

export function buildProtectedHostedExecutionContract(plan, { currentHeadSha } = {}) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan) || plan.schemaVersion !== 2) {
    throw new TypeError('protected hosted execution requires plan schemaVersion 2');
  }
  if (plan.controller?.id !== 'atlas-protected-hosted-controller-v2' || plan.controller?.version !== 2) {
    throw new TypeError('protected hosted execution controller identity is invalid');
  }
  const controllerSourceSha = exactSha(plan.controller.sourceSha, 'controller source SHA');
  const candidateHeadSha = exactSha(plan.candidateHeadSha, 'candidate head SHA');
  if (exactSha(currentHeadSha, 'current PR head') !== candidateHeadSha) {
    throw new TypeError('protected hosted execution current PR head is stale');
  }
  const planDigest = exactDigest(plan.planDigest, 'plan digest');
  const expectedStableTestIdsDigest = exactDigest(plan.expectedStableTestIdsDigest, 'expected stable-ID digest');
  const productIdentitiesDigest = exactDigest(plan.productIdentitiesDigest, 'product identities digest');
  const workerPolicyDigest = exactDigest(plan.workerPolicyDigest, 'worker policy digest');
  const executionPolicyDigest = exactDigest(plan.executionPolicyDigest, 'execution policy digest');
  if (plan.retryPolicy?.retries !== 0) throw new TypeError('protected hosted execution retries must be zero');
  if (plan.selectiveExecution !== false) throw new TypeError('protected hosted execution selective execution must remain disabled');
  if (!Array.isArray(plan.requiredGroupIds) || plan.requiredGroupIds.length === 0 || new Set(plan.requiredGroupIds).size !== plan.requiredGroupIds.length) {
    throw new TypeError('protected hosted execution required group IDs are invalid');
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

  const stableTestIds = exactStableIds(plan.stableTestIds, 'planned stable IDs');
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
  const hostedExpectedStableTestIdsDigest = digest(hostedStableTestIds);
  const specialistExpectedStableTestIdsDigest = digest(specialistStableTestIds);

  return freeze({
    schemaVersion: 1,
    controllerSourceSha,
    candidateHeadSha,
    planDigest,
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
    },
    specialist: {
      groupIds: specialistGroups.map((group) => group.id).sort(),
      stableTestIds: specialistStableTestIds,
    },
    review: {
      groupIds: reviewGroups.map((group) => group.id).sort(),
      stableTestIds: reviewStableTestIds,
    },
  });
}
