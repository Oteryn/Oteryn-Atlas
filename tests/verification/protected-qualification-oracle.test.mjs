import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import test from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const oraclePath = 'tools/verification/protected-qualification-oracle.mjs';

const GAMEPLAY_PINS = Object.freeze([
  { path: 'web/creature-gameplay/manifest.json', bytes: 1837, digest: 'sha256:577b40fb5c6dff901f1c3c9e76a1a401bc54f5771affebc0bbe98c9982262202' },
  { path: 'web/creature-gameplay/shards/monster-aa.json', bytes: 648, digest: 'sha256:6167651f21b543888d4b1df962bf2ae94813c7823210b472874bbe9f66d4efa2' },
  { path: 'web/creature-gameplay/shards/npc-11.json', bytes: 663, digest: 'sha256:28c2205766e898c62740acd1092e437ef15b152a4aceac22ea98423880960db9' },
  { path: 'web/creature-gameplay/shards/npc-22.json', bytes: 557, digest: 'sha256:eddad6d57951750f71ca9d44abbc15c4b65c044785ae890f7501363cbe9c9a94' },
  { path: 'web/creature-gameplay/shards/npc-44.json', bytes: 15577, digest: 'sha256:2839ded43ef67c3098fa9a8465127754364c3feded0a935964522a7d9ba537c8' },
  { path: 'web/creature-gameplay/shards/npc-55.json', bytes: 353, digest: 'sha256:6e843dbbfdd4cb96de3a8ab63b7568699dacad19079f245f9a042e660aaf6176' },
]);


function gameplayOracleSource() {
  return `const QUALIFICATION_GAMEPLAY_PINS = Object.freeze(${JSON.stringify(GAMEPLAY_PINS)}.map(Object.freeze));
function verifyQualificationGameplayPins(root) {
  const base = path.join(root, 'web', 'creature-gameplay');
  const actual = [];
  const walk = directory => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name), stat = fs.lstatSync(full);
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) throw new TypeError('qualification gameplay contains nonregular input');
    if (stat.isDirectory()) walk(full); else actual.push(path.relative(root, full).replaceAll(path.sep, '/'));
  } };
  walk(base); actual.sort();
  const expected = QUALIFICATION_GAMEPLAY_PINS.map(pin => pin.path).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new TypeError('qualification gameplay file inventory mismatch');
  for (const pin of QUALIFICATION_GAMEPLAY_PINS) { const bytes = fs.readFileSync(path.join(root, pin.path));
    if (bytes.length !== pin.bytes || sha(bytes) !== pin.digest) throw new TypeError('qualification gameplay pinned byte mismatch: ' + pin.path); }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'web/creature-gameplay/manifest.json'), 'utf8'));
  if (manifest.contract_id !== 'oteryn-atlas-qualification-fixture-v1' || manifest.capability !== 'qualification-creature-gameplay-v1' || manifest.fixture_id !== FIXTURE_ID || manifest.semantic_digest !== 'sha256:79e5814b4b6e1e8b794b90210411687598e21ea33ffffb4ce78ad2ca0cfdd158') throw new TypeError('qualification gameplay identity mismatch');
}
`;
}

// Mechanical source extraction for explicit maintainer regeneration only. This
// is not an admission predicate and is never executed by candidate qualification.
export function oracleEntry(root) {
  const source = fs.readFileSync(path.join(root, 'tools/verification/qualification-world.mjs'), 'utf8');
  const definition = fs.readFileSync(path.join(root, 'tools/verification/qualification-fixture-definition.mjs'), 'utf8');
  const slice = (start, end) => {
    const first = source.indexOf(start), last = end === undefined ? source.length : source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, 'exact verifier source boundary exists');
    return source.slice(first, last);
  };
  const fixture = definition.match(/^export const QUALIFICATION_FIXTURE_ID = ('[^']+');$/m);
  const marker = source.match(/^const QUALIFICATION_TRUST_MARKER = '[^']+';$/m);
  assert.ok(fixture && marker, 'literal verifier identity constants exist');
  const verifier = slice('export function qualificationTrustDescriptor(');
  const gameplayCall = '  await verifyQualificationGameplay(root);\n';
  assert.equal(verifier.split(gameplayCall).length, 2, 'candidate verifier gameplay call exists exactly once');
  return slice('import crypto', 'import {\n  FLOOR_DOMAIN')
    + `const FIXTURE_ID = ${fixture[1]};\n${marker[0]}\n`
    + slice('function sha(', 'function domainRoot(')
    + slice('function productEntries(', 'async function buildPixelPublication(')
    + gameplayOracleSource()
    + verifier.replace(gameplayCall, '  verifyQualificationGameplayPins(root);\n');
}

if (process.argv.includes('--emit-entry')) {
  process.stdout.write(oracleEntry(repository).replaceAll("'../../src/", "'./src/"));
} else if (process.argv.includes('--finalize-bundle')) {
  const source = fs.readFileSync(0, 'utf8');
  const unusedInitializer = 'var FULLWORLD_TRUST = resolveFullWorldTrust();\n';
  assert.equal(source.split(unusedInitializer).length, 2, 'exact unused browser-global initializer exists once');
  process.stdout.write(source.replace(unusedInitializer, ''));
} else {
  const { buildQualificationWorld, verifyQualificationWorld: originalVerify, qualificationTrustDescriptor: originalDescriptor } = await import('../../tools/verification/qualification-world.mjs');
  const oracle = await import('../../tools/verification/protected-qualification-oracle.mjs');
  const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-protected-oracle-'));
  const canonical = value => JSON.stringify(value && typeof value === 'object'
    ? Array.isArray(value) ? value.map(v => JSON.parse(canonical(v))) : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
  const digest = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
  function repinManifest(root) {
    const manifestPath = path.join(root, 'fixture-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const entry of manifest.files) {
      const bytes = fs.readFileSync(path.join(root, entry.path));
      entry.bytes = bytes.length; entry.digest = digest(bytes);
    }
    manifest.productDigest = digest(canonical(manifest.files) + '\n');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  }

  test('protected oracle preserves the existing verifier and trust descriptor for an exact valid product', async () => {
    const parent = temporary(), root = path.join(parent, 'product');
    try {
      await buildQualificationWorld(root);
      assert.deepEqual(await oracle.verifyQualificationWorld(root), await originalVerify(root));
      const verified = await oracle.verifyQualificationWorld(root);
      assert.deepEqual(oracle.qualificationTrustDescriptor(verified), originalDescriptor(verified));
      assert.deepEqual(Object.keys(oracle).sort(), ['qualificationTrustDescriptor', 'verifyQualificationWorld']);
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
  });

  test('protected oracle independently pins mounted qualification gameplay bytes after outer rehash', async () => {
    const parent = temporary(), root = path.join(parent, 'product');
    try {
      await buildQualificationWorld(root);
      const shard = path.join(root, 'web/creature-gameplay/shards/npc-11.json');
      fs.appendFileSync(shard, ' ');
      repinManifest(root);
      await assert.rejects(oracle.verifyQualificationWorld(root), /qualification gameplay pinned byte mismatch/);
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
  });

  test('protected oracle rejects lower-bound and source-oracle substitution even when the product is rehashed', async () => {
    const parent = temporary(), root = path.join(parent, 'product');
    try {
      await buildQualificationWorld(root);
      const manifestPath = path.join(root, 'fixture-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, semanticFloorCount: 1 }));
      await assert.rejects(oracle.verifyQualificationWorld(root), /identity mismatch/);
      fs.writeFileSync(manifestPath, JSON.stringify(manifest));
      const indexPath = path.join(root, 'web/semantic-search/index.json');
      const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      index.source.contract_id = 'candidate-authorizes-own-source';
      fs.writeFileSync(indexPath, JSON.stringify(index));
      repinManifest(root);
      await assert.rejects(oracle.verifyQualificationWorld(root), /source contract/);
      await assert.rejects(originalVerify(root), /source contract/);
    } finally { fs.rmSync(parent, { recursive: true, force: true }); }
  });

  test('mutable world, trust and semantic modules cannot become future protected verifier authority', async () => {
    const root = temporary();
    try {
      const product = path.join(root, 'product');
      await buildQualificationWorld(product);
      const copiedOracle = path.join(root, oraclePath);
      fs.mkdirSync(path.dirname(copiedOracle), { recursive: true });
      fs.copyFileSync(path.join(repository, oraclePath), copiedOracle);
      for (const relative of ['tools/verification/qualification-world.mjs', 'src/browser/fullworld-trust.mjs', 'src/browser/semantic-search.mjs']) {
        const target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, "throw new Error('candidate-controlled verifier module executed');\n");
      }
      const independent = await import(pathToFileURL(copiedOracle).href);
      const original = await independent.verifyQualificationWorld(product);
      assert.equal(independent.qualificationTrustDescriptor(original).dataCapability, 'qualification_fixture');
      const manifestPath = path.join(product, 'fixture-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify({ ...original, runtimeFloorCount: 1 }));
      await assert.rejects(independent.verifyQualificationWorld(product), /identity mismatch/);
      assert.throws(() => independent.qualificationTrustDescriptor({ ...original, fixtureId: 'candidate-fixture' }), /fixture identity/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('protected verifier import does not consult browser global trust', () => {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e',
      "globalThis.__OTERYN_ATLAS_QUALIFICATION_TRUST__ = { marker: 'candidate-global-poison' }; await import(process.argv[1]);",
      pathToFileURL(path.join(repository, oraclePath)).href,
    ], { encoding: 'utf8' });
    assert.equal(result, '');
  });

  test('protected producer uses the immutable oracle while builder remains candidate code', () => {
    const source = fs.readFileSync(path.join(repository, 'tools/verification/run-protected-admission.mjs'), 'utf8');
    assert.equal(source.includes("import { verifyQualificationWorld, qualificationTrustDescriptor } from '/candidate/tools/verification/protected-qualification-oracle.mjs'"), true, 'producer verifier must use protected standalone oracle');
    assert.equal(source.includes("import { buildQualificationWorld } from '/candidate/tools/verification/qualification-world.mjs'"), true, 'builder must remain candidate code');
  });

  test('candidate cannot modify the protected oracle closure through admission', async () => {
    const { validateProtectedAdmissionScope } = await import('../../tools/verification/protected-admission-policy.mjs');
    assert.throws(() => validateProtectedAdmissionScope({
      changedFiles: [{ path: oraclePath, status: 'modified' }], protectedPaths: [oraclePath],
    }), error => error.code === 'ADMISSION_SCOPE_INELIGIBLE');
  });

  test('generated verifier closure imports only Node builtins and excludes product builder code', () => {
    const source = fs.readFileSync(path.join(repository, oraclePath), 'utf8');
    const sourcePins = [...source.matchAll(/^\/\/ Source blob ([a-f0-9]{40}) (.+)$/gm)];
    assert.equal(sourcePins.length, 9, 'generated source-pin inventory recorded');
    for (const [, recordedBlob, relative] of sourcePins) {
      const actualBlob = execFileSync('git', ['-c', `safe.directory=${repository}`, 'rev-parse', `HEAD:${relative}`], { cwd: repository, encoding: 'utf8' }).trim();
      assert.equal(recordedBlob, actualBlob, `recorded source blob drift: ${relative}`);
    }
    const recorded = source.match(/^\/\/ Payload sha256 ([a-f0-9]{64})$/m);
    assert.ok(recorded, 'generated payload identity recorded');
    const payload = source.split('// BEGIN GENERATED ORACLE\n')[1];
    assert.equal(digest(payload), `sha256:${recorded[1]}`);
    const imports = [...source.matchAll(/^import .* from ["']([^"']+)["'];$/gm)].map(match => match[1]);
    assert.deepEqual(imports.sort(), ['node:crypto', 'node:fs', 'node:path']);
    assert.match(source, /QUALIFICATION_GAMEPLAY_PINS/);
    assert.doesNotMatch(source, /\bimport\s*\(|\brequire\s*\(|\bbuildQualificationWorld\s*\(|\bQUALIFICATION_CREATURES\b/);
    const entry = oracleEntry(repository);
    assert.doesNotMatch(entry, /\bbuildQualificationWorld\s*\(|\bQUALIFICATION_CREATURES\b/);
  });
}
