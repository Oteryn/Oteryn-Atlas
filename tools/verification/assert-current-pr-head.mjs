import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function exactSha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) {
    throw new TypeError(`${label} must be an exact 40-character SHA`);
  }
  return value.toLowerCase();
}

function repositoryName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new TypeError('repository must be owner/name');
  }
  return value;
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new TypeError(`${label} must be a positive integer`);
  return number;
}

export function assertCurrentPrHead(payload, { repository, prNumber, expectedHeadSha }) {
  const expectedRepository = repositoryName(repository);
  const expectedPrNumber = positiveInteger(prNumber, 'prNumber');
  const expected = exactSha(expectedHeadSha, 'expectedHeadSha');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('pull request payload must be an object');
  }
  if (positiveInteger(payload.number, 'payload PR number') !== expectedPrNumber) {
    throw new TypeError(`pull request payload PR number does not match expected PR ${expectedPrNumber}`);
  }
  if (payload.base?.repo?.full_name !== expectedRepository) {
    throw new TypeError(`pull request payload repository does not match ${expectedRepository}`);
  }
  const current = exactSha(payload.head?.sha, 'payload head SHA');
  if (current !== expected) {
    throw new TypeError(`superseded PR head: expected ${expected}, current ${current}`);
  }
  return Object.freeze({
    repository: expectedRepository,
    prNumber: expectedPrNumber,
    expectedHeadSha: expected,
    currentHeadSha: current,
    status: 'current',
  });
}

function parseArgs(argv) {
  if (argv.length !== 8) {
    throw new TypeError('usage: assert-current-pr-head.mjs --payload <pr.json> --repository <owner/name> --pr-number <n> --expected-head-sha <sha>');
  }
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null || Object.hasOwn(args, flag)) throw new TypeError('arguments must be unique --flag value pairs');
    args[flag] = value;
  }
  for (const flag of ['--payload', '--repository', '--pr-number', '--expected-head-sha']) {
    if (!Object.hasOwn(args, flag)) throw new TypeError(`missing ${flag}`);
  }
  return args;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const payload = JSON.parse(fs.readFileSync(args['--payload'], 'utf8'));
    const result = assertCurrentPrHead(payload, {
      repository: args['--repository'],
      prNumber: args['--pr-number'],
      expectedHeadSha: args['--expected-head-sha'],
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
