const VIEW_MODES = new Set(['auto', 'heatmap', 'clusters', 'spawns']);
const MAX_CELLS = 50_000;
const MAX_PLACEMENTS = 200_000;

export class FarmLodError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new FarmLodError(message);
}

export function validateLodPolicy(policy) {
  requireValue(policy && typeof policy === 'object' && !Array.isArray(policy), 'LOD policy must be an object');
  const heat = policy.heatmap_below_zoom;
  const cluster = policy.clusters_below_zoom;
  requireValue(Number.isFinite(heat) && Number.isFinite(cluster) && heat >= 0 && cluster > heat, 'LOD zoom thresholds must be monotonic');
  for (const key of ['max_spawn_placements', 'max_cluster_placements']) {
    requireValue(Number.isSafeInteger(policy[key]) && policy[key] > 0 && policy[key] <= MAX_PLACEMENTS, `${key} invalid`);
  }
  requireValue(policy.max_spawn_placements <= policy.max_cluster_placements, 'spawn cap must not exceed cluster cap');
  return policy;
}
export function selectFarmLod(input, policy) {
  const p = validateLodPolicy(policy);
  requireValue(input && typeof input === 'object', 'LOD input invalid');
  const view = input.viewOverride;
  requireValue(VIEW_MODES.has(view), 'farm view override unsupported');
  requireValue(Number.isFinite(input.zoom) && input.zoom >= 0, 'farm zoom invalid');
  const count = input.visiblePlacementCount;
  requireValue(Number.isSafeInteger(count) && count >= 0 && count <= MAX_PLACEMENTS, 'visible placement count invalid');

  if (view === 'heatmap') return Object.freeze({ mode: 'heatmap', reason_code: 'MANUAL_OVERRIDE' });
  if (view === 'clusters') {
    if (count > p.max_cluster_placements) return Object.freeze({ mode: 'heatmap', reason_code: 'BOUNDED_OVERRIDE' });
    return Object.freeze({ mode: 'clusters', reason_code: 'MANUAL_OVERRIDE' });
  }
  if (view === 'spawns') {
    if (count > p.max_spawn_placements) return Object.freeze({ mode: 'clusters', reason_code: 'BOUNDED_OVERRIDE' });
    return Object.freeze({ mode: 'spawns', reason_code: 'MANUAL_OVERRIDE' });
  }

  if (count > p.max_cluster_placements) return Object.freeze({ mode: 'heatmap', reason_code: 'CLUSTER_COUNT_BOUND' });
  if (input.zoom < p.heatmap_below_zoom) return Object.freeze({ mode: 'heatmap', reason_code: 'ZOOM_HEATMAP' });
  if (input.zoom < p.clusters_below_zoom) return Object.freeze({ mode: 'clusters', reason_code: 'ZOOM_CLUSTERS' });
  if (count > p.max_spawn_placements) return Object.freeze({ mode: 'clusters', reason_code: 'SPAWN_COUNT_BOUND' });
  return Object.freeze({ mode: 'spawns', reason_code: 'ZOOM_SPAWNS' });
}

export function buildPlacementDensityCells(placements, options) {
  requireValue(Array.isArray(placements) && placements.length <= MAX_PLACEMENTS, 'placement input exceeds bound');
  requireValue(options && typeof options === 'object', 'density options invalid');
  requireValue(Number.isInteger(options.floor), 'current floor is required');
  requireValue(Number.isSafeInteger(options.cellWorldSize) && options.cellWorldSize > 0, 'cell size invalid');
  const maxCells = options.maxCells ?? MAX_CELLS;
  requireValue(Number.isSafeInteger(maxCells) && maxCells > 0 && maxCells <= MAX_CELLS, 'cell cap invalid');
  const includeNonDefault = options.includeNonDefault === true;
  const cells = new Map();
  let total = 0;
  for (const placement of placements) {
    requireValue(placement && typeof placement === 'object', 'placement invalid');
    const pos = placement.position;
    requireValue(pos && Number.isInteger(pos.x) && Number.isInteger(pos.y) && Number.isInteger(pos.floor), 'placement position invalid');
    if (pos.floor !== options.floor) continue;
    if (!includeNonDefault && placement.default_placement_eligible !== true) continue;
    const cx = Math.floor(pos.x / options.cellWorldSize);
    const cy = Math.floor(pos.y / options.cellWorldSize);
    const key = `${cx}:${cy}`;
    let cell = cells.get(key);
    if (!cell) {
      requireValue(cells.size < maxCells, 'placement-density cell cap exceeded');
      cell = { cell_x: cx, cell_y: cy, placement_count: 0, source_creatures: new Set() };
      cells.set(key, cell);
    }
    cell.placement_count += 1;
    cell.source_creatures.add(String(placement.entity_id));
    total += 1;
  }

  const normalized = [...cells.values()]
    .sort((a, b) => a.cell_y - b.cell_y || a.cell_x - b.cell_x)
    .map((cell) => Object.freeze({
      cell_x: cell.cell_x,
      cell_y: cell.cell_y,
      placement_count: cell.placement_count,
      source_creature_count: cell.source_creatures.size,
    }));
  return Object.freeze({
    metric_id: 'verified_placement_density',
    unit: 'verified placements',
    legend: 'Verified placement density on the current floor',
    floor: options.floor,
    total_placements: total,
    cells: Object.freeze(normalized),
  });
}
