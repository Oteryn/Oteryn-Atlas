import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {
  publicationReadinessManifestName,
  publishReadyPublication,
  validateReadyPublication,
} from './publication-readiness.mjs';
import { buildQualificationWorld, verifyQualificationWorld } from './qualification-world.mjs';

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const FIXTURE_ID = 'atlas-qualification-world-v2';
const TRUST_MARKER = 'oteryn-atlas-qualification-trust-v1';

function qualificationTrustDescriptor(manifest) {
  if (!manifest || manifest.fixtureId !== FIXTURE_ID || manifest.dataCapability !== 'qualification_fixture') {
    throw new TypeError('qualification fixture identity is invalid');
  }
  const fields = [
    'publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot',
    'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint', 'productDigest',
  ];
  for (const field of fields) {
    if (!SHA256.test(manifest[field])) throw new TypeError(`qualification fixture ${field} is invalid`);
  }
  return Object.freeze({
    marker: TRUST_MARKER,
    fixtureId: FIXTURE_ID,
    dataCapability: 'qualification_fixture',
    publicationRoot: manifest.publicationRoot,
    semanticRoot: manifest.semanticRoot,
    pixelRoot: manifest.pixelRoot,
    overviewRoot: manifest.overviewRoot,
    minimapRoot: manifest.minimapRoot,
    runtimeIndexRoot: manifest.runtimeIndexRoot,
    pixelBucketRoot: manifest.pixelBucketRoot,
    sourceFingerprint: manifest.sourceFingerprint,
    productDigest: manifest.productDigest,
  });
}

async function verifyPublishedQualificationWorld(publicationDir) {
  const root = path.resolve(publicationDir);
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-verify-'));
  const product = path.join(scratch, 'product');
  const readinessPath = path.join(root, publicationReadinessManifestName);
  try {
    fs.cpSync(root, product, {
      recursive: true,
      filter: (source) => path.resolve(source) !== readinessPath,
    });
    return await verifyQualificationWorld(product);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 2 });
  }
}

export async function prepareReadyQualificationPublication({ sourceDir, publicationDir, ...identity }) {
  const source = path.resolve(sourceDir);
  const publication = path.resolve(publicationDir);
  if (source === publication) throw new TypeError('qualification source and publication destinations must differ');

  await buildQualificationWorld(source);
  const fixtureManifest = await verifyQualificationWorld(source);
  const readiness = publishReadyPublication({ sourceDir: source, destinationDir: publication, ...identity });
  const publishedFixture = await verifyPublishedQualificationWorld(publication);
  if (JSON.stringify(publishedFixture) !== JSON.stringify(fixtureManifest)) {
    throw new TypeError('published qualification fixture identity does not match its verified source');
  }

  return Object.freeze({
    fixtureManifest: publishedFixture,
    readiness,
    qualificationTrust: qualificationTrustDescriptor(publishedFixture),
  });
}

function requestFile(publicationDir, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/fullworld/')) return null;
  const relative = pathname.slice('/fullworld/'.length);
  if (!relative || relative.includes('\0') || path.posix.normalize(relative) !== relative || path.posix.isAbsolute(relative)) return null;
  const root = path.resolve(publicationDir);
  const target = path.resolve(root, ...relative.split('/'));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  let stat;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  return { target, size: stat.size };
}

function contentType(target) {
  if (target.endsWith('.json')) return 'application/json; charset=utf-8';
  if (target.endsWith('.jsonl')) return 'application/x-ndjson; charset=utf-8';
  if (target.endsWith('.png')) return 'image/png';
  if (target.endsWith('.rgba')) return 'application/octet-stream';
  return 'application/octet-stream';
}

function parseStrictRange(header, size) {
  if (header === undefined) return null;
  if (typeof header !== 'string') return false;
  const match = /^bytes=([0-9]+)-([0-9]+)$/.exec(header);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= size) return false;
  return { start, end };
}

export async function startReadyQualificationPublicationServer({ publicationDir, readiness, ...identity }) {
  const root = path.resolve(publicationDir);
  const validatedReadiness = validateReadyPublication({ publicationDir: root, manifest: readiness, ...identity });
  const fixtureManifest = await verifyPublishedQualificationWorld(root);
  qualificationTrustDescriptor(fixtureManifest);

  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    if (request.url === '/__atlas/readiness') {
      const bytes = Buffer.from(`${JSON.stringify(validatedReadiness)}\n`);
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
      return;
    }
    const file = requestFile(root, request.url ?? '/');
    if (!file) {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end();
      return;
    }
    const range = parseStrictRange(request.headers.range, file.size);
    if (range === false) {
      response.writeHead(416, {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${file.size}`,
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }
    if (range) {
      const length = range.end - range.start + 1;
      response.writeHead(206, {
        'Content-Type': contentType(file.target),
        'Content-Length': String(length),
        'Content-Range': `bytes ${range.start}-${range.end}/${file.size}`,
        'Cache-Control': 'no-store',
        'Accept-Ranges': 'bytes',
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file.target, { start: range.start, end: range.end }).pipe(response);
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType(file.target),
      'Content-Length': String(file.size),
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes',
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file.target).pipe(response);
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || !Number.isInteger(address.port) || address.port < 1) {
    await new Promise((resolve) => server.close(resolve));
    throw new TypeError('qualification publication server did not bind an isolated loopback endpoint');
  }
  return Object.freeze({
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  });
}
