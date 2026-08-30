import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildVerificationAuthorityIdentity,
  validateVerificationAuthorityIdentity,
} from '../../tools/verification/verification-authority.mjs';

const manifest = {
  schemaVersion: 1,
  authorityId: 'atlas-protected-verification-authority-v1',
  components: [
    { id: 'controller', path: '.github/workflows/protected-verification-controller.yml' },
    { id: 'fan-in', path: 'tools/verification/protected-hosted-fan-in.mjs' },
    { id: 'planner', path: 'tools/verification/protected-hosted-plan.mjs' },
  ],
};

function reader(entries) {
  return async (path) => {
    if (!Object.hasOwn(entries, path)) throw new Error(`missing ${path}`);
    return entries[path];
  };
}

const authorityFiles = {
  '.github/workflows/protected-verification-controller.yml': 'controller-v1\n',
  'tools/verification/protected-hosted-fan-in.mjs': 'fan-in-v1\n',
  'tools/verification/protected-hosted-plan.mjs': 'planner-v1\n',
};

test('authority identity ignores unrelated whole-main movement', async () => {
  const first = await buildVerificationAuthorityIdentity({
    manifest,
    readFile: reader({ ...authorityFiles, 'README.md': 'old\n' }),
  });
  const second = await buildVerificationAuthorityIdentity({
    manifest,
    readFile: reader({ ...authorityFiles, 'README.md': 'new\n' }),
  });
  assert.equal(first.authorityDigest, second.authorityDigest);
  assert.deepEqual(first, validateVerificationAuthorityIdentity(first));
});

test('changing any protected authority component changes authorityDigest', async () => {
  const first = await buildVerificationAuthorityIdentity({ manifest, readFile: reader(authorityFiles) });
  const second = await buildVerificationAuthorityIdentity({
    manifest,
    readFile: reader({ ...authorityFiles, 'tools/verification/protected-hosted-fan-in.mjs': 'fan-in-v2\n' }),
  });
  assert.notEqual(first.authorityDigest, second.authorityDigest);
  assert.notEqual(first.components[1].digest, second.components[1].digest);
});

test('authority manifest rejects non-canonical, duplicate and unsafe component declarations', async () => {
  await assert.rejects(
    () => buildVerificationAuthorityIdentity({
      manifest: { ...manifest, components: [...manifest.components].reverse() },
      readFile: reader(authorityFiles),
    }),
    /canonical|sort/i,
  );
  await assert.rejects(
    () => buildVerificationAuthorityIdentity({
      manifest: {
        ...manifest,
        components: [
          { id: 'controller', path: '.github/workflows/protected-verification-controller.yml' },
          { id: 'controller', path: 'tools/verification/protected-hosted-plan.mjs' },
        ],
      },
      readFile: reader(authorityFiles),
    }),
    /duplicate/i,
  );
  await assert.rejects(
    () => buildVerificationAuthorityIdentity({
      manifest: {
        ...manifest,
        components: [{ id: 'escape', path: '../candidate-owned.mjs' }],
      },
      readFile: reader(authorityFiles),
    }),
    /path|safe/i,
  );
});

test('authority identity fails closed when a declared component cannot be read or is tampered', async () => {
  await assert.rejects(
    () => buildVerificationAuthorityIdentity({ manifest, readFile: reader({}) }),
    /unreadable|missing/i,
  );
  const identity = await buildVerificationAuthorityIdentity({ manifest, readFile: reader(authorityFiles) });
  assert.throws(
    () => validateVerificationAuthorityIdentity({
      ...identity,
      components: identity.components.map((component, index) => (
        index === 0 ? { ...component, digest: `sha256:${'0'.repeat(64)}` } : component
      )),
    }),
    /authorityDigest|digest mismatch|identity/i,
  );
});
