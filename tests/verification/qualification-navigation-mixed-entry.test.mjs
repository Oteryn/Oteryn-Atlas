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
  source: Object.freeze({
    contract_id: 'oteryn-atlas-qualification-fixture-v1',
    capability: 'qualification-semantic-search-v1',
    fixture_id: trust.fixtureId,
    semantic_digest: trust.semanticRoot,
  }),
  records: Object.freeze([Object.freeze({
    capabilities: Object.freeze(['navigation', 'overlay-point']),
    position: Object.freeze({ x: 32280, y: 32156, floor: -7 }),
  })]),
});

test('qualification rewrites the historical mixed-creature entry without dropping comma query state', async () => {
  const input = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=1.04&mode=map&creatures=npc,monster';
  const resolved = await resolveQualificationEntry(input, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => semanticIndex,
  });
  assert.equal(
    resolved,
    '/web/fullworld.html?x=32280&y=32156&floor=-7&zoom=1.04&mode=map&creatures=npc%2Cmonster',
  );
});
