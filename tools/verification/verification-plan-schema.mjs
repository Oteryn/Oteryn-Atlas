const PROFILE_ORDER = Object.freeze(['none', 'focused', 'targeted', 'broad', 'full']);
const RESOURCE_CLASSES = new Set([
  'cpu-light', 'browser-targeted', 'browser-broad', 'browser-full',
  'render-geometry', 'native-gpu', 'performance', 'soak', 'artifact-build',
]);
const EVIDENCE_CLASSES = new Set(['machine-summary', 'restricted-visual-review']);
const CAPABILITIES = new Set([
  'deterministic', 'browser-functional', 'restricted-visual', 'native-windows',
  'native-gpu', 'lan-smoke', 'hardware-repro', 'specialist-benchmark',
  'performance', 'soak', 'artifact-build',
]);
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

function validateDependencyGraph(groups, kind) {
  for (const [id, group] of Object.entries(groups)) {
    for (const dependency of group.dependsOn) {
      if (!GROUP_ID.test(dependency) || !Object.hasOwn(groups, dependency)) {
        invalid(kind, `${id}.dependsOn references unknown group ${dependency}`);
      }
      if (dependency === id) invalid(kind, `${id}.dependsOn cannot reference itself`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) invalid(kind, `dependency cycle includes ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of groups[id].dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of Object.keys(groups)) visit(id);
}

export function validateVerificationCatalog(candidate) {
  const kind = 'verification catalog';
  if (!isPlainObject(candidate) || candidate.schemaVersion !== 1 || !isPlainObject(candidate.groups)) {
    invalid(kind, 'requires schemaVersion 1 and groups object');
  }
  const groups = {};
  for (const [id, value] of Object.entries(candidate.groups).sort(([left], [right]) => left.localeCompare(right))) {
    if (!GROUP_ID.test(id) || !isPlainObject(value)) invalid(kind, 'group id/value is invalid');
    const specs = uniqueStrings(value.specs, kind, `${id}.specs`);
    if (specs.some((spec) => !safeRepositoryPath(spec))) invalid(kind, `${id}.specs contains unsafe path`);
    const projects = uniqueStrings(value.projects ?? [], kind, `${id}.projects`);
    if (!RESOURCE_CLASSES.has(value.resourceClass)) invalid(kind, `${id}.resourceClass is not allowlisted`);
    if (!EVIDENCE_CLASSES.has(value.evidence)) invalid(kind, `${id}.evidence is not allowlisted`);
    const capabilities = uniqueStrings(value.capabilities ?? [], kind, `${id}.capabilities`);
    if (capabilities.some((capability) => !CAPABILITIES.has(capability))) {
      invalid(kind, `${id}.capabilities contains unknown semantic capability`);
    }
    const stableTestIds = uniqueStrings(value.stableTestIds ?? [], kind, `${id}.stableTestIds`);
    const dependsOn = uniqueStrings(value.dependsOn ?? [], kind, `${id}.dependsOn`);
    groups[id] = {
      specs,
      projects,
      capabilities,
      stableTestIds,
      dependsOn,
      resourceClass: value.resourceClass,
      evidence: value.evidence,
      sequential: Boolean(value.sequential),
      fullSafetyNet: Boolean(value.fullSafetyNet),
    };
  }
  if (Object.keys(groups).length === 0) invalid(kind, 'requires at least one group');
  validateDependencyGraph(groups, kind);
  return freeze({ schemaVersion: 1, groups });
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

function validateDependencyRules(candidate, catalog, kind) {
  if (!Array.isArray(candidate)) invalid(kind, 'dependencyRules must be an array');
  return candidate.map((rule, index) => {
    const field = `dependencyRules[${index}]`;
    if (!isPlainObject(rule)) invalid(kind, `${field} must be an object`);
    const whenAllDomains = uniqueStrings(rule.whenAllDomains, kind, `${field}.whenAllDomains`);
    if (whenAllDomains.length === 0 || whenAllDomains.some((domain) => !GROUP_ID.test(domain))) {
      invalid(kind, `${field}.whenAllDomains are invalid`);
    }
    const addDomains = uniqueStrings(rule.addDomains ?? [], kind, `${field}.addDomains`);
    if (addDomains.some((domain) => !GROUP_ID.test(domain))) invalid(kind, `${field}.addDomains are invalid`);
    if (!PROFILE_ORDER.includes(rule.minimumProfile)) invalid(kind, `${field}.minimumProfile is invalid`);
    const requiredGroups = uniqueStrings(rule.requiredGroups ?? [], kind, `${field}.requiredGroups`);
    if (requiredGroups.some((group) => !Object.hasOwn(catalog.groups, group))) {
      invalid(kind, `${field} references unknown group`);
    }
    if (addDomains.length === 0 && requiredGroups.length === 0 && rule.minimumProfile === 'none') {
      invalid(kind, `${field} must widen domains, groups or profile`);
    }
    return { whenAllDomains, addDomains, minimumProfile: rule.minimumProfile, requiredGroups };
  });
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
  const dependencyRules = validateDependencyRules(candidate.dependencyRules ?? [], catalog, kind);
  return freeze({ schemaVersion: 1, entries, dependencyRules });
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
