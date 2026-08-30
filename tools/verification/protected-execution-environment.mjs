import {
  canonicalDigest,
  cloneJson,
  deepFreeze,
  exactDigest,
  isPlainObject,
  nonEmptyString,
} from './anti-loop-common.mjs';

export const REQUIRED_ENVIRONMENT_CHECKS = deepFreeze([
  'artifactWrite',
  'candidateReadOnly',
  'chromium',
  'loopbackSocket',
  'networkNone',
  'node',
  'npm',
  'pinnedImage',
  'playwright',
  'protectedDependencyMount',
  'python3',
  'pythonCompatibility',
  'resourceLimits',
  'uidGid',
  'writablePycache',
  'writableTmp',
].sort());

function requireCommand(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be an object`);
  return { ...value, command: nonEmptyString(value.command, `${label}.command`) };
}

function normalizeConfig(candidate) {
  if (!isPlainObject(candidate) || candidate.schemaVersion !== 1
    || candidate.environmentId !== 'atlas-protected-hosted-environment-v1') {
    throw new TypeError('protected execution environment config identity is invalid');
  }
  if (!isPlainObject(candidate.runner) || candidate.runner.os !== 'ubuntu-24.04') {
    throw new TypeError('protected execution runner must be ubuntu-24.04');
  }
  const container = candidate.container;
  if (!isPlainObject(container) || typeof container.image !== 'string'
    || !/@sha256:[a-f0-9]{64}$/.test(container.image)) {
    throw new TypeError('protected execution container image must be pinned by sha256 digest');
  }
  if (container.network !== 'none') throw new TypeError('protected execution container network must be none');
  if (container.rootFilesystem !== 'read-only') throw new TypeError('protected execution root filesystem must be read-only');
  if (container.user !== '1000:1000') throw new TypeError('protected execution uid/gid must be 1000:1000');
  if (!Array.isArray(container.capDrop) || container.capDrop.length !== 1 || container.capDrop[0] !== 'ALL'
    || container.noNewPrivileges !== true) {
    throw new TypeError('protected execution privilege isolation is invalid');
  }
  for (const [field, value] of [['pidsLimit', container.pidsLimit], ['memoryBytes', container.memoryBytes], ['cpus', container.cpus]]) {
    if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) throw new TypeError(`protected execution ${field} resource limit is invalid`);
  }
  if (!Array.isArray(container.tmpfs) || container.tmpfs.length !== 1
    || container.tmpfs[0]?.path !== '/tmp' || !Array.isArray(container.tmpfs[0]?.options)) {
    throw new TypeError('protected execution writable /tmp tmpfs is invalid');
  }
  const tmpOptions = [...container.tmpfs[0].options].sort();
  for (const required of ['nodev', 'nosuid', 'rw', 'size=256m']) {
    if (!tmpOptions.includes(required)) throw new TypeError(`protected execution /tmp is missing ${required}`);
  }

  const mounts = candidate.mounts;
  if (!isPlainObject(mounts) || !isPlainObject(mounts.candidate)
    || mounts.candidate.source !== 'exact-candidate-checkout'
    || mounts.candidate.target !== '/candidate' || mounts.candidate.readOnly !== true) {
    throw new TypeError('protected execution candidate mount must be exact and read-only');
  }
  if (!isPlainObject(mounts.dependencies)
    || mounts.dependencies.source !== 'protected-control/e2e/node_modules'
    || mounts.dependencies.target !== '/protected-e2e-node-modules/node_modules'
    || mounts.dependencies.readOnly !== true) {
    throw new TypeError('protected execution dependency mount must be protected and read-only');
  }

  const runtime = candidate.runtime;
  if (!isPlainObject(runtime)) throw new TypeError('protected execution runtime is invalid');
  const normalizedRuntime = {
    node: requireCommand(runtime.node, 'runtime.node'),
    npm: requireCommand(runtime.npm, 'runtime.npm'),
    playwright: requireCommand(runtime.playwright, 'runtime.playwright'),
    chromium: requireCommand(runtime.chromium, 'runtime.chromium'),
    python3: requireCommand(runtime.python3, 'runtime.python3'),
    python: requireCommand(runtime.python, 'runtime.python'),
  };
  if (runtime.playwright.version !== '1.62.0') throw new TypeError('protected execution Playwright version is invalid');
  normalizedRuntime.playwright.version = runtime.playwright.version;
  if (runtime.python.target !== '/usr/bin/python3'
    || runtime.python.shimRoot !== '/tmp/atlas-python-bin'
    || runtime.python.pycacheRoot !== '/tmp/atlas-python-pycache') {
    throw new TypeError('protected execution Python compatibility/pycache contract is invalid');
  }
  Object.assign(normalizedRuntime.python, {
    target: runtime.python.target,
    shimRoot: runtime.python.shimRoot,
    pycacheRoot: runtime.python.pycacheRoot,
  });

  if (!isPlainObject(candidate.artifacts) || candidate.artifacts.root !== '/tmp/artifacts' || candidate.artifacts.writable !== true) {
    throw new TypeError('protected execution artifact path must be writable under /tmp');
  }
  const execution = candidate.execution;
  if (!isPlainObject(execution) || execution.retries !== 0
    || execution.hostedShards !== 1 || execution.workersPerShard !== 1
    || !Number.isSafeInteger(execution.timeoutSeconds) || execution.timeoutSeconds <= 0) {
    throw new TypeError('protected execution retry/worker/resource policy is invalid');
  }

  return {
    schemaVersion: 1,
    environmentId: candidate.environmentId,
    runner: { os: candidate.runner.os },
    container: {
      image: container.image,
      network: container.network,
      rootFilesystem: container.rootFilesystem,
      user: container.user,
      capDrop: ['ALL'],
      noNewPrivileges: true,
      pidsLimit: container.pidsLimit,
      memoryBytes: container.memoryBytes,
      cpus: container.cpus,
      tmpfs: [{ path: '/tmp', options: tmpOptions }],
    },
    mounts: {
      candidate: { source: mounts.candidate.source, target: mounts.candidate.target, readOnly: true },
      dependencies: { source: mounts.dependencies.source, target: mounts.dependencies.target, readOnly: true },
    },
    runtime: normalizedRuntime,
    artifacts: { root: candidate.artifacts.root, writable: true },
    execution: {
      retries: 0,
      hostedShards: 1,
      workersPerShard: 1,
      timeoutSeconds: execution.timeoutSeconds,
    },
  };
}

export function buildProtectedExecutionEnvironmentIdentity(config) {
  const normalized = normalizeConfig(cloneJson(config));
  const core = { schemaVersion: 1, environmentId: normalized.environmentId, config: normalized };
  return deepFreeze({ ...core, environmentDigest: canonicalDigest(core) });
}

export function validateProtectedExecutionEnvironmentQualification(evidence, expectedIdentity) {
  if (!isPlainObject(evidence) || evidence.schemaVersion !== 1 || evidence.status !== 'QUALIFIED') {
    throw new TypeError('protected execution environment qualification status is invalid');
  }
  const expected = expectedIdentity && expectedIdentity.environmentDigest
    ? expectedIdentity
    : buildProtectedExecutionEnvironmentIdentity(expectedIdentity);
  const environmentDigest = exactDigest(evidence.environmentDigest, 'environment qualification digest');
  if (environmentDigest !== expected.environmentDigest) throw new TypeError('environment qualification identity mismatch');
  if (!isPlainObject(evidence.checks)) throw new TypeError('environment qualification checks are invalid');
  const keys = Object.keys(evidence.checks).sort();
  if (keys.length !== REQUIRED_ENVIRONMENT_CHECKS.length
    || keys.some((key, index) => key !== REQUIRED_ENVIRONMENT_CHECKS[index])) {
    throw new TypeError('environment qualification checks do not exactly match required checks');
  }
  for (const key of REQUIRED_ENVIRONMENT_CHECKS) {
    if (evidence.checks[key] !== true) throw new TypeError(`environment qualification failed required check: ${key}`);
  }
  const probeDigest = exactDigest(evidence.probeDigest, 'environment probe digest');
  const core = {
    schemaVersion: 1,
    status: 'QUALIFIED',
    environmentDigest,
    checks: Object.fromEntries(REQUIRED_ENVIRONMENT_CHECKS.map((key) => [key, true])),
    probeDigest,
  };
  const qualificationDigest = canonicalDigest(core);
  if (evidence.qualificationDigest !== undefined
    && exactDigest(evidence.qualificationDigest, 'environment qualification evidence digest') !== qualificationDigest) {
    throw new TypeError('environment qualification evidence digest mismatch');
  }
  return deepFreeze({ ...core, qualificationDigest });
}

export async function qualifyProtectedExecutionEnvironment(config, probe) {
  const identity = buildProtectedExecutionEnvironmentIdentity(config);
  if (typeof probe !== 'function') throw new TypeError('protected environment qualification probe must be a function');
  const observed = await probe(identity);
  return validateProtectedExecutionEnvironmentQualification(observed, identity);
}
