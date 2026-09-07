/** Component browser contracts, NOT initialized Atlas/world acceptance.
 * Uses the real template, styles, panel controller and search view with view-only
 * tokens (not Game records). No loader, renderer, navigation or authority is mocked.
 * Run: npm ci --prefix e2e && node --test e2e/ui-discovery.test.mjs
 * Optional: ATLAS_CHROMIUM_EXECUTABLE=/path/to/chromium
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = await readFile(resolve(root, 'web/fullworld.html'), 'utf8');
const styles = await Promise.all(['style.css', 'fullworld.css'].map(name => readFile(resolve(root, 'web', name), 'utf8')));
const panels = await readFile(resolve(root, 'web/fullworld-mobile.mjs'), 'utf8');
const view = await readFile(resolve(root, 'web/fullworld-search-view.mjs'), 'utf8');
const desktop = { width: 1440, height: 900 }, mobile = { width: 390, height: 844 };
let browser;
before(async () => { browser = await chromium.launch({ executablePath: process.env.ATLAS_CHROMIUM_EXECUTABLE || undefined, headless: true }); });
after(async () => { await browser?.close(); });

async function withPage(size, run, options = {}) {
  const page = await browser.newPage({ viewport: size, ...options });
  page.setDefaultTimeout(2000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const document = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, '');
  try {
    await page.setContent(document);
    for (const css of styles) await page.addStyleTag({ content: css });
    await page.addScriptTag({ type: 'module', content: panels });
    await page.addScriptTag({ type: 'module', content: view + '\nwindow.__componentFactory = { createSearchView, renderEntitySummary };' });
    await page.waitForFunction(() => document.documentElement.dataset.mobileUi === 'ready' && window.__componentFactory);
    await page.evaluate(() => {
      // These tokens exercise presentation/selection, not Game identity or locations.
      window.__component = { phase: 'results', chosen: [], views: {}, tokens: [
        { label: 'Component specimen A', kind: 'npc' },
        { label: 'Component specimen B', kind: 'monster' },
        { label: 'Component specimen C', kind: 'town' },
      ] };
      const fixture = window.__component;
      for (const id of ['desktop', 'mobile']) {
        const form = document.querySelector(id === 'desktop' ? '#search-form' : '#mobile-search-form');
        const input = form.querySelector('input');
        let instance;
        instance = window.__componentFactory.createSearchView({
          form, input, id,
          describe: token => ({ type: token.kind, position: 'Component fixture · no world data' }),
          onQuery: query => instance.show({ phase: query.trim() ? fixture.phase : 'idle', query, results: fixture.tokens, detail: fixture.detail || '' }),
          onChoose: (token, query) => fixture.chosen.push({ index: fixture.tokens.indexOf(token), query }),
        });
        fixture.views[id] = instance;
        form.addEventListener('submit', event => event.preventDefault());
      }
    });
    await run(page);
    assert.deepEqual(errors, [], 'production presentation modules must not throw');
  } finally { await page.close(); }
}
const expanded = (page, id) => page.locator(id).getAttribute('aria-expanded');
const active = page => page.evaluate(() => document.activeElement.id);
const frame = page => page.locator('#map-frame').boundingBox();
const settleLayout = page => page.evaluate(async () => {
  await new Promise(resolve => requestAnimationFrame(resolve));
  await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
  await new Promise(resolve => requestAnimationFrame(resolve));
});

test('combobox has one labelled listbox, idle guidance and unique identifiers', async () => withPage(desktop, async page => {
  const input = page.locator('#search-input');
  assert.equal(await input.getAttribute('role'), 'combobox');
  assert.equal(await input.getAttribute('aria-expanded'), 'false');
  const controls = await input.getAttribute('aria-controls');
  assert.equal(await page.locator(`#${controls}`).getAttribute('role'), 'listbox');
  await input.focus();
  assert.equal(await input.getAttribute('aria-expanded'), 'true');
  assert.match(await page.locator('#semantic-search-results-desktop').innerText(), /Find your next destination/);
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id));
  assert.equal(ids.length, new Set(ids).size);
}));

for (const size of [desktop, mobile]) {
  test(`closed search is visually hidden, not only aria-collapsed, at ${size.width}px`, async () => withPage(size, async page => {
    const mobileLayout = size.width <= 980;
    if (mobileLayout) await page.locator('#mobile-controls-toggle').click();
    const popup = page.locator(`#semantic-search-results-${mobileLayout ? 'mobile' : 'desktop'}`);
    assert.equal(await popup.isVisible(), false);
    await page.locator(mobileLayout ? '#mobile-search-input' : '#search-input').fill('specimen');
    assert.equal(await popup.isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await popup.isVisible(), false);
  }));
}

test('arrows retain input focus; Enter selects the exact original token and query once', async () => withPage(desktop, async page => {
  await page.locator('#search-input').fill('specimen');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'), 'semantic-search-results-desktop-list-0');
  await page.keyboard.press('ArrowDown');
  assert.equal(await active(page), 'search-input');
  assert.equal(await page.locator('[role="option"][aria-selected="true"]').count(), 1);
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.__component.chosen), [{ index: 1, query: 'specimen' }]);
  assert.equal(await expanded(page, '#search-input'), 'false');
  assert.equal(await page.locator('#search-input').inputValue(), 'specimen');
}));

test('ArrowUp starts at the last result; cursor-editing keys do not select a stale option', async () => withPage(desktop, async page => {
  await page.locator('#search-input').fill('specimen');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'), 'semantic-search-results-desktop-list-2');
  await page.keyboard.press('End');
  assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'), null);
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.__component.chosen), []);
}));

test('IME composition cannot choose a result or submit a partial composition', async () => withPage(desktop, async page => {
  const input = page.locator('#search-input');
  await input.fill('specimen');
  await page.keyboard.press('ArrowDown');
  await input.dispatchEvent('compositionstart');
  await page.evaluate(() => {
    window.__submitted = false;
    document.querySelector('#search-form').addEventListener('submit', () => { window.__submitted = true; });
    document.querySelector('#search-form').requestSubmit();
  });
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__submitted), false);
  assert.deepEqual(await page.evaluate(() => window.__component.chosen), []);
  await input.dispatchEvent('compositionend');
  assert.equal(await input.getAttribute('aria-activedescendant'), null);
}));

test('loading, ready, empty, invalid and unavailable clear stale selection and never invent a hit', async () => withPage(desktop, async page => {
  await page.evaluate(() => { window.__component.phase = 'loading'; });
  await page.locator('#search-input').fill('specimen');
  const host = page.locator('#semantic-search-results-desktop');
  assert.match(await host.innerText(), /Loading search/);
  assert.doesNotMatch(await host.innerText(), /unavailable/);
  assert.equal(await page.locator('#search-input').getAttribute('aria-busy'), 'true');
  for (const phase of ['results', 'empty', 'invalid', 'unavailable']) {
    await page.evaluate(phase => { window.__component.phase = phase; window.__component.detail = '<img src=x onerror="throw 1">'; window.__component.views.desktop.refresh(); }, phase);
    assert.equal(await host.getAttribute('data-state'), phase);
    assert.equal(await host.locator('[role="option"]').count(), phase === 'results' ? 3 : 0);
    assert.equal(await page.locator('#search-input').getAttribute('aria-activedescendant'), null);
    assert.equal(await host.locator('img').count(), 0);
  }
  assert.match(await host.innerText(), /Search is unavailable/);
  await host.locator('summary').click();
  assert.match(await host.innerText(), /<img src=x/);
}));

test('dismissed search does not reopen on readiness refresh and keeps its query', async () => withPage(desktop, async page => {
  await page.locator('#search-input').fill('specimen');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__component.views.desktop.refresh());
  assert.equal(await expanded(page, '#search-input'), 'false');
  assert.equal(await page.locator('#search-input').inputValue(), 'specimen');
  await page.keyboard.press('ArrowDown');
  assert.equal(await expanded(page, '#search-input'), 'true');
  await page.locator('.brand').click();
  assert.equal(await expanded(page, '#search-input'), 'false');
}));

test('mobile Find uses one modal; first Escape closes results, second restores the Find trigger', async () => withPage(mobile, async page => {
  await page.locator('#mobile-find-toggle').click();
  assert.equal(await active(page), 'mobile-search-input');
  assert.equal(await page.locator('[aria-modal="true"]').count(), 1);
  assert.equal(await page.locator('#mobile-controls-panel').getAttribute('aria-label'), 'Find in Oteryn');
  await page.locator('#mobile-search-input').fill('specimen');
  await page.keyboard.press('Escape');
  assert.equal(await expanded(page, '#mobile-search-input'), 'false');
  assert.equal(await page.locator('#mobile-controls-panel').getAttribute('aria-modal'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[aria-modal="true"]').count(), 0);
  assert.equal(await active(page), 'mobile-find-toggle');
}));

test('modal Tab and Shift+Tab exclude listbox options and restore the background', async () => withPage(mobile, async page => {
  await page.locator('#mobile-find-toggle').click();
  await page.locator('#mobile-search-input').fill('specimen');
  await page.locator('#mobile-controls-close').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.type), 'submit');
  await page.keyboard.press('Tab');
  assert.equal(await active(page), 'mobile-controls-close');
  await page.locator('#mobile-controls-close').click();
  assert.equal(await page.locator('.topbar').evaluate(el => el.inert), false);
  assert.equal(await page.locator('.map-stage').evaluate(el => el.inert), false);
}));

test('slash opens Find, ignores text editing, and inspector replaces rather than stacks a modal', async () => withPage(mobile, async page => {
  await page.keyboard.press('/');
  assert.equal(await active(page), 'mobile-search-input');
  await page.keyboard.type('x/y');
  assert.equal(await page.locator('#mobile-search-input').inputValue(), 'x/y');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('oteryn-atlas-open-inspector')));
  assert.equal(await page.locator('[aria-modal="true"]').count(), 1);
  assert.equal(await page.locator('#mobile-inspector-panel').getAttribute('aria-modal'), 'true');
  assert.equal(await page.locator('#mobile-controls-panel').evaluate(el => el.inert), true);
}));

test('height-only keyboard-sized resize preserves the Find query, focus and results scroller', async () => withPage(mobile, async page => {
  await page.locator('#mobile-find-toggle').click();
  await page.locator('#mobile-search-input').fill('specimen');
  await page.setViewportSize({ width: 390, height: 320 });
  await settleLayout(page);
  assert.equal(await active(page), 'mobile-search-input');
  assert.equal(await page.locator('#mobile-search-input').inputValue(), 'specimen');
  assert.equal(await page.locator('#mobile-controls-panel').getAttribute('aria-modal'), 'true');
  const box = await page.locator('#semantic-search-results-mobile').boundingBox();
  assert.ok(box.height > 0 && box.y + box.height <= 320, JSON.stringify(box));
}));

test('last selected result fits the short-height Find scroller', async () => withPage({ width: 390, height: 320 }, async page => {
  await page.locator('#mobile-find-toggle').click();
  await page.locator('#mobile-search-input').fill('specimen');
  await settleLayout(page);
  await page.keyboard.press('ArrowUp');
  const row = await page.locator('#semantic-search-results-mobile [aria-selected="true"]').boundingBox();
  const scroller = await page.locator('#semantic-search-results-mobile .search-options').boundingBox();
  assert.ok(row.height <= scroller.height && row.y >= scroller.y && row.y + row.height <= scroller.y + scroller.height, JSON.stringify({ row, scroller }));
}));

test('Find preserves edited text across closing, reopening and a desktop round trip', async () => withPage(mobile, async page => {
  await page.locator('#mobile-find-toggle').click();
  await page.locator('#mobile-search-input').fill('preserve this query');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('#mobile-find-toggle').click();
  assert.equal(await page.locator('#mobile-search-input').inputValue(), 'preserve this query');
  await page.setViewportSize(desktop);
  await settleLayout(page);
  assert.equal(await page.locator('#search-input').inputValue(), 'preserve this query');
  await page.locator('#search-input').fill('desktop revision');
  await page.setViewportSize(mobile);
  await page.locator('#mobile-find-toggle').click();
  assert.equal(await page.locator('#mobile-search-input').inputValue(), 'desktop revision');
}));

test('settled Find panel, heading, input and options remain inside the viewport', async () => withPage(mobile, async page => {
  await page.locator('#mobile-find-toggle').click();
  await page.locator('#mobile-search-input').fill('specimen');
  await page.keyboard.press('ArrowDown');
  await settleLayout(page);
  for (const selector of ['#mobile-controls-panel', '#controls-panel-title', '#mobile-search-input', '#semantic-search-results-mobile [role="option"]']) {
    for (const element of await page.locator(selector).all()) {
      const box = await element.boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= mobile.width && box.y + box.height <= mobile.height, `${selector}: ${JSON.stringify(box)}`);
    }
  }
}));

test('map focus restores the exact panel preference and leaves URL state untouched', async () => withPage(desktop, async page => {
  const beforeUrl = page.url();
  await page.locator('#desktop-inspector-toggle').click();
  const before = await frame(page);
  await page.locator('#map-focus-toggle').click();
  await settleLayout(page);
  assert.equal(await expanded(page, '#desktop-controls-toggle'), 'false');
  assert.equal(await expanded(page, '#desktop-inspector-toggle'), 'false');
  assert.ok((await frame(page)).width > before.width);
  await page.keyboard.press('Escape');
  assert.equal(await expanded(page, '#desktop-controls-toggle'), 'true');
  assert.equal(await expanded(page, '#desktop-inspector-toggle'), 'false');
  assert.equal(page.url(), beforeUrl);
}));

test('desktop preferences and modal focus survive breakpoint crossings', async () => withPage(desktop, async page => {
  await page.locator('#desktop-inspector-toggle').click();
  await page.setViewportSize(mobile);
  await page.locator('#mobile-find-toggle').click();
  await page.setViewportSize(desktop);
  await settleLayout(page);
  assert.equal(await page.locator('[aria-modal="true"]').count(), 0);
  assert.equal(await expanded(page, '#desktop-inspector-toggle'), 'false');
  assert.equal(await expanded(page, '#desktop-controls-toggle'), 'true');
  assert.equal(await page.locator('.topbar').evaluate(el => el.inert), false);
}));

for (const [width, height] of [[320,568],[390,844],[768,1024],[844,390],[980,720],[981,720],[1100,780],[1440,900],[1920,1080]]) {
  test(`primary actions and map viewport fit ${width}x${height}`, async () => withPage({ width, height }, async page => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const selector of ['#zoom-in', '#zoom-out', ...(width <= 980 ? ['#mobile-find-toggle','#mobile-controls-toggle','#mobile-inspector-toggle'] : ['#desktop-controls-toggle','#desktop-inspector-toggle','#map-focus-toggle'])]) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, `${selector}: ${JSON.stringify(box)}`);
      if (width <= 980) assert.ok(box.width >= 44 && box.height >= 44, selector);
    }
    const map = await frame(page);
    assert.ok(map.width >= 240 && map.height >= 200, JSON.stringify(map));
  }));
}

test('long and markup-like result labels stay inside a mobile sheet and remain plain text', async () => withPage(mobile, async page => {
  await page.evaluate(() => { window.__component.tokens[0].label = '<img onerror="bad()">' + 'LongComponentLabel'.repeat(16); });
  await page.locator('#mobile-find-toggle').click();
  await page.locator('#mobile-search-input').fill('specimen');
  const panel = await page.locator('#mobile-controls-panel').boundingBox();
  const rows = page.locator('#semantic-search-results-mobile [role="option"]');
  for (const row of await rows.all()) {
    const box = await row.boundingBox();
    assert.ok(box.x >= panel.x && box.x + box.width <= panel.x + panel.width, JSON.stringify(box));
  }
  assert.equal(await rows.locator('img').count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}));

test('entity summary discloses provenance without resetting focused details on repeat render', async () => withPage(desktop, async page => {
  await page.evaluate(() => {
    // Position/identity copied from the repository catalog; no inferred locations.
    window.__entitySpecimen = {
      host: document.querySelector('#inspector-content'),
      record: { id: 'semantic-record:d6a4c78cf7a3ac98f64bce6e553df76d', label: '1 - NPC', kind: 'waypoint', position: { x: 32704, y: 31594, floor: -7 }, bounds: null, capabilities: ['navigation', 'overlay-point'] },
      type: 'Waypoint', position: '32704, 31594 · native floor -7', source: 'Component specimen; not world acceptance',
    };
    window.__componentFactory.renderEntitySummary(window.__entitySpecimen);
  });
  const detail = page.locator('.entity-provenance');
  assert.equal(await detail.getAttribute('open'), null);
  assert.match(await page.locator('.entity-heading h3').innerText(), /1 - NPC/);
  await detail.locator('summary').click();
  await detail.locator('summary').focus();
  await page.evaluate(() => window.__componentFactory.renderEntitySummary(window.__entitySpecimen));
  assert.notEqual(await detail.getAttribute('open'), null);
  assert.equal(await page.evaluate(() => document.activeElement.matches('.entity-provenance summary')), true);
  assert.match(await detail.innerText(), /Not published by Oteryn-Game/);
}));

function luminance(color) {
  const [r,g,b] = color.match(/[\d.]+/g).slice(0,3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126*r + .7152*g + .0722*b;
}
const contrast = (a,b) => { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
test('result text and metadata meet 4.5:1 contrast against normal and selected surfaces', async () => withPage(desktop, async page => {
  await page.locator('#search-input').fill('specimen');
  await page.keyboard.press('ArrowDown');
  const colors = await page.evaluate(() => ({
    foreground: getComputedStyle(document.querySelector('.search-result-copy strong')).color,
    metadata: getComputedStyle(document.querySelector('.search-result-copy small')).color,
    surface: getComputedStyle(document.querySelector('.semantic-search-results')).backgroundColor,
    selected: getComputedStyle(document.querySelector('[role="option"][aria-selected="true"]')).backgroundColor,
  }));
  for (const fg of [colors.foreground, colors.metadata]) for (const bg of [colors.surface, colors.selected]) assert.ok(contrast(fg,bg) >= 4.5, `${fg}/${bg}`);
}));

test('reduced motion and forced-color selection remain visible', async () => withPage(desktop, async page => {
  await page.locator('#search-input').fill('specimen');
  await page.keyboard.press('ArrowDown');
  const option = page.locator('[role="option"][aria-selected="true"]');
  assert.equal(await option.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  assert.ok(parseFloat(await option.evaluate(el => getComputedStyle(el).outlineWidth)) >= 2);
}, { reducedMotion: 'reduce', forcedColors: 'active' }));

if (process.env.ATLAS_UI_EVIDENCE_DIR) test('render explicitly labelled component evidence', async () => {
  const dir = resolve(process.env.ATLAS_UI_EVIDENCE_DIR);
  await mkdir(dir, { recursive: true });
  for (const [name, size, scene] of [
    ['desktop-initial',desktop,'initial'], ['desktop-results',desktop,'results'], ['desktop-map-focus',desktop,'focus'],
    ['desktop-unavailable',desktop,'unavailable'], ['mobile-find',mobile,'results'], ['mobile-controls',mobile,'controls'],
    ['mobile-landscape',{width:844,height:390},'results'], ['mobile-short-height',{width:390,height:320},'results'],
  ]) await withPage(size, async page => {
    await page.evaluate(() => {
      const label = document.createElement('p');
      label.textContent = 'COMPONENT REVIEW — WORLD NOT INITIALIZED';
      label.style.cssText = 'position:absolute;left:16px;top:45%;right:16px;color:#a6b5b2;font:12px/1.6 system-ui;text-align:center;pointer-events:none';
      document.querySelector('#map-frame').append(label);
    });
    if (scene === 'focus') await page.locator('#map-focus-toggle').click();
    else if (scene === 'controls') await page.locator('#mobile-controls-toggle').click();
    else if (scene === 'results' || scene === 'unavailable') {
      if (scene === 'unavailable') await page.evaluate(() => { window.__component.phase = 'unavailable'; window.__component.detail = 'Component fixture: source unavailable'; });
      if (size.width <= 980) await page.locator('#mobile-find-toggle').click();
      await page.locator(size.width <= 980 ? '#mobile-search-input' : '#search-input').fill('specimen');
      if (scene === 'results') await page.keyboard.press('ArrowDown');
    }
    await settleLayout(page);
    await page.screenshot({ path: resolve(dir, `${name}.png`), fullPage: true });
  });
});
