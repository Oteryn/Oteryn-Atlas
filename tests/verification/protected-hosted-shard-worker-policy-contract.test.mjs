import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const plan = fs.readFileSync(new URL('../../tools/verification/protected-hosted-plan.mjs', import.meta.url), 'utf8');
const summary = fs.readFileSync(new URL('../../tools/verification/protected-hosted-shard-summary.mjs', import.meta.url), 'utf8');

const phaseDWorkerPolicy = /id:\s*'atlas-protected-hosted-workers-v1',[\s\S]*?version:\s*1,[\s\S]*?hostedShards:\s*1,[\s\S]*?workersPerShard:\s*1/;

test('protected shard evidence uses the exact packed Phase-D worker policy v1', () => {
  assert.match(plan, phaseDWorkerPolicy);
  assert.match(summary, phaseDWorkerPolicy);
});
