import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildBoundedRealWorld, verifyBoundedRealWorld } from '../../tools/verification/bounded-real-world.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/protected-hosted-product-identities.json'), 'utf8'));

test('protected bounded-real product registry pins the exact deterministic current-main product', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-protected-bounded-real-'));
  const productRoot = path.join(tempRoot, 'product');
  try {
    const built = await buildBoundedRealWorld(productRoot, { sourceRoot: ROOT });
    const verified = await verifyBoundedRealWorld(productRoot);
    assert.equal(built.fixtureId, registry.bounded_real_world.id);
    assert.equal(verified.fixtureId, registry.bounded_real_world.id);
    assert.equal(built.productDigest, verified.productDigest);
    assert.equal(built.productDigest, registry.bounded_real_world.digest,
      'protected bounded_real_world digest pin must equal exact current-main deterministic product bytes');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
