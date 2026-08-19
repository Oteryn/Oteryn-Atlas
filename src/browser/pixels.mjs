import { canonicalJsonBytes, sha256ContentId } from './loader.mjs';
import { SOURCE_ARTIFACT } from './semantic.mjs';

export const PIXEL_PROFILE = 'dyn-atlas-pixel-store-v0';
export const PIXEL_ASSET_SHA256 = '1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f';
export const PIXEL_HASH_DOMAIN = 'OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0';
const ROOT_DOMAIN = 'OTERYN-DYN-ATLAS-PIXEL-STORE-V0\0';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_PACK_BYTES = 16 * 1024 * 1024;

export class PixelStoreError extends Error {}

function isSha256(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

function assertInteger(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new PixelStoreError(`${name} must be an integer >= ${minimum}`);
}

async function readBounded(response, limit, label) {
  if (!response?.ok) throw new PixelStoreError(`${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null && Number(declared) > limit) throw new PixelStoreError(`${label} declared bytes exceed proof limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new PixelStoreError(`${label} bytes exceed proof limit`);
  return bytes;
}

export async function pixelContentId(entry, bytes) {
  const domain = new TextEncoder().encode(PIXEL_HASH_DOMAIN);
  const header = new Uint8Array(4);
  const view = new DataView(header.buffer);
  view.setUint16(0, entry.width, false);
  view.setUint16(2, entry.height, false);
  const joined = new Uint8Array(domain.length + header.length + bytes.length);
  joined.set(domain, 0);
  joined.set(header, domain.length);
  joined.set(bytes, domain.length + header.length);
  return sha256ContentId(joined);
}

export async function computePixelRootContentId(manifest) {
  const core = { ...manifest };
  delete core.rootContentId;
  const domain = new TextEncoder().encode(ROOT_DOMAIN);
  const canonical = canonicalJsonBytes(core);
  const joined = new Uint8Array(domain.length + canonical.length);
  joined.set(domain, 0);
  joined.set(canonical, domain.length);
  return sha256ContentId(joined);
}

export function validatePixelManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new PixelStoreError('pixel manifest must be an object');
  if (manifest.profile !== PIXEL_PROFILE || manifest.version !== 0) throw new PixelStoreError('unsupported pixel manifest profile/version');
  if (manifest.assetZipSha256 !== PIXEL_ASSET_SHA256) throw new PixelStoreError('unexpected exact-source pixel archive');
  if (manifest.gameSemanticArtifact !== SOURCE_ARTIFACT) throw new PixelStoreError('pixel store Game artifact mismatch');
  if (manifest.pixelHashDomain !== PIXEL_HASH_DOMAIN.slice(0, -1)) throw new PixelStoreError('pixel hash domain mismatch');
  if (manifest.blobCount !== 987 || !Array.isArray(manifest.blobs) || manifest.blobs.length !== 987) throw new PixelStoreError('pixel blob count mismatch');
  if (!isSha256(manifest.rootContentId)) throw new PixelStoreError('invalid pixel root content identity');
  const pack = manifest.pack;
  if (!pack || typeof pack !== 'object' || pack.path !== 'pack.rgba') throw new PixelStoreError('invalid pixel pack descriptor');
  assertInteger(pack.bytes, 'pack bytes', 1);
  if (pack.bytes !== 7725056 || !/^[0-9a-f]{64}$/.test(pack.sha256 ?? '')) throw new PixelStoreError('pixel pack identity mismatch');

  const seen = new Set();
  let expectedOffset = 0;
  for (const entry of manifest.blobs) {
    if (!entry || typeof entry !== 'object' || !isSha256(entry.contentId) || seen.has(entry.contentId)) throw new PixelStoreError('duplicate/invalid pixel blob identity');
    assertInteger(entry.width, 'blob width', 1);
    assertInteger(entry.height, 'blob height', 1);
    assertInteger(entry.offset, 'blob offset');
    assertInteger(entry.bytes, 'blob bytes', 1);
    if (entry.width % 32 !== 0 || entry.height % 32 !== 0) throw new PixelStoreError('unsupported pixel dimensions');
    if (entry.bytes !== entry.width * entry.height * 4) throw new PixelStoreError('pixel blob byte count mismatch');
    if (entry.offset !== expectedOffset) throw new PixelStoreError('pixel pack is not canonical/contiguous');
    expectedOffset += entry.bytes;
    seen.add(entry.contentId);
  }
  if (expectedOffset !== pack.bytes) throw new PixelStoreError('pixel pack span mismatch');

  const spriteEntries = Object.entries(manifest.spriteIndex ?? {});
  if (spriteEntries.length !== 990) throw new PixelStoreError('pixel sprite index count mismatch');
  for (const [spriteId, entry] of spriteEntries) {
    if (!/^[1-9][0-9]*$/.test(spriteId) || !entry || !seen.has(entry.contentId)) throw new PixelStoreError('invalid pixel sprite index entry');
    assertInteger(entry.width, 'sprite width', 1);
    assertInteger(entry.height, 'sprite height', 1);
  }
  return manifest;
}

export async function loadPixelStore(manifestUrl = './proof/pixels/manifest.json', fetcher = fetch) {
  const manifestResponse = await fetcher(manifestUrl, { cache: 'no-store' });
  const manifestBytes = await readBounded(manifestResponse, MAX_MANIFEST_BYTES, 'pixel manifest');
  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  } catch (error) {
    throw new PixelStoreError(`pixel manifest is not valid UTF-8 JSON: ${error.message}`);
  }
  validatePixelManifest(manifest);
  if (await computePixelRootContentId(manifest) !== manifest.rootContentId) throw new PixelStoreError('pixel root content identity mismatch');

  const baseUrl = new URL('./', new URL(manifestUrl, location.href));
  const packUrl = new URL(manifest.pack.path, baseUrl).toString();
  const packResponse = await fetcher(packUrl, { cache: 'no-store' });
  const packBytes = await readBounded(packResponse, MAX_PACK_BYTES, 'pixel pack');
  if (packBytes.byteLength !== manifest.pack.bytes) throw new PixelStoreError('pixel pack byte count differs from manifest');
  const actualPackSha = (await sha256ContentId(packBytes)).slice('sha256:'.length);
  if (actualPackSha !== manifest.pack.sha256) throw new PixelStoreError('pixel pack SHA-256 mismatch');

  const blobs = new Map();
  for (const entry of manifest.blobs) {
    const bytes = packBytes.subarray(entry.offset, entry.offset + entry.bytes);
    if (await pixelContentId(entry, bytes) !== entry.contentId) throw new PixelStoreError(`pixel blob identity mismatch: ${entry.contentId}`);
    blobs.set(entry.contentId, Object.freeze({ ...entry, bytes }));
  }

  const sprites = new Map();
  for (const [spriteId, entry] of Object.entries(manifest.spriteIndex)) {
    const blob = blobs.get(entry.contentId);
    if (!blob || blob.width !== entry.width || blob.height !== entry.height) throw new PixelStoreError(`sprite/blob dimension mismatch: ${spriteId}`);
    sprites.set(Number(spriteId), blob);
  }
  return Object.freeze({ manifest, packBytes, blobs, sprites });
}
