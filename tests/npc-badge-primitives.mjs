import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NPC_BADGE_GRID,
  NPC_BADGE_PRIMITIVE_IDS,
  npcBadgePrimitive,
} from '../src/browser/npc-badge-primitives.mjs';

const EXPECTED_IDS = ['bank', 'travel', 'shop', 'quest', 'blessing', 'trainer', 'other'];
const ALLOWED_TONES = new Set(['primary', 'accent', 'shadow']);

test('publishes the complete functional-icons-v2 primitive vocabulary', () => {
  assert.deepEqual(NPC_BADGE_PRIMITIVE_IDS, EXPECTED_IDS);
  assert.deepEqual(NPC_BADGE_GRID, { width: 9, height: 9 });
  assert.equal(Object.isFrozen(NPC_BADGE_PRIMITIVE_IDS), true);
  assert.equal(Object.isFrozen(NPC_BADGE_GRID), true);
});

test('every primitive is immutable integer-grid geometry inside the declared grid', () => {
  for (const id of EXPECTED_IDS) {
    const primitive = npcBadgePrimitive(id);
    assert.equal(primitive.id, id);
    assert.equal(Object.isFrozen(primitive), true);
    assert.equal(Object.isFrozen(primitive.rects), true);
    assert.ok(primitive.rects.length > 0, `${id} must draw at least one rectangle`);
    for (const rect of primitive.rects) {
      assert.equal(Object.isFrozen(rect), true);
      assert.equal(Number.isSafeInteger(rect.x), true);
      assert.equal(Number.isSafeInteger(rect.y), true);
      assert.equal(Number.isSafeInteger(rect.width), true);
      assert.equal(Number.isSafeInteger(rect.height), true);
      assert.ok(rect.x >= 0 && rect.y >= 0, `${id} rectangle origin`);
      assert.ok(rect.width > 0 && rect.height > 0, `${id} rectangle size`);
      assert.ok(rect.x + rect.width <= NPC_BADGE_GRID.width, `${id} rectangle width bound`);
      assert.ok(rect.y + rect.height <= NPC_BADGE_GRID.height, `${id} rectangle height bound`);
      assert.equal(ALLOWED_TONES.has(rect.tone), true, `${id} tone ${rect.tone}`);
    }
  }
});

test('primitive representation is self-contained and external-asset free', () => {
  for (const id of EXPECTED_IDS) {
    const primitive = npcBadgePrimitive(id);
    assert.deepEqual(Object.keys(primitive).sort(), ['id', 'rects']);
    for (const rect of primitive.rects) {
      assert.deepEqual(Object.keys(rect).sort(), ['height', 'tone', 'width', 'x', 'y']);
    }
    assert.doesNotMatch(JSON.stringify(primitive), /https?:|\.svg|\.png|tibia|cipsoft/i);
  }
});

test('overflow and unsupported pseudo roles never resolve to factual badge primitives', () => {
  assert.throws(() => npcBadgePrimitive('overflow'), /unsupported NPC badge primitive/);
  assert.throws(() => npcBadgePrimitive('weapons'), /unsupported NPC badge primitive/);
  assert.throws(() => npcBadgePrimitive(null), /unsupported NPC badge primitive/);
});
