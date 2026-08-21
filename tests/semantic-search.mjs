import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SemanticSearchError,
  displayFloor,
  navigationSearchParams,
  searchSemanticIndex,
  validateSemanticSearchIndex,
} from '../src/browser/semantic-search.mjs';

const index = {
  schema_version: 1,
  source: {
    authority: 'Oteryn/Oteryn-Game', repository: 'Oteryn/Oteryn-Game', game_revision: '1'.repeat(40),
    contract_id: 'oteryn-game-atlas-export-v1', capability: 'semantic-search-source-v1',
    profile_id: 'oteryn-game-atlas-semantic-search-v1', semantic_digest: `sha256:${'2'.repeat(64)}`,
  },
  input_floor_aliases: { '7': -7, '8': -8 },
  ranking: { exact_id: 1100, exact_label: 1000, exact_alias: 900, prefix_id: 850, prefix_label: 800, prefix_alias: 700, contains_label: 600, contains_alias: 500 },
  kind_filters: ['npc', 'town'],
  by_kind: { npc: ['npc:sam', 'npc:samuel'], town: ['town:thais'] },
  records: [
    { kind: 'npc', id: 'npc:sam', label: 'Sam', aliases: [], position: { x: 32361, y: 32198, floor: -7 }, bounds: null, provenance: { authority: 'Oteryn/Oteryn-Game' }, capabilities: ['shop'], search_terms: { label: 'sam', aliases: [] } },
    { kind: 'npc', id: 'npc:samuel', label: 'Samuel', aliases: ['Sammy'], position: { x: 32000, y: 32000, floor: -7 }, bounds: null, provenance: { authority: 'Oteryn/Oteryn-Game' }, capabilities: [], search_terms: { label: 'samuel', aliases: ['sammy'] } },
    { kind: 'town', id: 'town:thais', label: 'Thais', aliases: [], position: { x: 32369, y: 32241, floor: -7 }, bounds: null, provenance: { authority: 'Oteryn/Oteryn-Game' }, capabilities: ['navigation'], search_terms: { label: 'thais', aliases: [] } },
  ],
  counts: { records: 3, kinds: 2 },
  index_digest: `sha256:${'3'.repeat(64)}`,
};

test('validates the Game-derived semantic index', () => {
  assert.equal(validateSemanticSearchIndex(index), index);
});

test('coordinate parser uses Game-published floor aliases', () => {
  const result = searchSemanticIndex(index, '32369 32220 7');
  assert.equal(result.mode, 'coordinate');
  assert.deepEqual(result.results[0].position, { x: 32369, y: 32220, floor: -7 });
  assert.equal(result.results[0].label, '32369, 32220, 7');
});

test('entity ranking keeps exact Sam ahead of Samuel', () => {
  const result = searchSemanticIndex(index, 'Sam');
  assert.equal(result.results[0].id, 'npc:sam');
  assert.ok(result.results[0].score > result.results[1].score);
});

test('town search returns Thais', () => {
  const result = searchSemanticIndex(index, 'Thais');
  assert.equal(result.results[0].kind, 'town');
  assert.deepEqual(result.results[0].position, { x: 32369, y: 32241, floor: -7 });
});

test('type filtering supports npc:Sam', () => {
  const result = searchSemanticIndex(index, 'npc:Sam');
  assert.equal(result.results.length, 2);
  assert.ok(result.results.every((record) => record.kind === 'npc'));
  assert.equal(result.results[0].id, 'npc:sam');
});

test('identifier lookup uses exported stable id only', () => {
  const result = searchSemanticIndex(index, 'id:npc:sam');
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].label, 'Sam');
});

test('navigation preserves native floor and activates creature layer', () => {
  const params = navigationSearchParams(index.records[0], '?mode=auto&layers=minimap-overview', index, 'npc:Sam');
  assert.equal(params.get('x'), '32361');
  assert.equal(params.get('y'), '32198');
  assert.equal(params.get('floor'), '-7');
  assert.equal(params.get('selected'), '-7:32361:32198');
  assert.equal(params.get('semantic'), 'npc:sam');
  assert.equal(params.get('creatures'), 'npc');
  assert.equal(displayFloor(-7, index), 7);
});

test('duplicate ids fail closed', () => {
  const bad = structuredClone(index);
  bad.records.push(structuredClone(bad.records[0]));
  assert.throws(() => validateSemanticSearchIndex(bad), SemanticSearchError);
});
