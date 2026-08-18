export const PROOF_PROFILE = 'dyn-atlas-compact-json-v0';
export const SOURCE_ARTIFACT = 'sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e';
export const PROOF_BOUNDS = Object.freeze({
  floor: -7,
  xMin: 32280,
  xMaxExclusive: 32441,
  yMin: 32155,
  yMaxExclusive: 32306,
});

export const CAMERA_ITINERARY = Object.freeze([
  Object.freeze({ x: 32280, y: 32155, floor: -7, label: 'north-west proof bound' }),
  Object.freeze({ x: 32360, y: 32230, floor: -7, label: 'representative proof center' }),
  Object.freeze({ x: 32440, y: 32305, floor: -7, label: 'south-east proof bound' }),
]);

export class SemanticError extends Error {}

function integer(value, name) {
  if (!Number.isSafeInteger(value)) throw new SemanticError(`${name} must be a safe integer`);
  return value;
}

function boundedCoordinate(value, min, maxExclusive, name) {
  integer(value, name);
  if (value < min || value >= maxExclusive) throw new SemanticError(`${name} outside proof bounds`);
  return value;
}

function exactBounds(bounds) {
  return Boolean(
    bounds && typeof bounds === 'object' && !Array.isArray(bounds) &&
    bounds.floor === PROOF_BOUNDS.floor &&
    bounds.xMin === PROOF_BOUNDS.xMin &&
    bounds.xMaxExclusive === PROOF_BOUNDS.xMaxExclusive &&
    bounds.yMin === PROOF_BOUNDS.yMin &&
    bounds.yMaxExclusive === PROOF_BOUNDS.yMaxExclusive
  );
}

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new SemanticError('manifest must be an object');
  if (manifest.profile !== PROOF_PROFILE || manifest.version !== 0) throw new SemanticError('unsupported manifest profile/version');
  if (manifest.source?.artifactDigest !== SOURCE_ARTIFACT) throw new SemanticError('unexpected Game source artifact');
  if (!exactBounds(manifest.bounds)) throw new SemanticError('unexpected proof bounds');
  if (!Array.isArray(manifest.chunks) || manifest.chunks.length < 1 || manifest.chunks.length > 512) throw new SemanticError('invalid chunk index');
  if (manifest.counts?.tiles !== 24311 || manifest.counts?.presentationRecords !== 39282 || manifest.counts?.resolvedPrimitives !== 39282) {
    throw new SemanticError('manifest count reconciliation failed');
  }
  const seen = new Set();
  for (const entry of manifest.chunks) {
    if (!entry || typeof entry !== 'object') throw new SemanticError('invalid chunk entry');
    if (typeof entry.address !== 'string' || seen.has(entry.address)) throw new SemanticError('duplicate/invalid logical chunk address');
    if (typeof entry.contentId !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(entry.contentId)) throw new SemanticError('invalid chunk content identity');
    if (typeof entry.path !== 'string' || !/^chunks\/f-7-x\d+-y\d+\.json$/.test(entry.path)) throw new SemanticError('invalid chunk path');
    seen.add(entry.address);
  }
  return manifest;
}

export function validateChunk(chunk, manifest) {
  validateManifest(manifest);
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) throw new SemanticError('chunk must be an object');
  if (chunk.profile !== PROOF_PROFILE || chunk.sourceArtifact !== SOURCE_ARTIFACT) throw new SemanticError('chunk profile/source mismatch');
  const address = chunk.address;
  if (!address || address.floor !== -7 || !Number.isSafeInteger(address.cx) || !Number.isSafeInteger(address.cy) || !Number.isSafeInteger(address.span)) {
    throw new SemanticError('invalid chunk logical address');
  }
  if (!Array.isArray(chunk.tiles) || chunk.tiles.length > 4096) throw new SemanticError('invalid chunk tile list');
  let previous = null;
  const tileKeys = new Set();
  for (const raw of chunk.tiles) {
    const tile = decodeCompactTile(raw);
    const key = `${tile.floor}:${tile.x}:${tile.y}`;
    if (tileKeys.has(key)) throw new SemanticError('duplicate tile in chunk');
    tileKeys.add(key);
    if (previous && (tile.y < previous.y || (tile.y === previous.y && tile.x <= previous.x))) throw new SemanticError('tile order is not deterministic');
    previous = tile;
  }
  return chunk;
}

export function decodeCompactTile(raw) {
  if (!Array.isArray(raw) || raw.length !== 8) throw new SemanticError('invalid compact tile shape');
  const [x, y, floor, legacyX, legacyY, legacyZ, tileRecordId, presentationsRaw] = raw;
  boundedCoordinate(x, PROOF_BOUNDS.xMin, PROOF_BOUNDS.xMaxExclusive, 'x');
  boundedCoordinate(y, PROOF_BOUNDS.yMin, PROOF_BOUNDS.yMaxExclusive, 'y');
  if (floor !== -7 || legacyX !== x || legacyY !== y || legacyZ !== 7) throw new SemanticError('coordinate provenance mismatch');
  if (typeof tileRecordId !== 'string' || !tileRecordId.startsWith('tile:')) throw new SemanticError('invalid tile identity');
  if (!Array.isArray(presentationsRaw) || presentationsRaw.length > 512) throw new SemanticError('invalid presentation list');

  const presentations = presentationsRaw.map((rawPresentation, index) => decodePresentation(rawPresentation, index));
  return Object.freeze({ x, y, floor, legacy: Object.freeze({ x: legacyX, y: legacyY, z: legacyZ }), tileRecordId, presentations });
}

function decodePresentation(raw, expectedOrder) {
  if (!Array.isArray(raw) || raw.length !== 7) throw new SemanticError('invalid presentation shape');
  const [recordId, appearanceSourceId, identityState, plane, order, roleCode, primitivesRaw] = raw;
  if (typeof recordId !== 'string' || !recordId.startsWith('presentation:')) throw new SemanticError('invalid presentation identity');
  integer(appearanceSourceId, 'appearanceSourceId');
  if (identityState !== 0) throw new SemanticError('proof must preserve unresolved canonical entity identity');
  if (plane !== 0 || order !== expectedOrder) throw new SemanticError('presentation order mismatch');
  if (roleCode !== 0 && roleCode !== 1) throw new SemanticError('unsupported presentation role');
  if (!Array.isArray(primitivesRaw) || primitivesRaw.length < 1 || primitivesRaw.length > 2048) throw new SemanticError('invalid primitive list');
  const primitives = primitivesRaw.map((rawPrimitive, layer) => decodePrimitive(rawPrimitive, layer));
  return Object.freeze({
    recordId,
    appearanceSourceId,
    canonicalEntityId: null,
    identityState: 'UNRESOLVED',
    presentationOrder: Object.freeze({ plane, order }),
    role: roleCode === 0 ? 'ground' : 'tile_item',
    primitives,
  });
}

function decodePrimitive(raw, expectedLayer) {
  if (!Array.isArray(raw) || raw.length !== 13) throw new SemanticError('invalid primitive shape');
  const [spriteSourceId, frameGroupId, frameGroupType, phase, layerIndex, patternX, patternY, patternZ, widthUnits, heightUnits, dxUnits, dyUnits, coverageRaw] = raw;
  for (const [value, name] of [[spriteSourceId, 'spriteSourceId'], [phase, 'phase'], [layerIndex, 'layerIndex'], [patternX, 'patternX'], [patternY, 'patternY'], [patternZ, 'patternZ'], [widthUnits, 'widthUnits'], [heightUnits, 'heightUnits'], [dxUnits, 'dxUnits'], [dyUnits, 'dyUnits']]) integer(value, name);
  if (layerIndex !== expectedLayer) throw new SemanticError('primitive layer order mismatch');
  if (widthUnits <= 0 || heightUnits <= 0 || widthUnits % 32 !== 0 || heightUnits % 32 !== 0) throw new SemanticError('unsupported primitive dimensions');
  if (!Array.isArray(coverageRaw) || coverageRaw.length % 2 !== 0) throw new SemanticError('invalid visual coverage');
  const coverage = [];
  for (let i = 0; i < coverageRaw.length; i += 2) coverage.push(Object.freeze({ dxTiles: integer(coverageRaw[i], 'coverage dx'), dyTiles: integer(coverageRaw[i + 1], 'coverage dy') }));
  return Object.freeze({
    spriteSourceId,
    frameGroupId,
    frameGroupType,
    phase,
    layerIndex,
    pattern: Object.freeze({ x: patternX, y: patternY, z: patternZ }),
    widthUnits,
    heightUnits,
    displacement: Object.freeze({ dxUnits, dyUnits }),
    coverage,
  });
}

export function parseViewState(input = '') {
  const params = new URLSearchParams(input.startsWith('?') ? input.slice(1) : input);
  const x = params.has('x') ? Number(params.get('x')) : 32360;
  const y = params.has('y') ? Number(params.get('y')) : 32230;
  const floor = params.has('floor') ? Number(params.get('floor')) : -7;
  const zoom = params.has('zoom') ? Number(params.get('zoom')) : 2;
  boundedCoordinate(x, PROOF_BOUNDS.xMin, PROOF_BOUNDS.xMaxExclusive, 'x');
  boundedCoordinate(y, PROOF_BOUNDS.yMin, PROOF_BOUNDS.yMaxExclusive, 'y');
  if (floor !== -7) throw new SemanticError('only the exported proof floor is available');
  if (!Number.isFinite(zoom) || zoom < 0.25 || zoom > 16) throw new SemanticError('zoom outside proof range');
  return Object.freeze({ x, y, floor, zoom });
}

export function serializeViewState(state) {
  const parsed = parseViewState(`x=${state.x}&y=${state.y}&floor=${state.floor}&zoom=${state.zoom}`);
  const params = new URLSearchParams();
  params.set('x', String(parsed.x));
  params.set('y', String(parsed.y));
  params.set('floor', String(parsed.floor));
  params.set('zoom', String(parsed.zoom));
  return `?${params.toString()}`;
}

export function inspectTile(tile) {
  const decoded = Array.isArray(tile) ? decodeCompactTile(tile) : tile;
  return Object.freeze({
    worldPosition: Object.freeze({ x: decoded.x, y: decoded.y, floor: decoded.floor }),
    sourcePosition: decoded.legacy,
    tileRecordId: decoded.tileRecordId,
    stack: decoded.presentations.map((presentation) => Object.freeze({
      recordId: presentation.recordId,
      appearanceSourceId: presentation.appearanceSourceId,
      canonicalEntityId: null,
      identityState: presentation.identityState,
      role: presentation.role,
      presentationOrder: presentation.presentationOrder,
      spriteSourceIds: presentation.primitives.map((primitive) => primitive.spriteSourceId),
      primitiveCount: presentation.primitives.length,
    })),
    provenance: Object.freeze({ sourceArtifact: SOURCE_ARTIFACT, coordinateProfile: 'oteryn-world-spatial-v1', appearanceProfile: 'oteryn-atlas-15-32-appearance-spatial-v1' }),
  });
}

export function cameraItinerary() {
  return CAMERA_ITINERARY.map((stop, index) => Object.freeze({ ...stop, order: index, advisoryKind: 'camera-view', movementAuthority: false }));
}
