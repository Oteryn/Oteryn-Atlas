import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../../web/fullworld-creatures.mjs', import.meta.url), 'utf8');

test('creature overlay validates publication source through ancillary trust contract', () => {
  assert.match(source, /validateCreaturePublicationSource/);
  assert.match(source, /validateCreaturePublicationSource\(index\.source,\s*state\.animationRuntime\.manifest\.source,\s*ancillarySources\.creatures\)/s);
  assert.doesNotMatch(source, /EXPECTED_SEMANTIC_DIGEST/);
  assert.doesNotMatch(source, /EXPECTED_CONTRACT/);
  assert.doesNotMatch(source, /EXPECTED_CAPABILITY/);
});
