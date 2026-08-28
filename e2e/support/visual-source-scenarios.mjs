import {
  DENSE_MONSTER_SCENE,
  MIXED_SCENE,
  OVERFLOW_NPC,
  QUALIFICATION_SEMANTIC_RECORD,
  qualificationEntry,
  sceneEntry,
} from './qualification-fixture-scenarios.mjs';

const ROOT_FIELDS = Object.freeze([
  'publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot',
  'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint', 'productDigest',
]);
const Q_IDENTITY = Object.freeze({
  marker: 'oteryn-atlas-qualification-trust-v1',
  fixtureId: 'atlas-qualification-world-v2',
  dataCapability: 'qualification_fixture',
});
const BOUNDED_IDENTITY = Object.freeze({
  marker: 'oteryn-atlas-bounded-real-trust-v1',
  fixtureId: 'atlas-bounded-real-world-v1',
  dataCapability: 'bounded_real_world',
});
const EXPECTED_FIELDS = Object.freeze([...Object.keys(Q_IDENTITY), ...ROOT_FIELDS].sort());

function parseVisualTrust(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    throw new TypeError('visual source selection requires an explicit trusted data capability');
  }
  let descriptor;
  try {
    descriptor = JSON.parse(raw);
  } catch (error) {
    throw new TypeError(`visual source selection trust is invalid JSON: ${error.message}`);
  }
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)
    || JSON.stringify(Object.keys(descriptor).sort()) !== JSON.stringify(EXPECTED_FIELDS)) {
    throw new TypeError('visual source selection trust descriptor fields mismatch');
  }
  for (const field of ROOT_FIELDS) {
    if (!/^sha256:[a-f0-9]{64}$/.test(descriptor[field] ?? '')) {
      throw new TypeError(`visual source selection trust ${field} is invalid`);
    }
  }
  const identity = Object.freeze({
    marker: descriptor.marker,
    fixtureId: descriptor.fixtureId,
    dataCapability: descriptor.dataCapability,
  });
  if (JSON.stringify(identity) === JSON.stringify(Q_IDENTITY) || JSON.stringify(identity) === JSON.stringify(BOUNDED_IDENTITY)) {
    return identity;
  }
  throw new TypeError('visual source selection trust identity mismatch');
}

function boundedEntry({ x, y, floor, zoom = 2, mode = 'map', creatures = null, animation = null, perf = null } = {}) {
  const params = new URLSearchParams({ x: String(x), y: String(y), floor: String(floor), zoom: String(zoom), mode });
  if (creatures) params.set('creatures', creatures);
  if (animation) params.set('animation', animation);
  if (perf) params.set('perf', perf);
  return `/web/fullworld.html?${params.toString()}`;
}

function qualificationVisualSource() {
  return Object.freeze({
    identity: Q_IDENTITY,
    desktop: Object.freeze({
      entry: sceneEntry(MIXED_SCENE, { animation: 'off' }),
      visualEntry: qualificationEntry(undefined, { animation: 'off' }),
      creatureOnlyPlaybackEntry: sceneEntry(DENSE_MONSTER_SCENE, { animation: 'off', creatures: 'monster' }),
      npcOnlyPlaybackEntry: qualificationEntry(OVERFLOW_NPC.position, { animation: 'off', creatures: 'npc' }),
      semantic: Object.freeze({ query: QUALIFICATION_SEMANTIC_RECORD.label, label: QUALIFICATION_SEMANTIC_RECORD.label }),
    }),
    mobile: Object.freeze({
      entry: qualificationEntry(undefined, { zoom: 0.25, mode: 'auto' }),
      monsterPlaybackEntry: sceneEntry(DENSE_MONSTER_SCENE, { animation: 'off', mode: 'minimap' }),
      semantic: Object.freeze({ query: QUALIFICATION_SEMANTIC_RECORD.label, label: QUALIFICATION_SEMANTIC_RECORD.label }),
    }),
  });
}

function boundedVisualSource() {
  return Object.freeze({
    identity: BOUNDED_IDENTITY,
    desktop: Object.freeze({
      entry: boundedEntry({ x: 32361, y: 32198, floor: -7, creatures: 'npc,monster', animation: 'off' }),
      visualEntry: boundedEntry({ x: 32369, y: 32241, floor: -7, animation: 'off' }),
      creatureOnlyPlaybackEntry: boundedEntry({ x: 32831, y: 32596, floor: -12, creatures: 'monster', animation: 'off' }),
      npcOnlyPlaybackEntry: boundedEntry({ x: 32209, y: 31924, floor: -12, creatures: 'npc', animation: 'off' }),
      semantic: Object.freeze({ query: 'Thais', label: 'Thais' }),
    }),
    mobile: Object.freeze({
      entry: boundedEntry({ x: 32369, y: 32241, floor: -7, zoom: 0.25, mode: 'auto' }),
      monsterPlaybackEntry: boundedEntry({ x: 32724, y: 31155, floor: -15, mode: 'minimap', perf: 'reference', creatures: 'npc,monster', animation: 'off' }),
      semantic: Object.freeze({ query: 'Thais', label: 'Thais' }),
    }),
  });
}

export function visualSourceScenarios(qualificationTrustJson) {
  const identity = parseVisualTrust(qualificationTrustJson);
  return identity.dataCapability === 'qualification_fixture' ? qualificationVisualSource() : boundedVisualSource();
}
