import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

const ENCODING_ARTIFACT = /(?:Ã|Â|â€¦|â€”|�)/;

function safeId(value) {
  const normalized = String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '_');
  if (!normalized || normalized.length > 160) throw new TypeError('visual evidence id invalid');
  return normalized;
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export async function assertUserVisibleSurface(page, {
  label = 'Atlas user surface',
  elements = [],
  minimumMapAreaRatio = 0.15,
  noHorizontalOverflow = true,
} = {}) {
  const metrics = await page.evaluate(({ requested }) => {
    const viewport = { width: innerWidth, height: innerHeight, dpr: devicePixelRatio };
    const root = document.documentElement;
    const body = document.body;
    const documentOverflowX = Math.max(root.scrollWidth, body?.scrollWidth ?? 0) - innerWidth;
    const map = document.querySelector('#map-frame');
    const mapRect = map?.getBoundingClientRect() ?? null;
    const mapAreaRatio = mapRect ? (Math.max(0, mapRect.width) * Math.max(0, mapRect.height)) / (innerWidth * innerHeight) : 0;
    const bodyText = body?.innerText ?? '';
    const results = requested.map((item) => {
      const element = document.querySelector(item.selector);
      if (!element) return { ...item, exists: false };
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0
        && rect.width > 0 && rect.height > 0;
      const clipped = rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
      let hit = null;
      let unobscured = true;
      if (item.interactive && visible && !clipped) {
        const x = Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
        const y = Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
        hit = document.elementFromPoint(x, y);
        unobscured = Boolean(hit && (hit === element || element.contains(hit)));
      }
      return {
        ...item,
        exists: true,
        visible,
        clipped,
        unobscured,
        hitTag: hit?.tagName ?? null,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        client: { width: element.clientWidth, height: element.clientHeight },
        scroll: { width: element.scrollWidth, height: element.scrollHeight },
      };
    });
    return {
      viewport,
      documentOverflowX,
      mapAreaRatio,
      textEncodingOk: !ENCODING_ARTIFACT.test(bodyText),
      elements: results,
    };
  }, { requested: elements });

  if (noHorizontalOverflow) {
    expect(metrics.documentOverflowX, `${label}: document must not overflow horizontally`).toBeLessThanOrEqual(1);
  }
  expect(metrics.mapAreaRatio, `${label}: map must remain a meaningful part of the viewport`).toBeGreaterThanOrEqual(minimumMapAreaRatio);
  expect(metrics.textEncodingOk, `${label}: visible text contains encoding artifacts`).toBeTruthy();
  for (const item of metrics.elements) {
    const itemLabel = item.label || item.selector;
    expect(item.exists, `${label}: ${itemLabel} must exist`).toBeTruthy();
    expect(item.visible, `${label}: ${itemLabel} must be visible`).toBeTruthy();
    expect(item.clipped, `${label}: ${itemLabel} must not be clipped by the viewport`).toBeFalsy();
    if (item.interactive) {
      expect(item.unobscured, `${label}: ${itemLabel} center must be user-hit-testable`).toBeTruthy();
      expect(item.rect.width, `${label}: ${itemLabel} target width`).toBeGreaterThanOrEqual(item.minWidth ?? 24);
      expect(item.rect.height, `${label}: ${itemLabel} target height`).toBeGreaterThanOrEqual(item.minHeight ?? 24);
    }
  }
  return Object.freeze(metrics);
}

async function runtimeSnapshot(page) {
  return page.evaluate(() => {
    const view = globalThis.__OTERYN_ATLAS_VIEW__;
    const semantic = globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__;
    const creatures = globalThis.__OTERYN_ATLAS_CREATURES__;
    const minimap = globalThis.__OTERYN_ATLAS_MINIMAP__;
    return {
      view: view ? { x: view.x, y: view.y, floor: view.floor, zoom: view.zoom, mode: view.mode } : null,
      semantic: semantic ? {
        status: semantic.status, activeId: semantic.activeId, lastQuery: semantic.lastQuery, lastResults: semantic.lastResults,
      } : null,
      creatures: creatures ? {
        status: creatures.status, enabled: creatures.enabled, visibleRecords: creatures.visibleRecords,
        drawnRecords: creatures.drawnRecords, pixelDrawnRecords: creatures.pixelDrawnRecords,
        markerDrawnRecords: creatures.markerDrawnRecords, animationOn: creatures.animationOn,
      } : null,
      minimap: minimap ? { status: minimap.status, representation: minimap.representation } : null,
    };
  });
}

export async function captureUserVisualEvidence(page, testInfo, scenarioId, {
  surfaceMetrics = null,
  note = null,
  animations = 'disabled',
} = {}) {
  const atlasRevision = process.env.ATLAS_EXPECTED_REVISION?.trim();
  expect(atlasRevision, 'user-facing visual acceptance requires ATLAS_EXPECTED_REVISION').toBeTruthy();
  const artifactsRoot = path.resolve(process.env.ATLAS_ARTIFACTS_DIR || testInfo.outputDir);
  const evidenceDir = path.join(artifactsRoot, 'user-visual-evidence', safeId(testInfo.project.name), safeId(scenarioId));
  await mkdir(evidenceDir, { recursive: true });
  const screenshotPath = path.join(evidenceDir, 'viewport.png');
  await page.screenshot({ path: screenshotPath, fullPage: false, animations, caret: 'hide', scale: 'css' });
  const screenshotBytes = await readFile(screenshotPath);
  const browser = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    deviceScaleFactor: devicePixelRatio,
    url: location.href,
  }));
  const manifest = Object.freeze({
    version: 1,
    scenarioId,
    atlasRevision,
    targetMode: testInfo.config.metadata?.targetMode ?? null,
    browserProfile: testInfo.project.name,
    browserName: testInfo.project.use?.browserName ?? null,
    viewport: browser.viewport,
    deviceScaleFactor: browser.deviceScaleFactor,
    url: browser.url,
    screenshot: 'viewport.png',
    screenshotSha256: sha256(screenshotBytes),
    note,
    surfaceMetrics,
    runtime: await runtimeSnapshot(page),
  });
  const manifestPath = path.join(evidenceDir, 'manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await testInfo.attach(`${scenarioId}-viewport`, { path: screenshotPath, contentType: 'image/png' });
  await testInfo.attach(`${scenarioId}-manifest`, { path: manifestPath, contentType: 'application/json' });
  return manifest;
}
