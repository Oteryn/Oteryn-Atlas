import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { canonicalDigest, deepFreeze, isPlainObject } from './anti-loop-common.mjs';
import {
  buildProtectedExecutionEnvironmentIdentity,
  validateProtectedExecutionEnvironmentQualification,
} from './protected-execution-environment.mjs';

const OBSERVATION_KEYS = Object.freeze([
  'artifactWrite',
  'candidateReadOnly',
  'capabilitiesDropped',
  'chromiumLaunched',
  'cpus',
  'dependencyLinkTarget',
  'dependencyMountExists',
  'dependencyReadOnly',
  'externalNetworkBlocked',
  'gid',
  'image',
  'loopbackSocket',
  'memoryBytes',
  'noNewPrivileges',
  'nodeAvailable',
  'npmAvailable',
  'pidsLimit',
  'playwrightVersion',
  'python3Path',
  'pythonPath',
  'schemaVersion',
  'uid',
  'writablePycache',
  'writableTmp',
].sort());

function exactObservation(value) {
  if (!isPlainObject(value) || value.schemaVersion !== 1) {
    throw new TypeError('protected execution environment observation schema is invalid');
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== OBSERVATION_KEYS.length
    || keys.some((key, index) => key !== OBSERVATION_KEYS[index])) {
    throw new TypeError('protected execution environment observations must exactly match the required observation set');
  }
  for (const field of [
    'artifactWrite', 'candidateReadOnly', 'capabilitiesDropped', 'chromiumLaunched',
    'dependencyMountExists', 'dependencyReadOnly', 'externalNetworkBlocked', 'loopbackSocket',
    'noNewPrivileges', 'nodeAvailable', 'npmAvailable', 'writablePycache', 'writableTmp',
  ]) {
    if (typeof value[field] !== 'boolean') throw new TypeError(`protected execution environment observation ${field} must be boolean`);
  }
  for (const field of ['image', 'dependencyLinkTarget', 'playwrightVersion', 'python3Path', 'pythonPath']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) {
      throw new TypeError(`protected execution environment observation ${field} must be non-empty`);
    }
  }
  for (const field of ['cpus', 'memoryBytes', 'pidsLimit', 'uid', 'gid']) {
    if (typeof value[field] !== 'number' || !Number.isFinite(value[field])) {
      throw new TypeError(`protected execution environment observation ${field} must be finite`);
    }
  }
  return Object.fromEntries(OBSERVATION_KEYS.map((key) => [key, value[key]]));
}

export function buildProtectedExecutionEnvironmentProbeEvidence(config, observation) {
  const identity = buildProtectedExecutionEnvironmentIdentity(config);
  const observed = exactObservation(observation);
  const expected = identity.config;
  const checks = {
    artifactWrite: observed.artifactWrite,
    candidateReadOnly: observed.candidateReadOnly,
    chromium: observed.chromiumLaunched,
    loopbackSocket: observed.loopbackSocket,
    networkNone: observed.externalNetworkBlocked,
    node: observed.nodeAvailable,
    npm: observed.npmAvailable,
    pinnedImage: observed.image === expected.container.image,
    playwright: observed.playwrightVersion === expected.runtime.playwright.version,
    protectedDependencyMount: observed.dependencyMountExists
      && observed.dependencyLinkTarget === expected.mounts.dependencies.target
      && observed.dependencyReadOnly,
    python3: observed.python3Path === expected.runtime.python3.command
      || observed.python3Path.endsWith(`/${expected.runtime.python3.command}`),
    pythonCompatibility: observed.pythonPath === expected.runtime.python.target,
    resourceLimits: observed.pidsLimit === expected.container.pidsLimit
      && observed.memoryBytes === expected.container.memoryBytes
      && observed.cpus === expected.container.cpus
      && observed.noNewPrivileges
      && observed.capabilitiesDropped,
    uidGid: observed.uid === 1000 && observed.gid === 1000,
    writablePycache: observed.writablePycache,
    writableTmp: observed.writableTmp,
  };
  return validateProtectedExecutionEnvironmentQualification({
    schemaVersion: 1,
    status: 'QUALIFIED',
    environmentDigest: identity.environmentDigest,
    checks,
    probeDigest: canonicalDigest(observed),
  }, identity);
}

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0 && result.signal == null;
}

function commandOutput(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  if (result.status !== 0 || result.signal != null) {
    throw new TypeError(`protected environment probe command failed: ${command} ${args.join(' ')}: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function writeProbe(root, filename) {
  fs.mkdirSync(root, { recursive: true });
  const target = path.join(root, filename);
  fs.writeFileSync(target, 'atlas-environment-probe\n', { flag: 'wx' });
  fs.rmSync(target, { force: true });
  return true;
}

function writeBlocked(root, filename) {
  const target = path.join(root, filename);
  try {
    fs.writeFileSync(target, 'must-not-write\n', { flag: 'wx' });
    fs.rmSync(target, { force: true });
    return false;
  } catch (error) {
    return ['EACCES', 'EPERM', 'EROFS'].includes(error?.code);
  }
}

function readFirst(paths) {
  for (const candidate of paths) {
    try { return fs.readFileSync(candidate, 'utf8').trim(); }
    catch {}
  }
  throw new TypeError(`protected environment probe cannot read any resource control path: ${paths.join(', ')}`);
}

function resourceLimits() {
  const pidsLimit = Number(readFirst([
    '/sys/fs/cgroup/pids.max',
    '/sys/fs/cgroup/pids/pids.max',
  ]));
  const memoryBytes = Number(readFirst([
    '/sys/fs/cgroup/memory.max',
    '/sys/fs/cgroup/memory/memory.limit_in_bytes',
  ]));
  let cpus;
  try {
    const [quota, period] = readFirst(['/sys/fs/cgroup/cpu.max']).split(/\s+/);
    cpus = quota === 'max' ? Number.POSITIVE_INFINITY : Number(quota) / Number(period);
  } catch {
    const quota = Number(readFirst(['/sys/fs/cgroup/cpu/cpu.cfs_quota_us']));
    const period = Number(readFirst(['/sys/fs/cgroup/cpu/cpu.cfs_period_us']));
    cpus = quota < 0 ? Number.POSITIVE_INFINITY : quota / period;
  }
  const status = fs.readFileSync('/proc/self/status', 'utf8');
  const noNewPrivileges = /^NoNewPrivs:\s+1$/m.test(status);
  const capabilitiesDropped = /^CapEff:\s+0+$/m.test(status);
  return { pidsLimit, memoryBytes, cpus, noNewPrivileges, capabilitiesDropped };
}

async function externalNetworkBlocked() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '1.1.1.1', port: 53 });
    let settled = false;
    const finish = (blocked) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(blocked);
    };
    socket.once('connect', () => finish(false));
    socket.once('error', () => finish(true));
    setTimeout(() => finish(true), 750).unref();
  });
}

async function loopbackSocketWorks() {
  const token = 'atlas-loopback-probe';
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => socket.end(token));
    const fail = (error) => {
      server.close(() => reject(error));
    };
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const client = net.createConnection({ host: '127.0.0.1', port: address.port });
      let received = '';
      client.setEncoding('utf8');
      client.on('data', (chunk) => { received += chunk; });
      client.once('error', fail);
      client.once('end', () => server.close(() => resolve(received === token)));
    });
  });
}

function pythonPycacheWritable(config) {
  const modulePath = '/tmp/atlas-probe-module.py';
  fs.writeFileSync(modulePath, 'VALUE = 1\n');
  try {
    commandOutput(config.runtime.python.command, ['-m', 'py_compile', modulePath], {
      env: { ...process.env, PYTHONPYCACHEPREFIX: config.runtime.python.pycacheRoot },
    });
    const queue = [config.runtime.python.pycacheRoot];
    while (queue.length) {
      const current = queue.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) queue.push(full);
        else if (entry.name.endsWith('.pyc')) return true;
      }
    }
    return false;
  } finally {
    fs.rmSync(modulePath, { force: true });
  }
}

async function chromiumLaunches(config) {
  const require = createRequire(import.meta.url);
  const playwrightRoot = path.dirname(path.dirname(config.runtime.playwright.command));
  const playwright = require(path.join(playwrightRoot, 'playwright'));
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><title>atlas-environment-probe</title>');
    return await page.title() === 'atlas-environment-probe';
  } finally {
    await browser.close();
  }
}

async function collectObservation(config) {
  const dependencyRoot = config.mounts.dependencies.target;
  const candidateDependency = '/candidate/e2e/node_modules';
  const dependencyMountExists = fs.existsSync(dependencyRoot)
    && fs.lstatSync(candidateDependency).isSymbolicLink();
  const dependencyLinkTarget = dependencyMountExists ? fs.readlinkSync(candidateDependency) : 'missing';
  fs.mkdirSync(config.runtime.python.pycacheRoot, { recursive: true });
  const limits = resourceLimits();
  return {
    schemaVersion: 1,
    image: process.env.ATLAS_PROTECTED_CONTAINER_IMAGE ?? '',
    nodeAvailable: commandAvailable(config.runtime.node.command),
    npmAvailable: commandAvailable(config.runtime.npm.command),
    playwrightVersion: JSON.parse(fs.readFileSync(path.join(
      path.dirname(path.dirname(config.runtime.playwright.command)),
      'playwright',
      'package.json',
    ), 'utf8')).version,
    chromiumLaunched: await chromiumLaunches(config),
    python3Path: commandOutput('sh', ['-c', `command -v ${config.runtime.python3.command}`]),
    pythonPath: fs.readlinkSync(path.join(config.runtime.python.shimRoot, config.runtime.python.command)),
    writableTmp: writeProbe('/tmp', '.atlas-tmp-write-probe'),
    writablePycache: pythonPycacheWritable(config),
    dependencyMountExists,
    dependencyLinkTarget,
    dependencyReadOnly: writeBlocked(dependencyRoot, '.atlas-dependency-write-probe'),
    candidateReadOnly: writeBlocked('/candidate', '.atlas-candidate-write-probe'),
    externalNetworkBlocked: await externalNetworkBlocked(),
    loopbackSocket: await loopbackSocketWorks(),
    uid: process.getuid?.() ?? -1,
    gid: process.getgid?.() ?? -1,
    artifactWrite: writeProbe(config.artifacts.root, '.atlas-artifact-write-probe'),
    ...limits,
  };
}

function parseArgs(argv) {
  if (argv.length !== 4) throw new TypeError('usage: protected-execution-environment-probe.mjs --config <config.json> --output <evidence.json>');
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--config', '--output'].includes(flag) || !value || Object.hasOwn(result, flag)) {
      throw new TypeError('protected environment probe requires unique --config and --output arguments');
    }
    result[flag] = value;
  }
  if (!result['--config'] || !result['--output']) throw new TypeError('protected environment probe arguments are incomplete');
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const config = JSON.parse(fs.readFileSync(args['--config'], 'utf8'));
    const evidence = buildProtectedExecutionEnvironmentProbeEvidence(config, await collectObservation(config));
    fs.writeFileSync(args['--output'], `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

export const protectedExecutionEnvironmentObservationKeys = deepFreeze([...OBSERVATION_KEYS]);
