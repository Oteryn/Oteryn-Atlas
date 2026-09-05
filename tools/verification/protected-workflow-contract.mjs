// This renderer consumes protected-base templates, never candidate YAML semantics.
// Its only editable slot is an existing numeric job timeout. Every other byte,
// including the complete workflow inventory, remains owned by protected base.
function reject(message) {
  throw new Error(`protected workflow contract: ${message}`);
}
function plain(value, label) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject(`${label} must be a plain object`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !Object.getOwnPropertyDescriptor(value, key)?.enumerable || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value')) reject(`${label} must contain only enumerable data properties`);
  }
}
function inventory(sources, label) {
  plain(sources, label);
  const paths = Object.keys(sources).sort();
  if (!paths.length) reject(`${label} is empty`);
  for (const path of paths) {
    if (!/^\.github\/workflows\/[A-Za-z0-9_-]+\.ya?ml$/.test(path) || typeof sources[path] !== 'string') reject(`${label} has an invalid workflow entry`);
  }
  return paths;
}
function configuredTimeout(source, requested, path) {
  // Protected templates use canonical two-space job indentation. Unsupported
  // template syntax is not interpreted or silently authorized: no slot is added.
  const lines = source.split('\n');
  let jobs = false;
  let job = null;
  let seenJobs = false;
  const slots = [];
  const seen = new Set();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line === 'jobs:') {
      if (seenJobs) reject(`${path} has duplicate jobs sections`);
      jobs = seenJobs = true; job = null; continue;
    }
    if (/^[^\s#]/.test(line)) { jobs = false; job = null; }
    if (!jobs) continue;
    const jobMatch = /^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/.exec(line);
    if (jobMatch) { job = jobMatch[1]; continue; }
    if (/^  \S/.test(line)) job = null;
    if (!/^    timeout-minutes:/.test(line)) continue;
    if (!job || seen.has(job)) reject(`${path} has an ambiguous job timeout`);
    seen.add(job);
    const slot = /^(    timeout-minutes: )([1-9][0-9]*)([ \t]*(?:#.*)?)$/.exec(line);
    if (!slot) reject(`${path} has a non-canonical job timeout`);
    if (Number(slot[2]) > requested) reject(`${path} reduces a protected timeout lower bound`);
    slots.push({ index, prefix: slot[1], suffix: slot[3] });
  }
  if (!slots.length) reject(`${path} has no existing numeric job timeout slots`);
  for (const { index, prefix, suffix } of slots) lines[index] = `${prefix}${requested}${suffix}`;
  return lines.join('\n');
}

export function renderProtectedWorkflowTransition({ protectedSources, configuration }) {
  const paths = inventory(protectedSources, 'protectedSources');
  plain(configuration, 'configuration');
  if (Object.keys(configuration).sort().join(',') !== 'schemaVersion,timeouts' || configuration.schemaVersion !== 1) reject('unknown configuration schema or fields');
  plain(configuration.timeouts, 'timeouts');
  const rendered = { ...protectedSources };
  for (const path of Object.keys(configuration.timeouts).sort()) {
    if (!paths.includes(path)) reject('configuration expands the protected workflow inventory');
    const requested = configuration.timeouts[path];
    if (!Number.isSafeInteger(requested) || requested < 1 || requested > 360) reject('timeout must be an integer in [1, 360]');
    rendered[path] = configuredTimeout(protectedSources[path], requested, path);
  }
  return rendered;
}

export function validateProtectedWorkflowTransition({ protectedSources, candidateSources, configuration }) {
  const expected = renderProtectedWorkflowTransition({ protectedSources, configuration });
  const candidatePaths = inventory(candidateSources, 'candidateSources');
  const expectedPaths = Object.keys(expected).sort();
  if (JSON.stringify(candidatePaths) !== JSON.stringify(expectedPaths)) reject('candidate workflow inventory drift');
  for (const path of expectedPaths) if (candidateSources[path] !== expected[path]) reject(`candidate changed protected workflow bytes outside configured slots: ${path}`);
  return { accepted: true, schemaVersion: 1, workflowPaths: expectedPaths, changedPaths: expectedPaths.filter(path => expected[path] !== protectedSources[path]) };
}
