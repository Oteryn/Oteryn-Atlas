import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const identities = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tools/verification/protected-hosted-product-identities.json'),
  'utf8',
));

test('protected hosted product identities pin qualification and bounded-real products', () => {
  assert.deepEqual(identities.qualification_fixture, {
    id: 'atlas-qualification-world-v2',
    digest: 'sha256:678adadd2d307685815c1982447d06b5ca4c9ec9659eb93f43ae7a4d6dc6eed7',
  });
  assert.deepEqual(identities.bounded_real_world, {
    id: 'atlas-bounded-real-world-v1',
    digest: 'sha256:a19f0371eb5afcdf8c40156d732d5602e970400ec9369607f901e2f0a58c92b6',
  });
});
