const STABLE_ID_SEPARATOR = '::';
const TITLE_SEPARATOR = ' › ';

function canonicalString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192 || value.includes('\u0000')) {
    throw new TypeError(`${label} must be a non-empty bounded string`);
  }
  return value.normalize('NFC');
}

export function normalizeStableSpecPath(value) {
  const normalized = canonicalString(value, 'stable spec path').replaceAll('\\', '/');
  const marker = normalized.indexOf('e2e/tests/');
  const path = marker >= 0 ? normalized.slice(marker) : normalized.replace(/^\.\//, '');
  if (!path.startsWith('e2e/tests/') || path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    throw new TypeError('stable spec path must identify an e2e/tests path');
  }
  return path;
}

export function normalizeStableTitlePath(value) {
  const title = Array.isArray(value) ? value.map((part) => canonicalString(part, 'stable title component')).join(TITLE_SEPARATOR) : canonicalString(value, 'stable title');
  if (title.length > 8192) throw new TypeError('stable title is too long');
  return title;
}

export function stableTestId(project, specPath, titlePath) {
  const normalizedProject = canonicalString(project, 'stable project');
  if (normalizedProject.includes(STABLE_ID_SEPARATOR)) throw new TypeError('stable project cannot contain separator');
  return `${normalizedProject}${STABLE_ID_SEPARATOR}${normalizeStableSpecPath(specPath)}${STABLE_ID_SEPARATOR}${normalizeStableTitlePath(titlePath)}`;
}

export const stableIdAlgorithm = Object.freeze({
  id: 'atlas-stable-id-v2',
  version: 2,
  separators: Object.freeze({ field: STABLE_ID_SEPARATOR, title: TITLE_SEPARATOR }),
});
