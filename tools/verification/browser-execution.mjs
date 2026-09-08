import { createHash } from 'node:crypto';
import { verifySelectedGameplayProduct } from './shadow-gameplay-source.mjs';
import { authenticatePublicationProofs } from './proof-provenance.mjs';
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
const freeze = (value) => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const raw = (value, label) => { if (!(Buffer.isBuffer(value) || value instanceof Uint8Array)) throw new TypeError(`selected semantic source invalid: ${label} requires raw bytes`); return Buffer.from(value); };
const bytesDigest = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
export const R5_SEMANTIC_SOURCE = freeze({
  id: 'semanticSearchSource', repository: 'Oteryn/Oteryn-Game', revision: '54f19765c07e3b33ce2d9c10ad57df4818434a52',
  path: 'tools/game-atlas-semantic-search/fixtures/acceptance-source.json', blob: '5df1e399398635f64cc3afcab29ad5afa648ba25',
  digest: 'sha256:a101cfaf07b83affd2896e480a51898d609a445216190621b54b002667e83a88', bytes: 2577,
});
const R5_SEMANTIC_OUTPUTS = freeze([
  { path: 'web/semantic-search/index.json', digest: 'sha256:080518a6ef859b1e277f2305178faee8a76e22e247266f8950c1feb66d02a3e6', bytes: 3405 },
  { path: 'web/semantic-search/creatures.json', digest: 'sha256:668a6c85065beea9dd103dd47729e07f6afd4952b66fe9ea20557e62c104c4a6', bytes: 478872 },
]);

export function verifyR5SemanticProduct(value) {
  const keys = ['sourceBytes', ...R5_SEMANTIC_OUTPUTS.map(({ path }) => path)];
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(keys.sort())) throw new TypeError('selected semantic source invalid: byte census mismatch');
  const sourceBytes = raw(value.sourceBytes, 'source');
  const sourceBlob = createHash('sha1').update(`blob ${sourceBytes.length}\0`).update(sourceBytes).digest('hex');
  if (sourceBytes.length !== R5_SEMANTIC_SOURCE.bytes || bytesDigest(sourceBytes) !== R5_SEMANTIC_SOURCE.digest || sourceBlob !== R5_SEMANTIC_SOURCE.blob) throw new TypeError('selected semantic source invalid: source bytes do not match protected Game pin');
  const outputs = R5_SEMANTIC_OUTPUTS.map((pin) => {
    const bytes = raw(value[pin.path], pin.path);
    if (bytes.length !== pin.bytes || bytesDigest(bytes) !== pin.digest) throw new TypeError(`selected semantic source invalid: ${pin.path} output digest mismatch`);
    return pin;
  });
  return freeze({ schemaVersion: 1, contract: 'selected-semantic-search-v1', mapAuthority: false, completeWorld: false,
    dataCapability: 'bounded_real_world', scope: 'selected-semantic-browser', source: R5_SEMANTIC_SOURCE, outputs,
    authorityDigest: digest({ source: R5_SEMANTIC_SOURCE, outputs }) });
}

// The caller must load this registry and the expected publication authorities
// from authenticated protected-base code. This pure resolver does not authenticate
// a repository revision and accepts no candidate catalog, command or ownership overrides.
// It resolves obligations only: it neither executes tests nor activates routing.
export function resolveBrowserExecution({ protectedRegistry, requiredGroups, atlasRevision, environmentDigest, protectedBaseSha, publicationProofs, protectedExpectedAuthorities, selectedGameplayFiles, selectedSemanticFiles } = {}) {
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
    const project = execution?.project;
    requireValue(execution?.runtime === 'playwright' && execution.cwd === 'e2e' && ['desktop-chromium', 'mobile-chromium'].includes(project), `runtime/cwd/project for ${row.spec}`);
    requireValue(same(execution.argv, ['npx', '--no-install', 'playwright', 'test', row.spec, `--project=${project}`]), `exact argv for ${row.spec}`);
    requireValue(typeof execution.browser === 'boolean' && execution.browser === owner.capabilities.browser, `browser requirement for ${row.spec}`);
    requireValue(owner.executionEngine === 'playwright' ? owner.projects.includes(project) : (execution.browser ? owner.projects.includes(project) : owner.projects.length === 0), `project placement for ${row.spec}`);
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
    for (const spec of group.specs) {
      const row = rows.get(spec);
      requireValue(row && [...row.machineGroups, ...row.reviewGroups].includes(id), `missing spec ownership ${id}:${spec}`);
    }
    for (const dependencyId of group.dependsOnGroups) {
      const dependency = catalog[dependencyId];
      requireValue(group.evidence === 'machine-summary' && dependency?.evidence === 'restricted-visual-review', `unsafe catalog dependency ${id}:${dependencyId}`);
      requireValue(group.specs.some((spec) => rows.get(spec)?.reviewGroups.includes(dependencyId)), `dependency is not an actual row review owner ${id}:${dependencyId}`);
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
      if (catalog[id].evidence === 'restricted-visual-review') {
        requireValue(row.reviewGroups.includes(id), `review dependency owner ${id}:${spec}`);
        for (const dependency of row.machineGroups) selected.add(dependency);
      } else {
        requireValue(row.machineGroups.includes(id), `machine dependency owner ${id}:${spec}`);
        for (const review of row.reviewGroups) selected.add(review);
      }
    }
  }
  const machineGroups = [...selected].filter((id) => catalog[id].evidence === 'machine-summary').sort();
  const capabilities = [...new Set(machineGroups.map((id) => catalog[id].capabilities.dataCapability))].sort();
  // A selected derived gameplay product is authority only for this HTTP contract.
  // It is never a map/publication proof, even though both use bounded real data.
  let selectedGameplay;
  if (selectedGameplayFiles !== undefined) {
    requireValue(machineGroups.includes('integration.source-contract-http'), 'selected gameplay requires its HTTP owner');
    requireValue(machineGroups.filter(id => catalog[id].capabilities.dataCapability === 'bounded_real_world')
      .every(id => id === 'integration.source-contract-http'), 'selected gameplay cannot authorize another bounded group');
    const row = rows.get('e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs');
    requireValue(row?.execution.browser === false && row.execution.project === 'desktop-chromium'
      && same(row.machineGroups, ['integration.source-contract-http']) && row.reviewGroups.length === 0,
      'selected gameplay exact HTTP route');
    selectedGameplay = verifySelectedGameplayProduct(selectedGameplayFiles);
  }
  let selectedSemantic;
  if (selectedSemanticFiles !== undefined) {
    requireValue(machineGroups.includes('integration.source-contract-browser'), 'selected semantic source requires its browser owner');
    requireValue(machineGroups.filter(id => catalog[id].capabilities.dataCapability === 'bounded_real_world')
      .every(id => id === 'integration.source-contract-browser'), 'selected semantic source cannot authorize another bounded group');
    const row = rows.get('e2e/tests/api-contract-desktop.spec.mjs');
    requireValue(row?.execution.browser === true && row.execution.project === 'desktop-chromium'
      && same(row.machineGroups, ['integration.source-contract-browser']) && row.reviewGroups.length === 0,
      'selected semantic exact browser route');
    selectedSemantic = verifyR5SemanticProduct(selectedSemanticFiles);
  }
  requireValue(!(selectedGameplay && selectedSemantic), 'bounded selected source proofs cannot overlap');
  const selectedProofs = {};
  const selectedAuthorities = {};
  for (const capability of capabilities) {
    if (capability === 'bounded_real_world' && (selectedGameplay || selectedSemantic)) continue;
    requireValue(publicationProofs?.[capability] != null, `raw publication proof for ${capability}`);
    requireValue(protectedExpectedAuthorities?.[capability] != null, `protected expected authority for ${capability}`);
    selectedProofs[capability] = publicationProofs[capability];
    selectedAuthorities[capability] = protectedExpectedAuthorities[capability];
  }
  let authentication;
  try {
    authentication = Object.keys(selectedProofs).length ? authenticatePublicationProofs({ publicationProofs: selectedProofs, protectedExpectedAuthorities: selectedAuthorities, protectedBaseSha }) : { authenticatedPublicationIdentities: {}, trustReceiptDigest: null };
  } catch (error) {
    throw new TypeError(`browser execution unresolved: publication authentication failed: ${error.message}`);
  }
  const boundPublications = structuredClone(authentication.authenticatedPublicationIdentities);
  if (selectedGameplay) {
    boundPublications.bounded_real_world = { kind: 'game-producer-derived-selected-gameplay',
      ...selectedGameplay, protectedBaseSha, trustReceiptDigest: digest({ protectedBaseSha, selectedGameplay }) };
    authentication = { ...authentication, trustReceiptDigest: digest({ publication: authentication.trustReceiptDigest,
      selectedGameplay: boundPublications.bounded_real_world.trustReceiptDigest }) };
  }
  if (selectedSemantic) {
    boundPublications.bounded_real_world = { kind: 'game-source-derived-selected-semantic-search',
      ...selectedSemantic, protectedBaseSha, trustReceiptDigest: digest({ protectedBaseSha, selectedSemantic }) };
    authentication = { ...authentication, trustReceiptDigest: digest({ publication: authentication.trustReceiptDigest,
      selectedSemantic: boundPublications.bounded_real_world.trustReceiptDigest }) };
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
  return { schemaVersion: 1, atlasRevision, environmentDigest, protectedBaseSha, protectedRegistryDigest, publicationTrustReceiptDigest: authentication.trustReceiptDigest, authenticatedPublicationIdentities: boundPublications, requestedGroups: [...new Set(requiredGroups)].sort(), machineGroups, commands, partitions, reviews };
}
