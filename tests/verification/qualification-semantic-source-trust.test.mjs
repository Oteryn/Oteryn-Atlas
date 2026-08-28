import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCreatureSearchCatalog } from '../../src/browser/creature-search.mjs';
import { validateSemanticSearchIndex } from '../../src/browser/semantic-search.mjs';
import { ancillarySourceExpectations, resolveQualificationManifestTrust } from '../../src/browser/fullworld-trust.mjs';

const hash = (digit) => `sha256:${digit.repeat(64)}`;
const trust = resolveQualificationManifestTrust({
  fixtureId: 'atlas-qualification-world-v2', dataCapability: 'qualification_fixture',
  publicationRoot: hash('1'), semanticRoot: hash('2'), pixelRoot: hash('3'), overviewRoot: hash('4'),
  minimapRoot: hash('5'), runtimeIndexRoot: hash('6'), pixelBucketRoot: hash('7'), sourceFingerprint: hash('8'), productDigest: hash('9'),
});
const expected = ancillarySourceExpectations(trust).semanticSearch;
function semanticIndex() {
  return {
    schema_version: 1,
    source: { authority: expected.authority, repository: expected.repository, contract_id: expected.contractId, capability: expected.capability, profile_id: expected.profileId, game_revision: 'fixture', semantic_digest: expected.semanticDigest, fixture_id: expected.fixtureId },
    index_digest: hash('a'), input_floor_aliases: { '-7': -7 },
    ranking: { exact_id: 1100, exact_label: 1000, exact_alias: 900, prefix_id: 850, prefix_label: 800, prefix_alias: 700, contains_label: 600, contains_alias: 500 },
    records: [{ kind: 'town', id: 'fixture:harbor', label: 'Fixture Harbor', aliases: [], capabilities: ['navigation'], provenance: { authority: 'Oteryn/Oteryn-Atlas', source_capability: 'qualification-semantic-search-v1' }, position: { x: 32280, y: 32155, floor: -7 }, bounds: null, search_terms: { label: 'fixture harbor', aliases: [] } }],
  };
}
function creatureCatalog() {
  return {
    schema_version: 1,
    source: { contract_id: expected.creatureContractId, capability: expected.creatureCapability, coordinate_profile: 'oteryn-native-floor-v1', semantic_digest: expected.creatureSemanticDigest, fixture_id: expected.fixtureId },
    records: [{ kind: 'npc', label: 'Fixture Guide', record_id: 'npc:11111111111111111111111111111111', entity_id: 'npc-entity:11111111111111111111111111111111', position: { x: 32280, y: 32155, floor: -7 }, resolution_state: 'RESOLVED', provenance: { authority: 'Oteryn/Oteryn-Atlas', source_capability: 'qualification-creatures-v1' } }],
  };
}
test('semantic search accepts fixture-owned index only under qualification expectations', () => {
  const index = validateSemanticSearchIndex(semanticIndex(), expected);
  assert.equal(index.source.authority, 'Oteryn/Oteryn-Atlas');
  assert.equal(index.source.game_revision, 'fixture');
  assert.equal(index.source.fixture_id, 'atlas-qualification-world-v2');
});

test('semantic search production default rejects fixture-owned index', () => {
  assert.throws(() => validateSemanticSearchIndex(semanticIndex()), /authority|contract|revision/i);
});

test('creature search catalog binds qualification contract, digest and fixture identity', () => {
  const catalog = validateCreatureSearchCatalog(creatureCatalog(), expected);
  assert.equal(catalog.records[0].provenance.authority, 'Oteryn/Oteryn-Atlas');
  assert.throws(() => validateCreatureSearchCatalog({ ...creatureCatalog(), source: { ...creatureCatalog().source, fixture_id: 'other' } }, expected), /fixture/i);
});
