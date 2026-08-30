import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { stableTestId } from './stable-id.mjs';

const LIST_ROW = /^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/;
const PLACEMENTS = new Set(['protected', 'candidate-additions', 'candidate-modifications']);
const HOSTED_DATA_CAPABILITIES = new Set(['qualification_fixture', 'bounded_real_world']);

function exactStableIds(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable IDs`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicate stable IDs`);
  return [...value].sort();
}

function exactPartition(partition, hostedSet, protectedSet, candidateAdditionSet, candidateModificationSet, seenCapabilities, seenIds) {
  if (!partition || typeof partition !== 'object' || Array.isArray(partition)) {
    throw new TypeError('protected Playwright data capability partition must be an object');
  }
  const dataCapability = partition.dataCapability;
  if (!HOSTED_DATA_CAPABILITIES.has(dataCapability)) {
    throw new TypeError(`protected Playwright data capability partition is unsupported: ${dataCapability ?? ''}`);
  }
  if (seenCapabilities.has(dataCapability)) {
    throw new TypeError(`protected Playwright data capability partition is duplicated: ${dataCapability}`);
  }
  seenCapabilities.add(dataCapability);

  const stableTestIds = exactStableIds(partition.stableTestIds, `${dataCapability} stable IDs`);
  const protectedStableTestIds = exactStableIds(
    partition.protectedStableTestIds,
    `${dataCapability} protected stable IDs`,
    { allowEmpty: true },
  );
  const candidateAdditionalStableTestIds = exactStableIds(
    partition.candidateAdditionalStableTestIds,
    `${dataCapability} candidate-addition stable IDs`,
    { allowEmpty: true },
  );
  const candidateModifiedStableTestIds = exactStableIds(
    partition.candidateModifiedStableTestIds ?? [],
    `${dataCapability} candidate-modification stable IDs`,
    { allowEmpty: true },
  );
  const sourcePartition = [...new Set([...protectedStableTestIds, ...candidateAdditionalStableTestIds])].sort();
  if (sourcePartition.length !== stableTestIds.length
    || sourcePartition.some((id, index) => id !== stableTestIds[index])) {
    throw new TypeError(`protected Playwright ${dataCapability} source placement must exactly partition its stable IDs`);
  }
  if (protectedStableTestIds.some((id) => candidateAdditionalStableTestIds.includes(id))) {
    throw new TypeError(`protected Playwright ${dataCapability} source placement overlaps`);
  }
  for (const id of stableTestIds) {
    if (!hostedSet.has(id)) throw new TypeError(`protected Playwright ${dataCapability} partition contains a non-hosted stable ID`);
    if (seenIds.has(id)) throw new TypeError(`protected Playwright stable ID appears in duplicate data capability partitions: ${id}`);
    seenIds.add(id);
  }
  if (protectedStableTestIds.some((id) => !protectedSet.has(id))) {
    throw new TypeError(`protected Playwright ${dataCapability} partition contains a non-protected source ID`);
  }
  if (candidateAdditionalStableTestIds.some((id) => !candidateAdditionSet.has(id))) {
    throw new TypeError(`protected Playwright ${dataCapability} partition contains a non-candidate-addition source ID`);
  }
  if (candidateModifiedStableTestIds.some((id) => !protectedSet.has(id) || !candidateModificationSet.has(id))) {
    throw new TypeError(`protected Playwright ${dataCapability} partition contains a non-candidate-modification source ID`);
  }
  return Object.freeze({
    dataCapability,
    stableTestIds: Object.freeze(stableTestIds),
    protectedStableTestIds: Object.freeze(protectedStableTestIds),
    candidateAdditionalStableTestIds: Object.freeze(candidateAdditionalStableTestIds),
    candidateModifiedStableTestIds: Object.freeze(candidateModifiedStableTestIds),
  });
}

function validateExecution(execution) {
  if (!execution || typeof execution !== 'object' || Array.isArray(execution) || execution.schemaVersion !== 2) {
    throw new TypeError('protected Playwright selection requires execution schemaVersion 2');
  }
  if (!execution.hosted || !execution.specialist) throw new TypeError('protected Playwright selection requires hosted and specialist placements');
  const hosted = exactStableIds(execution.hosted.stableTestIds, 'hosted stable IDs', { allowEmpty: true });
  const protectedStableTestIds = exactStableIds(execution.hosted.protectedStableTestIds, 'protected hosted stable IDs', { allowEmpty: true });
  const candidateAdditionalStableTestIds = exactStableIds(execution.hosted.candidateAdditionalStableTestIds, 'candidate-addition hosted stable IDs', { allowEmpty: true });
  const candidateModifiedStableTestIds = exactStableIds(execution.hosted.candidateModifiedStableTestIds ?? [], 'candidate-modification hosted stable IDs', { allowEmpty: true });
  const specialist = exactStableIds(execution.specialist.stableTestIds, 'specialist stable IDs', { allowEmpty: true });
  const specialistSet = new Set(specialist);
  const hostedSet = new Set(hosted);
  const protectedSet = new Set(protectedStableTestIds);
  const candidateAdditionSet = new Set(candidateAdditionalStableTestIds);
  const candidateModificationSet = new Set(candidateModifiedStableTestIds);

  const placementOverlap = hosted.filter((id) => specialistSet.has(id));
  if (placementOverlap.length) throw new TypeError(`protected Playwright placement overlap: ${placementOverlap.join(', ')}`);
  const sourceOverlap = protectedStableTestIds.filter((id) => candidateAdditionSet.has(id));
  if (sourceOverlap.length) throw new TypeError(`protected Playwright source-placement overlap: ${sourceOverlap.join(', ')}`);
  const sourcePartition = [...new Set([...protectedStableTestIds, ...candidateAdditionalStableTestIds])].sort();
  if (sourcePartition.length !== hosted.length || sourcePartition.some((id, index) => id !== hosted[index])) {
    throw new TypeError('protected Playwright hosted source placement must exactly partition hosted stable IDs');
  }
  if (protectedStableTestIds.some((id) => !hostedSet.has(id)) || candidateAdditionalStableTestIds.some((id) => !hostedSet.has(id))) {
    throw new TypeError('protected Playwright source placement contains a non-hosted stable ID');
  }
  if (candidateModifiedStableTestIds.some((id) => !protectedSet.has(id))) {
    throw new TypeError('protected Playwright candidate-modification overlay must be a subset of protected hosted stable IDs');
  }

  let partitions = [];
  if (execution.hosted.partitions != null) {
    if (!Array.isArray(execution.hosted.partitions)) {
      throw new TypeError('protected Playwright hosted data capability partitions must be an array');
    }
    const seenCapabilities = new Set();
    const seenIds = new Set();
    partitions = execution.hosted.partitions.map((partition) => exactPartition(
      partition,
      hostedSet,
      protectedSet,
      candidateAdditionSet,
      candidateModificationSet,
      seenCapabilities,
      seenIds,
    ));
    const partitionIds = [...seenIds].sort();
    if (partitionIds.length !== hosted.length || partitionIds.some((id, index) => id !== hosted[index])) {
      throw new TypeError('protected Playwright data capability partitions must exactly partition hosted stable IDs');
    }
    const partitionModificationIds = partitions.flatMap((partition) => partition.candidateModifiedStableTestIds).sort();
    if (partitionModificationIds.length !== candidateModifiedStableTestIds.length
      || partitionModificationIds.some((id, index) => id !== candidateModifiedStableTestIds[index])) {
      throw new TypeError('protected Playwright data capability partitions must exactly cover candidate-modification overlay IDs');
    }
  }

  return {
    hosted,
    protectedStableTestIds,
    candidateAdditionalStableTestIds,
    candidateModifiedStableTestIds,
    specialist,
    partitions,
  };
}

export function buildProtectedPlaywrightSelection(listText, execution, { placement, dataCapability } = {}) {
  if (typeof listText !== 'string') throw new TypeError('Playwright source list must be text');
  if (!PLACEMENTS.has(placement)) throw new TypeError('protected Playwright selection placement must be protected, candidate-additions or candidate-modifications');
  const validated = validateExecution(execution);

  let selectedStableIds;
  if (dataCapability == null) {
    selectedStableIds = placement === 'protected'
      ? validated.protectedStableTestIds
      : placement === 'candidate-additions'
        ? validated.candidateAdditionalStableTestIds
        : validated.candidateModifiedStableTestIds;
  } else {
    if (!HOSTED_DATA_CAPABILITIES.has(dataCapability)) {
      throw new TypeError(`protected Playwright data capability is unsupported for hosted execution: ${dataCapability}`);
    }
    const partition = validated.partitions.find((candidate) => candidate.dataCapability === dataCapability);
    if (!partition) throw new TypeError(`protected Playwright data capability partition is missing: ${dataCapability}`);
    selectedStableIds = placement === 'protected'
      ? partition.protectedStableTestIds
      : placement === 'candidate-additions'
        ? partition.candidateAdditionalStableTestIds
        : partition.candidateModifiedStableTestIds;
  }

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
    dataCapability: dataCapability ?? null,
    stableTestIds: Object.freeze(selectedStableIds),
    testListText: selectedRows.length ? `${selectedRows.join('\n')}\n` : '',
  });
}

function parseArgs(argv) {
  if (argv.length !== 6 && argv.length !== 8) {
    throw new TypeError('usage: protected-playwright-selection.mjs --list <list> --execution <execution.json> --placement <protected|candidate-additions|candidate-modifications> [--data-capability <qualification_fixture|bounded_real_world>]');
  }
  const allowed = ['--list', '--execution', '--placement', '--data-capability'];
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.includes(flag) || !value || Object.hasOwn(result, flag)) {
      throw new TypeError('protected Playwright selection CLI requires unique --list, --execution, --placement and optional --data-capability values');
    }
    result[flag] = value;
  }
  if (!result['--list'] || !result['--execution'] || !PLACEMENTS.has(result['--placement'])) {
    throw new TypeError('protected Playwright selection CLI requires a valid --list, --execution and --placement');
  }
  if (result['--data-capability'] && !HOSTED_DATA_CAPABILITIES.has(result['--data-capability'])) {
    throw new TypeError('protected Playwright selection CLI received an unsupported hosted data capability');
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
      { placement: args['--placement'], dataCapability: args['--data-capability'] },
    ).testListText);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
