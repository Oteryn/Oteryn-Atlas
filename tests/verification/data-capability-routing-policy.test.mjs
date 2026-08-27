import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url), 'utf8'));
const impact = JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url), 'utf8'));

function plan(path) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path }],
    trustedImpactManifest: impact,
    candidateImpactManifest: impact,
    verificationCatalog: catalog,
  });
}

test('full verification governance remains qualification-fixture capable after protected v2 migration', () => {
  const result = plan('tools/verification/build-verification-plan.mjs');
  assert.equal(result.profile, 'full');
  assert.equal(result.requiresRealFullWorld, false);
  assert.deepEqual(result.requiredDataCapabilities, ['qualification_fixture']);
  assert(result.requiredGroupIds.includes('e2e.full'));
  assert(!result.requiredGroupIds.includes('fullworld.animation-census'));
});

test('complete FullWorld tooling does not request real bytes without a complete-product oracle', () => {
  const result = plan('tools/fullworld-runtime/build_runtime_index.py');
  assert.equal(result.profile, 'broad');
  assert.equal(result.requiresRealFullWorld, false);
  assert.deepEqual(result.requiredDataCapabilities, ['qualification_fixture']);
});

test('animation product changes explicitly request the real FullWorld census', () => {
  const result = plan('tools/animation-runtime/build.py');
  assert.equal(result.requiresRealFullWorld, true);
  assert.deepEqual(result.requiredDataCapabilities, ['qualification_fixture', 'real_fullworld']);
  assert(result.requiredGroupIds.includes('fullworld.animation-census'));
});

test('real source compatibility stays bounded and independent from full verification profile', () => {
  const result = plan('web/semantic-search/index.json');
  assert.equal(result.requiresRealFullWorld, false);
  assert.deepEqual(result.requiredDataCapabilities, ['bounded_real_world', 'qualification_fixture']);
  assert(result.requiredGroupIds.includes('integration.source-contract'));
});
