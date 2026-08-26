import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');
const fullworldAppPath = 'web/fullworld-app.mjs';
const creaturesPath = 'web/fullworld-creatures.mjs';

const expectedProfiles = [
  ['firefox-desktop', 'firefox', 'desktop', 1440, 900],
  ['firefox-mobile-like', 'firefox', 'mobile-like', 390, 844],
  ['webkit-desktop', 'webkit', 'desktop', 1440, 900],
  ['webkit-mobile-like', 'webkit', 'mobile-like', 390, 844],
];

test('cross-browser matrix is explicit, bounded and keeps Chromium primary', async () => {
  const matrixPath = path.join(root, 'e2e/browser-matrix.json');
  assert.equal(existsSync(matrixPath), true, 'browser matrix must exist');
  const matrix = JSON.parse(await read('e2e/browser-matrix.json'));
  assert.equal(matrix.version, 1);
  assert.equal(matrix.primaryBrowser, 'chromium');
  assert.equal(matrix.depthMode, 'cross-browser');
  assert.deepEqual(matrix.profiles.map((profile) => [
    profile.name, profile.browserName, profile.surface,
    profile.viewport.width, profile.viewport.height,
  ]), expectedProfiles);
  for (const profile of matrix.profiles) {
    assert.equal('isMobile' in profile, false, `${profile.name} must not force isMobile emulation`);
    assert.equal(profile.retries, 0);
  }
  for (const profile of matrix.profiles.filter(({ surface }) => surface === 'mobile-like')) {
    assert.equal(profile.hasTouch, true, `${profile.name} must exercise supported touch input`);
  }
});

test('Playwright exposes cross-browser projects only in explicit depth mode', async () => {
  const config = await read('e2e/playwright.config.mjs');
  const dockerfile = await read('e2e/Dockerfile');
  const compose = await read('e2e/compose.yml');
  assert.match(config, /browser-matrix\.json/);
  assert.equal((config.match(/testIgnore:\s*\/cross-browser-/g) ?? []).length, 2,
    'both primary Chromium projects must exclude cross-browser-only specs');
  assert.match(config, /depth === browserMatrix\.depthMode/);
  assert.match(config, /name:\s*profile\.name/);
  assert.match(config, /browserName:\s*profile\.browserName/);
  assert.match(config, /hasTouch:\s*profile\.hasTouch/);
  assert.doesNotMatch(config, /profile\.isMobile/);
  assert.match(dockerfile, /browser-matrix\.json/);
  assert.match(compose, /ATLAS_E2E_DEPTH:\s*\$\{ATLAS_E2E_DEPTH:-required\}/);
  assert.match(config, /retries:\s*0/);
});
test('cross-browser journeys cover behavior, layout and engine identity without raster baselines', async () => {
  const desktop = await read('e2e/tests/cross-browser-desktop.spec.mjs');
  const mobile = await read('e2e/tests/cross-browser-mobile.spec.mjs');
  for (const source of [desktop, mobile]) {
    assert.match(source, /captureRuntimeFailures/);
    assert.match(source, /assertNoRuntimeFailures/);
    assert.match(source, /assertUserVisibleSurface/);
    assert.match(source, /browserName/);
    assert.doesNotMatch(source, /toHaveScreenshot/);
  }
  assert.match(desktop, /semantic/i);
  assert.match(desktop, /history|goBack/);
  assert.match(desktop, /animation|playback/i);
  assert.match(desktop, /renderer|framebuffer/i);
  assert.match(mobile, /tap\(/);
  assert.match(mobile, /landscape/i);
  assert.match(mobile, /Zoom in/);
  assert.match(mobile, /Exported floor/);
  assert.match(mobile, /Stable public id/);
  assert.match(mobile, /toBeFocused/);
  assert.match(desktop, /stableCreatureEvidence/);
  assert.match(desktop, /toEqual\(staticEvidence\)/);
});

test('mobile cross-browser acceptance proves the top drawer before scrolling to deep controls', async () => {
  const mobile = await read('e2e/tests/cross-browser-mobile.spec.mjs');
  const drawerOpen = mobile.indexOf('await controls.tap()');
  const controlsSettled = mobile.indexOf('await waitForControlsDrawerSettled(page)');
  const topSurface = mobile.indexOf('label: `${browserName} mobile-like controls`');
  const floorScroll = mobile.indexOf('await floorSelect.scrollIntoViewIfNeeded()');
  const floorAction = mobile.indexOf('if (await higherFloor.isEnabled()) await higherFloor.tap()');
  const searchReturn = mobile.indexOf('await mobileSearch.scrollIntoViewIfNeeded()');
  const searchFill = mobile.indexOf("await mobileSearch.fill('Thais')");
  assert(drawerOpen >= 0, 'mobile drawer must be opened by touch');
  assert(controlsSettled > drawerOpen, 'controls drawer geometry must settle after the touch open action');
  assert(topSurface > controlsSettled, 'top drawer acceptance must wait for settled controls geometry');
  assert(floorScroll > topSurface, 'deep floor control scrolling must follow top drawer acceptance');
  assert(floorAction > floorScroll, 'floor action must only run after its control is explicitly brought into view');
  assert(searchReturn > floorAction, 'search must be brought back into view after the deep floor action');
  assert(searchFill > searchReturn, 'semantic search must be filled only after it is back in view');
});
test('pinned browser availability probe launches both secondary engines with touch context', async () => {
  const probe = await read('e2e/support/browser-availability.mjs');
  assert.match(probe, /firefox/);
  assert.match(probe, /webkit/);
  assert.match(probe, /\.launch\(/);
  assert.match(probe, /hasTouch:\s*true/);
  assert.match(probe, /browser-availability\.json/);
  assert.match(probe, /touchstart/);
  assert.match(probe, /touchend/);
  assert.match(probe, /pointerType/);
  assert.doesNotMatch(probe, /maxTouchPoints\s*<\s*1/);
  assert.doesNotMatch(probe, /isMobile/);
});

test('Molehill depth executes all cross-browser projects sequentially', async () => {
  const workflow = await read('.github/workflows/verification-depth.yml');
  assert.match(workflow, /ATLAS_E2E_DEPTH=cross-browser/);
  let previous = -1;
  for (const [name] of expectedProfiles) {
    const marker = `--project=${name}`;
    const at = workflow.indexOf(marker);
    assert(at > previous, `${marker} must exist once in sequential matrix order`);
    assert.equal(workflow.indexOf(marker, at + 1), -1, `${marker} must not be duplicated`);
    previous = at;
  }
  assert.match(workflow, /cross-browser-browser-probe/);
  assert.match(workflow, /oteryn-atlas-heavy-e2e\.lock/);
  assert.match(workflow, /FileShare\]::None/);
  assert.match(workflow, /lockStream\.Dispose\(\)/);
});

test('cross-browser failure evidence identifies revision, project and engine', async () => {
  const reporter = await read('e2e/summary-reporter.mjs');
  assert.match(reporter, /atlasRevision:/);
  assert.match(reporter, /project:/);
  assert.match(reporter, /browserName:/);
  assert.match(reporter, /projects:/);
});

test('verification docs distinguish primary Chromium pixels from cross-engine behavior', async () => {
  const platform = await read('docs/testing/ATLAS-VERIFICATION-PLATFORM.md');
  const readme = await read('e2e/README.md');
  for (const source of [platform, readme]) {
    assert.match(source, /Firefox/);
    assert.match(source, /WebKit/);
    assert.match(source, /Chromium/);
    assert.match(source, /cross-browser/i);
  }
  assert.match(platform, /primary.*Chromium/i);
  assert.match(platform, /pixel baseline/i);
  assert.match(platform, /behavior|behaviour/i);
});


test('Firefox secondary profiles use headed Xvfb and the pinned probe proves WebGL2', async () => {
  const matrix = JSON.parse(await read('e2e/browser-matrix.json'));
  const config = await read('e2e/playwright.config.mjs');
  const workflow = await read('.github/workflows/verification-depth.yml');
  const probe = await read('e2e/support/browser-availability.mjs');
  for (const profile of matrix.profiles.filter(({ browserName }) => browserName === 'firefox')) {
    assert.equal(profile.headless, false, `${profile.name} must use a headed Xvfb display for WebGL2`);
  }
  for (const profile of matrix.profiles.filter(({ browserName }) => browserName === 'webkit')) {
    assert.equal(profile.headless, true, `${profile.name} stays explicitly headless`);
  }
  assert.match(config, /headless:\s*profile\.headless/);
  assert.match(probe, /headless:\s*profile\.headless|headless:\s*browserName\s*!==\s*'firefox'/);
  assert.match(probe, /getContext\(['"]webgl2['"]\)/);
  assert.match(workflow, /cross-browser-browser-probe[\s\S]{0,400}xvfb-run/);
  assert.match(workflow, /cross-browser-firefox-desktop[\s\S]{0,400}xvfb-run/);
  assert.match(workflow, /cross-browser-firefox-mobile-like[\s\S]{0,400}xvfb-run/);
});


test('departing FullWorld documents cannot emit false fail-closed runtime state', async () => {
  const app = await read(fullworldAppPath);
  const creatures = await read(creaturesPath);
  assert.match(app, /let pageUnloading\s*=\s*false/);
  assert.match(app, /addEventListener\('beforeunload',\s*markPageUnloading/);
  assert.match(app, /addEventListener\('pagehide',\s*markPageUnloading/);
  assert.match(app, /function failClosed\(error\)[\s\S]{0,140}if \(pageUnloading\) return/);
  assert.match(creatures, /let pageUnloading\s*=\s*false/);
  assert.match(creatures, /addEventListener\('beforeunload',\s*markPageUnloading/);
  assert.match(creatures, /addEventListener\('pagehide',\s*markPageUnloading/);
  assert.match(creatures, /function fail\(message\)[\s\S]{0,140}if \(pageUnloading\) return/);
});

test('cross-browser journeys wait for settled mobile geometry and rotate strict failure collectors by document', async () => {
  const desktop = await read('e2e/tests/cross-browser-desktop.spec.mjs');
  const mobile = await read('e2e/tests/cross-browser-mobile.spec.mjs');
  assert.match(mobile, /mobile-inspector-panel[\s\S]{0,300}getBoundingClientRect/);
  assert.match(mobile, /rect\.right[\s\S]{0,120}innerWidth/);
  assert.match(desktop, /framenavigated/);
  assert.match(mobile, /framenavigated/);
  assert.match(desktop, /captureRuntimeFailures/);
  assert.match(mobile, /captureRuntimeFailures/);
});

test('semantic cross-browser navigation keeps same-document history state coherent', async () => {
  const app = await read(fullworldAppPath);
  const search = await read('web/fullworld-search.mjs');
  assert.doesNotMatch(search, /location\.search\s*=\s*params\.toString\(\)/);
  assert.match(search, /history\.pushState\(/);
  assert.match(search, /function activeRecordFromLocation\(\)/);
  assert.match(search, /function syncActiveFromLocation\(\)/);
  assert.match(search, /window\.addEventListener\('popstate',\s*syncActiveFromLocation\)/);
  assert.match(search, /if \(!record\)[\s\S]{0,160}removeActiveLayer\(\)/);
  assert.match(app, /syncViewUi\(\{ preserveExternalParams: options\.preserveExternalParams \?\? false \}\)/);
  assert.match(app, /window\.addEventListener\('popstate',\s*syncHistoryView\)/);
  assert.match(app, /window\.addEventListener\('oteryn-atlas-semantic-navigation',\s*syncHistoryView\)/);
});

test('same-document refresh invalidates stale PASS before async qualification', async () => {
  const app = await read(fullworldAppPath);
  assert.match(app, /function scheduleRefresh\(delay = 100\) \{[\s\S]{0,180}clearTimeout\(refreshTimer\);[\s\S]{0,120}publishQualification\('PENDING'\);[\s\S]{0,180}setTimeout\(\(\) => refreshScene\(\)/);
  assert.match(app, /publishQualification\('PASS'\)/);
  assert.match(app, /function failClosed\(error\)[\s\S]{0,500}publishQualification\('FAIL', error\)/);
});


test('same-document semantic selection dismisses transient results before inspector acceptance', async () => {
  const search = await read('web/fullworld-search.mjs');
  const desktop = await read('e2e/tests/cross-browser-desktop.spec.mjs');
  const mobile = await read('e2e/tests/cross-browser-mobile.spec.mjs');
  assert.match(search, /function navigate\(record, rawQuery, host\)[\s\S]{0,220}hideResults\(host\)[\s\S]{0,220}history\.pushState/);
  assert.match(search, /navigate\(record, query, host\)/);
  assert.match(desktop, /await expect\(results\)\.toBeHidden\(\)/);
  assert.match(mobile, /await expect\(results\)\.toBeHidden\(\)/);
});
