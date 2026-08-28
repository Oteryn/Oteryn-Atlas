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
  const gotoAtlasStart = runtime.indexOf('export async function gotoAtlas');
  const nextExport = runtime.indexOf('\nexport ', gotoAtlasStart + 1);
  assert(navigation >= 0, 'Atlas navigation is missing');
  assert(gotoAtlasStart >= 0 && nextExport > gotoAtlasStart, 'gotoAtlas source bounds are missing');
  const gotoAtlasSource = runtime.slice(gotoAtlasStart, nextExport);
  const resolver = /resolveQualificationEntry\s*\(\s*entry\s*,\s*\{[\s\S]*?\bqualificationTrustJson\s*:\s*process\.env\.ATLAS_QUALIFICATION_TRUST_JSON\b[\s\S]*?\}\s*\)/.exec(gotoAtlasSource);
  assert(resolver, 'qualification trust input must be bound while resolving the entry');
  const resolverBinding = gotoAtlasSource.indexOf('qualificationTrustJson', resolver.index);
  const navigationCalls = [...gotoAtlasSource.matchAll(/\bpage\s*\.\s*goto\s*\(\s*([A-Za-z_$][\w$]*)\b/g)];
  assert.equal(navigationCalls.length, 1, 'gotoAtlas must make exactly one navigation');
  assert.equal(navigationCalls[0][1], 'resolvedEntry', 'Atlas navigation must use the resolved qualification entry');
  assert(navigationCalls[0].index > resolverBinding, 'Atlas navigation must occur after qualification entry resolution');
  assert.doesNotMatch(runtime, /page\.addInitScript/);
  assert.doesNotMatch(runtime, /qualificationTrustInstalledPages/);
  assert.doesNotMatch(runtime, /installQualificationTrust/);
  assert.doesNotMatch(runtime, /Object\.defineProperty\(globalThis,\s*['"]__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
  assert.doesNotMatch(runtime, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
});