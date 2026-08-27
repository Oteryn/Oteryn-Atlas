import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCreaturePublicationSource } from '../../src/browser/creature-publication-source.mjs';
import { ancillarySourceExpectations, resolveQualificationManifestTrust } from '../../src/browser/fullworld-trust.mjs';

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const trust = resolveQualificationManifestTrust({
  fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture',
  publicationRoot: hash('1'), semanticRoot: hash('2'), pixelRoot: hash('3'), overviewRoot: hash('4'),
  minimapRoot: hash('5'), runtimeIndexRoot: hash('6'), pixelBucketRoot: hash('7'), sourceFingerprint: hash('8'), productDigest: hash('9'),
});
const ancillary = ancillarySourceExpectations(trust);
function fixtureSource() {
  return {
    contract_id: ancillary.creatures.contractId,
    capability: ancillary.creatures.capability,
    semantic_digest: ancillary.creatures.semanticDigest,
    npc_role_schema_version: ancillary.creatures.npcRoleSchemaVersion,
    fixture_id: ancillary.creatures.fixtureId,
    appearance_product_root: ancillary.animation.appearanceProductRoot,
    outfit_spatial_product_root: ancillary.animation.outfitSpatialProductRoot,
  };
}
const animationSource = () => ({
  appearance_product_root: ancillary.animation.appearanceProductRoot,
  outfit_spatial_product_root: ancillary.animation.outfitSpatialProductRoot,
});
test('qualification creature source is accepted only under qualification expectations', () => {
  const source = validateCreaturePublicationSource(fixtureSource(), animationSource(), ancillary.creatures);
  assert.equal(source.contract_id, 'oteryn-atlas-qualification-fixture-v1');
  assert.equal(source.fixture_id, 'atlas-qualification-world-v2');
});

test('qualification creature source rejects production expectations and mismatched animation linkage', () => {
  const production = ancillarySourceExpectations().creatures;
  assert.throws(() => validateCreaturePublicationSource(fixtureSource(), animationSource(), production), /contract|capability|semantic/i);
  assert.throws(() => validateCreaturePublicationSource(fixtureSource(), { ...animationSource(), appearance_product_root: hash('a') }, ancillary.creatures), /appearance root/i);
});

test('qualification creature source requires exact fixture identity', () => {
  assert.throws(() => validateCreaturePublicationSource({ ...fixtureSource(), fixture_id: 'other' }, animationSource(), ancillary.creatures), /fixture/i);
});
