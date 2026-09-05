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
  const executor = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-admission.yml'), 'utf8');

  const producerCriticalPathMinutes = ['resolve-candidate', 'protected-admission'].reduce((sum, name) => sum + timeoutMinutes(workflowJob(executor, name), name), 0);

  const consumer = workflowJob(ci, 'verification-browser');
  const consumerTimeoutMinutes = timeoutMinutes(consumer, 'verification-browser');
  const attemptsMatch = consumer.match(/for attempt in \{1\.\.(\d+)\}; do/);
  const sleepMatch = consumer.match(/if \(\( attempt < \d+ \)\); then sleep (\d+); fi/);
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

test('Issue #314: each bounded polling iteration invokes the exact protected consumer and fails closed', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const consumer = workflowJob(ci, 'verification-browser');
  assert.match(consumer, /for attempt in \{1\.\.\d+\}; do[\s\S]*node admission-authority\/tools\/verification\/consume-protected-admission\.mjs/);
  assert.match(consumer, /if jq -e '\.accepted == true'[\s\S]*then exit 0; fi/);
  assert.match(consumer, /jq -e '\.eligible == true'/);
  assert.match(consumer, /evidence is unavailable[\s\S]*exit 1/);
  assert.doesNotMatch(consumer, /accept_generic_repair|validateLegacyTransition|commits\/.*statuses/);
});
