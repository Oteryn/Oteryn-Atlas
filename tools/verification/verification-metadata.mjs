// Pure projections of authenticated canonical metadata. Callers own provenance
// checks; this module neither loads candidate policy nor executes test commands.
export function deriveVerificationMetadata(canonicalCatalog) {
  const catalog = structuredClone(canonicalCatalog);
  const policy = catalog?.executionPolicy;
  if (catalog?.schemaVersion !== 2 || policy?.schemaVersion !== 1 || !catalog.groups
    || !Array.isArray(policy.browser?.specs) || !Array.isArray(policy.deterministic?.entries)) {
    throw new Error('unsupported canonical verification metadata');
  }
  const groups = catalog.groups;
  const entries = Object.entries(groups);
  const owner = (spec, role) => {
    const matches = entries.filter(([, group]) => group.executionRole === role && group.specs.includes(spec));
    if (matches.length !== 1) throw new Error(`exactly one ${role} owner required: ${spec}`);
    return matches[0];
  };
  const browserGroups = Object.fromEntries(entries.filter(([id, group]) =>
    group.executionEngine === 'playwright' && ['canonical-machine', 'canonical-review'].includes(group.executionRole)));
  const browser = { schemaVersion: 1, baselineRevision: policy.baselineRevision, ...policy.browser,
    catalog: { schemaVersion: 2, groups: browserGroups }, reviewGroups: {} };
  const seen = new Set();
  browser.specs = policy.browser.specs.map(row => {
    if (seen.has(row.spec)) throw new Error(`duplicate canonical spec: ${row.spec}`);
    seen.add(row.spec);
    const [id, group] = owner(row.spec, 'canonical-machine');
    const reviews = entries.filter(([, candidate]) => candidate.executionRole === 'canonical-review' && candidate.specs.includes(row.spec));
    if (!Array.isArray(row.requiredFrames) || reviews.length !== (row.requiredFrames.length ? 1 : 0)) throw new Error(`exact frame review ownership required: ${row.spec}`);
    for (const [reviewId, reviewGroup] of reviews) {
      reviewGroup.stableTestIds = [...new Set(row.requiredFrames.map(frame => frame.stableTestId))];
      browser.reviewGroups[reviewId] = { requiredFrames: structuredClone(row.requiredFrames), machineExecution: 'reuse-exact-spec-project-result', dependsOnMachineGroups: [id] };
    }
    const { project, capabilityRationaleId, ...facts } = row;
    const capabilityRationale = policy.browser.capabilityRationales?.[capabilityRationaleId];
    if (typeof capabilityRationale !== 'string' || !capabilityRationale) throw new Error(`missing capability rationale: ${row.spec}`);
    return { ...facts, capabilityRationale, machineGroups: [id], reviewGroups: reviews.map(([reviewId]) => reviewId),
      minimumDataCapability: group.capabilities.dataCapability, resourceClass: group.resourceClass,
      execution: { runtime: 'playwright', cwd: 'e2e', argv: ['npx', '--no-install', 'playwright', 'test', row.spec, `--project=${project}`], project, browser: group.capabilities.browser } };
  });
  delete browser.capabilityRationales;
  for (const [id, group] of Object.entries(browserGroups)) {
    if (!group.specs.length || group.specs.some(spec => !seen.has(spec))) throw new Error(`missing canonical browser metadata: ${id}`);
  }
  const contracts = { schemaVersion: 1, baselineRevision: policy.baselineRevision, ...policy.contracts, contracts: [] };
  const deterministic = { schemaVersion: 1, baselineRevision: policy.baselineRevision, ...policy.deterministic,
    entries: [], importAggregators: [], proposedCatalog: { schemaVersion: 2, groups: Object.fromEntries(entries.filter(([id, group]) => id.startsWith('deterministic.') && group.executionRole === 'canonical-machine')) } };
  for (const row of policy.deterministic.entries) {
    if (seen.has(row.spec)) throw new Error(`duplicate canonical spec: ${row.spec}`);
    seen.add(row.spec);
    const { contract, ...facts } = row;
    let group;
    if (contract) {
      const core = groups['deterministic.core'];
      if (!core || !['aggregate', 'canonical-machine'].includes(core.executionRole)
        || !(core.specs.includes(row.spec) || core.specs.includes('tests/verification/*.test.mjs'))
        || !row.spec.startsWith('tests/verification/')) throw new Error(`missing canonical contract owner: ${row.spec}`);
      if (entries.some(([id, candidate]) => id !== 'deterministic.core' && candidate.executionRole === 'canonical-machine' && candidate.specs.includes(row.spec))) throw new Error(`exactly one canonical contract owner required: ${row.spec}`);
      group = 'deterministic.core';
      contracts.contracts.push({ path: row.spec, owner: group, qualification: row.qualification, ...contract });
    } else {
      [group] = owner(row.spec, 'canonical-machine');
    }
    (contract ? deterministic.importAggregators : deterministic.entries).push({ ...facts, group });
  }
  contracts.proposedCoreSpecs = contracts.contracts.filter(row => row.status === 'active-semantic').map(row => row.path).sort();
  contracts.unresolvedContracts = contracts.contracts.filter(row => row.status !== 'active-semantic').map(row => row.path).sort();
  // Preserve canonical execution selection exactly. A historical wildcard
  // remains unresolvable until the owner replaces it with reviewed exact specs;
  // disposition accounting must never silently remove execution obligations.
  deterministic.proposedCatalog.groups['deterministic.core'] = { ...groups['deterministic.core'] };
  for (const [id, group] of Object.entries(deterministic.proposedCatalog.groups)) {
    if (group.specs.some(spec => !(id === 'deterministic.core' && spec === 'tests/verification/*.test.mjs') && !seen.has(spec))) throw new Error(`missing canonical deterministic metadata: ${id}`);
  }
  return { browser, deterministic, contracts };
}
