import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FarmLodError,
  buildPlacementDensityCells,
  selectFarmLod,
  validateLodPolicy,
} from '../src/browser/farm-lod.mjs';

const policy = () => ({
  heatmap_below_zoom: 1.5,
  clusters_below_zoom: 4,
  max_spawn_placements: 200,
  max_cluster_placements: 20_000,
});

const placement = (id, x, y, floor, entity, origin = 'base-map') => ({
  record_id: `monster:${id}`,
  entity_id: entity,
  position: { x, y, floor },
  origin,
  default_placement_eligible: origin === 'base-map',
});

test('LOD policy requires monotonic zoom thresholds and positive structural caps', () => {
  assert.deepEqual(validateLodPolicy(policy()), policy());
  assert.throws(() => validateLodPolicy({ ...policy(), heatmap_below_zoom: 5 }), FarmLodError);
  assert.throws(() => validateLodPolicy({ ...policy(), max_spawn_placements: 0 }), FarmLodError);
});

test('AUTO LOD becomes no less detailed as zoom increases for a fixed sparse result set', () => {
  const modes = [0.5, 2, 5].map((zoom) => selectFarmLod({ viewOverride: 'auto', zoom, visiblePlacementCount: 20 }, policy()).mode);
  assert.deepEqual(modes, ['heatmap', 'clusters', 'spawns']);
});

test('near zoom still refuses unbounded spawn rendering and manual spawn override is bounded', () => {
  const automatic = selectFarmLod({ viewOverride: 'auto', zoom: 8, visiblePlacementCount: 500 }, policy());
  assert.equal(automatic.mode, 'clusters');
  assert.equal(automatic.reason_code, 'SPAWN_COUNT_BOUND');
  const manual = selectFarmLod({ viewOverride: 'spawns', zoom: 8, visiblePlacementCount: 500 }, policy());
  assert.equal(manual.mode, 'clusters');
  assert.equal(manual.reason_code, 'BOUNDED_OVERRIDE');
  assert.equal(selectFarmLod({ viewOverride: 'heatmap', zoom: 8, visiblePlacementCount: 500 }, policy()).mode, 'heatmap');
});

test('cluster cap fails closed instead of rendering an unbounded result set', () => {
  const result = selectFarmLod({ viewOverride: 'auto', zoom: 2, visiblePlacementCount: 25_000 }, policy());
  assert.equal(result.mode, 'heatmap');
  assert.equal(result.reason_code, 'CLUSTER_COUNT_BOUND');
});

const A = `monster-entity:${'a'.repeat(32)}`;
const B = `monster-entity:${'b'.repeat(32)}`;
const placements = [
  placement('1', 100, 200, -7, A),
  placement('2', 101, 201, -7, B),
  placement('3', 199, 200, -7, A, 'annual-event-map'),
  placement('4', 100, 200, -6, A),
];

test('placement-density cells are current-floor, default-origin, metric-labelled and deterministic', () => {
  const forward = buildPlacementDensityCells(placements, { floor: -7, cellWorldSize: 64 });
  const reverse = buildPlacementDensityCells([...placements].reverse(), { floor: -7, cellWorldSize: 64 });
  assert.deepEqual(forward, reverse);
  assert.equal(forward.metric_id, 'verified_placement_density');
  assert.equal(forward.unit, 'verified placements');
  assert.match(forward.legend, /current floor/i);
  assert.equal(forward.floor, -7);
  assert.equal(forward.total_placements, 2);
  assert.equal(forward.cells.reduce((sum, cell) => sum + cell.placement_count, 0), 2);
  assert.equal(forward.cells.reduce((sum, cell) => sum + cell.source_creature_count, 0), 2);
  assert.equal(JSON.stringify(forward).includes('yield'), false);
  assert.equal(JSON.stringify(forward).includes('capacity'), false);
});

test('non-default origins appear only through an explicit context choice', () => {
  const defaultOnly = buildPlacementDensityCells(placements, { floor: -7, cellWorldSize: 64 });
  const contextual = buildPlacementDensityCells(placements, { floor: -7, cellWorldSize: 64, includeNonDefault: true });
  assert.equal(defaultOnly.total_placements, 2);
  assert.equal(contextual.total_placements, 3);
});

test('floor is mandatory and cell work is structurally bounded', () => {
  assert.throws(() => buildPlacementDensityCells(placements, { cellWorldSize: 64 }), FarmLodError);
  assert.throws(() => buildPlacementDensityCells(placements, { floor: -7, cellWorldSize: 1, maxCells: 1 }), FarmLodError);
});
