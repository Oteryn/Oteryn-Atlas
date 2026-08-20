export const PERFORMANCE_PROFILE_REFERENCE = 'reference';
export const PERFORMANCE_PROFILE_LOCAL_MAX = 'local-max';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function integer(value, fallback) {
  return Number.isFinite(Number(value)) ? Math.max(1, Math.floor(Number(value))) : fallback;
}

export function resolvePerformanceProfile(input = '', capabilities = {}) {
  const params = input instanceof URLSearchParams
    ? input
    : new URLSearchParams(String(input ?? '').replace(/^\?/, ''));
  const requested = params.get('perf') ?? 'auto';
  if (!['auto', PERFORMANCE_PROFILE_REFERENCE, PERFORMANCE_PROFILE_LOCAL_MAX].includes(requested)) {
    throw new Error(`unsupported Atlas performance profile: ${requested}`);
  }

  const hardwareConcurrency = integer(capabilities.hardwareConcurrency ?? globalThis.navigator?.hardwareConcurrency, 4);
  const deviceMemoryGiB = Number(capabilities.deviceMemoryGiB ?? globalThis.navigator?.deviceMemory ?? 0) || null;

  // `local-max` authenticates and uploads the complete pixel bundle before the
  // first detail paint. That mode is valuable for explicit qualification and
  // high-throughput local work, but it is a poor interactive default: browser
  // hardware hints say nothing about LAN/storage throughput and can turn a
  // normal page load into a hundreds-of-megabytes first-paint dependency.
  // Keep it explicit and make `auto` use the bounded streaming profile.
  const name = requested === PERFORMANCE_PROFILE_LOCAL_MAX
    ? PERFORMANCE_PROFILE_LOCAL_MAX
    : PERFORMANCE_PROFILE_REFERENCE;

  const local = name === PERFORMANCE_PROFILE_LOCAL_MAX;
  const groupConcurrency = local ? clamp(Math.floor(hardwareConcurrency * 0.75), 6, 16) : 4;
  const semanticCacheBytes = local ? 256 * 1024 * 1024 : 24 * 1024 * 1024;
  const maxLoadedChunks = local ? 64 : 16;
  const maxLoadedGroups = local ? 384 : 96;
  const gpuTextureBudgetBytes = local ? 768 * 1024 * 1024 : 384 * 1024 * 1024;

  return Object.freeze({
    name,
    requested,
    hardwareConcurrency,
    deviceMemoryGiB,
    groupConcurrency,
    overviewConcurrency: local ? 12 : 8,
    pixelBucketConcurrency: local ? clamp(Math.floor(hardwareConcurrency * 1.5), 12, 24) : 8,
    prefetchTiles: local ? 12 : 4,
    semanticCacheBytes,
    maxLoadedChunks,
    maxLoadedGroups,
    gpuTextureBudgetBytes,
    drawCallTarget: 1,
    capture: params.get('capture') === '1',
    synchronousEvidence: params.get('sync-evidence') === '1',
    measureVisibility: !local || params.get('measure-visibility') === '1',
  });
}

export function profileSummary(profile) {
  return Object.freeze({
    name: profile.name,
    requested: profile.requested,
    hardwareConcurrency: profile.hardwareConcurrency,
    deviceMemoryGiB: profile.deviceMemoryGiB,
    groupConcurrency: profile.groupConcurrency,
    overviewConcurrency: profile.overviewConcurrency,
    pixelBucketConcurrency: profile.pixelBucketConcurrency,
    prefetchTiles: profile.prefetchTiles,
    semanticCacheBytes: profile.semanticCacheBytes,
    maxLoadedChunks: profile.maxLoadedChunks,
    maxLoadedGroups: profile.maxLoadedGroups,
    gpuTextureBudgetBytes: profile.gpuTextureBudgetBytes,
    drawCallTarget: profile.drawCallTarget,
    capture: profile.capture,
    synchronousEvidence: profile.synchronousEvidence,
    measureVisibility: profile.measureVisibility,
  });
}
