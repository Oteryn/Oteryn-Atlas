import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildQualificationWorld, verifyQualificationWorld } from '../../tools/verification/qualification-world.mjs';
import { QUALIFICATION_CREATURES, QUALIFICATION_SEMANTIC_RECORD } from '../../tools/verification/qualification-fixture-definition.mjs';

const required = Object.freeze([
  'animation/manifest.json', 'animation/programs.json', 'animation/buckets/q0000.rgba',
  'data/creatures/index.json', 'data/creatures/search.json', 'data/creatures/chunks/f-7/504_502.json',
  'web/semantic-search/index.json', 'web/semantic-search/creatures.json',
]);
test('qualification world publishes neutral animation, creature and search products', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-q-ancillary-'));
  const product = path.join(root, 'product');
  try {
    const manifest = await buildQualificationWorld(product);
    for (const relative of required) assert.equal(fs.existsSync(path.join(product, relative)), true, relative);
    assert.equal((await verifyQualificationWorld(product)).productDigest, manifest.productDigest);
    const search = JSON.parse(fs.readFileSync(path.join(product, 'data/creatures/search.json'), 'utf8'));
    assert.deepEqual(search.records.map((row) => row.label), QUALIFICATION_CREATURES.map((row) => row.name));
    const semantic = JSON.parse(fs.readFileSync(path.join(product, 'web/semantic-search/index.json'), 'utf8'));
    assert.equal(semantic.records[0].label, QUALIFICATION_SEMANTIC_RECORD.label);
    assert.equal(semantic.source.authority, 'Oteryn/Oteryn-Atlas');
    assert.equal(semantic.source.game_revision, 'fixture');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('qualification verifier rejects ancillary byte mutation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-q-ancillary-mutate-'));
  const product = path.join(root, 'product');
  try {
    await buildQualificationWorld(product);
    const target = path.join(product, 'web/semantic-search/creatures.json');
    fs.appendFileSync(target, ' ');
    await assert.rejects(() => verifyQualificationWorld(product), /digest mismatch/i);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
