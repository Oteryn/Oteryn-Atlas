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

test('Issue #314: each hosted poll checks protected generic repair before standard fan-in', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const consumer = workflowJob(ci, 'verification-browser');
  const loopStart = consumer.indexOf('for attempt in {1..169}; do');
  const loopEnd = consumer.indexOf('(( attempt < 169 )) && sleep 20', loopStart);
  assert(loopStart >= 0 && loopEnd > loopStart, 'verification-browser must retain the bounded 56-minute loop');

  const beforeLoop = consumer.slice(0, loopStart);
  const loop = consumer.slice(loopStart, loopEnd);
  assert.doesNotMatch(beforeLoop, /protected-product-qualification-status\.json/,
    'generic repair status must not be checked only once before polling');
  const repairStatus = loop.indexOf('protected-product-qualification-status.json');
  const repairValidation = loop.indexOf('validateProtectedProductQualificationGate');
  const standardArtifact = loop.indexOf('actions/artifacts?name=$expected_name');
  assert(repairStatus >= 0, 'each polling iteration must refresh the latest generic repair status');
  assert(repairValidation > repairStatus, 'each refreshed generic repair producer must be validated');
  assert(standardArtifact > repairValidation,
    'generic repair validation must precede the standard protected-hosted artifact lookup');
  assert.doesNotMatch(loop, /workflow_dispatch|gh workflow run|gh run rerun/,
    'the consumer must not accept manual evidence or rerun a producer');
});
