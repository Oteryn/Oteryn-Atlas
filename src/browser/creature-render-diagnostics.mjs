const MAX_SAMPLES = 24;

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function validGeneration(value) {
  return value == null || (Number.isSafeInteger(value) && value >= 1);
}

function nonNegativeInteger(value, label) {
  requireValue(Number.isSafeInteger(value) && value >= 0, `${label} invalid`);
  return value;
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

function copyRect(rect, label) {
  requireValue(rect && Number.isFinite(rect.x) && Number.isFinite(rect.y)
    && Number.isFinite(rect.width) && rect.width > 0
    && Number.isFinite(rect.height) && rect.height > 0,
  `${label} invalid`);
  return Object.freeze({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
}

function copyPresentationRect(entry) {
  requireValue(entry && typeof entry.recordId === 'string' && entry.recordId.length > 0
    && (entry.kind === 'npc' || entry.kind === 'monster'),
  'creature presentation sample invalid');
  return Object.freeze({
    recordId: entry.recordId,
    kind: entry.kind,
    rect: copyRect(entry.rect, 'creature presentation rectangle'),
  });
}

function copyLabelLayout(entry) {
  requireValue(entry && typeof entry.recordId === 'string' && entry.recordId.length > 0
    && (entry.kind === 'npc' || entry.kind === 'monster')
    && typeof entry.fullText === 'string' && typeof entry.displayText === 'string'
    && typeof entry.suppressed === 'boolean'
    && typeof entry.priority === 'string' && entry.priority.length > 0,
  'creature label layout sample invalid');
  requireValue(entry.suppressed || entry.rect != null, 'visible creature label requires rectangle');
  return Object.freeze({
    recordId: entry.recordId,
    kind: entry.kind,
    fullText: entry.fullText,
    displayText: entry.displayText,
    rect: entry.rect == null ? null : copyRect(entry.rect, 'creature label rectangle'),
    suppressed: entry.suppressed,
    priority: entry.priority,
  });
}

function copyBadgeSlot(slot) {
  requireValue(slot && (slot.kind === 'role' || slot.kind === 'overflow'), 'creature badge slot invalid');
  if (slot.kind === 'overflow') {
    requireValue(Number.isSafeInteger(slot.hiddenCount) && slot.hiddenCount > 0, 'creature badge overflow invalid');
    return Object.freeze({ kind: 'overflow', hiddenCount: slot.hiddenCount });
  }
  requireValue(typeof slot.role === 'string' && slot.role.length > 0, 'creature badge role invalid');
  return Object.freeze({ kind: 'role', role: slot.role });
}

function copyBadgeLayout(entry) {
  requireValue(entry && typeof entry.recordId === 'string' && entry.recordId.length > 0
    && Array.isArray(entry.slots) && Array.isArray(entry.rects)
    && entry.slots.length === entry.rects.length,
  'creature badge layout sample invalid');
  return Object.freeze({
    recordId: entry.recordId,
    slots: Object.freeze(entry.slots.map(copyBadgeSlot)),
    rects: Object.freeze(entry.rects.map((rect) => copyRect(rect, 'creature badge rectangle'))),
  });
}

function copyEffectivePresentation(value) {
  if (value == null) return null;
  requireValue(typeof value.requestedMode === 'string' && value.requestedMode.length > 0
    && typeof value.representation === 'string' && value.representation.length > 0
    && typeof value.lod === 'string' && value.lod.length > 0,
  'effective creature presentation invalid');
  return Object.freeze({
    requestedMode: value.requestedMode,
    representation: value.representation,
    lod: value.lod,
  });
}

function optionalStyle(value, label) {
  requireValue(value == null || (typeof value === 'string' && value.length > 0), `${label} invalid`);
  return value ?? null;
}

export function createCreatureRenderSnapshot(input) {
  requireValue(Number.isSafeInteger(input?.generation) && input.generation >= 1, 'creature render generation invalid');
  requireValue(validGeneration(input.baseGenerationAtStart), 'base generation at start invalid');
  requireValue(validGeneration(input.baseGenerationAtCommit), 'base generation at commit invalid');
  requireValue(input.labelLayoutGeneration == null
    || (Number.isSafeInteger(input.labelLayoutGeneration) && input.labelLayoutGeneration >= 0),
  'creature label layout generation invalid');
  requireValue(input.labelLayoutKey == null
    || (typeof input.labelLayoutKey === 'string' && input.labelLayoutKey.length > 0),
  'creature label layout key invalid');
  const labelsConsidered = nonNegativeInteger(input.labelsConsidered ?? 0, 'labels considered');
  const labelsDrawn = nonNegativeInteger(input.labelsDrawn ?? 0, 'labels drawn');
  const labelsSuppressed = nonNegativeInteger(input.labelsSuppressed ?? 0, 'labels suppressed');
  requireValue(labelsDrawn + labelsSuppressed === labelsConsidered, 'creature label count invariant invalid');
  return Object.freeze({
    generation: input.generation,
    baseGenerationAtStart: input.baseGenerationAtStart ?? null,
    baseGenerationAtCommit: input.baseGenerationAtCommit ?? null,
    view: copyView(input.view),
    canvas: copyCanvas(input.canvas),
    anchors: Object.freeze((input.anchors ?? []).slice(0, MAX_SAMPLES).map(copyAnchor)),
    labelStyle: optionalStyle(input.labelStyle, 'creature label style'),
    npcMarkerStyle: optionalStyle(input.npcMarkerStyle, 'NPC marker style'),
    labelsConsidered,
    labelsDrawn,
    labelsSuppressed,
    drawnNpcBadges: nonNegativeInteger(input.drawnNpcBadges ?? 0, 'drawn NPC badges'),
    drawnNpcIcons: nonNegativeInteger(input.drawnNpcIcons ?? 0, 'drawn NPC icons'),
    effectivePresentation: copyEffectivePresentation(input.effectivePresentation),
    labelLayoutGeneration: input.labelLayoutGeneration ?? 0,
    labelLayoutKey: input.labelLayoutKey ?? null,
    presentationRects: Object.freeze((input.presentationRects ?? []).slice(0, MAX_SAMPLES).map(copyPresentationRect)),
    labelLayouts: Object.freeze((input.labelLayouts ?? []).slice(0, MAX_SAMPLES).map(copyLabelLayout)),
    badgeLayouts: Object.freeze((input.badgeLayouts ?? []).slice(0, MAX_SAMPLES).map(copyBadgeLayout)),
  });
}
