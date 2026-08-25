'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const visualOracle = import('../support/visual-oracle.mjs');

const preview = process.env.PREVIEW_URL;
const expectedRevision = process.env.ATLAS_REV;
const expectedDigest = process.env.CREATURE_SEMANTIC_DIGEST;
const expectedGameplayDigest = process.env.CREATURE_GAMEPLAY_DIGEST;
const expectedGameplayGameRev = process.env.GAMEPLAY_GAME_REV;
const GAMEPLAY_FIXTURES = Object.freeze({
  sam: Object.freeze({ entityId: 'npc-entity:f8d4f0200616061ffa4ae0b4c38c6d3e', label: 'Sam', kind: 'npc' }),
  rat: Object.freeze({ entityId: 'monster-entity:80295e51265b3662bfbea2ea01ee3ccb', label: 'Rat', kind: 'monster' }),
});
const targets = JSON.parse(fs.readFileSync('/targets.json', 'utf8'));
const evidenceDir = '/evidence';
const STATIC_EQUIVALENT_PRESENTATION = 'outfit-presentation:sha256:b16bfc92e9d9e9c8f790507f987a11b25a169c4343c9d68471de76a5f3565c88';
const EXPECTED_ANIMATION_COVERAGE = {
  multiPhasePrograms: 101,
  phaseContentReferences: 2036,
  phaseCountHistogram: { 1: 1276, 2: 2, 3: 4, 4: 4, 6: 1, 8: 88, 9: 2 },
  staticEquivalentProgramIds: [STATIC_EQUIVALENT_PRESENTATION],
  totalPrograms: 1377,
  visuallyDynamicPrograms: 100,
};
fs.mkdirSync(evidenceDir, { recursive: true });

assert.match(preview ?? '', /^https?:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/);
assert.match(expectedRevision ?? '', /^[0-9a-f]{40}$/);
assert.match(expectedDigest ?? '', /^sha256:[0-9a-f]{64}$/);
assert.match(expectedGameplayDigest ?? '', /^sha256:[0-9a-f]{64}$/);
assert.match(expectedGameplayGameRev ?? '', /^[0-9a-f]{40}$/);
assert.equal(targets.npc.kind, 'npc');
assert.ok(Array.isArray(targets.npc.roles) && targets.npc.roles.includes('shop'));
assert.equal(targets.monster.kind, 'monster');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isRelevantRuntimeUrl(value) {
  try {
    const { pathname } = new URL(value);
    return pathname.startsWith('/data/creatures/') || pathname.startsWith('/fullworld/') || pathname.startsWith('/web/creature-gameplay/') || pathname === '/web/fullworld.html' || pathname.startsWith('/web/fullworld-');
  } catch {
    return false;
  }
}

function watchRelevantErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && /creature|semantic|fullworld/i.test(message.text())) {
      errors.push(`console.error: ${message.text()}`);
    }
  });
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'unknown';
    if (isRelevantRuntimeUrl(request.url()) && errorText !== 'net::ERR_ABORTED') errors.push(`requestfailed: ${request.url()} ${errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && isRelevantRuntimeUrl(response.url())) errors.push(`http ${response.status()}: ${response.url()}`);
  });
  return errors;
}

async function diagnostic(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__ ?? null);
}

async function semanticDiagnostic(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__ ?? null);
}

async function publishedAnimationCoverage(page) {
  const { analyzeCreatureAnimationCoverage } = await import('../support/creature-animation-coverage.mjs');
  const manifestResponse = await page.request.get(`${preview}/fullworld/animation/manifest.json`);
  assert.equal(manifestResponse.status(), 200);
  const manifest = await manifestResponse.json();
  const programsResponse = await page.request.get(`${preview}/fullworld/animation/programs.json`);
  assert.equal(programsResponse.status(), 200);
  const bytes = await programsResponse.body();
  assert.equal(bytes.byteLength, manifest.programs.bytes);
  assert.equal(`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`, manifest.programs.digest);
  const coverage = analyzeCreatureAnimationCoverage(JSON.parse(bytes.toString('utf8')));
  assert.equal(coverage.totalPrograms, manifest.counts.creature_programs);
  assert.deepEqual(coverage, EXPECTED_ANIMATION_COVERAGE);
  return coverage;
}

async function captureCreaturePixelState(page) {
  const { canvasPng } = await visualOracle;
  return canvasPng(page, '#creature-overlay');
}

async function waitForCreaturePixelState(page, baseline, shouldEqual, label) {
  const { exactPngPixelsEqual } = await visualOracle;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const current = await captureCreaturePixelState(page);
    if ((await exactPngPixelsEqual(page, baseline, current)) === shouldEqual) return current;
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
  throw new Error(`creature pixel state timeout: ${label}`);
}

async function waitSemanticReady(page) {
  await page.waitForFunction(() => {
    const value = globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__;
    return value?.status === 'PASS' && value.creatureSearchRecords === 1945;
  }, null, { timeout: 120_000 });
  const value = await semanticDiagnostic(page);
  assert.equal(value.status, 'PASS');
  assert.equal(value.creatureSearchRecords, 1945);
  return value;
}

async function waitReady(page, { selectedId = null, npc = true, monster = true } = {}) {
  try {
    await page.waitForFunction(
      ({ digest, selected, wantNpc, wantMonster }) => {
        const value = globalThis.__OTERYN_ATLAS_CREATURES__;
        if (!value || value.status !== 'PASS') return false;
        if (value.sourceSemanticDigest !== digest) return false;
        if (value.cacheChunks > 96 || value.drawnRecords < 1 || value.pixelDrawnRecords < 1) return false;
        if (!value.animationRuntime || value.animationRuntime.creaturePrograms !== 1377) return false;
        if (value.enabled?.npc !== wantNpc || value.enabled?.monster !== wantMonster) return false;
        if (selected && (value.selectedRecordId !== selected || value.selectedVisible !== true)) return false;
        return true;
      },
      { digest: expectedDigest, selected: selectedId, wantNpc: npc, wantMonster: monster },
      { timeout: 120_000 },
    );
  } catch (error) {
    const state = await page.evaluate(() => ({
      creatures: globalThis.__OTERYN_ATLAS_CREATURES__ ?? null,
      fullworld: globalThis.__OTERYN_ATLAS_FULLWORLD__ ?? null,
      view: globalThis.__OTERYN_ATLAS_VIEW__ ?? null,
    }));
    console.error('wait-ready-state=' + JSON.stringify(state));
    throw error;
  }
  const value = await diagnostic(page);
  assert.equal(value.status, 'PASS');
  assert.equal(value.sourceSemanticDigest, expectedDigest);
  assert.equal(value.totalRecords, 88633);
  assert.equal(value.totalChunks, 5746);
  assert.equal(value.searchRecords, 1945);
  assert.ok(value.drawnRecords > 0);
  assert.ok(value.pixelDrawnRecords > 0);
  assert.equal(value.animationRuntime.creaturePrograms, 1377);
  assert.equal(value.animationRuntime.objectPrograms, 5190);
  assert.ok(value.cacheChunks <= 96);
  return value;
}

async function assertVisibleCreatureOverlay(page) {
  const overlay = page.locator('#creature-overlay');
  await overlay.waitFor({ state: 'visible', timeout: 30_000 });
  const box = await overlay.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'creature overlay has no visible surface');
}

function targetUrl(target, creatures = 'npc,monster', npcRole = null) {
  const params = new URLSearchParams({
    x: String(target.position.x),
    y: String(target.position.y),
    floor: String(target.position.floor),
    zoom: '2',
    mode: 'minimap',
    perf: 'reference',
    creatures,
    animation: 'off',
  });
  if (npcRole) params.set('npcRole', npcRole);
  return `${preview}/web/fullworld.html?${params}`;
}

async function assertRevisionResponse(page) {
  const response = await page.request.get(`${preview}/web/fullworld.html`);
  assert.equal(response.status(), 200);
  const headers = response.headers();
  const revision = headers['x-oteryn-atlas-code-revision'] ?? headers['x-oteryn-atlas-revision'];
  assert.equal(revision, expectedRevision);
}

async function displayedFloorFor(page, nativeFloor) {
  const response = await page.request.get(`${preview}/web/semantic-search/index.json`);
  assert.equal(response.status(), 200);
  const index = await response.json();
  const aliases = Object.entries(index.input_floor_aliases ?? {})
    .filter(([, value]) => value === nativeFloor)
    .map(([key]) => Number(key))
    .filter(Number.isSafeInteger)
    .sort((a, b) => a - b);
  return aliases[0] ?? nativeFloor;
}

async function searchAndSelect(page, target, kindText, { inputSelector, hostSelector }) {
  const input = page.locator(inputSelector);
  await input.waitFor({ state: 'visible', timeout: 30_000 });
  await input.fill(target.label);
  await page.waitForFunction(
    (query) => {
      const value = globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__;
      return value?.status === 'PASS' && value.lastQuery === query && value.lastResults > 0;
    },
    target.label,
    { timeout: 30_000 },
  );

  const host = page.locator(hostSelector);
  await host.waitFor({ state: 'visible', timeout: 30_000 });
  const result = host.locator('.semantic-search-result')
    .filter({ hasText: new RegExp(escapeRegex(target.label), 'i') })
    .filter({ hasText: new RegExp(escapeRegex(kindText), 'i') })
    .first();
  await result.waitFor({ state: 'visible', timeout: 30_000 });
  const factualResult = await result.innerText();
  assert.match(factualResult, new RegExp(escapeRegex(target.label), 'i'));
  assert.match(factualResult, new RegExp(escapeRegex(kindText), 'i'));
  const displayedFloor = await displayedFloorFor(page, target.position.floor);
  assert.ok(factualResult.includes(`${target.position.x}, ${target.position.y}, ${displayedFloor}`));

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60_000 }),
    result.click(),
  ]);
}

function assertDeepLink(page, target, expectedCreatures) {
  const params = new URL(page.url()).searchParams;
  assert.equal(params.get('x'), String(target.position.x));
  assert.equal(params.get('y'), String(target.position.y));
  assert.equal(params.get('floor'), String(target.position.floor));
  assert.equal(params.get('selected'), `${target.position.floor}:${target.position.x}:${target.position.y}`);
  assert.equal(params.get('q'), target.label);
  assert.equal(params.get('creature'), target.record_id);
  assert.equal(params.get('creatures'), expectedCreatures);
  assert.equal(params.get('animation'), 'off');
}

function assertCreatureInspector(text, target, kindText) {
  assert.match(text, new RegExp(escapeRegex(target.label), 'i'));
  assert.ok(text.includes(target.record_id));
  assert.ok(text.includes(expectedDigest));
  assert.match(text, new RegExp(escapeRegex(kindText), 'i'));
  assert.ok(text.includes(`X ${target.position.x} · Y ${target.position.y} · F ${target.position.floor}`));
  assert.ok(text.includes('Resolution: RESOLVED'));
  assert.ok(text.includes('Origin: base-map'));
  assert.ok(text.includes('Authority: oteryn-game-atlas-export-v1 / animated-creatures-v1'));
  assert.ok(text.includes(`Semantic digest: ${expectedDigest}`));
  assert.match(text, /Verified outfit pixels/i);
}

async function assertGameplayPublication(page) {
  const response = await page.request.get(`${preview}/web/creature-gameplay/manifest.json`);
  assert.equal(response.status(), 200);
  const manifest = await response.json();
  assert.equal(manifest.capability, 'creature-gameplay-profiles-v1');
  assert.equal(manifest.producer_repository_sha, expectedGameplayGameRev);
  assert.equal(manifest.semantic_digest, expectedGameplayDigest);
  assert.deepEqual(manifest.counts, { monster_profiles: 1800, npc_profiles: 1049, referenced_items: 0 });
  return manifest;
}

async function gameplayRecord(page, fixture) {
  const response = await page.request.get(`${preview}/data/creatures/search.json`);
  assert.equal(response.status(), 200);
  const product = await response.json();
  const record = product.records.find((row) => row.entity_id === fixture.entityId);
  assert.ok(record, `missing live gameplay fixture ${fixture.label}`);
  assert.equal(record.label, fixture.label);
  assert.equal(record.kind, fixture.kind);
  return record;
}

function gameplayUrl(record) {
  const params = new URLSearchParams({ x: String(record.position.x), y: String(record.position.y), floor: String(record.position.floor), zoom: '2', mode: 'map', creatures: 'npc,monster', animation: 'off', creature: record.record_id, inspector: 'gameplay' });
  return `${preview}/web/fullworld.html?${params}`;
}

async function proveGameplay(page, fixture, surface) {
  const record = await gameplayRecord(page, fixture);
  await page.goto(gameplayUrl(record), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await assertRevisionResponse(page);
  await waitSemanticReady(page);
  await waitReady(page, { selectedId: record.record_id });
  const card = page.locator('#creature-quick-card');
  await card.waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#creature-card-details').click();
  const gameplayTab = page.locator('#inspector-tab-gameplay');
  await gameplayTab.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await gameplayTab.getAttribute('aria-selected'), 'true');
  if (fixture.kind === 'npc') {
    const sells = page.locator('#gameplay-section-sells');
    const buys = page.locator('#gameplay-section-buys');
    await sells.waitFor({ state: 'visible', timeout: 30_000 });
    assert.match(await sells.innerText(), /axe/i);
    assert.match(await sells.innerText(), /20 gold/i);
    assert.match(await buys.innerText(), /7 gold/i);
  } else {
    const loot = page.locator('#gameplay-section-loot');
    const stats = page.locator('#gameplay-section-stats');
    await loot.waitFor({ state: 'visible', timeout: 30_000 });
    assert.match(await loot.innerText(), /gold coin/i);
    assert.match(await loot.innerText(), /100%/);
    assert.match(await stats.innerText(), /Health\s*20/i);
  }
  await page.screenshot({ path: `${evidenceDir}/${surface}-gameplay-${fixture.label.toLowerCase()}.png`, fullPage: true });
  return { entityId: fixture.entityId, recordId: record.record_id };
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = watchRelevantErrors(page);
  await page.goto(targetUrl(targets.npc, 'npc,monster', 'shop'), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await assertRevisionResponse(page);
  const animationCoverage = await publishedAnimationCoverage(page);
  await assertGameplayPublication(page);
  await waitSemanticReady(page);
  const initial = await waitReady(page);
  assert.ok(initial.visibleRecords > 0);
  assert.equal(initial.npcRole, 'shop');
  assert.equal(initial.npcMarkerStyle, 'functional-icons-v2');
  assert.ok(initial.drawnNpcIcons > 0);
  await assertVisibleCreatureOverlay(page);
  const roleFilter = page.locator('#npc-role-filter');
  await roleFilter.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await roleFilter.inputValue(), 'shop');

  const npcToggle = page.locator('input[data-creature-kind="npc"]');
  const monsterToggle = page.locator('input[data-creature-kind="monster"]');
  await npcToggle.waitFor({ state: 'visible', timeout: 30_000 });
  await monsterToggle.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await npcToggle.isChecked(), true);
  assert.equal(await monsterToggle.isChecked(), true);
  await page.screenshot({ path: `${evidenceDir}/desktop-initial.png`, fullPage: true });
  await monsterToggle.uncheck();
  await waitReady(page, { npc: true, monster: false });
  const staticNpcPixels = await captureCreaturePixelState(page);
  const animationToggle = page.locator('#animation-toggle');
  await animationToggle.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await animationToggle.isDisabled(), false);
  assert.equal(await animationToggle.isChecked(), false);
  const beforeFrames = (await diagnostic(page)).animationRuntime.frameUpdates;
  await animationToggle.check();
  await page.waitForFunction((before) => {
    const value = globalThis.__OTERYN_ATLAS_CREATURES__;
    return value?.animationOn === true && value.animationRuntime?.frameUpdates > before;
  }, beforeFrames, { timeout: 30_000 });
  await waitForCreaturePixelState(page, staticNpcPixels, false, 'NPC playback did not change pixels');
  assert.equal(new URL(page.url()).searchParams.get('animation'), 'on');
  await page.screenshot({ path: `${evidenceDir}/desktop-animation-on.png`, fullPage: true });
  await animationToggle.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false, null, { timeout: 30_000 });
  await waitForCreaturePixelState(page, staticNpcPixels, true, 'NPC static pixels were not restored');
  const frozenFrames = (await diagnostic(page)).animationRuntime.frameUpdates;
  for (let frame = 0; frame < 3; frame += 1) await page.evaluate(() => new Promise(requestAnimationFrame));
  assert.equal((await diagnostic(page)).animationRuntime.frameUpdates, frozenFrames);
  assert.equal(new URL(page.url()).searchParams.get('animation'), 'off');
  await monsterToggle.check();
  await waitReady(page, { npc: true, monster: true });

  await searchAndSelect(page, targets.npc, 'NPC', {
    inputSelector: '#search-input',
    hostSelector: '#semantic-search-results-desktop',
  });
  await waitSemanticReady(page);
  await waitReady(page, { selectedId: targets.npc.record_id });
  assertDeepLink(page, targets.npc, 'monster,npc');
  const inspector = await page.locator('#creature-inspector').innerText();
  assertCreatureInspector(inspector, targets.npc, 'NPC');

  await monsterToggle.uncheck();
  await waitReady(page, { selectedId: targets.npc.record_id, npc: true, monster: false });
  assert.equal(new URL(page.url()).searchParams.get('creatures'), 'npc');
  await page.screenshot({ path: `${evidenceDir}/desktop-npc-only.png`, fullPage: true });
  const gameplay = await proveGameplay(page, GAMEPLAY_FIXTURES.sam, 'desktop');
  assert.deepEqual(errors, []);
  await context.close();
  return { animationCoverage, initialVisibleRecords: initial.visibleRecords, selected: targets.npc.record_id, gameplay };
}

async function runMobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = watchRelevantErrors(page);
  await page.goto(targetUrl(targets.monster), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await assertRevisionResponse(page);
  await assertGameplayPublication(page);
  await waitSemanticReady(page);
  const initial = await waitReady(page);
  assert.ok(initial.visibleRecords > 0);
  await assertVisibleCreatureOverlay(page);

  await page.locator('#mobile-controls-toggle').click();
  const npcToggle = page.locator('input[data-creature-kind="npc"]');
  const monsterToggle = page.locator('input[data-creature-kind="monster"]');
  await npcToggle.waitFor({ state: 'visible', timeout: 30_000 });
  await monsterToggle.waitFor({ state: 'visible', timeout: 30_000 });
  assert.equal(await npcToggle.isChecked(), true);
  assert.equal(await monsterToggle.isChecked(), true);
  await npcToggle.uncheck();
  await waitReady(page, { npc: false, monster: true });
  const staticMonsterPixels = await captureCreaturePixelState(page);
  const animationToggle = page.locator('#animation-toggle');
  assert.equal(await animationToggle.isDisabled(), false);
  const beforeFrames = (await diagnostic(page)).animationRuntime.frameUpdates;
  await animationToggle.check();
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before, beforeFrames, { timeout: 30_000 });
  await waitForCreaturePixelState(page, staticMonsterPixels, false, 'monster playback did not change pixels');
  await animationToggle.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false, null, { timeout: 30_000 });
  await waitForCreaturePixelState(page, staticMonsterPixels, true, 'monster static pixels were not restored');
  await waitReady(page, { npc: false, monster: true });
  assert.equal(new URL(page.url()).searchParams.get('creatures'), 'monster');

  await searchAndSelect(page, targets.monster, 'Monster / Spawn', {
    inputSelector: '#mobile-search-input',
    hostSelector: '#semantic-search-results-mobile',
  });
  await waitSemanticReady(page);
  await waitReady(page, { selectedId: targets.monster.record_id, npc: false, monster: true });
  assertDeepLink(page, targets.monster, 'monster');
  await page.locator('#mobile-inspector-toggle').click();
  const inspector = page.locator('#creature-inspector');
  await inspector.waitFor({ state: 'visible', timeout: 30_000 });
  const text = await inspector.innerText();
  assertCreatureInspector(text, targets.monster, 'Monster / Spawn');
  await page.screenshot({ path: `${evidenceDir}/mobile-monster-only.png`, fullPage: true });
  const gameplay = await proveGameplay(page, GAMEPLAY_FIXTURES.rat, 'mobile');
  assert.deepEqual(errors, []);
  await context.close();
  return { initialVisibleRecords: initial.visibleRecords, selected: targets.monster.record_id, gameplay };
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  try {
    const desktop = await runDesktop(browser);
    process.stdout.write('desktop=PASS\n');
    const mobile = await runMobile(browser);
    process.stdout.write('mobile=PASS\n');
    const result = {
      status: 'PASS',
      atlasRevision: expectedRevision,
      gameSemanticDigest: expectedDigest,
      gameplayGameRevision: expectedGameplayGameRev,
      gameplaySemanticDigest: expectedGameplayDigest,
      desktop,
      mobile,
    };
    fs.writeFileSync(`${evidenceDir}/result.json`, `${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
