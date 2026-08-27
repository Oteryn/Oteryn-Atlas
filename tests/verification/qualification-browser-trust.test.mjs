import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const trust = fs.readFileSync(new URL('../../src/browser/fullworld-trust.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const runtime = fs.readFileSync(new URL('../../e2e/tests/runtime.mjs', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('production FullWorld trust defaults remain exact and qualification override is explicit', () => {
  assert.match(trust, /PRODUCTION_FULLWORLD_TRUST/);
  assert.match(trust, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
  assert.match(trust, /atlas-qualification-world-v2/);
  assert.match(trust, /oteryn-atlas-qualification-trust-v1/);
  for (const field of ['publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint']) {
    assert.match(trust, new RegExp(`\\b${field}\\b`));
  }
});

test('qualification override fails closed instead of silently falling back to production', () => {
  assert.match(trust, /qualification trust.*invalid|invalid.*qualification trust/i);
  assert.match(trust, /sha256:\[0-9a-f\]\{64\}/);
  assert.match(trust, /Object\.freeze/);
});

test('Playwright injects qualification trust before navigation only when explicitly configured', () => {
  const init = runtime.indexOf('page.addInitScript');
  const navigation = runtime.indexOf('page.goto');
  assert(init >= 0, 'qualification trust init script is missing');
  assert(navigation > init, 'qualification trust must be injected before page.goto');
  assert.match(runtime, /ATLAS_QUALIFICATION_TRUST_JSON/);
  assert.match(runtime, /__OTERYN_ATLAS_QUALIFICATION_TRUST__/);
});
