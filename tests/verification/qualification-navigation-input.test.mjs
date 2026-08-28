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

test('production and bounded-real navigation stay caller-owned', async () => {
  const input = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map';
  let reads = 0;
  assert.equal(await resolveQualificationEntry(input, {
    qualificationTrustJson: null,
    readSemanticIndex: async () => { reads += 1; throw new Error('unexpected qualification read'); },
  }), input);
  assert.equal(reads, 0);

  const bounded = JSON.stringify({ ...trust, marker: 'oteryn-atlas-bounded-real-trust-v1', fixtureId: 'atlas-bounded-real-world-v1', dataCapability: 'bounded_real_world' });
  assert.equal(await resolveQualificationEntry(input, {
    qualificationTrustJson: bounded,
    readSemanticIndex: async () => { reads += 1; throw new Error('unexpected qualification read'); },
  }), input);
  assert.equal(reads, 0);
});

test('qualification navigation derives its entry from the protected published semantic record', async () => {
  const input = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map';
  const resolved = await resolveQualificationEntry(input, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => semanticIndex,
  });
  assert.equal(resolved, '/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map');
});

test('qualification navigation preserves non-coordinate route state', async () => {
  const input = 'http://atlas-web:8080/web/fullworld.html?x=1&y=2&floor=3&zoom=0.25&mode=auto&semantic=fixture';
  const resolved = await resolveQualificationEntry(input, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => semanticIndex,
  });
  assert.equal(resolved, 'http://atlas-web:8080/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=0.25&mode=auto&semantic=fixture');
});

test('qualification navigation fails closed on unbound or ambiguous fixture metadata', async () => {
  await assert.rejects(
    resolveQualificationEntry('/web/fullworld.html', {
      qualificationTrustJson: JSON.stringify(trust),
      readSemanticIndex: async () => ({ ...semanticIndex, source: { ...semanticIndex.source, semantic_digest: `sha256:${'b'.repeat(64)}` } }),
    }),
    /semantic root mismatch/i,
  );
  await assert.rejects(
    resolveQualificationEntry('/web/fullworld.html', {
      qualificationTrustJson: JSON.stringify(trust),
      readSemanticIndex: async () => ({ ...semanticIndex, records: [...semanticIndex.records, semanticIndex.records[0]] }),
    }),
    /exactly one navigable record/i,
  );
  await assert.rejects(
    resolveQualificationEntry('/web/fullworld.html', {
      qualificationTrustJson: JSON.stringify({ ...trust, semanticRoot: 'not-a-digest' }),
      readSemanticIndex: async () => semanticIndex,
    }),
    /semanticRoot/i,
  );
});
