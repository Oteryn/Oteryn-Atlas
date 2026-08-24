function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finite(value) {
  return Number.isFinite(value);
}

function frozenPoint(x, y) {
  return Object.freeze({ x, y });
}

function frozenRect(x, y, width, height) {
  return Object.freeze({ x, y, width, height });
}

function clipRect(rect, viewport) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(viewport.width, rect.x + rect.width);
  const y1 = Math.min(viewport.height, rect.y + rect.height);
  if (x1 <= x0 || y1 <= y0) return null;
  return frozenRect(x0, y0, x1 - x0, y1 - y0);
}

function validateInput(record, view, viewport) {
  requireValue(record?.position && typeof record.record_id === 'string', 'creature geometry record invalid');
  requireValue(Number.isSafeInteger(record.position.floor)
    && finite(record.position.x) && finite(record.position.y), 'creature geometry position invalid');
  requireValue(view && Number.isSafeInteger(view.floor)
    && finite(view.x) && finite(view.y) && finite(view.zoom) && view.zoom > 0,
  'creature geometry view invalid');
  requireValue(viewport && finite(viewport.width) && viewport.width > 0
    && finite(viewport.height) && viewport.height > 0, 'creature geometry viewport invalid');
}

function geometryKey(record, view, presentation) {
  const displacement = presentation.displacement ?? { x: 0, y: 0 };
  const dimensions = presentation.kind === 'pixel'
    ? `${presentation.bitmapWidth}x${presentation.bitmapHeight}`
    : `${presentation.width}x${presentation.height}`;
  return [
    record.record_id, record.position.x, record.position.y, record.position.floor,
    view.x, view.y, view.floor, view.zoom, presentation.kind, dimensions,
    Number(displacement.x ?? 0), Number(displacement.y ?? 0), presentation.originRounding ?? 'none',
  ].join('|');
}

export function computeCreaturePresentationGeometry(input) {
  const { record, view, viewport, presentation } = input ?? {};
  validateInput(record, view, viewport);
  requireValue(presentation && (presentation.kind === 'pixel' || presentation.kind === 'marker'),
    'creature presentation invalid');
  if (record.position.floor !== view.floor) return null;

  const scale = 32 * view.zoom;
  const anchorX = viewport.width / 2 + (record.position.x - view.x) * scale;
  const anchorY = viewport.height / 2 + (record.position.y - view.y) * scale;
  let rect;
  if (presentation.kind === 'pixel') {
    requireValue(finite(presentation.bitmapWidth) && presentation.bitmapWidth > 0
      && finite(presentation.bitmapHeight) && presentation.bitmapHeight > 0,
    'creature bitmap geometry invalid');
    const displacement = presentation.displacement ?? { x: 0, y: 0 };
    requireValue(finite(Number(displacement.x ?? 0)) && finite(Number(displacement.y ?? 0)),
      'creature displacement invalid');
    const x = anchorX - (presentation.bitmapWidth - 32 + Number(displacement.x ?? 0)) * view.zoom;
    const y = anchorY - (presentation.bitmapHeight - 32 + Number(displacement.y ?? 0)) * view.zoom;
    rect = frozenRect(x, y, presentation.bitmapWidth * view.zoom, presentation.bitmapHeight * view.zoom);
  } else {
    requireValue(finite(presentation.width) && presentation.width > 0
      && finite(presentation.height) && presentation.height > 0, 'creature marker geometry invalid');
    requireValue(presentation.originRounding == null || presentation.originRounding === 'nearest',
      'creature marker origin rounding invalid');
    let x = anchorX - presentation.width / 2;
    let y = anchorY - presentation.height / 2;
    if (presentation.originRounding === 'nearest') { x = Math.round(x); y = Math.round(y); }
    rect = frozenRect(x, y, presentation.width, presentation.height);
  }

  const visibleRect = clipRect(rect, viewport);
  if (!visibleRect) return null;
  return Object.freeze({
    anchor: frozenPoint(anchorX, anchorY),
    presentationRect: rect,
    visibleRect,
    presentationKind: presentation.kind,
    geometryKey: geometryKey(record, view, presentation),
  });
}
