import assert from 'node:assert/strict';
import test from 'node:test';
import { createCreatureGameplayProfileService } from '../../src/browser/creature-gameplay-profiles.mjs';
import { resolveQualificationManifestTrust, resolveBoundedRealManifestTrust } from '../../src/browser/fullworld-trust.mjs';
const rootFields = ['publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot', 'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint', 'productDigest'];
const descriptor = Object.fromEntries(rootFields.map(field => [field, `sha256:${'a'.repeat(64)}`]));
const qualification = resolveQualificationManifestTrust({ ...descriptor, fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture' });
const bounded = resolveBoundedRealManifestTrust({ ...descriptor, fixtureId: 'atlas-bounded-real-world-v1', dataCapability: 'bounded_real_world' });
const entity = `npc-entity:${'1'.repeat(32)}`;
const baseUrl = 'https://atlas.invalid/web/creature-gameplay/';
test('trust-bound synthetic gameplay is explicitly unavailable without network requests', async () => {
  let requests = 0;
  const service = createCreatureGameplayProfileService({ baseUrl, trust: qualification, fetchImpl: async () => { requests++; throw Error('unexpected request'); } });
  assert.deepEqual(await service.get(entity), { status: 'unavailable', reason: 'qualification-profile-intentionally-unavailable' });
  assert.deepEqual(await service.get(entity), { status: 'unavailable', reason: 'qualification-profile-intentionally-unavailable' });
  assert.deepEqual(await service.get('malformed'), { status: 'unavailable', reason: 'invalid-entity-id' });
  assert.equal(requests, 0);
});
for (const [name, trust] of [
  ['wrong fixture', { ...qualification, qualificationFixtureId: 'other' }],
  ['missing product digest', { ...qualification, qualificationProductDigest: undefined }],
  ['bad publication root', { ...qualification, publicationRoot: 'invalid' }],
  ['bad semantic root', { ...qualification, semanticRoot: 'invalid' }],
  ['bounded bad product digest', { ...bounded, boundedRealProductDigest: 'invalid' }],
]) test(`malformed ${name} cannot disable gameplay requests`, () => {
  assert.throws(() => createCreatureGameplayProfileService({ baseUrl, trust, fetchImpl: async () => { throw Error('unexpected network'); } }), /trust invalid/);
});
for (const [name, options] of [['production default', {}], ['bounded', { trust: bounded }]]) {
  test(`${name} still requests canonical manifest and exposes fetch errors`, async () => {
    const requests = [];
    const service = createCreatureGameplayProfileService({ baseUrl, ...options, fetchImpl: async url => { requests.push(String(url)); throw Error('network unavailable'); } });
    assert.deepEqual(await service.get(entity), { status: 'error', reason: 'network unavailable' });
    assert.deepEqual(requests, [baseUrl + 'manifest.json']);
  });
}
