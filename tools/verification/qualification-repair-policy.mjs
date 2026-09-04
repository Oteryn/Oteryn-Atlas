import { profileRank } from './verification-plan-schema.mjs';

export const QUALIFICATION_REPAIR_PATHS = Object.freeze([
  'src/browser/animation-runtime-service.mjs',
  'src/browser/fullworld-trust.mjs',
  'src/browser/semantic-search.mjs',
  'tools/verification/qualification-fixture-definition.mjs',
  'tools/verification/qualification-world.mjs',
  'web/fullworld-app.mjs',
  'web/fullworld-creatures.mjs',
  'web/fullworld-farm-explorer.mjs',
  'web/fullworld-search.mjs',
]);

export const QUALIFICATION_REPAIR_BROWSER_PROOF = Object.freeze({
  project: 'desktop-chromium',
  spec: 'e2e/tests/creatures-desktop.spec.mjs',
  title: 'desktop shipped creature controls persist independently and expose bounded diagnostics',
  dataCapability: 'qualification_fixture',
  workers: 1,
  retries: 0,
});

const ALLOWED_PATHS = new Set(QUALIFICATION_REPAIR_PATHS);
const REQUIRED_PLAN_FLOOR = Object.freeze(['deterministic.core', 'e2e.full']);
const EXECUTED_DETERMINISTIC_GROUPS = Object.freeze(['deterministic.core']);
const REQUIRED_DATA_CAPABILITIES = Object.freeze(['qualification_fixture']);
const VERIFICATION_REGRESSION = /^tests\/verification\/[A-Za-z0-9][A-Za-z0-9._-]*\.test\.mjs$/;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${label} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicates`);
  return [...value].sort();
}

function exactChangedPaths(value) {
  const paths = exactStringArray(value, 'qualification repair changed paths');
  for (const path of paths) {
    if (path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
      throw new TypeError(`qualification repair scope contains an unsafe path: ${path}`);
    }
    if (!ALLOWED_PATHS.has(path) && !VERIFICATION_REGRESSION.test(path)) {
      throw new TypeError(`qualification repair scope is not eligible: ${path}`);
    }
  }
  return paths;
}

function validatePlan(plan, label) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new TypeError(`${label} plan is invalid`);
  profileRank(plan.profile);
  const requiredGroupIds = exactStringArray(plan.requiredGroupIds, `${label} required groups`);
  const requiredDataCapabilities = exactStringArray(plan.requiredDataCapabilities, `${label} data capabilities`);
  if (!plan.retryPolicy || plan.retryPolicy.retries !== 0) throw new TypeError(`${label} retry policy must remain zero`);
  return { profile: plan.profile, requiredGroupIds, requiredDataCapabilities };
}

function requireSuperset(candidate, protectedValues, label) {
  const candidateSet = new Set(candidate);
  const missing = protectedValues.filter((value) => !candidateSet.has(value));
  if (missing.length) throw new TypeError(`qualification repair candidate narrows protected ${label}: ${missing.join(', ')}`);
}

export function validateQualificationRepairTransition({ changedPaths, protectedPlan, candidatePlan } = {}) {
  const paths = exactChangedPaths(changedPaths);
  const protectedState = validatePlan(protectedPlan, 'protected');
  const candidateState = validatePlan(candidatePlan, 'candidate');

  if (profileRank(candidateState.profile) < profileRank(protectedState.profile)) {
    throw new TypeError('qualification repair candidate narrows protected verification profile');
  }
  requireSuperset(candidateState.requiredGroupIds, protectedState.requiredGroupIds, 'required groups');
  requireSuperset(candidateState.requiredDataCapabilities, protectedState.requiredDataCapabilities, 'data capabilities');
  requireSuperset(candidateState.requiredGroupIds, REQUIRED_PLAN_FLOOR, 'plan safety groups');

  if (candidateState.requiredDataCapabilities.length !== REQUIRED_DATA_CAPABILITIES.length
    || candidateState.requiredDataCapabilities[0] !== REQUIRED_DATA_CAPABILITIES[0]) {
    throw new TypeError('qualification repair must remain qualification_fixture-only GitHub-hosted evidence');
  }

  return freeze({
    schemaVersion: 1,
    eligible: true,
    changedPaths: paths,
    profile: candidateState.profile,
    planFloorGroupIds: REQUIRED_PLAN_FLOOR,
    requiredGroupIds: EXECUTED_DETERMINISTIC_GROUPS,
    browserProof: QUALIFICATION_REPAIR_BROWSER_PROOF,
    requiredDataCapabilities: REQUIRED_DATA_CAPABILITIES,
    retryPolicy: { retries: 0 },
  });
}
