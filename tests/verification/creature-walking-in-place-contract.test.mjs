import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const GAME_SHA = '91b73a7566a59991ebf7d471eacb3a858b755c9c';
const CREATURE_DIGEST = 'sha256:5f10a15758199105584c38634d08254af79973cf7ce25d54bf46e54d8fee26ca';
const PLAYBACK_CAPABILITY = 'creature-moving-in-place-v1';
const RUNTIME_PROFILE = 'oteryn-atlas-animation-runtime-v2';
const STALE_CREATURE_DIGEST = 'sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8';

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

test('browser/runtime consume the merged Game moving-in-place authority', async () => {
  const [runtime, builder, web] = await Promise.all([
    source('src/browser/animation-runtime.mjs'),
    source('tools/animation-runtime/build.py'),
    source('web/fullworld-creatures.mjs'),
  ]);

  for (const text of [runtime, builder]) {
    assert.ok(text.includes(GAME_SHA), 'runtime producer/consumer must pin merged Game authority');
    assert.ok(text.includes(CREATURE_DIGEST), 'runtime producer/consumer must pin merged creature digest');
    assert.ok(text.includes(PLAYBACK_CAPABILITY), 'runtime producer/consumer must require Game playback capability');
    assert.ok(text.includes(RUNTIME_PROFILE), 'runtime producer/consumer must agree on runtime v2 profile');
    assert.ok(!text.includes(STALE_CREATURE_DIGEST), 'runtime producer/consumer must not retain stale creature digest');
  }

  assert.ok(web.includes(CREATURE_DIGEST), 'creature overlay must validate the merged Game creature digest');
  assert.ok(!web.includes(STALE_CREATURE_DIGEST), 'creature overlay must reject the old creature product');
  assert.ok(web.includes("'moving-in-place'"), 'creature overlay must request the explicit walking presentation mode');
  assert.ok(web.includes("'static'"), 'creature overlay must retain an explicit static presentation mode');
  assert.match(web, /creatureFrame\s*\(\s*record\s*,/u, 'creature overlay must obtain pixels through the shared animation runtime');
});

test('walking presentation remains on the shared clock without per-creature timers', async () => {
  const web = await source('web/fullworld-creatures.mjs');
  assert.ok(web.includes('oteryn-atlas-animation-frame'), 'creature overlay must consume the shared logical animation clock');
  assert.ok(web.includes('logicalTimeMs'), 'creature overlay must advance presentation from shared logical time');
  const prepareStart = web.indexOf('async function prepareDraw');
  const prepareEnd = web.indexOf('async function draw(records', prepareStart);
  assert.ok(prepareStart >= 0 && prepareEnd > prepareStart, 'creature draw loop must remain inspectable');
  const prepareDraw = web.slice(prepareStart, prepareEnd);
  assert.doesNotMatch(prepareDraw, /\bsetInterval\s*\(/u, 'creature draw loop must not allocate per-creature intervals');
  assert.doesNotMatch(prepareDraw, /\bsetTimeout\s*\(/u, 'creature draw loop must not allocate per-creature timeouts');
});

test('main-only live workflow cannot rebuild the stale creature/runtime authority', async () => {
  const workflow = await source('.github/workflows/synology-live-acceptance.yml');
  assert.ok(workflow.includes(`GAME_REV: ${GAME_SHA}`), 'live acceptance must build from merged Game moving-in-place authority');
  assert.ok(workflow.includes(`CREATURE_SEMANTIC_DIGEST: ${CREATURE_DIGEST}`), 'live acceptance must expect the new creature digest');
  assert.ok(!workflow.includes(STALE_CREATURE_DIGEST), 'live acceptance must not accept the old creature digest');
});

test('live browser oracle validates V2 walking pixels and static restoration', async () => {
  const [proof, coverage] = await Promise.all([
    source('e2e/tests/live-creature-preview.cjs'),
    source('e2e/support/creature-animation-coverage.mjs'),
  ]);
  assert.ok(coverage.includes(RUNTIME_PROFILE), 'coverage oracle must consume animation runtime v2');
  assert.ok(coverage.includes('walking_program'), 'coverage oracle must inspect walking programs explicitly');
  assert.ok(proof.includes('EXPECTED_WALKING_PROGRAMS = 1376'), 'browser oracle must bind walking program census');
  assert.ok(proof.includes('walkingFallbackReasons'), 'browser oracle must validate walking fallback census');
  assert.ok(proof.includes('staticNpcPixels, false'), 'NPC playback must prove actual pixel change');
  assert.ok(proof.includes('staticNpcPixels, true'), 'NPC playback must prove exact static restoration');
  assert.ok(proof.includes('staticMonsterPixels, false'), 'monster playback must prove actual pixel change');
  assert.ok(proof.includes('staticMonsterPixels, true'), 'monster playback must prove exact static restoration');
});
