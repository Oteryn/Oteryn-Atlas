function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finite(value) {
  return Number.isFinite(value);
}

function copyRect(rect, label = 'rect') {
  requireValue(rect && finite(rect.x) && finite(rect.y)
    && finite(rect.width) && rect.width > 0
    && finite(rect.height) && rect.height > 0, `creature interaction ${label} invalid`);
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function copyPoint(point) {
  requireValue(point && finite(point.x) && finite(point.y), 'creature interaction anchor invalid');
  return Object.freeze({ x: point.x, y: point.y });
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function intersectRect(rect, width, height) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(width, rect.x + rect.width);
  const y1 = Math.min(height, rect.y + rect.height);
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

function copyTarget(target, generation) {
  requireValue(target && typeof target.recordId === 'string' && target.recordId.length > 0,
    'creature interaction target record invalid');
  requireValue(target.kind === 'npc' || target.kind === 'monster', 'creature interaction target kind invalid');
  requireValue(Number.isSafeInteger(target.floor), 'creature interaction target floor invalid');
  requireValue(target.generationKey === generation, 'creature interaction target generation mismatch');
  requireValue(Number.isFinite(target.drawOrder), 'creature interaction target draw order invalid');
  requireValue(typeof target.geometryKey === 'string' && target.geometryKey.length > 0,
    'creature interaction geometry key invalid');
  requireValue(Array.isArray(target.hitRects) && target.hitRects.length > 0,
    'creature interaction hit rects invalid');
  return Object.freeze({
    recordId: target.recordId,
    entityId: target.entityId ?? null,
    kind: target.kind,
    floor: target.floor,
    baseGeneration: target.baseGeneration ?? null,
    creatureGeneration: target.creatureGeneration ?? null,
    generationKey: target.generationKey,
    drawOrder: target.drawOrder,
    anchor: copyPoint(target.anchor),
    worldAnchor: Object.freeze({
      ...copyPoint(target.worldAnchor),
      floor: target.worldAnchor?.floor,
    }),
    presentationRect: copyRect(target.presentationRect, 'presentation rect'),
    hitRects: Object.freeze(target.hitRects.map((rect) => copyRect(rect, 'hit rect'))),
    assistRect: copyRect(target.assistRect, 'assist rect'),
    geometryKey: target.geometryKey,
  });
}

function bucketRange(rect, width, height, cellSize) {
  const clipped = intersectRect(rect, width, height);
  if (!clipped) return null;
  return {
    x0: Math.floor(clipped.x / cellSize),
    y0: Math.floor(clipped.y / cellSize),
    x1: Math.floor(Math.min(width - Number.EPSILON, clipped.x + clipped.width) / cellSize),
    y1: Math.floor(Math.min(height - Number.EPSILON, clipped.y + clipped.height) / cellSize),
  };
}

function addTargetToBuckets(buckets, targetIndex, rect, width, height, cellSize) {
  const range = bucketRange(rect, width, height, cellSize);
  if (!range) return;
  for (let y = range.y0; y <= range.y1; y += 1) {
    for (let x = range.x0; x <= range.x1; x += 1) {
      const key = `${x}:${y}`;
      let set = buckets.get(key);
      if (!set) { set = new Set(); buckets.set(key, set); }
      set.add(targetIndex);
    }
  }
}

export function buildCreatureInteractionIndex(targets, options = {}) {
  const { width, height, generation } = options;
  const cellSize = options.cellSize ?? 64;
  requireValue(Array.isArray(targets), 'creature interaction targets invalid');
  requireValue(finite(width) && width > 0 && finite(height) && height > 0,
    'creature interaction viewport invalid');
  requireValue(finite(cellSize) && cellSize > 0, 'creature interaction cell size invalid');
  requireValue(typeof generation === 'string' && generation.length > 0, 'creature interaction generation invalid');
  const copiedTargets = targets.map((target) => copyTarget(target, generation));
  const buckets = new Map();
  copiedTargets.forEach((target, targetIndex) => {
    for (const rect of target.hitRects) addTargetToBuckets(buckets, targetIndex, rect, width, height, cellSize);
    addTargetToBuckets(buckets, targetIndex, target.assistRect, width, height, cellSize);
  });
  return Object.freeze({
    width,
    height,
    cellSize,
    generation,
    targetCount: copiedTargets.length,
    bucketCount: buckets.size,
    _targets: Object.freeze(copiedTargets),
    _buckets: buckets,
  });
}

function distanceSquared(point, anchor) {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  return dx * dx + dy * dy;
}

function orderedHits(targets, point, hitKind) {
  return targets.map((target) => Object.freeze({
    ...target,
    hitKind,
    distanceSquared: distanceSquared(point, target.anchor),
  })).sort((left, right) => right.drawOrder - left.drawOrder
    || left.distanceSquared - right.distanceSquared
    || left.recordId.localeCompare(right.recordId));
}

export function queryCreatureHits(index, query = {}) {
  if (!index || query.generation !== index.generation) return [];
  const point = { x: query.x, y: query.y };
  if (!finite(point.x) || !finite(point.y)
      || point.x < 0 || point.y < 0 || point.x > index.width || point.y > index.height) return [];
  const bucketX = Math.min(Math.floor((index.width - Number.EPSILON) / index.cellSize), Math.floor(point.x / index.cellSize));
  const bucketY = Math.min(Math.floor((index.height - Number.EPSILON) / index.cellSize), Math.floor(point.y / index.cellSize));
  const indexes = index._buckets.get(`${bucketX}:${bucketY}`);
  if (!indexes?.size) return [];
  const candidates = [...indexes].map((targetIndex) => index._targets[targetIndex]);
  const direct = candidates.filter((target) => target.hitRects.some((rect) => pointInRect(point, rect)));
  if (direct.length) return orderedHits(direct, point, 'direct');
  if (query.pointerType !== 'touch') return [];
  const assisted = candidates.filter((target) => pointInRect(point, target.assistRect));
  return orderedHits(assisted, point, 'assist');
}

function rectOverlapArea(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return width * height;
}

function clampCard(x, y, card, viewport) {
  return {
    x: Math.max(0, Math.min(viewport.width - card.width, x)),
    y: Math.max(0, Math.min(viewport.height - card.height, y)),
    width: card.width,
    height: card.height,
  };
}

export function placeCreatureCard(anchorRect, cardSize, viewport, reservedRects = []) {
  const anchor = copyRect(anchorRect, 'card anchor rect');
  const card = copyRect({ x: 0, y: 0, width: cardSize?.width, height: cardSize?.height }, 'card size');
  requireValue(viewport && finite(viewport.width) && viewport.width >= card.width
    && finite(viewport.height) && viewport.height >= card.height, 'creature card viewport invalid');
  const reserved = reservedRects.map((rect) => copyRect(rect, 'reserved rect'));
  const gap = 8;
  const candidates = [
    clampCard(anchor.x + anchor.width + gap, anchor.y, card, viewport),
    clampCard(anchor.x - card.width - gap, anchor.y, card, viewport),
    clampCard(anchor.x, anchor.y + anchor.height + gap, card, viewport),
    clampCard(anchor.x, anchor.y - card.height - gap, card, viewport),
  ];
  let best = null;
  for (const candidate of candidates) {
    const reservedOverlap = reserved.reduce((sum, rect) => sum + rectOverlapArea(candidate, rect), 0);
    const anchorOverlap = rectOverlapArea(candidate, anchor);
    const score = reservedOverlap * 1_000_000 + anchorOverlap;
    if (!best || score < best.score) best = { candidate, score };
    if (score === 0) break;
  }
  return Object.freeze(best.candidate);
}

export function createClosedCreatureCardState() {
  return Object.freeze({ mode: 'closed', generation: null, recordId: null, choices: Object.freeze([]) });
}

function freezeCardState(mode, generation, recordId = null, choices = []) {
  return Object.freeze({
    mode,
    generation: generation ?? null,
    recordId: recordId ?? null,
    choices: Object.freeze([...choices]),
  });
}

export function reduceCreatureCardState(state, action = {}) {
  const current = state ?? createClosedCreatureCardState();
  if (action.type === 'close') return createClosedCreatureCardState();
  if (action.type === 'open-record') {
    requireValue(typeof action.generation === 'string' && action.generation.length > 0,
      'creature card generation invalid');
    requireValue(typeof action.recordId === 'string' && action.recordId.length > 0,
      'creature card record invalid');
    return freezeCardState('record', action.generation, action.recordId);
  }
  if (action.type === 'open-chooser') {
    requireValue(typeof action.generation === 'string' && action.generation.length > 0,
      'creature card generation invalid');
    requireValue(Array.isArray(action.choices) && action.choices.length > 1
      && action.choices.every((value) => typeof value === 'string' && value.length > 0),
    'creature card choices invalid');
    return freezeCardState('chooser', action.generation, null, action.choices);
  }
  if (action.type === 'suspend') {
    if (current.mode === 'closed') return current;
    if (current.mode === 'chooser') return createClosedCreatureCardState();
    return freezeCardState('suspended', action.generation ?? current.generation,
      current.recordId, current.choices);
  }
  if (action.type === 'invalidate-generation') {
    if (current.mode !== 'closed' && action.generation !== current.generation) {
      return createClosedCreatureCardState();
    }
    return current;
  }
  return current;
}
