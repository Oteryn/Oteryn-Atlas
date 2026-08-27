import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const INVENTORY_PATH = path.join(ROOT, 'tools/verification/e2e-data-capability-inventory.json');
const FUNCTIONAL_SPEC = path.join(ROOT, 'e2e/tests/visual-desktop.spec.mjs');
const FULLWORLD_SPEC = path.join(ROOT, 'e2e/tests/visual-fullworld-desktop.spec.mjs');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

test('complete animation coverage is isolated from ordinary desktop visual acceptance', () => {
  const inventory = readJson(INVENTORY_PATH);
  const functional = inventory.specs.find((entry) => entry.spec === 'e2e/tests/visual-desktop.spec.mjs');
  const fullworld = inventory.specs.find((entry) => entry.spec === 'e2e/tests/visual-fullworld-desktop.spec.mjs');

  assert.ok(functional, 'ordinary desktop visual spec must remain inventoried');
  assert.equal(functional.dataCapability, 'bounded_real_world');
  assert.equal(functional.splitRequired, false);

  assert.ok(fullworld, 'complete-product visual oracle must have a dedicated spec');
  assert.equal(fullworld.dataCapability, 'real_fullworld');
  assert.equal(fullworld.splitRequired, false);

  const functionalSource = fs.readFileSync(FUNCTIONAL_SPEC, 'utf8');
  const fullworldSource = fs.readFileSync(FULLWORLD_SPEC, 'utf8');
  assert.doesNotMatch(functionalSource, /full authoritative coverage census/i);
  assert.doesNotMatch(functionalSource, /analyzeCreatureAnimationCoverage/);
  assert.match(fullworldSource, /full authoritative coverage census/i);
  assert.match(fullworldSource, /analyzeCreatureAnimationCoverage/);
});
