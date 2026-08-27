import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  GAMEPLAY_EXPECTATIONS,
  GAMEPLAY_LIMITS,
  createCreatureGameplayProfileService,
  validateCreatureGameplayManifest,
} from '../src/browser/creature-gameplay-profiles.mjs';

const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const sortCanonical = (value) => Array.isArray(value) ? value.map(sortCanonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])])) : value;
const bytes = (value) => Buffer.from(JSON.stringify(sortCanonical(value)));
const entity = (kind, prefix, suffix = '0'.repeat(30)) => `${kind}-entity:${prefix}${suffix}`;

function npcProfile(id = entity('npc', 'aa')) {
  return {
    entity_id: id, kind: 'npc', name: 'Alice',
    shop: { state: 'COMPLETE', sells: [{ item_ref: null, item_name: 'rope', item_resolution_state: 'UNRESOLVED', unit_price: 50, currency: 'gold' }], buys: [], reason_codes: [] },
    services: { state: 'PARTIAL', values: ['shop'], reason_codes: ['SERVICE_TAXONOMY_NOT_EXHAUSTIVE'] },
    travel: { state: 'UNKNOWN', destinations: [], reason_codes: ['NO_STATIC_TRAVEL_EVIDENCE'] },
  };
}
function monsterProfile(id = entity('monster', 'bb')) {
  return {
    entity_id: id, kind: 'monster', name: 'Rat',
    loot: { state: 'COMPLETE', entries: [{ item_ref: null, item_name: 'gold coin', item_resolution_state: 'UNRESOLVED', chance_ppm: 1_000_000, min_count: 1, max_count: 4 }], reason_codes: [] },
    stats: { state: 'COMPLETE', health: 20, experience: 5, armor: 1, defense: 0, speed: 67 },
    resistances: { state: 'COMPLETE', elements: [], immunities: [] },
  };
}
function productFixture(profilesByKey) {
  const files = new Map();
  const shards = [];
  for (const [kind, key, profiles] of profilesByKey) {
    const value = { kind, key, profiles };
    const data = bytes(value);
    const path = `shards/${kind}-${key}.json`;
    files.set(path, data);
    shards.push({ kind, key, path, bytes: data.length, digest: sha(data), records: profiles.length });
  }
  shards.sort((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`));
  const manifest = {
    contract_id: 'oteryn-game-atlas-export-v1', semantic_revision: 1,
    capability: 'creature-gameplay-profiles-v1', profile_schema_version: 1,
    producer_repository_sha: GAMEPLAY_EXPECTATIONS.gameSha,
    source_evidence: { repository: 'blakinio/Otheryn', sha: 'e417c5e7c22986bf4acef0495eb47f7b72c97cce' },
    shard_key_rule: 'entity-hash-prefix-2', limit_profile: 'creature-gameplay-profiles-v1-e417-census-v1',
    limits: { ...GAMEPLAY_LIMITS.producer },
    counts: { npc_profiles: profilesByKey.filter((x) => x[0] === 'npc').reduce((n, x) => n + x[2].length, 0), monster_profiles: profilesByKey.filter((x) => x[0] === 'monster').reduce((n, x) => n + x[2].length, 0), referenced_items: 0 },
    shards,
  };
  manifest.semantic_digest = sha(bytes(manifest));
  files.set('manifest.json', bytes(manifest));
  return { manifest, files };
}
function fetcherFor(files, calls) {
  return async (url) => {
    const path = new URL(url).pathname.split('/creature-gameplay/')[1];
    calls.push(path);
    const data = files.get(path);
    if (!data) return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    return { ok: true, status: 200, headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(data.length) : null }, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  };
}

test('exact merged Game manifest is accepted and wrong authority is rejected', async () => {
  const { manifest } = productFixture([['npc', 'aa', [npcProfile()]]]);
  assert.equal((await validateCreatureGameplayManifest(manifest, { expectedSemanticDigest: manifest.semantic_digest })).producer_repository_sha, GAMEPLAY_EXPECTATIONS.gameSha);
  await assert.rejects(() => validateCreatureGameplayManifest({ ...manifest, capability: 'wrong' }, { expectedSemanticDigest: manifest.semantic_digest }), /capability/);
  await assert.rejects(() => validateCreatureGameplayManifest({ ...manifest, producer_repository_sha: '0'.repeat(40) }, { expectedSemanticDigest: manifest.semantic_digest }), /Game SHA/);
  const unsafe = structuredClone(manifest); unsafe.shards[0].path = '../escape.json';
  await assert.rejects(() => validateCreatureGameplayManifest(unsafe, { expectedSemanticDigest: manifest.semantic_digest }), /path/);
});

test('service fetches only selected entity shard and returns deeply frozen profile', async () => {
  const first = npcProfile(entity('npc', 'aa'));
  const second = monsterProfile(entity('monster', 'bb'));
  const { manifest, files } = productFixture([['npc', 'aa', [first]], ['monster', 'bb', [second]]]);
  const calls = [];
  const service = createCreatureGameplayProfileService({ baseUrl: 'https://atlas.test/web/creature-gameplay/', fetchImpl: fetcherFor(files, calls), expectedSemanticDigest: manifest.semantic_digest, maxCacheShards: 2 });
  const result = await service.get(first.entity_id);
  assert.equal(result.status, 'ready');
  assert.equal(result.profile.name, 'Alice');
  assert.equal(Object.isFrozen(result.profile), true);
  assert.equal(Object.isFrozen(result.profile.shop.sells[0]), true);
  assert.deepEqual(calls, ['manifest.json', 'shards/npc-aa.json']);
});

test('bounded LRU evicts deterministically and does not preload universe', async () => {
  const a = npcProfile(entity('npc', 'aa'));
  const b = npcProfile(entity('npc', 'ab'));
  const c = npcProfile(entity('npc', 'ac'));
  const { manifest, files } = productFixture([['npc', 'aa', [a]], ['npc', 'ab', [b]], ['npc', 'ac', [c]]]);
  const calls = [];
  const service = createCreatureGameplayProfileService({ baseUrl: 'https://atlas.test/web/creature-gameplay/', fetchImpl: fetcherFor(files, calls), expectedSemanticDigest: manifest.semantic_digest, maxCacheShards: 2 });
  await service.get(a.entity_id); await service.get(b.entity_id); await service.get(c.entity_id); await service.get(a.entity_id);
  assert.deepEqual(calls, ['manifest.json', 'shards/npc-aa.json', 'shards/npc-ab.json', 'shards/npc-ac.json', 'shards/npc-aa.json']);
  assert.equal(service.stats().cacheShards, 2);
});

test('profile validation fails closed on malformed probability and item identity', async () => {
  const bad = monsterProfile(); bad.loot.entries[0].chance_ppm = 1_000_001;
  const { manifest, files } = productFixture([['monster', 'bb', [bad]]]);
  const service = createCreatureGameplayProfileService({ baseUrl: 'https://atlas.test/web/creature-gameplay/', fetchImpl: fetcherFor(files, []), expectedSemanticDigest: manifest.semantic_digest });
  const result = await service.get(bad.entity_id);
  assert.equal(result.status, 'error');
  assert.match(result.reason, /chance_ppm/);

  const fake = npcProfile(); fake.shop.sells[0].item_ref = 'item:legacy-client-id'; fake.shop.sells[0].item_resolution_state = 'RESOLVED';
  const fixture = productFixture([['npc', 'aa', [fake]]]);
  const service2 = createCreatureGameplayProfileService({ baseUrl: 'https://atlas.test/web/creature-gameplay/', fetchImpl: fetcherFor(fixture.files, []), expectedSemanticDigest: fixture.manifest.semantic_digest });
  const result2 = await service2.get(fake.entity_id);
  assert.equal(result2.status, 'error');
  assert.match(result2.reason, /item_ref/);
});

test('missing profile is unavailable while corrupt shard is isolated as error', async () => {
  const p = npcProfile();
  const { manifest, files } = productFixture([['npc', 'aa', [p]]]);
  const service = createCreatureGameplayProfileService({ baseUrl: 'https://atlas.test/web/creature-gameplay/', fetchImpl: fetcherFor(files, []), expectedSemanticDigest: manifest.semantic_digest });
  assert.equal((await service.get(entity('npc', 'ad'))).status, 'unavailable');
  files.set('shards/npc-aa.json', Buffer.from('{}'));
  const service2 = createCreatureGameplayProfileService({ baseUrl: 'https://atlas.test/web/creature-gameplay/', fetchImpl: fetcherFor(files, []), expectedSemanticDigest: manifest.semantic_digest });
  assert.equal((await service2.get(p.entity_id)).status, 'error');
});