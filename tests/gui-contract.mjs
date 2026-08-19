import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const index = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../web/app.mjs', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../src/browser/webgl.mjs', import.meta.url), 'utf8');

test('GUI exposes only the bounded factual proof as active', () => {
  assert.match(index, /Base semantic pixels <span>ON<\/span>/);
  for (const label of ['NPCs', 'Monsters', 'Teleports', 'Houses / doors', 'Action / Unique IDs', 'Towns / temples', 'Mechanics / raids / POIs']) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(index, new RegExp(`class="layer disabled"[^>]*>[\\s\\S]*?${escaped} <span>N/A<\\/span>`));
  }
  assert.match(index, /Only exported floor −7 exists in this bounded proof/);
  assert.match(index, /Minimap <span>DEFERRED<\/span>/);
});

test('browser application uses verified semantic and pixel publications', () => {
  assert.match(app, /proof\/semantic\/manifest\.json/);
  assert.match(app, /proof\/pixels\/manifest\.json/);
  assert.match(app, /createWebGLRenderer/);
  assert.doesNotMatch(app, /getContext\(['"]2d['"]\)/);
  assert.doesNotMatch(app, /\.otbm|Legacy IR|world\.otbm/);
});

test('renderer is real WebGL2 and uses the accepted visual origin rule', () => {
  assert.match(renderer, /getContext\(['"]webgl2['"]/);
  assert.match(renderer, /record\.x \* 32 - \(primitive\.widthUnits - 32\) \+ primitive\.displacement\.dxUnits/);
  assert.match(renderer, /record\.y \* 32 - \(primitive\.heightUnits - 32\) \+ primitive\.displacement\.dyUnits/);
  assert.match(renderer, /gl\.drawArrays\(gl\.TRIANGLES/);
});

test('GUI source does not advertise fabricated performance claims', () => {
  for (const fabricated of ['60 FPS', 'cache hit rate', 'full world complete']) {
    assert.ok(!index.includes(fabricated));
    assert.ok(!app.includes(fabricated));
  }
});
