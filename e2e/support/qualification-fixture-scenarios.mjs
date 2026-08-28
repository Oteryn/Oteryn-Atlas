import {
  QUALIFICATION_ADJACENT_FLOOR_CENTER,
  QUALIFICATION_CENTER,
  QUALIFICATION_CREATURES,
  QUALIFICATION_NAVIGATION_B_CENTER,
  QUALIFICATION_SEMANTIC_RECORD,
} from '../../tools/verification/qualification-fixture-definition.mjs';

export const QUALIFICATION_FIXTURE_CENTER = QUALIFICATION_CENTER;

function scenarioRecord(record) {
  const value = {
    kind: record.kind,
    label: record.name,
    record_id: record.record_id,
    entity_id: record.entity_id,
    position: record.position,
  };
  if (record.kind === 'npc') value.roles = record.roles;
  if (record.kind === 'monster') value.animated = Boolean(record.outfit_presentation);
  if (record.outfit_presentation) value.outfit_presentation_id = record.outfit_presentation.outfit_presentation_id;
  return Object.freeze(value);
}

const center = QUALIFICATION_FIXTURE_CENTER;
export const QUALIFICATION_FIXTURE_CREATURES = Object.freeze(QUALIFICATION_CREATURES.map(scenarioRecord));

function byLabel(label) {
  const found = QUALIFICATION_FIXTURE_CREATURES.find((value) => value.label === label);
  if (!found) throw new TypeError(`qualification fixture scenario record is missing: ${label}`);
  return found;
}

export const TWO_ROLE_NPC = byLabel('Fixture Two Role Steward');
export const OVERFLOW_NPC = byLabel('Fixture Guide');
export const LONG_NAME_NPC = byLabel('Fixture Long Navigation Custodian With A Deliberately Long Name');
export const OVERLAP_MONSTERS = Object.freeze([
  byLabel('Fixture Overlap One'),
  byLabel('Fixture Overlap Two'),
  byLabel('Fixture Overlap Three'),
]);
export const FARM_MONSTER = byLabel('Fixture Sentinel');

export const ANIMATED_MONSTER_SCENE = Object.freeze({
  center: FARM_MONSTER.position,
  record: FARM_MONSTER,
  description: 'protected qualification fixture monster with a two-phase presentation program',
});
export const NEARBY_NPC_SCENE = Object.freeze({
  center: Object.freeze({ x: center.x - 3, y: center.y, floor: center.floor }),
  recordIds: Object.freeze(['Fixture Merchant North', 'Fixture Merchant South', 'Fixture Merchant East', 'Fixture Merchant West', 'Fixture Merchant Central'].map((label) => byLabel(label).record_id)),
});
export const DENSE_MONSTER_SCENE = Object.freeze({
  center: Object.freeze({ x: center.x + 1, y: center.y + 3, floor: center.floor }),
  recordIds: Object.freeze(['Fixture Sentinel', 'Fixture Raider One', 'Fixture Raider Two', 'Fixture Raider Three', 'Fixture Raider Four'].map((label) => byLabel(label).record_id)),
});
export const MIXED_SCENE = Object.freeze({
  center: Object.freeze({ x: center.x + 2, y: center.y + 2, floor: center.floor }),
  npcRecordId: byLabel('Fixture Merchant East').record_id,
  monsterRecordIds: Object.freeze(['Fixture Raider One', 'Fixture Raider Two', 'Fixture Raider Three'].map((label) => byLabel(label).record_id)),
});
export const NAVIGATION_A = Object.freeze({ center, description: 'anchor authenticated range on the primary qualification region' });
export const NAVIGATION_B = Object.freeze({ center: QUALIFICATION_NAVIGATION_B_CENTER, description: 'independent authenticated range on the secondary qualification region' });
export const ADJACENT_FLOOR = Object.freeze({ center: QUALIFICATION_ADJACENT_FLOOR_CENTER, description: 'populated fixture floor adjacent to the primary qualification floor' });

export { QUALIFICATION_SEMANTIC_RECORD };

export const QUALIFICATION_TOPOLOGY_SCENARIOS = Object.freeze({
  defaultEntry: NAVIGATION_A.center,
  navigationA: NAVIGATION_A.center,
  navigationB: NAVIGATION_B.center,
  adjacentFloor: ADJACENT_FLOOR.center,
  creaturePresentation: MIXED_SCENE.center,
  animatedCreature: ANIMATED_MONSTER_SCENE.center,
  denseCreatures: DENSE_MONSTER_SCENE.center,
  overlapCreatures: OVERLAP_MONSTERS[0].position,
  semanticNavigation: QUALIFICATION_SEMANTIC_RECORD.position,
});

export function qualificationEntry(position = center, {
  zoom = 2, mode = 'map', creatures = null, animation = null, creature = null, npcRole = null,
} = {}) {
  const params = new URLSearchParams({ x: String(position.x), y: String(position.y), floor: String(position.floor), zoom: String(zoom), mode });
  if (creatures) params.set('creatures', creatures);
  if (animation) params.set('animation', animation);
  if (creature) params.set('creature', creature);
  if (npcRole) params.set('npcRole', npcRole);
  return `/web/fullworld.html?${params.toString()}`;
}

export function sceneEntry(scene, options = {}) {
  return qualificationEntry(scene.position ?? scene.center, { creatures: 'npc,monster', ...options });
}
