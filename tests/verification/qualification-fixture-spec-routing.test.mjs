import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-catalog.json'), 'utf8'));
const Q_SELECTED_SPECS = Object.freeze(CATALOG.groups['e2e.full'].specs);
const FIXTURE_SCENARIO_SPECS = Object.freeze([
  'e2e/tests/audit-desktop.spec.mjs',
  'e2e/tests/creature-interaction-desktop.spec.mjs',
  'e2e/tests/creature-interaction-mobile.spec.mjs',
  'e2e/tests/creature-presentation-desktop.spec.mjs',
  'e2e/tests/creature-presentation-mobile.spec.mjs',
  'e2e/tests/creatures-desktop.spec.mjs',
  'e2e/tests/degraded-search-desktop.spec.mjs',
  'e2e/tests/desktop.spec.mjs',
  'e2e/tests/farm-explorer-desktop.spec.mjs',
  'e2e/tests/farm-explorer-mobile.spec.mjs',
  'e2e/tests/geometry-desktop.spec.mjs',
  'e2e/tests/geometry-mobile.spec.mjs',
  'e2e/tests/layer-audit-desktop.spec.mjs',
  'e2e/tests/mobile.spec.mjs',
  'e2e/tests/performance-desktop.spec.mjs',
  'e2e/tests/race-desktop.spec.mjs',
  'e2e/tests/render-probes-desktop.spec.mjs',
  'e2e/tests/responsive-mobile.spec.mjs',
  'e2e/tests/soak-desktop.spec.mjs',
  'e2e/tests/state-desktop.spec.mjs',
  'e2e/tests/stress-desktop.spec.mjs',
]);
const RUNTIME_DEFAULT_SPECS = Object.freeze([
  'e2e/tests/accessibility-desktop.spec.mjs',
  'e2e/tests/accessibility-mobile.spec.mjs',
  'e2e/tests/audit-mobile.spec.mjs',
  'e2e/tests/resilience-desktop.spec.mjs',
  'e2e/tests/scale-desktop.spec.mjs',
  'e2e/tests/user-journey-desktop.spec.mjs',
  'e2e/tests/user-journey-mobile.spec.mjs',
  'e2e/tests/workflows-desktop.spec.mjs',
]);
const DUAL_BOUND_VISUAL_SPECS = Object.freeze([
  'e2e/tests/visual-desktop.spec.mjs',
  'e2e/tests/visual-mobile.spec.mjs',
]);

const HISTORICAL_Q_MARKERS = /(?:x=32361|x=32364|x=33018|x=32831|x=32724|x=32209|Cave Rat)/;
const DIRECT_FULLWORLD_ROUTE = /(?:gotoAtlas\(\s*page\s*,\s*['"`]\/web\/fullworld\.html|page\.goto\(\s*['"`]\/web\/fullworld\.html)/;

test('every protected Q-selected spec has exactly one source-routing authority', () => {
  const covered = [...FIXTURE_SCENARIO_SPECS, ...RUNTIME_DEFAULT_SPECS, ...DUAL_BOUND_VISUAL_SPECS].sort();
  assert.deepEqual(covered, [...Q_SELECTED_SPECS].sort());
});

test('coordinate and factual Q specs bind only named trusted fixture scenarios', () => {
  for (const relative of FIXTURE_SCENARIO_SPECS) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.match(source, /qualification-fixture-scenarios\.mjs/, `${relative} must use a named fixture scenario`);
    assert.doesNotMatch(source, HISTORICAL_Q_MARKERS, `${relative} must not retain historical Game coordinates or identities`);
    assert.doesNotMatch(source, DIRECT_FULLWORLD_ROUTE, `${relative} must not navigate through a literal FullWorld route`);
  }
});

test('default and dual-bound Q specs retain their distinct protected routing authorities', () => {
  for (const relative of RUNTIME_DEFAULT_SPECS) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.match(source, /from '\.\/runtime\.mjs'/, `${relative} must retain the protected default-entry resolver`);
    assert.doesNotMatch(source, HISTORICAL_Q_MARKERS, `${relative} must not retain historical Game coordinates or identities`);
    assert.doesNotMatch(source, DIRECT_FULLWORLD_ROUTE, `${relative} must not navigate through a literal FullWorld route`);
  }
  for (const relative of DUAL_BOUND_VISUAL_SPECS) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.match(source, /visual-source-scenarios\.mjs/, `${relative} must select the Q/B source by trusted capability`);
    assert.doesNotMatch(source, /qualification-fixture-scenarios\.mjs/, `${relative} must not hard-code the Q source over its bounded-real obligation`);
    assert.doesNotMatch(source, DIRECT_FULLWORLD_ROUTE, `${relative} must not navigate through a literal FullWorld route`);
  }
});
