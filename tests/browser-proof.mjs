import { decodeCompactTile } from '../src/browser/semantic.mjs';
import { loadChunk, loadManifest } from '../src/browser/loader.mjs';
import { loadPixelStore } from '../src/browser/pixels.mjs';
import { createWebGLRenderer } from '../src/browser/webgl.mjs';

const canvas = document.querySelector('#proof');
const output = document.querySelector('#result');
const CASES = [
  { name: '32x32-pattern-stack', x: 32280, y: 32155 },
  { name: '64x64', x: 32292, y: 32155 },
  { name: '32x64', x: 32329, y: 32155 },
  { name: '64x32', x: 32327, y: 32156 },
  { name: 'displacement', x: 32403, y: 32155 },
];

function flattenTiles(chunks) {
  const tiles = [];
  for (const chunk of chunks) for (const raw of chunk.tiles) tiles.push(decodeCompactTile(raw));
  tiles.sort((a, b) => a.y - b.y || a.x - b.x);
  const records = [];
  for (const tile of tiles) for (const presentation of tile.presentations) {
    for (const primitive of presentation.primitives) records.push({ x: tile.x, y: tile.y, presentation, primitive });
  }
  return records;
}
function cpuReference(records, pixelStore, view, width, height) {
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 7; pixels[i + 1] = 11; pixels[i + 2] = 17; pixels[i + 3] = 255;
  }
  const scale = view.zoom;
  if (scale !== 1) throw new Error('CPU parity fixture requires zoom=1 and deviceScaleFactor=1');
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const centerWorldX = view.x * 32;
  const centerWorldY = view.y * 32;

  for (const record of records) {
    const p = record.primitive;
    const blob = pixelStore.sprites.get(p.spriteSourceId);
    if (!blob || blob.width !== p.widthUnits || blob.height !== p.heightUnits) throw new Error(`dimension mismatch ${p.spriteSourceId}`);
    const worldX = record.x * 32 - (p.widthUnits - 32) + p.displacement.dxUnits;
    const worldY = record.y * 32 - (p.heightUnits - 32) + p.displacement.dyUnits;
    const x0 = halfWidth + worldX - centerWorldX;
    const y0 = halfHeight + worldY - centerWorldY;
    if (!Number.isInteger(x0) || !Number.isInteger(y0)) throw new Error('non-integer parity origin');
    for (let sy = 0; sy < blob.height; sy += 1) {
      const dy = y0 + sy;
      if (dy < 0 || dy >= height) continue;
      for (let sx = 0; sx < blob.width; sx += 1) {
        const dx = x0 + sx;
        if (dx < 0 || dx >= width) continue;
        const si = (sy * blob.width + sx) * 4;
        const di = (dy * width + dx) * 4;
        const alpha = blob.bytes[si + 3] / 255;
        if (alpha <= 0) continue;
        if (alpha >= 1) {
          pixels[di] = blob.bytes[si];
          pixels[di + 1] = blob.bytes[si + 1];
          pixels[di + 2] = blob.bytes[si + 2];
        } else {
          pixels[di] = Math.round(blob.bytes[si] * alpha + pixels[di] * (1 - alpha));
          pixels[di + 1] = Math.round(blob.bytes[si + 1] * alpha + pixels[di + 1] * (1 - alpha));
          pixels[di + 2] = Math.round(blob.bytes[si + 2] * alpha + pixels[di + 2] * (1 - alpha));
        }
      }
    }
  }
  return pixels;
}
function readGpu(gl, width, height) {
  const raw = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
  const topDown = new Uint8Array(raw.length);
  for (let y = 0; y < height; y += 1) {
    const source = (height - 1 - y) * width * 4;
    const target = y * width * 4;
    topDown.set(raw.subarray(source, source + width * 4), target);
  }
  return topDown;
}

function compareRgb(expected, actual) {
  let maxAbs = 0;
  let sumAbs = 0;
  let channelsOver1 = 0;
  let channels = 0;
  for (let i = 0; i < expected.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(expected[i + channel] - actual[i + channel]);
      maxAbs = Math.max(maxAbs, delta);
      sumAbs += delta;
      if (delta > 1) channelsOver1 += 1;
      channels += 1;
    }
  }
  return { maxAbs, meanAbs: sumAbs / channels, channelsOver1, channels };
}
function qualifyFixtures(records) {
  const at = (x, y) => records.filter((record) => record.x === x && record.y === y);
  const checks = {
    source32x32: at(32280, 32155).some(({ primitive: p }) => p.widthUnits === 32 && p.heightUnits === 32),
    source64x64: at(32292, 32155).some(({ primitive: p }) => p.widthUnits === 64 && p.heightUnits === 64),
    source32x64: at(32329, 32155).some(({ primitive: p }) => p.widthUnits === 32 && p.heightUnits === 64),
    source64x32: at(32327, 32156).some(({ primitive: p }) => p.widthUnits === 64 && p.heightUnits === 32),
    nonzeroDisplacement: at(32403, 32155).some(({ primitive: p }) => p.displacement.dxUnits !== 0 || p.displacement.dyUnits !== 0),
    stackedPresentations: new Set(at(32280, 32155).map(({ presentation }) => presentation.recordId)).size >= 2,
    nonzeroPatternDepth: at(32280, 32155).some(({ primitive: p }) => p.pattern.x !== 0 || p.pattern.y !== 0 || p.pattern.z !== 0),
  };
  if (Object.values(checks).some((value) => !value)) throw new Error(`fixture qualification failed: ${JSON.stringify(checks)}`);
  return checks;
}

async function run() {
  const semanticManifest = await loadManifest('../web/proof/semantic/manifest.json');
  const semanticBase = new URL('../web/proof/semantic/', location.href);
  const chunks = await Promise.all(semanticManifest.chunks.map((entry) => loadChunk(semanticBase, entry, semanticManifest)));
  const pixelStore = await loadPixelStore('../web/proof/pixels/manifest.json');
  const records = flattenTiles(chunks);
  if (records.length !== 39282) throw new Error(`unexpected primitive count ${records.length}`);
  const fixtureChecks = qualifyFixtures(records);
  const renderer = createWebGLRenderer(canvas, pixelStore);
  renderer.setRecords(records);
  const cases = [];
  for (const testCase of CASES) {
    const view = { x: testCase.x, y: testCase.y, floor: -7, zoom: 1 };
    const stats = renderer.render(view);
    if (canvas.width !== 192 || canvas.height !== 192) throw new Error(`unexpected parity viewport ${canvas.width}x${canvas.height}`);
    const expected = cpuReference(records, pixelStore, view, canvas.width, canvas.height);
    const actual = readGpu(renderer.gl, canvas.width, canvas.height);
    const metric = compareRgb(expected, actual);
    cases.push({ ...testCase, ...metric, drawCalls: stats.drawCalls, visiblePrimitives: stats.visiblePrimitives, renderMs: stats.renderMs });
  }

  const pass = cases.every((entry) => entry.maxAbs <= 2 && entry.meanAbs <= 0.1);
  const result = {
    status: pass ? 'PASS' : 'FAIL',
    backend: 'WebGL2',
    semanticRoot: semanticManifest.rootContentId,
    pixelRoot: pixelStore.manifest.rootContentId,
    packSha256: pixelStore.manifest.pack.sha256,
    primitiveCount: records.length,
    fixtureChecks,
    tolerance: { maxAbs: 2, meanAbs: 0.1, channels: 'RGB only; alpha excluded because the browser context is opaque' },
    cases,
  };
  output.dataset.status = result.status;
  output.textContent = JSON.stringify(result, null, 2);
  document.title = `DYN-ATLAS-001 ${result.status}`;
  if (!pass) throw new Error(`pixel parity failed: ${JSON.stringify(cases)}`);
  globalThis.__DYN_ATLAS_BROWSER_PROOF__ = result;
}
run().catch((error) => {
  console.error(error);
  output.dataset.status = 'FAIL';
  output.textContent = JSON.stringify({ status: 'FAIL', error: error.message }, null, 2);
  document.title = 'DYN-ATLAS-001 FAIL';
});
