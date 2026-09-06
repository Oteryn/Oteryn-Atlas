function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

export function projectWithCommittedRenderer(transform, point) {
  if (!transform || !point) throw new TypeError('renderer transform and world point are required');
  if (point.floor !== transform.floor) throw new RangeError('world anchor floor differs from renderer floor');
  const dpr = finite(transform.dpr, 'renderer dpr');
  const scale = finite(transform.scaleDevicePixelsPerWorldUnit, 'renderer scale');
  const framebufferWidth = finite(transform.framebufferWidth, 'framebuffer width');
  const framebufferHeight = finite(transform.framebufferHeight, 'framebuffer height');
  const centerWorldX = finite(transform.centerTileX, 'renderer center x') * 32;
  const centerWorldY = finite(transform.centerTileY, 'renderer center y') * 32;
  const worldX = finite(point.x, 'world x') * 32;
  const worldY = finite(point.y, 'world y') * 32;
  return Object.freeze({
    x: framebufferWidth / (2 * dpr) + (worldX - centerWorldX) * scale / dpr,
    y: framebufferHeight / (2 * dpr) + (worldY - centerWorldY) * scale / dpr,
  });
}

function sameView(transform, view, tolerance = 1e-9) {
  return transform.floor === view.floor
    && Math.abs(transform.centerTileX - view.x) <= tolerance
    && Math.abs(transform.centerTileY - view.y) <= tolerance
    && Math.abs(transform.zoom - view.zoom) <= tolerance;
}

export function compareCreatureAnchors(renderer, creature) {
  if (!renderer?.transform || !creature?.view) throw new TypeError('renderer and creature snapshots are required');
  const synchronizedGeneration = renderer.generation === creature.baseGenerationAtStart
    && renderer.generation === creature.baseGenerationAtCommit
    && sameView(renderer.transform, creature.view);
  const samples = Object.freeze((creature.anchors ?? []).map((anchor) => {
    const expected = projectWithCommittedRenderer(renderer.transform, anchor);
    const dx = anchor.screenX - expected.x;
    const dy = anchor.screenY - expected.y;
    return Object.freeze({ id: anchor.id, kind: anchor.kind, dx, dy, driftPx: Math.hypot(dx, dy), expected, actual: Object.freeze({ x: anchor.screenX, y: anchor.screenY }) });
  }));
  const maxDriftPx = samples.reduce((maximum, sample) => Math.max(maximum, sample.driftPx), 0);
  return Object.freeze({
    synchronizedGeneration,
    maxDriftPx,
    samples,
    assertWithin(tolerancePx) {
      if (!synchronizedGeneration) throw new Error(`creature/base render generation or view mismatch: base=${renderer.generation} start=${creature.baseGenerationAtStart} commit=${creature.baseGenerationAtCommit}`);
      if (samples.length === 0) throw new Error('creature geometry comparison has no factual rendered anchors');
      if (maxDriftPx > tolerancePx) throw new Error(`creature overlay drift ${maxDriftPx.toFixed(4)}px exceeds ${tolerancePx}px`);
    },
  });
}


export function analyzeGeometryEventLog(log, tolerancePx = 0.25) {
  if (!Array.isArray(log)) throw new TypeError('geometry event log must be an array');
  if (!Number.isFinite(tolerancePx) || tolerancePx < 0 || tolerancePx > 2) throw new RangeError('geometry tolerance invalid');
  const baseByGeneration = new Map(log.filter((entry) => entry?.kind === 'base').map((entry) => [entry.value?.generation, entry.value]));
  const mismatches = [];
  let checked = 0;
  for (const entry of log.filter((item) => item?.kind === 'creature' && item.value?.anchors?.length)) {
    const creature = entry.value;
    const base = baseByGeneration.get(creature.baseGenerationAtCommit);
    if (!base) {
      mismatches.push(Object.freeze({ creatureGeneration: creature.generation, error: `missing base generation ${creature.baseGenerationAtCommit}` }));
      continue;
    }
    checked += 1;
    const result = compareCreatureAnchors(base, creature);
    try {
      result.assertWithin(tolerancePx);
    } catch (error) {
      mismatches.push(Object.freeze({ creatureGeneration: creature.generation, baseGeneration: base.generation, error: error.message, maxDriftPx: result.maxDriftPx, sample: result.samples[0] ?? null }));
    }
  }
  return Object.freeze({ checked, mismatches: Object.freeze(mismatches), tolerancePx });
}
