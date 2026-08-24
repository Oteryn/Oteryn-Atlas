import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildFarmUiReadiness,
  customKillEstimate,
  findSelectedMapMonster,
  searchFarmMonsterTargets,
  validateFarmCreatureCatalog,
} from '../web/fullworld-farm-explorer.mjs';

const DIGEST = 'sha256:81505e91d7089f91e71813ec43f97118932db9cc7fd76d291fa399447ee2dfa4';
const monsterId = `monster-entity:${'a'.repeat(32)}`;
const npcId = `npc-entity:${'b'.repeat(32)}`;
const catalog = () => ({
  schema_version: 1,
  source: {
    contract_id: 'oteryn-game-atlas-export-v1',
    capability: 'static-creatures-v1',
    semantic_digest: DIGEST,
    coordinate_profile: 'oteryn-native-floor-v1',
  },
  records: [
    { kind: 'monster', label: 'Alpha Beast', entity_id: monsterId, record_id: `monster:${'1'.repeat(32)}`, position: { x: 100, y: 200, floor: -7 }, resolution_state: 'RESOLVED' },
    { kind: 'npc', label: 'Alpha NPC', entity_id: npcId, record_id: `npc:${'2'.repeat(32)}`, position: { x: 101, y: 200, floor: -7 }, resolution_state: 'RESOLVED' },
    { kind: 'monster', label: 'Unresolved Beast', record_id: `monster:${'3'.repeat(32)}`, position: { x: 102, y: 200, floor: -7 }, resolution_state: 'UNRESOLVED' },
  ],
});
test('Farm Explorer separates merged map interaction from still-blocked presentation enrichment', () => {
  const readiness = buildFarmUiReadiness({ interactionSeamAvailable: true, presentationSeamAvailable: false });
  assert.equal(readiness.item_task.state, 'UPSTREAM_BLOCKED');
  assert.equal(readiness.map_interaction.state, 'AVAILABLE');
  assert.equal(readiness.presentation_enrichment.state, 'DEPENDENCY_BLOCKED');
  assert.equal(readiness.custom_kill.state, 'AVAILABLE');
  assert.equal(readiness.custom_kill.trust_class, 'ESTIMATE');
});

test('custom monster search returns only resolved Game-owned monster entity identities', () => {
  const records = validateFarmCreatureCatalog(catalog());
  const results = searchFarmMonsterTargets(records, 'alpha', { limit: 10 });
  assert.deepEqual(results.map((record) => record.entity_id), [monsterId]);
  assert.equal(results[0].label, 'Alpha Beast');
});

test('map-selected monster uses canonical creature state even when a farm target already exists', () => {
  const records = validateFarmCreatureCatalog(catalog());
  const params = new URLSearchParams(`creature=${encodeURIComponent(monsterId)}&farmCreature=${encodeURIComponent(`monster-entity:${'f'.repeat(32)}`)}`);
  assert.equal(findSelectedMapMonster(records, params)?.entity_id, monsterId);
});

test('custom kill estimate uses selected-creature progress and explicit time base', () => {
  const estimate = customKillEstimate({ targetKills: 120, kph: 60, timeBase: 'hunt_wall' });
  assert.equal(estimate.state, 'AVAILABLE');
  assert.equal(estimate.estimated_hours, 2);
  assert.equal(estimate.progress_scope, 'selected_creature_kills');
  assert.equal(estimate.time_base, 'hunt_wall');
});

test('Farm Explorer runtime never creates competing creature geometry or hit testing', async () => {
  const source = await readFile(new URL('../web/fullworld-farm-explorer.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['worldToScreen', 'hitTest', 'pointerdown', 'getContext(']) assert.equal(source.includes(forbidden), false, forbidden);
});

test('FullWorld HTML exposes truthful Farm Explorer copy and no fabricated farm facts', async () => {
  const html = await readFile(new URL('../web/fullworld.html', import.meta.url), 'utf8');
  assert.match(html, /id="farm-explorer"/);
  assert.match(html, /Item &amp; Task Explorer/);
  assert.match(html, /Monster drop sources/);
  assert.match(html, /UPSTREAM_BLOCKED/);
  assert.match(html, /Custom kill target/);
  assert.match(html, /VERIFIED FACTS/);
  assert.match(html, /MAP INTERACTION AVAILABLE/);
  assert.match(html, /PRESENTATION DEPENDENCY/);
  assert.match(html, /ESTIMATE/);
  for (const mockValue of ['14.47%', '154 spawns', '~35s', 'Best places to farm']) assert.equal(html.includes(mockValue), false);
});
