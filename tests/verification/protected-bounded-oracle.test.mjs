import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const oraclePath = 'tools/verification/protected-bounded-oracle.mjs';
export function oracleEntry(root) {
  const source = fs.readFileSync(path.join(root, 'tools/verification/bounded-real-world.mjs'), 'utf8');
  const alias = 'export function boundedRealTrustDescriptor(manifest) { return boundedTrustDescriptor(manifest); }';
  assert.equal(source.split(alias).length, 2);
  return source.replace(/^export const /gm, 'const ').replace(alias, 'export { boundedTrustDescriptor };');
}
export function finalizeBundle(source) {
  const initializer = 'var FULLWORLD_TRUST = resolveFullWorldTrust();\n';
  assert.equal(source.split(initializer).length, 2, 'exact unused browser-global initializer exists once');
  return source.replace(initializer, '');
}
if (process.argv.includes('--emit-entry')) {
  process.stdout.write(oracleEntry(repository).replaceAll("'../../src/", "'./src/"));
} else if (process.argv.includes('--finalize-bundle')) {
  process.stdout.write(finalizeBundle(fs.readFileSync(0, 'utf8')));
} else {
  const original = await import('../../tools/verification/bounded-real-world.mjs');
  const oracle = await import('../../tools/verification/protected-bounded-oracle.mjs');
  const temporary = () => fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-bounded-oracle-'));
  test('frozen bounded builder preserves exact protected source product and registry identity', async () => {
    const root = temporary();
    try {
      const baseline = await original.buildBoundedRealWorld(path.join(root, 'original'), { sourceRoot: repository });
      const actual = await oracle.buildBoundedRealWorld(path.join(root, 'frozen'), { sourceRoot: repository });
      assert.deepEqual(actual, baseline);
      const registry = JSON.parse(fs.readFileSync(path.join(repository, 'tools/verification/protected-hosted-product-identities.json')));
      assert.equal(actual.productDigest, registry.bounded_real_world.digest);
      assert.deepEqual(await oracle.verifyBoundedRealWorld(path.join(root, 'frozen')), await original.verifyBoundedRealWorld(path.join(root, 'original')));
      assert.deepEqual(oracle.boundedTrustDescriptor(actual), original.boundedRealTrustDescriptor(actual));
      assert.deepEqual(Object.keys(oracle).sort(), ['boundedTrustDescriptor', 'buildBoundedRealWorld', 'verifyBoundedRealWorld']);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test('standalone authority ignores poisoned mutable builder and dependency modules', async () => {
    const root = temporary();
    try {
      const target = path.join(root, oraclePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(repository, oraclePath), target);
      const source = fs.readFileSync(target, 'utf8');
      for (const [, relative] of source.matchAll(/^\/\/ Source blob [a-f0-9]{40} (.+)$/gm)) {
        const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "throw new Error('mutable candidate authority executed');\n");
      }
      const frozen = await import(pathToFileURL(target).href);
      const product = path.join(root, 'product');
      const built = await frozen.buildBoundedRealWorld(product, { sourceRoot: repository });
      assert.deepEqual(await frozen.verifyBoundedRealWorld(product), built);
      const manifest = path.join(product, 'bounded-real-manifest.json');
      for (const changes of [{ mapAuthority: true }, { fixtureId: 'self-authorized' }, { dataCapability: 'qualification_fixture' }, { productDigest: 'sha256:' + '0'.repeat(64) }]) {
        fs.writeFileSync(manifest, JSON.stringify({ ...built, ...changes }));
        await assert.rejects(frozen.verifyBoundedRealWorld(product), /identity mismatch|digest mismatch/);
      }
      fs.writeFileSync(manifest, JSON.stringify(built));
      fs.appendFileSync(path.join(product, built.files[0].path), 'tamper');
      await assert.rejects(frozen.verifyBoundedRealWorld(product), /digest mismatch/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test('frozen bounded oracle import ignores candidate browser global trust', () => {
    assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', "globalThis.__OTERYN_ATLAS_QUALIFICATION_TRUST__ = { marker: 'poison' }; await import(process.argv[1]);", pathToFileURL(path.join(repository, oraclePath)).href], { encoding: 'utf8' }), '');
  });
  test('frozen bounded closure has pinned payload and only builtin dependencies', () => {
    const source = fs.readFileSync(path.join(repository, oraclePath), 'utf8');
    const payload = source.split('// BEGIN GENERATED ORACLE\n')[1];
    assert.equal(crypto.createHash('sha256').update(payload).digest('hex'), source.match(/^\/\/ Payload sha256 ([a-f0-9]{64})$/m)[1]);
    assert.deepEqual([...payload.matchAll(/^import .* from ["']([^"']+)["'];$/gm)].map(m => m[1]).sort(), ['node:crypto', 'node:fs', 'node:path']);
    assert.doesNotMatch(payload, /\bimport\s*\(|\brequire\s*\(/);
    const pins = [...source.matchAll(/^\/\/ Source blob ([a-f0-9]{40}) (.+)$/gm)];
    assert.ok(pins.length > 10, 'complete source closure recorded');
    assert.equal(new Set(pins.map(pin => pin[2])).size, pins.length, 'source paths are unique');
    assert.ok(pins.some(pin => pin[2] === 'tools/verification/bounded-real-world.mjs'));
    // Pins locate original authority for explicit regeneration. Do not compare
    // them to mutable current source: legal future product repairs may change it.

  });
  test('admission cannot modify frozen bounded authority', async () => {
    const { validateProtectedAdmissionScope } = await import('../../tools/verification/protected-admission-policy.mjs');
    assert.throws(() => validateProtectedAdmissionScope({ changedFiles: [{ path: oraclePath, status: 'modified' }], protectedPaths: [oraclePath] }), error => error.code === 'ADMISSION_SCOPE_INELIGIBLE');
  });
}
