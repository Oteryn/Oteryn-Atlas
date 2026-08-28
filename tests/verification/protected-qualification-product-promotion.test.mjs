import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildQualificationWorld, verifyQualificationWorld } from '../../tools/verification/qualification-world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/protected-hosted-product-identities.json'), 'utf8'));

test('protected qualification builder reproduces the exact pinned hosted product identity', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-protected-qualification-product-'));
  try {
    const built = await buildQualificationWorld(root);
    const verified = await verifyQualificationWorld(root);
    assert.deepEqual(verified, built);
    assert.equal(built.fixtureId, registry.qualification_fixture.id);
    assert.equal(built.productDigest, registry.qualification_fixture.digest);
    assert.equal(built.dataCapability, 'qualification_fixture');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
