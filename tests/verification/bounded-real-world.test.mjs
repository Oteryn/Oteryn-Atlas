import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { decodeSemanticGroup } from '../../src/browser/fullworld.mjs';
import {
  BOUNDED_REAL_WORLD_ID,
  boundedRealTrustDescriptor,
  buildBoundedRealWorld,
  verifyBoundedRealWorld,
} from '../../tools/verification/bounded-real-world.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/(.:)/, '$1'));
const EXPECTED_TARGETS = new Set([
  'npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e',
  'monster-entity:80295e51265b3662bfbea2ea01ee3ccb',
  'npc-entity:0e7857888218c9081fabdb469aa9349b',
  'npc-entity:0c83ae18a907dc7e8f15c37c03e4f04c',
]);

function tempDir(label) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`)), 'product');
}

test('bounded-real product is deterministic and binds exact real ancillary bytes', async () => {
  const firstRoot = tempDir('atlas-bounded-a');
  const secondRoot = tempDir('atlas-bounded-b');
  const first = await buildBoundedRealWorld(firstRoot, { sourceRoot: ROOT });
  const second = await buildBoundedRealWorld(secondRoot, { sourceRoot: ROOT });
  assert.equal(first.fixtureId, BOUNDED_REAL_WORLD_ID);
  assert.equal(first.dataCapability, 'bounded_real_world');
  assert.equal(first.mapAuthority, false);
  assert.equal(first.productDigest, second.productDigest);
  assert.deepEqual(first.files, second.files);
  assert.deepEqual(new Set(first.targetEntityIds), EXPECTED_TARGETS);

  const sourceSemantic = fs.readFileSync(path.join(ROOT, 'web/semantic-search/index.json'));
  const productSemantic = fs.readFileSync(path.join(firstRoot, 'web/semantic-search/index.json'));
  const sourceCreatures = fs.readFileSync(path.join(ROOT, 'web/semantic-search/creatures.json'));
  const productCreatures = fs.readFileSync(path.join(firstRoot, 'web/semantic-search/creatures.json'));
  assert.deepEqual(productSemantic, sourceSemantic);
  assert.deepEqual(productCreatures, sourceCreatures);

  const verified = await verifyBoundedRealWorld(firstRoot);
  assert.equal(verified.productDigest, first.productDigest);
  const descriptor = boundedRealTrustDescriptor(verified);
  assert.equal(descriptor.marker, 'oteryn-atlas-bounded-real-trust-v1');
  assert.equal(descriptor.dataCapability, 'bounded_real_world');

  fs.rmSync(path.dirname(firstRoot), { recursive: true, force: true });
  fs.rmSync(path.dirname(secondRoot), { recursive: true, force: true });
});

test('bounded-real authenticated semantic groups decode exact tile cardinality', async () => {
  const root = tempDir('atlas-bounded-row-framing');
  await buildBoundedRealWorld(root, { sourceRoot: ROOT });
  const runtimeWorld = JSON.parse(fs.readFileSync(path.join(root, 'runtime-index/world.json'), 'utf8'));
  let decodedTiles = 0;
  try {
    for (const floorEntry of runtimeWorld.floors) {
      const runtimeFloor = JSON.parse(fs.readFileSync(path.join(root, 'runtime-index', floorEntry.path), 'utf8'));
      for (const chunk of runtimeFloor.chunks) {
        const source = fs.readFileSync(path.join(root, 'publication/semantic', chunk.path));
        for (const group of chunk.groups) {
          const bytes = source.subarray(group.offset, group.offset + group.bytes);
          const tiles = decodeSemanticGroup(bytes, {
            floor: runtimeFloor.floor,
            regionSpan: runtimeWorld.regionSpan,
            visualBounds: runtimeWorld.visualBounds,
            chunk,
            group,
          });
          assert.equal(tiles.length, group.tiles);
          decodedTiles += tiles.length;
        }
      }
    }
    assert.equal(decodedTiles, runtimeWorld.counts.tiles);
  } finally {
    fs.rmSync(path.dirname(root), { recursive: true, force: true });
  }
});

test('bounded-real runtime creature census is only the four exact compatibility fixtures', async () => {
  const root = tempDir('atlas-bounded-census');
  await buildBoundedRealWorld(root, { sourceRoot: ROOT });
  const search = JSON.parse(fs.readFileSync(path.join(root, 'data/creatures/search.json'), 'utf8'));
  assert.equal(search.records.length, 4);
  assert.deepEqual(new Set(search.records.map((record) => record.entity_id)), EXPECTED_TARGETS);
  assert.deepEqual(
    search.records.find((record) => record.label === 'Sam').position,
    { floor: -7, x: 32361, y: 32198 },
  );
  assert.deepEqual(
    search.records.find((record) => record.label === 'Rat').position,
    { floor: -15, x: 32573, y: 32211 },
  );
  const index = JSON.parse(fs.readFileSync(path.join(root, 'data/creatures/index.json'), 'utf8'));
  assert.equal(index.source.contract_id, 'oteryn-atlas-bounded-real-runtime-v1');
  assert.equal(index.source.capability, 'bounded-real-creatures-v1');
  assert.equal(index.source.semantic_digest, 'sha256:81505e91d7089f91e71813ec43f97118932db9cc7fd76d291fa399447ee2dfa4');
  assert.equal(index.counts.records, 4);
  fs.rmSync(path.dirname(root), { recursive: true, force: true });
});
