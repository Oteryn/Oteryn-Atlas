import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

import { searchSemanticIndex, validateSemanticSearchIndex } from '../../src/browser/semantic-search.mjs';
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

test('fixture queries retain trusted source through semantic and coordinate search', () => {
  const index = validateSemanticSearchIndex(semanticIndex(), expected);
  assert.equal(searchSemanticIndex(index, 'Fixture Harbor', { expectedSource: expected }).results[0].id, 'fixture:harbor');
  const coordinate = searchSemanticIndex(index, '32240 32112 -7', { expectedSource: expected });
  assert.equal(coordinate.mode, 'coordinate');
  assert.deepEqual(coordinate.results[0].position, { x: 32240, y: 32112, floor: -7 });
});

test('query default remains production and rejects fixture self-authorization', () => {
  assert.throws(() => searchSemanticIndex(semanticIndex(), 'Fixture Harbor'), /authority/);
  const production = JSON.parse(fs.readFileSync(new URL('../../web/semantic-search/index.json', import.meta.url)));
  assert.equal(searchSemanticIndex(production, 'Thais').results[0].label, 'Thais');
});

for (const [field, value, error] of [
  ['authority', 'other', /authority/], ['repository', 'other', /authority/],
  ['contract_id', 'other', /contract/], ['capability', 'other', /contract/],
  ['profile_id', 'other', /profile/], ['game_revision', 'other', /revision/],
  ['fixture_id', 'other', /fixture/], ['semantic_digest', hash('b'), /digest/],
]) test(`query rejects fixture source drift: ${field}`, () => {
  const index = semanticIndex(); index.source[field] = value;
  assert.throws(() => searchSemanticIndex(index, 'Fixture Harbor', { expectedSource: expected }), error);
});

test('query revalidates records even after initial fixture acceptance', () => {
  const index = semanticIndex();
  validateSemanticSearchIndex(index, expected);
  index.records[0].position.x = '32280';
  assert.throws(() => searchSemanticIndex(index, 'Fixture Harbor', { expectedSource: expected }), /position/);
});

// Execute the actual browser functions with only their DOM boundary supplied.
// Dropping expectedSource in either call reproduces the real failed user flow.
const browserSource = fs.readFileSync(new URL('../../web/fullworld-search.mjs', import.meta.url), 'utf8');
function browserFunction(name, nextName, context) {
  const start = browserSource.indexOf(`function ${name}(`);
  const end = browserSource.indexOf(`function ${nextName}(`, start);
  assert.ok(start >= 0 && end > start);
  return vm.runInNewContext(`${browserSource.slice(start, end)}; ${name}`, context);
}

test('browser combined search keeps fixture expectations', () => {
  const query = browserFunction('queryAll', 'renderResults', {
    state: { index: semanticIndex(), creatureSearch: [] }, searchSemanticIndex,
    searchCreatureRecords: () => [], resultIdentity: record => record.id,
    MAX_RESULTS: 12, currentFloor: () => -7, SOURCE_EXPECTATIONS: { semanticSearch: expected },
  });
  assert.equal(query('Fixture Harbor')[0].id, 'fixture:harbor');
});

test('browser coordinate submission is not intercepted after fixture validation', () => {
  let submit; let hidden = false; let prevented = false;
  const form = { addEventListener: (type, handler) => { if (type === 'submit') submit = handler; } };
  const input = { value: '32240 32112 -7', setAttribute() {}, addEventListener() {} };
  const wire = browserFunction('wireForm', 'addActiveLayer', {
    document: { querySelector: selector => selector === '#form' ? form : input },
    resultHost: () => ({}), hideResults: () => { hidden = true; }, renderResults() {},
    state: { index: semanticIndex() }, searchSemanticIndex, MAX_RESULTS: 12,
    currentFloor: () => -7, SOURCE_EXPECTATIONS: { semanticSearch: expected },
  });
  wire('#form', '#input', 'desktop');
  submit({ preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(hidden, true);
  assert.equal(prevented, false);
});
