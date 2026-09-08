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

test('qualification publication readiness binds each exact execution identity before admission', async t => {
  const f = await fixture(t);
  assert.equal(f.validate().complete, true);
  for (const key of ['candidateSha','planSemanticDigest','planInstanceDigest','authorityDigest','environmentDigest','harnessDigest','producerRunId']) {
    const value = key === 'candidateSha' ? 'f'.repeat(40) : key === 'producerRunId' ? '43-1' : `sha256:${'f'.repeat(64)}`;
    assert.throws(() => validateReadyPublication({publicationDir:f.destination, manifest:f.manifest, ...identity, [key]:value}), /identity|stale/);
  }
  assert.deepEqual(await verifyQualificationWorld(f.source), f.product);
  assert.deepEqual(fs.readFileSync(path.join(f.destination, 'publication/publication.json')), fs.readFileSync(path.join(f.source, 'publication/publication.json')));
});
