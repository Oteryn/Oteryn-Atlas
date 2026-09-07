import { createHash } from 'node:crypto';
import { canonicalJson, validateVerificationCatalog } from './verification-plan-schema.mjs';

const SPEC = /^e2e\/tests\/[a-z0-9-]+\.spec\.mjs$/;
const BINDINGS = ['reviewerIdentity', 'independentReview', 'atlasRevision', 'playwrightResultDigest', 'screenshotDigest', 'frameId', 'stableTestId'];
function requireValue(value, message) {
  if (!value) throw new TypeError(`browser execution unresolved: ${message}`);
}
function unique(values, label) {
  requireValue(Array.isArray(values) && values.every((v) => typeof v === 'string' && v), label);
  requireValue(new Set(values).size === values.length, `${label} duplicate`);
  return values;
}
const digest = (value) => `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// The caller must load this registry from authenticated protected-base code. This
// pure resolver does not authenticate a repository revision and accepts no
// candidate catalog, candidate command or candidate ownership overrides.
// It resolves obligations only: it neither executes tests nor activates routing.
export function resolveBrowserExecution({ protectedRegistry, requiredGroups, atlasRevision, environmentDigest, policyResolved, protectedBaseSha, publicationIdentities } = {}) {
  requireValue(policyResolved === true, 'protected policy has not been resolved');
  requireValue(/^[0-9a-f]{40}$/.test(atlasRevision ?? ''), 'exact Atlas revision required');
  requireValue(/^[0-9a-f]{40}$/.test(protectedBaseSha ?? ''), 'exact protected base revision required');
  requireValue(/^[0-9a-f]{64}$/.test(environmentDigest ?? ''), 'environment digest required');
  requireValue(Array.isArray(requiredGroups) && requiredGroups.length > 0 && requiredGroups.every((g) => typeof g === 'string'), 'nonempty required groups');
  const registry = structuredClone(protectedRegistry);
  requireValue(registry?.schemaVersion === 1 && Array.isArray(registry.specs) && registry.specs.length, 'protected ownership registry');
  const catalog = validateVerificationCatalog(registry.catalog).groups;
  const protectedRegistryDigest = digest(registry);
  requireValue(registry.executionContract?.reviewDischargedByMachinePass === false, 'machine/review separation');
  requireValue(registry.executionContract?.canonicalMachineOwnerPerSpec === true, 'canonical ownership policy');
  requireValue(registry.reviewContract?.missingOrDisabledCapture === 'fail' && same(registry.reviewContract.requiredBindings, BINDINGS), 'review evidence policy');
  const rows = new Map();
  const frames = new Set();
  for (const row of registry.specs) {
    requireValue(SPEC.test(row.spec) && !rows.has(row.spec), 'unsafe or duplicate spec');
    rows.set(row.spec, row);
    requireValue(unique(row.machineGroups, 'machine owners').length === 1, `canonical owner for ${row.spec}`);
    unique(row.reviewGroups, 'review owners');
    const owner = catalog[row.machineGroups[0]];
    requireValue(owner?.evidence === 'machine-summary' && !owner.capabilities.visualReview && owner.specs.includes(row.spec), `machine owner for ${row.spec}`);
    const execution = row.execution;
    const project = row.spec.endsWith('mobile.spec.mjs') ? 'mobile-chromium' : 'desktop-chromium';
    requireValue(execution?.runtime === 'playwright' && execution.cwd === 'e2e' && execution.project === project, `runtime/cwd/project for ${row.spec}`);
    requireValue(same(execution.argv, ['npx', '--no-install', 'playwright', 'test', row.spec, `--project=${project}`]), `exact argv for ${row.spec}`);
    requireValue(typeof execution.browser === 'boolean' && execution.browser === owner.capabilities.browser, `browser requirement for ${row.spec}`);
    requireValue(execution.browser ? owner.projects.includes(project) : owner.projects.length === 0, `project placement for ${row.spec}`);
    requireValue(owner.resourceClass === row.resourceClass && owner.capabilities.dataCapability === row.minimumDataCapability, `resource/capability for ${row.spec}`);
    requireValue(owner.capabilities.hosted || owner.capabilities.specialistReason !== null, `executor placement for ${row.spec}`);
    requireValue(Array.isArray(row.requiredFrames), `frame inventory for ${row.spec}`);
    requireValue(row.reviewGroups.length === (row.requiredFrames.length ? 1 : 0), `frame review owner for ${row.spec}`);
    for (const frame of row.requiredFrames) {
      requireValue(typeof frame.frameId === 'string' && /^[a-z0-9][a-z0-9.-]+$/.test(frame.frameId) && !frames.has(frame.frameId), `unique frame for ${row.spec}`);
      frames.add(frame.frameId);
      requireValue(typeof frame.stableTestId === 'string' && frame.stableTestId.startsWith(`${project}::${row.spec}::`) && frame.stableTestId.length > `${project}::${row.spec}::`.length, `stable frame test for ${row.spec}`);
    }
    for (const reviewId of row.reviewGroups) {
      const group = catalog[reviewId];
      const review = registry.reviewGroups?.[reviewId];
      requireValue(group?.evidence === 'restricted-visual-review' && group.capabilities.visualReview && same(group.specs, [row.spec]), `review group ${reviewId}`);
      requireValue(same(group.capabilities, { ...owner.capabilities, visualReview: true }) && group.resourceClass === owner.resourceClass && same(group.projects, [project]), `review capability/project ${reviewId}`);
      requireValue(same(group.stableTestIds, [...new Set(row.requiredFrames.map((f) => f.stableTestId))]), `review stable tests ${reviewId}`);
      requireValue(review?.machineExecution === 'reuse-exact-spec-project-result' && same(review.dependsOnMachineGroups, row.machineGroups) && same(review.requiredFrames, row.requiredFrames), `review frames/dependency ${reviewId}`);
    }
  }
  for (const [id, group] of Object.entries(catalog)) {
    requireValue(group.specs.length > 0, `empty group ${id}`);
    requireValue(group.dependsOnGroups.length === 0, `unsupported catalog dependency ${id}`);
    for (const spec of group.specs) {
      const row = rows.get(spec);
      requireValue(row && [...row.machineGroups, ...row.reviewGroups].includes(id), `missing spec ownership ${id}:${spec}`);
    }
  }
  requireValue(same(Object.keys(registry.reviewGroups ?? {}).sort(), Object.keys(catalog).filter((id) => catalog[id].evidence === 'restricted-visual-review').sort()), 'review group inventory');
  const selected = new Set(requiredGroups);
  for (const id of selected) requireValue(Object.hasOwn(catalog, id), `unknown group ${id}`);
  // Only explicitly requested machine owners expand their applicable reviews.
  // An owner added to execute a review must not widen it to sibling frames.
  for (const id of new Set(requiredGroups)) {
    for (const spec of catalog[id].specs) {
      const row = rows.get(spec);
      for (const dependency of row.machineGroups) selected.add(dependency);
      if (catalog[id].evidence === 'machine-summary') for (const review of row.reviewGroups) selected.add(review);
    }
  }
  const machineGroups = [...selected].filter((id) => catalog[id].evidence === 'machine-summary').sort();
  const boundPublications = {};
  for (const capability of new Set(machineGroups.map((id) => catalog[id].capabilities.dataCapability))) {
    const publication = publicationIdentities?.[capability];
    requireValue(publication && typeof publication === 'object' && !Array.isArray(publication), `publication identity for ${capability}`);
    requireValue(same(Object.keys(publication).sort(), ['productRootDigest', 'publicationManifestDigest', 'sourceRepository', 'sourceRevision']), `publication identity fields for ${capability}`);
    for (const field of ['publicationManifestDigest', 'productRootDigest']) requireValue(/^sha256:[0-9a-f]{64}$/.test(publication[field] ?? ''), `${field} for ${capability}`);
    const absentFixtureSource = capability === 'qualification_fixture' && publication.sourceRepository === null && publication.sourceRevision === null;
    requireValue(absentFixtureSource || (typeof publication.sourceRepository === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(publication.sourceRepository) && /^[0-9a-f]{40}$/.test(publication.sourceRevision ?? '')), `immutable source identity for ${capability}`);
    boundPublications[capability] = structuredClone(publication);
  }
  const identityFor = (capability) => ({ atlasRevision, environmentDigest, protectedBaseSha, protectedRegistryDigest, dataCapability: capability, publication: structuredClone(boundPublications[capability]) });
  const commands = [];
  const partitions = { hostedPlaywright: [], specialistPlaywright: [] };
  for (const row of [...rows.values()].sort((a, b) => a.spec.localeCompare(b.spec))) {
    if (!selected.has(row.machineGroups[0])) continue;
    const group = catalog[row.machineGroups[0]];
    const identity = identityFor(row.minimumDataCapability);
    const executionKey = digest({ identity, spec: row.spec, project: row.execution.project });
    commands.push({ executionKey, identity, groupId: row.machineGroups[0], spec: row.spec, ...row.execution, dataCapability: row.minimumDataCapability, resourceClass: row.resourceClass, specialistReason: group.capabilities.specialistReason });
    partitions[group.capabilities.hosted ? 'hostedPlaywright' : 'specialistPlaywright'].push(executionKey);
  }
  const reviews = [...selected].filter((id) => catalog[id].evidence === 'restricted-visual-review').sort().map((groupId) => ({
    groupId, identity: identityFor(catalog[groupId].capabilities.dataCapability), evidence: 'restricted-visual-review', discharged: false,
    requiredFrames: registry.reviewGroups[groupId].requiredFrames,
    requiredBindings: [...BINDINGS],
    machineExecutionKeys: commands.filter((command) => catalog[groupId].specs.includes(command.spec)).map((command) => command.executionKey),
  }));
  requireValue(new Set(commands.map((c) => c.executionKey)).size === commands.length, 'duplicate machine execution');
  requireValue(machineGroups.every((id) => commands.some((c) => c.groupId === id)), 'machine group disappeared');
  requireValue(reviews.every((review) => review.requiredFrames.length && review.machineExecutionKeys.length), 'review evidence disappeared');
  return { schemaVersion: 1, atlasRevision, environmentDigest, protectedBaseSha, protectedRegistryDigest, publicationIdentities: boundPublications, requestedGroups: [...new Set(requiredGroups)].sort(), machineGroups, commands, partitions, reviews };
}
