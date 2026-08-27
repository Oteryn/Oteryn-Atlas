import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stableTestId } from './stable-id.mjs';

const LIST_ROW = /^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/;

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
  const specialist = exactStableIds(execution.specialist.stableTestIds, 'specialist stable IDs', { allowEmpty: true });
  const specialistSet = new Set(specialist);
  const overlap = hosted.filter((id) => specialistSet.has(id));
  if (overlap.length) throw new TypeError(`protected Playwright placement overlap: ${overlap.join(', ')}`);
  return { hosted, specialist };
}

export function buildProtectedPlaywrightSelection(listText, execution) {
  if (typeof listText !== 'string') throw new TypeError('candidate Playwright list must be text');
  const { hosted } = validateExecution(execution);
  const rowsByStableId = new Map();
  for (const line of listText.split(/\r?\n/)) {
    const match = line.match(LIST_ROW);
    if (!match) continue;
    const [, project, spec, title] = match;
    const id = stableTestId(project, `e2e/tests/${spec}`, title);
    if (rowsByStableId.has(id)) throw new TypeError(`candidate Playwright list contains duplicate stable ID: ${id}`);
    rowsByStableId.set(id, line.trim());
  }
  if (rowsByStableId.size === 0 && hosted.length) throw new TypeError('candidate Playwright list contains no scenarios');

  const selectedRows = [];
  for (const id of hosted) {
    const row = rowsByStableId.get(id);
    if (!row) throw new TypeError(`protected hosted stable ID is missing from exact candidate census: ${id}`);
    selectedRows.push(row);
  }
  return Object.freeze({
    stableTestIds: Object.freeze(hosted),
    testListText: selectedRows.length ? `${selectedRows.join('\n')}\n` : '',
  });
}

function parseArgs(argv) {
  if (argv.length !== 4) throw new TypeError('usage: protected-playwright-selection.mjs --list <list> --execution <execution.json>');
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--list', '--execution'].includes(flag) || !value || Object.hasOwn(result, flag)) {
      throw new TypeError('protected Playwright selection CLI requires unique --list and --execution values');
    }
    result[flag] = value;
  }
  if (!result['--list'] || !result['--execution']) throw new TypeError('protected Playwright selection CLI requires --list and --execution');
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const execution = JSON.parse(fs.readFileSync(args['--execution'], 'utf8'));
    process.stdout.write(buildProtectedPlaywrightSelection(fs.readFileSync(args['--list'], 'utf8'), execution).testListText);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
