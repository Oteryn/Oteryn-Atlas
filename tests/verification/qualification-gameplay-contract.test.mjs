import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAMEPLAY_EXPECTATIONS,
  QUALIFICATION_GAMEPLAY_EXPECTATIONS,
  createCreatureGameplayProfileService,
  validateCreatureGameplayManifest,
} from '../../src/browser/creature-gameplay-profiles.mjs';
import { qualificationGameplayFixture } from '../../e2e/support/qualification-gameplay.mjs';

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
