function stableIds(value, label, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array of stable IDs`);
  }
  const result = [];
  const seen = new Set();
  for (const id of value) {
    if (typeof id !== 'string' || id.length === 0 || !id.includes('::')) {
      throw new TypeError(`${label} must contain stable IDs`);
    }
    if (seen.has(id)) throw new TypeError(`${label} contains duplicate stable ID: ${id}`);
    seen.add(id);
    result.push(id);
  }
  return result.sort();
}

function difference(left, rightSet) {
  return left.filter((value) => !rightSet.has(value));
}

export function evaluateStableIdSelection({
  selectedStableTestIds,
  requiredTruthStableTestIds,
  fullSafeStableTestIds,
  allowedAdditionalStableTestIds = [],
} = {}) {
  const fullSafe = stableIds(fullSafeStableTestIds, 'fullSafeStableTestIds', { allowEmpty: false });
  const additional = stableIds(allowedAdditionalStableTestIds, 'allowedAdditionalStableTestIds');
  const selected = stableIds(selectedStableTestIds, 'selectedStableTestIds');
  const truth = stableIds(requiredTruthStableTestIds, 'requiredTruthStableTestIds');
  const universe = new Set([...fullSafe, ...additional]);

  const selectedOutside = selected.filter((id) => !universe.has(id));
  if (selectedOutside.length) throw new TypeError(`selected stable ID is outside full-safe universe and explicit additional set: ${selectedOutside.join(', ')}`);
  const truthOutside = truth.filter((id) => !universe.has(id));
  if (truthOutside.length) throw new TypeError(`truth stable ID is outside full-safe universe and explicit additional set: ${truthOutside.join(', ')}`);

  const selectedSet = new Set(selected);
  const truthSet = new Set(truth);
  const falseNegativeStableTestIds = difference(truth, selectedSet);
  const overSelectedStableTestIds = difference(selected, truthSet);

  return Object.freeze({
    schemaVersion: 1,
    status: falseNegativeStableTestIds.length ? 'BLOCKED_UNDER_SELECTION' : 'SAFE',
    selectedStableTestIds: Object.freeze(selected),
    requiredTruthStableTestIds: Object.freeze(truth),
    fullSafeStableTestIds: Object.freeze(fullSafe),
    allowedAdditionalStableTestIds: Object.freeze(additional),
    falseNegativeStableTestIds: Object.freeze(falseNegativeStableTestIds),
    overSelectedStableTestIds: Object.freeze(overSelectedStableTestIds),
  });
}

export function assertExactFullSafeCoverage({ expectedStableTestIds, observedStableTestIds } = {}) {
  const expected = stableIds(expectedStableTestIds, 'expectedStableTestIds', { allowEmpty: false });
  const observed = stableIds(observedStableTestIds, 'observedStableTestIds', { allowEmpty: false });
  const expectedSet = new Set(expected);
  const observedSet = new Set(observed);
  const missing = difference(expected, observedSet);
  if (missing.length) throw new TypeError(`full-safe coverage missing stable IDs: ${missing.join(', ')}`);
  const unexpected = difference(observed, expectedSet);
  if (unexpected.length) throw new TypeError(`full-safe coverage has unexpected stable IDs: ${unexpected.join(', ')}`);
  return Object.freeze({ schemaVersion: 1, status: 'EXACT', stableTestIds: Object.freeze(expected) });
}

export function evaluateMatrixCardinality({ axes, maxCombinations } = {}) {
  if (!axes || typeof axes !== 'object' || Array.isArray(axes) || Object.keys(axes).length === 0) {
    throw new TypeError('axes must be a non-empty object');
  }
  if (!Number.isSafeInteger(maxCombinations) || maxCombinations < 1) {
    throw new TypeError('maxCombinations must be a positive safe integer supplied by measured policy');
  }
  let cardinality = 1;
  const axisCardinality = {};
  for (const [name, values] of Object.entries(axes).sort(([left], [right]) => left.localeCompare(right))) {
    if (!Array.isArray(values) || values.length === 0) throw new TypeError(`matrix axis ${name} must be a non-empty array`);
    cardinality *= values.length;
    if (!Number.isSafeInteger(cardinality)) throw new TypeError('matrix cardinality exceeds safe integer range');
    axisCardinality[name] = values.length;
  }
  if (cardinality > maxCombinations) {
    throw new TypeError(`matrix cardinality ${cardinality} exceeds allowed ${maxCombinations}`);
  }
  return Object.freeze({
    schemaVersion: 1,
    cardinality,
    maxCombinations,
    axisCardinality: Object.freeze(axisCardinality),
  });
}
