import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalogPath = path.join(ROOT, 'tools/verification/verification-catalog.json');
const impactPath = path.join(ROOT, 'tools/verification/impact-manifest.json');
const fullSafetyCensusPath = path.join(ROOT, 'tools/verification/full-safety-net-stable-ids.json');

const RETAINED_LEGACY_SPECIALIST_IDS = Object.freeze([
  'desktop-chromium::e2e/tests/api-contract-desktop.spec.mjs::browser search diagnostics match published semantic API contracts',
  'desktop-chromium::e2e/tests/api-contract-desktop.spec.mjs::published API records render unchanged through browser search',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop PARTIAL shop never becomes an authoritative empty claim',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop Rat direct activation renders exact Loot Stats and placement-backed Spawns',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop real large shop stays bounded at 100 rendered rows',
  'desktop-chromium::e2e/tests/creature-gameplay-desktop.spec.mjs::desktop Sam direct activation opens exact Gameplay shop, preserves Semantic, and round-trips URL state',
  'desktop-chromium::e2e/tests/fullworld-animation-census-desktop.spec.mjs::published creature animation product passes the full authoritative coverage census',
  'mobile-chromium::e2e/tests/creature-gameplay-mobile.spec.mjs::mobile Rat direct tap renders exact loot stats and keeps topmost Escape behavior',
  'mobile-chromium::e2e/tests/creature-gameplay-mobile.spec.mjs::mobile Sam direct tap reaches readable Gameplay trade data and tabs',
]);

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function retainedLegacyRunnerStableTestIds() {
  const ordinary = readJson(fullSafetyCensusPath).stableTestIds;
  return [...new Set([...ordinary, ...RETAINED_LEGACY_SPECIALIST_IDS])].sort();
}

test('legacy transition plan binds every stable ID executed by its retained full runner', () => {
  const stableTestIds = retainedLegacyRunnerStableTestIds();
  const catalog = readJson(catalogPath);
  const impact = readJson(impactPath);
  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: '.github/workflows/legacy-molehill-transition-qualification.yml' }],
    trustedImpactManifest: impact,
    candidateImpactManifest: impact,
    trustedVerificationCatalog: catalog,
    candidateVerificationCatalog: catalog,
    stableTestIds,
    requiredGroupFloor: ['deterministic.core', 'e2e.full', 'fullworld.animation-census', 'integration.source-contract-browser'],
  });

  assert.deepEqual(plan.requiredGroupFloor, ['deterministic.core', 'e2e.full', 'fullworld.animation-census', 'integration.source-contract-browser']);
  assert.deepEqual(plan.stableTestIds, stableTestIds,
    'the status validator requires an exact plan-to-summary census, not a lower bound');
  assert.deepEqual(plan.requiredDataCapabilities,
    ['bounded_real_world', 'qualification_fixture', 'real_fullworld']);
  assert.equal(plan.requiresRealFullWorld, true);
});

test('retained full-run census serializes without platform shell loss and rejects duplicate identities', async () => {
  const {parsePlaywrightStableTestIds}=await import('../../tools/verification/parse-playwright-test-list.mjs');
  const row='  [desktop-chromium] › desktop.spec.mjs:1:1 › exact Unicode α evidence';
  const ids=parsePlaywrightStableTestIds(row);
  assert.deepEqual(JSON.parse(Buffer.from(JSON.stringify(ids),'utf8').toString('utf8')),ids);
  assert.equal(ids.length,1);assert.match(ids[0],/Unicode α evidence$/);
  assert.throws(()=>parsePlaywrightStableTestIds(row+'\n'+row),/duplicate/);
});
