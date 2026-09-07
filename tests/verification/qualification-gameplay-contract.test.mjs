import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  GAMEPLAY_EXPECTATIONS,
  QUALIFICATION_GAMEPLAY_EXPECTATIONS,
  createCreatureGameplayProfileService,
  validateCreatureGameplayManifest,
} from '../../src/browser/creature-gameplay-profiles.mjs';
import { qualificationGameplayFixture } from '../../e2e/support/qualification-gameplay.mjs';
import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

function fetcher(files) {
  return async (url) => {
    const pathname = new URL(url).pathname;
    const marker = '/creature-gameplay/';
    const offset = pathname.indexOf(marker);
    const relative = offset < 0 ? null : pathname.slice(offset + marker.length);
    const data = relative ? files.get(relative) : null;
    if (!data) return new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } });
    return new Response(data, {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': String(data.byteLength) },
    });
  };
}

test('qualification gameplay manifest has explicit non-Game authority and validates fail-closed', async () => {
  const fixture = qualificationGameplayFixture();
  const manifest = await validateCreatureGameplayManifest(fixture.manifest, {
    expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS,
    expectedSemanticDigest: fixture.manifest.semantic_digest,
  });
  assert.equal(manifest.contract_id, 'oteryn-atlas-qualification-fixture-v1');
  assert.equal(manifest.fixture_id, 'atlas-qualification-world-v2');
  assert.equal(Object.hasOwn(manifest, 'producer_repository_sha'), false);
  await assert.rejects(
    () => validateCreatureGameplayManifest(fixture.manifest, { expectations: GAMEPLAY_EXPECTATIONS }),
    /unsupported field|missing producer_repository_sha/,
  );
  await assert.rejects(
    () => validateCreatureGameplayManifest({ ...fixture.manifest, fixture_id: 'wrong-fixture' }, { expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS }),
    /qualification fixture mismatch/,
  );
});

test('qualification gameplay service loads synthetic NPC and large-shop profiles through normal manifest/shard path', async () => {
  const fixture = qualificationGameplayFixture();
  const service = createCreatureGameplayProfileService({
    baseUrl: 'https://qualification.invalid/web/creature-gameplay/',
    fetchImpl: fetcher(fixture.files),
    expectations: QUALIFICATION_GAMEPLAY_EXPECTATIONS,
    expectedSemanticDigest: fixture.manifest.semantic_digest,
  });
  const guide = await service.get(`npc-entity:${'1'.repeat(32)}`);
  assert.equal(guide.status, 'ready');
  assert.equal(guide.profile.name, 'Fixture Guide');
  assert.equal(guide.profile.shop.sells[0].item_name, 'Fixture Rope');

  const large = await service.get(`npc-entity:${'4'.repeat(32)}`);
  assert.equal(large.status, 'ready');
  assert.equal(large.profile.shop.sells.length, 124);
  assert.equal(large.profile.shop.sells.at(-1).item_name, 'Fixture Bulk Item 124');
});

test('gameplay impact routing executes both functional fixture and bounded source-contract coverage', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../tools/verification/verification-catalog.json', import.meta.url), 'utf8'));
  const impact = JSON.parse(readFileSync(new URL('../../tools/verification/impact-manifest.json', import.meta.url), 'utf8'));

  const creatureSpecs = catalog.groups['e2e.creatures'].specs;
  assert.ok(creatureSpecs.includes('e2e/tests/creature-gameplay-desktop.spec.mjs'));
  assert.ok(creatureSpecs.includes('e2e/tests/creature-gameplay-mobile.spec.mjs'));
  assert.equal(catalog.groups['e2e.creatures'].capabilities.dataCapability, 'qualification_fixture');

  const gameplayRule = impact.entries.find((entry) => entry.pathPrefix === 'src/browser/creature-gameplay-profiles.mjs');
  assert.ok(gameplayRule, 'gameplay runtime requires a dedicated impact rule');
  assert.ok(gameplayRule.requiredGroups.includes('integration.source-contract'));
  assert.equal(catalog.groups['integration.source-contract'].capabilities.dataCapability, 'bounded_real_world');
  assert.ok(catalog.groups['integration.source-contract'].specs.includes('e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs'));

  const sourceSpecRule = impact.entries.find((entry) => entry.pathPrefix === 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs');
  assert.ok(sourceSpecRule, 'source-contract spec requires an explicit impact rule');
  assert.ok(sourceSpecRule.requiredGroups.includes('integration.source-contract'));

  const plan = buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: 'src/browser/creature-gameplay-profiles.mjs' }],
    trustedImpactManifest: impact,
    candidateImpactManifest: impact,
    verificationCatalog: catalog,
  });
  assert.equal(plan.requiresRealFullWorld, false);
  assert.deepEqual(plan.requiredDataCapabilities, ['bounded_real_world', 'qualification_fixture']);
  assert.ok(plan.requiredGroupIds.includes('e2e.creatures'));
  assert.ok(plan.requiredGroupIds.includes('integration.source-contract'));
});
