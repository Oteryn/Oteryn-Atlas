const SHA256 = /^sha256:[a-f0-9]{64}$/;
const QUALIFICATION_MARKER = 'oteryn-atlas-qualification-trust-v1';
const QUALIFICATION_FIXTURE_ID = 'atlas-qualification-world-v2';
const BOUNDED_MARKER = 'oteryn-atlas-bounded-real-trust-v1';
const BOUNDED_FIXTURE_ID = 'atlas-bounded-real-world-v1';
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
  if (!Array.isArray(index.records)) throw new TypeError('qualification semantic records are missing');
  const navigable = index.records.filter((record) => {
    const position = record?.position;
    return Array.isArray(record?.capabilities)
      && record.capabilities.includes('navigation')
      && Number.isSafeInteger(position?.x)
      && Number.isSafeInteger(position?.y)
      && Number.isSafeInteger(position?.floor);
  });
  if (navigable.length !== 1) throw new TypeError(`qualification semantic index must contain exactly one navigable record, observed ${navigable.length}`);
  return navigable[0];
}

const SHARED_HISTORICAL_DEFAULT = Object.freeze({ x: '32369', y: '32241', floor: '-7' });
const CANONICAL_FULLWORLD_PATH = '/web/fullworld.html';
const CANONICAL_ATLAS_ORIGINS = Object.freeze([
  'http://atlas-web:8080',
  'https://atlas-web:8080',
]);

function hasCanonicalRawFullWorldPath(entry, prefix) {
  if (!entry.startsWith(prefix)) return false;
  const suffix = entry.slice(prefix.length);
  return suffix === '' || suffix.startsWith('?') || suffix.startsWith('#');
}

function isCanonicalHistoricalEntryForm(entry) {
  if (typeof entry !== 'string' || entry.length === 0) return false;
  if (hasCanonicalRawFullWorldPath(entry, CANONICAL_FULLWORLD_PATH)) return true;
  return CANONICAL_ATLAS_ORIGINS.some((origin) => hasCanonicalRawFullWorldPath(entry, `${origin}${CANONICAL_FULLWORLD_PATH}`));
}

function serializeEntry(url, isRelative) {
  return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.href;
}

function encodeLiteralQueryCommas(entry) {
  const queryStart = entry.indexOf('?');
  if (queryStart === -1) return entry;
  const hashStart = entry.indexOf('#', queryStart + 1);
  const queryEnd = hashStart === -1 ? entry.length : hashStart;
  return `${entry.slice(0, queryStart + 1)}${entry.slice(queryStart + 1, queryEnd).replaceAll(',', '%2C')}${entry.slice(queryEnd)}`;
}

function isCanonicalSerializedHistoricalDefault(entry, url) {
  const canonical = new URL(url.href);
  for (const [field, value] of Object.entries(SHARED_HISTORICAL_DEFAULT)) {
    canonical.searchParams.set(field, value);
  }
  return encodeLiteralQueryCommas(entry) === serializeEntry(canonical, entry.startsWith(CANONICAL_FULLWORLD_PATH));
}

function isSharedHistoricalDefault(entry) {
  if (!isCanonicalHistoricalEntryForm(entry)) return false;
  let url;
  try {
    url = new URL(entry, 'http://atlas.invalid');
  } catch {
    return false;
  }
  if (url.pathname !== '/web/fullworld.html') return false;
  if (!isCanonicalSerializedHistoricalDefault(entry, url)) return false;
  return Object.entries(SHARED_HISTORICAL_DEFAULT).every(([field, value]) => {
    const values = url.searchParams.getAll(field);
    return values.length === 1 && values[0] === value;
  });
}

function rewriteEntry(entry, position) {
  if (typeof entry !== 'string' || entry.length === 0) throw new TypeError('Atlas entry must be a non-empty string');
  const isRelative = entry.startsWith('/');
  const url = new URL(entry, 'http://atlas.invalid');
  if (url.pathname !== '/web/fullworld.html') throw new TypeError(`qualification navigation target is not Atlas FullWorld: ${url.pathname}`);
  url.searchParams.set('x', String(position.x));
  url.searchParams.set('y', String(position.y));
  url.searchParams.set('floor', String(position.floor));
  return serializeEntry(url, isRelative);
}

export async function resolveQualificationEntry(entry, { qualificationTrustJson, readSemanticIndex }) {
  const trustState = parseTrust(qualificationTrustJson);
  if (!trustState || trustState.mode === 'bounded') return entry;
  if (!isSharedHistoricalDefault(entry)) return entry;
  if (typeof readSemanticIndex !== 'function') throw new TypeError('qualification semantic reader is required');
  const semanticIndex = await readSemanticIndex();
  const record = validateSemanticIndex(semanticIndex, trustState.descriptor);
  return rewriteEntry(entry, record.position);
}
