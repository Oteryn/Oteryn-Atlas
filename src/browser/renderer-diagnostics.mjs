const MAX_ANCHORS = 24;

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finite(value) {
  return Number.isFinite(value);
}

function copyTransform(value) {
  requireValue(value && typeof value === 'object', 'renderer transform missing');
  const requiredFinite = [
    'centerTileX', 'centerTileY', 'zoom', 'dpr', 'framebufferWidth',
    'framebufferHeight', 'cssViewportWidth', 'cssViewportHeight',
    'scaleDevicePixelsPerWorldUnit',
  ];
  requireValue(Number.isSafeInteger(value.floor), 'renderer transform floor invalid');
  requireValue(requiredFinite.every((key) => finite(value[key])), 'renderer transform contains invalid numeric evidence');
  return Object.freeze({
    floor: value.floor,
    centerTileX: value.centerTileX,
    centerTileY: value.centerTileY,
    zoom: value.zoom,
    dpr: value.dpr,
    framebufferWidth: value.framebufferWidth,
    framebufferHeight: value.framebufferHeight,
    cssViewportWidth: value.cssViewportWidth,
    cssViewportHeight: value.cssViewportHeight,
    scaleDevicePixelsPerWorldUnit: value.scaleDevicePixelsPerWorldUnit,
  });
}

function copyAnchor(anchor) {
  requireValue(anchor && typeof anchor.id === 'string' && anchor.id.length > 0, 'renderer anchor identity invalid');
  requireValue(Number.isSafeInteger(anchor.floor) && finite(anchor.x) && finite(anchor.y), 'renderer anchor coordinates invalid');
  return Object.freeze({ id: anchor.id, floor: anchor.floor, x: anchor.x, y: anchor.y });
}

export function createRendererDiagnosticSnapshot(input) {
  requireValue(Number.isSafeInteger(input?.generation) && input.generation >= 1, 'renderer generation invalid');
  const anchors = Object.freeze((input.anchors ?? []).slice(0, MAX_ANCHORS).map(copyAnchor));
  return Object.freeze({
    generation: input.generation,
    transform: copyTransform(input.transform),
    backend: input.backend ?? null,
    drawCalls: input.drawCalls ?? null,
    visiblePrimitives: input.visiblePrimitives ?? null,
    retainedPrimitives: input.retainedPrimitives ?? null,
    visibleChunks: input.visibleChunks ?? null,
    retainedChunks: input.retainedChunks ?? null,
    visibleGroups: input.visibleGroups ?? null,
    retainedGroups: input.retainedGroups ?? null,
    renderMs: input.renderMs ?? null,
    gpuRenderMs: input.gpuRenderMs ?? null,
    anchors,
  });
}
