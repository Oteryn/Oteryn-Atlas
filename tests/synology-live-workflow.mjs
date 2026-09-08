import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const livePreview = readFileSync(new URL('../e2e/tests/live-creature-preview.cjs', import.meta.url), 'utf8');

test('retained live Chromium entrypoint binds Sam trade and Rat loot assertions', () => {
  assert.match(livePreview, /npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e/);
  assert.match(livePreview, /monster-entity:80295e51265b3662bfbea2ea01ee3ccb/);
  assert.match(livePreview, /20 gold/);
  assert.match(livePreview, /gold coin/);
  assert.match(livePreview, /100%/);
  assert.match(livePreview, /inspector.*gameplay/i);
});

test('live Semantic assertions explicitly select Semantic because Gameplay is default', () => {
  const desktopStart = livePreview.indexOf('async function runDesktop');
  const mobileStart = livePreview.indexOf('async function runMobile');
  assert.ok(desktopStart >= 0 && mobileStart > desktopStart);

  for (const body of [livePreview.slice(desktopStart, mobileStart), livePreview.slice(mobileStart)]) {
    const search = body.indexOf('await searchAndSelect(');
    const assertion = body.indexOf('assertCreatureInspector(', search);
    assert.ok(search >= 0 && assertion > search);
    const between = body.slice(search, assertion);
    assert.match(between, /#inspector-tab-semantic/);
    assert.match(between, /aria-selected/);
  }
});
