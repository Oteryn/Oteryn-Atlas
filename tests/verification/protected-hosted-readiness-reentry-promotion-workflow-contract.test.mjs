import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishReadyPublication } from '../../tools/verification/publication-readiness.mjs';

const identity = {
  repository: 'Oteryn/Oteryn-Atlas',
  candidateSha: 'a'.repeat(40),
  planSemanticDigest: `sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`,
  planInstanceDigest: `sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc`,
  authorityDigest: `sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd`,
  environmentDigest: `sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`,
  harnessDigest: `sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`,
  producerRunId: '42-1',
};

test('publication readiness refuses overwrite and preserves existing bytes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-readiness-overwrite-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), destination = path.join(root, 'ready');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'product.json'), '{}\n');
  publishReadyPublication({ sourceDir: source, destinationDir: destination, ...identity });
  const manifestPath = path.join(destination, 'atlas-publication-readiness.json');
  const productPath = path.join(destination, 'product.json');
  const beforeManifest = fs.readFileSync(manifestPath);
  const beforeProduct = fs.readFileSync(productPath);
  assert.throws(() => publishReadyPublication({ sourceDir: source, destinationDir: destination, ...identity }), /overwrite/i);
  assert.deepEqual(fs.readFileSync(manifestPath), beforeManifest);
  assert.deepEqual(fs.readFileSync(productPath), beforeProduct);
});
