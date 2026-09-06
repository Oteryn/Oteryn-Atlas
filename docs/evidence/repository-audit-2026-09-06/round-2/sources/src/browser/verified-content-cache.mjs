import { sha256ContentId } from './loader.mjs';

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
  }

  key(contentId) {
    if (!/^sha256:[0-9a-f]{64}$/.test(contentId ?? '')) throw new Error('verified cache requires sha256 content identity');
    return new URL(`/.oteryn-atlas-cache/${contentId.slice(7)}`, globalThis.location?.origin ?? 'https://atlas.invalid').toString();
  }

  async open() {
    if (!this.enabled || !this.cacheStorage?.open) return null;
    return this.cacheStorage.open(this.cacheName);
  }

  async get(contentId, expectedBytes = null) {
    const cache = await this.open();
    if (!cache) { this.misses += 1; return null; }
    const response = await cache.match(this.key(contentId));
    if (!response) { this.misses += 1; return null; }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if ((expectedBytes != null && bytes.byteLength !== expectedBytes) || await sha256ContentId(bytes) !== contentId) {
      this.rejected += 1;
      await cache.delete(this.key(contentId));
      return null;
    }
    this.hits += 1;
    return bytes;
  }

  async put(contentId, bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength <= 0 || bytes.byteLength > this.maxEntryBytes) return false;
    if (await sha256ContentId(bytes) !== contentId) throw new Error('refusing to cache bytes under a mismatched content identity');
    const cache = await this.open();
    if (!cache) return false;
    await cache.put(this.key(contentId), new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } }));
    this.writes += 1;
    return true;
  }

  stats() {
    return Object.freeze({ enabled: this.enabled, hits: this.hits, misses: this.misses, writes: this.writes, rejected: this.rejected });
  }
}
