import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../web/fullworld-search.mjs', import.meta.url), 'utf8');

test('browser semantic and creature search validate through ancillary trust expectations', () => {
  assert.match(source, /FULLWORLD_TRUST/);
  assert.match(source, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/);
  assert.match(source, /validateSemanticSearchIndex\(raw,\s*ancillarySources\.semanticSearch\)/s);
  assert.match(source, /validateCreatureSearchCatalog\(catalog,\s*ancillarySources\.semanticSearch\)/s);
  assert.doesNotMatch(source, /EXPECTED_CREATURE_SEMANTIC_DIGEST/);
});

test('browser search source copy is data-driven rather than hard-coded to Game for fixture records', () => {
  assert.doesNotMatch(source, /Source: Oteryn\/Oteryn-Game@/);
  assert.match(source, /record\.provenance\?\.authority/);
  assert.match(source, /state\.index\.source\.repository/);
});
