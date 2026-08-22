function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function requirePositive(value, label) {
  requireFinite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive`);
  return value;
}

export function viewportTransform(view, viewport) {
  if (!view || !viewport) throw new TypeError('view and viewport are required');
  if (!Number.isSafeInteger(view.floor)) throw new TypeError('view floor must be a safe integer');
  const width = requirePositive(viewport.width, 'viewport width');
  const height = requirePositive(viewport.height, 'viewport height');
  const dpr = requirePositive(viewport.dpr ?? 1, 'viewport dpr');
  const zoom = requirePositive(view.zoom, 'view zoom');
  const centerX = requireFinite(view.x, 'view x');
  const centerY = requireFinite(view.y, 'view y');
  return Object.freeze({
    floor: view.floor,
    centerX,
    centerY,
    centerWorldX: centerX * 32,
    centerWorldY: centerY * 32,
    zoom,
    width,
    height,
    dpr,
    framebufferWidth: Math.max(1, Math.round(width * dpr)),
    framebufferHeight: Math.max(1, Math.round(height * dpr)),
    cssPixelsPerTile: 32 * zoom,
    devicePixelsPerWorldUnit: zoom * dpr,
  });
}

export function worldTileToScreen(transform, point) {
  if (point?.floor != null && point.floor !== transform.floor) throw new RangeError('world point floor differs from active floor');
  const x = requireFinite(point?.x, 'world x');
  const y = requireFinite(point?.y, 'world y');
  return Object.freeze({
    x: transform.width / 2 + (x - transform.centerX) * transform.cssPixelsPerTile,
    y: transform.height / 2 + (y - transform.centerY) * transform.cssPixelsPerTile,
  });
}

export function screenToWorldTile(transform, point) {
  const x = requireFinite(point?.x, 'screen x');
  const y = requireFinite(point?.y, 'screen y');
  return Object.freeze({
    floor: transform.floor,
    x: transform.centerX + (x - transform.width / 2) / transform.cssPixelsPerTile,
    y: transform.centerY + (y - transform.height / 2) / transform.cssPixelsPerTile,
  });
}
