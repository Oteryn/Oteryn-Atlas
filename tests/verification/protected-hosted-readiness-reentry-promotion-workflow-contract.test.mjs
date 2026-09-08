import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishReadyPublication, validateReadyPublication } from '../../tools/verification/publication-readiness.mjs';
import { buildQualificationWorld, verifyQualificationWorld } from '../../tools/verification/qualification-world.mjs';
const identity = { repository: 'Oteryn/Oteryn-Atlas', candidateSha: 'a'.repeat(40),
  ...Object.fromEntries(['planSemanticDigest','planInstanceDigest','authorityDigest','environmentDigest','harnessDigest'].map((key,i) => [key, `sha256:${String(i).repeat(64)}`])), producerRunId: '42-1' };
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-readiness-contract-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), destination = path.join(root, 'ready');
  const product = await buildQualificationWorld(source);
  const manifest = publishReadyPublication({sourceDir: source, destinationDir: destination, ...identity});
  return {root, source, destination, product, manifest, validate: () => validateReadyPublication({publicationDir: destination, manifest, ...identity})};
}

test('readiness reentry validates exact immutable bytes and cannot overwrite an existing product', async t => {
  const f = await fixture(t), before = fs.readFileSync(path.join(f.destination, 'atlas-publication-readiness.json'));
  assert.deepEqual(f.validate(), f.manifest);
  assert.deepEqual(f.validate(), f.manifest);
  assert.throws(() => publishReadyPublication({sourceDir:f.source, destinationDir:f.destination, ...identity}), /overwrite/);
  assert.deepEqual(fs.readFileSync(path.join(f.destination, 'atlas-publication-readiness.json')), before);
  fs.appendFileSync(path.join(f.destination, 'publication/publication.json'), 'drift');
  assert.throws(f.validate, /digest|size/);
  assert.throws(() => publishReadyPublication({sourceDir:f.source, destinationDir:f.destination, ...identity}), /overwrite/);
});
