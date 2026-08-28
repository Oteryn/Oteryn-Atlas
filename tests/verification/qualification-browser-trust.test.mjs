import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PRODUCTION_FULLWORLD_TRUST, resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';

const trustSource = fs.readFileSync(new URL('../../src/browser/fullworld-trust.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const runtime = fs.readFileSync(new URL('../../e2e/tests/runtime.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const root = (char) => `sha256:${char.repeat(64)}`;
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

test('Playwright never predefines qualification trust after protected web bootstrap promotion', () => {
  const navigation = runtime.indexOf('page.goto');
  const gotoAtlas = /export\s+async\s+function\s+gotoAtlas\s*\([^)]*\)\s*\{/.exec(runtime);
  assert(navigation >= 0, 'Atlas navigation is missing');
  assert(gotoAtlas, 'gotoAtlas export is missing');
  const gotoAtlasStart = gotoAtlas.index;
  const nextExportOffset = runtime.slice(gotoAtlasStart + gotoAtlas[0].length).search(/\n\s*export\s+(?:async\s+)?function\b/);
  assert(nextExportOffset >= 0, 'next exported function after gotoAtlas is missing');
  const gotoAtlasSource = runtime.slice(gotoAtlasStart, gotoAtlasStart + gotoAtlas[0].length + nextExportOffset);
  const resolver = /\bresolveQualificationEntry\s*\(\s*entry\s*,\s*\{/.exec(gotoAtlasSource);
  assert(resolver, 'qualification entry resolution is missing');
  const closingCallParen = (source, callStart) => {
    const openingParen = source.indexOf('(', callStart);
    let depth = 0;
    let quote = null;
    for (let index = openingParen; index < source.length; index += 1) {
      const char = source[index];
      if (quote) {
        if (char.charCodeAt(0) === 92) index += 1;
        else if (char === quote) quote = null;
      } else if (char === "'" || char === '"' || char.charCodeAt(0) === 96) quote = char;
      else if (char === '(') depth += 1;
      else if (char === ')' && --depth === 0) return index + 1;
    }
    return -1;
  };
  const resolverEnd = closingCallParen(gotoAtlasSource, resolver.index);
  assert(resolverEnd > resolver.index, 'qualification entry resolution must have a complete call');
  const resolverSource = gotoAtlasSource.slice(resolver.index, resolverEnd);
  assert.match(resolverSource, /\bqualificationTrustJson\s*:\s*process\.env\.ATLAS_QUALIFICATION_TRUST_JSON\b/);
  const navigationCalls = [...gotoAtlasSource.matchAll(/\bpage\s*\.\s*goto\s*\(/g)];
  assert.equal(navigationCalls.length, 1, 'gotoAtlas must make exactly one navigation');
  const navigationSource = gotoAtlasSource.slice(navigationCalls[0].index);
  assert.match(navigationSource, /^page\s*\.\s*goto\s*\(\s*resolvedEntry\s*(?=,|\))/);
  assert(navigationCalls[0].index > resolverEnd, 'Atlas navigation must occur after qualification entry resolution');
  assert.doesNotMatch(runtime, /page\.addInitScript/);
  assert.doesNotMatch(runtime, /qualificationTrustInstalledPages/);
  assert.doesNotMatch(runtime, /installQualificationTrust/);
  assert.doesNotMatch(runtime, /Object\.defineProperty\(globalThis,\s*['"]__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
  assert.doesNotMatch(runtime, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
});