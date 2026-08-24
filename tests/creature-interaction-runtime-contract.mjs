import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../web/fullworld.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../web/fullworld.css', import.meta.url), 'utf8');
const creatures = await readFile(new URL('../web/fullworld-creatures.mjs', import.meta.url), 'utf8');
const mobile = await readFile(new URL('../web/fullworld-mobile.mjs', import.meta.url), 'utf8');

test('FullWorld owns exactly one accessible reusable creature quick card', () => {
  assert.equal((html.match(/id="creature-quick-card"/g) ?? []).length, 1);
  assert.match(html, /id="creature-quick-card"[^>]*role="dialog"/);
  assert.match(html, /id="creature-card-close"/);
  assert.match(html, /id="creature-card-details"/);
  assert.match(html, /id="creature-card-copy"/);
  assert.match(html, /id="creature-card-link-fallback"[^>]*readonly/);
  assert.match(css, /\.creature-quick-card[\s\S]*z-index: 20/);
});

test('creature runtime builds committed targets and claims only valid map activation hits', () => {
  assert.match(creatures, /createCreatureInteractionTarget/);
  assert.match(creatures, /buildCreatureInteractionIndex/);
  assert.match(creatures, /queryCreatureHits/);
  assert.match(creatures, /oteryn-atlas-map-activate/);
  assert.match(creatures, /event\.preventDefault\(\)/);
  assert.match(creatures, /interactionVersion: 'creature-interaction-v1'/);
  assert.match(creatures, /rendererGeneration/);
});
test('quick card actions are truthful and mobile inspector opens through an event seam', () => {
  assert.match(creatures, /navigator\.clipboard\?\.writeText/);
  assert.match(creatures, /creature-card-link-fallback/);
  assert.match(creatures, /oteryn-atlas-open-inspector/);
  assert.match(mobile, /oteryn-atlas-open-inspector/);
  assert.match(mobile, /openDrawer\('inspector'\)/);
});

test('card escape respects a mobile drawer layered above it', () => {
  assert.match(creatures, /mobile-drawer-backdrop/);
  assert.match(creatures, /event\.key === 'Escape'/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.creature-quick-card/);
});
