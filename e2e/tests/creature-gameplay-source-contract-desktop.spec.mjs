// R4 hosted qualification: exercise this exact protected machine owner.
import { expect, test } from '@playwright/test';

const sourceMode = process.env.ATLAS_GAMEPLAY_SOURCE_MODE ?? 'published-gameplay';
if (!['published-gameplay', 'selected-gameplay-v1'].includes(sourceMode)) throw new TypeError('unsupported protected gameplay source mode');
const semanticDigest = sourceMode === 'selected-gameplay-v1'
  ? 'sha256:be06f49180535bcc764579209370cb5f1edafe2c7882e3380fb9cbdb807c153f'
  : 'sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28';

const SOURCE_FACTS = Object.freeze({
  sam: Object.freeze({ entityId: 'npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e', name: 'Sam' }),
  rat: Object.freeze({ entityId: 'monster-entity:80295e51265b3662bfbea2ea01ee3ccb', name: 'Rat' }),
});

async function json(request, path) {
  const response = await request.get(path, { failOnStatusCode: false });
  expect(response.status(), `source contract HTTP status for ${path}`).toBe(200);
  return response.json();
}

function shardKey(entityId) {
  const match = /^(npc|monster)-entity:([0-9a-f]{32})$/.exec(entityId);
  if (!match) throw new TypeError(`invalid source-contract entity id ${entityId}`);
  return { kind: match[1], key: match[2].slice(0, 2) };
}

async function profile(request, manifest, fixture) {
  const { kind, key } = shardKey(fixture.entityId);
  const descriptor = manifest.shards.find((entry) => entry.kind === kind && entry.key === key);
  expect(descriptor, `missing ${kind}:${key} gameplay source shard`).toBeTruthy();
  const shard = await json(request, `/web/creature-gameplay/${descriptor.path}`);
  expect(shard.kind).toBe(kind);
  expect(shard.key).toBe(key);
  const value = shard.profiles.find((entry) => entry.entity_id === fixture.entityId);
  expect(value, `missing real-source gameplay profile ${fixture.name}`).toBeTruthy();
  expect(value.name).toBe(fixture.name);
  return value;
}

test('bounded real gameplay source preserves selected Game-owned NPC facts', async ({ request }) => {
  const manifest = await json(request, '/web/creature-gameplay/manifest.json');
  expect(manifest.contract_id).toBe('oteryn-game-atlas-export-v1');
  expect(manifest.capability).toBe('creature-gameplay-profiles-v1');
  expect(manifest.producer_repository_sha).toBe('b56ce339281d252a9e01a5a2bed583582bf29e68');
  expect(manifest.semantic_digest).toBe(semanticDigest);

  const sam = await profile(request, manifest, SOURCE_FACTS.sam);
  expect(sam.shop.sells).toEqual(expect.arrayContaining([
    expect.objectContaining({ item_name: 'axe', unit_price: 20, currency: 'gold' }),
  ]));
  expect(sam.shop.buys).toEqual(expect.arrayContaining([
    expect.objectContaining({ item_name: 'axe', unit_price: 7, currency: 'gold' }),
  ]));
});

test('bounded real gameplay source preserves selected Game-owned monster facts', async ({ request }) => {
  const manifest = await json(request, '/web/creature-gameplay/manifest.json');
  const rat = await profile(request, manifest, SOURCE_FACTS.rat);
  expect(rat.loot.state).toBe('COMPLETE');
  expect(rat.loot.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({ item_name: 'gold coin', chance_ppm: 1_000_000, min_count: 1, max_count: 4 }),
  ]));
  expect(rat.stats).toEqual(expect.objectContaining({ state: 'COMPLETE', health: 20, experience: 5, armor: 1, defense: 0, speed: 67 }));
});
