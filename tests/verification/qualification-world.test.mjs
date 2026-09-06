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

test('published qualification tiles retain distinct committed renderer anchors and presentation identities', async t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-distinct-tiles-'));
  const root = path.join(parent, 'world');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  await buildQualificationWorld(root);
  const floor = JSON.parse(fs.readFileSync(path.join(root, 'publication/semantic/floors/f-7.json')));
  const tiles = floor.chunks.flatMap(c => fs.readFileSync(path.join(root, 'publication/semantic', c.path), 'utf8').trim().split('\n').map(JSON.parse));
  assert.equal(new Set(tiles.map(t => t.tile_record_id)).size, tiles.length, 'every published tile needs a distinct renderer anchor identity');
  const { runInNewContext } = await import('node:vm');
  const app = fs.readFileSync(new URL('../../web/fullworld-app.mjs', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function committedRendererAnchors()'), app.indexOf('function commitRenderer()'));
  const selected = tiles.slice(0, 24);
  const anchors = runInNewContext(`${source}; committedRendererAnchors()`, { sceneRecords: selected.map(t => ({ tileRecordId: t.tile_record_id, ...t.position })) });
  assert.equal(anchors.length, selected.length, 'actual committed renderer anchors must retain all distinct visible tiles');
  const presentations = tiles.flatMap(t => t.presentation.map(p => p.export_record_id));
  assert.equal(new Set(presentations).size, presentations.length, 'presentation identity cannot alias another position');
  const anchor = tiles.find(t => t.position.x === 32280 && t.position.y === 32155);
  assert.equal(anchor.tile_record_id, 'tile:qualification-fixture-anchor');
  assert.equal(anchor.presentation[0].export_record_id, 'presentation:qualification-fixture-anchor');
});

test('qualification minimap covers runtime bounds with decoded projection of every published tile', async t => {
  const { inflateSync } = await import('node:zlib');
  const { loadMinimapWorld, loadMinimapFloor, loadVerifiedMinimapTile, selectMinimapChunks } = await import('../../src/layers/minimap.mjs');
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-minimap-coverage-'));
  const root = path.join(parent, 'world');
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const product = await buildQualificationWorld(root);
  const fetcher = async url => new Response(fs.readFileSync(path.join(root, new URL(url).pathname)));
  const base = new URL('https://fixture.invalid/minimap/');
  const world = await loadMinimapWorld(base, { rootContentId: product.minimapRoot, publicationRoot: product.publicationRoot, pixelRoot: product.pixelRoot }, fetcher);
  const floor = await loadMinimapFloor(base, world, world.floors.find(f => f.floor === -7), fetcher);
  const runtime = JSON.parse(fs.readFileSync(path.join(root, 'runtime-index/floors/f-7.json')));
  const tiles = runtime.chunks.flatMap(c => fs.readFileSync(path.join(root, 'publication/semantic', c.path), 'utf8').trim().split('\n').map(JSON.parse));
  for (let x = runtime.bounds.x_min; x < runtime.bounds.x_max_exclusive; x++) for (let y = runtime.bounds.y_min; y < runtime.bounds.y_max_exclusive; y++) {
    assert.equal(selectMinimapChunks(floor, { x_min:x, x_max_exclusive:x+1, y_min:y, y_max_exclusive:y+1 }).length, 1, `minimap coverage missing/duplicated at ${x},${y}`);
  }
  const decoded = new Map();
  for (const chunk of floor.chunks) {
    const png = Buffer.from(await loadVerifiedMinimapTile(base, chunk, fetcher));
    assert.equal(png.readUInt32BE(16), 256); assert.equal(png.readUInt32BE(20), 256);
    assert.equal(png[24], 8); assert.equal(png[25], 6);
    const idat = []; for (let offset=8; offset<png.length;) { const size=png.readUInt32BE(offset); if(png.toString('ascii',offset+4,offset+8)==='IDAT') idat.push(png.subarray(offset+8,offset+8+size)); offset+=size+12; }
    const rows=inflateSync(Buffer.concat(idat)); assert.equal(rows.length,256*1025);
    for(let y=0;y<256;y++)assert.equal(rows[y*1025],0,'independent decoder expects unfiltered rows');
    decoded.set(`${chunk.logicalAddress.region_x}:${chunk.logicalAddress.region_y}`,rows);
  }
  const pixelPack = fs.readFileSync(path.join(root, 'publication/pixels/packs/p0.rgba'));
  const average = [0, 1, 2].map(channel => Math.round(Array.from(pixelPack).filter((_, i) => i % 4 === channel).reduce((a, b) => a + b, 0) / (pixelPack.length / 4)));
  const expected = new Set(tiles.map(t => `${t.position.x}:${t.position.y}`));
  let opaque=0;
  for(const chunk of floor.chunks) {
    const rows=decoded.get(`${chunk.logicalAddress.region_x}:${chunk.logicalAddress.region_y}`);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
      const alpha=rows[y*1025+1+x*4+3];
      const present=expected.has(`${chunk.logicalAddress.region_x*256+x}:${chunk.logicalAddress.region_y*256+y}`);
      assert.equal(alpha,present?255:0,'decoded minimap must project actual occupied tiles only');
      if(alpha) {
        assert.deepEqual(Array.from(rows.subarray(y*1025+1+x*4,y*1025+1+x*4+3)),average,'minimap color must derive from published pixel bytes');
        opaque++;
      }
    }
  }
  assert.equal(opaque,tiles.length);
});
