const MAX_ANCHORS = 24;

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function validGeneration(value) {
  return value == null || (Number.isSafeInteger(value) && value >= 1);
}

function copyView(view) {
  requireValue(view && Number.isFinite(view.x) && Number.isFinite(view.y)
    && Number.isSafeInteger(view.floor) && Number.isFinite(view.zoom) && view.zoom > 0,
  'creature render view invalid');
  return Object.freeze({ x: view.x, y: view.y, floor: view.floor, zoom: view.zoom });
}

function copyCanvas(canvas) {
  requireValue(canvas && Number.isFinite(canvas.width) && canvas.width > 0
    && Number.isFinite(canvas.height) && canvas.height > 0
    && Number.isFinite(canvas.dpr) && canvas.dpr > 0,
  'creature render canvas invalid');
  return Object.freeze({ width: canvas.width, height: canvas.height, dpr: canvas.dpr });
}

function copyAnchor(anchor) {
  requireValue(anchor && typeof anchor.id === 'string' && anchor.id.length > 0
    && (anchor.kind === 'npc' || anchor.kind === 'monster')
    && Number.isSafeInteger(anchor.floor)
    && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
    && Number.isFinite(anchor.screenX) && Number.isFinite(anchor.screenY),
  'creature render anchor invalid');
  return Object.freeze({
    id: anchor.id, kind: anchor.kind, floor: anchor.floor,
    x: anchor.x, y: anchor.y, screenX: anchor.screenX, screenY: anchor.screenY,
  });
}

export function createCreatureRenderSnapshot(input) {
  requireValue(Number.isSafeInteger(input?.generation) && input.generation >= 1, 'creature render generation invalid');
  requireValue(validGeneration(input.baseGenerationAtStart), 'base generation at start invalid');
  requireValue(validGeneration(input.baseGenerationAtCommit), 'base generation at commit invalid');
  return Object.freeze({
    generation: input.generation,
    baseGenerationAtStart: input.baseGenerationAtStart ?? null,
    baseGenerationAtCommit: input.baseGenerationAtCommit ?? null,
    view: copyView(input.view),
    canvas: copyCanvas(input.canvas),
    anchors: Object.freeze((input.anchors ?? []).slice(0, MAX_ANCHORS).map(copyAnchor)),
  });
}
