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
