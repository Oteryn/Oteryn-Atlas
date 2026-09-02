import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

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

  fs.appendFileSync(path.join(left, 'publication', 'semantic', 'chunks', 'f-7-r1008-c1004.jsonl'), 'forged');
  await assert.rejects(() => verifyQualificationWorld(left), /digest|identity|byte/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test('qualification world carries a non-trivial searchable corpus and dynamic NPC/monster animation fixtures', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-functional-'));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    const semantic = JSON.parse(fs.readFileSync(path.join(root, 'web', 'semantic-search', 'index.json'), 'utf8'));
    const semanticWorld = JSON.parse(fs.readFileSync(path.join(root, 'publication', 'semantic', 'world.json'), 'utf8'));
    const semanticFloor = JSON.parse(fs.readFileSync(path.join(root, 'publication', 'semantic', 'floors', 'f-7.json'), 'utf8'));
    const runtimeFloor = JSON.parse(fs.readFileSync(path.join(root, 'runtime-index', 'floors', 'f-7.json'), 'utf8'));
    const overviewWorld = JSON.parse(fs.readFileSync(path.join(root, 'overview', 'world.json'), 'utf8'));
    const overviewFloor = JSON.parse(fs.readFileSync(path.join(root, 'overview', 'floors', 'f-7.json'), 'utf8'));
    const creatures = JSON.parse(fs.readFileSync(path.join(root, 'data', 'creatures', 'search.json'), 'utf8'));
    const programs = JSON.parse(fs.readFileSync(path.join(root, 'animation', 'programs.json'), 'utf8'));
    assert.ok(semanticFloor.chunks.length >= 9, 'qualification world must span multiple semantic chunks for range/race coverage');
    assert.equal(runtimeFloor.chunks.length, semanticFloor.chunks.length, 'runtime and semantic qualification chunk census must agree');
    assert.equal(overviewFloor.chunks.length, semanticFloor.chunks.length, 'overview and semantic qualification chunk census must agree');
    assert.equal(runtimeFloor.counts.tiles, semanticFloor.counts.tiles, 'runtime and semantic qualification floor tile census must agree');
    assert.equal(overviewFloor.counts.tiles, semanticFloor.counts.tiles, 'overview and semantic qualification floor tile census must agree');
    assert.equal(overviewFloor.counts.resolvedPrimitives, semanticFloor.counts.resolvedPrimitives, 'overview and semantic qualification floor primitive census must agree');
    assert.equal(overviewWorld.counts.chunks, semanticWorld.counts.shards, 'overview and semantic world chunk census must agree');
    assert.equal(overviewWorld.counts.tiles, semanticWorld.counts.tiles, 'overview and semantic world tile census must agree');
    assert.equal(overviewWorld.counts.resolvedPrimitives, semanticWorld.counts.resolvedPrimitives, 'overview and semantic world primitive census must agree');
    assert.ok(runtimeFloor.bounds.x_max_exclusive - runtimeFloor.bounds.x_min >= 96, 'qualification x bounds must span at least three regions');
    assert.ok(runtimeFloor.bounds.y_max_exclusive - runtimeFloor.bounds.y_min >= 96, 'qualification y bounds must span at least three regions');
    assert.ok(semantic.records.length + creatures.records.length > 50, 'qualification search corpus must exercise bounded repeated-search behavior');
    const dynamicKinds = new Set();
    const creatureByPresentation = new Map((creatures.records ?? []).map((record) => [record.outfit_presentation?.outfit_presentation_id, record.kind]));
    for (const program of programs.creature_programs ?? []) {
      if (program.phase_count > 1 && new Set(program.phase_content_ids ?? []).size > 1) {
        const kind = creatureByPresentation.get(program.outfit_presentation_id);
        if (kind) dynamicKinds.add(kind);
      }
    }
    assert.deepEqual([...dynamicKinds].sort(), ['monster', 'npc']);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
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
