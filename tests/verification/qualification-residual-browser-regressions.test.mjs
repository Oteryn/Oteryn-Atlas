import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

async function withQualificationWorld(prefix, body) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const root = path.join(parent, 'world');
  try {
    await buildQualificationWorld(root);
    return await body(root);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

test('generic qualification navigation uses a neutral creature-rich camera anchor', async () => {
  await withQualificationWorld('atlas-qualification-neutral-anchor-', async (root) => {
    const semantic = JSON.parse(fs.readFileSync(path.join(root, 'web', 'semantic-search', 'index.json'), 'utf8'));
    const creatures = JSON.parse(fs.readFileSync(path.join(root, 'data', 'creatures', 'search.json'), 'utf8'));
    const navigable = semantic.records.filter((record) => Array.isArray(record.capabilities) && record.capabilities.includes('navigation'));
    assert.equal(navigable.length, 1, 'qualification fixture must expose exactly one generic navigation anchor');
    const anchor = navigable[0].position;
    const exactPlacements = creatures.records.filter((record) => record.position.floor === anchor.floor
      && record.position.x === anchor.x && record.position.y === anchor.y);
    assert.equal(exactPlacements.length, 0, 'generic camera anchor must not coincide exactly with an interactive creature placement');
    const nearbyKinds = new Set(creatures.records.filter((record) => record.position.floor === anchor.floor
      && Math.abs(record.position.x - anchor.x) <= 4 && Math.abs(record.position.y - anchor.y) <= 4)
      .map((record) => record.kind));
    assert.deepEqual([...nearbyKinds].sort(), ['monster', 'npc'], 'generic camera anchor must retain a mixed creature-rich qualification scene');
  });
});

test('qualification animation product contains a dynamic world-object program bound to a published semantic primitive', async () => {
  await withQualificationWorld('atlas-qualification-world-animation-', async (root) => {
    const programs = JSON.parse(fs.readFileSync(path.join(root, 'animation', 'programs.json'), 'utf8'));
    const anchorLine = fs.readFileSync(path.join(root, 'publication', 'semantic', 'chunks', 'f-7-r1008-c1004.jsonl'), 'utf8').trim();
    const tile = JSON.parse(anchorLine);
    const appearanceSourceId = tile.presentation?.[0]?.appearance_source_id;
    assert.ok(Number.isSafeInteger(appearanceSourceId) && appearanceSourceId > 0, 'published qualification primitive must expose an appearance source id');
    const objectProgram = (programs.object_programs ?? []).find((program) => program.appearance_source_id === appearanceSourceId);
    assert.ok(objectProgram, `qualification animation must bind appearance source ${appearanceSourceId}`);
    assert.ok(objectProgram.phase_count > 1, 'qualification world-object animation must have multiple phases');
    assert.ok(new Set(objectProgram.sprite_source_ids ?? []).size > 1, 'qualification world-object animation must select distinct phase sprites');
    const phaseContents = (objectProgram.sprite_source_ids ?? []).map((spriteId) => programs.sprite_index?.[String(spriteId)]?.content_id);
    assert.equal(phaseContents.every((contentId) => /^sha256:[a-f0-9]{64}$/.test(contentId ?? '')), true, 'world-object animation sprites must resolve to authenticated pixel content');
    assert.ok(new Set(phaseContents).size > 1, 'world-object animation phases must resolve to distinct authenticated pixels');
  });
});

test('reordered-range qualification starts from a wider detail-enabled view without weakening the two-range oracle', () => {
  const source = read('e2e/tests/race-desktop.spec.mjs');
  assert.match(source, /const REORDER_RANGE_ENTRY = isQualificationFixtureExecution\(\)[\s\S]*zoom=0\.5&mode=map[\s\S]*: DESKTOP_ENTRY;/);
  const body = source.split("test('reordered authenticated range completion cannot commit a stale pan target'")[1] ?? '';
  assert.match(body, /gotoAtlas\(page, REORDER_RANGE_ENTRY\)/);
  assert.match(body, /waitForHeld\(2\)/);
  assert.match(body, /expect\(held\)\.toHaveLength\(2\)/);
});
