const SHA256 = /^sha256:[a-f0-9]{64}$/;
const QUALIFICATION_MARKER = 'oteryn-atlas-qualification-trust-v1';
const QUALIFICATION_FIXTURE_ID = 'atlas-qualification-world-v2';
const BOUNDED_MARKER = 'oteryn-atlas-bounded-real-trust-v1';
const BOUNDED_FIXTURE_ID = 'atlas-bounded-real-world-v1';
const LEGACY_DEFAULT = Object.freeze({ x: '32369', y: '32241', floor: '-7' });
const QUALIFICATION_DEFAULT_NAVIGATION = Object.freeze({
  contract_id: 'oteryn-atlas-qualification-default-navigation-v1',
  record_id: 'semantic-record:qualification-harbor',
});
const CANONICAL_RELATIVE_FULLWORLD = /^\/web\/fullworld\.html(?:\?[^#%\s]*)?(?:#[^%\s]*)?$/;
const CANONICAL_ABSOLUTE_FULLWORLD = /^http:\/\/atlas-web:8080\/web\/fullworld\.html(?:\?[^#%\s]*)?(?:#[^%\s]*)?$/;
const ROOT_FIELDS = Object.freeze([
  'publicationRoot', 'semanticRoot', 'pixelRoot', 'overviewRoot', 'minimapRoot',
  'runtimeIndexRoot', 'pixelBucketRoot', 'sourceFingerprint', 'productDigest',
]);
const EXACT_FIELDS = Object.freeze(['marker', 'fixtureId', 'dataCapability', ...ROOT_FIELDS].sort());

function parseTrust(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  let descriptor;
  try {
    descriptor = JSON.parse(raw);
  } catch (error) {
    throw new TypeError(`ATLAS_QUALIFICATION_TRUST_JSON is invalid JSON: ${error.message}`);
  }
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new TypeError('ATLAS_QUALIFICATION_TRUST_JSON must encode an object');
  }
  const fields = Object.keys(descriptor).sort();
  if (JSON.stringify(fields) !== JSON.stringify(EXACT_FIELDS)) {
    throw new TypeError('qualification trust descriptor fields mismatch');
  }
  for (const field of ROOT_FIELDS) {
    if (!SHA256.test(descriptor[field] ?? '')) throw new TypeError(`qualification trust ${field} is invalid`);
  }
  if (descriptor.marker === BOUNDED_MARKER && descriptor.fixtureId === BOUNDED_FIXTURE_ID && descriptor.dataCapability === 'bounded_real_world') {
    return Object.freeze({ mode: 'bounded', descriptor: Object.freeze({ ...descriptor }) });
  }
  if (descriptor.marker !== QUALIFICATION_MARKER || descriptor.fixtureId !== QUALIFICATION_FIXTURE_ID || descriptor.dataCapability !== 'qualification_fixture') {
    throw new TypeError('qualification trust identity mismatch');
  }
  return Object.freeze({ mode: 'qualification', descriptor: Object.freeze({ ...descriptor }) });
}

function validateSemanticIndex(index, trust) {
  if (!index || typeof index !== 'object' || Array.isArray(index)) throw new TypeError('qualification semantic index is invalid');
  if (!index.source || typeof index.source !== 'object' || Array.isArray(index.source)) throw new TypeError('qualification semantic source is missing');
  if (index.source.fixture_id !== trust.fixtureId) throw new TypeError('qualification semantic fixture identity mismatch');
  if (index.source.semantic_digest !== trust.semanticRoot) throw new TypeError('qualification semantic root mismatch');
  if (index.source.contract_id !== 'oteryn-atlas-qualification-fixture-v1' || index.source.capability !== 'qualification-semantic-search-v1') {
    throw new TypeError('qualification semantic source contract mismatch');
  }
  const navigation = index.source.default_navigation;
  if (!navigation || typeof navigation !== 'object' || Array.isArray(navigation)
    || navigation.contract_id !== QUALIFICATION_DEFAULT_NAVIGATION.contract_id
    || navigation.record_id !== QUALIFICATION_DEFAULT_NAVIGATION.record_id) {
    throw new TypeError('qualification semantic default navigation identity mismatch');
  }
  if (!Array.isArray(index.records)) throw new TypeError('qualification semantic records are missing');
  const defaults = index.records.filter((record) => record?.id === navigation.record_id);
  if (defaults.length !== 1) {
    throw new TypeError(`qualification semantic index must contain exactly one default navigation record, observed ${defaults.length}`);
  }
  const record = defaults[0];
  const position = record?.position;
  if (!Array.isArray(record?.capabilities) || !record.capabilities.includes('navigation')
    || !Number.isSafeInteger(position?.x) || !Number.isSafeInteger(position?.y) || !Number.isSafeInteger(position?.floor)) {
    throw new TypeError('qualification semantic default navigation record is not navigable');
  }
  return record;
}

function rewriteEntry(entry, position) {
  if (typeof entry !== 'string' || entry.length === 0) throw new TypeError('Atlas entry must be a non-empty string');
  const isRelative = entry.startsWith('/');
  const url = new URL(entry, 'http://atlas.invalid');
  if (url.pathname !== '/web/fullworld.html') throw new TypeError(`qualification navigation target is not Atlas FullWorld: ${url.pathname}`);
  url.searchParams.set('x', String(position.x));
  url.searchParams.set('y', String(position.y));
  url.searchParams.set('floor', String(position.floor));
  return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

function canonicalFullWorldUrl(entry) {
  if (typeof entry !== 'string') throw new TypeError('Atlas entry must be a string');
  const relative = CANONICAL_RELATIVE_FULLWORLD.test(entry);
  const absolute = CANONICAL_ABSOLUTE_FULLWORLD.test(entry);
  if (!relative && !absolute) return null;
  try {
    const url = new URL(entry, relative ? 'http://atlas.invalid' : undefined);
    if (url.pathname !== '/web/fullworld.html') return null;
    if (absolute && (url.protocol !== 'http:' || url.host !== 'atlas-web:8080' || url.username || url.password || url.href !== entry)) return null;
    const serialized = new URL(url.href);
    for (const field of Object.keys(LEGACY_DEFAULT)) {
      serialized.searchParams.set(field, url.searchParams.get(field) ?? '');
    }
    const canonical = relative ? `${serialized.pathname}${serialized.search}${serialized.hash}` : serialized.href;
    if (canonical !== entry) return null;
    return url;
  } catch {
    return null;
  }
}

function isUnambiguousLegacyDefaultEntry(entry) {
  const url = canonicalFullWorldUrl(entry);
  if (!url) return false;
  for (const [field, value] of Object.entries(LEGACY_DEFAULT)) {
    const values = url.searchParams.getAll(field);
    if (values.length !== 1 || values[0] !== value) return false;
  }
  return true;
}

export async function resolveQualificationEntry(entry, { qualificationTrustJson, readSemanticIndex }) {
  const trustState = parseTrust(qualificationTrustJson);
  if (!trustState || trustState.mode === 'bounded') return entry;
  if (!isUnambiguousLegacyDefaultEntry(entry)) return entry;
  if (typeof readSemanticIndex !== 'function') throw new TypeError('qualification semantic reader is required');
  const semanticIndex = await readSemanticIndex();
  const record = validateSemanticIndex(semanticIndex, trustState.descriptor);
  return rewriteEntry(entry, record.position);
}
