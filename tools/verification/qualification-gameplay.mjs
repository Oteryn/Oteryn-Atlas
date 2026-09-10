import fs from 'node:fs';
import path from 'node:path';

import {
  GAMEPLAY_LIMITS,
  QUALIFICATION_GAMEPLAY_EXPECTATIONS,
  canonicalGameplayJsonBytes,
  createCreatureGameplayProfileService,
  validateCreatureGameplayManifest,
} from '../../src/browser/creature-gameplay-profiles.mjs';
import { sha256ContentId } from '../../src/browser/loader.mjs';
import { QUALIFICATION_CREATURES } from './qualification-fixture-definition.mjs';

function creature(name) {
  const record = QUALIFICATION_CREATURES.find((entry) => entry.name === name);
  if (!record) throw new TypeError(`qualification creature ${name} missing`);
  return record;
}

function tradeRow(itemName, unitPrice) {
  return { item_ref: null, item_name: itemName, item_resolution_state: 'UNKNOWN', unit_price: unitPrice, currency: 'gold' };
}

function npcProfile(record, { shop, services = ['shop'], travel = [] } = {}) {
  return {
    entity_id: record.entity_id,
    kind: 'npc',
    name: record.name,
    shop,
    services: { state: 'COMPLETE', values: services },
    travel: { state: 'COMPLETE', destinations: travel, reason_codes: [] },
  };
}

function qualificationProfiles() {
  const guide = creature('Fixture Guide');
  const wayfarer = creature('Fixture Wayfarer');
  const merchantNorth = creature('Fixture Merchant North');
  const merchantSouth = creature('Fixture Merchant South');
  const sentinel = creature('Fixture Sentinel');
  const largeShop = Array.from({ length: 124 }, (_, index) => tradeRow(`Fixture Bulk Item ${String(index + 1).padStart(3, '0')}`, 100 + index));
  return [
    npcProfile(guide, {
      shop: { state: 'COMPLETE', sells: [tradeRow('Fixture Rope', 50), tradeRow('Fixture Torch', 8)], buys: [tradeRow('Fixture Parcel', 3)], reason_codes: [] },
      services: ['shop', 'quest'],
    }),
    npcProfile(wayfarer, {
      shop: { state: 'COMPLETE', sells: [tradeRow('Fixture Passage Token', 12)], buys: [], reason_codes: [] },
      services: ['shop', 'travel', 'quest'],
      travel: [{ label: 'Fixture Harbor', position: { x: 32280, y: 32155, floor: -7 }, price: 10, currency: 'gold' }],
    }),
    npcProfile(merchantNorth, {
      shop: { state: 'COMPLETE', sells: largeShop, buys: [], reason_codes: [] },
    }),
    npcProfile(merchantSouth, {
      shop: { state: 'PARTIAL', sells: [], buys: [], reason_codes: ['QUALIFICATION_PARTIAL_SHOP'] },
    }),
    {
      entity_id: sentinel.entity_id,
      kind: 'monster',
      name: sentinel.name,
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

async function shardDescriptor(root, profile) {
  const match = /^(npc|monster)-entity:([0-9a-f]{32})$/.exec(profile.entity_id);
  if (!match) throw new TypeError(`qualification gameplay entity id invalid: ${profile.entity_id}`);
  const kind = match[1];
  const key = match[2].slice(0, 2);
  const value = { kind, key, profiles: [profile] };
  const bytes = canonicalGameplayJsonBytes(value);
  const relative = `shards/${kind}-${key}.json`;
  const target = path.join(root, 'web', 'creature-gameplay', relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  return { kind, key, path: relative, bytes: bytes.byteLength, digest: await sha256ContentId(bytes), records: 1 };
}

export async function buildQualificationGameplay(root) {
  const shards = [];
  const profiles = qualificationProfiles();
  for (const profile of profiles) shards.push(await shardDescriptor(root, profile));
  shards.sort((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`));
  const manifest = {
    contract_id: QUALIFICATION_GAMEPLAY_EXPECTATIONS.contractId,
    semantic_revision: QUALIFICATION_GAMEPLAY_EXPECTATIONS.semanticRevision,
    capability: QUALIFICATION_GAMEPLAY_EXPECTATIONS.capability,
    profile_schema_version: QUALIFICATION_GAMEPLAY_EXPECTATIONS.profileSchemaVersion,
    fixture_id: QUALIFICATION_GAMEPLAY_EXPECTATIONS.fixtureId,
    shard_key_rule: QUALIFICATION_GAMEPLAY_EXPECTATIONS.shardKeyRule,
    limit_profile: QUALIFICATION_GAMEPLAY_EXPECTATIONS.limitProfile,
    limits: { ...GAMEPLAY_LIMITS.producer },
    counts: {
      npc_profiles: profiles.filter((profile) => profile.kind === 'npc').length,
      monster_profiles: profiles.filter((profile) => profile.kind === 'monster').length,
      referenced_items: 0,
    },
    shards,
  };
  manifest.semantic_digest = await sha256ContentId(canonicalGameplayJsonBytes(manifest));
  const manifestBytes = canonicalGameplayJsonBytes(manifest);
  const manifestPath = path.join(root, 'web', 'creature-gameplay', 'manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, manifestBytes);
  return { manifest, profiles };
}

function filesystemFetcher(root) {
  const base = path.resolve(root, 'web', 'creature-gameplay');
  return async (url) => {
    const relative = decodeURIComponent(new URL(url).pathname).split('/creature-gameplay/')[1];
    const target = relative ? path.resolve(base, ...relative.split('/')) : base;
    if (!relative || !target.startsWith(`${base}${path.sep}`)) return new Response('{}', { status: 404 });
    let bytes;
    try { bytes = fs.readFileSync(target); }
    catch { return new Response('{}', { status: 404 }); }
    return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } });
  };
}

export async function verifyQualificationGameplay(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'web', 'creature-gameplay', 'manifest.json'), 'utf8'));
  await validateCreatureGameplayManifest(manifest, { expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS, expectedSemanticDigest: manifest.semantic_digest });
  const service = createCreatureGameplayProfileService({
    baseUrl: 'https://qualification.invalid/web/creature-gameplay/',
    fetchImpl: filesystemFetcher(root),
    expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS,
    expectedSemanticDigest: manifest.semantic_digest,
  });
  for (const profile of qualificationProfiles()) {
    const result = await service.get(profile.entity_id);
    if (result.status !== 'ready' || result.profile.name !== profile.name) throw new TypeError(`qualification gameplay profile verification failed for ${profile.name}`);
  }
  return manifest;
}
