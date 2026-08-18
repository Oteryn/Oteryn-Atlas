import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAMERA_ITINERARY,
  SemanticError,
  cameraItinerary,
  decodeCompactTile,
  inspectTile,
  parseViewState,
  serializeViewState,
  validateChunk,
  validateManifest,
} from '../src/browser/semantic.mjs';

function primitive(sprite = 200) {
  return [sprite, 0, 'OBJECT_INITIAL', 0, 0, 0, 0, 0, 32, 32, 0, 0, [0, 0]];
}

function tile(x = 32360, y = 32230) {
  return [
    x,
    y,
    -7,
    x,
    y,
    7,
    'tile:test',
    [
      ['presentation:test-ground', 100, 0, 0, 0, 0, [primitive(200)]],
      ['presentation:test-item', 101, 0, 0, 1, 1, [primitive(201)]],
    ],
  ];
}

function manifest() {
  return {
    bounds: { floor: -7, xMaxExclusive: 32441, xMin: 32280, yMaxExclusive: 32306, yMin: 32155 },
    chunking: { originX: 32280, originY: 32155, span: 32 },
    chunks: [{ address: 'f-7/x2/y2', bytes: 1, contentId: `sha256:${'a'.repeat(64)}`, gzipBytes: 1, path: 'chunks/f-7-x2-y2.json', tiles: 1 }],
    counts: { presentationRecords: 39282, resolvedPrimitives: 39282, tiles: 24311 },
    profile: 'dyn-atlas-compact-json-v0',
    rootContentId: `sha256:${'b'.repeat(64)}`,
    source: { artifactDigest: 'sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e' },
    version: 0,
  };
}

test('compact tile decodes explicit Game ordering and unresolved identity', () => {
  const decoded = decodeCompactTile(tile());
  assert.equal(decoded.floor, -7);
  assert.equal(decoded.legacy.z, 7);
  assert.equal(decoded.presentations.length, 2);
  assert.deepEqual(decoded.presentations.map((entry) => entry.presentationOrder.order), [0, 1]);
  assert.equal(decoded.presentations[1].canonicalEntityId, null);
  assert.equal(decoded.presentations[1].identityState, 'UNRESOLVED');
});

test('inspector preserves semantic identity, stack, sprite refs, and provenance', () => {
  const result = inspectTile(tile());
  assert.deepEqual(result.worldPosition, { x: 32360, y: 32230, floor: -7 });
  assert.equal(result.stack[0].role, 'ground');
  assert.deepEqual(result.stack[1].spriteSourceIds, [201]);
  assert.equal(result.provenance.sourceArtifact, 'sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e');
});

test('deep-link state round-trips deterministically', () => {
  const state = parseViewState('?x=32370&y=32240&floor=-7&zoom=4');
  assert.equal(serializeViewState(state), '?x=32370&y=32240&floor=-7&zoom=4');
});

test('deep-link state fails closed outside the exported floor/bounds', () => {
  assert.throws(() => parseViewState('?x=1&y=32240&floor=-7&zoom=4'), SemanticError);
  assert.throws(() => parseViewState('?x=32370&y=32240&floor=7&zoom=4'), SemanticError);
});

test('camera itinerary is deterministic and explicitly non-authoritative for movement', () => {
  const first = cameraItinerary();
  const second = cameraItinerary();
  assert.deepEqual(first, second);
  assert.equal(first.length, CAMERA_ITINERARY.length);
  assert.ok(first.every((stop) => stop.advisoryKind === 'camera-view' && stop.movementAuthority === false));
});

test('manifest validation rejects alternate Game artifact identity', () => {
  const value = manifest();
  validateManifest(value);
  value.source.artifactDigest = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => validateManifest(value), /unexpected Game source artifact/);
});

test('chunk validation rejects duplicate or unordered tiles', () => {
  const value = manifest();
  const chunk = {
    address: { cx: 2, cy: 2, floor: -7, span: 32 },
    appearanceProfile: 'oteryn-atlas-15-32-appearance-spatial-v1',
    profile: 'dyn-atlas-compact-json-v0',
    sourceArtifact: 'sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e',
    tiles: [tile(32360, 32230), tile(32359, 32230)],
  };
  assert.throws(() => validateChunk(chunk, value), /tile order is not deterministic/);
});

test('primitive dimensions fail closed rather than guessing visual semantics', () => {
  const value = tile();
  value[7][0][6][0][8] = 48;
  assert.throws(() => decodeCompactTile(value), /unsupported primitive dimensions/);
});
