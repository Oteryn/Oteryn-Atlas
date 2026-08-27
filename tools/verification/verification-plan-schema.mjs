const PROFILE_ORDER = Object.freeze(['none', 'focused', 'targeted', 'broad', 'full']);
const RESOURCE_CLASSES = new Set([
  'cpu-light', 'browser-targeted', 'browser-broad', 'browser-full',
  'render-geometry', 'native-gpu', 'performance', 'soak', 'artifact-build',
]);
const EVIDENCE_CLASSES = new Set(['machine-summary', 'restricted-visual-review']);
const SPECIALIST_REASONS = new Set(['private-visual', 'native-windows-gpu', 'lan-hardware', 'real-fullworld-product']);
const DATA_CAPABILITIES = new Set(['qualification_fixture', 'bounded_real_world', 'real_fullworld']);
const GROUP_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const SAFE_PATH = /^(?:tests|e2e)\/[A-Za-z0-9_./*-]+$/;

function invalid(kind, detail) {
  throw new TypeError(`${kind} invalid: ${detail}`);
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function uniqueStrings(values, kind, field) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || value.length === 0)) {
    invalid(kind, `${field} must be non-empty strings`);
  }
  if (new Set(values).size !== values.length) invalid(kind, `${field} contains duplicates`);
  return [...values];
}

function safeRepositoryPath(value) {
  return typeof value === 'string'
    && SAFE_PATH.test(value)
    && !value.includes('..')
    && !value.includes('\\')
    && !value.includes('//');
}

export function profileRank(profile) {
  const rank = PROFILE_ORDER.indexOf(profile);
  if (rank < 0) throw new TypeError(`unknown verification profile: ${profile}`);
  return rank;
}

export function validateVerificationCatalog(candidate) {
  const kind = 'verification catalog';
  if (!isPlainObject(candidate) || candidate.schemaVersion !== 2 || !isPlainObject(candidate.groups)) {
    invalid(kind, 'requires schemaVersion 2 and groups object');
  }
  const groups = {};
  for (const [id, value] of Object.entries(candidate.groups).sort(([left], [right]) => left.localeCompare(right))) {
    if (!GROUP_ID.test(id) || !isPlainObject(value)) invalid(kind, 'group id/value is invalid');
    const specs = uniqueStrings(value.specs, kind, `${id}.specs`);
    if (specs.some((spec) => !safeRepositoryPath(spec))) invalid(kind, `${id}.specs contains unsafe path`);
    const projects = uniqueStrings(value.projects ?? [], kind, `${id}.projects`);
    if (!RESOURCE_CLASSES.has(value.resourceClass)) invalid(kind, `${id}.resourceClass is not allowlisted`);
    if (!EVIDENCE_CLASSES.has(value.evidence)) invalid(kind, `${id}.evidence is not allowlisted`);
    if (!isPlainObject(value.capabilities)
      || typeof value.capabilities.browser !== 'boolean'
      || typeof value.capabilities.hosted !== 'boolean'
      || typeof value.capabilities.requiresPublication !== 'boolean'
      || !DATA_CAPABILITIES.has(value.capabilities.dataCapability)
      || typeof value.capabilities.visualReview !== 'boolean'
      || !(value.capabilities.specialistReason === null || SPECIALIST_REASONS.has(value.capabilities.specialistReason))) {
      invalid(kind, `${id}.capabilities is not explicit semantic metadata`);
    }
    if (value.capabilities.browser !== (projects.length > 0)) invalid(kind, `${id}.capabilities.browser conflicts with projects`);
    if (value.capabilities.specialistReason !== null && value.capabilities.hosted) invalid(kind, `${id}.capabilities cannot be hosted and specialist-only`);
    if (value.capabilities.dataCapability === 'real_fullworld'
      && (value.capabilities.hosted || value.capabilities.specialistReason === null)) {
      invalid(kind, `${id}.real_fullworld must be specialist-only`);
    }
    const stableTestIds = uniqueStrings(value.stableTestIds ?? [], kind, `${id}.stableTestIds`);
    const dependsOnGroups = uniqueStrings(value.dependsOnGroups ?? [], kind, `${id}.dependsOnGroups`);
    if (dependsOnGroups.includes(id)) invalid(kind, `${id}.dependsOnGroups cannot include itself`);
    groups[id] = {
      specs,
      projects,
      stableTestIds,
      resourceClass: value.resourceClass,
      evidence: value.evidence,
      sequential: Boolean(value.sequential),
      fullSafetyNet: Boolean(value.fullSafetyNet),
      dependsOnGroups,
      capabilities: { ...value.capabilities },
    };
  }
  if (Object.keys(groups).length === 0) invalid(kind, 'requires at least one group');
  for (const [id, group] of Object.entries(groups)) {
    if (group.dependsOnGroups.some((dependency) => !Object.hasOwn(groups, dependency))) {
      invalid(kind, `${id}.dependsOnGroups references unknown group`);
    }
  }
  return freeze({ schemaVersion: 2, groups });
}

function safePrefix(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.includes('//')
    && !value.split('/').includes('..')
    && !value.split('/').includes('.');
}

export function validateImpactManifest(candidate, catalogCandidate) {
  const kind = 'impact manifest';
  const catalog = validateVerificationCatalog(catalogCandidate);
  if (!isPlainObject(candidate) || candidate.schemaVersion !== 1 || !Array.isArray(candidate.entries)) {
    invalid(kind, 'requires schemaVersion 1 and entries array');
  }
  const prefixes = new Set();
  const entries = candidate.entries.map((entry) => {
    if (!isPlainObject(entry) || !safePrefix(entry.pathPrefix)) invalid(kind, 'entry pathPrefix is invalid');
    if (prefixes.has(entry.pathPrefix)) invalid(kind, 'contains duplicate pathPrefix');
    prefixes.add(entry.pathPrefix);
    if (!PROFILE_ORDER.includes(entry.minimumProfile)) invalid(kind, 'entry minimumProfile is invalid');
    const domains = uniqueStrings(entry.domains, kind, 'entry domains');
    if (domains.some((domain) => !GROUP_ID.test(domain))) invalid(kind, 'entry domains are invalid');
    const requiredGroups = uniqueStrings(entry.requiredGroups ?? [], kind, 'entry requiredGroups');
    if (requiredGroups.some((group) => !Object.hasOwn(catalog.groups, group))) invalid(kind, 'entry references unknown group');
    return {
      pathPrefix: entry.pathPrefix,
      domains,
      minimumProfile: entry.minimumProfile,
      requiredGroups,
    };
  });
  return freeze({ schemaVersion: 1, entries });
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
