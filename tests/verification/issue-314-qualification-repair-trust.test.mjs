import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = `sha256:${'1'.repeat(64)}`;

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

