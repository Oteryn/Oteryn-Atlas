function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finite(value) {
  return Number.isFinite(value);
}

function copyDetail(detail) {
  const view = detail?.view;
  requireValue(detail && finite(detail.cssX) && finite(detail.cssY)
    && finite(detail.worldX) && finite(detail.worldY)
    && Number.isSafeInteger(detail.floor)
    && typeof detail.pointerType === 'string'
    && (detail.rendererGeneration == null || (Number.isSafeInteger(detail.rendererGeneration) && detail.rendererGeneration >= 1)),
  'map activation detail invalid');
  requireValue(view && finite(view.x) && finite(view.y) && Number.isSafeInteger(view.floor)
    && finite(view.zoom) && view.zoom > 0, 'map activation view invalid');
  return Object.freeze({
    cssX: detail.cssX,
    cssY: detail.cssY,
    worldX: detail.worldX,
    worldY: detail.worldY,
    floor: detail.floor,
    pointerType: detail.pointerType,
    rendererGeneration: detail.rendererGeneration ?? null,
    view: Object.freeze({ x: view.x, y: view.y, floor: view.floor, zoom: view.zoom }),
  });
}

export function dispatchMapActivation(target, detail) {
  requireValue(target && typeof target.dispatchEvent === 'function', 'map activation target invalid');
  const event = new CustomEvent('oteryn-atlas-map-activate', {
    cancelable: true,
    detail: copyDetail(detail),
  });
  return target.dispatchEvent(event) === false;
}
