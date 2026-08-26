import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createReleaseArtifactManifest, sourceTreeDigest } from '../../tools/verification/release-artifact-manifest.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-release-manifest-'));
  const source = path.join(root, 'source');
  fs.mkdirSync(path.join(source, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(source, 'a.txt'), 'alpha\n');
  fs.writeFileSync(path.join(source, 'nested', 'b.txt'), 'beta\n');
  const artifact = path.join(root, 'release.tar');
  fs.writeFileSync(artifact, Buffer.from('immutable-release-bytes'));
  return { root, source, artifact };
}

test('manifest is byte-identity and exact-revision bound without time-dependent fields', () => {
  const f = fixture();
  try {
    const input = {
      atlasRevision: 'a'.repeat(40),
      artifactPath: f.artifact,
      sourceTreePath: f.source,
      productRoots: { animation: `sha256:${'b'.repeat(64)}` },
    };
    const first = createReleaseArtifactManifest(input);
    const second = createReleaseArtifactManifest(input);
    assert.deepEqual(first, second);
    assert.match(first.artifactSha256, /^sha256:[a-f0-9]{64}$/);
    assert.match(first.sourceTreeSha256, /^sha256:[a-f0-9]{64}$/);
    assert.equal(Object.hasOwn(first, 'createdAt'), false);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('source tree digest changes when any source byte changes', () => {
  const f = fixture();
  try {
    const before = sourceTreeDigest(f.source);
    fs.appendFileSync(path.join(f.source, 'nested', 'b.txt'), 'delta\n');
    assert.notEqual(sourceTreeDigest(f.source), before);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('invalid revision, empty artifact and malformed product roots fail closed', () => {
  const f = fixture();
  try {
    assert.throws(() => createReleaseArtifactManifest({ atlasRevision: 'bad', artifactPath: f.artifact, sourceTreePath: f.source }), /atlasRevision/);
    fs.writeFileSync(f.artifact, '');
    assert.throws(() => createReleaseArtifactManifest({ atlasRevision: 'a'.repeat(40), artifactPath: f.artifact, sourceTreePath: f.source }), /non-empty/);
    fs.writeFileSync(f.artifact, 'x');
    assert.throws(() => createReleaseArtifactManifest({ atlasRevision: 'a'.repeat(40), artifactPath: f.artifact, sourceTreePath: f.source, productRoots: { bad: 'nope' } }), /product root/);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
