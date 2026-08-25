import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const moduleUrl = new URL('../src/browser/creature-presentation-lod.mjs', import.meta.url);
const modulePath = fileURLToPath(moduleUrl);
const lodModule = await import(moduleUrl);
const { creaturePresentationLod } = lodModule;

function policy(overrides = {}) {
  return creaturePresentationLod({
    mode: 'map',
    effectiveRepresentation: 'detail',
    zoom: 1.25,
    overview: false,
    selected: false,
    hovered: false,
    kind: 'monster',
    ...overrides,
  });
}

test('module stays decoupled from canonical AUTO thresholds', () => {
  assert.equal(existsSync(modulePath), true);
  const source = readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /minimap-lod\.mjs/);
  assert.doesNotMatch(source, /\bLOD_POLICY\b|detailZoom|minimapZoom|detailStreamEnterZoom|detailStreamExitZoom/);
});

test('exports the pure creature presentation policy helper', () => {
  assert.equal(typeof creaturePresentationLod, 'function');
});

test('forced minimap suppresses ordinary labels', () => {
  const monster = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', zoom: 16 });
  assert.deepEqual(monster, {
    tier: 'sparse', showLabel: false, showPrimaryBadges: false, showSecondaryBadges: false,
    maxLabelWidth: 0, priorityClass: 'monster', promotion: null,
  });
});

test('sparse NPCs retain only the truthful primary badge channel', () => {
  const npc = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', zoom: 16, kind: 'npc' });
  assert.equal(npc.tier, 'sparse');
  assert.equal(npc.showLabel, false);
  assert.equal(npc.showPrimaryBadges, true);
  assert.equal(npc.showSecondaryBadges, false);
});

test('forced classic uses the same sparse annotation class as minimap', () => {
  const minimap = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', kind: 'npc' });
  const classic = policy({ mode: 'classic', effectiveRepresentation: 'classic', kind: 'npc' });
  assert.deepEqual(classic, minimap);
});

test('forced map exposes deterministic far, medium, and close detail tiers', () => {
  assert.equal(policy({ zoom: 0.5 }).tier, 'far');
  assert.equal(policy({ zoom: 1.25 }).tier, 'medium');
  assert.equal(policy({ zoom: 3 }).tier, 'close');
});

test('AUTO follows canonical effective representation instead of reconstructing AUTO thresholds', () => {
  assert.equal(policy({ mode: 'auto', effectiveRepresentation: 'minimap', zoom: 16 }).tier, 'sparse');
  assert.equal(policy({ mode: 'auto', effectiveRepresentation: 'minimap-fallback', zoom: 16 }).tier, 'sparse');
  assert.equal(policy({ mode: 'auto', effectiveRepresentation: 'detail', zoom: 0.125 }).tier, 'far');
  assert.equal(policy({ mode: 'auto', effectiveRepresentation: 'transition', zoom: 0.45 }).tier, 'far');
});

test('technical overview suppresses ordinary annotation density', () => {
  const hidden = policy({ overview: true, kind: 'npc', zoom: 3 });
  assert.deepEqual(hidden, {
    tier: 'hidden', showLabel: false, showPrimaryBadges: false, showSecondaryBadges: false,
    maxLabelWidth: 0, priorityClass: 'npc', promotion: null,
  });
});

test('selected creature gets bounded promotion even from sparse presentation', () => {
  const promoted = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', selected: true, kind: 'npc' });
  assert.equal(promoted.tier, 'promoted');
  assert.equal(promoted.promotion, 'selected');
  assert.equal(promoted.priorityClass, 'selected');
  assert.equal(promoted.showLabel, true);
  assert.ok(promoted.maxLabelWidth > 0 && promoted.maxLabelWidth <= 192);
});

test('hover promotion is opt-in and selected takes precedence', () => {
  const ordinary = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', hovered: false });
  assert.equal(ordinary.tier, 'sparse');
  const hovered = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', hovered: true });
  assert.equal(hovered.tier, 'promoted');
  assert.equal(hovered.promotion, 'hovered');
  assert.equal(hovered.priorityClass, 'hovered');
  const selected = policy({ mode: 'minimap', effectiveRepresentation: 'minimap', hovered: true, selected: true });
  assert.equal(selected.promotion, 'selected');
  assert.equal(selected.priorityClass, 'selected');
});

test('NPC and monster differences stay presentation-only', () => {
  const monster = policy({ zoom: 0.5, kind: 'monster' });
  const npc = policy({ zoom: 0.5, kind: 'npc' });
  assert.equal(npc.tier, monster.tier);
  assert.equal(npc.promotion, monster.promotion);
  assert.equal(npc.showLabel, true);
  assert.equal(monster.showLabel, false);
  assert.equal(npc.showPrimaryBadges, true);
  assert.equal(monster.showPrimaryBadges, false);
  assert.equal(npc.showSecondaryBadges, false);
  assert.equal(monster.showSecondaryBadges, false);
});

test('medium and close detail progressively expose bounded annotation channels', () => {
  const medium = policy({ zoom: 1.25, kind: 'npc' });
  const close = policy({ zoom: 3, kind: 'npc' });
  assert.equal(medium.showLabel, true);
  assert.equal(medium.showPrimaryBadges, true);
  assert.equal(medium.showSecondaryBadges, false);
  assert.equal(close.showLabel, true);
  assert.equal(close.showPrimaryBadges, true);
  assert.equal(close.showSecondaryBadges, true);
  assert.ok(close.maxLabelWidth > medium.maxLabelWidth);
});

test('invalid mode, effective representation, zoom, and kind fail deterministically', () => {
  assert.throws(() => policy({ mode: 'satellite' }), /unsupported creature presentation mode/);
  assert.throws(() => policy({ effectiveRepresentation: 'unknown' }), /unsupported effective representation/);
  assert.throws(() => policy({ zoom: Number.NaN }), /zoom must be finite and positive/);
  assert.throws(() => policy({ zoom: 0 }), /zoom must be finite and positive/);
  assert.throws(() => policy({ kind: 'item' }), /unsupported creature kind/);
});

test('returned policy is immutable', () => {
  assert.equal(Object.isFrozen(policy()), true);
});