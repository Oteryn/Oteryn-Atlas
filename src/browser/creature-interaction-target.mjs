import { computeCreaturePresentationGeometry } from './creature-presentation-geometry.mjs';

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finite(value) {
  return Number.isFinite(value);
}

function copyRect(rect) {
  requireValue(rect && finite(rect.x) && finite(rect.y)
    && finite(rect.width) && rect.width > 0
    && finite(rect.height) && rect.height > 0, 'creature interaction auxiliary rect invalid');
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function clipRect(rect, viewport) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(viewport.width, rect.x + rect.width);
  const y1 = Math.min(viewport.height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return Object.freeze({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
}

function assistRect(hitRects, viewport) {
  const x0 = Math.min(...hitRects.map((rect) => rect.x));
  const y0 = Math.min(...hitRects.map((rect) => rect.y));
  const x1 = Math.max(...hitRects.map((rect) => rect.x + rect.width));
  const y1 = Math.max(...hitRects.map((rect) => rect.y + rect.height));
  const width = Math.max(44, x1 - x0);
  const height = Math.max(44, y1 - y0);
  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;
  return clipRect({ x: centerX - width / 2, y: centerY - height / 2, width, height }, viewport);
}

function auxiliaryKey(rects) {
  return rects.map((rect) => `${rect.x},${rect.y},${rect.width},${rect.height}`).join(';');
}

export function createCreatureInteractionTarget(input = {}) {
  const { record, view, viewport, presentation } = input;
  requireValue(Number.isFinite(input.drawOrder), 'creature interaction draw order invalid');
  requireValue(Number.isSafeInteger(input.baseGeneration) && input.baseGeneration >= 1,
    'creature interaction base generation invalid');
  requireValue(Number.isSafeInteger(input.creatureGeneration) && input.creatureGeneration >= 1,
    'creature interaction creature generation invalid');
  const geometry = computeCreaturePresentationGeometry({ record, view, viewport, presentation });
  if (!geometry) return null;
  const extras = (input.auxiliaryRects ?? []).map(copyRect)
    .map((rect) => clipRect(rect, viewport)).filter(Boolean);
  const hitRects = Object.freeze([geometry.visibleRect, ...extras]);
  const assist = assistRect(hitRects, viewport);
  requireValue(assist, 'creature interaction assist rect invalid');
  const generationKey = `${input.baseGeneration}:${input.creatureGeneration}`;
  return Object.freeze({
    recordId: record.record_id,
    entityId: record.entity_id ?? null,
    kind: record.kind,
    floor: record.position.floor,
    worldAnchor: Object.freeze({
      x: record.position.x,
      y: record.position.y,
      floor: record.position.floor,
    }),
    baseGeneration: input.baseGeneration,
    creatureGeneration: input.creatureGeneration,
    generationKey,
    drawOrder: input.drawOrder,
    anchor: geometry.anchor,
    presentationRect: geometry.presentationRect,
    hitRects,
    assistRect: assist,
    geometryKey: `${geometry.geometryKey}|${auxiliaryKey(extras)}`,
    presentationKind: geometry.presentationKind,
  });
}
