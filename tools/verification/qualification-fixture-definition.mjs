export const QUALIFICATION_FIXTURE_ID = 'atlas-qualification-world-v2';
export const QUALIFICATION_SOURCE_CONTRACT = 'oteryn-atlas-qualification-fixture-v1';
export const QUALIFICATION_ACTIVE_FLOOR = -7;
export const QUALIFICATION_CENTER = Object.freeze({ x: 32280, y: 32155, floor: QUALIFICATION_ACTIVE_FLOOR });

function npc(hex, name, dx, dy, roles = []) {
  return Object.freeze({
    kind: 'npc',
    name,
    record_id: `npc:${hex.repeat(32)}`,
    entity_id: `npc-entity:${hex.repeat(32)}`,
    position: Object.freeze({ x: QUALIFICATION_CENTER.x + dx, y: QUALIFICATION_CENTER.y + dy, floor: QUALIFICATION_ACTIVE_FLOOR }),
    resolution_state: 'RESOLVED',
    presentation_resolution_state: 'FALLBACK_MARKER',
    presentation_fallback: 'factual-marker',
    role_resolution_state: 'RESOLVED',
    roles: Object.freeze([...roles]),
  });
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
  if (animated) record.outfit_presentation = Object.freeze({ outfit_presentation_id: 'outfit-presentation:qualification-sentinel' });
  return Object.freeze(record);
}

export const QUALIFICATION_CREATURES = Object.freeze([
  npc('1', 'Fixture Guide', 0, 0, ['shop', 'quest']),
  npc('2', 'Fixture Wayfarer', 2, 0, ['travel', 'shop', 'quest', 'blessing', 'trainer']),
  npc('3', 'Fixture Cartographer With A Deliberately Long Name', 4, 0, []),
  npc('4', 'Fixture Merchant North', -2, 1, ['shop']),
  npc('5', 'Fixture Merchant South', -1, -1, ['shop']),
  npc('6', 'Fixture Merchant East', 1, 1, ['shop']),
  monster('a', 'Fixture Sentinel', 0, 3, { animated: true }),
  monster('b', 'Fixture Raider One', 3, 3),
  monster('c', 'Fixture Raider Two', 3, 3),
  monster('d', 'Fixture Raider Three', 3, 3),
  monster('e', 'Fixture Raider Four', -2, 3),
  monster('f', 'Fixture Raider Five', -1, 3),
]);

export const QUALIFICATION_SEMANTIC_RECORD = Object.freeze({
  kind: 'town',
  id: 'semantic-record:qualification-harbor',
  label: 'Fixture Harbor',
  aliases: Object.freeze(['Qualification Harbor']),
  capabilities: Object.freeze(['navigation', 'overlay-point']),
  position: QUALIFICATION_CENTER,
  bounds: null,
  provenance: Object.freeze({ authority: 'Oteryn/Oteryn-Atlas', source_capability: 'qualification-semantic-search-v1', fixture_id: QUALIFICATION_FIXTURE_ID }),
  search_terms: Object.freeze({ label: 'fixture harbor', aliases: Object.freeze(['qualification harbor']) }),
});
