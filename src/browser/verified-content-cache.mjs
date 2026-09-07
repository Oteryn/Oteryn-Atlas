import { readBoundedResponseBytes, sha256ContentId } from './loader.mjs';

export class VerifiedContentCache {
  constructor(options = {}) {
    this.cacheName = options.cacheName ?? 'oteryn-atlas-verified-content-v1';
    this.enabled = options.enabled ?? true;
    this.cacheStorage = options.cacheStorage ?? globalThis.caches ?? null;
    this.maxEntryBytes = options.maxEntryBytes ?? 96 * 1024 * 1024;
    this.hits = 0;
    this.misses = 0;
    this.writes = 0;
    this.rejected = 0;
    this.errors = 0;
  }

  key(contentId) {
    if (!/^sha256:[0-9a-f]{64}$/.test(contentId ?? '')) throw new Error('verified cache requires sha256 content identity');
    return new URL(`/.oteryn-atlas-cache/${contentId.slice(7)}`, globalThis.location?.origin ?? 'https://atlas.invalid').toString();
  }

  async open() {
    if (!this.enabled || !this.cacheStorage?.open) return null;
    try {
      return await this.cacheStorage.open(this.cacheName);
    } catch {
      this.errors += 1;
      return null;
    }
  }

  async get(contentId, expectedBytes = null) {
    const key = this.key(contentId);
    const cache = await this.open();
    if (!cache) { this.misses += 1; return null; }
    let response;
    try {
      response = await cache.match(key);
    } catch {
      this.errors += 1;
      this.misses += 1;
      return null;
    }
    if (!response) { this.misses += 1; return null; }
    let bytes;
    try {
      bytes = await readBoundedResponseBytes(response, this.maxEntryBytes, 'verified cache entry');
    } catch {
      this.rejected += 1;
      try { await cache.delete(key); } catch { this.errors += 1; }
      return null;
    }
    if ((expectedBytes != null && bytes.byteLength !== expectedBytes) || await sha256ContentId(bytes) !== contentId) {
      this.rejected += 1;
      try { await cache.delete(key); } catch { this.errors += 1; }
      return null;
    }
    this.hits += 1;
    return bytes;
  }

  async put(contentId, bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength <= 0 || bytes.byteLength > this.maxEntryBytes) return false;
    if (await sha256ContentId(bytes) !== contentId) throw new Error('refusing to cache bytes under a mismatched content identity');
    const key = this.key(contentId);
    const cache = await this.open();
    if (!cache) return false;
    try {
      await cache.put(key, new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } }));
    } catch {
      this.errors += 1;
      return false;
    }
    this.writes += 1;
    return true;
  }

  stats() {
    return Object.freeze({ enabled: this.enabled, hits: this.hits, misses: this.misses, writes: this.writes, rejected: this.rejected, errors: this.errors });
  }
}
