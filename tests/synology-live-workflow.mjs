import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectDynamicCreatureTargets, validateGameplayPublication } from '../tools/verification/deployment-execution-contract.mjs';
const livePreview = readFileSync(new URL('../e2e/tests/live-creature-preview.cjs', import.meta.url), 'utf8');

function targets() {
  const row = (id, kind) => ({ record_id: id, kind, roles: ['shop'], presentation_resolution_state: 'RESOLVED', outfit_presentation: { outfit_presentation_id: 'animated' } });
  return { expectedDynamicCount: 1, programs: { creature_programs: [{ outfit_presentation_id: 'animated', phase_count: 2, phase_content_ids: ['a', 'b'] }] }, creatures: { npcs: [row('npc', 'npc')], monster_spawns: [row('monster', 'monster')] }, search: { records: [row('npc', 'npc'), row('monster', 'monster')] } };
}
test('live fixture selection requires resolved visually dynamic published programs and exact search identity', () => {
  const value = targets();
  assert.equal(selectDynamicCreatureTargets(value).npc.record_id, 'npc');
  assert.equal(selectDynamicCreatureTargets(value).monster.record_id, 'monster');
  for (const mutate of [v => { v.programs.creature_programs[0].phase_content_ids = ['a', 'a']; }, v => { v.creatures.npcs[0].roles = []; }, v => { v.creatures.npcs[0].presentation_resolution_state = 'UNRESOLVED'; }, v => { v.search.records.pop(); }, v => { v.search.records.push(v.search.records[0]); }]) {
    const changed = structuredClone(value); mutate(changed); assert.throws(() => selectDynamicCreatureTargets(changed), /deployment/);
  }
});
test('gameplay acceptance binds exact Game revision digest and complete profile counts', () => {
  const expected = { gameRevision: 'a'.repeat(40), semanticDigest: `sha256:${'b'.repeat(64)}` };
  const manifest = { capability: 'creature-gameplay-profiles-v1', producer_repository_sha: expected.gameRevision, semantic_digest: expected.semanticDigest, counts: { monster_profiles: 1800, npc_profiles: 1049, referenced_items: 0 } };
  assert.equal(validateGameplayPublication(manifest, expected), manifest);
  for (const patch of [{ producer_repository_sha: 'c'.repeat(40) }, { semantic_digest: `sha256:${'d'.repeat(64)}` }, { counts: { npc_profiles: 1049 } }]) assert.throws(() => validateGameplayPublication({ ...manifest, ...patch }, expected), /gameplay/);
});

test('retained live Chromium entrypoint binds Sam trade and Rat loot assertions', () => {
  assert.match(livePreview, /npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e/);
  assert.match(livePreview, /monster-entity:80295e51265b3662bfbea2ea01ee3ccb/);
  assert.match(livePreview, /20 gold/);
  assert.match(livePreview, /gold coin/);
  assert.match(livePreview, /100%/);
  assert.match(livePreview, /inspector.*gameplay/i);
});

test('live Semantic assertions explicitly select Semantic because Gameplay is default', () => {
  const desktopStart = livePreview.indexOf('async function runDesktop');
  const mobileStart = livePreview.indexOf('async function runMobile');
  assert.ok(desktopStart >= 0 && mobileStart > desktopStart);

  for (const body of [livePreview.slice(desktopStart, mobileStart), livePreview.slice(mobileStart)]) {
    const search = body.indexOf('await searchAndSelect(');
    const assertion = body.indexOf('assertCreatureInspector(', search);
    assert.ok(search >= 0 && assertion > search);
    const between = body.slice(search, assertion);
    assert.match(between, /#inspector-tab-semantic/);
    assert.match(between, /aria-selected/);
  }
});
