import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildQualificationWorld } from '../../tools/verification/qualification-world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const identities = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'tools/verification/protected-hosted-product-identities.json'),
  'utf8',
));

test('protected hosted product identities pin qualification and bounded-real products', () => {
  assert.deepEqual(identities.qualification_fixture, {
    id: 'atlas-qualification-world-v2',
    digest: 'sha256:c36ed503f8ada27a673ba96780b70cb361fa2fe2ce08240e372dbff664a2866a',
  });
  assert.deepEqual(identities.bounded_real_world, {
    id: 'atlas-bounded-real-world-v1',
    digest: 'sha256:a19f0371eb5afcdf8c40156d732d5602e970400ec9369607f901e2f0a58c92b6',
  });
});

test('qualification product registry matches the deterministic qualification rebuild', async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-qualification-product-registry-'));
  const root = path.join(parent, 'world');
  try {
    const built = await buildQualificationWorld(root);
    assert.equal(built.fixtureId, identities.qualification_fixture.id);
    assert.equal(built.productDigest, identities.qualification_fixture.digest);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
