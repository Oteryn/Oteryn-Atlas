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

async function withReadyServer(run) {
  const { prepareReadyQualificationPublication, startReadyQualificationPublicationServer } = await loadTool();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-hosted-qualification-'));
  const sourceDir = path.join(root, 'source');
  const publicationDir = path.join(root, 'published');
  try {
    const prepared = await prepareReadyQualificationPublication({ sourceDir, publicationDir, ...identity() });
    const server = await startReadyQualificationPublicationServer({ publicationDir, readiness: prepared.readiness, ...identity() });
    try {
      await run({ prepared, publicationDir, server });
    } finally {
      await server.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('hosted qualification publication is built, atomically readied and served from exact local bytes', async () => {
  await withReadyServer(async ({ prepared, server }) => {
    assert.equal(prepared.fixtureManifest.fixtureId, 'atlas-qualification-world-v2');
    assert.equal(prepared.fixtureManifest.dataCapability, 'qualification_fixture');
    assert.equal(prepared.readiness.complete, true);
    assert.equal(prepared.readiness.candidateSha, identity().candidateSha);
    assert.deepEqual(Object.keys(prepared.qualificationTrust).sort(), [
      'fixtureId', 'marker', 'overviewRoot', 'pixelBucketRoot', 'pixelRoot',
      'publicationRoot', 'runtimeIndexRoot', 'semanticRoot', 'sourceFingerprint',
    ].sort());

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
  });
});

test('hosted qualification publication preserves the production byte-range seam', async () => {
  await withReadyServer(async ({ publicationDir, server }) => {
    const relative = 'publication/semantic/chunks/f-7-r1008-c1004.jsonl';
    const expected = fs.readFileSync(path.join(publicationDir, relative)).subarray(0, 16);
    const response = await fetch(`${server.origin}/fullworld/${relative}`, { headers: { Range: 'bytes=0-15' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-range'), `bytes 0-15/${fs.statSync(path.join(publicationDir, relative)).size}`);
    assert.equal(response.headers.get('content-length'), '16');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  });
});

test('hosted qualification publication fails closed on malformed or unsatisfied byte ranges', async () => {
  await withReadyServer(async ({ server }) => {
    const target = `${server.origin}/fullworld/publication/semantic/chunks/f-7-r1008-c1004.jsonl`;
    for (const range of ['bytes=999999-1000000', 'bytes=0-1,4-5', 'items=0-1']) {
      const response = await fetch(target, { headers: { Range: range } });
      assert.equal(response.status, 416, range);
      assert.equal(response.headers.get('accept-ranges'), 'bytes');
    }
  });
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
