import { computeCreaturePresentationGeometry } from './creature-presentation-geometry.mjs';

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finite(value) {
  return Number.isFinite(value);
}

function frozenRect(rect, label = 'rectangle') {
  requireValue(rect && finite(rect.x) && finite(rect.y)
    && finite(rect.width) && rect.width > 0
    && finite(rect.height) && rect.height > 0, `${label} invalid`);
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function frozenSize(size, label = 'size') {
  requireValue(size && finite(size.width) && size.width >= 0
    && finite(size.height) && size.height >= 0, `${label} invalid`);
  return Object.freeze({ width: size.width, height: size.height });
}

export const CREATURE_PRESENTATION_PRIORITY = Object.freeze({
  selected: 500,
  hovered: 400,
  npcLabel: 300,
  monsterLabel: 200,
  secondaryBadge: 100,
});
export function creaturePresentationBounds(input) {
  return computeCreaturePresentationGeometry(input);
}

function measuredWidth(measureText, text) {
  const measured = measureText(text);
  const width = typeof measured === 'number' ? measured : measured?.width;
  requireValue(finite(width) && width >= 0, 'text measure width invalid');
  return width;
}

export function fitCreatureLabelText(input) {
  const { text, maxWidth, measureText } = input ?? {};
  requireValue(typeof text === 'string', 'creature label text invalid');
  requireValue(finite(maxWidth) && maxWidth >= 0, 'creature label max width invalid');
  requireValue(typeof measureText === 'function', 'creature label measure oracle invalid');
  const fullWidth = measuredWidth(measureText, text);
  if (fullWidth <= maxWidth) {
    return Object.freeze({ sourceText: text, displayText: text, width: fullWidth, truncated: false });
  }
  const ellipsis = '…';
  const ellipsisWidth = measuredWidth(measureText, ellipsis);
  if (ellipsisWidth > maxWidth) {
    return Object.freeze({ sourceText: text, displayText: '', width: 0, truncated: true });
  }
  const glyphs = Array.from(text);
  for (let count = glyphs.length - 1; count >= 0; count -= 1) {
    const displayText = `${glyphs.slice(0, count).join('')}${ellipsis}`;
    const width = measuredWidth(measureText, displayText);
    if (width <= maxWidth) {
      return Object.freeze({ sourceText: text, displayText, width, truncated: true });
    }
  }
  return Object.freeze({ sourceText: text, displayText: '', width: 0, truncated: true });
}
export function createCreatureLabelCandidates(input) {
  const { presentationRect, labelSize, gap = 4 } = input ?? {};
  const bounds = frozenRect(presentationRect, 'creature presentation bounds');
  const size = frozenSize(labelSize, 'creature label size');
  requireValue(finite(gap) && gap >= 0, 'creature label gap invalid');
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const raw = [
    ['above-center', centerX - size.width / 2, bounds.y - gap - size.height],
    ['right-center', bounds.x + bounds.width + gap, centerY - size.height / 2],
    ['left-center', bounds.x - gap - size.width, centerY - size.height / 2],
    ['below-center', centerX - size.width / 2, bounds.y + bounds.height + gap],
  ];
  return Object.freeze(raw.map(([anchor, x, y]) => Object.freeze({
    anchor,
    rect: Object.freeze({ x, y, width: size.width, height: size.height }),
  })));
}

export function creatureLayoutPriority(input = {}) {
  const { selected = false, hovered = false, kind, secondary = false } = input;
  requireValue(kind === 'npc' || kind === 'monster', 'creature layout kind invalid');
  if (selected) return CREATURE_PRESENTATION_PRIORITY.selected;
  if (hovered) return CREATURE_PRESENTATION_PRIORITY.hovered;
  if (secondary) return CREATURE_PRESENTATION_PRIORITY.secondaryBadge;
  return kind === 'npc'
    ? CREATURE_PRESENTATION_PRIORITY.npcLabel
    : CREATURE_PRESENTATION_PRIORITY.monsterLabel;
}

function rectsOverlap(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}
function viewportRect(viewport) {
  requireValue(viewport && finite(viewport.width) && viewport.width > 0
    && finite(viewport.height) && viewport.height > 0, 'creature layout viewport invalid');
  const x = viewport.x ?? 0;
  const y = viewport.y ?? 0;
  requireValue(finite(x) && finite(y), 'creature layout viewport origin invalid');
  return Object.freeze({ x, y, width: viewport.width, height: viewport.height });
}

function insideViewport(rect, viewport, tolerance) {
  return rect.x >= viewport.x - tolerance
    && rect.y >= viewport.y - tolerance
    && rect.x + rect.width <= viewport.x + viewport.width + tolerance
    && rect.y + rect.height <= viewport.y + viewport.height + tolerance;
}

function cellBounds(rect, cellSize) {
  const epsilon = 1e-9;
  return {
    x0: Math.floor(rect.x / cellSize),
    x1: Math.floor((rect.x + rect.width - epsilon) / cellSize),
    y0: Math.floor(rect.y / cellSize),
    y1: Math.floor((rect.y + rect.height - epsilon) / cellSize),
  };
}

function cellKey(x, y) {
  return `${x}:${y}`;
}

class RectIndex {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  add(rect) {
    const range = cellBounds(rect, this.cellSize);
    for (let x = range.x0; x <= range.x1; x += 1) {
      for (let y = range.y0; y <= range.y1; y += 1) {
        const key = cellKey(x, y);
        const bucket = this.cells.get(key) ?? [];
        bucket.push(rect);
        this.cells.set(key, bucket);
      }
    }
  }

  intersects(rect) {
    const range = cellBounds(rect, this.cellSize);
    const seen = new Set();
    for (let x = range.x0; x <= range.x1; x += 1) {
      for (let y = range.y0; y <= range.y1; y += 1) {
        const bucket = this.cells.get(cellKey(x, y));
        if (!bucket) continue;
        for (const other of bucket) {
          if (seen.has(other)) continue;
          seen.add(other);
          if (rectsOverlap(rect, other)) return true;
        }
      }
    }
    return false;
  }
}

function candidateRect(candidate) {
  return frozenRect(candidate?.rect ?? candidate, 'creature layout candidate rectangle');
}

export function solveCreaturePresentationLayout(input) {
  const viewport = viewportRect(input?.viewport);
  const tolerance = input?.tolerance ?? 0;
  const cellSize = input?.cellSize ?? 64;
  requireValue(finite(tolerance) && tolerance >= 0, 'creature layout tolerance invalid');
  requireValue(finite(cellSize) && cellSize > 0, 'creature layout cell size invalid');
  requireValue(Array.isArray(input?.reservedRects ?? []), 'creature reserved rectangles invalid');
  requireValue(Array.isArray(input?.items ?? []), 'creature layout items invalid');
  const occupied = new RectIndex(cellSize);
  for (const rect of input?.reservedRects ?? []) occupied.add(frozenRect(rect, 'creature reserved rectangle'));
  const ordered = (input?.items ?? []).map((entry, index) => {
    requireValue(entry && typeof entry.id === 'string' && entry.id.length > 0,
      'creature layout item id invalid');
    requireValue(finite(entry.priority), 'creature layout item priority invalid');
    requireValue(Array.isArray(entry.candidates) && entry.candidates.length > 0,
      'creature layout candidates invalid');
    return { entry, index };
  }).sort((left, right) => right.entry.priority - left.entry.priority || left.index - right.index);

  const placed = [];
  const suppressed = [];
  for (const { entry } of ordered) {
    let placement = null;
    for (let candidateIndex = 0; candidateIndex < entry.candidates.length; candidateIndex += 1) {
      const candidate = entry.candidates[candidateIndex];
      const rect = candidateRect(candidate);
      if (!insideViewport(rect, viewport, tolerance) || occupied.intersects(rect)) continue;
      placement = Object.freeze({
        id: entry.id,
        priority: entry.priority,
        candidateIndex,
        anchor: typeof candidate?.anchor === 'string' ? candidate.anchor : null,
        rect,
      });
      occupied.add(rect);
      break;
    }
    if (placement) placed.push(placement);
    else suppressed.push(Object.freeze({ id: entry.id, priority: entry.priority }));
  }

  return Object.freeze({
    placed: Object.freeze(placed),
    suppressed: Object.freeze(suppressed),
  });
}

function stableValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    requireValue(finite(value), 'layout key contains non-finite number');
    return value;
  }
  if (Array.isArray(value)) return value.map(stableValue);
  requireValue(value && typeof value === 'object', 'layout key contains unsupported value');
  const result = {};
  for (const key of Object.keys(value).sort()) {
    requireValue(value[key] !== undefined, 'layout key contains undefined value');
    result[key] = stableValue(value[key]);
  }
  return result;
}
function layoutTransform(transform) {
  requireValue(transform && typeof transform === 'object', 'committed creature transform invalid');
  const x = transform.centerTileX ?? transform.x;
  const y = transform.centerTileY ?? transform.y;
  requireValue(finite(x) && finite(y) && Number.isSafeInteger(transform.floor)
    && finite(transform.zoom) && transform.zoom > 0, 'committed creature transform invalid');
  return Object.freeze({ x, y, floor: transform.floor, zoom: transform.zoom });
}

function layoutViewport(viewport) {
  const rect = viewportRect(viewport);
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function layoutRecord(record) {
  const recordId = record?.recordId ?? record?.record_id;
  requireValue(typeof recordId === 'string' && recordId.length > 0, 'layout record id invalid');
  requireValue(typeof record?.geometryKey === 'string' && record.geometryKey.length > 0,
    'layout record geometry key invalid');
  const layoutKey = record.layoutKey ?? null;
  requireValue(layoutKey == null || typeof layoutKey === 'string', 'layout record presentation key invalid');
  return Object.freeze({ recordId, geometryKey: record.geometryKey, layoutKey });
}

function nullableId(value, label) {
  requireValue(value == null || (typeof value === 'string' && value.length > 0), `${label} invalid`);
  return value ?? null;
}
export function createCreaturePresentationLayoutKey(input) {
  requireValue(input && typeof input === 'object', 'creature layout key input invalid');
  requireValue(Array.isArray(input.records), 'creature layout key records invalid');
  requireValue(Array.isArray(input.reservedRects ?? []), 'creature layout key reserved rectangles invalid');
  requireValue(typeof input.fontMetricsKey === 'string' && input.fontMetricsKey.length > 0,
    'creature layout font metrics key invalid');
  const payload = {
    version: 'creature-presentation-layout-v1',
    transform: layoutTransform(input.committedTransform),
    viewport: layoutViewport(input.viewport),
    records: input.records.map(layoutRecord),
    filter: stableValue(input.filter ?? null),
    effectivePresentation: stableValue(input.effectivePresentation ?? null),
    selectedId: nullableId(input.selectedId, 'selected creature id'),
    hoveredId: nullableId(input.hoveredId, 'hovered creature id'),
    reservedRects: (input.reservedRects ?? []).map((rect) => frozenRect(rect, 'layout key reserved rectangle')),
    fontMetricsKey: input.fontMetricsKey,
  };
  return `creature-presentation-layout-v1:${JSON.stringify(stableValue(payload))}`;
}
