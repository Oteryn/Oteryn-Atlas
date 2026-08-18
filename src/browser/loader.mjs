import { validateChunk, validateManifest } from './semantic.mjs';

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
const ROOT_DOMAIN = 'OTERYN-DYN-ATLAS-COMPACT-JSON-V0\0';

export class LoadError extends Error {}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = sortCanonical(value[key]);
    return result;
  }
  return value;
}

export function canonicalJsonBytes(value) {
  const text = `${JSON.stringify(sortCanonical(value))}\n`;
  return new TextEncoder().encode(text);
}

export async function sha256ContentId(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

export async function computeRootContentId(manifest) {
  const core = { ...manifest };
  delete core.rootContentId;
  const domain = new TextEncoder().encode(ROOT_DOMAIN);
  const canonical = canonicalJsonBytes(core);
  const joined = new Uint8Array(domain.length + canonical.length);
  joined.set(domain, 0);
  joined.set(canonical, domain.length);
  return sha256ContentId(joined);
}

async function readBoundedResponse(response, limit, label) {
  if (!response?.ok) throw new LoadError(`${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared !== null && declared !== undefined && Number(declared) > limit) throw new LoadError(`${label} declared bytes exceed proof limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > limit) throw new LoadError(`${label} bytes exceed proof limit`);
  return bytes;
}

function decodeJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    throw new LoadError(`${label} is not valid UTF-8 JSON: ${error.message}`);
  }
}

export async function loadManifest(url, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBoundedResponse(response, MAX_MANIFEST_BYTES, 'manifest');
  const manifest = validateManifest(decodeJson(bytes, 'manifest'));
  const actualRoot = await computeRootContentId(manifest);
  if (manifest.rootContentId !== actualRoot) throw new LoadError('manifest root content identity mismatch');
  return manifest;
}

export async function loadChunk(baseUrl, entry, manifest, fetcher = fetch) {
  if (!entry || typeof entry !== 'object') throw new LoadError('invalid chunk index entry');
  if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > MAX_CHUNK_BYTES) throw new LoadError('invalid indexed chunk byte size');
  const url = new URL(entry.path, baseUrl).toString();
  const response = await fetcher(url, { cache: 'no-store' });
  const bytes = await readBoundedResponse(response, MAX_CHUNK_BYTES, 'chunk');
  if (bytes.byteLength !== entry.bytes) throw new LoadError('chunk byte count differs from manifest');
  const contentId = await sha256ContentId(bytes);
  if (contentId !== entry.contentId) throw new LoadError('chunk content identity mismatch');
  return validateChunk(decodeJson(bytes, 'chunk'), manifest);
}
