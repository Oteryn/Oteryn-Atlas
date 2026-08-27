import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REQUIRED_ENTRYPOINTS } from '../../tools/verification/hosted-publication-readiness.mjs';
import { validateRemoteReadinessMetadata } from '../../tools/verification/remote-publication-readiness.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const PLAN = `sha256:${'2'.repeat(64)}`;
const ROOT = `sha256:${'3'.repeat(64)}`;
const TREE = `sha256:${'4'.repeat(64)}`;
const IMAGE = `mcr.microsoft.com/playwright@sha256:${'5'.repeat(64)}`;
const ORIGIN = `https://publication.example.invalid/atlas/${ROOT.slice(7)}`;

function fixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-remote-publication-origin-'));
  const manifestPath = path.join(temp, 'readiness.json');
  const publicationIdentityPath = path.join(temp, 'publication.json');
  const manifest = {
    schemaVersion: 1,
    complete: true,
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: SHA,
    planDigest: PLAN,
    producer: { runId: '12345', runAttempt: 2 },
    publication: {
      origin: ORIGIN,
      rootContentId: ROOT,
      inventoryAlgorithm: 'atlas-publication-tree-v1',
      treeDigest: TREE,
      fileCount: 321,
      bytes: 123456789,
    },
    browserImage: IMAGE,
    requiredEntrypoints: [...REQUIRED_ENTRYPOINTS],
    createdAt: '2026-08-27T05:00:00.000Z',
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
  fs.writeFileSync(publicationIdentityPath, `${JSON.stringify({ rootContentId: ROOT, origin: ORIGIN })}\n`);
  return { temp, manifestPath, publicationIdentityPath, manifest };
}

function options(f) {
  return {
    manifestPath: f.manifestPath,
    publicationIdentityPath: f.publicationIdentityPath,
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: SHA,
    planDigest: PLAN,
    publicationRoot: ROOT,
    browserImage: IMAGE,
    expectedTreeDigest: TREE,
    expectedFileCount: 321,
    expectedBytes: 123456789,
  };
}

function rewrite(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
}

test('remote readiness binds the immutable serving origin to both readiness and publication identity', () => {
  const f = fixture();
  try {
    const result = validateRemoteReadinessMetadata(options(f));
    assert.equal(result.publicationOrigin, ORIGIN);
  } finally {
    fs.rmSync(f.temp, { recursive: true, force: true });
  }
});

test('remote readiness rejects missing, non-HTTPS, non-content-addressed, or identity-mismatched origins', () => {
  const f = fixture();
  try {
    for (const mutate of [
      (m) => { delete m.publication.origin; },
      (m) => { m.publication.origin = `http://publication.example.invalid/atlas/${ROOT.slice(7)}`; },
      (m) => { m.publication.origin = 'https://publication.example.invalid/atlas/latest'; },
    ]) {
      const candidate = structuredClone(f.manifest);
      mutate(candidate);
      rewrite(f.manifestPath, candidate);
      assert.throws(() => validateRemoteReadinessMetadata(options(f)), /origin/);
    }

    rewrite(f.manifestPath, f.manifest);
    rewrite(f.publicationIdentityPath, { rootContentId: ROOT, origin: 'https://publication.example.invalid/atlas/other' });
    assert.throws(() => validateRemoteReadinessMetadata(options(f)), /origin/);
  } finally {
    fs.rmSync(f.temp, { recursive: true, force: true });
  }
});
