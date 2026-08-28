export const QUALIFICATION_FIXTURE_ID = 'atlas-qualification-world-v2';
export const QUALIFICATION_SOURCE_CONTRACT = 'oteryn-atlas-qualification-fixture-v1';
export const QUALIFICATION_ACTIVE_FLOOR = -7;
export const QUALIFICATION_CENTER = Object.freeze({ x: 32280, y: 32155, floor: QUALIFICATION_ACTIVE_FLOOR });
export const QUALIFICATION_NAVIGATION_B_CENTER = Object.freeze({ x: 32312, y: 32155, floor: QUALIFICATION_ACTIVE_FLOOR });
export const QUALIFICATION_ADJACENT_FLOOR_CENTER = Object.freeze({ x: QUALIFICATION_CENTER.x, y: QUALIFICATION_CENTER.y, floor: QUALIFICATION_ACTIVE_FLOOR + 1 });
export const QUALIFICATION_OUTFIT_PRESENTATION_ID = `outfit-presentation:sha256:${'1'.repeat(64)}`;
export const QUALIFICATION_DEFAULT_NAVIGATION = Object.freeze({
  contract_id: 'oteryn-atlas-qualification-default-navigation-v1',
  record_id: 'semantic-record:qualification-harbor',
});

function npc(hex, name, dx, dy, roles = [], { animated = false } = {}) {
  const record = {
    kind: 'npc',
    name,
    record_id: `npc:${hex.repeat(32)}`,
    entity_id: `npc-entity:${hex.repeat(32)}`,
    position: Object.freeze({ x: QUALIFICATION_CENTER.x + dx, y: QUALIFICATION_CENTER.y + dy, floor: QUALIFICATION_ACTIVE_FLOOR }),
    resolution_state: 'RESOLVED',
    presentation_resolution_state: animated ? 'RESOLVED' : 'FALLBACK_MARKER',
    presentation_fallback: animated ? null : 'factual-marker',
    role_resolution_state: 'RESOLVED',
    roles: Object.freeze([...roles]),
  };
  if (animated) record.outfit_presentation = Object.freeze({ outfit_presentation_id: QUALIFICATION_OUTFIT_PRESENTATION_ID });
  return Object.freeze(record);
}
function monster(hex, name, dx, dy, { animated = false } = {}) {
  const record = {
    kind: 'monster',
    name,
    record_id: `monster:${hex.repeat(32)}`,
    entity_id: `monster-entity:${hex.repeat(32)}`,
    position: Object.freeze({ x: QUALIFICATION_CENTER.x + dx, y: QUALIFICATION_CENTER.y + dy, floor: QUALIFICATION_ACTIVE_FLOOR }),
    resolution_state: 'RESOLVED',
    presentation_resolution_state: animated ? 'RESOLVED' : 'FALLBACK_MARKER',
    presentation_fallback: animated ? null : 'factual-marker',
    spawn_area: Object.freeze({ center: Object.freeze({ x: QUALIFICATION_CENTER.x + dx, y: QUALIFICATION_CENTER.y + dy, floor: QUALIFICATION_ACTIVE_FLOOR }), radius: 1 }),
  };
  if (animated) record.outfit_presentation = Object.freeze({ outfit_presentation_id: QUALIFICATION_OUTFIT_PRESENTATION_ID });
  return Object.freeze(record);
}

export const QUALIFICATION_CREATURES = Object.freeze([
  npc('1', 'Fixture Guide', 0, 0, ['travel', 'shop', 'quest', 'blessing', 'trainer'], { animated: true }),
  npc('2', 'Fixture Two Role Steward', -2, 0, ['shop', 'quest']),
  npc('3', 'Fixture Long Navigation Custodian With A Deliberately Long Name', 7, 0, []),
  npc('4', 'Fixture Merchant North', -4, 2, ['shop']),
  npc('5', 'Fixture Merchant South', -3, -2, ['shop']),
  npc('6', 'Fixture Merchant East', -1, 2, ['shop']),
  npc('7', 'Fixture Merchant West', -5, -1, ['shop']),
  npc('8', 'Fixture Merchant Central', -2, 3, ['shop']),
  monster('a', 'Fixture Sentinel', 0, 3, { animated: true }),
  monster('b', 'Fixture Raider One', 3, 3),
  monster('c', 'Fixture Raider Two', 3, 3),
  monster('d', 'Fixture Raider Three', 3, 3),
  monster('e', 'Fixture Raider Four', -2, 3),
  monster('f', 'Fixture Raider Five', -1, 3),
  monster('7', 'Fixture Overlap One', 6, 1, { animated: true }),
  monster('8', 'Fixture Overlap Two', 6, 1),
  monster('9', 'Fixture Overlap Three', 6, 1),
]);

export const QUALIFICATION_SEMANTIC_RECORD = Object.freeze({
  kind: 'town',
  id: QUALIFICATION_DEFAULT_NAVIGATION.record_id,
  label: 'Fixture Harbor',
  aliases: Object.freeze(['Qualification Harbor']),
  capabilities: Object.freeze(['navigation', 'overlay-point']),
  position: QUALIFICATION_CENTER,
  bounds: null,
  provenance: Object.freeze({ authority: 'Oteryn/Oteryn-Atlas', source_capability: 'qualification-semantic-search-v1', fixture_id: QUALIFICATION_FIXTURE_ID }),
  search_terms: Object.freeze({ label: 'fixture harbor', aliases: Object.freeze(['qualification harbor']) }),
});

function landmark(index) {
  const suffix = String(index).padStart(2, '0');
  const dx = (index % 8) - 4;
  const dy = Math.floor(index / 8) - 4;
  const label = `Fixture Landmark ${suffix}`;
  return Object.freeze({
    kind: 'poi',
    id: `semantic-record:qualification-landmark-${suffix}`,
    label,
    aliases: Object.freeze([`Qualification Landmark ${suffix}`]),
    capabilities: Object.freeze(['navigation', 'overlay-point']),
    position: Object.freeze({ x: QUALIFICATION_CENTER.x + dx, y: QUALIFICATION_CENTER.y + dy, floor: QUALIFICATION_ACTIVE_FLOOR }),
    bounds: null,
    provenance: Object.freeze({ authority: 'Oteryn/Oteryn-Atlas', source_capability: 'qualification-semantic-search-v1', fixture_id: QUALIFICATION_FIXTURE_ID }),
    search_terms: Object.freeze({ label: label.toLowerCase(), aliases: Object.freeze([`qualification landmark ${suffix}`]) }),
  });
}

export const QUALIFICATION_SEMANTIC_RECORDS = Object.freeze([
  QUALIFICATION_SEMANTIC_RECORD,
  ...Array.from({ length: 64 }, (_, index) => landmark(index + 1)),
]);
