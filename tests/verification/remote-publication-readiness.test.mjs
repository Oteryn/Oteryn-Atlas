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

function fixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-remote-publication-readiness-'));
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
  fs.writeFileSync(publicationIdentityPath, `${JSON.stringify({ rootContentId: ROOT })}\n`);
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

test('remote consumer accepts only exact producer readiness metadata and publication identity', () => {
  const f = fixture();
  try {
    const result = validateRemoteReadinessMetadata(options(f));
    assert.equal(result.complete, true);
    assert.equal(result.candidateSha, SHA);
    assert.equal(result.planDigest, PLAN);
    assert.equal(result.publicationRoot, ROOT);
    assert.equal(result.treeDigest, TREE);
    assert.equal(result.fileCount, 321);
    assert.equal(result.bytes, 123456789);
  } finally {
    fs.rmSync(f.temp, { recursive: true, force: true });
  }
});

test('remote consumer rejects incomplete, stale, or mismatched readiness metadata', () => {
  const f = fixture();
  try {
    const base = options(f);
    for (const mutate of [
      (m) => { m.complete = false; },
      (m) => { m.candidateSha = 'fedcba9876543210fedcba9876543210fedcba98'; },
      (m) => { m.planDigest = `sha256:${'6'.repeat(64)}`; },
      (m) => { m.browserImage = 'other-image'; },
      (m) => { m.publication.rootContentId = `sha256:${'7'.repeat(64)}`; },
      (m) => { m.publication.treeDigest = `sha256:${'8'.repeat(64)}`; },
      (m) => { m.publication.fileCount += 1; },
      (m) => { m.publication.bytes += 1; },
      (m) => { m.publication.inventoryAlgorithm = 'other'; },
      (m) => { m.requiredEntrypoints = m.requiredEntrypoints.slice(1); },
      (m) => { m.producer.runId = ''; },
      (m) => { m.producer.runAttempt = 0; },
      (m) => { m.createdAt = 'not-a-date'; },
    ]) {
      const candidate = structuredClone(f.manifest);
      mutate(candidate);
      rewrite(f.manifestPath, candidate);
      assert.throws(() => validateRemoteReadinessMetadata(base));
    }
  } finally {
    fs.rmSync(f.temp, { recursive: true, force: true });
  }
});

test('remote consumer rejects publication identity bytes that disagree with readiness', () => {
  const f = fixture();
  try {
    rewrite(f.publicationIdentityPath, { rootContentId: `sha256:${'9'.repeat(64)}` });
    assert.throws(() => validateRemoteReadinessMetadata(options(f)), /publication identity/);
  } finally {
    fs.rmSync(f.temp, { recursive: true, force: true });
  }
});
