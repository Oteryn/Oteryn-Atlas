import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REQUIRED_ENTRYPOINTS,
  attestPublication,
  inventoryPublication,
  verifyReadiness,
} from '../../tools/verification/hosted-publication-readiness.mjs';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const PLAN = `sha256:${'2'.repeat(64)}`;
const ROOT = `sha256:${'3'.repeat(64)}`;
const IMAGE = `mcr.microsoft.com/playwright@sha256:${'4'.repeat(64)}`;

function fixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-hosted-publication-'));
  const root = path.join(temp, 'publication');
  for (const relative of REQUIRED_ENTRYPOINTS) {
    const target = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const body = relative === 'fullworld/publication/publication.json'
      ? { profile: 'fixture', rootContentId: ROOT }
      : { fixture: relative };
    fs.writeFileSync(target, `${JSON.stringify(body)}\n`);
  }
  fs.mkdirSync(path.join(root, 'fullworld', 'publication', 'chunks'), { recursive: true });
  fs.writeFileSync(path.join(root, 'fullworld', 'publication', 'chunks', 'fixture.jsonl'), '{"tile":1}\n');
  return { temp, root, output: path.join(temp, 'readiness.json') };
}

function common(root, output) {
  const inventory = inventoryPublication(root);
  return {
    root,
    output,
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: SHA,
    planDigest: PLAN,
    producerRunId: '12345',
    producerRunAttempt: 1,
    publicationRoot: ROOT,
    browserImage: IMAGE,
    expectedTreeDigest: inventory.treeDigest,
    expectedFileCount: inventory.fileCount,
    expectedBytes: inventory.bytes,
    createdAt: '2026-08-27T00:00:00.000Z',
  };
}

test('attestation is emitted only after exact immutable inventory validation', () => {
  const { temp, root, output } = fixture();
  try {
    const options = common(root, output);
    const manifest = attestPublication(options);
    assert.equal(manifest.complete, true);
    assert.equal(manifest.publication.treeDigest, options.expectedTreeDigest);
    assert.equal(manifest.publication.fileCount, options.expectedFileCount);
    assert.equal(manifest.publication.bytes, options.expectedBytes);
    assert.deepEqual(manifest.requiredEntrypoints, REQUIRED_ENTRYPOINTS);
    assert.equal(fs.existsSync(output), true);
    assert.doesNotMatch(fs.readFileSync(output, 'utf8'), /\.tmp-/);
    const verified = verifyReadiness({
      root,
      manifestPath: output,
      repository: options.repository,
      candidateSha: options.candidateSha,
      planDigest: options.planDigest,
      publicationRoot: options.publicationRoot,
      browserImage: options.browserImage,
    });
    assert.equal(verified.inventory.treeDigest, options.expectedTreeDigest);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('wrong expected digest fails closed and cannot publish complete readiness', () => {
  const { temp, root, output } = fixture();
  try {
    const options = common(root, output);
    options.expectedTreeDigest = `sha256:${'f'.repeat(64)}`;
    assert.throws(() => attestPublication(options), /publication tree digest mismatch/);
    assert.equal(fs.existsSync(output), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('partial publication fails before a readiness manifest is written', () => {
  const { temp, root, output } = fixture();
  try {
    fs.rmSync(path.join(root, 'fullworld', 'minimap', 'world.json'));
    assert.throws(() => inventoryPublication(root), /required publication entrypoint is missing/);
    assert.equal(fs.existsSync(output), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('consumer rejects bytes changed after producer attestation', () => {
  const { temp, root, output } = fixture();
  try {
    const options = common(root, output);
    attestPublication(options);
    fs.appendFileSync(path.join(root, 'fullworld', 'animation', 'manifest.json'), 'tamper\n');
    assert.throws(() => verifyReadiness({
      root,
      manifestPath: output,
      repository: options.repository,
      candidateSha: options.candidateSha,
      planDigest: options.planDigest,
      publicationRoot: options.publicationRoot,
      browserImage: options.browserImage,
    }), /publication tree digest mismatch|publication byte size mismatch/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('consumer rejects stale candidate and plan identities before browser use', () => {
  const { temp, root, output } = fixture();
  try {
    const options = common(root, output);
    attestPublication(options);
    assert.throws(() => verifyReadiness({
      root,
      manifestPath: output,
      repository: options.repository,
      candidateSha: 'fedcba9876543210fedcba9876543210fedcba98',
      planDigest: options.planDigest,
      publicationRoot: options.publicationRoot,
      browserImage: options.browserImage,
    }), /candidate SHA mismatch/);
    assert.throws(() => verifyReadiness({
      root,
      manifestPath: output,
      repository: options.repository,
      candidateSha: options.candidateSha,
      planDigest: `sha256:${'9'.repeat(64)}`,
      publicationRoot: options.publicationRoot,
      browserImage: options.browserImage,
    }), /plan digest mismatch/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('publication inventory rejects symlinked product bytes', { skip: process.platform === 'win32' }, () => {
  const { temp, root } = fixture();
  try {
    fs.symlinkSync(path.join(root, 'fullworld', 'animation', 'manifest.json'), path.join(root, 'alias.json'));
    assert.throws(() => inventoryPublication(root), /symbolic links are forbidden/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
