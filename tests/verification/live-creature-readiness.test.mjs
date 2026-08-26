import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { liveCreatureReady } = require('../../e2e/support/live-creature-readiness.cjs');

const DIGEST = `sha256:${'a'.repeat(64)}`;

function state(overrides = {}) {
  return {
    status: 'PASS',
    sourceSemanticDigest: DIGEST,
    cacheChunks: 1,
    drawnRecords: 1,
    pixelDrawnRecords: 1,
    animationRuntime: { creaturePrograms: 1377 },
    enabled: { npc: true, monster: true },
    selectedRecordId: null,
    selectedVisible: false,
    npcMarkerStyle: 'functional-icons-v2',
    drawnNpcIcons: 0,
    render: {
      baseGenerationAtStart: 2,
      baseGenerationAtCommit: 2,
      drawnNpcBadges: 0,
    },
    ...overrides,
  };
}

function options(overrides = {}) {
  return {
    digest: DIGEST,
    selected: null,
    wantNpc: true,
    wantMonster: true,
    requireNpcBadge: false,
    ...overrides,
  };
}

function withCreatureState(value, fn) {
  const previous = globalThis.__OTERYN_ATLAS_CREATURES__;
  globalThis.__OTERYN_ATLAS_CREATURES__ = value;
  try { return fn(); } finally {
    if (previous === undefined) delete globalThis.__OTERYN_ATLAS_CREATURES__;
    else globalThis.__OTERYN_ATLAS_CREATURES__ = previous;
  }
}

test('generic live creature readiness preserves the existing bounded runtime contract', () => {
  assert.equal(withCreatureState(state(), () => liveCreatureReady(options())), true);
});

test('live minimap NPC readiness does not pass before factual v2 badge presentation commits', () => {
  assert.equal(withCreatureState(state(), () => liveCreatureReady(options({ requireNpcBadge: true }))), false);
  assert.equal(withCreatureState(state({
    drawnNpcIcons: 1,
    render: { baseGenerationAtStart: 2, baseGenerationAtCommit: 3, drawnNpcBadges: 1 },
  }), () => liveCreatureReady(options({ requireNpcBadge: true }))), false);
  assert.equal(withCreatureState(state({
    drawnNpcIcons: 1,
    render: { baseGenerationAtStart: 3, baseGenerationAtCommit: 3, drawnNpcBadges: 1 },
  }), () => liveCreatureReady(options({ requireNpcBadge: true }))), true);
});

test('required NPC badge readiness rejects stale style or missing factual badge count', () => {
  assert.equal(withCreatureState(state({
    npcMarkerStyle: 'functional-icons-v1',
    drawnNpcIcons: 1,
    render: { baseGenerationAtStart: 3, baseGenerationAtCommit: 3, drawnNpcBadges: 1 },
  }), () => liveCreatureReady(options({ requireNpcBadge: true }))), false);
  assert.equal(withCreatureState(state({
    drawnNpcIcons: 1,
    render: { baseGenerationAtStart: 3, baseGenerationAtCommit: 3, drawnNpcBadges: 0 },
  }), () => liveCreatureReady(options({ requireNpcBadge: true }))), false);
});

test('live desktop acceptance wires the stronger NPC badge readiness contract', async () => {
  const source = await readFile(new URL('../../e2e/tests/live-creature-preview.cjs', import.meta.url), 'utf8');
  assert.match(source, /page\.waitForFunction\(\s*liveCreatureReady/);
  assert.match(source, /waitReady\(page, \{ requireNpcBadge: true \}\)/);
  assert.match(source, /assert\.ok\(initial\.drawnNpcIcons > 0\)/);
});
