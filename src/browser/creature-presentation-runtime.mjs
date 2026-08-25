import { lodBlend, normalizeViewMode } from '../layers/minimap-lod.mjs';

const EFFECTIVE_REPRESENTATIONS = new Set([
  'minimap',
  'classic',
  'detail',
  'transition',
  'minimap-fallback',
]);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function copyEffectivePresentation(value, mode) {
  requireValue(value && typeof value === 'object', 'effective presentation invalid');
  const requestedMode = normalizeViewMode(value.requestedMode);
  requireValue(requestedMode === mode, 'effective presentation mode mismatch');
  requireValue(EFFECTIVE_REPRESENTATIONS.has(value.representation), 'effective presentation representation invalid');
  requireValue(typeof value.detailReady === 'boolean', 'effective presentation detail readiness invalid');
  return Object.freeze({
    requestedMode,
    representation: value.representation,
    detailReady: value.detailReady,
  });
}

export function resolveCreatureEffectivePresentation({
  view,
  effectivePresentation = null,
  detailReady = false,
} = {}) {
  requireValue(view && typeof view === 'object', 'creature presentation view invalid');
  const mode = normalizeViewMode(view.mode);
  requireValue(positiveFinite(view.zoom), 'creature presentation zoom invalid');
  if (effectivePresentation != null) return copyEffectivePresentation(effectivePresentation, mode);
  requireValue(typeof detailReady === 'boolean', 'creature presentation detail readiness invalid');
  const blend = lodBlend(view.zoom, mode, detailReady);
  return Object.freeze({
    requestedMode: mode,
    representation: blend.representation,
    detailReady,
  });
}

export function presentationBackingStore({ width, height, dpr } = {}) {
  requireValue(positiveFinite(width) && positiveFinite(height) && positiveFinite(dpr), 'presentation backing store invalid');
  const boundedDpr = Math.max(1, Math.min(2, dpr));
  return Object.freeze({
    cssWidth: width,
    cssHeight: height,
    dpr: boundedDpr,
    width: Math.max(1, Math.round(width * boundedDpr)),
    height: Math.max(1, Math.round(height * boundedDpr)),
  });
}

function validFrameRect(rect) {
  return rect
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && positiveFinite(rect.width)
    && positiveFinite(rect.height);
}

function validNodeRect(rect) {
  return rect
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && positiveFinite(rect.width)
    && positiveFinite(rect.height);
}

export function relativeVisibleRects({ frameRect, entries } = {}) {
  requireValue(validFrameRect(frameRect), 'presentation frame rectangle invalid');
  requireValue(Array.isArray(entries), 'presentation rectangle entries invalid');
  const output = [];
  for (const entry of entries) {
    if (!entry || entry.hidden || !validNodeRect(entry.rect)) continue;
    output.push(Object.freeze({
      x: entry.rect.left - frameRect.left,
      y: entry.rect.top - frameRect.top,
      width: entry.rect.width,
      height: entry.rect.height,
    }));
  }
  return Object.freeze(output);
}
