import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createCreatureRenderSnapshot } from '../src/browser/creature-render-diagnostics.mjs';
import {
  DENSE_MONSTER_SCENE,
  FIXTURE_ATLAS_MAIN,
  LONG_NAME_NPC,
  MIXED_SCENE,
  NEARBY_NPC_SCENE,
  OVERFLOW_NPC,
  TWO_ROLE_NPC,
} from '../e2e/support/creature-presentation-fixtures.mjs';

const MAX_SAMPLES = 24;
const CATALOG_URL = new URL('../web/semantic-search/creatures.json', import.meta.url);

function exactRecord(actual, expected) {
  assert(actual, `missing factual fixture ${expected.record_id}`);
  assert.equal(actual.label, expected.label);
  assert.equal(actual.kind, expected.kind);
  assert.deepEqual(actual.position, expected.position);
  assert.deepEqual(actual.roles ?? [], [...expected.roles]);
}
function baseDiagnosticInput() {
  return {
    generation: 7,
    baseGenerationAtStart: 13,
    baseGenerationAtCommit: 13,
    view: { x: 33327, y: 31882, floor: -7, zoom: 2 },
    canvas: { width: 1440, height: 900, dpr: 2 },
    anchors: [{
      id: OVERFLOW_NPC.record_id,
      kind: 'npc', floor: -7, x: 33327, y: 31882, screenX: 720, screenY: 450,
    }],
    labelStyle: 'creature-labels-v1',
    npcMarkerStyle: 'functional-icons-v2',
    labelsConsidered: 4,
    labelsDrawn: 3,
    labelsSuppressed: 1,
    drawnNpcBadges: 3,
    drawnNpcIcons: 1,
    effectivePresentation: { requestedMode: 'auto', representation: 'detail', lod: 'close' },
    labelLayoutGeneration: 5,
    labelLayoutKey: 'layout:fixture',
  };
}
function samplePresentationRect(recordId = OVERFLOW_NPC.record_id) {
  return { recordId, kind: 'npc', rect: { x: 700, y: 410, width: 64, height: 64 } };
}

function sampleLabelLayout(recordId = OVERFLOW_NPC.record_id) {
  return {
    recordId, kind: 'npc', fullText: 'Eremo', displayText: 'Eremo',
    rect: { x: 702, y: 390, width: 60, height: 18 }, suppressed: false, priority: 'npc',
  };
}

function sampleBadgeLayout() {
  return {
    recordId: OVERFLOW_NPC.record_id,
    slots: [
      { kind: 'role', role: 'travel' },
      { kind: 'role', role: 'trainer' },
      { kind: 'overflow', hiddenCount: 3 },
    ],
    rects: [
      { x: 703, y: 458, width: 12, height: 12 },
      { x: 717, y: 458, width: 12, height: 12 },
      { x: 731, y: 458, width: 18, height: 12 },
    ],
  };
}
test(`real-data fixtures are revalidated from Atlas main ${FIXTURE_ATLAS_MAIN}`, async () => {
  const catalog = JSON.parse(await readFile(CATALOG_URL, 'utf8'));
  const records = catalog.records ?? [];
  const byId = new Map(records.map((item) => [item.record_id, item]));
  exactRecord(byId.get(TWO_ROLE_NPC.record_id), TWO_ROLE_NPC);
  exactRecord(byId.get(OVERFLOW_NPC.record_id), OVERFLOW_NPC);
  exactRecord(byId.get(LONG_NAME_NPC.record_id), LONG_NAME_NPC);

  for (const id of NEARBY_NPC_SCENE.recordIds) {
    const item = byId.get(id);
    assert(item, `missing nearby NPC fixture ${id}`);
    assert.equal(item.kind, 'npc');
    assert.equal(item.position.floor, NEARBY_NPC_SCENE.center.floor);
    assert(Math.abs(item.position.x - NEARBY_NPC_SCENE.center.x) <= 12);
    assert(Math.abs(item.position.y - NEARBY_NPC_SCENE.center.y) <= 8);
  }
  for (const id of DENSE_MONSTER_SCENE.recordIds) {
    const item = byId.get(id);
    assert(item, `missing dense monster fixture ${id}`);
    assert.equal(item.kind, 'monster');
    assert.equal(item.position.floor, DENSE_MONSTER_SCENE.center.floor);
    assert(Math.abs(item.position.x - DENSE_MONSTER_SCENE.center.x) <= 2);
    assert(Math.abs(item.position.y - DENSE_MONSTER_SCENE.center.y) <= 2);
  }
  const mixedIds = [MIXED_SCENE.npcRecordId, ...MIXED_SCENE.monsterRecordIds];
  const mixed = mixedIds.map((id) => byId.get(id));
  assert(mixed.every(Boolean), 'mixed NPC/monster fixture records must exist');
  assert.equal(mixed.filter((item) => item.kind === 'npc').length, 1);
  assert.equal(mixed.filter((item) => item.kind === 'monster').length, 3);
  for (const item of mixed) {
    assert.equal(item.position.floor, MIXED_SCENE.center.floor);
    assert(Math.abs(item.position.x - MIXED_SCENE.center.x) <= 12);
    assert(Math.abs(item.position.y - MIXED_SCENE.center.y) <= 8);
  }
});

test('versioned presentation diagnostics expose labels and badge compatibility counts', () => {
  const snapshot = createCreatureRenderSnapshot(baseDiagnosticInput());
  assert.equal(snapshot.labelStyle, 'creature-labels-v1');
  assert.equal(snapshot.npcMarkerStyle, 'functional-icons-v2');
  assert.equal(snapshot.labelsConsidered, 4);
  assert.equal(snapshot.labelsDrawn, 3);
  assert.equal(snapshot.labelsSuppressed, 1);
  assert.equal(snapshot.labelsDrawn + snapshot.labelsSuppressed, snapshot.labelsConsidered);
  assert.equal(snapshot.drawnNpcBadges, 3);
  assert.equal(snapshot.drawnNpcIcons, 1, 'drawnNpcIcons remains NPC-record count, not badge-slot count');
  assert(snapshot.drawnNpcBadges > snapshot.drawnNpcIcons);
});

test('render snapshot carries effective presentation and layout lifetime independent of animation', () => {
  const snapshot = createCreatureRenderSnapshot(baseDiagnosticInput());
  assert.deepEqual(snapshot.effectivePresentation, {
    requestedMode: 'auto', representation: 'detail', lod: 'close',
  });
  assert.equal(snapshot.labelLayoutGeneration, 5);
  assert.equal(snapshot.labelLayoutKey, 'layout:fixture');
  assert.equal(snapshot.baseGenerationAtStart, 13);
  assert.equal(snapshot.baseGenerationAtCommit, 13);
});
test('bounded CSS-pixel samples expose presentation, label and truthful badge geometry', () => {
  const input = baseDiagnosticInput();
  input.presentationRects = Array.from({ length: 40 }, () => samplePresentationRect());
  input.labelLayouts = Array.from({ length: 40 }, () => sampleLabelLayout());
  input.badgeLayouts = Array.from({ length: 40 }, () => sampleBadgeLayout());
  const snapshot = createCreatureRenderSnapshot(input);

  assert(snapshot.presentationRects.length <= MAX_SAMPLES);
  assert(snapshot.labelLayouts.length <= MAX_SAMPLES);
  assert(snapshot.badgeLayouts.length <= MAX_SAMPLES);
  assert.deepEqual(snapshot.badgeLayouts[0].slots, [
    { kind: 'role', role: 'travel' },
    { kind: 'role', role: 'trainer' },
    { kind: 'overflow', hiddenCount: 3 },
  ]);
  assert.deepEqual(snapshot.presentationRects[0].rect, { x: 700, y: 410, width: 64, height: 64 });
  assert.deepEqual(snapshot.labelLayouts[0].rect, { x: 702, y: 390, width: 60, height: 18 });
  assert(Object.isFrozen(snapshot.presentationRects));
  assert(Object.isFrozen(snapshot.labelLayouts));
  assert(Object.isFrozen(snapshot.badgeLayouts));
});
