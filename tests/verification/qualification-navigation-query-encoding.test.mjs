import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveQualificationEntry } from '../../e2e/tests/qualification-navigation.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const trust = Object.freeze({
  marker: 'oteryn-atlas-qualification-trust-v1',
  fixtureId: 'atlas-qualification-world-v2',
  dataCapability: 'qualification_fixture',
  publicationRoot: digest,
  semanticRoot: digest,
  pixelRoot: digest,
  overviewRoot: digest,
  minimapRoot: digest,
  runtimeIndexRoot: digest,
  pixelBucketRoot: digest,
  sourceFingerprint: digest,
  productDigest: digest,
});
const semanticIndex = Object.freeze({
  schema_version: 1,
  source: Object.freeze({
    authority: 'Oteryn/Oteryn-Atlas',
    repository: 'Oteryn/Oteryn-Atlas',
    contract_id: 'oteryn-atlas-qualification-fixture-v1',
    capability: 'qualification-semantic-search-v1',
    fixture_id: trust.fixtureId,
    semantic_digest: trust.semanticRoot,
    records: 1,
  }),
  records: Object.freeze([Object.freeze({
    kind: 'town',
    id: 'semantic-record:qualification-harbor',
    label: 'Fixture Harbor',
    capabilities: Object.freeze(['navigation', 'overlay-point']),
    position: Object.freeze({ x: 32280, y: 32155, floor: -7 }),
  })]),
});

test('qualification rewrites the shared historical default when an unrelated query value contains a literal comma', async () => {
  const input = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&creatures=npc,monster';
  const resolved = await resolveQualificationEntry(input, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => semanticIndex,
  });
  const url = new URL(resolved, 'http://atlas.invalid');
  assert.equal(url.searchParams.get('x'), '32280');
  assert.equal(url.searchParams.get('y'), '32155');
  assert.equal(url.searchParams.get('floor'), '-7');
  assert.equal(url.searchParams.get('creatures'), 'npc,monster');
});
