import { sha256ContentId } from './loader.mjs';
import { ancillarySourceExpectations, PRODUCTION_FULLWORLD_TRUST, resolveQualificationManifestTrust, resolveBoundedRealManifestTrust } from './fullworld-trust.mjs';

export const GAMEPLAY_EXPECTATIONS = Object.freeze({
  contractId: 'oteryn-game-atlas-export-v1',
  semanticRevision: 1,
  capability: 'creature-gameplay-profiles-v1',
  profileSchemaVersion: 1,
  gameSha: 'b56ce339281d252a9e01a5a2bed583582bf29e68',
  semanticDigest: 'sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28',
  sourceRepository: 'blakinio/Otheryn',
  sourceSha: 'e417c5e7c22986bf4acef0495eb47f7b72c97cce',
  shardKeyRule: 'entity-hash-prefix-2',
  limitProfile: 'creature-gameplay-profiles-v1-e417-census-v1',
});

const PRODUCER_LIMITS = Object.freeze({
  max_manifest_bytes: 262144,
  max_shard_bytes: 524288,
  max_profiles_per_shard: 32,
  max_npc_profiles: 2048,
  max_monster_profiles: 4096,
  max_referenced_items: 4096,
  max_shards: 513,
  max_shop_sells_per_profile: 256,
  max_shop_buys_per_profile: 2048,
  max_shop_rows_per_profile: 2304,
  max_loot_rows_per_profile: 128,
  max_travel_destinations_per_profile: 16,
  max_resistance_elements_per_profile: 16,
  max_immunities_per_profile: 16,
  max_string_bytes: 256,
  max_nesting_depth: 12,
  max_price: 100000000,
  max_loot_count: 1024,
  max_abs_resistance_percent: 2048,
});

export const GAMEPLAY_LIMITS = Object.freeze({
  producer: PRODUCER_LIMITS,
  defaultCacheShards: 4,
  maxCacheShards: 8,
  maxCacheBytes: 4 * 1024 * 1024,
});

const STATES = new Set(['COMPLETE', 'PARTIAL', 'UNRESOLVED', 'AMBIGUOUS', 'UNKNOWN', 'NOT_APPLICABLE']);
const ENTITY_ID = /^(npc|monster)-entity:([0-9a-f]{32})$/;
const ITEM_REF = /^oteryn:item\.[a-z0-9][a-z0-9._-]{0,127}$/;
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const HEX_KEY = /^[0-9a-f]{2}$/;
const SERVICES = new Set(['bank', 'blessing', 'trainer', 'shop', 'travel', 'quest']);

export class CreatureGameplayProfileError extends Error {}

function fail(condition, message) {
  if (!condition) throw new CreatureGameplayProfileError(message);
}

function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = sortCanonical(value[key]);
    return result;
  }
  return value;
}

export function canonicalGameplayJsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(sortCanonical(value)));
}

function sameJson(a, b) {
  const left = canonicalGameplayJsonBytes(a);
  const right = canonicalGameplayJsonBytes(b);
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function exactKeys(value, required, optional, label) {
  fail(value && typeof value === 'object' && !Array.isArray(value), `${label} must be object`);
  const keys = Object.keys(value);
  for (const key of required) fail(Object.hasOwn(value, key), `${label} missing ${key}`);
  const allowed = new Set([...required, ...optional]);
  fail(keys.every((key) => allowed.has(key)), `${label} has unsupported field`);
  return value;
}

function safeRelativePath(path) {
  fail(typeof path === 'string' && path.length > 0, 'shard path missing');
  fail(!path.startsWith('/') && !path.includes('\\') && !path.includes('//'), 'unsafe shard path');
  fail(!path.split('/').some((part) => part === '' || part === '.' || part === '..'), 'unsafe shard path');
  fail(path.startsWith('shards/') && path.endsWith('.json'), 'invalid shard path');
  return path;
}

function validCount(value, max, label) {
  fail(Number.isSafeInteger(value) && value >= 0 && value <= max, `${label} invalid`);
}

function validateString(value, label, { allowNull = false } = {}) {
  if (allowNull && value == null) return;
  fail(typeof value === 'string' && value.length > 0, `${label} invalid`);
  fail(new TextEncoder().encode(value).byteLength <= PRODUCER_LIMITS.max_string_bytes, `${label} exceeds string bound`);
}

function validateState(section, label) {
  fail(STATES.has(section?.state), `${label} completeness state invalid`);
  if (section.reason_codes !== undefined) {
    fail(Array.isArray(section.reason_codes), `${label} reason_codes invalid`);
    fail(section.reason_codes.length === new Set(section.reason_codes).size, `${label} reason_codes duplicate`);
    for (const reason of section.reason_codes) validateString(reason, `${label} reason_code`);
  }
}

function validateItemRelation(row, label) {
  validateString(row.item_name, `${label} item_name`);
  fail(['RESOLVED', 'UNRESOLVED', 'AMBIGUOUS', 'UNKNOWN'].includes(row.item_resolution_state), `${label} item resolution invalid`);
  if (row.item_ref == null) {
    fail(row.item_resolution_state !== 'RESOLVED', `${label} resolved item lacks item_ref`);
  } else {
    fail(typeof row.item_ref === 'string' && ITEM_REF.test(row.item_ref), `${label} item_ref invalid`);
    fail(row.item_resolution_state === 'RESOLVED', `${label} item_ref is not resolved`);
  }
}

function validateTradeRows(rows, max, label) {
  fail(Array.isArray(rows) && rows.length <= max, `${label} row bound exceeded`);
  for (const [index, raw] of rows.entries()) {
    const row = exactKeys(raw, ['item_ref', 'item_name', 'item_resolution_state', 'unit_price', 'currency'], ['amount'], `${label}[${index}]`);
    validateItemRelation(row, `${label}[${index}]`);
    fail(Number.isSafeInteger(row.unit_price) && row.unit_price >= 0 && row.unit_price <= PRODUCER_LIMITS.max_price, `${label} price invalid`);
    fail(row.currency === 'gold', `${label} currency invalid`);
    if (row.amount !== undefined) fail(Number.isSafeInteger(row.amount) && row.amount > 0, `${label} amount invalid`);
  }
}

function validateNpc(profile) {
  exactKeys(profile, ['entity_id', 'kind', 'name', 'shop', 'services', 'travel'], [], 'npc profile');
  const match = typeof profile.entity_id === 'string' ? ENTITY_ID.exec(profile.entity_id) : null;
  fail(match?.[1] === 'npc', 'npc entity_id invalid');
  fail(profile.kind === 'npc', 'npc kind invalid');
  validateString(profile.name, 'npc name');
  const shop = exactKeys(profile.shop, ['state', 'sells', 'buys', 'reason_codes'], [], 'npc shop');
  validateState(shop, 'npc shop');
  validateTradeRows(shop.sells, PRODUCER_LIMITS.max_shop_sells_per_profile, 'npc sells');
  validateTradeRows(shop.buys, PRODUCER_LIMITS.max_shop_buys_per_profile, 'npc buys');
  fail(shop.sells.length + shop.buys.length <= PRODUCER_LIMITS.max_shop_rows_per_profile, 'npc shop total row bound exceeded');

  const services = exactKeys(profile.services, ['state', 'values'], ['reason_codes'], 'npc services');
  validateState(services, 'npc services');
  fail(Array.isArray(services.values) && services.values.length <= SERVICES.size, 'npc services invalid');
  fail(services.values.length === new Set(services.values).size && services.values.every((value) => SERVICES.has(value)), 'npc service value invalid');

  const travel = exactKeys(profile.travel, ['state', 'destinations', 'reason_codes'], [], 'npc travel');
  validateState(travel, 'npc travel');
  fail(Array.isArray(travel.destinations) && travel.destinations.length <= PRODUCER_LIMITS.max_travel_destinations_per_profile, 'npc travel row bound exceeded');
  for (const [index, raw] of travel.destinations.entries()) {
    const row = exactKeys(raw, ['label'], ['position', 'price', 'currency'], `travel[${index}]`);
    validateString(row.label, `travel[${index}] label`);
    if (row.position !== undefined) {
      exactKeys(row.position, ['x', 'y', 'floor'], [], 'travel position');
      fail(['x', 'y', 'floor'].every((key) => Number.isSafeInteger(row.position[key])), 'travel position invalid');
    }
    if (row.price !== undefined) fail(Number.isSafeInteger(row.price) && row.price >= 0 && row.price <= PRODUCER_LIMITS.max_price, 'travel price invalid');
    if (row.currency !== undefined) fail(row.currency === 'gold', 'travel currency invalid');
  }
  return profile;
}

function validateMonster(profile) {
  exactKeys(profile, ['entity_id', 'kind', 'name', 'loot', 'stats', 'resistances'], [], 'monster profile');
  const match = typeof profile.entity_id === 'string' ? ENTITY_ID.exec(profile.entity_id) : null;
  fail(match?.[1] === 'monster', 'monster entity_id invalid');
  fail(profile.kind === 'monster', 'monster kind invalid');
  validateString(profile.name, 'monster name');

  const loot = exactKeys(profile.loot, ['state', 'entries', 'reason_codes'], [], 'monster loot');
  validateState(loot, 'monster loot');
  fail(Array.isArray(loot.entries) && loot.entries.length <= PRODUCER_LIMITS.max_loot_rows_per_profile, 'monster loot row bound exceeded');
  for (const [index, raw] of loot.entries.entries()) {
    const row = exactKeys(raw, ['item_ref', 'item_name', 'item_resolution_state', 'chance_ppm', 'min_count', 'max_count'], [], `loot[${index}]`);
    validateItemRelation(row, `loot[${index}]`);
    fail(Number.isSafeInteger(row.chance_ppm) && row.chance_ppm >= 0 && row.chance_ppm <= 1_000_000, 'loot chance_ppm invalid');
    fail(Number.isSafeInteger(row.min_count) && Number.isSafeInteger(row.max_count) && row.min_count >= 0 && row.max_count >= row.min_count && row.max_count <= PRODUCER_LIMITS.max_loot_count, 'loot count invalid');
  }

  const stats = exactKeys(profile.stats, ['state', 'health', 'experience', 'armor', 'defense', 'speed'], ['reason_codes'], 'monster stats');
  validateState(stats, 'monster stats');
  for (const key of ['health', 'experience', 'armor', 'defense', 'speed']) {
    fail(stats[key] == null || (Number.isSafeInteger(stats[key]) && stats[key] >= 0), `monster stats ${key} invalid`);
  }
  if (stats.state === 'COMPLETE') fail(['health', 'experience', 'armor', 'defense', 'speed'].every((key) => stats[key] != null), 'complete monster stats contain null');

  const resistances = exactKeys(profile.resistances, ['state', 'elements', 'immunities'], ['reason_codes'], 'monster resistances');
  validateState(resistances, 'monster resistances');
  fail(Array.isArray(resistances.elements) && resistances.elements.length <= PRODUCER_LIMITS.max_resistance_elements_per_profile, 'resistance row bound exceeded');
  for (const [index, raw] of resistances.elements.entries()) {
    const row = exactKeys(raw, ['type', 'percent'], [], `resistance[${index}]`);
    validateString(row.type, `resistance[${index}] type`);
    fail(Number.isSafeInteger(row.percent) && Math.abs(row.percent) <= PRODUCER_LIMITS.max_abs_resistance_percent, 'resistance percent invalid');
  }
  fail(Array.isArray(resistances.immunities) && resistances.immunities.length <= PRODUCER_LIMITS.max_immunities_per_profile, 'immunity row bound exceeded');
  fail(resistances.immunities.length === new Set(resistances.immunities).size, 'duplicate immunity');
  for (const immunity of resistances.immunities) validateString(immunity, 'immunity');
  return profile;
}

function validateProfile(profile) {
  return profile?.kind === 'npc' ? validateNpc(profile) : profile?.kind === 'monster' ? validateMonster(profile) : fail(false, 'profile kind invalid');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function descriptorCounts(manifest) {
  const result = { npc_profiles: 0, monster_profiles: 0, referenced_items: 0 };
  for (const shard of manifest.shards) {
    if (shard.kind === 'npc') result.npc_profiles += shard.records;
    else if (shard.kind === 'monster') result.monster_profiles += shard.records;
    else result.referenced_items += shard.records;
  }
  return result;
}

export async function validateCreatureGameplayManifest(manifest, { expectedSemanticDigest = GAMEPLAY_EXPECTATIONS.semanticDigest } = {}) {
  exactKeys(manifest, ['contract_id', 'semantic_revision', 'capability', 'profile_schema_version', 'producer_repository_sha', 'source_evidence', 'shard_key_rule', 'limit_profile', 'limits', 'counts', 'shards', 'semantic_digest'], [], 'gameplay manifest');
  fail(manifest.contract_id === GAMEPLAY_EXPECTATIONS.contractId, 'gameplay contract mismatch');
  fail(manifest.semantic_revision === GAMEPLAY_EXPECTATIONS.semanticRevision, 'gameplay semantic revision mismatch');
  fail(manifest.capability === GAMEPLAY_EXPECTATIONS.capability, 'gameplay capability mismatch');
  fail(manifest.profile_schema_version === GAMEPLAY_EXPECTATIONS.profileSchemaVersion, 'gameplay profile schema mismatch');
  fail(typeof manifest.producer_repository_sha === 'string' && SHA.test(manifest.producer_repository_sha), 'gameplay Game SHA invalid');
  fail(manifest.producer_repository_sha === GAMEPLAY_EXPECTATIONS.gameSha, 'gameplay Game SHA mismatch');
  exactKeys(manifest.source_evidence, ['repository', 'sha'], [], 'gameplay source evidence');
  fail(manifest.source_evidence.repository === GAMEPLAY_EXPECTATIONS.sourceRepository && manifest.source_evidence.sha === GAMEPLAY_EXPECTATIONS.sourceSha, 'gameplay source evidence mismatch');
  fail(manifest.shard_key_rule === GAMEPLAY_EXPECTATIONS.shardKeyRule, 'gameplay shard rule mismatch');
  fail(manifest.limit_profile === GAMEPLAY_EXPECTATIONS.limitProfile, 'gameplay limit profile mismatch');
  fail(sameJson(manifest.limits, PRODUCER_LIMITS), 'gameplay producer limits mismatch');

  exactKeys(manifest.counts, ['npc_profiles', 'monster_profiles', 'referenced_items'], [], 'gameplay counts');
  validCount(manifest.counts.npc_profiles, PRODUCER_LIMITS.max_npc_profiles, 'npc profile count');
  validCount(manifest.counts.monster_profiles, PRODUCER_LIMITS.max_monster_profiles, 'monster profile count');
  validCount(manifest.counts.referenced_items, PRODUCER_LIMITS.max_referenced_items, 'referenced item count');
  fail(Array.isArray(manifest.shards) && manifest.shards.length <= PRODUCER_LIMITS.max_shards, 'gameplay shard count invalid');
  const slots = new Set();
  const paths = new Set();
  for (const shard of manifest.shards) {
    exactKeys(shard, ['kind', 'key', 'path', 'bytes', 'digest', 'records'], [], 'gameplay shard descriptor');
    fail(['npc', 'monster', 'referenced-items'].includes(shard.kind), 'gameplay shard kind invalid');
    if (shard.kind === 'referenced-items') fail(shard.key === 'all', 'referenced item shard key invalid');
    else fail(typeof shard.key === 'string' && HEX_KEY.test(shard.key), 'gameplay shard key invalid');
    safeRelativePath(shard.path);
    fail(!paths.has(shard.path), 'duplicate gameplay shard path'); paths.add(shard.path);
    const slot = `${shard.kind}:${shard.key}`; fail(!slots.has(slot), 'duplicate gameplay shard slot'); slots.add(slot);
    validCount(shard.bytes, PRODUCER_LIMITS.max_shard_bytes, 'gameplay shard bytes');
    fail(shard.bytes > 0, 'gameplay shard bytes invalid');
    validCount(shard.records, shard.kind === 'referenced-items' ? PRODUCER_LIMITS.max_referenced_items : PRODUCER_LIMITS.max_profiles_per_shard, 'gameplay shard records');
    fail(typeof shard.digest === 'string' && DIGEST.test(shard.digest), 'gameplay shard digest invalid');
  }
  fail(sameJson(descriptorCounts(manifest), manifest.counts), 'gameplay descriptor count mismatch');
  fail(typeof manifest.semantic_digest === 'string' && DIGEST.test(manifest.semantic_digest), 'gameplay semantic digest invalid');
  const unsigned = { ...manifest }; delete unsigned.semantic_digest;
  const actual = await sha256ContentId(canonicalGameplayJsonBytes(unsigned));
  fail(actual === manifest.semantic_digest, 'gameplay semantic digest mismatch');
  fail(expectedSemanticDigest == null || manifest.semantic_digest === expectedSemanticDigest, 'gameplay trusted semantic digest mismatch');
  return deepFreeze(manifest);
}

async function readBounded(response, maxBytes, expectedBytes, label) {
  fail(response?.ok, `${label} fetch failed: ${response?.status ?? 'unknown'}`);
  const declared = response.headers?.get?.('content-length');
  if (declared != null) fail(Number(declared) <= maxBytes, `${label} declared bytes exceed limit`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  fail(bytes.byteLength <= maxBytes, `${label} bytes exceed limit`);
  if (expectedBytes != null) fail(bytes.byteLength === expectedBytes, `${label} byte count mismatch`);
  return bytes;
}

function decodeCanonical(bytes, label) {
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch (error) { throw new CreatureGameplayProfileError(`${label} is not valid UTF-8 JSON: ${error.message}`); }
  const canonical = canonicalGameplayJsonBytes(value);
  fail(canonical.byteLength === bytes.byteLength && canonical.every((byte, index) => byte === bytes[index]), `${label} is not canonical JSON`);
  return value;
}

async function fetchCanonical(url, fetchImpl, maxBytes, expectedBytes, expectedDigest, label) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  const bytes = await readBounded(response, maxBytes, expectedBytes, label);
  if (expectedDigest) fail(await sha256ContentId(bytes) === expectedDigest, `${label} digest mismatch`);
  return decodeCanonical(bytes, label);
}

function validateShard(value, descriptor) {
  if (descriptor.kind === 'referenced-items') {
    exactKeys(value, ['kind', 'key', 'items'], [], 'referenced item shard');
    fail(value.kind === 'referenced-items' && value.key === 'all' && Array.isArray(value.items) && value.items.length === descriptor.records, 'referenced item shard mismatch');
    const refs = new Set();
    for (const raw of value.items) {
      const item = exactKeys(raw, ['item_ref', 'name', 'resolution_state', 'appearance_ref'], ['reason_codes'], 'referenced item');
      fail(typeof item.item_ref === 'string' && ITEM_REF.test(item.item_ref) && !refs.has(item.item_ref), 'referenced item_ref invalid');
      refs.add(item.item_ref); validateString(item.name, 'referenced item name'); fail(item.resolution_state === 'RESOLVED', 'referenced item state invalid');
    }
    return deepFreeze(value);
  }
  exactKeys(value, ['kind', 'key', 'profiles'], [], 'gameplay profile shard');
  fail(value.kind === descriptor.kind && value.key === descriptor.key, 'gameplay shard identity mismatch');
  fail(Array.isArray(value.profiles) && value.profiles.length === descriptor.records && value.profiles.length <= PRODUCER_LIMITS.max_profiles_per_shard, 'gameplay shard record count mismatch');
  const ids = new Set();
  for (const profile of value.profiles) {
    validateProfile(profile);
    const match = ENTITY_ID.exec(profile.entity_id);
    fail(match?.[1] === descriptor.kind && match?.[2].slice(0, 2) === descriptor.key, 'profile stored in wrong gameplay shard');
    fail(!ids.has(profile.entity_id), 'duplicate profile entity_id'); ids.add(profile.entity_id);
  }
  return deepFreeze(value);
}

export function createCreatureGameplayProfileService({
  baseUrl,
  trust = PRODUCTION_FULLWORLD_TRUST,
  fetchImpl = fetch,
  expectedSemanticDigest = GAMEPLAY_EXPECTATIONS.semanticDigest,
  maxCacheShards = GAMEPLAY_LIMITS.defaultCacheShards,
  maxCacheBytes = GAMEPLAY_LIMITS.maxCacheBytes,
} = {}) {
  fail(baseUrl != null, 'gameplay baseUrl required');
  fail(typeof fetchImpl === 'function', 'gameplay fetch implementation required');
  fail(Number.isSafeInteger(maxCacheShards) && maxCacheShards >= 1 && maxCacheShards <= GAMEPLAY_LIMITS.maxCacheShards, 'gameplay cache shard bound invalid');
  fail(Number.isSafeInteger(maxCacheBytes) && maxCacheBytes >= PRODUCER_LIMITS.max_shard_bytes, 'gameplay cache byte bound invalid');
  const sources = ancillarySourceExpectations(trust);
  // Revalidate all product roots before deriving availability from fixture trust.
  // Ancillary expectations alone validate only the roots used by those sources.
  if (sources.mode === 'qualification_fixture') {
    resolveQualificationManifestTrust({ ...trust, fixtureId: trust.qualificationFixtureId,
      dataCapability: sources.mode, productDigest: trust.qualificationProductDigest });
  } else if (sources.mode === 'bounded_real_world') {
    resolveBoundedRealManifestTrust({ ...trust, fixtureId: trust.boundedRealFixtureId,
      dataCapability: sources.mode, productDigest: trust.boundedRealProductDigest });
  }
  const root = new URL(baseUrl);
  const cache = new Map();
  let cacheBytes = 0;
  let manifestPromise = null;
  let itemRefsPromise = null;

  function remember(key, value, bytes) {
    if (cache.has(key)) {
      cacheBytes -= cache.get(key).bytes;
      cache.delete(key);
    }
    cache.set(key, { value, bytes }); cacheBytes += bytes;
    while (cache.size > maxCacheShards || cacheBytes > maxCacheBytes) {
      const oldest = cache.keys().next().value;
      const entry = cache.get(oldest); cache.delete(oldest); cacheBytes -= entry.bytes;
    }
  }

  async function manifest() {
    if (!manifestPromise) manifestPromise = (async () => {
      const value = await fetchCanonical(new URL('manifest.json', root), fetchImpl, PRODUCER_LIMITS.max_manifest_bytes, null, null, 'gameplay manifest');
      return validateCreatureGameplayManifest(value, { expectedSemanticDigest });
    })().catch((error) => { manifestPromise = null; throw error; });
    return manifestPromise;
  }

  async function loadDescriptor(descriptor) {
    const key = `${descriptor.kind}:${descriptor.key}`;
    if (cache.has(key)) {
      const entry = cache.get(key); cache.delete(key); cache.set(key, entry); return entry.value;
    }
    const value = await fetchCanonical(new URL(safeRelativePath(descriptor.path), root), fetchImpl, PRODUCER_LIMITS.max_shard_bytes, descriptor.bytes, descriptor.digest, `gameplay shard ${key}`);
    const validated = validateShard(value, descriptor);
    remember(key, validated, descriptor.bytes);
    return validated;
  }

  async function resolvedItemRefs(currentManifest) {
    if (currentManifest.counts.referenced_items === 0) return new Set();
    if (!itemRefsPromise) itemRefsPromise = (async () => {
      const descriptor = currentManifest.shards.find((entry) => entry.kind === 'referenced-items' && entry.key === 'all');
      fail(descriptor, 'referenced item shard missing');
      const shard = await loadDescriptor(descriptor);
      return new Set(shard.items.map((item) => item.item_ref));
    })().catch((error) => { itemRefsPromise = null; throw error; });
    return itemRefsPromise;
  }

  function profileItemRefs(profile) {
    if (profile.kind === 'npc') return [...profile.shop.sells, ...profile.shop.buys].map((row) => row.item_ref).filter(Boolean);
    return profile.loot.entries.map((row) => row.item_ref).filter(Boolean);
  }

  return Object.freeze({
    async get(entityId) {
      try {
        const match = typeof entityId === 'string' ? ENTITY_ID.exec(entityId) : null;
        if (!match) return Object.freeze({ status: 'unavailable', reason: 'invalid-entity-id' });
        if (sources.mode === 'qualification_fixture') return Object.freeze({ status: 'unavailable', reason: 'qualification-profile-intentionally-unavailable' });
        const currentManifest = await manifest();
        const kind = match[1]; const key = match[2].slice(0, 2);
        const descriptor = currentManifest.shards.find((entry) => entry.kind === kind && entry.key === key);
        if (!descriptor) return Object.freeze({ status: 'unavailable', reason: 'profile-not-published' });
        const shard = await loadDescriptor(descriptor);
        const profile = shard.profiles.find((entry) => entry.entity_id === entityId);
        if (!profile) return Object.freeze({ status: 'unavailable', reason: 'profile-not-published' });
        const refs = profileItemRefs(profile);
        if (refs.length) {
          const known = await resolvedItemRefs(currentManifest);
          fail(refs.every((ref) => known.has(ref)), 'profile item_ref missing from referenced item table');
        }
        return Object.freeze({ status: 'ready', profile, manifestDigest: currentManifest.semantic_digest });
      } catch (error) {
        return Object.freeze({ status: 'error', reason: String(error?.message ?? error) });
      }
    },
    stats() { return Object.freeze({ cacheShards: cache.size, cacheBytes }); },
  });
}