const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const TIME_BASES = new Set(['active_hunt', 'hunt_wall', 'trip_wall']);
const PROGRESS_SCOPES = new Set(['qualifying_source_kills', 'credited_target_progress', 'selected_creature_kills']);
const CONFIDENCES = Object.freeze([['p50_kills', 0.5], ['p80_kills', 0.8], ['p95_kills', 0.95]]);

export const FARM_NUMERIC_ENVELOPE = Object.freeze({
  max_target_quantity: 100_000,
  max_binomial_kills: 1_000_000_000,
  max_pmf_target_quantity: 5_000,
  max_pmf_outcomes: 128,
  max_pmf_kills: 200_000,
  max_pmf_transitions: 20_000_000,
});

export class FarmIntelligenceError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new FarmIntelligenceError(message);
}

function requirePositiveInteger(value, label, max = FARM_NUMERIC_ENVELOPE.max_target_quantity) {
  requireValue(Number.isSafeInteger(value) && value > 0 && value <= max, `${label} must be a bounded positive integer`);
  return value;
}

function gcdBigInt(a, b) {
  while (b !== 0n) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}

function normalizeRational(value, label = 'probability') {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), `${label} must be a rational object`);
  const { numerator, denominator } = value;
  requireValue(Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator), `${label} rational must use safe integers`);
  requireValue(denominator > 0, `${label} denominator must be positive`);
  requireValue(numerator >= 0 && numerator <= denominator, `${label} must be between zero and one`);
  return Object.freeze({ numerator, denominator, value: numerator / denominator });
}

function addExactFraction(total, rational) {
  const n = BigInt(rational.numerator); const d = BigInt(rational.denominator);
  let numerator = total.numerator * d + n * total.denominator;
  let denominator = total.denominator * d;
  const divisor = gcdBigInt(numerator, denominator);
  numerator /= divisor; denominator /= divisor;
  return { numerator, denominator };
}

function validateExactPmf(outcomes) {
  requireValue(Array.isArray(outcomes) && outcomes.length > 0 && outcomes.length <= FARM_NUMERIC_ENVELOPE.max_pmf_outcomes, 'exact PMF outcome count outside numeric envelope');
  const seen = new Set(); let total = { numerator: 0n, denominator: 1n };
  const normalized = outcomes.map((outcome) => {
    requireValue(outcome && typeof outcome === 'object' && Number.isSafeInteger(outcome.quantity) && outcome.quantity >= 0, 'invalid exact PMF quantity');
    requireValue(!seen.has(outcome.quantity), 'duplicate exact PMF quantity'); seen.add(outcome.quantity);
    const probability = normalizeRational(outcome.probability, 'PMF probability');
    total = addExactFraction(total, probability);
    return Object.freeze({ quantity: outcome.quantity, probability: probability.value });
  });
  requireValue(total.numerator === total.denominator, 'exact PMF probabilities must sum exactly to one');
  return Object.freeze(normalized);
}

function binomialTail(kills, probability, requiredSuccesses) {
  if (requiredSuccesses <= 0) return 1;
  if (kills < requiredSuccesses || probability === 0) return 0;
  if (probability === 1) return 1;
  if (requiredSuccesses === 1) return -Math.expm1(kills * Math.log1p(-probability));

  const logP = Math.log(probability); const logQ = Math.log1p(-probability);
  let logTerm = kills * logQ;
  let maxLog = Number.NEGATIVE_INFINITY; let scaledSum = 0;
  for (let successes = 0; successes < requiredSuccesses; successes += 1) {
    if (successes > 0) {
      logTerm += Math.log(kills - successes + 1) - Math.log(successes) + logP - logQ;
    }
    if (logTerm > maxLog) {
      scaledSum = maxLog === Number.NEGATIVE_INFINITY ? 1 : scaledSum * Math.exp(maxLog - logTerm) + 1;
      maxLog = logTerm;
    } else {
      scaledSum += Math.exp(logTerm - maxLog);
    }
  }
  const logCdf = maxLog + Math.log(scaledSum);
  if (logCdf < -40) return 1;
  return Math.max(0, Math.min(1, -Math.expm1(Math.min(0, logCdf))));
}

function minimumBinomialKills(requiredSuccesses, probability, confidence) {
  if (probability === 0) return null;
  if (probability === 1) return requiredSuccesses;
  let low = requiredSuccesses - 1;
  let high = Math.min(
    FARM_NUMERIC_ENVELOPE.max_binomial_kills,
    Math.max(requiredSuccesses, Math.ceil(requiredSuccesses / probability)),
  );
  while (binomialTail(high, probability, requiredSuccesses) < confidence) {
    requireValue(high < FARM_NUMERIC_ENVELOPE.max_binomial_kills, 'binomial threshold exceeds numeric envelope');
    low = high;
    high = Math.min(FARM_NUMERIC_ENVELOPE.max_binomial_kills, high * 2);
  }
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (binomialTail(mid, probability, requiredSuccesses) >= confidence) high = mid;
    else low = mid;
  }
  return high;
}

function pmfExpectedKills(outcomes, targetQuantity) {
  requirePositiveInteger(targetQuantity, 'PMF target', FARM_NUMERIC_ENVELOPE.max_pmf_target_quantity);
  const p0 = outcomes.find((outcome) => outcome.quantity === 0)?.probability ?? 0;
  if (p0 === 1) return null;
  const expected = new Float64Array(targetQuantity + 1);
  for (let remaining = 1; remaining <= targetQuantity; remaining += 1) {
    let continuation = 0;
    for (const outcome of outcomes) {
      if (outcome.quantity <= 0) continue;
      continuation += outcome.probability * expected[Math.max(0, remaining - outcome.quantity)];
    }
    expected[remaining] = (1 + continuation) / (1 - p0);
    requireValue(Number.isFinite(expected[remaining]), 'PMF expected kills left numeric envelope');
  }
  return expected[targetQuantity];
}

function pmfThresholds(outcomes, targetQuantity) {
  const result = Object.fromEntries(CONFIDENCES.map(([label]) => [label, null]));
  let unresolved = CONFIDENCES.length;
  let distribution = new Float64Array(targetQuantity + 1); distribution[0] = 1;
  let transitions = 0;
  for (let kills = 1; kills <= FARM_NUMERIC_ENVELOPE.max_pmf_kills && unresolved > 0; kills += 1) {
    const next = new Float64Array(targetQuantity + 1);
    for (let quantity = 0; quantity <= targetQuantity; quantity += 1) {
      const mass = distribution[quantity];
      if (mass === 0) continue;
      for (const outcome of outcomes) {
        transitions += 1;
        if (transitions > FARM_NUMERIC_ENVELOPE.max_pmf_transitions) return Object.freeze({ state: 'UNAVAILABLE', reason_code: 'PMF_NUMERIC_ENVELOPE', ...result });
        const after = Math.min(targetQuantity, quantity + outcome.quantity);
        next[after] += mass * outcome.probability;
      }
    }
    distribution = next;
    const completion = distribution[targetQuantity];
    for (const [label, confidence] of CONFIDENCES) {
      if (result[label] == null && completion + 1e-14 >= confidence) { result[label] = kills; unresolved -= 1; }
    }
  }
  if (unresolved > 0) return Object.freeze({ state: 'UNAVAILABLE', reason_code: 'PMF_NUMERIC_ENVELOPE', ...result });
  return Object.freeze({ state: 'AVAILABLE', ...result });
}

function unavailable(reasonCode, message) {
  return Object.freeze({ state: 'UNAVAILABLE', trust_class: 'UNKNOWN', reason_code: reasonCode, message });
}

function personalAcquisition(allocationModel) {
  if (allocationModel == null) {
    return Object.freeze({ state: 'UNAVAILABLE', reason_code: 'ALLOCATION_MODEL_REQUIRED' });
  }
  requireValue(allocationModel === 'all_loot_to_me', 'unsupported personal allocation model');
  return Object.freeze({ state: 'AVAILABLE', allocation_model: allocationModel });
}

export function formatPublishedProbability(rational, digits = 2) {
  requireValue(Number.isInteger(digits) && digits >= 0 && digits <= 6, 'percentage digits outside presentation bound');
  const probability = normalizeRational(rational).value;
  return `${(probability * 100).toFixed(digits)}%`;
}

export function normalizeKphInput(input) {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'KPH input must be an object');
  requireValue(input.kind === 'manual' || input.kind === 'measured', 'KPH source kind unsupported');
  requireValue(typeof input.value === 'number' && Number.isFinite(input.value) && input.value > 0, 'KPH value must be positive and finite');
  requireValue(PROGRESS_SCOPES.has(input.progress_scope), 'KPH progress scope missing or unsupported');
  requireValue(TIME_BASES.has(input.time_base), 'KPH time base missing or unsupported');
  if (input.kind === 'manual') {
    return Object.freeze({ kind: 'manual', value: input.value, progress_scope: input.progress_scope, time_base: input.time_base, source_label: 'Manual assumption' });
  }
  const requiredMeasured = ['cohort_signature', 'world_id', 'world_profile_revision', 'content_revision', 'ruleset_revision', 'modifier_context', 'sample', 'quality_state', 'privacy_state'];
  requireValue(input.trust_class === 'MEASURED' && input.availability_state === 'AVAILABLE' && requiredMeasured.every((field) => input[field] != null), 'measured KPH cohort/revision/sample/quality metadata required');
  return Object.freeze({ ...input, source_label: 'Measured Hunt Intelligence' });
}

function attachKphTimes(result, kphInput, requiredScope) {
  if (kphInput == null) return result;
  const kph = normalizeKphInput(kphInput);
  requireValue(kph.progress_scope === requiredScope, `KPH progress scope must be ${requiredScope}`);
  const timed = { ...result, kph_source: kph.source_label, kph_value: kph.value, progress_scope: kph.progress_scope, time_base: kph.time_base };
  for (const field of ['expected_kills', 'p50_kills', 'p80_kills', 'p95_kills']) {
    if (typeof result[field] === 'number' && Number.isFinite(result[field])) {
      timed[field.replace('_kills', '_hours')] = result[field] / kph.value;
    }
  }
  return Object.freeze(timed);
}

export function estimateKillTarget({ targetKills, kph = null, progressScope = 'credited_target_progress' }) {
  requirePositiveInteger(targetKills, 'kill target');
  requireValue(progressScope === 'credited_target_progress' || progressScope === 'selected_creature_kills', 'kill target progress scope unsupported');
  const result = { state: 'AVAILABLE', trust_class: 'ESTIMATE', target_kills: targetKills, progress_scope: progressScope };
  if (kph == null) return Object.freeze(result);
  const normalized = normalizeKphInput(kph);
  requireValue(normalized.progress_scope === progressScope, `kill target KPH must count ${progressScope}`);
  return Object.freeze({
    ...result,
    estimated_hours: targetKills / normalized.value,
    kph_source: normalized.source_label,
    kph_value: normalized.value,
    progress_scope: normalized.progress_scope,
    time_base: normalized.time_base,
  });
}

function estimateFixed(model, targetQuantity) {
  const probability = normalizeRational(model.success_probability, 'success probability').value;
  const quantity = requirePositiveInteger(model.success_quantity, 'success quantity');
  const requiredSuccesses = Math.ceil(targetQuantity / quantity);
  if (probability === 0) return Object.freeze({ state: 'UNREACHABLE', trust_class: 'ESTIMATE', reason_code: 'ZERO_SUCCESS_PROBABILITY', required_successes: requiredSuccesses });
  const expectedKills = requiredSuccesses / probability;
  requireValue(Number.isFinite(expectedKills) && expectedKills <= FARM_NUMERIC_ENVELOPE.max_binomial_kills, 'expected kills exceeds numeric envelope');
  const thresholds = Object.fromEntries(CONFIDENCES.map(([label, confidence]) => [label, minimumBinomialKills(requiredSuccesses, probability, confidence)]));
  return Object.freeze({ state: 'AVAILABLE', trust_class: 'ESTIMATE', required_successes: requiredSuccesses, expected_kills: expectedKills, ...thresholds });
}

function estimateExactPmf(model, targetQuantity) {
  requirePositiveInteger(targetQuantity, 'PMF target', FARM_NUMERIC_ENVELOPE.max_pmf_target_quantity);
  const outcomes = validateExactPmf(model.outcomes);
  const expectedKills = pmfExpectedKills(outcomes, targetQuantity);
  if (expectedKills == null) {
    return Object.freeze({ state: 'UNREACHABLE', trust_class: 'ESTIMATE', reason_code: 'ZERO_PROGRESS_PROBABILITY' });
  }
  const thresholds = pmfThresholds(outcomes, targetQuantity);
  if (thresholds.state !== 'AVAILABLE') {
    return Object.freeze({ state: 'UNAVAILABLE', trust_class: 'UNKNOWN', reason_code: thresholds.reason_code, expected_kills: expectedKills });
  }
  return Object.freeze({
    state: 'AVAILABLE',
    trust_class: 'ESTIMATE',
    expected_kills: expectedKills,
    p50_kills: thresholds.p50_kills,
    p80_kills: thresholds.p80_kills,
    p95_kills: thresholds.p95_kills,
  });
}

export function estimateItemTarget({ relation, targetQuantity, kph = null, allocationModel = null }) {
  requireValue(relation && typeof relation === 'object', 'loot relation required');
  requireValue(relation.probability_scope === 'published_base' || relation.probability_scope === 'published_context', 'published probability scope required');
  requirePositiveInteger(targetQuantity, 'item target');
  const process = relation.process;
  requireValue(process && typeof process === 'object' && process.quantity_model && typeof process.quantity_model === 'object', 'loot process missing');
  if (process.kind !== 'stationary_iid_per_qualifying_kill') {
    return unavailable('PROCESS_NOT_STATIONARY_IID', 'Exact IID completion thresholds require stationary per-qualifying-kill semantics.');
  }
  const model = process.quantity_model;
  let estimate;
  if (model.kind === 'bernoulli_fixed') estimate = estimateFixed(model, targetQuantity);
  else if (model.kind === 'exact_quantity_pmf') estimate = estimateExactPmf(model, targetQuantity);
  else return unavailable('QUANTITY_MODEL_NOT_EXACT', 'Exact per-kill quantity distribution is unavailable.');
  const enriched = Object.freeze({
    ...estimate,
    generated_scope: 'generated_drops',
    probability_scope: relation.probability_scope,
    quantity_model: model.kind,
    personal_acquisition: personalAcquisition(allocationModel),
  });
  if (estimate.state !== 'AVAILABLE') return enriched;
  return attachKphTimes(enriched, kph, 'qualifying_source_kills');
}

export function initializeTaskEstimate(task) {
  requireValue(task && typeof task === 'object' && Array.isArray(task.requirements), 'authoritative task record required');
  requireValue(task.requirements.length === 1, 'multi/grouped task requirements are unsupported in Farm Explorer v1');
  const requirement = task.requirements[0];
  requireValue(requirement && typeof requirement === 'object' && Number.isSafeInteger(requirement.quantity) && requirement.quantity > 0, 'invalid authoritative task requirement');
  requireValue(
    (task.kind === 'item_delivery' && requirement.kind === 'item') ||
    (task.kind === 'kill' && requirement.kind === 'creature'),
    'authoritative task requirement kind mismatch',
  );
  return {
    task_id: task.task_id,
    authoritative_requirement: Object.freeze({ ...requirement }),
    estimate_target: requirement.quantity,
  };
}

function requireDigest(value, label) {
  requireValue(typeof value === 'string' && DIGEST_RE.test(value), `${label} invalid`);
  return value;
}

export function validateFarmBundleManifest(manifest, expectations = {}) {
  requireValue(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'farm bundle manifest must be an object');
  requireValue(manifest.schema_version === 1 && manifest.product === 'atlas-farm-bundle-v1', 'farm bundle product unsupported');
  requireValue(typeof manifest.source_game_revision === 'string' && SHA_RE.test(manifest.source_game_revision), 'farm bundle Game revision invalid');
  requireDigest(manifest.source_farm_semantic_digest, 'farm source semantic digest');
  const farmRoot = requireDigest(manifest.farm_intelligence_root, 'farm intelligence root');
  const spatialRoot = requireDigest(manifest.farm_spatial_root, 'farm spatial root');
  const creatureDigest = requireDigest(manifest.creature_publication_digest, 'creature publication digest');
  const bundleRoot = requireDigest(manifest.bundle_root, 'farm bundle root');
  requireValue(manifest.compatibility && typeof manifest.compatibility === 'object' && !Array.isArray(manifest.compatibility), 'farm bundle compatibility tuple missing');
  requireValue(manifest.counts && typeof manifest.counts === 'object' && !Array.isArray(manifest.counts), 'farm bundle counts missing');
  requireValue(typeof expectations.expectedFarmRoot === 'string' && DIGEST_RE.test(expectations.expectedFarmRoot), 'expected farm root required');
  requireValue(typeof expectations.expectedSpatialRoot === 'string' && DIGEST_RE.test(expectations.expectedSpatialRoot), 'expected spatial root required');
  requireValue(typeof expectations.expectedCreatureDigest === 'string' && DIGEST_RE.test(expectations.expectedCreatureDigest), 'expected creature digest required');
  requireValue(typeof expectations.expectedBundleRoot === 'string' && DIGEST_RE.test(expectations.expectedBundleRoot), 'expected bundle root required');
  requireValue(farmRoot === expectations.expectedFarmRoot, 'farm intelligence root mismatch');
  requireValue(spatialRoot === expectations.expectedSpatialRoot, 'farm spatial root mismatch');
  requireValue(creatureDigest === expectations.expectedCreatureDigest, 'creature publication digest mismatch');
  requireValue(bundleRoot === expectations.expectedBundleRoot, 'farm bundle root mismatch');
  return Object.freeze({ ...manifest });
}

const FARM_AVAILABILITY = new Set(['AVAILABLE', 'UPSTREAM_BLOCKED', 'MALFORMED', 'STALE', 'INCOMPATIBLE', 'UNAVAILABLE']);
const FARM_CAPABILITY = new Set(['SUPPORTED', 'PARTIAL', 'UNSUPPORTED']);
const FARM_COMPAT_KEYS = Object.freeze([
  'world_id', 'world_profile_revision', 'content_revision', 'ruleset_revision',
  'modifier_context', 'creature_identity_scheme', 'creature_identity_revision',
  'coordinate_profile', 'creature_publication_digest',
]);

function requireIdentity(value, label) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= 256, `${label} invalid`);
  requireValue(!/[\\/\u0000-\u001f\u007f]/.test(value), `${label} must not be path-shaped`);
  return value;
}

function validateDescriptor(value, label) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), `${label} descriptor invalid`);
  requireValue(typeof value.path === 'string' && value.path.length > 0 && !value.path.includes('..') && !value.path.startsWith('/') && !value.path.includes('\\'), `${label} path invalid`);
  requireValue(Number.isSafeInteger(value.bytes) && value.bytes > 0, `${label} byte count invalid`);
  requireDigest(value.digest, `${label} digest`);
  return value;
}

function sameCompatibility(actual, expected) {
  if (!expected) return true;
  return FARM_COMPAT_KEYS.every((key) => actual?.[key] === expected?.[key]);
}
export function validateFarmIntelligenceIndex(index, expectations = {}) {
  requireValue(index && typeof index === 'object' && !Array.isArray(index), 'farm intelligence index invalid');
  requireValue(index.schema_version === 1 && index.product === 'atlas-farm-intelligence-v1', 'farm intelligence product unsupported');
  requireValue(index.source && typeof index.source === 'object', 'farm intelligence source missing');
  requireValue(index.source.authority === 'Oteryn/Oteryn-Game', 'farm intelligence source authority invalid');
  requireValue(index.source.schema_version === 1, 'farm intelligence source schema unsupported');
  requireValue(index.source.contract_id === expectations.acceptedContractId, 'farm intelligence upstream contract is not accepted');
  requireValue(index.source.game_revision === expectations.acceptedGameRevision && SHA_RE.test(index.source.game_revision ?? ''), 'farm intelligence Game revision is not accepted');
  requireValue(index.source.semantic_digest === expectations.verifiedSemanticDigest && DIGEST_RE.test(index.source.semantic_digest ?? ''), 'farm intelligence semantic digest mismatch');
  requireValue(index.product_root === expectations.expectedProductRoot && DIGEST_RE.test(index.product_root ?? ''), 'farm intelligence product root mismatch');
  requireValue(index.compatibility && typeof index.compatibility === 'object', 'farm intelligence compatibility tuple missing');
  requireValue(FARM_COMPAT_KEYS.every((key) => key in index.compatibility), 'farm intelligence compatibility tuple incomplete');
  requireValue(index.compatibility.creature_identity_scheme === 'monster-entity-v1', 'farm intelligence creature identity scheme unsupported');
  requireValue(index.compatibility.coordinate_profile === 'oteryn-native-floor-v1', 'farm intelligence coordinate profile unsupported');
  requireDigest(index.compatibility.creature_publication_digest, 'farm intelligence creature publication digest');
  if (expectations.expectedCompatibility) requireValue(sameCompatibility(index.compatibility, expectations.expectedCompatibility), 'farm intelligence compatibility mismatch');

  requireValue(index.capabilities && typeof index.capabilities === 'object', 'farm intelligence capabilities missing');
  for (const value of Object.values(index.capabilities)) requireValue(FARM_CAPABILITY.has(value), 'farm intelligence capability state invalid');
  requireValue(index.counts && typeof index.counts === 'object', 'farm intelligence counts missing');
  for (const key of ['items', 'creatures', 'loot_relations', 'tasks']) requireValue(Number.isSafeInteger(index.counts[key]) && index.counts[key] >= 0, `farm intelligence ${key} count invalid`);
  validateDescriptor(index.item_search, 'farm item search');
  validateDescriptor(index.creatures, 'farm creature catalogue');
  validateDescriptor(index.tasks, 'farm task catalogue');
  requireValue(Array.isArray(index.item_shards) && index.item_shards.length === index.counts.items, 'farm item shard count mismatch');
  const seen = new Set();
  for (const entry of index.item_shards) {
    requireIdentity(entry.item_id, 'farm item shard identity');
    requireValue(!seen.has(entry.item_id), 'duplicate farm item shard identity'); seen.add(entry.item_id);
    validateDescriptor(entry, 'farm item shard');
  }
  return Object.freeze({ ...index });
}
export function validateFarmSpatialIndex(index, expectations = {}) {
  requireValue(index && typeof index === 'object' && !Array.isArray(index), 'farm spatial index invalid');
  requireValue(index.schema_version === 1 && index.product === 'atlas-farm-spatial-v1', 'farm spatial product unsupported');
  requireValue(index.farm_intelligence_root === expectations.expectedFarmRoot && DIGEST_RE.test(index.farm_intelligence_root ?? ''), 'farm spatial farm-intelligence root mismatch');
  requireValue(index.product_root === expectations.expectedProductRoot && DIGEST_RE.test(index.product_root ?? ''), 'farm spatial product root mismatch');
  requireValue(index.source_creatures && typeof index.source_creatures === 'object', 'farm spatial creature source missing');
  requireValue(index.source_creatures.contract_id === 'oteryn-game-atlas-export-v1', 'farm spatial creature contract unsupported');
  requireValue(['static-creatures-v1', 'animated-creatures-v1'].includes(index.source_creatures.capability), 'farm spatial creature capability unsupported');
  requireValue(index.source_creatures.semantic_digest === expectations.expectedCreatureDigest, 'farm spatial creature digest mismatch');
  requireValue(index.source_creatures.coordinate_profile === 'oteryn-native-floor-v1', 'farm spatial coordinate profile unsupported');
  requireValue(index.compatibility && typeof index.compatibility === 'object', 'farm spatial compatibility tuple missing');
  requireValue(index.compatibility.creature_publication_digest === expectations.expectedCreatureDigest, 'farm spatial compatibility creature digest mismatch');
  requireValue(index.compatibility.coordinate_profile === index.source_creatures.coordinate_profile, 'farm spatial coordinate profile mismatch');
  if (expectations.expectedCompatibility) requireValue(sameCompatibility(index.compatibility, expectations.expectedCompatibility), 'farm spatial compatibility mismatch');

  requireValue(index.counts && typeof index.counts === 'object', 'farm spatial counts missing');
  for (const key of ['entities', 'indexed_placements', 'unjoinable_placements']) requireValue(Number.isSafeInteger(index.counts[key]) && index.counts[key] >= 0, `farm spatial ${key} count invalid`);
  requireValue(Array.isArray(index.entities) && index.entities.length === index.counts.entities, 'farm spatial entity count mismatch');
  const seen = new Set(); let placements = 0;
  for (const entry of index.entities) {
    const entityId = requireIdentity(entry.entity_id, 'farm spatial entity identity');
    requireValue(entityId.startsWith('monster-entity:'), 'farm spatial entity identity scheme invalid');
    requireValue(!seen.has(entityId), 'duplicate farm spatial entity identity'); seen.add(entityId);
    requireValue(Number.isSafeInteger(entry.records) && entry.records > 0, 'farm spatial entity record count invalid');
    requireValue(Array.isArray(entry.floors) && entry.floors.every(Number.isInteger), 'farm spatial entity floors invalid');
    requireValue([...entry.floors].sort((a, b) => a - b).every((floor, i) => floor === entry.floors[i]), 'farm spatial entity floors must be sorted');
    validateDescriptor(entry, 'farm spatial entity shard'); placements += entry.records;
  }
  requireValue(placements === index.counts.indexed_placements, 'farm spatial indexed placement count mismatch');
  return Object.freeze({ ...index });
}
export function findItemFarmRecord(itemId, detail) {
  requireIdentity(itemId, 'farm item identity');
  requireValue(detail && typeof detail === 'object' && detail.schema_version === 1, 'farm item detail invalid');
  requireValue(detail.item && detail.item.item_id === itemId, 'farm item detail identity mismatch');
  requireIdentity(detail.item.item_id, 'farm item detail identity');
  requireValue(Array.isArray(detail.loot_relations), 'farm item loot relations invalid');
  const relations = detail.loot_relations.map((relation) => {
    requireValue(relation && typeof relation === 'object' && relation.item_id === itemId, 'farm loot relation item mismatch');
    requireIdentity(relation.relation_id, 'farm loot relation identity');
    const creatureId = requireIdentity(relation.creature_id, 'farm loot relation creature identity');
    requireValue(creatureId.startsWith('monster-entity:'), 'farm loot relation creature identity scheme invalid');
    requireValue(relation.probability_scope === 'published_base' || relation.probability_scope === 'published_context', 'farm loot probability scope invalid');
    requireValue(relation.process && typeof relation.process === 'object', 'farm loot process missing');
    return Object.freeze({ ...relation });
  });
  return Object.freeze({ item: Object.freeze({ ...detail.item }), loot_relations: Object.freeze(relations) });
}

export function findCreatureSpatialDescriptor(entityId, spatialIndex) {
  requireIdentity(entityId, 'farm creature identity');
  requireValue(spatialIndex && Array.isArray(spatialIndex.entities), 'farm spatial index entities missing');
  const match = spatialIndex.entities.find((entry) => entry.entity_id === entityId);
  return match ? Object.freeze({ ...match }) : null;
}

function normalizeReadinessState(value, label) {
  requireValue(value && typeof value === 'object' && FARM_AVAILABILITY.has(value.state), `${label} readiness state invalid`);
  requireValue(typeof value.reason === 'string' && value.reason.length > 0 && value.reason.length <= 512, `${label} readiness reason invalid`);
  return Object.freeze({ state: value.state, reason: value.reason });
}
function combineReadiness(states, availableReason) {
  const blocked = states.find((entry) => entry.state !== 'AVAILABLE');
  return blocked ? Object.freeze({ state: blocked.state, reason: blocked.reason }) : Object.freeze({ state: 'AVAILABLE', reason: availableReason });
}

export function buildFarmReadiness({ gameRevision, farmIntelligence, farmSpatial, interactionSeam, presentationSeam }) {
  requireValue(typeof gameRevision === 'string' && SHA_RE.test(gameRevision), 'farm readiness Game revision invalid');
  const farm = normalizeReadinessState(farmIntelligence, 'farm intelligence');
  const spatial = normalizeReadinessState(farmSpatial, 'farm spatial');
  const interaction = normalizeReadinessState(interactionSeam, 'interaction seam');
  const presentation = normalizeReadinessState(presentationSeam, 'presentation seam');
  return Object.freeze({
    schema_version: 1,
    game_revision: gameRevision,
    farmIntelligence: farm,
    farmSpatial: spatial,
    interactionSeam: interaction,
    presentationSeam: presentation,
    monsterDropSources: combineReadiness([farm], 'Accepted monster drop-source publication is available.'),
    mapPlacements: combineReadiness([farm, spatial], 'Compatible farm and spatial publications are available.'),
    estimatorCore: Object.freeze({ state: 'AVAILABLE', reason: 'Pure deterministic estimator core is available without production farm facts.' }),
    nearCreatureInteraction: combineReadiness([farm, spatial, interaction, presentation], 'Canonical creature interaction and presentation seams are available.'),
    baseMap: Object.freeze({ state: 'AVAILABLE', reason: 'Farm capability failure does not disable the base Atlas.' }),
  });
}
