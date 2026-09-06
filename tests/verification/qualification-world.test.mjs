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

test('qualification world carries a functional browser corpus and dynamic NPC/monster animation fixtures', async () => {
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

test('qualification world preserves protected browser navigation regions', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-lower-bound-'));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    const semanticFloor = JSON.parse(fs.readFileSync(path.join(root, 'publication', 'semantic', 'floors', 'f-7.json'), 'utf8'));
    const protectedPoints = [
      { x: 32369, y: 32241, floor: -7 },
      { x: 32380, y: 32250, floor: -7 },
      { x: 32469, y: 32341, floor: -7 },
    ];
    const regions = new Set((semanticFloor.chunks ?? []).map((chunk) => `${chunk.logicalAddress.region_x}:${chunk.logicalAddress.region_y}`));
    for (const point of protectedPoints) {
      assert.ok(point.x >= semanticFloor.bounds.x_min && point.x < semanticFloor.bounds.x_max_exclusive, `protected x=${point.x} must remain inside qualification bounds`);
      assert.ok(point.y >= semanticFloor.bounds.y_min && point.y < semanticFloor.bounds.y_max_exclusive, `protected y=${point.y} must remain inside qualification bounds`);
      assert.ok(regions.has(`${Math.floor(point.x / 32)}:${Math.floor(point.y / 32)}`), `protected point ${point.x},${point.y} must have a published qualification chunk`);
    }
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

test('published qualification long-name NPC has isolated annotation space and consistent search binding', async t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-long-npc-publication-'));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const root = path.join(parent, 'world');
  await buildQualificationWorld(root);
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data/creatures/index.json')));
  const creatures = index.chunks.flatMap(chunk => JSON.parse(fs.readFileSync(path.join(root, 'data/creatures', chunk.path))).records);
  const longNames = creatures.filter(r => r.kind === 'npc' && r.name.length >= 32);
  assert.equal(longNames.length, 1);
  const target = longNames[0];
  const otherNpcs = creatures.filter(r => r.kind === 'npc' && r.record_id !== target.record_id);
  assert.ok(otherNpcs.length >= 3);
  for (const npc of otherNpcs) assert.ok(Math.abs(npc.position.y - target.position.y) >= 4, 'long-name annotation must not overlap another NPC row');
  const search = JSON.parse(fs.readFileSync(path.join(root, 'data/creatures/search.json')));
  assert.deepEqual(search.records.find(r => r.record_id === target.record_id).position, target.position);
  const floor = JSON.parse(fs.readFileSync(path.join(root, 'runtime-index/floors', `f${target.position.floor}.json`)));
  assert.ok(target.position.x >= floor.bounds.x_min && target.position.x < floor.bounds.x_max_exclusive);
  assert.ok(target.position.y >= floor.bounds.y_min && target.position.y < floor.bounds.y_max_exclusive);
});
