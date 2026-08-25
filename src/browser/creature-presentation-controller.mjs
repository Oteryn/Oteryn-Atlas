import {
  createCreatureLabelCandidates,
  createCreaturePresentationLayoutKey,
  creatureLayoutPriority,
  fitCreatureLabelText,
  solveCreaturePresentationLayout,
} from './creature-presentation-layout.mjs';
import { creaturePresentationLod } from './creature-presentation-lod.mjs';
import { NPC_BADGE_GRID, NPC_BADGE_STYLE, npcBadgePrimitive } from './npc-badge-primitives.mjs';
import { npcBadgeSlots } from './npc-markers.mjs';
import {
  presentationBackingStore,
  relativeVisibleRects,
  resolveCreatureEffectivePresentation,
} from './creature-presentation-runtime.mjs';

export const LABEL_STYLE = 'creature-labels-v1';
export const NPC_MARKER_STYLE = NPC_BADGE_STYLE;

const FONT = '600 12px Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const FONT_METRICS_KEY = 'creature-labels-v1:600:12:18:pad5';
const LABEL_HEIGHT = 18;
const LABEL_PAD_X = 5;
const BADGE_SIZE = 13;
const BADGE_GAP = 2;
const BADGE_OVERFLOW_WIDTH = 22;
const MAX_DIAGNOSTIC_SAMPLES = 24;
const RESERVED_SELECTORS = Object.freeze([
  '#runtime-badge',
  '#detail-badge',
  '#cursor-coordinate',
  '#creature-quick-card',
]);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function finiteRect(rect) {
  return rect && Number.isFinite(rect.x) && Number.isFinite(rect.y)
    && Number.isFinite(rect.width) && rect.width > 0
    && Number.isFinite(rect.height) && rect.height > 0;
}

function copyRect(rect) {
  requireValue(finiteRect(rect), 'creature presentation rectangle invalid');
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function presentationViewport(frame) {
  const rect = frame.getBoundingClientRect();
  requireValue(Number.isFinite(rect.width) && rect.width > 0
    && Number.isFinite(rect.height) && rect.height > 0,
  'creature presentation viewport invalid');
  return Object.freeze({ x: 0, y: 0, width: rect.width, height: rect.height });
}

function reservedRects(frame) {
  const frameRect = frame.getBoundingClientRect();
  const entries = RESERVED_SELECTORS.map((selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const style = getComputedStyle(node);
    return {
      id: selector,
      hidden: Boolean(node.hidden) || style.display === 'none' || style.visibility === 'hidden',
      rect: node.getBoundingClientRect(),
    };
  }).filter(Boolean);
  return relativeVisibleRects({ frameRect, entries });
}

function badgeSlotWidth(slot) {
  return slot.kind === 'overflow' ? BADGE_OVERFLOW_WIDTH : BADGE_SIZE;
}

function badgeClusterSize(slots) {
  const width = slots.reduce((total, slot) => total + badgeSlotWidth(slot), 0)
    + Math.max(0, slots.length - 1) * BADGE_GAP;
  return Object.freeze({ width, height: BADGE_SIZE });
}

function badgeCandidates(presentationRect, size) {
  const gap = 4;
  const right = presentationRect.x + presentationRect.width + gap;
  const left = presentationRect.x - gap - size.width;
  const top = presentationRect.y;
  const bottom = presentationRect.y + presentationRect.height - size.height;
  return Object.freeze([
    Object.freeze({ anchor: 'right-top', rect: Object.freeze({ x: right, y: top, ...size }) }),
    Object.freeze({ anchor: 'right-bottom', rect: Object.freeze({ x: right, y: bottom, ...size }) }),
    Object.freeze({ anchor: 'left-top', rect: Object.freeze({ x: left, y: top, ...size }) }),
    Object.freeze({ anchor: 'left-bottom', rect: Object.freeze({ x: left, y: bottom, ...size }) }),
  ]);
}

function drawBadgePrimitive(context, primitiveId, x, y) {
  const primitive = npcBadgePrimitive(primitiveId);
  const tones = {
    shadow: '#1a2533',
    primary: '#f1c75b',
    accent: '#fff2b2',
  };
  context.fillStyle = 'rgba(5, 10, 17, .94)';
  context.fillRect(x, y, BADGE_SIZE, BADGE_SIZE);
  context.strokeStyle = '#d7e5f2';
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, BADGE_SIZE - 1, BADGE_SIZE - 1);
  const offsetX = x + 2;
  const offsetY = y + 2;
  for (const rect of primitive.rects) {
    context.fillStyle = tones[rect.tone] ?? tones.primary;
    context.fillRect(
      offsetX + Math.min(NPC_BADGE_GRID.width - 1, rect.x),
      offsetY + Math.min(NPC_BADGE_GRID.height - 1, rect.y),
      rect.width,
      rect.height,
    );
  }
}

function drawOverflowBadge(context, hiddenCount, x, y) {
  context.fillStyle = 'rgba(5, 10, 17, .94)';
  context.fillRect(x, y, BADGE_OVERFLOW_WIDTH, BADGE_SIZE);
  context.strokeStyle = '#d7e5f2';
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, BADGE_OVERFLOW_WIDTH - 1, BADGE_SIZE - 1);
  context.fillStyle = '#fff2b2';
  context.font = '700 10px Inter, system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`+${hiddenCount}`, x + BADGE_OVERFLOW_WIDTH / 2, y + BADGE_SIZE / 2 + 0.5);
}

function drawBadgeSlots(context, slots, rect) {
  let x = rect.x;
  for (const slot of slots) {
    if (slot.kind === 'overflow') drawOverflowBadge(context, slot.hiddenCount, x, rect.y);
    else if (slot.kind === 'fallback') drawBadgePrimitive(context, 'other', x, rect.y);
    else drawBadgePrimitive(context, slot.role, x, rect.y);
    x += badgeSlotWidth(slot) + BADGE_GAP;
  }
}

function drawLabel(context, item, rect) {
  context.font = FONT;
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = 'rgba(5, 10, 17, .88)';
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
  context.strokeStyle = item.record.kind === 'npc' ? 'rgba(241, 199, 91, .92)' : 'rgba(239, 71, 111, .9)';
  context.lineWidth = 1;
  context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
  context.fillStyle = '#f8fafc';
  context.shadowColor = 'rgba(0, 0, 0, .8)';
  context.shadowBlur = 1;
  context.fillText(item.displayText, rect.x + LABEL_PAD_X, rect.y + LABEL_HEIGHT / 2 + 0.5);
  context.shadowBlur = 0;
}

function priorityName({ selected, hovered, record }) {
  if (selected) return 'selected';
  if (hovered) return 'hovered';
  return record.kind;
}

function stableSlotKey(slots) {
  return slots.map((slot) => {
    if (slot.kind === 'overflow') return `+${slot.hiddenCount}`;
    return `${slot.kind}:${slot.role ?? 'other'}`;
  }).join(',');
}

function recordLayoutKey(item) {
  return [
    item.record.name,
    item.policy.tier,
    item.policy.showLabel ? 'label' : 'no-label',
    item.policy.showPrimaryBadges ? 'badge' : 'no-badge',
    item.slots ? stableSlotKey(item.slots) : 'none',
  ].join('|');
}

function diagnosticSlots(slots) {
  return slots.map((slot) => {
    if (slot.kind === 'overflow') return Object.freeze({ kind: 'overflow', hiddenCount: slot.hiddenCount });
    if (slot.kind === 'fallback') return Object.freeze({ kind: 'fallback', role: 'other' });
    return Object.freeze({ kind: 'role', role: slot.role });
  });
}

function badgeSlotRects(slots, rect) {
  const rects = [];
  let x = rect.x;
  for (const slot of slots) {
    const width = badgeSlotWidth(slot);
    rects.push(Object.freeze({ x, y: rect.y, width, height: BADGE_SIZE }));
    x += width + BADGE_GAP;
  }
  return Object.freeze(rects);
}

function resolveLayoutEntries({ entries, view, effectivePresentation, selectedId, hoveredId, activeFilter }) {
  return Object.freeze(entries.map((entry) => {
    const selected = entry.record.record_id === selectedId;
    const hovered = entry.record.record_id === hoveredId;
    const policy = creaturePresentationLod({
      mode: view.mode,
      effectiveRepresentation: effectivePresentation.representation,
      zoom: view.zoom,
      overview: Boolean(view.overview),
      selected,
      hovered,
      kind: entry.record.kind,
    });
    let slots = null;
    if (entry.record.kind === 'npc' && policy.showPrimaryBadges) {
      const maxSlots = policy.showSecondaryBadges ? 3 : 1;
      slots = npcBadgeSlots(entry.record, activeFilter, maxSlots);
    }
    return Object.freeze({ ...entry, selected, hovered, policy, slots });
  }));
}

function buildLayout({ context, entries, viewport, reserved }) {
  context.font = FONT;
  const items = [];
  const resolved = [];
  for (const entry of entries) {
    const { selected, hovered, policy, slots } = entry;
    let label = null;
    if (policy.showLabel) {
      const fitted = fitCreatureLabelText({
        text: entry.record.name,
        maxWidth: policy.maxLabelWidth,
        measureText: (text) => context.measureText(text).width,
      });
      const labelSize = { width: fitted.width + LABEL_PAD_X * 2, height: LABEL_HEIGHT };
      label = Object.freeze({
        ...fitted,
        candidates: createCreatureLabelCandidates({ presentationRect: entry.target.presentationRect, labelSize }),
      });
      items.push({
        id: `label:${entry.record.record_id}`,
        priority: creatureLayoutPriority({ selected, hovered, kind: entry.record.kind }),
        candidates: label.candidates,
      });
    }
    let badges = null;
    if (slots) {
      const size = badgeClusterSize(slots);
      badges = badgeCandidates(entry.target.presentationRect, size);
      items.push({
        id: `badge:${entry.record.record_id}`,
        priority: creatureLayoutPriority({ selected, hovered, kind: 'npc', secondary: !selected && !hovered }),
        candidates: badges,
      });
    }
    resolved.push(Object.freeze({ ...entry, label, badges }));
  }
  const layout = solveCreaturePresentationLayout({
    viewport,
    reservedRects: reserved,
    items,
    tolerance: 0,
    cellSize: 64,
  });
  const placed = new Map(layout.placed.map((placement) => [placement.id, placement]));
  return Object.freeze({ entries: Object.freeze(resolved), placed, suppressed: layout.suppressed });
}

function makeLayoutKey({ entries, view, viewport, effectivePresentation, selectedId, hoveredId, activeFilter, reserved }) {
  return createCreaturePresentationLayoutKey({
    committedTransform: {
      x: view.x,
      y: view.y,
      floor: view.floor,
      zoom: view.zoom,
    },
    viewport,
    records: entries.map((entry) => ({
      recordId: entry.record.record_id,
      geometryKey: entry.target.geometryKey,
      layoutKey: recordLayoutKey(entry),
    })),
    filter: { npcRole: activeFilter, overview: Boolean(view.overview) },
    effectivePresentation,
    selectedId,
    hoveredId,
    reservedRects: reserved,
    fontMetricsKey: FONT_METRICS_KEY,
  });
}

function createEmptyDiagnostics() {
  return Object.freeze({
    labelStyle: LABEL_STYLE,
    npcMarkerStyle: NPC_MARKER_STYLE,
    labelsConsidered: 0,
    labelsDrawn: 0,
    labelsSuppressed: 0,
    drawnNpcBadges: 0,
    drawnNpcIcons: 0,
    effectivePresentation: null,
    labelLayoutGeneration: 0,
    labelLayoutKey: null,
    presentationRects: Object.freeze([]),
    labelLayouts: Object.freeze([]),
    badgeLayouts: Object.freeze([]),
  });
}

export function createCreaturePresentationController({ frame } = {}) {
  requireValue(frame instanceof HTMLElement, 'creature presentation frame invalid');
  const presentationCanvas = document.createElement('canvas');
  presentationCanvas.id = 'creature-presentation-overlay';
  presentationCanvas.setAttribute('aria-hidden', 'true');
  Object.assign(presentationCanvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '7',
  });
  frame.append(presentationCanvas);

  let layoutGeneration = 0;
  let layoutKey = null;
  let cachedLayout = null;
  let diagnostics = createEmptyDiagnostics();

  function commit({
    view,
    detailReady = false,
    effectivePresentation = null,
    targets = [],
    records = new Map(),
    selectedId = null,
    hoveredId = null,
    activeFilter = 'all',
  } = {}) {
    requireValue(view && typeof view === 'object', 'creature presentation committed view invalid');
    requireValue(Array.isArray(targets), 'creature presentation targets invalid');
    requireValue(records instanceof Map, 'creature presentation records invalid');
    const viewport = presentationViewport(frame);
    const backing = presentationBackingStore({
      width: viewport.width,
      height: viewport.height,
      dpr: globalThis.devicePixelRatio || 1,
    });
    if (presentationCanvas.width !== backing.width || presentationCanvas.height !== backing.height) {
      presentationCanvas.width = backing.width;
      presentationCanvas.height = backing.height;
    }
    const context = presentationCanvas.getContext('2d');
    requireValue(context, 'creature presentation 2d context unavailable');
    const resolvedEffectivePresentation = resolveCreatureEffectivePresentation({ view, effectivePresentation, detailReady });
    const reserved = reservedRects(frame);
    const entries = targets.map((target) => {
      const record = records.get(target.recordId);
      requireValue(record, `creature presentation record unavailable: ${target.recordId}`);
      return Object.freeze({ target, record });
    });

    const resolvedEntries = resolveLayoutEntries({
      entries, view, effectivePresentation: resolvedEffectivePresentation, selectedId, hoveredId, activeFilter,
    });
    const nextKey = makeLayoutKey({
      entries: resolvedEntries,
      view,
      viewport,
      effectivePresentation: resolvedEffectivePresentation,
      selectedId,
      hoveredId,
      activeFilter,
      reserved,
    });

    context.save();
    context.setTransform(backing.dpr, 0, 0, backing.dpr, 0, 0);
    if (nextKey !== layoutKey || !cachedLayout) {
      layoutKey = nextKey;
      cachedLayout = buildLayout({ context, entries: resolvedEntries, viewport, reserved });
      layoutGeneration += 1;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, backing.width, backing.height);
    context.setTransform(backing.dpr, 0, 0, backing.dpr, 0, 0);
    context.imageSmoothingEnabled = false;

    let labelsConsidered = 0;
    let labelsDrawn = 0;
    let labelsSuppressed = 0;
    let drawnNpcBadges = 0;
    let drawnNpcIcons = 0;
    const presentationRects = [];
    const labelLayouts = [];
    const badgeLayouts = [];
    const tiers = new Set();

    for (const item of cachedLayout.entries) {
      tiers.add(item.policy.tier);
      if (presentationRects.length < MAX_DIAGNOSTIC_SAMPLES) {
        presentationRects.push(Object.freeze({
          recordId: item.record.record_id,
          kind: item.record.kind,
          rect: copyRect(item.target.presentationRect),
        }));
      }
      if (item.label) {
        labelsConsidered += 1;
        const placement = cachedLayout.placed.get(`label:${item.record.record_id}`);
        if (placement) {
          drawLabel(context, item, placement.rect);
          labelsDrawn += 1;
        } else labelsSuppressed += 1;
        if (labelLayouts.length < MAX_DIAGNOSTIC_SAMPLES) {
          labelLayouts.push(Object.freeze({
            recordId: item.record.record_id,
            kind: item.record.kind,
            fullText: item.record.name,
            displayText: item.label.displayText,
            rect: placement ? copyRect(placement.rect) : null,
            suppressed: !placement,
            priority: priorityName(item),
          }));
        }
      }
      if (item.slots) {
        const placement = cachedLayout.placed.get(`badge:${item.record.record_id}`);
        if (placement) {
          drawBadgeSlots(context, item.slots, placement.rect);
          drawnNpcBadges += item.slots.length;
          drawnNpcIcons += 1;
          if (badgeLayouts.length < MAX_DIAGNOSTIC_SAMPLES && item.slots.every((slot) => slot.kind !== 'fallback')) {
            badgeLayouts.push(Object.freeze({
              recordId: item.record.record_id,
              slots: Object.freeze(diagnosticSlots(item.slots)),
              rects: badgeSlotRects(item.slots, placement.rect),
            }));
          }
        }
      }
    }
    context.restore();

    diagnostics = Object.freeze({
      labelStyle: LABEL_STYLE,
      npcMarkerStyle: NPC_MARKER_STYLE,
      labelsConsidered,
      labelsDrawn,
      labelsSuppressed,
      drawnNpcBadges,
      drawnNpcIcons,
      effectivePresentation: Object.freeze({
        requestedMode: resolvedEffectivePresentation.requestedMode,
        representation: resolvedEffectivePresentation.representation,
        lod: tiers.size ? [...tiers].sort().join('+') : 'empty',
      }),
      labelLayoutGeneration: layoutGeneration,
      labelLayoutKey: layoutKey,
      presentationRects: Object.freeze(presentationRects),
      labelLayouts: Object.freeze(labelLayouts),
      badgeLayouts: Object.freeze(badgeLayouts),
    });
    return diagnostics;
  }

  function snapshot() {
    return diagnostics;
  }

  function clear() {
    const context = presentationCanvas.getContext('2d');
    if (context) context.clearRect(0, 0, presentationCanvas.width, presentationCanvas.height);
    diagnostics = createEmptyDiagnostics();
  }

  return Object.freeze({ presentationCanvas, commit, snapshot, clear });
}
