import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalGameplayJsonBytes,
  createCreatureGameplayProfileService,
  GAMEPLAY_LIMITS,
  QUALIFICATION_GAMEPLAY_EXPECTATIONS,
} from '../../src/browser/creature-gameplay-profiles.mjs';
import { sha256ContentId } from '../../src/browser/loader.mjs';

const entityId = `npc-entity:00${'0'.repeat(30)}`;

function npcProfile() {
  return {
    entity_id: entityId,
    kind: 'npc',
    name: 'Qualification NPC',
    shop: { state: 'COMPLETE', sells: [], buys: [], reason_codes: [] },
    services: { state: 'COMPLETE', values: [] },
    travel: { state: 'COMPLETE', destinations: [], reason_codes: [] },
  };
}

async function qualificationProduct(path = 'shards/npc-00.json') {
  const shard = { kind: 'npc', key: '00', profiles: [npcProfile()] };
  const shardBytes = canonicalGameplayJsonBytes(shard);
  const descriptor = {
    kind: 'npc',
    key: '00',
    path,
    bytes: shardBytes.byteLength,
    digest: await sha256ContentId(shardBytes),
    records: 1,
  };
  const unsignedManifest = {
    contract_id: QUALIFICATION_GAMEPLAY_EXPECTATIONS.contractId,
    semantic_revision: QUALIFICATION_GAMEPLAY_EXPECTATIONS.semanticRevision,
    capability: QUALIFICATION_GAMEPLAY_EXPECTATIONS.capability,
    profile_schema_version: QUALIFICATION_GAMEPLAY_EXPECTATIONS.profileSchemaVersion,
    fixture_id: QUALIFICATION_GAMEPLAY_EXPECTATIONS.fixtureId,
    shard_key_rule: QUALIFICATION_GAMEPLAY_EXPECTATIONS.shardKeyRule,
    limit_profile: QUALIFICATION_GAMEPLAY_EXPECTATIONS.limitProfile,
    limits: GAMEPLAY_LIMITS.producer,
    counts: { npc_profiles: 1, monster_profiles: 0, referenced_items: 0 },
    shards: [descriptor],
  };
  const manifest = {
    ...unsignedManifest,
    semantic_digest: await sha256ContentId(canonicalGameplayJsonBytes(unsignedManifest)),
  };
  return {
    manifestBytes: canonicalGameplayJsonBytes(manifest),
    shardBytes,
  };
}

function streamOnlyResponse(bytes, onArrayBuffer) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-length': String(bytes.byteLength) }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    async arrayBuffer() {
      onArrayBuffer();
      throw new Error('unbounded arrayBuffer must not be called');
    },
  };
}

test('F05 gameplay manifest and shard reads stay bounded and never call arrayBuffer', async () => {
  const { manifestBytes, shardBytes } = await qualificationProduct();
  let fetches = 0;
  let arrayBufferCalls = 0;
  const service = createCreatureGameplayProfileService({
    baseUrl: 'https://atlas.example/creature-gameplay/',
    expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS,
    expectedSemanticDigest: null,
    fetchImpl: async (url) => {
      fetches += 1;
      const bytes = String(url).endsWith('/manifest.json') ? manifestBytes : shardBytes;
      return streamOnlyResponse(bytes, () => { arrayBufferCalls += 1; });
    },
  });

  const result = await service.get(entityId);
  assert.equal(result.status, 'ready');
  assert.equal(result.profile.name, 'Qualification NPC');
  assert.equal(fetches, 2);
  assert.equal(arrayBufferCalls, 0);
});

test('F08 gameplay rejects percent-decoded traversal before shard fetch', async () => {
  const { manifestBytes } = await qualificationProduct('shards/%2e%2e/escape.json');
  let fetches = 0;
  const service = createCreatureGameplayProfileService({
    baseUrl: 'https://atlas.example/creature-gameplay/',
    expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS,
    expectedSemanticDigest: null,
    fetchImpl: async () => {
      fetches += 1;
      return new Response(manifestBytes, {
        status: 200,
        headers: { 'content-length': String(manifestBytes.byteLength) },
      });
    },
  });

  const result = await service.get(entityId);
  assert.equal(result.status, 'error');
  assert.match(result.reason, /safe relative path|unsafe|gameplay shard path/i);
  assert.equal(fetches, 1);
});
