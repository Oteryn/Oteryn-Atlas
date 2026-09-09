import { createHash } from 'node:crypto';

const LIMITS = Object.freeze({
  max_manifest_bytes: 262144,
  max_shard_bytes: 524288,
  max_profiles_per_shard: 32,
  max_npc_profiles: 2048,
  max_monster_profiles: 4096,
  max_referenced_items: 4096,
  max_shards: 513,
  max_shop_sells_per_profile: 256,
  max_shop_buys_per_profile: 2048,
  max_shop_rows_per_profile: 2304,
  max_loot_rows_per_profile: 128,
  max_travel_destinations_per_profile: 16,
  max_resistance_elements_per_profile: 16,
  max_immunities_per_profile: 16,
  max_string_bytes: 256,
  max_nesting_depth: 12,
  max_price: 100000000,
  max_loot_count: 1024,
  max_abs_resistance_percent: 2048,
});

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]));
  return value;
}

function bytes(value) {
  return Buffer.from(JSON.stringify(sortCanonical(value)));
}

function digest(value) {
  const data = Buffer.isBuffer(value) ? value : bytes(value);
  return `sha256:${createHash('sha256').update(data).digest('hex')}`;
}

function trade(itemName, unitPrice) {
  return { item_ref: null, item_name: itemName, item_resolution_state: 'UNKNOWN', unit_price: unitPrice, currency: 'gold' };
}

function npc(entityHex, name, shop, services = ['shop'], travel = []) {
  return {
    entity_id: `npc-entity:${entityHex.repeat(32)}`,
    kind: 'npc',
    name,
    shop,
    services: { state: 'COMPLETE', values: services },
    travel: { state: 'COMPLETE', destinations: travel, reason_codes: [] },
  };
}

function profiles() {
  return [
    npc('1', 'Fixture Guide', {
      state: 'COMPLETE',
      sells: [trade('Fixture Rope', 50), trade('Fixture Torch', 8)],
      buys: [trade('Fixture Parcel', 3)],
      reason_codes: [],
    }, ['shop', 'quest']),
    npc('2', 'Fixture Wayfarer', {
      state: 'COMPLETE',
      sells: [trade('Fixture Passage Token', 12)],
      buys: [],
      reason_codes: [],
    }, ['shop', 'travel', 'quest'], [{ label: 'Fixture Harbor', position: { x: 32280, y: 32155, floor: -7 }, price: 10, currency: 'gold' }]),
    npc('4', 'Fixture Merchant North', {
      state: 'COMPLETE',
      sells: Array.from({ length: 124 }, (_, index) => trade(`Fixture Bulk Item ${String(index + 1).padStart(3, '0')}`, 100 + index)),
      buys: [],
      reason_codes: [],
    }),
    npc('5', 'Fixture Merchant South', {
      state: 'PARTIAL',
      sells: [],
      buys: [],
      reason_codes: ['QUALIFICATION_PARTIAL_SHOP'],
    }),
    {
      entity_id: `monster-entity:${'a'.repeat(32)}`,
      kind: 'monster',
      name: 'Fixture Sentinel',
      loot: {
        state: 'COMPLETE',
        entries: [
          { item_ref: null, item_name: 'Fixture Coin', item_resolution_state: 'UNKNOWN', chance_ppm: 1_000_000, min_count: 1, max_count: 4 },
          { item_ref: null, item_name: 'Fixture Shard', item_resolution_state: 'UNKNOWN', chance_ppm: 250_000, min_count: 1, max_count: 1 },
        ],
        reason_codes: [],
      },
      stats: { state: 'COMPLETE', health: 20, experience: 5, armor: 1, defense: 0, speed: 67 },
      resistances: { state: 'COMPLETE', elements: [{ type: 'fixture', percent: 10 }], immunities: [] },
    },
  ];
}

export function qualificationGameplayFixture() {
  const files = new Map();
  const descriptors = [];
  for (const profile of profiles()) {
    const match = /^(npc|monster)-entity:([0-9a-f]{32})$/.exec(profile.entity_id);
    if (!match) throw new TypeError(`qualification gameplay entity id invalid: ${profile.entity_id}`);
    const kind = match[1];
    const key = match[2].slice(0, 2);
    const shard = { kind, key, profiles: [profile] };
    const data = bytes(shard);
    const path = `shards/${kind}-${key}.json`;
    files.set(path, data);
    descriptors.push({ kind, key, path, bytes: data.byteLength, digest: digest(data), records: 1 });
  }
  descriptors.sort((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`));
  const manifest = {
    contract_id: 'oteryn-atlas-qualification-fixture-v1',
    semantic_revision: 1,
    capability: 'qualification-creature-gameplay-v1',
    profile_schema_version: 1,
    fixture_id: 'atlas-qualification-world-v2',
    shard_key_rule: 'entity-hash-prefix-2',
    limit_profile: 'qualification-creature-gameplay-v1',
    limits: { ...LIMITS },
    counts: { npc_profiles: 4, monster_profiles: 1, referenced_items: 0 },
    shards: descriptors,
  };
  manifest.semantic_digest = digest(manifest);
  files.set('manifest.json', bytes(manifest));
  return Object.freeze({ manifest: Object.freeze(manifest), files });
}

export async function installQualificationGameplayRoute(page) {
  const fixture = qualificationGameplayFixture();
  await page.route('**/web/creature-gameplay/**', async (route) => {
    const url = new URL(route.request().url());
    const marker = '/web/creature-gameplay/';
    const offset = url.pathname.indexOf(marker);
    if (offset < 0) return route.continue();
    const relative = decodeURIComponent(url.pathname.slice(offset + marker.length));
    const data = fixture.files.get(relative);
    if (!data) return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'content-length': String(data.byteLength), 'cache-control': 'no-store' },
      body: data,
    });
  });
  return fixture;
}
