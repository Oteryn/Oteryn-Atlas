import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCTION_FULLWORLD_TRUST,
  resolveFullWorldTrust,
  resolveQualificationManifestTrust,
} from '../../src/browser/fullworld-trust.mjs';

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

test('production FullWorld trust remains the default when no qualification descriptor is injected', () => {
  assert.equal(resolveFullWorldTrust({}), PRODUCTION_FULLWORLD_TRUST);
  assert.equal(PRODUCTION_FULLWORLD_TRUST.gameSha, 'f79fd3b5c239fa13810338f1380539c4eac67d7d');
});
test('explicit qualification manifest maps only content-addressed fixture roots into runtime trust', () => {
  const trust = resolveQualificationManifestTrust(fixture);
  assert.equal(trust.gameSha, 'fixture');
  for (const field of ['publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot', 'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint']) {
    assert.equal(trust[field], fixture[field]);
  }
  assert.equal(trust.qualificationProductDigest, fixture.productDigest);
  assert.equal(trust.qualificationFixtureId, fixture.fixtureId);
  assert(Object.isFrozen(trust));
});

test('qualification manifest trust fails closed for wrong identity, missing roots or non-content-addressed values', () => {
  assert.throws(() => resolveQualificationManifestTrust({ ...fixture, fixtureId: 'production' }), /qualification/i);
  assert.throws(() => resolveQualificationManifestTrust({ ...fixture, minimapRoot: undefined }), /minimapRoot|qualification/i);
  assert.throws(() => resolveQualificationManifestTrust({ ...fixture, publicationRoot: 'fixture:mutable' }), /publicationRoot|qualification/i);
  assert.throws(() => resolveQualificationManifestTrust({ ...fixture, dataCapability: 'real_fullworld' }), /qualification/i);
});
