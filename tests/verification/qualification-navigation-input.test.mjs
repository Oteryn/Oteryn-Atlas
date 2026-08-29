import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveQualificationEntry } from '../../e2e/tests/qualification-navigation.mjs';
import {
  buildQualificationWorld,
  qualificationTrustDescriptor,
  verifyQualificationWorld,
} from '../../tools/verification/qualification-world.mjs';

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
const historicalDefault = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map';
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
    default_navigation: Object.freeze({
      contract_id: 'oteryn-atlas-qualification-default-navigation-v1',
      record_id: 'semantic-record:qualification-harbor',
    }),
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
  let reads = 0;
  assert.equal(await resolveQualificationEntry(historicalDefault, {
    qualificationTrustJson: null,
    readSemanticIndex: async () => { reads += 1; throw new Error('unexpected qualification read'); },
  }), historicalDefault);
  assert.equal(reads, 0);

  const bounded = JSON.stringify({
    ...trust,
    marker: 'oteryn-atlas-bounded-real-trust-v1',
    fixtureId: 'atlas-bounded-real-world-v1',
    dataCapability: 'bounded_real_world',
  });
  assert.equal(await resolveQualificationEntry(historicalDefault, {
    qualificationTrustJson: bounded,
    readSemanticIndex: async () => { reads += 1; throw new Error('unexpected qualification read'); },
  }), historicalDefault);
  assert.equal(reads, 0);
});

test('qualification navigation derives only the shared historical default from protected fixture metadata', async () => {
  let reads = 0;
  const resolved = await resolveQualificationEntry(historicalDefault, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => { reads += 1; return semanticIndex; },
  });
  assert.equal(resolved, '/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map');
  assert.equal(reads, 1);
});

test('qualification navigation binds the generated fixture default identity, not the full navigable corpus', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-navigation-'));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    const manifest = await verifyQualificationWorld(root);
    const generatedTrust = qualificationTrustDescriptor(manifest);
    const generatedIndex = JSON.parse(fs.readFileSync(path.join(root, 'web/semantic-search/index.json'), 'utf8'));

    assert.equal(generatedIndex.records.filter((record) => record.capabilities.includes('navigation')).length, 65);
    assert.deepEqual(generatedIndex.source.default_navigation, {
      contract_id: 'oteryn-atlas-qualification-default-navigation-v1',
      record_id: 'semantic-record:qualification-harbor',
    });

    const resolved = await resolveQualificationEntry(historicalDefault, {
      qualificationTrustJson: JSON.stringify(generatedTrust),
      readSemanticIndex: async () => generatedIndex,
    });
    assert.equal(resolved, '/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map');

    const withoutDefaultIdentity = { ...generatedIndex, source: { ...generatedIndex.source } };
    delete withoutDefaultIdentity.source.default_navigation;
    await assert.rejects(
      resolveQualificationEntry(historicalDefault, {
        qualificationTrustJson: JSON.stringify(generatedTrust),
        readSemanticIndex: async () => withoutDefaultIdentity,
      }),
      /default navigation identity mismatch/i,
    );

    const defaultRecord = generatedIndex.records.find((record) => record.id === generatedIndex.source.default_navigation.record_id);
    assert.ok(defaultRecord, 'generated default navigation record must exist');
    await assert.rejects(
      resolveQualificationEntry(historicalDefault, {
        qualificationTrustJson: JSON.stringify(generatedTrust),
        readSemanticIndex: async () => ({ ...generatedIndex, records: [...generatedIndex.records, defaultRecord] }),
      }),
      /exactly one default navigation record/i,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('qualification navigation preserves absolute host, query state, and hash after historical-default rewrite', async () => {
  const input = 'http://atlas-web:8080/web/fullworld.html?mode=auto&x=32369&y=32241&floor=-7&zoom=0.25&semantic=fixture#details';
  const resolved = await resolveQualificationEntry(input, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => semanticIndex,
  });
  assert.equal(resolved, 'http://atlas-web:8080/web/fullworld.html?mode=auto&x=32280&y=32155&floor=-7&zoom=0.25&semantic=fixture#details');
});

test('qualification navigation accepts only canonical raw FullWorld route forms before parsing', async () => {
  const httpsDefault = 'https://atlas-web:8080/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2';
  assert.equal(await resolveQualificationEntry(httpsDefault, {
    qualificationTrustJson: JSON.stringify(trust),
    readSemanticIndex: async () => semanticIndex,
  }), 'https://atlas-web:8080/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2');

  const inputs = [
    '/web/a/../fullworld.html?x=32369&y=32241&floor=-7',
    'web/fullworld.html?x=32369&y=32241&floor=-7',
    'javascript:/web/fullworld.html?x=32369&y=32241&floor=-7',
    'http://atlas-web:8080/web/a/../fullworld.html?x=32369&y=32241&floor=-7',
    'https://not-atlas.example/web/fullworld.html?x=32369&y=32241&floor=-7',
    '/web/fullworld.html?x=32369&y=32241&floor=-7&mode=~',
    '/web/fullworld.html?x=32369&y=32241&floor=-7&mode=żółw',
    '/web/fullworld.html?x=32369&y=32241&floor=-7#żółw',
    'http://user@atlas-web:8080/web/fullworld.html?x=32369&y=32241&floor=-7',
    'http://atlas-web:80/web/fullworld.html?x=32369&y=32241&floor=-7',
    'https://atlas-web:443/web/fullworld.html?x=32369&y=32241&floor=-7',
  ];
  let reads = 0;
  for (const input of inputs) {
    assert.equal(await resolveQualificationEntry(input, {
      qualificationTrustJson: JSON.stringify(trust),
      readSemanticIndex: async () => { reads += 1; throw new Error('unexpected qualification read'); },
    }), input);
  }
  assert.equal(reads, 0);
});

test('nonmatching qualification routes remain byte-for-byte caller-owned without semantic reads', async () => {
  const inputs = [
    '/web/fullworld.html?x=32369&x=32369&y=32241&floor=-7',
    '/web/fullworld.html?x=32369&y=32241&y=32241&floor=-7',
    '/web/fullworld.html?x=32369&y=32241&floor=-7&floor=-7',
    '/web/fullworld.html?x=32370&y=32241&floor=-7&semantic=NAVIGATION_B',
    '/web/fullworld.html?x=32369&y=32241&floor=-6&zoom=2',
    '/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map',
    '/web/fullworld.html?x=32390&y=32260&floor=-7&zoom=2&mode=map',
    '/web/fullworld.html?x=32312&y=32155&floor=-7&zoom=2&mode=map',
    '/web/fullworld.html?x=32280&y=32155&floor=-6&zoom=2&mode=map',
    '/web/fullworld.html?x=100&y=200&floor=7&mode=map',
    '/web/fullworld.html?x=&y=32241&floor=-7',
    '/web/not-fullworld.html?x=32369&y=32241&floor=-7',
    'http://[',
  ];
  let reads = 0;
  for (const input of inputs) {
    assert.equal(await resolveQualificationEntry(input, {
      qualificationTrustJson: JSON.stringify(trust),
      readSemanticIndex: async () => { reads += 1; throw new Error('unexpected qualification read'); },
    }), input);
  }
  assert.equal(reads, 0);
});

test('qualification navigation fails closed on unbound or ambiguous fixture metadata', async () => {
  await assert.rejects(
    resolveQualificationEntry(historicalDefault, {
      qualificationTrustJson: JSON.stringify(trust),
      readSemanticIndex: async () => ({
        ...semanticIndex,
        source: { ...semanticIndex.source, semantic_digest: `sha256:${'b'.repeat(64)}` },
      }),
    }),
    /semantic root mismatch/i,
  );
  await assert.rejects(
    resolveQualificationEntry(historicalDefault, {
      qualificationTrustJson: JSON.stringify(trust),
      readSemanticIndex: async () => ({ ...semanticIndex, records: [...semanticIndex.records, semanticIndex.records[0]] }),
    }),
    /exactly one default navigation record/i,
  );
  await assert.rejects(
    resolveQualificationEntry(historicalDefault, {
      qualificationTrustJson: JSON.stringify({ ...trust, semanticRoot: 'not-a-digest' }),
      readSemanticIndex: async () => semanticIndex,
    }),
    /semanticRoot/i,
  );
});
