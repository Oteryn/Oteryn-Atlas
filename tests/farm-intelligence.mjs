import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FarmIntelligenceError,
  estimateItemTarget,
  estimateKillTarget,
  formatPublishedProbability,
  initializeTaskEstimate,
  normalizeKphInput,
  validateFarmBundleManifest,
  validateFarmIntelligenceIndex,
  validateFarmSpatialIndex,
  findItemFarmRecord,
  findCreatureSpatialDescriptor,
  buildFarmReadiness,
} from '../src/browser/farm-intelligence.mjs';

const rational = (numerator, denominator = 1000) => ({ numerator, denominator });
const fixed = (p, q = 1) => ({
  kind: 'stationary_iid_per_qualifying_kill',
  quantity_model: { kind: 'bernoulli_fixed', success_probability: p, success_quantity: q },
});
const pmf = (outcomes) => ({
  kind: 'stationary_iid_per_qualifying_kill',
  quantity_model: { kind: 'exact_quantity_pmf', outcomes },
});

function independentBinomialTail(k, p, required) {
  let distribution = [1];
  for (let kill = 0; kill < k; kill += 1) {
    const next = Array(distribution.length + 1).fill(0);
    for (let successes = 0; successes < distribution.length; successes += 1) {
      next[successes] += distribution[successes] * (1 - p);
      next[successes + 1] += distribution[successes] * p;
    }
    distribution = next;
  }
  return distribution.slice(required).reduce((sum, value) => sum + value, 0);
}

function independentThreshold(required, p, confidence) {
  for (let k = required; k <= 1000; k += 1) {
    if (independentBinomialTail(k, p, required) + 1e-12 >= confidence) return k;
  }
  throw new Error('oracle envelope exceeded');
}

const itemRelation = (process) => ({
  relation_id: 'loot:test',
  item_id: 'item:test',
  creature_id: `monster-entity:${'a'.repeat(32)}`,
  probability_scope: 'published_base',
  process,
});

test('fixed Bernoulli estimator preserves q>1 and matches an independent threshold oracle', () => {
  const result = estimateItemTarget({ relation: itemRelation(fixed(rational(1, 8), 2)), targetQuantity: 10 });
  assert.equal(result.state, 'AVAILABLE');
  assert.equal(result.generated_scope, 'generated_drops');
  assert.equal(result.required_successes, 5);
  assert.equal(result.expected_kills, 40);
  for (const [label, confidence] of [['p50_kills', 0.5], ['p80_kills', 0.8], ['p95_kills', 0.95]]) {
    assert.equal(result[label], independentThreshold(5, 1 / 8, confidence));
  }
});

test('p=0 is unreachable and p=1 is deterministic', () => {
  assert.equal(estimateItemTarget({ relation: itemRelation(fixed(rational(0, 1))), targetQuantity: 1 }).state, 'UNREACHABLE');
  const certain = estimateItemTarget({ relation: itemRelation(fixed(rational(1, 1), 3)), targetQuantity: 7 });
  assert.equal(certain.expected_kills, 3);
  assert.deepEqual([certain.p50_kills, certain.p80_kills, certain.p95_kills], [3, 3, 3]);
});

test('exact PMF expected kills uses hitting-time semantics instead of target divided by mean yield', () => {
  const process = pmf([
    { quantity: 0, probability: rational(1, 2) },
    { quantity: 2, probability: rational(1, 2) },
  ]);
  const result = estimateItemTarget({ relation: itemRelation(process), targetQuantity: 3 });
  assert.equal(result.state, 'AVAILABLE');
  assert.equal(result.expected_kills, 4);
  assert.notEqual(result.expected_kills, 3, 'N / mean quantity would be wrong because of overshoot');
  assert.deepEqual([result.p50_kills, result.p80_kills, result.p95_kills], [3, 5, 8]);
});

test('exact PMF with p0=1 is explicitly unreachable', () => {
  const process = pmf([{ quantity: 0, probability: rational(1, 1) }]);
  const result = estimateItemTarget({ relation: itemRelation(process), targetQuantity: 4 });
  assert.equal(result.state, 'UNREACHABLE');
  assert.equal(result.reason_code, 'ZERO_PROGRESS_PROBABILITY');
});

test('bounded or non-IID semantics refuse exact target probability maths', () => {
  const bounded = {
    kind: 'stationary_iid_per_qualifying_kill',
    quantity_model: { kind: 'bounded_unknown', min_quantity: 0, max_quantity: 4 },
  };
  assert.equal(estimateItemTarget({ relation: itemRelation(bounded), targetQuantity: 10 }).state, 'UNAVAILABLE');
  const stateful = { kind: 'exact_non_iid', quantity_model: { kind: 'unsupported' } };
  assert.equal(estimateItemTarget({ relation: itemRelation(stateful), targetQuantity: 10 }).reason_code, 'PROCESS_NOT_STATIONARY_IID');
});

test('extreme rare single-drop P95 uses a stable closed-form oracle', () => {
  const p = 1 / 10_000;
  const result = estimateItemTarget({ relation: itemRelation(fixed(rational(1, 10_000))), targetQuantity: 1 });
  const oracle = Math.ceil(Math.log(1 - 0.95) / Math.log1p(-p));
  assert.equal(result.expected_kills, 10_000);
  assert.equal(result.p95_kills, oracle);
});

test('binomial threshold search caps its probe without rejecting an in-envelope P95', () => {
  const p = 7 / 2_000_000_000;
  const oracle = Math.ceil(Math.log(1 - 0.95) / Math.log1p(-p));
  assert.ok(oracle < 1_000_000_000);
  const result = estimateItemTarget({ relation: itemRelation(fixed(rational(7, 2_000_000_000))), targetQuantity: 1 });
  assert.equal(result.p95_kills, oracle);
});

test('near-one probability with a large target stays stable at the exact minimum threshold', () => {
  const result = estimateItemTarget({ relation: itemRelation(fixed(rational(999_999, 1_000_000))), targetQuantity: 10_000 });
  assert.equal(result.state, 'AVAILABLE');
  assert.ok(Math.abs(result.expected_kills - (10_000 / 0.999999)) < 1e-9);
  assert.deepEqual([result.p50_kills, result.p80_kills, result.p95_kills], [10_000, 10_000, 10_000]);
});

test('percentage presentation rounding never feeds estimator math', () => {
  const relation = itemRelation(fixed(rational(1, 3)));
  assert.equal(formatPublishedProbability(rational(1, 3), 2), '33.33%');
  assert.equal(estimateItemTarget({ relation, targetQuantity: 1 }).expected_kills, 3);
});

test('manual KPH requires explicit progress scope and time base', () => {
  const kph = normalizeKphInput({ kind: 'manual', value: 50, progress_scope: 'credited_target_progress', time_base: 'hunt_wall' });
  const result = estimateKillTarget({ targetKills: 100, kph });
  assert.equal(result.state, 'AVAILABLE');
  assert.equal(result.estimated_hours, 2);
  assert.equal(result.kph_source, 'Manual assumption');
  assert.equal(result.time_base, 'hunt_wall');
  assert.throws(() => normalizeKphInput({ kind: 'manual', value: 0, progress_scope: 'credited_target_progress', time_base: 'hunt_wall' }), FarmIntelligenceError);
  assert.throws(() => normalizeKphInput({ kind: 'manual', value: 50, progress_scope: 'credited_target_progress' }), FarmIntelligenceError);
});

test('measured KPH cannot enter Farm Explorer without Hunt Intelligence evidence metadata', () => {
  assert.throws(() => normalizeKphInput({
    kind: 'measured', value: 80, progress_scope: 'qualifying_source_kills', time_base: 'active_hunt',
    trust_class: 'MEASURED', availability_state: 'AVAILABLE',
  }), /cohort|revision|sample|quality/i);
});

test('authoritative task requirements remain separate from editable estimator target', () => {
  const task = {
    task_id: 'task:kill', kind: 'kill', weekly: false,
    requirements: [{ kind: 'creature', target_id: `monster-entity:${'b'.repeat(32)}`, quantity: 100 }],
  };
  const initialized = initializeTaskEstimate(task);
  assert.equal(initialized.authoritative_requirement.quantity, 100);
  assert.equal(initialized.estimate_target, 100);
  initialized.estimate_target = 120;
  assert.equal(task.requirements[0].quantity, 100);
  assert.throws(() => initializeTaskEstimate({ ...task, requirements: [...task.requirements, { ...task.requirements[0], target_id: `monster-entity:${'c'.repeat(32)}` }] }), /multi|group|unsupported/i);
});

const bundle = () => ({
  schema_version: 1,
  product: 'atlas-farm-bundle-v1',
  source_game_revision: 'a'.repeat(40),
  source_farm_semantic_digest: `sha256:${'1'.repeat(64)}`,
  farm_intelligence_root: `sha256:${'2'.repeat(64)}`,
  farm_spatial_root: `sha256:${'3'.repeat(64)}`,
  creature_publication_digest: `sha256:${'4'.repeat(64)}`,
  compatibility: { coordinate_profile: 'oteryn-native-floor-v1' },
  counts: { farm: {}, spatial: {} },
  bundle_root: `sha256:${'5'.repeat(64)}`,
});

test('runtime bundle validation rejects mixed roots independently of Python compiler', () => {
  const value = bundle();
  assert.equal(validateFarmBundleManifest(value, {
    expectedFarmRoot: value.farm_intelligence_root,
    expectedSpatialRoot: value.farm_spatial_root,
    expectedCreatureDigest: value.creature_publication_digest,
    expectedBundleRoot: value.bundle_root,
  }).product, 'atlas-farm-bundle-v1');
  assert.throws(() => validateFarmBundleManifest(value, {
    expectedFarmRoot: `sha256:${'9'.repeat(64)}`,
    expectedSpatialRoot: value.farm_spatial_root,
    expectedCreatureDigest: value.creature_publication_digest,
    expectedBundleRoot: value.bundle_root,
  }), /farm.*root/i);
});

test('runtime bundle validation requires an independently pinned bundle root', () => {
  const value = bundle();
  assert.throws(() => validateFarmBundleManifest({ ...value, bundle_root: `sha256:${'9'.repeat(64)}` }, {
    expectedFarmRoot: value.farm_intelligence_root,
    expectedSpatialRoot: value.farm_spatial_root,
    expectedCreatureDigest: value.creature_publication_digest,
    expectedBundleRoot: value.bundle_root,
  }), /bundle.*root/i);
});

test('generated drops are not silently labelled personal acquisition', () => {
  const base = estimateItemTarget({ relation: itemRelation(fixed(rational(1, 2))), targetQuantity: 2 });
  assert.equal(base.personal_acquisition.state, 'UNAVAILABLE');
  const personal = estimateItemTarget({
    relation: itemRelation(fixed(rational(1, 2))),
    targetQuantity: 2,
    allocationModel: 'all_loot_to_me',
  });
  assert.equal(personal.personal_acquisition.state, 'AVAILABLE');
  assert.equal(personal.personal_acquisition.allocation_model, 'all_loot_to_me');
});

const COMPAT = Object.freeze({
  world_id: 'oteryn-main', world_profile_revision: 'profile-v1', content_revision: 'content-v1',
  ruleset_revision: 'rules-v1', modifier_context: 'base', creature_identity_scheme: 'monster-entity-v1',
  creature_identity_revision: 'export-v1', coordinate_profile: 'oteryn-native-floor-v1',
  creature_publication_digest: `sha256:${'4'.repeat(64)}`,
});
const farmIndex = () => ({
  schema_version: 1, product: 'atlas-farm-intelligence-v1',
  source: { authority: 'Oteryn/Oteryn-Game', contract_id: 'oteryn-game-atlas-farm-intelligence-v1', schema_version: 1, game_revision: 'a'.repeat(40), semantic_digest: `sha256:${'1'.repeat(64)}` },
  compatibility: { ...COMPAT }, capabilities: { items: 'SUPPORTED', loot_relations: 'SUPPORTED', loot_probability: 'SUPPORTED', loot_quantity_model: 'SUPPORTED', item_delivery_tasks: 'UNSUPPORTED', kill_tasks: 'UNSUPPORTED', weekly_task_semantics: 'UNSUPPORTED', respawn_cadence: 'UNSUPPORTED' },
  counts: { items: 1, creatures: 2, loot_relations: 2, tasks: 0 },
  item_search: { path: 'item-search.json', bytes: 10, digest: `sha256:${'6'.repeat(64)}` },
  creatures: { path: 'creatures.json', bytes: 10, digest: `sha256:${'7'.repeat(64)}` },
  tasks: { path: 'tasks.json', bytes: 10, digest: `sha256:${'8'.repeat(64)}` },
  item_shards: [{ item_id: 'item:alpha', path: 'items/alpha.json', bytes: 20, digest: `sha256:${'9'.repeat(64)}` }],
  product_root: `sha256:${'2'.repeat(64)}`,
});
const spatialIndex = () => ({
  schema_version: 1, product: 'atlas-farm-spatial-v1',
  source_creatures: { contract_id: 'oteryn-game-atlas-export-v1', capability: 'static-creatures-v1', semantic_digest: COMPAT.creature_publication_digest, coordinate_profile: COMPAT.coordinate_profile },
  farm_intelligence_root: `sha256:${'2'.repeat(64)}`,
  compatibility: { ...COMPAT },
  counts: { entities: 1, indexed_placements: 2, unjoinable_placements: 0 },
  entities: [{ entity_id: `monster-entity:${'a'.repeat(32)}`, records: 2, floors: [-7], path: 'entities/a.json', bytes: 20, digest: `sha256:${'a'.repeat(64)}` }],
  product_root: `sha256:${'3'.repeat(64)}`,
});

test('browser farm product validators require exact accepted source identity and compatible roots', () => {
  const farm = validateFarmIntelligenceIndex(farmIndex(), {
    acceptedContractId: 'oteryn-game-atlas-farm-intelligence-v1', acceptedGameRevision: 'a'.repeat(40),
    verifiedSemanticDigest: `sha256:${'1'.repeat(64)}`, expectedProductRoot: `sha256:${'2'.repeat(64)}`,
  });
  assert.equal(farm.product_root, `sha256:${'2'.repeat(64)}`);
  const spatial = validateFarmSpatialIndex(spatialIndex(), { expectedFarmRoot: farm.product_root, expectedCreatureDigest: COMPAT.creature_publication_digest, expectedProductRoot: `sha256:${'3'.repeat(64)}` });
  assert.equal(spatial.counts.indexed_placements, 2);
  assert.throws(() => validateFarmSpatialIndex({ ...spatialIndex(), compatibility: { ...COMPAT, ruleset_revision: 'other' } }, { expectedFarmRoot: `sha256:${'2'.repeat(64)}`, expectedCreatureDigest: COMPAT.creature_publication_digest, expectedProductRoot: `sha256:${'3'.repeat(64)}`, expectedCompatibility: COMPAT }), /compatib/i);
});
test('item/source lookup preserves separate source models and exact entity identity', () => {
  const A = `monster-entity:${'a'.repeat(32)}`;
  const B = `monster-entity:${'b'.repeat(32)}`;
  const detail = {
    schema_version: 1,
    item: { item_id: 'item:alpha', name: 'Alpha' },
    loot_relations: [
      { relation_id: 'rel:a', item_id: 'item:alpha', creature_id: A, probability_scope: 'published_base', process: fixed(rational(100)) },
      { relation_id: 'rel:b', item_id: 'item:alpha', creature_id: B, probability_scope: 'published_base', process: fixed(rational(300)) },
    ],
  };
  const item = findItemFarmRecord('item:alpha', detail);
  assert.equal(item.loot_relations.length, 2);
  assert.equal('average_drop_chance' in item, false);
  assert.deepEqual(item.loot_relations.map((r) => r.creature_id), [A, B]);
  assert.equal(findCreatureSpatialDescriptor(A, spatialIndex()).entity_id, A);
  assert.equal(findCreatureSpatialDescriptor(B, spatialIndex()), null);
});

test('readiness keeps missing upstream and owner seams explicit and independent', () => {
  const readiness = buildFarmReadiness({
    gameRevision: 'a'.repeat(40),
    farmIntelligence: { state: 'UPSTREAM_BLOCKED', reason: 'Game #75 has no accepted publication.' },
    farmSpatial: { state: 'AVAILABLE', reason: 'Static creature projection is accepted.' },
    interactionSeam: { state: 'UPSTREAM_BLOCKED', reason: 'Atlas #113 runtime is not merged.' },
    presentationSeam: { state: 'UPSTREAM_BLOCKED', reason: 'Atlas #115 runtime is not merged.' },
  });
  assert.equal(readiness.monsterDropSources.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.estimatorCore.state, 'AVAILABLE');
  assert.equal(readiness.nearCreatureInteraction.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.baseMap.state, 'AVAILABLE');
});
