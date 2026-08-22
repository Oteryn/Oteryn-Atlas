export const LOD_POLICY = Object.freeze({
  detailZoom: 0.50,
  minimapZoom: 0.38,
  detailStreamEnterZoom: 0.42,
  detailStreamExitZoom: 0.34,
  minZoom: 0.125,
  maxZoom: 16,
});

export const VIEW_MODES = Object.freeze(['auto', 'minimap', 'classic', 'map']);

export function normalizeViewMode(value) {
  const mode = String(value ?? 'auto').toLowerCase();
  if (!VIEW_MODES.includes(mode)) throw new Error(`unsupported Atlas view mode: ${mode}`);
  return mode;
}

export function detailStreamWanted(zoom, previous = false, mode = 'auto') {
  mode = normalizeViewMode(mode);
  if (!Number.isFinite(zoom)) throw new Error('zoom must be finite');
  if (mode === 'minimap' || mode === 'classic') return false;
  if (mode === 'map') return zoom >= LOD_POLICY.minimapZoom;
  return previous ? zoom >= LOD_POLICY.detailStreamExitZoom : zoom >= LOD_POLICY.detailStreamEnterZoom;
}
export function lodBlend(zoom, mode = 'auto', detailReady = true) {
  mode = normalizeViewMode(mode);
  if (!Number.isFinite(zoom)) throw new Error('zoom must be finite');
  if (mode === 'minimap') return Object.freeze({ detail: 0, minimap: 1, representation: 'minimap' });
  if (mode === 'classic') return Object.freeze({ detail: 0, minimap: 1, representation: 'classic' });
  if (mode === 'map' && zoom >= LOD_POLICY.minimapZoom) {
    return Object.freeze({ detail: detailReady ? 1 : 0, minimap: detailReady ? 0 : 1, representation: detailReady ? 'detail' : 'minimap-fallback' });
  }
  if (zoom <= LOD_POLICY.minimapZoom) return Object.freeze({ detail: 0, minimap: 1, representation: 'minimap' });
  if (zoom >= LOD_POLICY.detailZoom) return Object.freeze({ detail: detailReady ? 1 : 0, minimap: detailReady ? 0 : 1, representation: detailReady ? 'detail' : 'minimap-fallback' });
  const weight = (zoom - LOD_POLICY.minimapZoom) / (LOD_POLICY.detailZoom - LOD_POLICY.minimapZoom);
  const detail = detailReady ? Math.max(0, Math.min(1, weight)) : 0;
  return Object.freeze({ detail, minimap: 1 - detail, representation: detail > 0 ? 'transition' : 'minimap-fallback' });
}

export function screenToWorld(view, point, viewport) {
  const scale = 32 * view.zoom;
  return Object.freeze({
    x: view.x + (point.x - viewport.width / 2) / scale,
    y: view.y + (point.y - viewport.height / 2) / scale,
    floor: view.floor,
  });
}

export function worldToScreen(view, world, viewport) {
  if (world.floor !== view.floor) throw new Error('world point floor differs from view floor');
  const scale = 32 * view.zoom;
  return Object.freeze({ x: viewport.width / 2 + (world.x - view.x) * scale, y: viewport.height / 2 + (world.y - view.y) * scale });
}
