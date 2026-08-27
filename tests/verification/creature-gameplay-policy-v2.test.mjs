import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const catalog = JSON.parse(fs.readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url), 'utf8'));
const impact = JSON.parse(fs.readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url), 'utf8'));

function planFor(path) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40), integrationBaseSha: 'b'.repeat(40), mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path }],
    trustedImpactManifest: impact, candidateImpactManifest: impact,
    trustedVerificationCatalog: catalog, candidateVerificationCatalog: catalog,
  });
}

test('creature gameplay runtime selects bounded real-world compatibility without FullWorld', () => {
  const plan = planFor('src/browser/creature-gameplay-model.mjs');
  assert.ok(plan.requiredGroupIds.includes('integration.creature-gameplay'));
  assert.ok(plan.requiredDataCapabilities.includes('bounded_real_world'));
  assert.equal(plan.requiresRealFullWorld, false);
});