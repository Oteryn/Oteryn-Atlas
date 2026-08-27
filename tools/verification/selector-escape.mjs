import crypto from 'node:crypto';

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function stableIds(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be a ${allowEmpty ? '' : 'non-empty '}array of stable IDs`);
  }
  const ids = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || !id.includes('::')) throw new TypeError(`${label} must contain stable IDs`);
    if (seen.has(id)) throw new TypeError(`${label} contains duplicate stable ID: ${id}`);
    seen.add(id);
    ids.push(id);
  }
  return ids.sort();
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('selector escape event must be an object');
  if (typeof event.caseId !== 'string' || event.caseId.length === 0) throw new TypeError('selector escape event caseId is required');
  if (!SHA.test(event.candidateHeadSha ?? '')) throw new TypeError('selector escape event candidateHeadSha must be an exact lowercase SHA');
  if (!SHA256.test(event.planDigest ?? '')) throw new TypeError('selector escape event planDigest must be sha256:<64 lowercase hex>');
  const falseNegativeStableTestIds = stableIds(event.falseNegativeStableTestIds, 'selector escape falseNegativeStableTestIds', { allowEmpty: false });
  if (!SHA256.test(event.evidenceDigest ?? '')) throw new TypeError('selector escape event evidenceDigest must be sha256:<64 lowercase hex>');
  const source = {
    caseId: event.caseId,
    candidateHeadSha: event.candidateHeadSha,
    planDigest: event.planDigest,
    falseNegativeStableTestIds,
  };
  if (digest(source) !== event.evidenceDigest) throw new TypeError('selector escape event evidenceDigest does not bind event bytes');
  return Object.freeze({ ...source, evidenceDigest: event.evidenceDigest });
}

export function validateSelectorEscapeState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('selector escape state must be an object');
  if (state.schemaVersion !== 1) throw new TypeError('selector escape state schemaVersion must be 1');
  if (typeof state.selectiveExecutionEnabled !== 'boolean') throw new TypeError('selector escape state selectiveExecutionEnabled must be boolean');
  if (typeof state.escapeActive !== 'boolean') throw new TypeError('selector escape state escapeActive must be boolean');
  if (!Array.isArray(state.events)) throw new TypeError('selector escape state events must be an array');
  if (state.events.length > 0 && !state.escapeActive) throw new TypeError('escapeActive must remain true once selector escape events exist');
  const events = state.events.map(validateEvent);
  return Object.freeze({
    schemaVersion: 1,
    selectiveExecutionEnabled: state.selectiveExecutionEnabled,
    escapeActive: state.escapeActive,
    events: Object.freeze(events),
  });
}

export function recordSelectorMiss({
  state,
  evidence,
  fullSafeStableTestIds,
  allowedAdditionalStableTestIds = [],
} = {}) {
  const current = validateSelectorEscapeState(state);
  const fullSafe = stableIds(fullSafeStableTestIds, 'fullSafeStableTestIds', { allowEmpty: false });
  const additional = stableIds(allowedAdditionalStableTestIds, 'allowedAdditionalStableTestIds');
  const universe = new Set([...fullSafe, ...additional]);
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new TypeError('selector miss evidence must be an object');
  if (typeof evidence.caseId !== 'string' || evidence.caseId.length === 0) throw new TypeError('selector miss caseId is required');
  if (!SHA.test(evidence.candidateHeadSha ?? '')) throw new TypeError('selector miss candidateHeadSha must be an exact lowercase SHA');
  if (!SHA256.test(evidence.planDigest ?? '')) throw new TypeError('selector miss planDigest must be sha256:<64 lowercase hex>');
  const falseNegativeStableTestIds = stableIds(evidence.falseNegativeStableTestIds, 'selector miss falseNegativeStableTestIds', { allowEmpty: false });
  const outside = falseNegativeStableTestIds.filter((id) => !universe.has(id));
  if (outside.length) throw new TypeError(`selector miss stable ID is outside full-safe universe and explicit additional set: ${outside.join(', ')}`);
  const eventBytes = {
    caseId: evidence.caseId,
    candidateHeadSha: evidence.candidateHeadSha,
    planDigest: evidence.planDigest,
    falseNegativeStableTestIds,
  };
  const event = Object.freeze({ ...eventBytes, evidenceDigest: digest(eventBytes) });
  return Object.freeze({
    schemaVersion: 1,
    selectiveExecutionEnabled: current.selectiveExecutionEnabled,
    escapeActive: true,
    events: Object.freeze([...current.events, event]),
  });
}

export function resolveSelectorFallback({
  state,
  forceFull = false,
  selectiveStableTestIds,
  fullSafeStableTestIds,
  allowedAdditionalStableTestIds = [],
} = {}) {
  const current = validateSelectorEscapeState(state);
  const fullSafe = stableIds(fullSafeStableTestIds, 'fullSafeStableTestIds', { allowEmpty: false });
  const additional = stableIds(allowedAdditionalStableTestIds, 'allowedAdditionalStableTestIds');
  const selected = stableIds(selectiveStableTestIds, 'selectiveStableTestIds');
  const universe = new Set([...fullSafe, ...additional]);
  const outside = selected.filter((id) => !universe.has(id));
  if (outside.length) throw new TypeError(`selective stable ID is outside full-safe universe and explicit additional set: ${outside.join(', ')}`);
  const widenedFullSafe = [...new Set([...fullSafe, ...selected])].sort();

  let mode = 'SELECTIVE_SHADOW';
  let reason = 'shadow-selection';
  let stableTestIds = selected;
  if (forceFull) {
    mode = 'FULL_SAFE';
    reason = 'force-full';
    stableTestIds = widenedFullSafe;
  } else if (current.escapeActive) {
    mode = 'FULL_SAFE';
    reason = 'selector-escape-active';
    stableTestIds = widenedFullSafe;
  } else if (!current.selectiveExecutionEnabled) {
    mode = 'FULL_SAFE';
    reason = 'selective-execution-disabled';
    stableTestIds = widenedFullSafe;
  }
  return Object.freeze({ schemaVersion: 1, mode, reason, stableTestIds: Object.freeze(stableTestIds) });
}
