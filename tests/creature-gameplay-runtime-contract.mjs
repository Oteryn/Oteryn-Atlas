import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

test('FullWorld exposes one accessible Gameplay Semantic Live-state tab surface', () => {
  const html = read('web/fullworld.html');
  assert.match(html, /role="tablist"[^>]*aria-label="Creature inspector view"/);
  assert.match(html, /id="inspector-tab-gameplay"[^>]*data-inspector-tab="gameplay"/);
  assert.match(html, /id="inspector-tab-semantic"[^>]*data-inspector-tab="semantic"/);
  assert.match(html, /id="inspector-tab-live"[^>]*data-inspector-tab="live"[^>]*disabled/);
  assert.equal((html.match(/data-inspector-tab=/g) ?? []).length, 3);
});

test('creature runtime reuses #113 selection and routes Details to durable Gameplay', () => {
  const source = read('web/fullworld-creatures.mjs');
  assert.match(source, /createCreatureGameplayProfileService/);
  assert.match(source, /parseCreatureInspectorState/);
  assert.match(source, /serializeCreatureInspectorState/);
  assert.match(source, /reduceCreatureInspectorState/);
  assert.match(source, /createCreatureGameplayInspectorController/);
  assert.match(source, /type:\s*['"]open-details['"]/);
  assert.match(source, /params\.set\(['"]creature['"]/);
  assert.match(source, /inspectorState/);
  assert.match(source, /gameplaySummary/);
  assert.match(source, /renderCreatureInspector\(record\)/);
  assert.match(source, /buildCreatureInteractionIndex/);
});

test('gameplay renderer is text-only, bounded, and names every required section', () => {
  const source = read('web/fullworld-creature-gameplay.mjs');
  assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML/);
  for (const section of ['sells', 'buys', 'services', 'travel', 'locations', 'loot', 'stats', 'resistances', 'spawns']) {
    assert.match(source, new RegExp(`data-gameplay-section.*${section}|gameplay-section-${section}`));
  }
  assert.match(source, /Show more/);
  assert.match(source, /rowLimit/);
  assert.match(source, /profileService\.get/);
  assert.match(source, /profile-not-published|not published/i);
});

test('Semantic provenance rows remain present after Gameplay integration', () => {
  const source = read('web/fullworld-creatures.mjs');
  for (const label of ['Record', 'Entity', 'Origin', 'Authority', 'Semantic digest', 'Presentation']) {
    assert.match(source, new RegExp(`createTextRow\\('${label}'`));
  }
});

test('Details keeps the inspector tablist visible when Gameplay opens', () => {
  const source = read('web/fullworld-creatures.mjs');
  assert.doesNotMatch(source, /state\.inspector\?\.scrollIntoView/);
  assert.match(source, /closest\(['"]\.inspector['"]\)/);
  assert.match(source, /scrollTo\(\{\s*top:\s*0/);
});