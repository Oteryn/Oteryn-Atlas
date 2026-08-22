import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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

await import('./fullworld-runtime/runtime.test.mjs');
await import('./fullworld-runtime/performance.test.mjs');

const fullworldIndex = await readFile(new URL('../web/fullworld.html', import.meta.url), 'utf8');
const fullworldApp = await readFile(new URL('../web/fullworld-app.mjs', import.meta.url), 'utf8');
const fullworldCss = await readFile(new URL('../web/fullworld.css', import.meta.url), 'utf8');
const fullworldMobile = await readFile(new URL('../web/fullworld-mobile.mjs', import.meta.url), 'utf8');
const fullworldTrust = await readFile(new URL('../src/browser/fullworld-trust.mjs', import.meta.url), 'utf8');
const fullworldRenderer = await readFile(new URL('../src/browser/fullworld-webgl.mjs', import.meta.url), 'utf8');
const worldQuery = await readFile(new URL('../src/browser/world-query.mjs', import.meta.url), 'utf8');
const qualifier = await readFile(new URL('../tools/fullworld-runtime/qualify_browser.mjs', import.meta.url), 'utf8');

test('full-world browser modules parse as JavaScript', () => {
  for (const relative of ['../web/fullworld-app.mjs', '../web/fullworld-minimap.mjs', '../web/fullworld-mobile.mjs']) {
    execFileSync(process.execPath, ['--check', fileURLToPath(new URL(relative, import.meta.url))], { stdio: 'pipe' });
  }
});
test('full-world GUI is a separate verified runtime entry while bounded proof remains regression fixture', () => {
  assert.match(fullworldIndex, /FULL-WORLD VERIFIED RUNTIME/);
  assert.match(fullworldIndex, /Technical overview/);
  assert.match(fullworldIndex, /id="minimap-layer"/);
  assert.match(fullworldIndex, /data-mode="auto"/);
  assert.match(fullworldIndex, /id="floor-select"/);
  assert.match(fullworldIndex, /id="animation-toggle"[^>]*disabled/);
  assert.match(fullworldApp, /SemanticRangeStore/);
  assert.match(fullworldApp, /loadOverviewWorld/);
  assert.match(fullworldApp, /mode: next\.mode \?\? 'auto'/);
  assert.match(fullworldApp, /requiredRuntimePixelBuckets/);
  assert.doesNotMatch(fullworldApp, /\.otbm|Legacy IR|world\.otbm/);
});

test('full-world GUI pins exact G3/G4/runtime roots and keeps blocked semantics disabled', () => {
  for (const root of [
    'sha256:9d0d2f3bb16a5a90f9b51a21366e4ed42963f5cb12366c404a20d9502ec4857f',
    'sha256:27d7a83a7d9f498ea614b440ab4216cae5e6d11ea0527482410e40948cade5a9',
    'sha256:8b8228fcc4574903e547cb7d65b96f3d45e5a9e67045091c1bceb6e54d3690ad',
    'sha256:17683912d6758796d80a5b1647e2d0031f6849e51c40ae5264da6cfce3f9d6db',
    'sha256:fa30ae5fc47f0ca8a6d482ed87b5db2cd74f32f7f523df16187ca719b8e04f08',
    'sha256:99cf23b01a0d652ff670a994a2b80cbef8d17036f514522d47f1aa98352d3116',
    'sha256:23f4d2c3901673fb38980e2600828145a6d0626c0e44d1d9f5ca23bfbce02268',
  ]) assert.ok(fullworldTrust.includes(root));
  assert.match(fullworldTrust, /id: 'npcs'.*status: 'BLOCKED'.*enabled: false/s);
  assert.match(fullworldTrust, /id: 'monsters-spawns'.*status: 'BLOCKED'.*enabled: false/s);
  assert.match(fullworldTrust, /animation: Object\.freeze\([\s\S]*enabled: false/);
});

test('full-world WebGL renderer preserves semantic order in one batched draw', () => {
  assert.match(fullworldRenderer, /sampler2DArray u_pixels/);
  assert.match(fullworldRenderer, /a_geometry/);
  assert.match(fullworldRenderer, /a_pixel/);
  assert.match(fullworldRenderer, /record\.x\*32-\(p\.widthUnits-32\)\+p\.displacement\.dxUnits/);
  assert.match(fullworldRenderer, /gl\.drawArraysInstanced\(gl\.TRIANGLES/);
  assert.match(fullworldRenderer, /const drawCalls=instanceCount>0\?1:0/);
});

test('full-world renderer keeps evidence synchronization and capture opt-in only', () => {
  assert.match(fullworldRenderer, /preserveDrawingBuffer:options\.capture===true/);
  assert.match(fullworldRenderer, /if\(options\.synchronousEvidence===true\)gl\.finish\(\)/);
  assert.doesNotMatch(fullworldRenderer, /preserveDrawingBuffer:true/);
});

test('full-world app coalesces interactive rendering and uses stable verified pixel buckets', () => {
  assert.match(fullworldApp, /createFrameScheduler/);
  assert.match(fullworldApp, /scheduleRender\('drag'\)/);
  assert.match(fullworldApp, /loadRuntimePixelBuckets/);
  assert.match(fullworldApp, /loadVerifiedPixelBucket/);
  assert.match(fullworldApp, /VerifiedContentCache/);
});

test('full-world runtime exposes World Query boundary, budgets and measured acceptance telemetry', () => {
  assert.match(worldQuery, /createWorldQueryApi/);
  assert.match(worldQuery, /selectViewportGroups/);
  assert.match(fullworldApp, /worldQuery\.selectViewportGroups/);
  assert.match(fullworldApp, /maxLoadedChunks/);
  assert.match(fullworldApp, /cacheHitRatio/);
  assert.match(fullworldApp, /browserRamReason/);
  assert.match(qualifier, /browserProcessPeakRssBytes/);
  assert.match(qualifier, /processTreeRssBytes/);
});

test('full-world mobile layout keeps the map full-width and moves controls into overlays', () => {
  for (const id of [
    'mobile-controls-toggle',
    'mobile-inspector-toggle',
    'mobile-controls-panel',
    'mobile-inspector-panel',
    'mobile-drawer-backdrop',
    'mobile-search-form',
  ]) assert.match(fullworldIndex, new RegExp(`id="${id}"`));
  assert.match(fullworldIndex, /fullworld-mobile\.mjs/);
  assert.match(fullworldCss, /@media \(max-width: 980px\)/);
  assert.match(fullworldCss, /\.fullworld-shell \.workspace \{ grid-template-columns: minmax\(0, 1fr\); position: relative; overflow: hidden; \}/);
  assert.match(fullworldCss, /\.fullworld-shell \.left-rail, \.fullworld-shell \.inspector \{[\s\S]*position: absolute/);
  assert.match(fullworldCss, /\.fullworld-diagnostics \{ display: none; \}/);
  assert.match(fullworldCss, /#atlas \{ touch-action: none; \}/);
  assert.match(fullworldMobile, /function setMobileDrawer/);
  assert.match(fullworldMobile, /desktopForm\.requestSubmit\(\)/);
  assert.doesNotMatch(fullworldMobile, /\.otbm|Legacy IR|world\.otbm/);
});
