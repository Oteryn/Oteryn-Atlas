import crypto from 'node:crypto';

const PROJECT_LIMIT = 128;
const SPEC_PATH_LIMIT = 512;
const SCENARIO_LIMIT = 512;
const SEPARATOR_LENGTH = 4;

export const MAX_STABLE_TEST_ID_LENGTH = PROJECT_LIMIT + SPEC_PATH_LIMIT + SCENARIO_LIMIT + SEPARATOR_LENGTH;

function boundedIdentityComponent(value, limit) {
  const text = String(value ?? 'unknown');
  if (text.length <= limit) return text;
  const suffix = `~sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
  return `${text.slice(0, limit - suffix.length)}${suffix}`;
}

export function normalizeSpecPath(file) {
  const normalized = String(file ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
  const e2eIndex = normalized.indexOf('e2e/tests/');
  if (e2eIndex >= 0) return normalized.slice(e2eIndex);
  const testsIndex = normalized.indexOf('tests/');
  if (testsIndex >= 0) return `e2e/${normalized.slice(testsIndex)}`;
  return normalized || 'unknown';
}

export function stableTestId(project, specPath, scenario) {
  return [
    boundedIdentityComponent(project, PROJECT_LIMIT),
    boundedIdentityComponent(normalizeSpecPath(specPath), SPEC_PATH_LIMIT),
    boundedIdentityComponent(scenario, SCENARIO_LIMIT),
  ].join('::');
}
