import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('geometry desktop keeps the real-monster production entry separate from qualification navigation', () => {
  const source = fs.readFileSync(path.join(ROOT, 'e2e/tests/geometry-desktop.spec.mjs'), 'utf8');
  const productionEntry = '/web/fullworld.html?x=33018&y=32009&floor=-7&zoom=2&mode=map&animation=off&creatures=npc,monster';

  assert.match(source, /const MONSTER_ENTRY = isQualificationFixtureExecution\(\)/);
  assert.ok(source.includes(productionEntry), `geometry desktop must retain protected production monster entry ${productionEntry}`);
});
