import {
  canonicalDigest,
  deepFreeze,
  exactSha,
  isPlainObject,
  safeRepositoryPath,
} from './anti-loop-common.mjs';

const ALLOWED_ENTRY_TYPES = Object.freeze(new Map([
  ['100644', 'blob'],
  ['100755', 'blob'],
  ['120000', 'blob'],
  ['160000', 'commit'],
]));

const CONTROL_PLANE_PREFIXES = Object.freeze([
  '.github/workflows/',
  'docs/',
  'tests/verification/',
  'tools/verification/',
]);

const CONTROL_PLANE_FILES = new Set([
  'AGENTS.md',
  'README.md',
]);

const KNOWN_BROWSER_SEMANTIC_PREFIXES = Object.freeze([
  'src/',
  'web/',
  'e2e/',
  'tools/animation-runtime/',
  'tools/dyn-atlas-semantic/',
  'tools/fullworld-generation/',
  'tools/fullworld-layers/',
  'tools/fullworld-minimap/',
  'tools/fullworld-publication/',
  'tools/fullworld-runtime/',
]);

const KNOWN_BROWSER_SEMANTIC_FILES = new Set([
  'tools/build-semantic-search-index.py',
]);

function isControlPlanePath(path) {
  return CONTROL_PLANE_FILES.has(path)
    || CONTROL_PLANE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isKnownBrowserSemanticPath(path) {
  return KNOWN_BROWSER_SEMANTIC_FILES.has(path)
    || KNOWN_BROWSER_SEMANTIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function normalizeEntry(value, label) {
  if (!isPlainObject(value) || !safeRepositoryPath(value.path, { allowDirectory: false })) {
    throw new TypeError(`${label} path is not a safe repository path`);
  }
  if (!ALLOWED_ENTRY_TYPES.has(value.mode)) {
    throw new TypeError(`${label} mode is invalid: ${value.mode}`);
  }
  const expectedType = ALLOWED_ENTRY_TYPES.get(value.mode);
  if (value.type !== expectedType) {
    throw new TypeError(`${label} type does not match mode ${value.mode}`);
  }
  return {
    path: value.path,
    mode: value.mode,
    type: value.type,
    objectId: exactSha(value.objectId, `${label} object identity`),
  };
}

function normalizeSourceEntries(values, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} entries must be an array`);
  const normalized = values.map((value, index) => normalizeEntry(value, `${label} entry ${index + 1}`));
  const paths = normalized.map(({ path }) => path);
  if (new Set(paths).size !== paths.length) throw new TypeError(`${label} entries contain duplicate paths`);
  return normalized.sort((left, right) => left.path.localeCompare(right.path));
}

function semanticProjection(entries) {
  return entries.filter(({ path }) => !isControlPlanePath(path));
}

export function buildBrowserSemanticContentIdentity(input) {
  if (!isPlainObject(input)) throw new TypeError('browser semantic content input is invalid');
  const protectedEntries = normalizeSourceEntries(input.protectedEntries ?? [], 'protected browser semantic content');
  const candidateEntries = normalizeSourceEntries(input.candidateEntries ?? [], 'candidate browser semantic content');
  const protectedSemanticEntries = semanticProjection(protectedEntries);
  const candidateSemanticEntries = semanticProjection(candidateEntries);
  const unknownPaths = [...new Set([
    ...protectedSemanticEntries,
    ...candidateSemanticEntries,
  ].map(({ path }) => path).filter((path) => !isKnownBrowserSemanticPath(path)))].sort();
  const core = {
    schemaVersion: 1,
    protectedEntries: protectedSemanticEntries,
    candidateEntries: candidateSemanticEntries,
  };
  return deepFreeze({
    schemaVersion: 1,
    browserSemanticContentDigest: canonicalDigest(core),
    unknownPaths,
  });
}
