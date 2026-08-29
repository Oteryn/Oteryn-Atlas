import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PRODUCTION_FULLWORLD_TRUST, resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';

const trustSource = fs.readFileSync(new URL('../../src/browser/fullworld-trust.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const runtime = fs.readFileSync(new URL('../../e2e/tests/runtime.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const root = (char) => `sha256:${char.repeat(64)}`;
const PLAYWRIGHT_EXPECT_IMPORT = "import { expect } from '@playwright/test';";
const QUALIFICATION_NAVIGATION_IMPORT = "import { resolveQualificationEntry } from './qualification-navigation.mjs';";

function replaceExactlyOnce(source, expected, replacement) {
  const first = source.indexOf(expected);
  assert.notEqual(first, -1, `expected runtime import is missing: ${expected}`);
  assert.equal(source.indexOf(expected, first + expected.length), -1, `runtime import is ambiguous: ${expected}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + expected.length)}`;
}

async function loadGotoAtlasForContract() {
  const qualificationNavigationUrl = new URL('../../e2e/tests/qualification-navigation.mjs', import.meta.url);
  assert.equal(qualificationNavigationUrl.protocol, 'file:');
  const expectShim = [
    "import assert from 'node:assert/strict';",
    'const expect = (actual, message) => ({',
    '  not: { toBeNull: () => assert.notEqual(actual, null, message) },',
    '  toBeTruthy: () => assert.equal(Boolean(actual), true, message),',
    '  toBe: (expected) => assert.equal(actual, expected, message),',
    '});',
  ].join('\n');
  let source = replaceExactlyOnce(runtime, PLAYWRIGHT_EXPECT_IMPORT, expectShim);
  source = replaceExactlyOnce(
    source,
    QUALIFICATION_NAVIGATION_IMPORT,
    `import { resolveQualificationEntry } from ${JSON.stringify(qualificationNavigationUrl.href)};`,
  );
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
  return (await import(moduleUrl)).gotoAtlas;
}

const descriptor = Object.freeze({
  marker: 'oteryn-atlas-qualification-trust-v1',
  fixtureId: 'atlas-qualification-world-v2',
  dataCapability: 'qualification_fixture',
  publicationRoot: root('1'),
  semanticRoot: root('2'),
  pixelRoot: root('3'),
  overviewRoot: root('4'),
  minimapRoot: root('5'),
  runtimeIndexRoot: root('6'),
  pixelBucketRoot: root('7'),
  sourceFingerprint: root('8'),
  productDigest: root('9'),
});

test('production FullWorld trust remains the exact default without an override', () => {
  assert.equal(resolveFullWorldTrust({}), PRODUCTION_FULLWORLD_TRUST);
  assert.equal(Object.isFrozen(PRODUCTION_FULLWORLD_TRUST), true);
  assert.match(PRODUCTION_FULLWORLD_TRUST.gameSha, /^[0-9a-f]{40}$/);
  assert.match(PRODUCTION_FULLWORLD_TRUST.minimapRoot, /^sha256:[0-9a-f]{64}$/);
});

test('qualification override is explicit, immutable and retains every fixture identity root', () => {
  const resolved = resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: descriptor });
  assert.equal(resolved.gameSha, 'fixture');
  assert.equal(resolved.qualificationFixtureId, descriptor.fixtureId);
  assert.equal(resolved.qualificationProductDigest, descriptor.productDigest);
  for (const field of ['publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot', 'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint']) {
    assert.equal(resolved[field], descriptor[field]);
  }
  assert.equal(Object.isFrozen(resolved), true);
});

test('qualification override fails closed instead of silently falling back to production', () => {
  const malformed = [
    { ...descriptor, marker: 'wrong' },
    { ...descriptor, fixtureId: 'other-fixture' },
    { ...descriptor, dataCapability: 'real_fullworld' },
    { ...descriptor, semanticRoot: 'not-a-root' },
    Object.fromEntries(Object.entries(descriptor).filter(([key]) => key !== 'minimapRoot')),
    Object.fromEntries(Object.entries(descriptor).filter(([key]) => key !== 'productDigest')),
    { ...descriptor, extra: true },
  ];
  for (const candidate of malformed) {
    assert.throws(() => resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: candidate }), /qualification trust invalid/i);
  }
  assert.match(trustSource, /sha256:\[0-9a-f\]\{64\}/);
});

test('Playwright resolves qualification navigation before the only Atlas navigation', async () => {
  const originalTrustJson = process.env.ATLAS_QUALIFICATION_TRUST_JSON;
  const originalExpectedRevision = process.env.ATLAS_EXPECTED_REVISION;
  const semanticIndex = {
    source: {
      fixture_id: descriptor.fixtureId,
      semantic_digest: descriptor.semanticRoot,
      contract_id: 'oteryn-atlas-qualification-fixture-v1',
      capability: 'qualification-semantic-search-v1',
      default_navigation: {
        contract_id: 'oteryn-atlas-qualification-default-navigation-v1',
        record_id: 'semantic-record:qualification-harbor',
      },
    },
    records: [{
      id: 'semantic-record:qualification-harbor',
      capabilities: ['navigation'],
      position: { x: 101, y: 202, floor: -3 },
    }],
  };
  const navigations = [];
  const events = [];
  const page = {
    request: {
      get: async (url) => {
        assert.equal(url, '/web/semantic-search/index.json');
        return {
          ok: () => true,
          status: () => 200,
          json: async () => {
            events.push('semantic-index-complete');
            return semanticIndex;
          },
        };
      },
    },
    goto: async (...args) => {
      events.push('goto');
      navigations.push(args);
      return { ok: () => true, status: () => 200, headers: () => ({}) };
    },
  };
  process.env.ATLAS_QUALIFICATION_TRUST_JSON = JSON.stringify(descriptor);
  delete process.env.ATLAS_EXPECTED_REVISION;
  try {
    const gotoAtlas = await loadGotoAtlasForContract();
    await gotoAtlas(page, '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map');
    assert.deepEqual(events, ['semantic-index-complete', 'goto']);
    assert.deepEqual(navigations, [[
      '/web/fullworld.html?x=101&y=202&floor=-3&zoom=2&mode=map',
      { waitUntil: 'domcontentloaded' },
    ]]);
  } finally {
    if (originalTrustJson === undefined) delete process.env.ATLAS_QUALIFICATION_TRUST_JSON;
    else process.env.ATLAS_QUALIFICATION_TRUST_JSON = originalTrustJson;
    if (originalExpectedRevision === undefined) delete process.env.ATLAS_EXPECTED_REVISION;
    else process.env.ATLAS_EXPECTED_REVISION = originalExpectedRevision;
  }
  assert.doesNotMatch(runtime, /page\s*\.\s*addInitScript/);
  assert.doesNotMatch(runtime, /qualificationTrustInstalledPages/);
  assert.doesNotMatch(runtime, /installQualificationTrust/);
  assert.doesNotMatch(runtime, /Object\s*\.\s*defineProperty\s*\(\s*globalThis\s*,\s*['"]__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
  assert.doesNotMatch(runtime, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
});
