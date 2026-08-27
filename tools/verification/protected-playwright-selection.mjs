import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stableTestId } from './stable-id.mjs';

const LIST_ROW = /^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/;
const PLACEMENTS = new Set(['protected', 'candidate-additions']);

function exactStableIds(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value].sort();
}

function validateExecution(execution) {
  if (!execution || typeof execution !== 'object' || Array.isArray(execution) || execution.schemaVersion !== 1) {
    throw new TypeError('protected Playwright selection requires execution schemaVersion 1');
  }
  if (!execution.hosted || !execution.specialist) throw new TypeError('protected Playwright selection requires hosted and specialist placements');
  const hosted = exactStableIds(execution.hosted.stableTestIds, 'hosted stable IDs', { allowEmpty: true });
  const protectedStableTestIds = exactStableIds(execution.hosted.protectedStableTestIds, 'protected hosted stable IDs', { allowEmpty: true });
  const candidateAdditionalStableTestIds = exactStableIds(execution.hosted.candidateAdditionalStableTestIds, 'candidate-addition hosted stable IDs', { allowEmpty: true });
  const specialist = exactStableIds(execution.specialist.stableTestIds, 'specialist stable IDs', { allowEmpty: true });
  const specialistSet = new Set(specialist);
  const hostedSet = new Set(hosted);
  const protectedSet = new Set(protectedStableTestIds);
  const candidateAdditionSet = new Set(candidateAdditionalStableTestIds);

  const placementOverlap = hosted.filter((id) => specialistSet.has(id));
  if (placementOverlap.length) throw new TypeError(`protected Playwright placement overlap: ${placementOverlap.join(', ')}`);
  const sourceOverlap = protectedStableTestIds.filter((id) => candidateAdditionSet.has(id));
  if (sourceOverlap.length) throw new TypeError(`protected Playwright source-placement overlap: ${sourceOverlap.join(', ')}`);
  const partition = [...new Set([...protectedStableTestIds, ...candidateAdditionalStableTestIds])].sort();
  if (partition.length !== hosted.length || partition.some((id, index) => id !== hosted[index])) {
    throw new TypeError('protected Playwright hosted source placement must exactly partition hosted stable IDs');
  }
  if (protectedStableTestIds.some((id) => !hostedSet.has(id)) || candidateAdditionalStableTestIds.some((id) => !hostedSet.has(id))) {
    throw new TypeError('protected Playwright source placement contains a non-hosted stable ID');
  }
  return { hosted, protectedStableTestIds, candidateAdditionalStableTestIds, specialist };
}

export function buildProtectedPlaywrightSelection(listText, execution, { placement } = {}) {
  if (typeof listText !== 'string') throw new TypeError('Playwright source list must be text');
  if (!PLACEMENTS.has(placement)) throw new TypeError('protected Playwright selection placement must be protected or candidate-additions');
  const validated = validateExecution(execution);
  const selectedStableIds = placement === 'protected'
    ? validated.protectedStableTestIds
    : validated.candidateAdditionalStableTestIds;

  const rowsByStableId = new Map();
  for (const line of listText.split(/\r?\n/)) {
    const match = line.match(LIST_ROW);
    if (!match) continue;
    const [, project, spec, title] = match;
    const id = stableTestId(project, `e2e/tests/${spec}`, title);
    if (rowsByStableId.has(id)) throw new TypeError(`Playwright source list contains duplicate stable ID: ${id}`);
    rowsByStableId.set(id, line.trim());
  }
  if (rowsByStableId.size === 0 && selectedStableIds.length) throw new TypeError(`Playwright ${placement} source list contains no scenarios`);

  const selectedRows = [];
  for (const id of selectedStableIds) {
    const row = rowsByStableId.get(id);
    if (!row) throw new TypeError(`protected hosted stable ID is missing from exact ${placement} census: ${id}`);
    selectedRows.push(row);
  }
  return Object.freeze({
    placement,
    stableTestIds: Object.freeze(selectedStableIds),
    testListText: selectedRows.length ? `${selectedRows.join('\n')}\n` : '',
  });
}

function parseArgs(argv) {
  if (argv.length !== 6) throw new TypeError('usage: protected-playwright-selection.mjs --list <list> --execution <execution.json> --placement <protected|candidate-additions>');
  const allowed = ['--list', '--execution', '--placement'];
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.includes(flag) || !value || Object.hasOwn(result, flag)) {
      throw new TypeError('protected Playwright selection CLI requires unique --list, --execution and --placement values');
    }
    result[flag] = value;
  }
  if (!result['--list'] || !result['--execution'] || !PLACEMENTS.has(result['--placement'])) {
    throw new TypeError('protected Playwright selection CLI requires a valid --list, --execution and --placement');
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const execution = JSON.parse(fs.readFileSync(args['--execution'], 'utf8'));
    process.stdout.write(buildProtectedPlaywrightSelection(
      fs.readFileSync(args['--list'], 'utf8'),
      execution,
      { placement: args['--placement'] },
    ).testListText);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
