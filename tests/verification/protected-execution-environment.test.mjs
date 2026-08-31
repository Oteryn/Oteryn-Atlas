import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildProtectedExecutionEnvironmentIdentity,
  qualifyProtectedExecutionEnvironment,
  validateProtectedExecutionEnvironmentQualification,
} from '../../tools/verification/protected-execution-environment.mjs';

const config = {
  schemaVersion: 1,
  environmentId: 'atlas-protected-hosted-environment-v1',
  runner: { os: 'ubuntu-24.04' },
  container: {
    image: `mcr.microsoft.com/playwright:v1.62.0-noble@sha256:${'a'.repeat(64)}`,
    network: 'none',
    rootFilesystem: 'read-only',
    user: '1000:1000',
    capDrop: ['ALL'],
    noNewPrivileges: true,
    pidsLimit: 192,
    memoryBytes: 1610612736,
    cpus: 2,
    tmpfs: [{ path: '/tmp', options: ['nodev', 'nosuid', 'rw', 'size=256m'] }],
  },
  mounts: {
    candidate: { source: 'exact-candidate-checkout', target: '/candidate', readOnly: true },
    dependencies: {
      source: 'protected-control/e2e/node_modules',
      target: '/protected-e2e-node-modules/node_modules',
      readOnly: true,
    },
  },
  runtime: {
    node: { command: 'node' },
    npm: { command: 'npm' },
    playwright: { command: '/protected-e2e-node-modules/node_modules/.bin/playwright', version: '1.62.0' },
    chromium: { command: 'chromium' },
    python3: { command: 'python3' },
    python: {
      command: 'python',
      target: '/usr/bin/python3',
      shimRoot: '/tmp/atlas-python-bin',
      pycacheRoot: '/tmp/atlas-python-pycache',
    },
  },
  artifacts: { root: '/tmp/artifacts', writable: true },
  execution: { retries: 0, hostedShards: 1, workersPerShard: 1, timeoutSeconds: 120 },
};

const checks = {
  pinnedImage: true,
  node: true,
  npm: true,
  playwright: true,
  chromium: true,
  python3: true,
  pythonCompatibility: true,
  writableTmp: true,
  writablePycache: true,
  protectedDependencyMount: true,
  candidateReadOnly: true,
  networkNone: true,
  loopbackSocket: true,
  uidGid: true,
  artifactWrite: true,
  resourceLimits: true,
};

test('environment identity captures the exact protected sandbox assumptions', () => {
  const identity = buildProtectedExecutionEnvironmentIdentity(config);
  assert.match(identity.environmentDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(identity.config.runtime.python.target, '/usr/bin/python3');
  assert.equal(identity.config.runtime.python.shimRoot, '/tmp/atlas-python-bin');
  assert.equal(identity.config.runtime.python.pycacheRoot, '/tmp/atlas-python-pycache');
  assert.equal(identity.config.container.network, 'none');
  assert.equal(identity.config.container.rootFilesystem, 'read-only');
  assert.equal(identity.config.mounts.candidate.readOnly, true);
  assert.equal(identity.config.mounts.dependencies.readOnly, true);
  assert.equal(identity.config.execution.retries, 0);
});

test('one-shot qualification emits exact environment evidence and invokes the bounded probe once', async () => {
  const identity = buildProtectedExecutionEnvironmentIdentity(config);
  let calls = 0;
  const evidence = await qualifyProtectedExecutionEnvironment(config, async (expected) => {
    calls += 1;
    assert.equal(expected.environmentDigest, identity.environmentDigest);
    return {
      schemaVersion: 1,
      status: 'QUALIFIED',
      environmentDigest: expected.environmentDigest,
      checks,
      probeDigest: `sha256:${'b'.repeat(64)}`,
    };
  });
  assert.equal(calls, 1);
  assert.equal(evidence.status, 'QUALIFIED');
  assert.deepEqual(evidence, validateProtectedExecutionEnvironmentQualification(evidence, identity));
});

test('qualification fails closed when compatibility, isolation, mounts or resources are not proven', async () => {
  for (const required of [
    'pythonCompatibility', 'writablePycache', 'candidateReadOnly', 'networkNone',
    'protectedDependencyMount', 'pinnedImage', 'loopbackSocket', 'resourceLimits',
  ]) {
    await assert.rejects(
      () => qualifyProtectedExecutionEnvironment(config, async (identity) => ({
        schemaVersion: 1,
        status: 'QUALIFIED',
        environmentDigest: identity.environmentDigest,
        checks: { ...checks, [required]: false },
        probeDigest: `sha256:${'c'.repeat(64)}`,
      })),
      new RegExp(required, 'i'),
    );
  }
});

test('unpinned images and candidate-controlled sandbox weakening are rejected before probing', async () => {
  assert.throws(
    () => buildProtectedExecutionEnvironmentIdentity({
      ...config,
      container: { ...config.container, image: 'mcr.microsoft.com/playwright:v1.62.0-noble' },
    }),
    /pinned|sha256/i,
  );
  assert.throws(
    () => buildProtectedExecutionEnvironmentIdentity({
      ...config,
      mounts: { ...config.mounts, candidate: { ...config.mounts.candidate, readOnly: false } },
    }),
    /candidate|read.only/i,
  );
  assert.throws(
    () => buildProtectedExecutionEnvironmentIdentity({
      ...config,
      container: { ...config.container, network: 'bridge' },
    }),
    /network/i,
  );
});


test('repository environment config is the canonical pinned protected environment identity', async () => {
  const repositoryConfig = JSON.parse(await readFile(
    new URL('../../tools/verification/protected-execution-environment.json', import.meta.url),
    'utf8',
  ));
  const identity = buildProtectedExecutionEnvironmentIdentity(repositoryConfig);
  assert.equal(identity.config.container.image, 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07');
  assert.equal(identity.config.runtime.python.shimRoot, '/tmp/atlas-python-bin');
  assert.match(identity.environmentDigest, /^sha256:[a-f0-9]{64}$/);
});
