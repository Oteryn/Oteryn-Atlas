import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {buildVerificationPlan} from '../tools/verification/build-verification-plan.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = name => JSON.parse(fs.readFileSync(path.join(root, 'tools/verification', name), 'utf8'));
const catalog = readJson('verification-catalog.json');
const impact = readJson('impact-manifest.json');
const inventory = readJson('protected-scenario-inventory.json');
const revision = 'a'.repeat(40);

function plan(pathname) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: revision,
    integrationBaseSha: revision,
    mergeBaseSha: revision,
    changedFiles: [{path: pathname, status: 'modified'}],
    trustedImpactManifest: impact,
    candidateImpactManifest: impact,
    verificationCatalog: catalog,
    protectedStableTestIds: inventory.stableTestIds,
  });
}

test('search UI changes preserve fixture, bounded-real, and independent visual obligations', () => {
  const result = plan('web/fullworld-search.mjs');
  assert.deepEqual(result.requiredGroupIds, [
    'e2e.search-navigation',
    'e2e.visual-presentation',
    'integration.source-contract-browser',
    'review.visual-desktop',
    'review.visual-mobile',
  ]);
  assert.deepEqual(result.requiredDataCapabilities, ['bounded_real_world', 'qualification_fixture']);
  assert.deepEqual(result.requiredVisualGroupIds, ['review.visual-desktop', 'review.visual-mobile']);
  assert.equal(result.requiresRealFullWorld, false);
});

test('Farm Explorer protected specs remain a minimal fixture-only browser route', () => {
  for (const pathname of [
    'e2e/tests/farm-explorer-desktop.spec.mjs',
    'e2e/tests/farm-explorer-mobile.spec.mjs',
  ]) {
    const result = plan(pathname);
    assert.deepEqual(result.requiredGroupIds, ['e2e.farm-explorer']);
    assert.deepEqual(result.requiredDataCapabilities, ['qualification_fixture']);
    assert.deepEqual(result.requiredVisualGroupIds, []);
    assert.equal(result.requiresRealFullWorld, false);
  }
});
