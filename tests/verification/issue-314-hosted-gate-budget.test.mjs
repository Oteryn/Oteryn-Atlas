import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function workflowJob(source, name) {
  assert.match(name, /^[A-Za-z0-9_-]+$/);
  const match = source.match(new RegExp(`(?:^|\\n)  ${name}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n|$)`));
  assert(match, `workflow job ${name} must exist`);
  return match[1];
}

function timeoutMinutes(job, name) {
  const match = job.match(/(?:^|\n)    timeout-minutes:\s*(\d+)\s*(?:\n|$)/);
  assert(match, `${name} must declare timeout-minutes`);
  return Number(match[1]);
}

test('Issue #314: protected hosted gate wait budget covers the producer critical path', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const executor = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-hosted-executor.yml'), 'utf8');

  const producerCriticalPathMinutes = [
    'preflight',
    'environment-qualification',
    'hosted-shards',
    'fan-in',
  ].reduce((total, name) => total + timeoutMinutes(workflowJob(executor, name), name), 0);
  assert.equal(producerCriticalPathMinutes, 56, 'protected producer critical path budget must remain explicit');

  const consumer = workflowJob(ci, 'verification-browser');
  const consumerTimeoutMinutes = timeoutMinutes(consumer, 'verification-browser');
  const attemptsMatch = consumer.match(/for attempt in \{1\.\.(\d+)\}; do/);
  const sleepMatch = consumer.match(/\(\( attempt < \d+ \)\) && sleep (\d+)/);
  assert(attemptsMatch, 'verification-browser must declare a bounded polling attempt count');
  assert(sleepMatch, 'verification-browser must declare a bounded polling interval');

  const attempts = Number(attemptsMatch[1]);
  const sleepSeconds = Number(sleepMatch[1]);
  const pollWindowSeconds = (attempts - 1) * sleepSeconds;
  const producerCriticalPathSeconds = producerCriticalPathMinutes * 60;

  assert(
    pollWindowSeconds >= producerCriticalPathSeconds,
    `verification-browser waits ${pollWindowSeconds}s but protected producer may legally require ${producerCriticalPathSeconds}s`,
  );
  assert(
    consumerTimeoutMinutes * 60 >= pollWindowSeconds + 120,
    'verification-browser timeout must include polling plus setup/validation headroom',
  );
});

test('Issue #314: every hosted polling iteration checks exact generic qualification before standard fan-in', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const consumer = workflowJob(ci, 'verification-browser');
  const attemptsMatch = consumer.match(/for attempt in \{1\.\.(\d+)\}; do/);
  assert(attemptsMatch, 'verification-browser must declare a bounded polling loop');

  const loopStart = consumer.indexOf(attemptsMatch[0]);
  const helperStart = consumer.indexOf('accept_generic_repair() {');
  const statusQuery = consumer.indexOf('commits/$ATLAS_CODE_REVISION/statuses?per_page=100', helperStart);
  const loopCall = consumer.indexOf('if accept_generic_repair; then', loopStart);
  const artifactQuery = consumer.indexOf('actions/artifacts?name=$expected_name&per_page=100', loopStart);

  assert(helperStart >= 0 && helperStart < loopStart, 'generic repair validator must be defined before polling');
  assert(statusQuery > helperStart && statusQuery < loopStart, 'generic repair helper must refresh exact-head commit status');
  assert(loopCall > loopStart, 'generic repair helper must run inside every polling iteration');
  assert(artifactQuery > loopCall, 'generic repair evidence must be checked before standard hosted fan-in each iteration');
  assert.match(consumer.slice(loopCall, artifactQuery), /if accept_generic_repair; then\s+exit 0\s+fi/);
});
