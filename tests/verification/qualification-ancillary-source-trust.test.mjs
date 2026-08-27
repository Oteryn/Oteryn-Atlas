import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCTION_FULLWORLD_TRUST,
  ancillarySourceExpectations,
  resolveQualificationManifestTrust,
} from '../../src/browser/fullworld-trust.mjs';

const id = (digit) => `sha256:${digit.repeat(64)}`;
const fixture = {
  fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture',
  publicationRoot: id('1'), semanticRoot: id('2'), pixelRoot: id('3'), overviewRoot: id('4'), minimapRoot: id('5'),
  runtimeIndexRoot: id('6'), pixelBucketRoot: id('7'), sourceFingerprint: id('8'), productDigest: id('9'),
};

test('production ancillary expectations preserve current Game authorities', () => {
  const source = ancillarySourceExpectations(PRODUCTION_FULLWORLD_TRUST);
  assert.equal(source.mode, 'production');
  assert.equal(source.animation.gameSha, '8f6a4fdea4487a61c4cdaf1889d421ecd2265a31');
  assert.equal(source.creatures.contractId, 'oteryn-game-atlas-export-v1');
  assert.equal(source.semanticSearch.authority, 'Oteryn/Oteryn-Game');
});

test('qualification ancillary expectations are fixture-owned and rooted in the verified product', () => {
  const trust = resolveQualificationManifestTrust(fixture);
  const source = ancillarySourceExpectations(trust);
  assert.equal(source.mode, 'qualification_fixture');
  assert.equal(source.contractId, 'oteryn-atlas-qualification-fixture-v1');
  assert.deepEqual(source.animation, { gameSha: 'fixture', appearanceProductRoot: fixture.pixelRoot, outfitSpatialProductRoot: fixture.semanticRoot });
  assert.equal(source.creatures.semanticDigest, fixture.semanticRoot);
  assert.equal(source.semanticSearch.fixtureId, fixture.fixtureId);
  assert.equal(source.semanticSearch.semanticDigest, fixture.semanticRoot);
  assert.equal(Object.isFrozen(source), true);
});