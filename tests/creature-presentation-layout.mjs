import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CREATURE_PRESENTATION_PRIORITY,
  createCreatureLabelCandidates,
  createCreaturePresentationLayoutKey,
  creatureLayoutPriority,
  creaturePresentationBounds,
  fitCreatureLabelText,
  solveCreaturePresentationLayout,
} from '../src/browser/creature-presentation-layout.mjs';

const baseRecord = {
  record_id: 'monster:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  position: { x: 100, y: 100, floor: -7 },
};
const baseView = { x: 100, y: 100, floor: -7, zoom: 1 };
const baseViewport = { width: 200, height: 120 };

function pixelBounds(overrides = {}) {
  return creaturePresentationBounds({
    record: overrides.record ?? baseRecord,
    view: overrides.view ?? baseView,
    viewport: overrides.viewport ?? baseViewport,
    presentation: overrides.presentation ?? {
      kind: 'pixel', bitmapWidth: 32, bitmapHeight: 32,
      displacement: { x: 0, y: 0 }, contentId: 'sha256:phase-a',
    },
  });
}
test('presentation bounds reuse canonical 32x32 CSS-pixel geometry', () => {
  const result = pixelBounds();
  assert.deepEqual(result.anchor, { x: 100, y: 60 });
  assert.deepEqual(result.presentationRect, { x: 100, y: 60, width: 32, height: 32 });
  assert.deepEqual(result.visibleRect, result.presentationRect);
});

test('presentation bounds account for larger bitmap and Game displacement', () => {
  const result = pixelBounds({
    view: { ...baseView, zoom: 2 },
    presentation: {
      kind: 'pixel', bitmapWidth: 64, bitmapHeight: 48,
      displacement: { x: 4, y: 6 }, contentId: 'sha256:phase-b',
    },
  });
  assert.deepEqual(result.anchor, { x: 100, y: 60 });
  assert.deepEqual(result.presentationRect, { x: 28, y: 16, width: 128, height: 96 });
});

test('factual marker fallback uses canonical marker geometry', () => {
  const result = creaturePresentationBounds({
    record: baseRecord, view: baseView, viewport: baseViewport,
    presentation: { kind: 'marker', width: 14, height: 10 },
  });
  assert.deepEqual(result.presentationRect, { x: 93, y: 55, width: 14, height: 10 });
  assert.equal(result.presentationKind, 'marker');
});
test('presentation clipping is exact at each viewport edge', () => {
  const cases = [
    [{ x: 95.875, y: 100, floor: -7 }, { x: -32, y: 60, width: 32, height: 32 }, null],
    [{ x: 96.375, y: 100, floor: -7 }, { x: -16, y: 60, width: 32, height: 32 }, { x: 0, y: 60, width: 16, height: 32 }],
    [{ x: 103.5, y: 100, floor: -7 }, { x: 212, y: 60, width: 32, height: 32 }, null],
    [{ x: 102.75, y: 100, floor: -7 }, { x: 188, y: 60, width: 32, height: 32 }, { x: 188, y: 60, width: 12, height: 32 }],
    [{ x: 100, y: 98, floor: -7 }, { x: 100, y: -4, width: 32, height: 32 }, { x: 100, y: 0, width: 32, height: 28 }],
    [{ x: 100, y: 102, floor: -7 }, { x: 100, y: 124, width: 32, height: 32 }, null],
    [{ x: 100, y: 101.75, floor: -7 }, { x: 100, y: 116, width: 32, height: 32 }, { x: 100, y: 116, width: 32, height: 4 }],
  ];
  for (const [position, raw, clipped] of cases) {
    const result = pixelBounds({ record: { ...baseRecord, position } });
    if (clipped == null) assert.equal(result, null);
    else {
      assert.deepEqual(result.presentationRect, raw);
      assert.deepEqual(result.visibleRect, clipped);
    }
  }
});

test('presentation geometry is DPR-independent in CSS pixels', () => {
  const one = pixelBounds({ viewport: { ...baseViewport, dpr: 1 } });
  const two = pixelBounds({ viewport: { ...baseViewport, dpr: 2 } });
  assert.deepEqual(two, one);
});
test('label text preserves source and deterministically ellipsizes with injected metrics', () => {
  const measureText = (value) => Array.from(value).length * 5;
  assert.deepEqual(fitCreatureLabelText({ text: 'Rat', maxWidth: 20, measureText }), {
    sourceText: 'Rat', displayText: 'Rat', width: 15, truncated: false,
  });
  assert.deepEqual(fitCreatureLabelText({ text: 'Dragon Lord', maxWidth: 30, measureText }), {
    sourceText: 'Dragon Lord', displayText: 'Drago…', width: 30, truncated: true,
  });
});

test('label text handles empty and widths smaller than ellipsis', () => {
  const measureText = (value) => Array.from(value).length * 6;
  assert.deepEqual(fitCreatureLabelText({ text: '', maxWidth: 2, measureText }), {
    sourceText: '', displayText: '', width: 0, truncated: false,
  });
  assert.deepEqual(fitCreatureLabelText({ text: 'Rat', maxWidth: 5, measureText }), {
    sourceText: 'Rat', displayText: '', width: 0, truncated: true,
  });
});

test('label candidates are bounded, ordered and stable without moving factual bounds', () => {
  const input = {
    presentationRect: { x: 40, y: 50, width: 20, height: 30 },
    labelSize: { width: 60, height: 16 }, gap: 4,
  };
  const first = createCreatureLabelCandidates(input);
  const second = createCreatureLabelCandidates(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((entry) => entry.anchor), [
    'above-center', 'right-center', 'left-center', 'below-center',
  ]);
  assert.deepEqual(first.map((entry) => entry.rect), [
    { x: 20, y: 30, width: 60, height: 16 },
    { x: 64, y: 57, width: 60, height: 16 },
    { x: -24, y: 57, width: 60, height: 16 },
    { x: 20, y: 84, width: 60, height: 16 },
  ]);
  assert.deepEqual(input.presentationRect, { x: 40, y: 50, width: 20, height: 30 });
});

test('priority helper encodes selected > hovered > npc > monster > secondary', () => {
  assert.equal(creatureLayoutPriority({ selected: true, kind: 'monster' }), CREATURE_PRESENTATION_PRIORITY.selected);
  assert.equal(creatureLayoutPriority({ hovered: true, kind: 'monster' }), CREATURE_PRESENTATION_PRIORITY.hovered);
  assert.equal(creatureLayoutPriority({ kind: 'npc' }), CREATURE_PRESENTATION_PRIORITY.npcLabel);
  assert.equal(creatureLayoutPriority({ kind: 'monster' }), CREATURE_PRESENTATION_PRIORITY.monsterLabel);
  assert.equal(creatureLayoutPriority({ kind: 'npc', secondary: true }), CREATURE_PRESENTATION_PRIORITY.secondaryBadge);
  assert(CREATURE_PRESENTATION_PRIORITY.selected > CREATURE_PRESENTATION_PRIORITY.hovered);
  assert(CREATURE_PRESENTATION_PRIORITY.hovered > CREATURE_PRESENTATION_PRIORITY.npcLabel);
  assert(CREATURE_PRESENTATION_PRIORITY.npcLabel > CREATURE_PRESENTATION_PRIORITY.monsterLabel);
  assert(CREATURE_PRESENTATION_PRIORITY.monsterLabel > CREATURE_PRESENTATION_PRIORITY.secondaryBadge);
});

function item(id, priority, candidates) {
  return { id, priority, candidates: candidates.map((rect) => ({ rect })) };
}
test('collision solver honors priority regardless of input order', () => {
  const overlap = { x: 20, y: 20, width: 40, height: 16 };
  const result = solveCreaturePresentationLayout({
    viewport: { x: 0, y: 0, width: 120, height: 80 },
    items: [
      item('monster', CREATURE_PRESENTATION_PRIORITY.monsterLabel, [overlap]),
      item('selected', CREATURE_PRESENTATION_PRIORITY.selected, [overlap]),
      item('npc', CREATURE_PRESENTATION_PRIORITY.npcLabel, [overlap]),
      item('hovered', CREATURE_PRESENTATION_PRIORITY.hovered, [overlap]),
      item('badge', CREATURE_PRESENTATION_PRIORITY.secondaryBadge, [overlap]),
    ],
  });
  assert.deepEqual(result.placed.map((entry) => entry.id), ['selected']);
  assert.deepEqual(result.suppressed.map((entry) => entry.id), ['hovered', 'npc', 'monster', 'badge']);
});

test('collision solver uses later candidate when first intersects a reserved rectangle', () => {
  const result = solveCreaturePresentationLayout({
    viewport: { x: 0, y: 0, width: 120, height: 80 },
    reservedRects: [{ x: 0, y: 0, width: 50, height: 30 }],
    items: [item('npc', CREATURE_PRESENTATION_PRIORITY.npcLabel, [
      { x: 10, y: 10, width: 30, height: 12 },
      { x: 60, y: 10, width: 30, height: 12 },
    ])],
  });
  assert.equal(result.placed.length, 1);
  assert.equal(result.placed[0].candidateIndex, 1);
  assert.deepEqual(result.placed[0].rect, { x: 60, y: 10, width: 30, height: 12 });
  assert.deepEqual(result.suppressed, []);
});
test('collision solver suppresses items when no candidate fits viewport tolerance', () => {
  const result = solveCreaturePresentationLayout({
    viewport: { x: 0, y: 0, width: 100, height: 60 }, tolerance: 1,
    items: [item('outside', CREATURE_PRESENTATION_PRIORITY.npcLabel, [
      { x: -5, y: 10, width: 20, height: 10 },
      { x: 90, y: 55, width: 20, height: 10 },
    ])],
  });
  assert.deepEqual(result.placed, []);
  assert.deepEqual(result.suppressed.map((entry) => entry.id), ['outside']);
});

const layoutKeyBase = {
  committedTransform: { centerTileX: 100, centerTileY: 200, floor: -7, zoom: 2, generation: 4 },
  viewport: { width: 1280, height: 720, dpr: 1 },
  records: [
    { recordId: 'npc:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', geometryKey: 'g1', layoutKey: 'name:Albinius|roles:shop,quest', contentId: 'sha256:a' },
    { recordId: 'monster:cccccccccccccccccccccccccccccccc', geometryKey: 'g2', layoutKey: 'name:Rat', contentId: 'sha256:b' },
  ],
  filter: { npcRole: 'all' },
  effectivePresentation: { mode: 'map', lod: 'medium', overview: false },
  selectedId: null,
  hoveredId: null,
  reservedRects: [{ x: 10, y: 10, width: 100, height: 20 }],
  fontMetricsKey: 'atlas-ui-12-v1',
};

function layoutKey(overrides = {}) {
  return createCreaturePresentationLayoutKey({ ...layoutKeyBase, ...overrides });
}
test('layout key changes for each real layout dependency', () => {
  const baseline = layoutKey();
  const changes = [
    { committedTransform: { ...layoutKeyBase.committedTransform, centerTileX: 101 } },
    { viewport: { ...layoutKeyBase.viewport, width: 1279 } },
    { filter: { npcRole: 'shop' } },
    { effectivePresentation: { mode: 'minimap', lod: 'sparse', overview: false } },
    { selectedId: layoutKeyBase.records[0].recordId },
    { hoveredId: layoutKeyBase.records[1].recordId },
    { reservedRects: [{ x: 11, y: 10, width: 100, height: 20 }] },
    { fontMetricsKey: 'atlas-ui-12-v2' },
    { records: [{ ...layoutKeyBase.records[0], geometryKey: 'g1b' }, layoutKeyBase.records[1]] },
    { records: [{ ...layoutKeyBase.records[0], layoutKey: 'name:Albinius v2' }, layoutKeyBase.records[1]] },
  ];
  for (const change of changes) assert.notEqual(layoutKey(change), baseline);
});

test('layout key ignores DPR, renderer generation and animation-only phase/content changes', () => {
  const baseline = layoutKey();
  const changed = layoutKey({
    committedTransform: { ...layoutKeyBase.committedTransform, generation: 999 },
    viewport: { ...layoutKeyBase.viewport, dpr: 2 },
    records: layoutKeyBase.records.map((record, index) => ({
      ...record,
      contentId: `sha256:phase-${index}`,
      animationFrameIndex: index + 7,
      logicalTimeMs: 12_345,
    })),
    logicalTimeMs: 12_345,
    animationFrameIndex: 9,
  });
  assert.equal(changed, baseline);
});

test('layout key is deterministic for structurally equivalent filter objects', () => {
  const one = layoutKey({ filter: { npcRole: 'shop', enabled: { monster: true, npc: true } } });
  const two = layoutKey({ filter: { enabled: { npc: true, monster: true }, npcRole: 'shop' } });
  assert.equal(one, two);
});
