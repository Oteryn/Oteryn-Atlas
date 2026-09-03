import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('overlap chooser selects the intended verified creature without assuming hit ordering', () => {
  const source = read('e2e/tests/creature-interaction-desktop.spec.mjs');
  assert.match(source, /choices\.filter\(\{ hasText: OVERLAP_MONSTER_FIXTURE\.label \}\)\.first\(\)/);
  assert.match(source, /cardRecordId\)\.toBe\(OVERLAP_MONSTER_FIXTURE\.record_id\)/);
});

test('mobile geometry begins with a real viewport transition instead of the project default no-op', () => {
  const source = read('e2e/tests/geometry-mobile.spec.mjs');
  const body = source.split("test('mobile portrait/landscape resize preserves base/creature world geometry'")[1] ?? '';
  const firstResize = body.match(/resizeAndAlign\(page,\s*(\d+),\s*(\d+)\)/);
  assert.deepEqual(firstResize?.slice(1), ['844', '390']);
});

test('long-name edge oracle isolates the uncategorized factual NPC from nearby role-labelled fixtures', () => {
  const source = read('e2e/tests/creature-presentation-desktop.spec.mjs');
  assert.match(source, /sceneEntry\(edgeScene,\s*\{ creatures: 'npc', zoom: 2, npcRole: 'other' \}\)/);
});
