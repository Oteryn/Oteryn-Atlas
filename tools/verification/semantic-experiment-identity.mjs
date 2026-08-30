import {
  canonicalDigest,
  deepFreeze,
  exactDigest,
  exactSha,
  isPlainObject,
  sortedUniqueStrings,
  stableId,
} from './anti-loop-common.mjs';

function normalizeSelectorIdentity(selector) {
  if (!isPlainObject(selector) || typeof selector.forceFull !== 'boolean' || typeof selector.selectorEscape !== 'boolean') {
    throw new TypeError('semantic experiment selector identity is invalid');
  }
  const requiredStableTestIds = sortedUniqueStrings(selector.requiredStableTestIds ?? [], 'selector required stable test IDs', {
    validate: stableId,
  });
  const specialistObligations = sortedUniqueStrings(selector.specialistObligations ?? [], 'selector specialist obligations');
  if (selector.forceFull && requiredStableTestIds.length === 0) {
    throw new TypeError('force-full must be widening-only and cannot produce an empty required test set');
  }
  if (selector.selectorEscape && requiredStableTestIds.length === 0) {
    throw new TypeError('selector escape must be widening-only and cannot produce an empty required test set');
  }
  return {
    plannerDigest: exactDigest(selector.plannerDigest, 'selector planner digest'),
    catalogDigest: exactDigest(selector.catalogDigest, 'selector catalog digest'),
    censusDigest: exactDigest(selector.censusDigest, 'selector census digest'),
    requiredStableTestIds,
    specialistObligations,
    forceFull: selector.forceFull,
    selectorEscape: selector.selectorEscape,
  };
}

export function buildSemanticExperimentIdentity(input) {
  if (!isPlainObject(input)) throw new TypeError('semantic experiment input is invalid');
  const core = {
    schemaVersion: 1,
    candidateHeadSha: exactSha(input.candidateHeadSha, 'semantic experiment candidate head SHA'),
    authorityDigest: exactDigest(input.authorityDigest, 'semantic experiment authority digest'),
    environmentDigest: exactDigest(input.environmentDigest, 'semantic experiment environment digest'),
    productIdentitiesDigest: exactDigest(input.productIdentitiesDigest, 'semantic experiment product digest'),
    executionPolicyDigest: exactDigest(input.executionPolicyDigest, 'semantic experiment execution policy digest'),
    workloadDigest: exactDigest(input.workloadDigest, 'semantic experiment workload digest'),
    harnessDigest: exactDigest(input.harnessDigest, 'semantic experiment harness digest'),
    selectorIdentity: normalizeSelectorIdentity(input.selectorIdentity),
  };
  return deepFreeze({ ...core, experimentDigest: canonicalDigest(core) });
}

export function validateSelectorObligations(previousCandidate, currentCandidate) {
  const previous = normalizeSelectorIdentity(previousCandidate);
  const current = normalizeSelectorIdentity(currentCandidate);
  const previousStable = new Set(previous.requiredStableTestIds);
  const currentStable = new Set(current.requiredStableTestIds);
  const previousSpecialist = new Set(previous.specialistObligations);
  const currentSpecialist = new Set(current.specialistObligations);
  const addedStableTestIds = current.requiredStableTestIds.filter((id) => !previousStable.has(id));
  const removedStableTestIds = previous.requiredStableTestIds.filter((id) => !currentStable.has(id));
  const addedSpecialistObligations = current.specialistObligations.filter((id) => !previousSpecialist.has(id));
  const removedSpecialistObligations = previous.specialistObligations.filter((id) => !currentSpecialist.has(id));
  const identityChanged = previous.plannerDigest !== current.plannerDigest
    || previous.catalogDigest !== current.catalogDigest
    || previous.censusDigest !== current.censusDigest
    || previous.forceFull !== current.forceFull
    || previous.selectorEscape !== current.selectorEscape;
  const reusable = !identityChanged
    && addedStableTestIds.length === 0
    && removedStableTestIds.length === 0
    && addedSpecialistObligations.length === 0
    && removedSpecialistObligations.length === 0;
  return deepFreeze({
    schemaVersion: 1,
    reusable,
    addedStableTestIds,
    removedStableTestIds,
    addedSpecialistObligations,
    removedSpecialistObligations,
    selectorIdentityChanged: identityChanged,
  });
}
