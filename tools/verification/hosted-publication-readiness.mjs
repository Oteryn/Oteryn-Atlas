import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA256 = /^sha256:[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;

export const READINESS_SCHEMA_VERSION = 1;
export const INVENTORY_ALGORITHM = 'atlas-publication-tree-v1';
export const REQUIRED_ENTRYPOINTS = Object.freeze([
  'fullworld/animation/manifest.json',
  'fullworld/minimap/world.json',
  'fullworld/overview/world.json',
  'fullworld/pixel-buckets/manifest.json',
  'fullworld/publication/publication.json',
  'fullworld/runtime-index/world.json',
]);

function fail(message) {
  throw new Error(`hosted publication readiness: ${message}`);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
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

function relativePortable(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function hashFile(file) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    while (true) {
      const read = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (read === 0) break;
      hash.update(buffer.subarray(0, read));
    }
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${hash.digest('hex')}`;
}

function walk(root, current, records) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    const relative = relativePortable(root, absolute);
    if (entry.isSymbolicLink()) fail(`symbolic links are forbidden in publication input: ${relative}`);
    if (entry.isDirectory()) {
      walk(root, absolute, records);
      continue;
    }
    if (!entry.isFile()) fail(`non-regular publication entry is forbidden: ${relative}`);
    const stat = fs.statSync(absolute);
    records.push(Object.freeze({ path: relative, bytes: stat.size, sha256: hashFile(absolute) }));
  }
}

export function inventoryPublication(rootInput) {
  const root = path.resolve(requireString(rootInput, 'publication root'));
  let stat;
  try {
    stat = fs.statSync(root);
  } catch {
    fail(`publication root does not exist: ${root}`);
  }
  if (!stat.isDirectory()) fail(`publication root is not a directory: ${root}`);

  for (const relative of REQUIRED_ENTRYPOINTS) {
    const absolute = path.join(root, ...relative.split('/'));
    let entryStat;
    try {
      entryStat = fs.lstatSync(absolute);
    } catch {
      fail(`required publication entrypoint is missing: ${relative}`);
    }
    if (!entryStat.isFile() || entryStat.isSymbolicLink()) fail(`required publication entrypoint is not a regular file: ${relative}`);
  }

  const records = [];
  walk(root, root, records);
  const fileCount = records.length;
  const bytes = records.reduce((sum, record) => sum + record.bytes, 0);
  if (fileCount === 0 || bytes === 0) fail('publication inventory is empty');
  const treeDigest = `sha256:${crypto.createHash('sha256').update(canonicalJson({ algorithm: INVENTORY_ALGORITHM, files: records })).digest('hex')}`;
  return Object.freeze({ root, fileCount, bytes, treeDigest, records: Object.freeze(records) });
}

function publicationIdentity(root) {
  const file = path.join(root, 'fullworld', 'publication', 'publication.json');
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot parse publication identity: ${error.message}`);
  }
  return requireDigest(value?.rootContentId, 'publication rootContentId');
}

function validateExpectedInventory(inventory, expected) {
  requireDigest(expected.treeDigest, 'expected tree digest');
  requirePositiveInteger(expected.fileCount, 'expected file count');
  requirePositiveInteger(expected.bytes, 'expected byte size');
  if (inventory.treeDigest !== expected.treeDigest) fail(`publication tree digest mismatch: ${inventory.treeDigest} != ${expected.treeDigest}`);
  if (inventory.fileCount !== expected.fileCount) fail(`publication file count mismatch: ${inventory.fileCount} != ${expected.fileCount}`);
  if (inventory.bytes !== expected.bytes) fail(`publication byte size mismatch: ${inventory.bytes} != ${expected.bytes}`);
}

function atomicWriteJson(outputInput, value) {
  const output = path.resolve(requireString(outputInput, 'readiness output'));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const payload = canonicalJson(value);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, payload, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, output);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    fs.rmSync(temporary, { force: true });
    throw error;
  }
  return output;
}

export function attestPublication({
  root,
  output,
  repository,
  candidateSha,
  planDigest,
  producerRunId,
  producerRunAttempt,
  publicationRoot,
  browserImage,
  expectedTreeDigest,
  expectedFileCount,
  expectedBytes,
  createdAt = new Date().toISOString(),
}) {
  requireString(repository, 'repository');
  requireCommitSha(candidateSha, 'candidate SHA');
  requireDigest(planDigest, 'plan digest');
  requireString(String(producerRunId ?? ''), 'producer run id');
  requirePositiveInteger(Number(producerRunAttempt), 'producer run attempt');
  requireDigest(publicationRoot, 'expected publication root');
  requireString(browserImage, 'browser image identity');
  if (!Number.isFinite(Date.parse(createdAt))) fail('createdAt must be an ISO-compatible timestamp');

  const inventory = inventoryPublication(root);
  validateExpectedInventory(inventory, {
    treeDigest: expectedTreeDigest,
    fileCount: Number(expectedFileCount),
    bytes: Number(expectedBytes),
  });
  const actualPublicationRoot = publicationIdentity(inventory.root);
  if (actualPublicationRoot !== publicationRoot) fail(`publication root identity mismatch: ${actualPublicationRoot} != ${publicationRoot}`);

  const manifest = Object.freeze({
    schemaVersion: READINESS_SCHEMA_VERSION,
    complete: true,
    repository,
    candidateSha,
    planDigest,
    producer: Object.freeze({ runId: String(producerRunId), runAttempt: Number(producerRunAttempt) }),
    publication: Object.freeze({
      rootContentId: publicationRoot,
      inventoryAlgorithm: INVENTORY_ALGORITHM,
      treeDigest: inventory.treeDigest,
      fileCount: inventory.fileCount,
      bytes: inventory.bytes,
    }),
    browserImage,
    requiredEntrypoints: REQUIRED_ENTRYPOINTS,
    createdAt,
  });
  atomicWriteJson(output, manifest);
  return manifest;
}

export function verifyReadiness({
  root,
  manifestPath,
  repository,
  candidateSha,
  planDigest,
  publicationRoot,
  browserImage,
}) {
  const expected = {
    repository: requireString(repository, 'repository'),
    candidateSha: requireCommitSha(candidateSha, 'candidate SHA'),
    planDigest: requireDigest(planDigest, 'plan digest'),
    publicationRoot: requireDigest(publicationRoot, 'expected publication root'),
    browserImage: requireString(browserImage, 'browser image identity'),
  };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.resolve(requireString(manifestPath, 'readiness manifest')), 'utf8'));
  } catch (error) {
    fail(`cannot read readiness manifest: ${error.message}`);
  }
  if (manifest?.schemaVersion !== READINESS_SCHEMA_VERSION || manifest?.complete !== true) fail('readiness manifest is incomplete or unsupported');
  if (manifest.repository !== expected.repository) fail('readiness repository mismatch');
  if (manifest.candidateSha !== expected.candidateSha) fail('readiness candidate SHA mismatch');
  if (manifest.planDigest !== expected.planDigest) fail('readiness plan digest mismatch');
  if (manifest.browserImage !== expected.browserImage) fail('readiness browser image mismatch');
  if (manifest.publication?.rootContentId !== expected.publicationRoot) fail('readiness publication root mismatch');
  if (manifest.publication?.inventoryAlgorithm !== INVENTORY_ALGORITHM) fail('readiness inventory algorithm mismatch');
  if (canonicalJson(manifest.requiredEntrypoints) !== canonicalJson(REQUIRED_ENTRYPOINTS)) fail('readiness required-entrypoint census mismatch');
  requireString(String(manifest.producer?.runId ?? ''), 'readiness producer run id');
  requirePositiveInteger(Number(manifest.producer?.runAttempt), 'readiness producer run attempt');

  const inventory = inventoryPublication(root);
  validateExpectedInventory(inventory, {
    treeDigest: manifest.publication?.treeDigest,
    fileCount: manifest.publication?.fileCount,
    bytes: manifest.publication?.bytes,
  });
  const actualPublicationRoot = publicationIdentity(inventory.root);
  if (actualPublicationRoot !== expected.publicationRoot) fail('publication identity changed after readiness attestation');
  return Object.freeze({ manifest, inventory });
}

function usage() {
  return `Usage:\n  node tools/verification/hosted-publication-readiness.mjs attest --root DIR --output FILE --repository OWNER/REPO --candidate-sha SHA --plan-digest sha256:... --producer-run-id ID --producer-run-attempt N --publication-root sha256:... --browser-image ID --expected-tree-digest sha256:... --expected-file-count N --expected-bytes N\n  node tools/verification/hosted-publication-readiness.mjs verify --root DIR --manifest FILE --repository OWNER/REPO --candidate-sha SHA --plan-digest sha256:... --publication-root sha256:... --browser-image ID\n`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!['attest', 'verify'].includes(command)) fail(usage().trim());
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) fail(`invalid CLI arguments\n${usage().trim()}`);
    values[flag.slice(2)] = value;
  }
  return { command, values };
}

function cli(argv) {
  const { command, values } = parseArgs(argv);
  if (command === 'attest') {
    const manifest = attestPublication({
      root: values.root,
      output: values.output,
      repository: values.repository,
      candidateSha: values['candidate-sha'],
      planDigest: values['plan-digest'],
      producerRunId: values['producer-run-id'],
      producerRunAttempt: Number(values['producer-run-attempt']),
      publicationRoot: values['publication-root'],
      browserImage: values['browser-image'],
      expectedTreeDigest: values['expected-tree-digest'],
      expectedFileCount: Number(values['expected-file-count']),
      expectedBytes: Number(values['expected-bytes']),
    });
    process.stdout.write(canonicalJson(manifest));
    return;
  }
  const result = verifyReadiness({
    root: values.root,
    manifestPath: values.manifest,
    repository: values.repository,
    candidateSha: values['candidate-sha'],
    planDigest: values['plan-digest'],
    publicationRoot: values['publication-root'],
    browserImage: values['browser-image'],
  });
  process.stdout.write(canonicalJson({ complete: true, treeDigest: result.inventory.treeDigest }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
