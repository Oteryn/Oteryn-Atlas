import { validateVerificationCatalog } from './verification-plan-schema.mjs';

const FULL_GROUP_ID = 'e2e.full';
const QUALIFICATION_FIXTURE = 'qualification_fixture';
const SAFE_E2E_SPEC = /^e2e\/tests\/[A-Za-z0-9_.-]+\.spec\.mjs$/;

function invalid(detail) {
  throw new TypeError(`hosted e2e.full safety net invalid: ${detail}`);
}

function validateInventory(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
    || candidate.schemaVersion !== 1 || !Array.isArray(candidate.specs)) {
    invalid('inventory requires schemaVersion 1 and specs array');
  }
  const bySpec = new Map();
  for (const entry of candidate.specs) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.spec !== 'string' || !SAFE_E2E_SPEC.test(entry.spec)) {
      invalid('inventory contains malformed spec entry');
    }
    if (bySpec.has(entry.spec)) invalid(`inventory contains duplicate spec ${entry.spec}`);
    if (!['qualification_fixture', 'bounded_real_world', 'real_fullworld'].includes(entry.dataCapability)) {
      invalid(`inventory capability is invalid for ${entry.spec}`);
    }
    if (typeof entry.splitRequired !== 'boolean') invalid(`inventory splitRequired is invalid for ${entry.spec}`);
    bySpec.set(entry.spec, entry);
  }
  return bySpec;
}

export function resolveHostedFullSafe({ catalog, inventory }) {
  const normalizedCatalog = validateVerificationCatalog(catalog);
  const group = normalizedCatalog.groups[FULL_GROUP_ID];
  if (!group) invalid('e2e.full group is missing');
  if (!group.fullSafetyNet) invalid('e2e.full is not marked as the full safety net');
  if (!group.capabilities.browser) invalid('e2e.full must be browser-backed');
  if (!group.capabilities.hosted) invalid('e2e.full must be GitHub-hosted');
  if (!group.capabilities.requiresPublication) invalid('e2e.full must require publication bytes');
  if (group.capabilities.dataCapability !== QUALIFICATION_FIXTURE) {
    invalid('e2e.full must require qualification_fixture data');
  }
  if (group.capabilities.visualReview || group.capabilities.specialistReason !== null) {
    invalid('e2e.full must not contain specialist or visual-review obligations');
  }
  if (group.specs.length === 0 || group.projects.length === 0) invalid('e2e.full requires specs and projects');
  if (group.specs.some((spec) => !SAFE_E2E_SPEC.test(spec) || spec.includes('..') || spec.includes('\\'))) {
    invalid('e2e.full contains unsafe spec path');
  }

  const inventoryBySpec = validateInventory(inventory);
  for (const spec of group.specs) {
    const entry = inventoryBySpec.get(spec);
    if (!entry) invalid(`inventory is missing ${spec}`);
    if (entry.dataCapability !== QUALIFICATION_FIXTURE) {
      invalid(`${spec} capability must remain qualification_fixture`);
    }
    if (entry.splitRequired) invalid(`${spec} still requires split before hosted full-safety execution`);
  }

  const specs = [...group.specs].sort();
  const projects = [...group.projects].sort();
  return Object.freeze({
    groupId: FULL_GROUP_ID,
    dataCapability: QUALIFICATION_FIXTURE,
    specs: Object.freeze(specs),
    playwrightSpecs: Object.freeze(specs.map((spec) => spec.slice('e2e/'.length))),
    projects: Object.freeze(projects),
  });
}
