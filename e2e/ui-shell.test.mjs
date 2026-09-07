/** Presentation-only browser tests. No world fixture, runtime acceptance or CI status.
 * Run: npm ci --prefix e2e && node --test e2e/ui-shell.test.mjs
 * Optional: ATLAS_CHROMIUM_EXECUTABLE=/path/to/chromium
 * ATLAS_UI_SOURCE_ROOT selects a pinned source snapshot for before/after regression.
 * The actual template/styles and panel module run inline; product modules are NOT mocked.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(process.env.ATLAS_UI_SOURCE_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const html = await readFile(resolve(root, 'web/fullworld.html'), 'utf8');
const styles = await Promise.all(['style.css', 'fullworld.css'].map(name => readFile(resolve(root, 'web', name), 'utf8')));
const panels = await readFile(resolve(root, 'web/fullworld-mobile.mjs'), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.ATLAS_CHROMIUM_EXECUTABLE || undefined, headless: true }); });
after(async () => { await browser?.close(); });

async function withPage(size, run, options = {}) {
  const page = await browser.newPage({ viewport: size, ...options });
  page.setDefaultTimeout(1500);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const document = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '');
  try {
    await page.setContent(document);
    for (const css of styles) await page.addStyleTag({ content: css });
    await page.addScriptTag({ type: 'module', content: panels });
    await page.waitForFunction(() => document.documentElement.dataset.mobileUi === 'ready');
    await run(page);
    assert.deepEqual(errors, [], 'panel module must not throw');
  } finally { await page.close(); }
}
const desktop = { width: 1440, height: 900 };
const mobile = { width: 390, height: 844 };
const controls = '#mobile-controls-panel';
const inspector = '#mobile-inspector-panel';
const box = (page, selector) => page.locator(selector).boundingBox();
const open = (page, which) => page.locator(`#mobile-${which}-toggle`).click();
const expanded = (page, id) => page.locator(id).getAttribute('aria-expanded');

function luminance(color) {
  const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4);
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

test('original runtime entry points and control identities remain intact', async () => {
  const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(sources, ['./fullworld-app.mjs', './fullworld-minimap.mjs', './fullworld-mobile.mjs', './fullworld-search.mjs', './fullworld-farm-explorer.mjs']);
  await withPage(desktop, async page => {
    const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
    assert.equal(ids.length, new Set(ids).size, 'duplicate IDs');
    for (const id of ['atlas','map-frame','animation-overlay','minimap-layer','overview-overlay','minimap','selection-box','search-form','search-input','mobile-search-form','mobile-search-input','floor-up','floor-down','floor-select','coord-x','coord-y','coord-floor','overview-toggle','animation-toggle','semantic-layer-list','inspector-content','inspector-pill','inspector-tab-gameplay','inspector-tab-semantic','inspector-tab-live','creature-quick-card','creature-card-details','creature-card-copy','creature-card-link-fallback','farm-explorer','farm-creature-search','farm-target-kills','farm-kph','farm-time-base','farm-estimate-output','region-search','region-family','region-zoom','qualification-result']) assert.ok(ids.includes(id), id);
    assert.equal(await page.locator('#inspector-tab-live').isDisabled(), true);
    assert.equal(await page.locator('#region-search').isDisabled(), true);
    assert.equal(await page.locator('#qualification-result').getAttribute('data-status'), 'PENDING');
  });
});

test('desktop default gives the map at least 86% of workspace height', async () => withPage(desktop, async page => {
  const frame = await box(page, '#map-frame'), workspace = await box(page, '.workspace');
  assert.ok(frame.height / workspace.height >= .86, `${frame.height}/${workspace.height}`);
}));

test('all four mode controls fit within the rail without overlap', async () => withPage(desktop, async page => {
  const rail = await box(page, controls); const buttons = page.locator('#view-mode-control button');
  assert.equal(await buttons.count(), 4); let previous = null;
  for (const button of await buttons.all()) {
    const b = await button.boundingBox();
    assert.ok(b.x >= rail.x && b.x + b.width <= rail.x + rail.width, 'clipped mode button');
    if (previous) assert.ok(b.x >= previous.x + previous.width || b.y >= previous.y + previous.height, 'overlapping modes');
    previous = b;
  }
}));

for (const [width, height] of [[320,568],[390,844],[768,1024],[844,390],[980,720],[981,720],[1100,780],[1440,900],[1920,1080]]) {
  test(`shell fits ${width}x${height} with every primary action inside the viewport`, async () => withPage({ width, height }, async page => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const selectors = ['#zoom-in','#zoom-out', width <= 980 ? '#mobile-controls-toggle' : '#desktop-controls-toggle', width <= 980 ? '#mobile-inspector-toggle' : '#desktop-inspector-toggle'];
    for (const selector of selectors) {
      const b = await box(page, selector);
      assert.ok(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= width && b.y + b.height <= height, selector);
    }
    const frame = await box(page, '#map-frame');
    assert.ok(frame.width >= 240 && frame.height >= 200, 'map usable area');
  }));
}

test('mobile primary targets are at least 44 by 44 CSS pixels', async () => withPage(mobile, async page => {
  for (const selector of ['#zoom-in','#zoom-out','#mobile-controls-toggle','#mobile-inspector-toggle']) {
    const b = await box(page, selector); assert.ok(b.width >= 44 && b.height >= 44, selector);
  }
  await open(page, 'controls'); const b = await box(page, '#mobile-controls-close');
  assert.ok(b.width >= 44 && b.height >= 44);
}));

test('mobile drawer traps both directions of keyboard focus and restores its trigger', async () => withPage(mobile, async page => {
  await open(page, 'controls');
  assert.equal(await page.locator(controls).getAttribute('aria-modal'), 'true');
  assert.equal(await page.locator(controls).getAttribute('role'), 'dialog');
  await page.locator('#mobile-controls-close').focus();
  await page.keyboard.press('Shift+Tab');
  assert.ok(await page.locator(controls).evaluate(el => el.contains(document.activeElement)), 'focus escaped drawer');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-controls-close');
  await page.keyboard.press('Escape');
  assert.equal(await expanded(page, '#mobile-controls-toggle'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-controls-toggle');
  assert.equal(await page.locator('.topbar').evaluate(el => el.inert), false);
}));

test('mobile background is inert only while a drawer is open', async () => withPage(mobile, async page => {
  await open(page, 'inspector');
  assert.equal(await page.locator('.map-stage').evaluate(el => el.inert), true);
  assert.equal(await page.locator('.topbar').evaluate(el => el.inert), true);
  assert.equal(await page.locator(controls).evaluate(el => el.inert), true);
  await page.locator('#mobile-inspector-close').click();
  assert.equal(await page.locator('.map-stage').evaluate(el => el.inert), false);
}));

test('height-only resize preserves mobile search text, focus and open state', async () => withPage(mobile, async page => {
  await open(page, 'controls');
  await page.locator('#mobile-search-input').fill('unchanged query');
  await page.setViewportSize({ width: 390, height: 520 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await expanded(page, '#mobile-controls-toggle'), 'true');
  assert.equal(await page.locator('#mobile-search-input').inputValue(), 'unchanged query');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-search-input');
}));

test('breakpoint changes close the modal and restore desktop panel preferences', async () => withPage(desktop, async page => {
  await page.locator('#desktop-inspector-toggle').click();
  await page.setViewportSize(mobile); await open(page, 'controls');
  await page.setViewportSize(desktop);
  await page.waitForFunction(() => !document.querySelector('.topbar').inert);
  assert.equal(await page.locator(controls).getAttribute('aria-modal'), null);
  assert.equal(await expanded(page, '#desktop-inspector-toggle'), 'false');
  assert.equal(await expanded(page, '#desktop-controls-toggle'), 'true');
  assert.equal(await page.locator('#mobile-drawer-backdrop').isVisible(), false);
}));

test('desktop panel toggles reclaim map width without resetting control values', async () => withPage(desktop, async page => {
  await page.locator('#farm-custom-disclosure').evaluate(el => { el.open = true; });
  await page.locator('#farm-kph').fill('42');
  const before = await box(page, '#map-frame');
  await page.locator('#desktop-controls-toggle').click();
  const after = await box(page, '#map-frame');
  assert.ok(after.width > before.width + 200);
  assert.equal(await page.locator(controls).evaluate(el => el.inert), true);
  await page.locator('#desktop-controls-toggle').click();
  assert.equal(await page.locator('#farm-kph').inputValue(), '42');
  assert.equal(await expanded(page, '#desktop-inspector-toggle'), 'true');
}));

test('existing open-inspector event opens a collapsed desktop panel and transfers a mobile modal', async () => withPage(desktop, async page => {
  await page.locator('#desktop-inspector-toggle').click();
  await page.evaluate(() => window.dispatchEvent(new Event('oteryn-atlas-open-inspector')));
  assert.equal(await expanded(page, '#desktop-inspector-toggle'), 'true');
  await page.setViewportSize(mobile); await open(page, 'controls');
  await page.evaluate(() => window.dispatchEvent(new Event('oteryn-atlas-open-inspector')));
  assert.equal(await expanded(page, '#mobile-controls-toggle'), 'false');
  assert.equal(await expanded(page, '#mobile-inspector-toggle'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-controls-toggle');
}));

test('mobile form forwards once to the original desktop form, without navigation in this harness', async () => withPage(mobile, async page => {
  await page.evaluate(() => { window.__submits = []; document.querySelector('#search-form').addEventListener('submit', event => { event.preventDefault(); window.__submits.push(document.querySelector('#search-input').value); }); });
  await open(page, 'controls'); await page.locator('#mobile-search-input').fill('123,456,7');
  await page.locator('#mobile-search-input').press('Enter');
  assert.deepEqual(await page.evaluate(() => window.__submits), ['123,456,7']);
  assert.equal(await expanded(page, '#mobile-controls-toggle'), 'false');
}));

test('native disclosures preserve access to diagnostics and notify the existing resize seam', async () => withPage(desktop, async page => {
  await page.evaluate(() => { window.__resizeEvents = 0; window.addEventListener('resize', () => window.__resizeEvents++); });
  const before = await box(page, '#map-frame');
  await page.locator('#runtime-details > summary').click();
  await page.waitForFunction(() => window.__resizeEvents > 0);
  assert.equal(await page.locator('#diag-backend').isVisible(), true);
  const after = await box(page, '#map-frame'); assert.ok(after.height < before.height);
  await page.locator('#runtime-details > summary').click();
  assert.equal(await page.locator('#diag-backend').isVisible(), false);
}));

test('reduced motion removes panel transitions without changing map layer state', async () => withPage(mobile, async page => {
  const values = await page.locator(controls).evaluate(el => getComputedStyle(el).transitionDuration.split(',').map(v => parseFloat(v)));
  assert.ok(values.every(v => v === 0));
  assert.equal(await page.locator('#minimap-layer').evaluate(el => getComputedStyle(el).opacity), '0');
}, { reducedMotion: 'reduce' }));

test('primary, muted and focus semantic colors meet contrast targets', async () => withPage(desktop, async page => {
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(['--text','--muted','--panel','--accent','--focus'].map(key => { const el = document.createElement('span'); el.style.color = style.getPropertyValue(key); document.body.append(el); const value = getComputedStyle(el).color; el.remove(); return [key,value]; }));
  });
  assert.ok(contrast(colors['--text'], colors['--panel']) >= 4.5);
  assert.ok(contrast(colors['--muted'], colors['--panel']) >= 4.5);
  assert.ok(contrast(colors['--focus'], colors['--panel']) >= 3);
}));

test('skip control moves focus to the actual map workspace without altering the URL', async () => withPage(desktop, async page => {
  const url = page.url(); await page.locator('#skip-to-map').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'map-frame'); assert.equal(page.url(), url);
}));

for (const size of [desktop, mobile]) {
  test(`secondary tools remain keyboard-reachable at ${size.width}px`, async () => withPage(size, async page => {
    if (size.width <= 980) await open(page, 'controls');
    const disclosure = page.locator('#farm-custom-disclosure > summary');
    await disclosure.focus(); await page.keyboard.press('Enter');
    await page.locator('#farm-kph').fill('60');
    assert.equal(await page.locator('#farm-kph').inputValue(), '60');
    assert.equal(await page.locator('#farm-explorer').isVisible(), true);
    await page.locator('#area-tools-disclosure > summary').click();
    assert.equal(await page.locator('#region-search').isVisible(), true);
    assert.equal(await page.locator('#region-search').isDisabled(), true);
  }));
}

test('mobile search hint is legible without clipping at the narrow supported width', async () => withPage({ width: 320, height: 568 }, async page => {
  await open(page, 'controls');
  const metrics = await page.locator('#mobile-search-input').evaluate(el => {
    const style = getComputedStyle(el), context = document.createElement('canvas').getContext('2d');
    context.font = style.font;
    return { text: context.measureText(el.placeholder).width, available: el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
  });
  assert.ok(metrics.text <= metrics.available, JSON.stringify(metrics));
}));
