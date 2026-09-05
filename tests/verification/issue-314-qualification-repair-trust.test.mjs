import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';
import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = `sha256:${'1'.repeat(64)}`;

function runProtectedProof(root) {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  const marker = '          cat > "$proof" <<\'NODE\'\n';
  const start = workflow.indexOf(marker);
  assert.ok(start >= 0, 'protected verifier script must exist');
  const end = workflow.indexOf('          NODE', start + marker.length);
  const source = workflow.slice(start + marker.length, end).split('\n').map((line) => line.replace(/^          /, '')).join('\n')
    .replaceAll("'/trusted/", `'${ROOT}/`)
    .replaceAll("'/candidate/", `'${root}/candidate/`)
    .replaceAll("'/out/", `'${root}/out/`)
    .replaceAll("'/product/", `'${root}/product/`)
    .replaceAll("'/product'", `'${root}/product'`)
    .replaceAll("'/trust/", `'${root}/trust/`);
  return spawnSync(process.execPath, ['--input-type=module'], { input: source, encoding: 'utf8', timeout: 10000 });
}

test('candidate builder exiting successfully cannot skip independent protected product verification', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-independent-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidate = path.join(root, 'candidate/tools/verification');
  fs.mkdirSync(candidate, { recursive: true });
  fs.writeFileSync(path.join(candidate, 'qualification-world.mjs'), `
    export async function buildQualificationWorld() { process.exit(0); }
    export function qualificationTrustDescriptor() { throw new Error('unreachable candidate descriptor'); }
  `);
  const result = runProtectedProof(root);
  assert.notEqual(result.status, 0, 'missing rebuilt product must fail even when candidate builder exits 0');
  assert.match(result.stderr, /ENOENT|independently|manifest/);
});

test('fresh protected verifier accepts real product and rejects modified bytes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-fresh-proof-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  await buildQualificationWorld(path.join(root, 'product'));
  fs.mkdirSync(path.join(root, 'trust'));
  const valid = runProtectedProof(root);
  assert.equal(valid.status, 0, valid.stderr);
  const trustPath = path.join(root, 'trust/qualification_fixture.json');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'product/fixture-manifest.json')));
  assert.equal(JSON.parse(fs.readFileSync(trustPath)).productDigest, manifest.productDigest);
  fs.unlinkSync(trustPath);
  fs.appendFileSync(path.join(root, 'product/web/semantic-search/index.json'), '\n');
  const invalid = runProtectedProof(root);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /independently enumerated bytes/);
  assert.equal(fs.existsSync(trustPath), false);
});

function qualificationDescriptor() {
  return Object.freeze({
    marker: 'oteryn-atlas-qualification-trust-v1',
    fixtureId: 'atlas-qualification-world-v2',
    dataCapability: 'qualification_fixture',
    publicationRoot: CONTENT,
    semanticRoot: CONTENT,
    pixelRoot: CONTENT,
    overviewRoot: CONTENT,
    minimapRoot: CONTENT,
    runtimeIndexRoot: CONTENT,
    pixelBucketRoot: CONTENT,
    sourceFingerprint: CONTENT,
    productDigest: CONTENT,
  });
}

test('qualification repair proof validates the actual runtime-trust contract', () => {
  const descriptor = qualificationDescriptor();
  const trust = resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: descriptor });

  assert.equal(descriptor.dataCapability, 'qualification_fixture');
  assert.equal(Object.hasOwn(trust, 'dataCapability'), false);
  assert.equal(trust.qualificationFixtureId, descriptor.fixtureId);
  assert.equal(trust.qualificationProductDigest, descriptor.productDigest);

  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.doesNotMatch(workflow, /trust\.dataCapability/);
  assert.match(workflow, /descriptor\.dataCapability\s*!==\s*'qualification_fixture'/);
  assert.match(workflow, /trust\.qualificationFixtureId\s*!==\s*descriptor\.fixtureId/);
  assert.match(workflow, /trust\.qualificationProductDigest\s*!==\s*independent\.productDigest/);
});

 test('repair digest is independently derived under protected authority', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.match(workflow, /independentlyVerifyQualificationProduct/);
  assert.doesNotMatch(workflow, /verifyQualificationWorld } from '\/candidate/);
});
