import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishReadyPublication, validateReadyPublication } from '../../tools/verification/publication-readiness.mjs';

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

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-readiness-identity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'), destination = path.join(root, 'ready');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'product.json'), '{}\n');
  const manifest = publishReadyPublication({ sourceDir: source, destinationDir: destination, ...identity });
  return { destination, manifest };
}

test('publication readiness rejects producer-run and harness identity drift', t => {
  const f = fixture(t);
  assert.deepEqual(validateReadyPublication({ publicationDir: f.destination, manifest: f.manifest, ...identity }), f.manifest);
  for (const [field, value] of [
    ['producerRunId', '43-1'],
    ['harnessDigest', `sha256:0000000000000000000000000000000000000000000000000000000000000000`],
  ]) {
    assert.throws(
      () => validateReadyPublication({ publicationDir: f.destination, manifest: f.manifest, ...identity, [field]: value }),
      /identity|stale/i,
    );
  }
});
