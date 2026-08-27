import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolPath = fileURLToPath(new URL('../../tools/verification/qualification-hosted-publication.mjs', import.meta.url));

function identity() {
  return {
    repository: 'Oteryn/Oteryn-Atlas',
    candidateSha: 'a'.repeat(40),
    planDigest: `sha256:${'b'.repeat(64)}`,
    producerRunId: '98765-1',
    harnessDigest: `sha256:${'c'.repeat(64)}`,
  };
}

async function loadTool() {
  assert.equal(fs.existsSync(toolPath), true, 'hosted qualification publication helper is missing');
  return import(pathToFileURL(toolPath).href);
}

test('hosted qualification publication is built, atomically readied and served from exact local bytes', async () => {
  const { prepareReadyQualificationPublication, startReadyQualificationPublicationServer } = await loadTool();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-hosted-qualification-'));
  const sourceDir = path.join(root, 'source');
  const publicationDir = path.join(root, 'published');
  try {
    const prepared = await prepareReadyQualificationPublication({ sourceDir, publicationDir, ...identity() });
    assert.equal(prepared.fixtureManifest.fixtureId, 'atlas-qualification-world-v2');
    assert.equal(prepared.fixtureManifest.dataCapability, 'qualification_fixture');
    assert.equal(prepared.readiness.complete, true);
    assert.equal(prepared.readiness.candidateSha, identity().candidateSha);
    assert.deepEqual(Object.keys(prepared.qualificationTrust).sort(), [
      'fixtureId', 'marker', 'overviewRoot', 'pixelBucketRoot', 'pixelRoot',
      'publicationRoot', 'runtimeIndexRoot', 'semanticRoot', 'sourceFingerprint',
    ].sort());

    const server = await startReadyQualificationPublicationServer({
      publicationDir,
      readiness: prepared.readiness,
      ...identity(),
    });
    try {
      assert.match(server.origin, /^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/);
      const readyResponse = await fetch(`${server.origin}/__atlas/readiness`);
      assert.equal(readyResponse.status, 200);
      const readiness = await readyResponse.json();
      assert.equal(readiness.candidateSha, identity().candidateSha);
      assert.equal(readiness.productDigest, prepared.readiness.productDigest);

      const publicationResponse = await fetch(`${server.origin}/fullworld/publication/publication.json`);
      assert.equal(publicationResponse.status, 200);
      const publication = await publicationResponse.json();
      assert.equal(publication.rootContentId, prepared.fixtureManifest.publicationRoot);
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('hosted qualification server refuses tampered bytes before browser consumption', async () => {
  const { prepareReadyQualificationPublication, startReadyQualificationPublicationServer } = await loadTool();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-hosted-qualification-'));
  const sourceDir = path.join(root, 'source');
  const publicationDir = path.join(root, 'published');
  try {
    const prepared = await prepareReadyQualificationPublication({ sourceDir, publicationDir, ...identity() });
    fs.appendFileSync(path.join(publicationDir, 'publication', 'publication.json'), 'forged');
    await assert.rejects(
      () => startReadyQualificationPublicationServer({ publicationDir, readiness: prepared.readiness, ...identity() }),
      /digest|size|ready|publication/i,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
