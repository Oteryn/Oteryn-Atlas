import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildQualificationWorld, verifyQualificationWorld } from '../../tools/verification/qualification-world.mjs';

const required = Object.freeze([
  'animation/manifest.json',
  'animation/programs.json',
  'animation/buckets/q0000.rgba',
  'data/creatures/index.json',
  'data/creatures/search.json',
  'data/creatures/chunks/f-7/504_502.json',
  'web/semantic-search/index.json',
  'web/semantic-search/creatures.json',
  'web/creature-gameplay/qualification-unavailable.json',
]);

const expectedCreatureLabels = Object.freeze([
  'Fixture Guide',
  'Fixture Wayfarer',
  'Fixture Cartographer With A Deliberately Long Name',
  'Fixture Merchant North',
  'Fixture Merchant South',
  'Fixture Merchant East',
  'Fixture Sentinel',
  'Fixture Raider One',
  'Fixture Raider Two',
  'Fixture Raider Three',
  'Fixture Raider Four',
  'Fixture Raider Five',
]);

test('qualification world publishes neutral ancillary products and binds them to product verification', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-q-ancillary-'));
  const product = path.join(root, 'product');
  try {
    const manifest = await buildQualificationWorld(product);
    for (const relative of required) {
      assert.equal(fs.existsSync(path.join(product, relative)), true, `${relative} must be fixture-owned`);
    }

    assert.equal((await verifyQualificationWorld(product)).productDigest, manifest.productDigest);
    t.diagnostic(`qualification fixture: id=${manifest.fixtureId} productDigest=${manifest.productDigest} files=${manifest.files.length}`);

    const search = JSON.parse(fs.readFileSync(path.join(product, 'data/creatures/search.json'), 'utf8'));
    assert.deepEqual(search.records.map((row) => row.label), expectedCreatureLabels);

    const semantic = JSON.parse(fs.readFileSync(path.join(product, 'web/semantic-search/index.json'), 'utf8'));
    assert.equal(semantic.records[0].label, 'Fixture Harbor');
    assert.equal(semantic.source.authority, 'Oteryn/Oteryn-Atlas');
    assert.equal(semantic.source.game_revision, 'fixture');

    const fixtureFacts = JSON.stringify({ search, semantic });
    assert.doesNotMatch(fixtureFacts, /\b(?:Sam|Rat|Thais)\b/);

    const target = path.join(product, 'web/semantic-search/creatures.json');
    fs.appendFileSync(target, ' ');
    await assert.rejects(() => verifyQualificationWorld(product), /digest mismatch/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});