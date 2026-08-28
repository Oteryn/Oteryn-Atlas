import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ancillarySourceExpectations,
  resolveBoundedRealManifestTrust,
  resolveFullWorldTrust,
} from '../../src/browser/fullworld-trust.mjs';

const root = (char) => `sha256:${char.repeat(64)}`;
const descriptor = Object.freeze({
  marker: 'oteryn-atlas-bounded-real-trust-v1',
  fixtureId: 'atlas-bounded-real-world-v1',
  dataCapability: 'bounded_real_world',
  publicationRoot: root('1'),
  semanticRoot: root('2'),
  pixelRoot: root('3'),
  overviewRoot: root('4'),
  minimapRoot: root('5'),
  runtimeIndexRoot: root('6'),
  pixelBucketRoot: root('7'),
  sourceFingerprint: root('8'),
  productDigest: root('9'),
});

test('bounded-real trust preserves synthetic map roots while requiring real ancillary contracts', () => {
  const trust = resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: descriptor });
  assert.equal(trust.boundedRealFixtureId, descriptor.fixtureId);
  assert.equal(trust.boundedRealProductDigest, descriptor.productDigest);
  assert.equal(trust.gameSha, 'fixture');
  const ancillary = ancillarySourceExpectations(trust);
  assert.equal(ancillary.mode, 'bounded_real_world');
  assert.equal(ancillary.animation.gameSha, 'fixture');
  assert.equal(ancillary.creatures.contractId, 'oteryn-atlas-bounded-real-runtime-v1');
  assert.equal(ancillary.creatures.capability, 'bounded-real-creatures-v1');
  assert.equal(ancillary.semanticSearch.authority, 'Oteryn/Oteryn-Game');
  assert.equal(ancillary.semanticSearch.contractId, 'oteryn-game-atlas-export-v1');
  assert.equal(ancillary.semanticSearch.creatureCapability, 'static-creatures-v1');
});

test('bounded-real manifest trust accepts the manifest identity without the runtime marker', () => {
  const { marker: _marker, ...manifestIdentity } = descriptor;
  const trust = resolveBoundedRealManifestTrust(manifestIdentity);
  assert.equal(trust.boundedRealFixtureId, descriptor.fixtureId);
  assert.equal(trust.publicationRoot, descriptor.publicationRoot);
});

test('bounded-real trust fails closed for capability, fixture, roots, missing fields and extras', () => {
  const malformed = [
    { ...descriptor, dataCapability: 'qualification_fixture' },
    { ...descriptor, fixtureId: 'atlas-qualification-world-v2' },
    { ...descriptor, publicationRoot: 'not-a-root' },
    Object.fromEntries(Object.entries(descriptor).filter(([key]) => key !== 'productDigest')),
    { ...descriptor, extra: true },
  ];
  for (const value of malformed) {
    assert.throws(() => resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: value }), /qualification trust invalid/i);
  }
});
