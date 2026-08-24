const MAX_CATALOG_BYTES = 8 * 1024 * 1024;
const MAX_PERFORMANCE_BYTES = 16 * 1024 * 1024;
const MAX_HUNTS = 10000;
const MAX_OBSERVATIONS = 100000;
const MAX_REFS = 4096;
const MAX_STRING = 512;
const SHA_RE = /^[0-9a-f]{40}$/;
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export const TRUST_CLASSES = Object.freeze(['VERIFIED', 'MEASURED', 'ESTIMATE', 'UNKNOWN']);
export const AVAILABILITY_STATES = Object.freeze(['AVAILABLE', 'UPSTREAM_BLOCKED', 'INSUFFICIENT', 'SUPPRESSED', 'INCOMPATIBLE', 'MALFORMED', 'STALE']);
export const MEASUREMENT_SCOPES = Object.freeze(['PLAYER', 'PARTY', 'HUNT_AREA']);

const TRUST = new Set(TRUST_CLASSES);
const AVAILABILITY = new Set(AVAILABILITY_STATES);
const SCOPES = new Set(MEASUREMENT_SCOPES);
const COMPLETENESS = new Set(['PROVEN_COMPLETE_FOR_DECLARED_DURABLE_SCOPE', 'NO_KNOWN_GAP_BEST_EFFORT', 'PARTIAL', 'UNKNOWN']);
const QUALITY = new Set(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']);
const PRIVACY = new Set(['PUBLISHABLE', 'SUPPRESSED']);
const FRESHNESS = new Set(['CURRENT', 'STALE']);
const CATALOG_FIELDS = new Set(['schema_version', 'capability', 'source', 'scope', 'hunts']);
const SOURCE_FIELDS = new Set(['authority', 'game_revision', 'contract_id', 'publication_digest']);
const CATALOG_SCOPE_FIELDS = new Set(['world_id', 'world_profile_revision', 'content_revision']);
const PERFORMANCE_SCOPE_FIELDS = new Set(['world_id', 'world_profile_revision', 'content_revision', 'ruleset_revision']);
const HUNT_FIELDS = new Set(['hunt_id', 'name', 'area_refs', 'subarea_refs', 'encounter_zone_refs', 'floor_geometry_refs', 'entrance_refs', 'spawn_group_refs', 'creature_refs', 'requirement_refs', 'route_refs']);
const PERFORMANCE_FIELDS = new Set(['schema_version', 'capability', 'source', 'scope', 'hunt_attribution_policy_revision', 'quality_policy_revision', 'privacy_policy_revision', 'observations']);
const OBSERVATION_FIELDS = new Set(['observation_id', 'hunt_id', 'cohort_signature', 'measurement_scope', 'metric_id', 'metric_revision', 'time_base', 'modifier_bucket', 'window', 'sample', 'completeness_state', 'quality_state', 'privacy_state', 'freshness_state', 'availability_state', 'trust_class', 'value', 'valuation']);
const WINDOW_FIELDS = new Set(['from', 'through']);
const SAMPLE_FIELDS = new Set(['sessions', 'segments', 'player_hours', 'team_hours']);
const VALUE_FIELDS = new Set(['unit', 'median', 'p25', 'p75']);
const VALUATION_FIELDS = new Set(['type', 'world_id', 'policy_revision', 'price_as_of', 'price_quality_state']);

export class HuntIntelligenceError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new HuntIntelligenceError(message);
}

function requireObject(value, label) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function requireExactKeys(value, allowed, label) {
  requireObject(value, label);
  for (const key of Object.keys(value)) requireValue(allowed.has(key), `${label} unknown field: ${key}`);
}

function requireString(value, label, max = MAX_STRING) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value), `${label} invalid`);
}

function requireIdentity(value, label) {
  requireString(value, label, 256);
  requireValue(!/[\\/]/.test(value), `${label} must not be a repository/path identity`);
}

function requireRevision(value, label) {
  requireString(value, label, 256);
}

function serializedBytes(value) {
  let encoded;
  try { encoded = new TextEncoder().encode(JSON.stringify(value)); } catch { throw new HuntIntelligenceError('publication is not serializable'); }
  return encoded.byteLength;
}

function validateSource(source, capability, expectations) {
  requireExactKeys(source, SOURCE_FIELDS, `${capability} source`);
  requireValue(source.authority === 'Oteryn/Oteryn-Game', `${capability} source authority invalid`);
  requireValue(SHA_RE.test(source.game_revision ?? ''), `${capability} Game revision invalid`);
  requireString(source.contract_id, `${capability} contract id`, 256);
  requireValue(DIGEST_RE.test(source.publication_digest ?? ''), `${capability} publication digest invalid`);
  requireValue(typeof expectations?.acceptedContractId === 'string' && expectations.acceptedContractId.length > 0, `${capability} requires an explicitly accepted upstream contract`);
  requireValue(typeof expectations?.acceptedGameRevision === 'string' && SHA_RE.test(expectations.acceptedGameRevision), `${capability} requires an explicitly accepted Game revision`);
  requireValue(source.contract_id === expectations.acceptedContractId, `${capability} upstream contract is not accepted`);
  requireValue(source.game_revision === expectations.acceptedGameRevision, `${capability} Game revision is not accepted`);
  requireValue(typeof expectations?.verifiedPublicationDigest === 'string' && DIGEST_RE.test(expectations.verifiedPublicationDigest), `${capability} requires an independently verified publication digest`);
  requireValue(source.publication_digest === expectations.verifiedPublicationDigest, `${capability} publication digest mismatch`);
}

function validateScope(scope, fields, label) {
  requireExactKeys(scope, fields, `${label} scope`);
  for (const key of fields) requireRevision(scope[key], `${label} scope ${key}`);
}

function validateRefs(value, label, { required = false } = {}) {
  requireValue(Array.isArray(value) && value.length <= MAX_REFS, `${label} invalid or exceeds ${MAX_REFS}`);
  if (required) requireValue(value.length > 0, `${label} must not be empty`);
  const seen = new Set();
  for (const ref of value) {
    requireIdentity(ref, `${label} reference`);
    requireValue(!seen.has(ref), `${label} duplicate reference`);
    seen.add(ref);
  }
}

export function validateHuntCatalogPublication(publication, expectations = {}) {
  requireExactKeys(publication, CATALOG_FIELDS, 'hunt catalog');
  requireValue(publication.schema_version === 1, 'hunt catalog schema unsupported');
  requireValue(publication.capability === 'hunt-catalog-v1', 'hunt catalog capability unsupported');
  const maxBytes = Math.min(Number(expectations.maxBytes ?? MAX_CATALOG_BYTES), MAX_CATALOG_BYTES);
  requireValue(Number.isSafeInteger(maxBytes) && maxBytes > 0 && serializedBytes(publication) <= maxBytes, 'hunt catalog byte limit exceeded');
  validateSource(publication.source, publication.capability, expectations);
  validateScope(publication.scope, CATALOG_SCOPE_FIELDS, 'hunt catalog');
  requireValue(Array.isArray(publication.hunts) && publication.hunts.length <= MAX_HUNTS, 'hunt catalog record count invalid');
  const seen = new Set();
  for (const hunt of publication.hunts) {
    requireExactKeys(hunt, HUNT_FIELDS, 'hunt record');
    requireIdentity(hunt.hunt_id, 'hunt_id');
    requireValue(!seen.has(hunt.hunt_id), 'duplicate Hunt ID');
    seen.add(hunt.hunt_id);
    requireString(hunt.name, 'hunt name', 256);
    validateRefs(hunt.area_refs, 'area_refs', { required: true });
    validateRefs(hunt.subarea_refs, 'subarea_refs');
    validateRefs(hunt.encounter_zone_refs, 'encounter_zone_refs');
    validateRefs(hunt.floor_geometry_refs, 'floor_geometry_refs', { required: true });
    validateRefs(hunt.entrance_refs, 'entrance_refs', { required: true });
    validateRefs(hunt.spawn_group_refs, 'spawn_group_refs');
    validateRefs(hunt.creature_refs, 'creature_refs');
    validateRefs(hunt.requirement_refs, 'requirement_refs');
    validateRefs(hunt.route_refs, 'route_refs');
  }
  return publication;
}

function requireNonNegativeNumber(value, label) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0, `${label} invalid`);
}

function validateWindow(window, label) {
  requireExactKeys(window, WINDOW_FIELDS, `${label} window`);
  requireValue(ISO_UTC_RE.test(window.from ?? '') && ISO_UTC_RE.test(window.through ?? ''), `${label} window invalid`);
  requireValue(Date.parse(window.from) < Date.parse(window.through), `${label} window must be increasing`);
}

function validateSample(sample, label) {
  requireExactKeys(sample, SAMPLE_FIELDS, `${label} sample`);
  requireValue(Number.isSafeInteger(sample.sessions) && sample.sessions >= 0, `${label} sessions invalid`);
  requireValue(Number.isSafeInteger(sample.segments) && sample.segments >= 0, `${label} segments invalid`);
  requireNonNegativeNumber(sample.player_hours, `${label} player_hours`);
  requireNonNegativeNumber(sample.team_hours, `${label} team_hours`);
}

function validateValue(value, label) {
  requireExactKeys(value, VALUE_FIELDS, `${label} value`);
  requireString(value.unit, `${label} unit`, 64);
  for (const key of ['median', 'p25', 'p75']) requireValue(typeof value[key] === 'number' && Number.isFinite(value[key]), `${label} ${key} invalid`);
  requireValue(value.p25 <= value.median && value.median <= value.p75, `${label} distribution ordering invalid`);
}

function validateValuation(valuation, scopeWorld, label) {
  requireExactKeys(valuation, VALUATION_FIELDS, `${label} valuation`);
  requireValue(['NPC', 'MARKET', 'MIXED'].includes(valuation.type), `${label} valuation type invalid`);
  requireRevision(valuation.world_id, `${label} valuation world_id`);
  requireValue(valuation.world_id === scopeWorld, `${label} valuation world mismatch`);
  requireRevision(valuation.policy_revision, `${label} valuation policy revision`);
  requireValue(ISO_UTC_RE.test(valuation.price_as_of ?? ''), `${label} valuation price_as_of invalid`);
  requireString(valuation.price_quality_state, `${label} valuation price quality`, 64);
}

export function validateHuntPerformancePublication(publication, expectations = {}) {
  requireExactKeys(publication, PERFORMANCE_FIELDS, 'hunt performance');
  requireValue(publication.schema_version === 1, 'hunt performance schema unsupported');
  requireValue(publication.capability === 'hunt-performance-v1', 'hunt performance capability unsupported');
  const maxBytes = Math.min(Number(expectations.maxBytes ?? MAX_PERFORMANCE_BYTES), MAX_PERFORMANCE_BYTES);
  requireValue(Number.isSafeInteger(maxBytes) && maxBytes > 0 && serializedBytes(publication) <= maxBytes, 'hunt performance byte limit exceeded');
  validateSource(publication.source, publication.capability, expectations);
  validateScope(publication.scope, PERFORMANCE_SCOPE_FIELDS, 'hunt performance');
  requireRevision(publication.hunt_attribution_policy_revision, 'hunt attribution policy revision');
  requireRevision(publication.quality_policy_revision, 'quality policy revision');
  requireRevision(publication.privacy_policy_revision, 'privacy policy revision');
  requireValue(Array.isArray(publication.observations) && publication.observations.length <= MAX_OBSERVATIONS, 'hunt performance observation count invalid');
  const seen = new Set();
  for (const observation of publication.observations) {
    requireExactKeys(observation, OBSERVATION_FIELDS, 'hunt performance observation');
    requireIdentity(observation.observation_id, 'observation_id');
    requireValue(!seen.has(observation.observation_id), 'duplicate performance observation ID');
    seen.add(observation.observation_id);
    requireIdentity(observation.hunt_id, 'performance hunt_id');
    requireIdentity(observation.cohort_signature, 'cohort_signature');
    requireValue(SCOPES.has(observation.measurement_scope), 'measurement scope invalid');
    requireIdentity(observation.metric_id, 'metric_id');
    const expectedPrefix = `${observation.measurement_scope.toLowerCase()}.`;
    requireValue(observation.metric_id.startsWith(expectedPrefix), 'metric namespace does not match measurement scope');
    requireValue(Number.isSafeInteger(observation.metric_revision) && observation.metric_revision > 0, 'metric revision invalid');
    requireIdentity(observation.time_base, 'time_base');
    requireIdentity(observation.modifier_bucket, 'modifier_bucket');
    validateWindow(observation.window, observation.observation_id);
    validateSample(observation.sample, observation.observation_id);
    requireValue(COMPLETENESS.has(observation.completeness_state), 'completeness state invalid');
    requireValue(QUALITY.has(observation.quality_state), 'quality state invalid');
    requireValue(PRIVACY.has(observation.privacy_state), 'privacy state invalid');
    requireValue(FRESHNESS.has(observation.freshness_state), 'freshness state invalid');
    requireValue(AVAILABILITY.has(observation.availability_state), 'availability state invalid');
    requireValue(TRUST.has(observation.trust_class) && observation.trust_class === 'MEASURED', 'performance trust class must be MEASURED');
    if (observation.quality_state === 'HIGH') requireValue(!['UNKNOWN', 'PARTIAL'].includes(observation.completeness_state), 'HIGH quality requires known sufficient telemetry completeness');
    if (observation.availability_state === 'AVAILABLE') validateValue(observation.value, observation.observation_id);
    else requireValue(observation.value == null, 'unavailable observation must not carry a numeric value');
    const valueMetric = /(?:^|[._])(profit|value)(?:[._]|$)/.test(observation.metric_id);
    if (valueMetric && observation.availability_state === 'AVAILABLE') requireValue(observation.valuation != null, 'profit/value metric requires explicit valuation identity');
    if (observation.valuation != null) validateValuation(observation.valuation, publication.scope.world_id, observation.observation_id);
  }
  return publication;
}

function normalizeCapabilityState(value, label) {
  requireObject(value, label);
  requireValue(AVAILABILITY.has(value.state), `${label} state invalid`);
  requireString(value.reason, `${label} reason`, 512);
  return Object.freeze({ state: value.state, reason: value.reason, evidence: Object.freeze(Array.isArray(value.evidence) ? [...value.evidence] : []) });
}

function dependentState(dependencies, reason) {
  const blocked = dependencies.find((entry) => entry.state !== 'AVAILABLE');
  if (!blocked) return Object.freeze({ state: 'AVAILABLE', reason });
  return Object.freeze({ state: blocked.state, reason: blocked.reason });
}

export function buildHuntReadiness({ gameRevision, catalog, performance }) {
  requireValue(SHA_RE.test(gameRevision ?? ''), 'readiness Game revision invalid');
  const catalogState = normalizeCapabilityState(catalog, 'catalog');
  const performanceState = normalizeCapabilityState(performance, 'performance');
  const verifiedHuntNavigation = dependentState([catalogState], 'Accepted Hunt Catalog is available.');
  const measuredPanels = dependentState([performanceState], 'Accepted Hunt Performance aggregates are available.');
  const recommender = dependentState([catalogState, performanceState], 'Accepted Hunt Catalog and Hunt Performance evidence are available.');
  return Object.freeze({
    schema_version: 1,
    game_revision: gameRevision,
    catalog: catalogState,
    performance: performanceState,
    verifiedHuntNavigation,
    measuredPanels,
    recommender,
  });
}

function publicState(entry, label) {
  return Object.freeze({
    state: entry.state,
    trust_class: entry.state === 'AVAILABLE' ? label : 'UNKNOWN',
    message: entry.state === 'AVAILABLE' ? 'Available from accepted upstream evidence.' : 'Unavailable because required accepted upstream evidence is not usable.',
  });
}

export function projectHuntReadinessForBrowser(readiness) {
  requireObject(readiness, 'readiness');
  return Object.freeze({
    schema_version: 1,
    catalog: publicState(readiness.catalog, 'VERIFIED'),
    performance: publicState(readiness.performance, 'MEASURED'),
    verifiedHuntNavigation: publicState(readiness.verifiedHuntNavigation, 'VERIFIED'),
    measuredPanels: publicState(readiness.measuredPanels, 'MEASURED'),
    recommender: publicState(readiness.recommender, 'ESTIMATE'),
  });
}

export function evaluateHuntRecommendation({ readiness, objective, profile }) {
  requireObject(readiness, 'readiness');
  requireString(objective, 'recommendation objective', 64);
  requireObject(profile, 'recommendation profile');
  if (readiness.recommender?.state !== 'AVAILABLE') return Object.freeze({ state: readiness.recommender?.state ?? 'INCOMPATIBLE', trust_class: 'UNKNOWN', objective, candidates: Object.freeze([]) });
  return Object.freeze({ state: 'INSUFFICIENT', trust_class: 'UNKNOWN', objective, candidates: Object.freeze([]) });
}
