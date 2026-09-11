import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bindProtectedVisualReferenceConsumer,
  requiresProtectedVisualReference,
} from '../../tools/verification/run-verification-shadow.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const command = ({ spec = 'visual-desktop.spec.mjs', capability = 'qualification_fixture' } = {}) => ({
  engine: 'playwright',
  dataCapability: capability,
  expectedTestIds: [`desktop-chromium::e2e/tests/${spec}::visual acceptance`],
});

test('hosted shadow mounts independent protected visual references only for qualification visual specs', () => {
  assert.equal(requiresProtectedVisualReference(command()), true);
  assert.equal(requiresProtectedVisualReference(command({ spec: 'visual-mobile.spec.mjs' })), true);
  assert.equal(requiresProtectedVisualReference(command({ spec: 'state-desktop.spec.mjs' })), false);
  assert.equal(requiresProtectedVisualReference(command({ capability: 'bounded_real_world' })), false);

  const composeArgs = ['compose', '-p', 'atlas-r5-test', '-f', '/protected/base.yml'];
  const env = { ATLAS_CODE_REVISION: 'a'.repeat(40) };
  const snapshots = path.join(root, '.protected-reference-test');
  const wired = bindProtectedVisualReferenceConsumer({ composeArgs, env, protectedRoot: root, referenceSnapshots: snapshots });

  assert.deepEqual(composeArgs, ['compose', '-p', 'atlas-r5-test', '-f', '/protected/base.yml']);
  assert.deepEqual(env, { ATLAS_CODE_REVISION: 'a'.repeat(40) });
  assert.deepEqual(wired.composeArgs, [...composeArgs, '-f', path.join(root, 'e2e/compose.protected-visual-consumer.yml')]);
  assert.equal(wired.env.ATLAS_REFERENCE_SNAPSHOTS, snapshots);

  const overlay = fs.readFileSync(path.join(root, 'e2e/compose.protected-visual-consumer.yml'), 'utf8');
  assert.match(overlay, /visual-desktop\.spec\.mjs-snapshots\/protected-reference:ro/);
  assert.match(overlay, /visual-mobile\.spec\.mjs-snapshots\/protected-reference:ro/);
});
