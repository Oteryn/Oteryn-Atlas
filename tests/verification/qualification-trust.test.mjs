import assert from 'node:assert/strict';
import test from 'node:test';

import { PRODUCTION_FULLWORLD_TRUST, resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const fixture = {
  fixtureId: 'atlas-qualification-world-v2',
  dataCapability: 'qualification_fixture',
  publicationRoot: hash('1'),
  semanticRoot: hash('2'),
  pixelRoot: hash('3'),
  overviewRoot: hash('4'),
  minimapRoot: hash('5'),
  runtimeIndexRoot: hash('6'),
  pixelBucketRoot: hash('7'),
  sourceFingerprint: hash('8'),
  productDigest: hash('9'),
};

test('production FullWorld trust remains the default when no qualification manifest is injected', () => {
  assert.equal(resolveFullWorldTrust(), PRODUCTION_FULLWORLD_TRUST);
  assert.equal(PRODUCTION_FULLWORLD_TRUST.gameSha, 'f79fd3b5c239fa13810338f1380539c4eac67d7d');
});

test('explicit qualification manifest maps only content-addressed fixture roots into runtime trust', () => {
  const trust = resolveFullWorldTrust(fixture);
  assert.equal(trust.gameSha, 'fixture');
  assert.equal(trust.publicationRoot, fixture.publicationRoot);
  assert.equal(trust.semanticRoot, fixture.semanticRoot);
  assert.equal(trust.pixelRoot, fixture.pixelRoot);
  assert.equal(trust.overviewRoot, fixture.overviewRoot);
  assert.equal(trust.minimapRoot, fixture.minimapRoot);
  assert.equal(trust.runtimeIndexRoot, fixture.runtimeIndexRoot);
  assert.equal(trust.pixelBucketRoot, fixture.pixelBucketRoot);
  assert.equal(trust.sourceFingerprint, fixture.sourceFingerprint);
  assert.equal(trust.qualificationProductDigest, fixture.productDigest);
  assert(Object.isFrozen(trust));
});

test('qualification trust override fails closed for wrong identity, missing roots or non-content-addressed values', () => {
  assert.throws(() => resolveFullWorldTrust({ ...fixture, fixtureId: 'production' }), /qualification/i);
  assert.throws(() => resolveFullWorldTrust({ ...fixture, minimapRoot: undefined }), /minimapRoot|qualification/i);
  assert.throws(() => resolveFullWorldTrust({ ...fixture, publicationRoot: 'fixture:mutable' }), /publicationRoot|qualification/i);
  assert.throws(() => resolveFullWorldTrust({ ...fixture, dataCapability: 'real_fullworld' }), /qualification/i);
});
