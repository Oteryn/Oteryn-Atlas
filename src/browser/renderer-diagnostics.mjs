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

function copyFramebufferProbe(probe) {
  if (probe == null) return null;
  requireValue(Number.isSafeInteger(probe.sampleCount) && probe.sampleCount >= 1 && probe.sampleCount <= 512, 'framebuffer probe sample count invalid');
  requireValue(Number.isSafeInteger(probe.nonClearSamples) && probe.nonClearSamples >= 0 && probe.nonClearSamples <= probe.sampleCount, 'framebuffer probe non-clear count invalid');
  requireValue(typeof probe.blank === 'boolean' && probe.blank === (probe.nonClearSamples === 0), 'framebuffer probe blank state invalid');
  requireValue(typeof probe.signature === 'string' && /^[0-9a-f]{8}$/.test(probe.signature), 'framebuffer probe signature invalid');
  const recordIds = Object.freeze((probe.recordIds ?? []).slice(0, 24).map((value) => {
    requireValue(typeof value === 'string' && value.length > 0 && value.length <= 256, 'framebuffer probe record id invalid');
    return value;
  }));
  return Object.freeze({
    sampleCount: probe.sampleCount,
    nonClearSamples: probe.nonClearSamples,
    blank: probe.blank,
    signature: probe.signature,
    recordIds,
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
    framebufferProbe: copyFramebufferProbe(input.framebufferProbe),
    anchors,
  });
}
