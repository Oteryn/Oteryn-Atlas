export const FIXTURE_ATLAS_MAIN = 'f4826c0abd0a07a2539f7b7027bd779c453f431a';

function record(value) {
  return Object.freeze({
    ...value,
    position: Object.freeze({ ...value.position }),
    roles: Object.freeze([...(value.roles ?? [])]),
  });
}

export const TWO_ROLE_NPC = record({
  label: 'Albinius',
  kind: 'npc',
  record_id: 'npc:994e4a2decd5f718ccbc37c1d94bbbeb',
  position: { floor: -7, x: 32333, y: 32090 },
  roles: ['shop', 'quest'],
});
export const OVERFLOW_NPC = record({
  label: 'Eremo',
  kind: 'npc',
  record_id: 'npc:d6f7fbe1e22b73f3b04a708fd0a219a5',
  position: { floor: -7, x: 33327, y: 31882 },
  roles: ['travel', 'shop', 'quest', 'blessing', 'trainer'],
});

export const LONG_NAME_NPC = record({
  label: 'Gnomish Operative (Resonating)',
  kind: 'npc',
  record_id: 'npc:13130bd68b5ae4f89ed406ae14984f0b',
  position: { floor: -15, x: 33703, y: 32869 },
  roles: [],
});

export const NEARBY_NPC_SCENE = Object.freeze({
  center: Object.freeze({ floor: -7, x: 33910, y: 31514 }),
  recordIds: Object.freeze([
    'npc:ec45630602ceaacbe9b0cc05ae379924',
    'npc:7a3fbabdf399665634ba81f77aa84688',
    'npc:a40cbf37bb25e523a70210057402381b',
    'npc:da1a1533231fe6bbbd954cc8b553bf85',
    'npc:df0b31cb8d569cf3c8b1eff7a7e408ae',
  ]),
});

export const DENSE_MONSTER_SCENE = Object.freeze({
  center: Object.freeze({ floor: -15, x: 32058, y: 31922 }),
  recordIds: Object.freeze([
    'monster:e28f11745eefb1c8b091426b90983c3f',
    'monster:39f810cad3aaafd4fd78bd6271c49b2e',
    'monster:e9fa4ceb8cce56b28387517ea9811d81',
    'monster:ebd9bc5d08801b6ad2777d8b2cb6d09d',
    'monster:aaca0b415a44ea25cd27e11c87e22a9d',
  ]),
});

export const MIXED_SCENE = Object.freeze({
  center: Object.freeze({ floor: -15, x: 32753, y: 31381 }),
  npcRecordId: 'npc:2523c62f01b475ef58d8ef00fd53a2d7',
  monsterRecordIds: Object.freeze([
    'monster:4ee59c56ed394ad705714e7d8d5cd511',
    'monster:5311014ca1e6b600488b43e0a2c156b6',
    'monster:ade1bb68b921623a0db5b776cf54c237',
  ]),
});
export function sceneEntry(scene, { zoom = 2, mode = 'map', creatures = 'npc,monster', creature = null, npcRole = null } = {}) {
  const center = scene.position ?? scene.center;
  const params = new URLSearchParams({
    x: String(center.x),
    y: String(center.y),
    floor: String(center.floor),
    zoom: String(zoom),
    mode,
    creatures,
  });
  if (creature) params.set('creature', creature);
  if (npcRole) params.set('npcRole', npcRole);
  return `/web/fullworld.html?${params.toString()}`;
}
