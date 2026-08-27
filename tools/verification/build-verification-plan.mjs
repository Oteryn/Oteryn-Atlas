import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson,
  profileRank,
  validateImpactManifest,
  validateVerificationCatalog,
} from './verification-plan-schema.mjs';
import { stableIdAlgorithm } from './stable-id.mjs';

const FALLBACK_GROUPS = Object.freeze(['deterministic.core', 'e2e.full']);
const SHADOW_WORKER_POLICY = Object.freeze({ id: 'unmeasured-shadow-v1', version: 1 });
const GOVERNANCE_PREFIXES = Object.freeze([
  'tools/verification/', '.github/workflows/', 'e2e/summary-reporter.mjs',
  'e2e/publish-local-e2e-status.ps1', 'e2e/run.ps1', 'e2e/playwright.config.mjs',
  'e2e/approve-visual-user-acceptance.ps1',
]);
const RESOURCE_RANK = Object.freeze({
  'cpu-light': 0,
  'browser-targeted': 1,
  'browser-broad': 2,
  'render-geometry': 3,
  'browser-full': 4,
  'native-gpu': 5,
  performance: 6,
  soak: 6,
  'artifact-build': 2,
});

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function sha(value, name) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new TypeError(`${name} must be a 40-character SHA`);
  return value.toLowerCase();
}

function safeChangedPath(value) {
  return typeof value === 'string'
    && value.length > 0
    && !value.startsWith('/')
    && !value.includes('\\')
    && !value.includes('//')
    && !value.split('/').includes('..')
    && !value.split('/').includes('.');
}

function allEvidencePaths(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return null;
  const paths = [];
  for (const item of changedFiles) {
    if (!item || typeof item !== 'object' || !safeChangedPath(item.path)
      || (item.previousPath != null && !safeChangedPath(item.previousPath))) return null;
    paths.push(item.path);
    if (item.previousPath) paths.push(item.previousPath);
  }
  return [...new Set(paths)].sort();
}

function matchesForPath(path, manifest) {
  return manifest.entries.filter((entry) => path.startsWith(entry.pathPrefix));
}

function classify(paths, manifest) {
  if (!paths) return { profile: 'full', groups: FALLBACK_GROUPS, domains: ['invalid-change-evidence'], fallback: true };
  const groups = new Set();
  const domains = new Set();
  let profile = 'none';
  let fallback = false;
  for (const path of paths) {
    const matches = matchesForPath(path, manifest);
    if (matches.length === 0) {
      fallback = true;
      profile = 'full';
      for (const group of FALLBACK_GROUPS) groups.add(group);
      domains.add('unknown-runtime-impact');
      continue;
    }
    for (const match of matches) {
      if (profileRank(match.minimumProfile) > profileRank(profile)) profile = match.minimumProfile;
      for (const group of match.requiredGroups) groups.add(group);
      for (const domain of match.domains) domains.add(domain);
    }
  }
  return { profile, groups: [...groups], domains: [...domains], fallback };
}

function bootstrapChanged(paths) {
  return paths?.some((path) => GOVERNANCE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) ?? true;
}

function unionClassification(left, right, bootstrap) {
  const profile = bootstrap || left.fallback || right.fallback
    ? 'full'
    : profileRank(left.profile) >= profileRank(right.profile) ? left.profile : right.profile;
  const groups = new Set([...left.groups, ...right.groups]);
  const domains = new Set([...left.domains, ...right.domains]);
  if (profile === 'full') {
    for (const group of FALLBACK_GROUPS) groups.add(group);
    if (bootstrap) domains.add('verification-governance');
  }
  return { profile, groups: [...groups].sort(), domains: [...domains].sort() };
}

function applyCrossDomainEscalations(classification, manifests) {
  const domains = new Set(classification.domains);
  const groups = new Set(classification.groups);
  let profile = classification.profile;
  const applied = [];
  const seen = new Set();
  for (const manifest of manifests) {
    for (const rule of manifest.crossDomainEscalations) {
      if (!rule.whenDomains.every((domain) => domains.has(domain))) continue;
      if (profileRank(rule.minimumProfile) > profileRank(profile)) profile = rule.minimumProfile;
      for (const group of rule.requiredGroups) groups.add(group);
      const normalized = {
        whenDomains: [...rule.whenDomains].sort(),
        minimumProfile: rule.minimumProfile,
        requiredGroups: [...rule.requiredGroups].sort(),
      };
      const key = canonicalJson(normalized);
      if (!seen.has(key)) {
        seen.add(key);
        applied.push(normalized);
      }
    }
  }
  if (profile === 'full') for (const group of FALLBACK_GROUPS) groups.add(group);
  applied.sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return { profile, groups: [...groups].sort(), domains: [...domains].sort(), applied };
}

function unionStrings(...values) {
  return [...new Set(values.flat())].sort();
}

function suppliedStableTestIds(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError('stableTestIds must be a non-empty array of stable Playwright IDs');
  }
  const ids = unionStrings(value);
  if (ids.length !== value.length) throw new TypeError('stableTestIds must not contain duplicates');
  return ids;
}

function stableTestCoordinates(id) {
  const first = id.indexOf('::');
  const second = first < 0 ? -1 : id.indexOf('::', first + 2);
  if (first <= 0 || second <= first + 2 || second >= id.length - 2) {
    throw new TypeError('stableTestIds must use project::spec::title identity');
  }
  return {
    project: id.slice(0, first),
    spec: id.slice(first + 2, second),
  };
}

function matchesSpecPattern(pattern, spec) {
  const expression = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  return new RegExp(`^${expression}$`).test(spec);
}

function stableIdMatchesGroup(id, group) {
  if (!group.capabilities.browser) return false;
  const { project, spec } = stableTestCoordinates(id);
  return group.projects.includes(project) && group.specs.some((pattern) => matchesSpecPattern(pattern, spec));
}

function exactStableTestIds(groups, protectedStableTestIds) {
  const required = new Set(groups.flatMap((group) => group.stableTestIds));
  const supplied = suppliedStableTestIds(protectedStableTestIds);
  if (!supplied) return [...required].sort();
  const browserGroups = groups.filter((group) => group.capabilities.browser);
  for (const id of supplied) {
    if (browserGroups.some((group) => stableIdMatchesGroup(id, group))) required.add(id);
  }
  return [...required].sort();
}

function mergeCatalogs(trusted, candidate) {
  const groups = {};
  for (const id of unionStrings(Object.keys(trusted.groups), Object.keys(candidate.groups))) {
    const left = trusted.groups[id];
    const right = candidate.groups[id];
    if (!left) { groups[id] = right; continue; }
    if (!right) { groups[id] = left; continue; }
    const resourceClass = RESOURCE_RANK[left.resourceClass] >= RESOURCE_RANK[right.resourceClass]
      ? left.resourceClass : right.resourceClass;
    groups[id] = {
      specs: unionStrings(left.specs, right.specs),
      projects: unionStrings(left.projects, right.projects),
      stableTestIds: unionStrings(left.stableTestIds, right.stableTestIds),
      resourceClass,
      evidence: left.evidence === 'restricted-visual-review' || right.evidence === 'restricted-visual-review'
        ? 'restricted-visual-review' : 'machine-summary',
      sequential: left.sequential || right.sequential,
      fullSafetyNet: left.fullSafetyNet || right.fullSafetyNet,
      dependsOnGroups: unionStrings(left.dependsOnGroups, right.dependsOnGroups),
      capabilities: {
        browser: left.capabilities.browser || right.capabilities.browser,
        hosted: left.capabilities.hosted && right.capabilities.hosted,
        requiresPublication: left.capabilities.requiresPublication || right.capabilities.requiresPublication,
        dataCapability: left.capabilities.dataCapability === 'real_fullworld' || right.capabilities.dataCapability === 'real_fullworld'
          ? 'real_fullworld'
          : left.capabilities.dataCapability === 'bounded_real_world' || right.capabilities.dataCapability === 'bounded_real_world'
            ? 'bounded_real_world' : 'qualification_fixture',
        visualReview: left.capabilities.visualReview || right.capabilities.visualReview,
        specialistReason: left.capabilities.specialistReason ?? right.capabilities.specialistReason,
      },
    };
  }
  return freeze({ schemaVersion: 2, groups });
}

function selectedGroups(groupIds, catalog) {
  const resolved = new Set();
  const visiting = new Set();
  const visit = (id) => {
    if (resolved.has(id)) return;
    if (visiting.has(id)) throw new TypeError(`verification dependency cycle includes ${id}`);
    const group = catalog.groups[id];
    if (!group) throw new TypeError(`verification group ${id} is not catalogued`);
    visiting.add(id);
    for (const dependency of group.dependsOnGroups) visit(dependency);
    visiting.delete(id);
    resolved.add(id);
  };
  for (const id of groupIds) visit(id);
  return [...resolved].sort().map((id) => ({ id, ...catalog.groups[id] }));
}

export function buildVerificationPlan(input) {
  if (!input || typeof input !== 'object' || input.repository !== 'Oteryn/Oteryn-Atlas') {
    throw new TypeError('repository must be Oteryn/Oteryn-Atlas');
  }
  const trustedVerificationCatalog = validateVerificationCatalog(input.trustedVerificationCatalog ?? input.verificationCatalog);
  const candidateVerificationCatalog = validateVerificationCatalog(input.candidateVerificationCatalog ?? input.verificationCatalog);
  const verificationCatalog = mergeCatalogs(trustedVerificationCatalog, candidateVerificationCatalog);
  const trustedImpactManifest = validateImpactManifest(input.trustedImpactManifest, trustedVerificationCatalog);
  const candidateImpactManifest = validateImpactManifest(input.candidateImpactManifest, candidateVerificationCatalog);
  const changedPaths = allEvidencePaths(input.changedFiles);
  const trusted = classify(changedPaths, trustedImpactManifest);
  const candidate = classify(changedPaths, candidateImpactManifest);
  const baseClassification = unionClassification(trusted, candidate, bootstrapChanged(changedPaths));
  const result = applyCrossDomainEscalations(baseClassification, [trustedImpactManifest, candidateImpactManifest]);
  const groups = selectedGroups(result.groups, verificationCatalog);
  result.groups = groups.map((group) => group.id);
  const visualGroupIds = groups.filter((group) => group.evidence === 'restricted-visual-review').map((group) => group.id);
  const resourceClasses = [...new Set(groups.map((group) => group.resourceClass))].sort();
  const requiredDataCapabilities = [...new Set(groups.map((group) => group.capabilities.dataCapability))].sort();
  const stableTestIds = exactStableTestIds(groups, input.protectedStableTestIds ?? input.stableTestIds);
  const headSha = sha(input.headSha, 'headSha');
  const integrationBaseSha = sha(input.integrationBaseSha, 'integrationBaseSha');
  const mergeBaseSha = sha(input.mergeBaseSha, 'mergeBaseSha');
  return freeze({
    schemaVersion: 1,
    repository: input.repository,
    headSha,
    integrationBaseSha,
    mergeBaseSha,
    diffIdentity: digest({ mergeBaseSha, integrationBaseSha, headSha, changedPaths: changedPaths ?? { invalid: true } }),
    changedPaths: changedPaths ?? [],
    changedPathsDigest: digest(changedPaths ?? { invalid: true }),
    impactPolicyDigest: digest({ trustedImpactManifest, candidateImpactManifest }),
    verificationCatalogDigest: digest({ trustedVerificationCatalog, candidateVerificationCatalog }),
    profile: result.profile,
    impactDomains: result.domains,
    appliedCrossDomainEscalations: result.applied,
    requiredGroupIds: result.groups,
    groups,
    stableTestIds,
    expectedStableTestIdsDigest: digest(stableTestIds),
    stableIdAlgorithm,
    requiredVisualGroupIds: visualGroupIds,
    resourceClasses,
    requiredDataCapabilities,
    requiresRealFullWorld: requiredDataCapabilities.includes('real_fullworld'),
    workerPolicyId: SHADOW_WORKER_POLICY.id,
    workerPolicyDigest: digest(SHADOW_WORKER_POLICY),
    retryPolicy: { retries: 0 },
    requiredEvidence: [...new Set(groups.map((group) => group.evidence))].sort(),
    requiresNativeHardware: resourceClasses.includes('native-gpu'),
    exclusive: resourceClasses.some((resource) => ['native-gpu', 'performance', 'soak'].includes(resource)),
    shadowOnly: true,
  });
}

function parseCliArguments(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null || Object.hasOwn(args, flag)) {
      throw new TypeError('planner CLI requires unique --flag value pairs');
    }
    args[flag] = value;
  }
  return args;
}

function readJson(pathname, label) {
  try { return JSON.parse(fs.readFileSync(pathname, 'utf8')); }
  catch (error) { throw new TypeError(`planner CLI cannot read ${label}: ${error.message}`); }
}

function runCli() {
  const args = parseCliArguments(process.argv.slice(2));
  const required = [
    '--changed-files', '--trusted-impact', '--candidate-impact',
    '--repository', '--head-sha', '--integration-base-sha', '--merge-base-sha',
  ];
  const hasCatalog = Object.hasOwn(args, '--catalog')
    || (Object.hasOwn(args, '--trusted-catalog') && Object.hasOwn(args, '--candidate-catalog'));
  if (required.some((flag) => !Object.hasOwn(args, flag)) || !hasCatalog) {
    throw new TypeError(`planner CLI requires ${required.join(', ')}`);
  }
  const plan = buildVerificationPlan({
    repository: args['--repository'],
    headSha: args['--head-sha'],
    integrationBaseSha: args['--integration-base-sha'],
    mergeBaseSha: args['--merge-base-sha'],
    stableTestIds: Object.hasOwn(args, '--stable-test-ids') ? readJson(args['--stable-test-ids'], 'stable test IDs') : undefined,
    changedFiles: readJson(args['--changed-files'], 'changed files'),
    trustedImpactManifest: readJson(args['--trusted-impact'], 'trusted impact manifest'),
    candidateImpactManifest: readJson(args['--candidate-impact'], 'candidate impact manifest'),
    verificationCatalog: Object.hasOwn(args, '--catalog') ? readJson(args['--catalog'], 'verification catalog') : undefined,
    trustedVerificationCatalog: Object.hasOwn(args, '--trusted-catalog') ? readJson(args['--trusted-catalog'], 'trusted verification catalog') : undefined,
    candidateVerificationCatalog: Object.hasOwn(args, '--candidate-catalog') ? readJson(args['--candidate-catalog'], 'candidate verification catalog') : undefined,
  });
  process.stdout.write(`${JSON.stringify(plan)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { runCli(); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
