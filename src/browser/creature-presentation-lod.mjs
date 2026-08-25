// Pure creature-presentation LOD policy. Runtime wiring belongs to the #115 integrator.

export const CREATURE_PRESENTATION_DETAIL_TIERS = Object.freeze({
  farUpperZoom: 1,
  mediumUpperZoom: 2,
  maxLabelWidth: Object.freeze({
    far: 112,
    medium: 136,
    close: 168,
    promoted: 184,
  }),
});

const VIEW_MODES = Object.freeze(['auto', 'minimap', 'classic', 'map']);
const EFFECTIVE_REPRESENTATIONS = Object.freeze([
  'minimap',
  'classic',
  'detail',
  'transition',
  'minimap-fallback',
]);
const CREATURE_KINDS = Object.freeze(['npc', 'monster']);

function assertInputs({ mode, effectiveRepresentation, zoom, kind }) {
  if (!VIEW_MODES.includes(mode)) throw new Error(`unsupported creature presentation mode: ${mode}`);
  if (!EFFECTIVE_REPRESENTATIONS.includes(effectiveRepresentation)) {
    throw new Error(`unsupported effective representation: ${effectiveRepresentation}`);
  }
  if (!Number.isFinite(zoom) || zoom <= 0) throw new Error('zoom must be finite and positive');
  if (!CREATURE_KINDS.includes(kind)) throw new Error(`unsupported creature kind: ${kind}`);
}

function makePolicy({ tier, showLabel, showPrimaryBadges, showSecondaryBadges, maxLabelWidth, priorityClass, promotion = null }) {
  return Object.freeze({
    tier,
    showLabel,
    showPrimaryBadges,
    showSecondaryBadges,
    maxLabelWidth,
    priorityClass,
    promotion,
  });
}

function sparsePolicy(kind) {
  const npc = kind === 'npc';
  return makePolicy({
    tier: 'sparse',
    showLabel: false,
    showPrimaryBadges: npc,
    showSecondaryBadges: false,
    maxLabelWidth: 0,
    priorityClass: kind,
  });
}

function hiddenPolicy(kind) {
  return makePolicy({
    tier: 'hidden', showLabel: false, showPrimaryBadges: false, showSecondaryBadges: false,
    maxLabelWidth: 0, priorityClass: kind,
  });
}

function detailTier(zoom) {
  if (zoom < CREATURE_PRESENTATION_DETAIL_TIERS.farUpperZoom) return 'far';
  if (zoom < CREATURE_PRESENTATION_DETAIL_TIERS.mediumUpperZoom) return 'medium';
  return 'close';
}

function detailPolicy(kind, zoom) {
  const tier = detailTier(zoom);
  const npc = kind === 'npc';
  const showLabel = tier !== 'far' || npc;
  return makePolicy({
    tier,
    showLabel,
    showPrimaryBadges: npc,
    showSecondaryBadges: npc && tier === 'close',
    maxLabelWidth: showLabel ? CREATURE_PRESENTATION_DETAIL_TIERS.maxLabelWidth[tier] : 0,
    priorityClass: kind,
  });
}

function promotedPolicy(kind, promotion) {
  const npc = kind === 'npc';
  return makePolicy({
    tier: 'promoted',
    showLabel: true,
    showPrimaryBadges: npc,
    showSecondaryBadges: npc,
    maxLabelWidth: CREATURE_PRESENTATION_DETAIL_TIERS.maxLabelWidth.promoted,
    priorityClass: promotion,
    promotion,
  });
}

export function creaturePresentationLod({
  mode,
  effectiveRepresentation,
  zoom,
  overview = false,
  selected = false,
  hovered = false,
  kind,
}) {
  assertInputs({ mode, effectiveRepresentation, zoom, kind });
  if (selected) return promotedPolicy(kind, 'selected');
  if (hovered) return promotedPolicy(kind, 'hovered');
  if (overview) return hiddenPolicy(kind);

  if (mode === 'minimap' || mode === 'classic') return sparsePolicy(kind);
  if (effectiveRepresentation === 'minimap'
      || effectiveRepresentation === 'classic'
      || effectiveRepresentation === 'minimap-fallback') {
    return sparsePolicy(kind);
  }
  return detailPolicy(kind, zoom);
}
