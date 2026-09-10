import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createCreatureGameplayProfileService, QUALIFICATION_GAMEPLAY_EXPECTATIONS } from '../../src/browser/creature-gameplay-profiles.mjs';
import {
  buildQualificationWorld,
  qualificationTrustDescriptor,
  verifyQualificationWorld,
} from '../../tools/verification/qualification-world.mjs';

test('qualification world is deterministic, complete for the 16-floor runtime contract, and rejects byte mutation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-world-'));
  const left = path.join(root, 'left');
  const right = path.join(root, 'right');
  const first = await buildQualificationWorld(left);
  const second = await buildQualificationWorld(right);

  assert.deepEqual(second, first);
  assert.equal(first.fixtureId, 'atlas-qualification-world-v2');
  assert.equal(first.semanticFloorCount, 16);
  assert.equal(first.runtimeFloorCount, 16);
  assert.equal(first.dataCapability, 'qualification_fixture');
  for (const field of ['publicationRoot', 'semanticRoot', 'runtimeIndexRoot', 'pixelRoot', 'pixelBucketRoot', 'overviewRoot', 'minimapRoot', 'productDigest']) {
    assert.match(first[field], /^sha256:[a-f0-9]{64}$/, `${field} must be content-addressed`);
  }
  assert.deepEqual(await verifyQualificationWorld(left), first);
  const gameplay = JSON.parse(fs.readFileSync(path.join(left, 'web', 'creature-gameplay', 'manifest.json'), 'utf8'));
  assert.equal(gameplay.fixture_id, 'atlas-qualification-world-v2');
  assert.equal(gameplay.capability, 'qualification-creature-gameplay-v1');
  assert.deepEqual(gameplay.counts, { npc_profiles: 6, monster_profiles: 6, referenced_items: 0 });
  assert.equal(gameplay.shards.length, 12);
  assert.equal(fs.existsSync(path.join(left, 'web', 'creature-gameplay', 'qualification-unavailable.json')), false);
  const searchRecords = JSON.parse(fs.readFileSync(path.join(left, 'data', 'creatures', 'search.json'), 'utf8')).records;
  const fixtureFetch = async (url) => {
    const relative = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
    const bytes = fs.readFileSync(path.join(left, ...relative.split('/')));
    return new Response(bytes, { status: 200, headers: { 'content-length': String(bytes.length) } });
  };
  const service = createCreatureGameplayProfileService({
    baseUrl: 'https://qualification.invalid/web/creature-gameplay/', fetchImpl: fixtureFetch,
    expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS, expectedSemanticDigest: null,
  });
  for (const kind of ['npc', 'monster']) {
    const record = searchRecords.find((entry) => entry.kind === kind);
    assert.ok(record, `qualification fixture needs a ${kind}`);
    const profile = await service.get(record.entity_id);
    assert.equal(profile.status, 'ready');
    assert.equal(profile.profile.name, record.label);
  }

  fs.appendFileSync(path.join(left, 'publication', 'semantic', 'chunks', 'f-7-r1008-c1004.jsonl'), 'forged');
  await assert.rejects(() => verifyQualificationWorld(left), /digest|identity|byte/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test('qualification trust descriptor is the exact browser trust subset of the verified product manifest', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-trust-'));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    const verified = await verifyQualificationWorld(root);
    const descriptor = qualificationTrustDescriptor(verified);
    assert.deepEqual(descriptor, {
      marker: 'oteryn-atlas-qualification-trust-v1',
      fixtureId: verified.fixtureId,
      dataCapability: verified.dataCapability,
      publicationRoot: verified.publicationRoot,
      semanticRoot: verified.semanticRoot,
      pixelRoot: verified.pixelRoot,
      runtimeIndexRoot: verified.runtimeIndexRoot,
      pixelBucketRoot: verified.pixelBucketRoot,
      overviewRoot: verified.overviewRoot,
      minimapRoot: verified.minimapRoot,
      sourceFingerprint: verified.sourceFingerprint,
      productDigest: verified.productDigest,
    });
    assert.equal(Object.isFrozen(descriptor), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
