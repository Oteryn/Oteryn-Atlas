import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INVENTORY_ALGORITHM,
  READINESS_SCHEMA_VERSION,
  REQUIRED_ENTRYPOINTS,
  canonicalJson,
} from './hosted-publication-readiness.mjs';

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

function fail(message) {
  throw new Error(`remote publication readiness: ${message}`);
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} is required`);
  return value;
}

function requireDigest(value, label) {
  requireString(value, label);
  if (!SHA256.test(value)) fail(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function requireCommitSha(value, label) {
  requireString(value, label);
  if (!COMMIT_SHA.test(value)) fail(`${label} must be a 40-character lowercase commit SHA`);
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function requirePublicationOrigin(value, publicationRoot, label) {
  const raw = requireString(value, label);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`${label} must be an absolute HTTPS URL`);
  }
  if (parsed.protocol !== 'https:') fail(`${label} must use HTTPS`);
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    fail(`${label} must not contain credentials, query parameters, or fragments`);
  }
  const rootHex = requireDigest(publicationRoot, 'publication root').slice('sha256:'.length);
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (!segments.includes(rootHex)) {
    fail(`${label} must be content-addressed by the exact publication root`);
  }
  return parsed.href.replace(/\/$/, '');
}

function readJson(fileInput, label) {
  const file = path.resolve(requireString(fileInput, label));
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read ${label}: ${error.message}`);
  }
}

export function validateRemoteReadinessMetadata({
  manifestPath,
  publicationIdentityPath,
  repository,
  candidateSha,
  planDigest,
  publicationRoot,
  browserImage,
  expectedTreeDigest,
  expectedFileCount,
  expectedBytes,
}) {
  const expected = Object.freeze({
    repository: requireString(repository, 'repository'),
    candidateSha: requireCommitSha(candidateSha, 'candidate SHA'),
    planDigest: requireDigest(planDigest, 'plan digest'),
    publicationRoot: requireDigest(publicationRoot, 'publication root'),
    browserImage: requireString(browserImage, 'browser image identity'),
    treeDigest: requireDigest(expectedTreeDigest, 'expected publication tree digest'),
    fileCount: requirePositiveInteger(Number(expectedFileCount), 'expected publication file count'),
    bytes: requirePositiveInteger(Number(expectedBytes), 'expected publication byte size'),
  });

  const manifest = readJson(manifestPath, 'readiness manifest');
  if (manifest?.schemaVersion !== READINESS_SCHEMA_VERSION || manifest?.complete !== true) {
    fail('readiness manifest is incomplete or unsupported');
  }
  if (manifest.repository !== expected.repository) fail('readiness repository mismatch');
  if (manifest.candidateSha !== expected.candidateSha) fail('readiness candidate SHA mismatch');
  if (manifest.planDigest !== expected.planDigest) fail('readiness plan digest mismatch');
  if (manifest.browserImage !== expected.browserImage) fail('readiness browser image mismatch');
  if (manifest.publication?.rootContentId !== expected.publicationRoot) fail('readiness publication root mismatch');
  const publicationOrigin = requirePublicationOrigin(
    manifest.publication?.origin,
    expected.publicationRoot,
    'readiness publication origin',
  );
  if (manifest.publication?.inventoryAlgorithm !== INVENTORY_ALGORITHM) fail('readiness inventory algorithm mismatch');
  if (manifest.publication?.treeDigest !== expected.treeDigest) fail('readiness publication tree digest mismatch');
  if (manifest.publication?.fileCount !== expected.fileCount) fail('readiness publication file count mismatch');
  if (manifest.publication?.bytes !== expected.bytes) fail('readiness publication byte size mismatch');
  if (canonicalJson(manifest.requiredEntrypoints) !== canonicalJson(REQUIRED_ENTRYPOINTS)) {
    fail('readiness required-entrypoint census mismatch');
  }
  requireString(String(manifest.producer?.runId ?? ''), 'readiness producer run id');
  requirePositiveInteger(Number(manifest.producer?.runAttempt), 'readiness producer run attempt');
  if (!Number.isFinite(Date.parse(manifest.createdAt))) fail('readiness createdAt is invalid');

  const publicationIdentity = readJson(publicationIdentityPath, 'publication identity');
  const observedPublicationRoot = requireDigest(publicationIdentity?.rootContentId, 'observed publication identity rootContentId');
  if (observedPublicationRoot !== expected.publicationRoot) {
    fail('publication identity does not match readiness publication root');
  }
  const observedPublicationOrigin = requirePublicationOrigin(
    publicationIdentity?.origin,
    expected.publicationRoot,
    'observed publication identity origin',
  );
  if (observedPublicationOrigin !== publicationOrigin) {
    fail('publication identity origin does not match readiness publication origin');
  }

  return Object.freeze({
    complete: true,
    repository: expected.repository,
    candidateSha: expected.candidateSha,
    planDigest: expected.planDigest,
    publicationOrigin,
    publicationRoot: expected.publicationRoot,
    treeDigest: expected.treeDigest,
    fileCount: expected.fileCount,
    bytes: expected.bytes,
    browserImage: expected.browserImage,
    producer: Object.freeze({
      runId: String(manifest.producer.runId),
      runAttempt: Number(manifest.producer.runAttempt),
    }),
    createdAt: manifest.createdAt,
  });
}

function usage() {
  return 'Usage: node tools/verification/remote-publication-readiness.mjs --manifest FILE --publication-identity FILE --repository OWNER/REPO --candidate-sha SHA --plan-digest sha256:... --publication-root sha256:... --browser-image ID --expected-tree-digest sha256:... --expected-file-count N --expected-bytes N';
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) fail(usage());
    values[flag.slice(2)] = value;
  }
  return values;
}

function cli(argv) {
  const values = parseArgs(argv);
  const result = validateRemoteReadinessMetadata({
    manifestPath: values.manifest,
    publicationIdentityPath: values['publication-identity'],
    repository: values.repository,
    candidateSha: values['candidate-sha'],
    planDigest: values['plan-digest'],
    publicationRoot: values['publication-root'],
    browserImage: values['browser-image'],
    expectedTreeDigest: values['expected-tree-digest'],
    expectedFileCount: Number(values['expected-file-count']),
    expectedBytes: Number(values['expected-bytes']),
  });
  process.stdout.write(canonicalJson(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
