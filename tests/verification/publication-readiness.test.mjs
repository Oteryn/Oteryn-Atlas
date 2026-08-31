import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { publishReadyPublication, validateReadyPublication } from '../../tools/verification/publication-readiness.mjs';

function identity() {
  return {
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: 'a'.repeat(40),
    planSemanticDigest: `sha256:${'b'.repeat(64)}`,
    planInstanceDigest: `sha256:${'c'.repeat(64)}`,
    authorityDigest: `sha256:${'d'.repeat(64)}`,
    environmentDigest: `sha256:${'e'.repeat(64)}`,
    producerRunId: '12345-1',
    harnessDigest: `sha256:${'f'.repeat(64)}`,
  };
}

test('publication readiness validates bytes then atomically publishes an exact complete semantic manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-publication-'));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'published');
  fs.mkdirSync(path.join(source, 'fullworld', 'animation'), { recursive: true });
  fs.writeFileSync(path.join(source, 'fullworld', 'animation', 'manifest.json'), '{"version":1}\n');

  const manifest = publishReadyPublication({ sourceDir: source, destinationDir: destination, ...identity() });
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.complete, true);
  assert.equal(manifest.planSemanticDigest, identity().planSemanticDigest);
  assert.equal(manifest.planInstanceDigest, identity().planInstanceDigest);
  assert.equal(fs.existsSync(path.join(destination, 'fullworld', 'animation', 'manifest.json')), true);
  assert.deepEqual(validateReadyPublication({ publicationDir: destination, manifest, ...identity() }), manifest);
  fs.rmSync(root, { recursive: true, force: true });
});

test('publication consumer rejects stale semantic, instance, authority, environment identity and any byte mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-publication-'));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'published');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'product.json'), '{}');
  const manifest = publishReadyPublication({ sourceDir: source, destinationDir: destination, ...identity() });
  fs.appendFileSync(path.join(destination, 'product.json'), 'forged');
  assert.throws(() => validateReadyPublication({ publicationDir: destination, manifest, ...identity() }), /digest|size/i);
  for (const [field, value] of [
    ['candidateSha', '0'.repeat(40)],
    ['planSemanticDigest', `sha256:${'0'.repeat(64)}`],
    ['planInstanceDigest', `sha256:${'1'.repeat(64)}`],
    ['authorityDigest', `sha256:${'2'.repeat(64)}`],
    ['environmentDigest', `sha256:${'3'.repeat(64)}`],
  ]) {
    assert.throws(
      () => validateReadyPublication({ publicationDir: destination, manifest, ...identity(), [field]: value }),
      /candidate|identity|stale/i,
    );
  }
  fs.rmSync(root, { recursive: true, force: true });
});
