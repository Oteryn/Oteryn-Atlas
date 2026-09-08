import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';

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

  for (const field of ['fixtureId', 'productDigest', 'dataCapability']) {
    const invalid = { ...descriptor, [field]: 'untrusted' };
    assert.throws(() => resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: invalid }));
  }
});
