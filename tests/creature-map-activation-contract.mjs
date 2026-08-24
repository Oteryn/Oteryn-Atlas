import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../web/fullworld-app.mjs', import.meta.url), 'utf8');

test('map pointer-up exposes the cancelable creature activation seam before tile selection', () => {
  assert.match(app, /import \{ dispatchMapActivation \} from '\.\.\/src\/browser\/map-activation\.mjs'/);
  assert.match(app, /dispatchMapActivation\(window, \{/);
  assert.match(app, /cssX:/);
  assert.match(app, /worldX:/);
  assert.match(app, /rendererGeneration:/);
  assert.match(app, /if \(!claimed\) \{/);
  assert.match(app, /let shouldRefresh = wasMoved/);
  assert.match(app, /if \(!claimed\) \{\s+shouldRefresh = true/);
  assert.match(app, /if \(shouldRefresh\) scheduleRefresh\(0\)/);
  const dispatchAt = app.indexOf('dispatchMapActivation(window, {');
  const tileSelectionAt = app.indexOf('const target = { floor:', dispatchAt);
  assert(dispatchAt >= 0 && tileSelectionAt > dispatchAt);
});
