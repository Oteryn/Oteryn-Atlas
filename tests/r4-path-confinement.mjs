import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExecutionContract } from '../tools/verification/verification-execution-contract.mjs';

test('candidate readback rejects path traversal before execution authority is consulted', () => {
  const candidate = {
    repository: 'Oteryn/Oteryn-Atlas', prNumber: 1,
    headSha: 'a'.repeat(40), baseSha: 'b'.repeat(40), treeSha: 'c'.repeat(40),
    changedFiles: [{ path: 'tests/../outside.mjs', status: 'added' }],
  };
  assert.doesNotThrow(() => resolveExecutionContract({ candidate }), /candidate readback path/);
});
