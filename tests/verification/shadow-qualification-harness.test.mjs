import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildQualificationWorld, verifyQualificationWorld } from '../../tools/verification/qualification-world.mjs';
import { resolveQualificationScenarioBindings } from '../../tools/verification/qualification-scenario-bindings.mjs';
import { prepareProtectedBrowserHarness } from '../../tools/verification/run-verification-shadow.mjs';

const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));

async function fixture(t) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-shadow-harness-'));
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const productRoot = path.join(scratch, 'product');
  const manifest = await buildQualificationWorld(productRoot);
  await verifyQualificationWorld(productRoot);
  const identities = JSON.parse(fs.readFileSync(path.join(root, 'tools/verification/protected-hosted-product-identities.json'), 'utf8'));
  assert.equal(manifest.productDigest, identities.qualification_fixture.digest);
  const bindings = resolveQualificationScenarioBindings({
    productRoot,
    expectedProductDigest: manifest.productDigest,
  });
  return { scratch, productRoot, bindings };
}
test('shadow binds protected qualification harness without weakening production assertions', async (t) => {
  const { scratch, productRoot, bindings } = await fixture(t);
  const destination = path.join(scratch, 'bound-e2e');
  const result = prepareProtectedBrowserHarness({
    protectedRoot: root,
    destination,
    qualificationBindings: bindings,
  });
  assert.equal(result.bound, true);
  const source = fs.readFileSync(path.join(destination, 'tests/audit-desktop.spec.mjs'), 'utf8');
  assert.match(source, /__atlasQualification/);
  assert.match(source, /32380/);
  assert.match(source, new RegExp(String(bindings.distinct[0].x)));
  const gameplay = fs.readFileSync(path.join(destination, 'tests/creature-gameplay-desktop.spec.mjs'), 'utf8');
  assert.doesNotMatch(gameplay, /installQualificationGameplayRoute|page\.route\(/);
  assert.equal(fs.existsSync(path.join(productRoot, 'web/creature-gameplay/manifest.json')), true);
});

test('shadow keeps non-qualification protected harness byte-identical', async (t) => {
  const { scratch } = await fixture(t);
  const destination = path.join(scratch, 'raw-e2e');
  const result = prepareProtectedBrowserHarness({ protectedRoot: root, destination });
  assert.equal(result.bound, false);
  for (const relative of ['tests/audit-desktop.spec.mjs', 'support/qualification-gameplay.mjs', 'playwright.config.mjs']) {
    assert.deepEqual(fs.readFileSync(path.join(destination, relative)), fs.readFileSync(path.join(root, 'e2e', relative)));
  }
});