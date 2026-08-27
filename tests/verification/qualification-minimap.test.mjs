import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadMinimapFloor, loadMinimapWorld, loadVerifiedMinimapTile, selectMinimapChunks } from '../../src/layers/minimap.mjs';
import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

function filesystemFetcher(root) {
  return async (input) => {
    const url = new URL(input);
    const relative = url.pathname.replace(/^\/minimap\//, '');
    const target = path.join(root, 'minimap', ...relative.split('/'));
    if (!fs.existsSync(target)) return { ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    const bytes = fs.readFileSync(target);
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(bytes.length) : null },
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    };
  };
}

test('qualification world publishes a production-loadable minimap world, floor and verified PNG tile', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-minimap-'));
  const root = path.join(temporary, 'fixture');
  try {
    const manifest = await buildQualificationWorld(root);
    assert.match(manifest.minimapRoot, /^sha256:[a-f0-9]{64}$/);

    const base = new URL('https://qualification.invalid/minimap/');
    const fetcher = filesystemFetcher(root);
    const world = await loadMinimapWorld(base, {
      rootContentId: manifest.minimapRoot,
      publicationRoot: manifest.publicationRoot,
      pixelRoot: manifest.pixelRoot,
    }, fetcher);
    assert.equal(world.floors.length, 16);

    const entry = world.floors.find((candidate) => candidate.floor === -7);
    assert(entry);
    const floor = await loadMinimapFloor(base, world, entry, fetcher);
    assert.deepEqual(floor.bounds, { x_min: 32256, x_max_exclusive: 32512, y_min: 32000, y_max_exclusive: 32256 });
    const chunks = selectMinimapChunks(floor, { x_min: 32256, x_max_exclusive: 32512, y_min: 32000, y_max_exclusive: 32256 });
    assert.equal(chunks.length, 1);

    const png = await loadVerifiedMinimapTile(base, chunks[0], fetcher);
    assert(png.byteLength > 24);
    assert.equal(png[0], 0x89);
    assert.equal(new TextDecoder().decode(png.subarray(1, 4)), 'PNG');
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
