import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../web/fullworld-creatures.mjs', import.meta.url), 'utf8');

test('creature view animation transitions reprepare frames instead of repainting stale prepared bitmaps', () => {
  assert.match(source, /creatureAnimationTransition/);
  assert.match(source, /requiresReprepare/);
  assert.match(source, /requiresReprepare\s*\?\s*redrawPreparedForCurrentState\(\)/);
  assert.doesNotMatch(source, /applyView\(event\.detail\.view\);[\s\S]{0,160}repaintPreparedForCurrentState\(\);[\s\S]{0,80}refresh\(\)/);
});
