import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const executor = fs.readFileSync(
  new URL('../../.github/workflows/protected-hosted-executor.yml', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

test('protected hosted executor binds each hosted partition to its minimum data-capability product', () => {
  assert.match(executor, /hosted\.partitions/);
  assert.match(executor, /dataCapability/);
  assert.match(executor, /qualification_fixture/);
  assert.match(executor, /bounded_real_world/);
  assert.match(executor, /buildQualificationWorld/);
  assert.match(executor, /buildBoundedRealWorld/);
  assert.match(executor, /protected-hosted-product-identities\.json/);
  assert.match(executor, /--data-capability/);
  assert.match(executor, /--source-manifest/);
});

test('ordinary hosted executor fails closed instead of treating real FullWorld as a hosted product', () => {
  assert.match(executor, /real_fullworld/);
  assert.match(executor, /unsupported hosted data capability|must not execute.*real_fullworld/i);
});
