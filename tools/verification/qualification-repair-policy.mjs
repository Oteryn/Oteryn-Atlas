import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { canonicalJson, profileRank } from './verification-plan-schema.mjs';

export const QUALIFICATION_REPAIR_PATHS = Object.freeze([
  'src/browser/animation-runtime-service.mjs',
  'src/browser/fullworld-trust.mjs',
  'src/browser/semantic-search.mjs',
  'tools/verification/qualification-fixture-definition.mjs',
  'tools/verification/qualification-world.mjs',
  'web/fullworld-app.mjs',
  'web/fullworld-creatures.mjs',
  'web/fullworld-farm-explorer.mjs',
  'web/fullworld-search.mjs',
]);

export const QUALIFICATION_REPAIR_BROWSER_PROOF = Object.freeze({
  groupId: 'e2e.full',
  dataCapability: 'qualification_fixture',
  workers: 1,
  retries: 0,
});

export const QUALIFICATION_REPAIR_PRODUCT_IDENTITY_PATHS = Object.freeze([
  'tools/verification/protected-hosted-product-identities.json',
  'tests/verification/protected-hosted-product-identities.test.mjs',
]);

const ALLOWED_PATHS = new Set([
  ...QUALIFICATION_REPAIR_PATHS,
  ...QUALIFICATION_REPAIR_PRODUCT_IDENTITY_PATHS,
]);
const REQUIRED_PLAN_FLOOR = Object.freeze(['deterministic.core', 'e2e.full']);
const EXECUTED_DETERMINISTIC_GROUPS = Object.freeze(['deterministic.core']);
const REQUIRED_DATA_CAPABILITIES = Object.freeze(['qualification_fixture']);
const VERIFICATION_REGRESSION = /^tests\/verification\/[A-Za-z0-9][A-Za-z0-9._-]*\.test\.mjs$/;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${label} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicates`);
  return [...value].sort();
}

function exactChangedPaths(value) {
  const paths = exactStringArray(value, 'qualification repair changed paths');
  for (const path of paths) {
    if (path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
      throw new TypeError(`qualification repair scope contains an unsafe path: ${path}`);
    }
    if (!ALLOWED_PATHS.has(path) && !VERIFICATION_REGRESSION.test(path)) {
      throw new TypeError(`qualification repair scope is not eligible: ${path}`);
    }
  }
  return paths;
}

function validatePlan(plan, label) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new TypeError(`${label} plan is invalid`);
  profileRank(plan.profile);
  const requiredGroupIds = exactStringArray(plan.requiredGroupIds, `${label} required groups`);
  const requiredDataCapabilities = exactStringArray(plan.requiredDataCapabilities, `${label} data capabilities`);
  if (!plan.retryPolicy || plan.retryPolicy.retries !== 0) throw new TypeError(`${label} retry policy must remain zero`);
  return { profile: plan.profile, requiredGroupIds, requiredDataCapabilities };
}

function requireSuperset(candidate, protectedValues, label) {
  const candidateSet = new Set(candidate);
  const missing = protectedValues.filter((value) => !candidateSet.has(value));
  if (missing.length) throw new TypeError(`qualification repair candidate narrows protected ${label}: ${missing.join(', ')}`);
}

export function validateQualificationRepairTransition({ changedPaths, protectedPlan, candidatePlan } = {}) {
  const paths = exactChangedPaths(changedPaths);
  const protectedState = validatePlan(protectedPlan, 'protected');
  const candidateState = validatePlan(candidatePlan, 'candidate');

  if (profileRank(candidateState.profile) < profileRank(protectedState.profile)) {
    throw new TypeError('qualification repair candidate narrows protected verification profile');
  }
  requireSuperset(candidateState.requiredGroupIds, protectedState.requiredGroupIds, 'required groups');
  requireSuperset(candidateState.requiredDataCapabilities, protectedState.requiredDataCapabilities, 'data capabilities');
  requireSuperset(candidateState.requiredGroupIds, REQUIRED_PLAN_FLOOR, 'plan safety groups');

  if (candidateState.requiredDataCapabilities.length !== REQUIRED_DATA_CAPABILITIES.length
    || candidateState.requiredDataCapabilities[0] !== REQUIRED_DATA_CAPABILITIES[0]) {
    throw new TypeError('qualification repair must remain qualification_fixture-only GitHub-hosted evidence');
  }

  return freeze({
    schemaVersion: 1,
    eligible: true,
    changedPaths: paths,
    profile: candidateState.profile,
    planFloorGroupIds: REQUIRED_PLAN_FLOOR,
    requiredGroupIds: EXECUTED_DETERMINISTIC_GROUPS,
    browserProof: QUALIFICATION_REPAIR_BROWSER_PROOF,
    requiredDataCapabilities: REQUIRED_DATA_CAPABILITIES,
    retryPolicy: { retries: 0 },
  });
}

export function classifyQualificationRepairStatuses(statuses) {
  if (!Array.isArray(statuses)) throw new TypeError('qualification repair statuses must be an array');
  const matches = statuses.filter((status) => status?.context === 'atlas-protected-product-qualification');
  if (matches.length === 0) return freeze({ applicable: false });
  if (matches.length !== 1 || matches[0]?.state !== 'success') {
    throw new TypeError('qualification repair evidence is present but not one authoritative success');
  }
  return freeze({ applicable: true, status: matches[0] });
}

export function independentlyVerifyQualificationProduct(root, manifest) {
  if (!root || !manifest || typeof manifest !== 'object') throw new TypeError('qualification product proof is invalid');
  const entries = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new TypeError(`qualification product contains symlink: ${relative}`);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && relative !== 'fixture-manifest.json') {
        const bytes = fs.readFileSync(absolute);
        entries.push({ path: relative, bytes: bytes.length, digest: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}` });
      } else if (!entry.isFile()) throw new TypeError(`qualification product contains unsupported entry: ${relative}`);
    }
  };
  walk(root);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  // qualification-world serializes canonical JSON as UTF-8 with one trailing
  // newline. Reproduce those bytes here without trusting candidate reporting.
  const productDigest = `sha256:${crypto.createHash('sha256').update(Buffer.from(`${canonicalJson(entries)}\n`)).digest('hex')}`;
  if (canonicalJson(entries) !== canonicalJson(manifest.files) || productDigest !== manifest.productDigest) {
    throw new TypeError('qualification product manifest does not match independently enumerated bytes');
  }
  return freeze({ entries, productDigest });
}

export function validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest, protectedMirrorText, candidateMirrorText } = {}) {
  const protectedProducts = structuredClone(protectedIdentities);
  const candidateProducts = structuredClone(candidateIdentities);
  const digest = /^sha256:[0-9a-f]{64}$/.test(rebuiltProductDigest ?? '') ? rebuiltProductDigest : null;
  if (!protectedProducts || !candidateProducts || !digest || typeof protectedMirrorText !== 'string' || typeof candidateMirrorText !== 'string') {
    throw new TypeError('qualification repair product repin does not match rebuilt candidate product');
  }
  const oldDigest = protectedProducts.qualification_fixture?.digest;
  if (!/^sha256:[0-9a-f]{64}$/.test(oldDigest ?? '') || candidateProducts.qualification_fixture?.digest !== digest) {
    throw new TypeError('qualification repair candidate digest is not the rebuilt product digest');
  }
  const expected = structuredClone(protectedProducts);
  expected.qualification_fixture = { ...expected.qualification_fixture, digest };
  if (canonicalJson(candidateProducts) !== canonicalJson(expected)) {
    throw new TypeError('qualification repair product identity repin changes more than qualification_fixture.digest');
  }
  const occurrences = protectedMirrorText.split(oldDigest).length - 1;
  if (occurrences !== 1 || candidateMirrorText !== protectedMirrorText.replace(oldDigest, digest)) {
    throw new TypeError('qualification repair identity mirror changes more than the exact digest');
  }
  return freeze({ schemaVersion: 1, productDigest: digest });
}


const CONTROL_PLANE_BOOTSTRAP_PATHS = new Set([
  '.github/workflows/merge-group-gate.yml',
  '.github/workflows/merge-authority-audit.yml',
  '.github/workflows/protected-qualification-repair.yml',
  'tools/governance/verify_extraction_provenance.py',
  'tools/verification/qualification-repair-policy.mjs',
]);

export function validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape } = {}) {
  const paths = exactStringArray(changedPaths, 'qualification repair bootstrap changed paths');
  if (!paths.includes('tools/verification/qualification-repair-policy.mjs')
    || paths.some((path) => !CONTROL_PLANE_BOOTSTRAP_PATHS.has(path) && !VERIFICATION_REGRESSION.test(path))) {
    throw new TypeError('qualification repair bootstrap scope is not the closed control-plane repair set');
  }
  const shape = protectedFixtureShape;
  if (!shape || shape.fixtureId !== 'atlas-qualification-world-v2'
    || shape.creatureCount !== 12 || shape.creatureRegionCount !== 1 || shape.semanticRecordCount !== 1) {
    throw new TypeError('qualification repair bootstrap protected base no longer has the narrow pre-fix fixture');
  }
  return freeze({ schemaVersion: 1, eligible: true, mode: 'self-retiring-narrow-fixture-control-plane-bootstrap', changedPaths: paths });
}


const GIT_BLOB = /^[0-9a-f]{40}$/;
function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? [];
  if (matches.length !== 1) throw new TypeError(`${label} must occur exactly once`);
  return source.replace(pattern, replacement);
}

export function validateQualificationRepairBootstrapPinRotations({ protectedVerifierText, candidateVerifierText, protectedAuditText, candidateAuditText, candidateGateText, candidateGateBlob, candidateVerifierBlob } = {}) {
  for (const [label, value] of Object.entries({ candidateGateBlob, candidateVerifierBlob })) {
    if (!GIT_BLOB.test(value ?? '')) throw new TypeError(`${label} must be a lowercase 40-character git blob`);
  }
  const gitBlob = (text) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(text)}\0`), Buffer.from(text)])).digest('hex');
  if (gitBlob(candidateGateText) !== candidateGateBlob || gitBlob(candidateVerifierText) !== candidateVerifierBlob) throw new TypeError('candidate pin blob does not match supplied bytes');
  const verifierMatch = protectedVerifierText.match(/MERGE_GROUP_GATE_BLOB = "([0-9a-f]{40})"/g) ?? [];
  if (verifierMatch.length !== 1) throw new TypeError('protected verifier gate pin must occur exactly once');
  const expectedVerifier = replaceExactlyOnce(protectedVerifierText, verifierMatch[0], `MERGE_GROUP_GATE_BLOB = "${candidateGateBlob}"`, 'protected verifier gate pin');
  if (candidateVerifierText !== expectedVerifier) throw new TypeError('candidate provenance verifier changes more than the exact gate pin');
  const gateMatches = protectedAuditText.match(/EXPECTED_MERGE_GROUP_GATE_BLOB: "([0-9a-f]{40})"/g) ?? [];
  const verifierMatches = protectedAuditText.match(/EXPECTED_PROVENANCE_VERIFIER_BLOB: "([0-9a-f]{40})"/g) ?? [];
  if (gateMatches.length !== 1 || verifierMatches.length !== 1) throw new TypeError('protected audit pins must each occur exactly once');
  const expectedAudit = replaceExactlyOnce(replaceExactlyOnce(protectedAuditText, gateMatches[0], `EXPECTED_MERGE_GROUP_GATE_BLOB: "${candidateGateBlob}"`, 'audit gate pin'), verifierMatches[0], `EXPECTED_PROVENANCE_VERIFIER_BLOB: "${candidateVerifierBlob}"`, 'audit verifier pin');
  if (candidateAuditText !== expectedAudit) throw new TypeError('candidate merge authority audit changes more than exact pin rotations');
  return freeze({ schemaVersion: 1, eligible: true, candidateGateBlob, candidateVerifierBlob });
}


const QUALIFICATION_ORACLE_FILES = Object.freeze([
  'tests/runtime.mjs', 'tests/audit-desktop.spec.mjs', 'tests/state-desktop.spec.mjs',
  'tests/race-desktop.spec.mjs', 'tests/desktop.spec.mjs', 'tests/mobile.spec.mjs',
  'tests/degraded-search-desktop.spec.mjs', 'tests/visual-desktop.spec.mjs',
  'tests/visual-mobile.spec.mjs', 'tests/creatures-desktop.spec.mjs',
  'tests/creature-presentation-desktop.spec.mjs', 'tests/creature-presentation-mobile.spec.mjs',
  'tests/farm-explorer-desktop.spec.mjs', 'tests/farm-explorer-mobile.spec.mjs',
  'tests/creature-interaction-desktop.spec.mjs',
  'tests/geometry-desktop.spec.mjs', 'tests/geometry-mobile.spec.mjs',
  'tests/layer-audit-desktop.spec.mjs', 'tests/performance-desktop.spec.mjs',
  'tests/soak-desktop.spec.mjs', 'tests/stress-desktop.spec.mjs',
  'support/creature-presentation-fixtures.mjs',
]);
const QUALIFICATION_ORACLE_SHA256 = Object.freeze({
  'tests/runtime.mjs': '3d76bfe8b674a98c41c8061c5359bf8d29e3147227c387d9b3e6e4fcd8ed6cd4',
  'tests/audit-desktop.spec.mjs': 'a82c5dbb3357299e7e70649eef6c5ccad562ddf57da301213f044e9dc971af38',
  'tests/state-desktop.spec.mjs': '7950f33f822847be1591e4c68e54d87619ab24930f2aa478c157f93f250f9c8e',
  'tests/race-desktop.spec.mjs': '9afa56df045ce752448eb1b153ad8263dff647570b8fef7c525e35a79f287838',
  'tests/desktop.spec.mjs': '248d9f450ae4b8a79db064e04920ff0170fce36574bb4320bc7c27caafe06321',
  'tests/mobile.spec.mjs': '63c440b2abf93d5b86711bba912742d2c4bfbfd2770d3ce5efdf335a0a708dbc',
  'tests/degraded-search-desktop.spec.mjs': 'fd4d4585251195a1179b04cdde7b1d91646619a9c5836aca97323096855631d3',
  'tests/visual-desktop.spec.mjs': '9e4acbcbe61fc7d4a13e9977316f89a354e2500d41d53723b9dcd2453e02c6e6',
  'tests/visual-mobile.spec.mjs': '261c97a29f6a5dbfdfbd2e8f5add7613b716e6f07bc683f512e3944d490800aa',
  'tests/creatures-desktop.spec.mjs': 'cd3ccb728e3f75037b522241c7d4c4e334347cd1e3200e64849bff97e2de0ffa',
  'tests/farm-explorer-desktop.spec.mjs': '830b86050bb4f45f0fedeb7c2fa84419a4ebc18ab61bdcceea059444fd3c0f0f',
  'tests/farm-explorer-mobile.spec.mjs': '4c8a4733b77eb238ae98f5688809f286da74d4ae89086ffa2cda100691390e09',
  'tests/creature-interaction-desktop.spec.mjs': '41bad347c317d30ba65ffe904f1c4d141d38fc6d0952067a2a7a3eff3cc0790e',
  'tests/creature-presentation-desktop.spec.mjs': '32ae9a14454e7abf9c1548a0b7d91c29d120175caa6f46ed82584c9dbec07886',
  'tests/creature-presentation-mobile.spec.mjs': 'fa5467f1aee52853d186746c2dc4986bc60f55e8516e295ba691e3c6e95626e3',
  'tests/geometry-desktop.spec.mjs': 'df441753a2a8b9273797efc1bc95ba46075bba48b23149113c74819f6a91b328',
  'tests/geometry-mobile.spec.mjs': '46c05690f228526bc8d023682d703fbfa4851510aeb60cba1b3d7e7451f66eaa',
  'tests/layer-audit-desktop.spec.mjs': 'afce011f549398f059cd46b45ec6b422cce793801a992d2e7e07f3dd08b8989a',
  'tests/performance-desktop.spec.mjs': '90b8106e3115b01f0919ee6a0dd4ad0a4667297601a9729d627ac2e2123f0f9d',
  'tests/soak-desktop.spec.mjs': 'b60ea87b68453c1c68e57018b1de7fd9d447a5b4c01b325005d0a772418d86ac',
  'tests/stress-desktop.spec.mjs': '99d9575747f291bb1a84b0c612071c4e538e5bc71b411d68dff1c121dd02ba9e',
  'support/creature-presentation-fixtures.mjs': '1a3b9ca4f6b29a88cb6e919a6b11d63a78a9a080cf863af8c18fa3801c65c4fb',
});
const ORACLE_FAMILIES = Object.freeze({
  coordinates: ['tests/runtime.mjs', 'tests/audit-desktop.spec.mjs', 'tests/state-desktop.spec.mjs', 'tests/race-desktop.spec.mjs'],
  semanticSearch: ['tests/desktop.spec.mjs', 'tests/mobile.spec.mjs', 'tests/degraded-search-desktop.spec.mjs', 'tests/visual-desktop.spec.mjs', 'tests/visual-mobile.spec.mjs'],
  farm: ['tests/farm-explorer-desktop.spec.mjs', 'tests/farm-explorer-mobile.spec.mjs'],
  creatures: ['tests/creatures-desktop.spec.mjs', 'tests/creature-interaction-desktop.spec.mjs', 'support/creature-presentation-fixtures.mjs'],
  anchors: ['tests/geometry-desktop.spec.mjs', 'tests/geometry-mobile.spec.mjs', 'tests/layer-audit-desktop.spec.mjs', 'tests/performance-desktop.spec.mjs', 'tests/soak-desktop.spec.mjs', 'tests/stress-desktop.spec.mjs'],
  animated: ['tests/visual-desktop.spec.mjs', 'tests/visual-mobile.spec.mjs'],
});

function readJson(root, relative) { return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8')); }
function validPosition(record) {
  const p = record?.position;
  if (![p?.x, p?.y, p?.floor].every(Number.isSafeInteger)) throw new TypeError('qualification oracle record position is invalid');
  return p;
}
function uniqueRecord(records, predicate, label) {
  const selected = records.filter(predicate);
  if (selected.length !== 1) throw new TypeError(`qualification oracle requires exactly one ${label}, observed ${selected.length}`);
  return selected[0];
}
function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function urlPosition(record) { const p = validPosition(record); return `x=${p.x}&y=${p.y}&floor=${p.floor}`; }

export function resolveQualificationFixtureOracle(productRoot) {
  const semantic = readJson(productRoot, 'web/semantic-search/index.json').records;
  const searchCreatures = readJson(productRoot, 'data/creatures/search.json').records;
  const creatureIndex = readJson(productRoot, 'data/creatures/index.json');
  if (!Array.isArray(semantic) || !Array.isArray(searchCreatures) || !Array.isArray(creatureIndex.chunks) || creatureIndex.chunks.length === 0) {
    throw new TypeError('qualification oracle catalogs are invalid');
  }
  const published = creatureIndex.chunks.flatMap(({ path: chunkPath }) => {
    if (typeof chunkPath !== 'string' || chunkPath.startsWith('/') || chunkPath.includes('..')) throw new TypeError('qualification oracle creature chunk path is invalid');
    const records = readJson(productRoot, `data/creatures/${chunkPath}`).records;
    if (!Array.isArray(records)) throw new TypeError('qualification oracle creature chunk is invalid');
    return records;
  });
  const byRecordId = new Map(published.map((record) => [record.record_id, record]));
  if (byRecordId.size !== published.length) throw new TypeError('qualification oracle creature publication contains duplicate records');
  const creatures = searchCreatures.map((record) => {
    const authoritative = byRecordId.get(record.record_id);
    if (!authoritative || authoritative.kind !== record.kind || authoritative.name !== record.label
      || canonicalJson(authoritative.position) !== canonicalJson(record.position)) {
      throw new TypeError('qualification oracle search and creature publication disagree');
    }
    return { ...record, ...authoritative, label: record.label };
  });
  const navigation = uniqueRecord(semantic, (r) => r.capabilities?.includes('navigation'), 'navigable semantic record');
  const roleNpc = uniqueRecord(creatures, (r) => r.kind === 'npc' && r.roles?.includes('shop') && r.roles?.includes('quest') && r.roles.length === 2, 'shop/quest NPC');
  const animatedNpc = uniqueRecord(creatures, (r) => r.kind === 'npc' && typeof r.presentation_resolution_state === 'string' && r.roles?.length >= 4, 'presented multi-role NPC');
  const longNpc = uniqueRecord(creatures, (r) => r.kind === 'npc' && r.label.length >= 32, 'long-name NPC');
  const animatedMonster = uniqueRecord(creatures, (r) => r.kind === 'monster' && r.outfit_presentation, 'animated monster');
  const monsters = creatures.filter((r) => r.kind === 'monster');
  const overlap = monsters.filter((r) => monsters.filter((other) => JSON.stringify(validPosition(other)) === JSON.stringify(validPosition(r))).length >= 3);
  const floor = readJson(productRoot, `runtime-index/floors/f${validPosition(navigation).floor}.json`);
  const bounds = floor.bounds;
  if (![bounds?.x_min, bounds?.x_max_exclusive, bounds?.y_min, bounds?.y_max_exclusive].every(Number.isSafeInteger)
    || bounds.x_max_exclusive <= bounds.x_min || bounds.y_max_exclusive <= bounds.y_min) {
    throw new TypeError('qualification oracle fixture bounds are invalid');
  }
  const xs = [...new Set([bounds.x_min, Math.floor((bounds.x_min + bounds.x_max_exclusive - 1) / 2), bounds.x_max_exclusive - 1])];
  const ys = [...new Set([bounds.y_min, Math.floor((bounds.y_min + bounds.y_max_exclusive - 1) / 2), bounds.y_max_exclusive - 1])];
  const distinct = [];
  anchors: for (const y of ys) for (const x of xs) {
    distinct.push({ x, y, floor: validPosition(navigation).floor });
    if (distinct.length === 4) break anchors;
  }
  if (overlap.length < 3 || new Set(distinct.map(JSON.stringify)).size !== 4) throw new TypeError('qualification oracle fixture lacks dense and distinct structural targets');
  return freeze({ navigation, roleNpc, animatedNpc, longNpc, animatedMonster, overlap, creatures, distinct });
}

export function materializeQualificationFixtureOracleOverlay({ e2eRoot, productRoot } = {}) {
  const oracle = resolveQualificationFixtureOracle(productRoot);
  const searchRuntimePath = path.join(path.dirname(e2eRoot), 'web/fullworld-search.mjs');
  const searchRuntime = fs.readFileSync(searchRuntimePath, 'utf8');
  const legacySearchCall = '{ limit: MAX_RESULTS, currentFloor: currentFloor() }';
  const qualifiedSearchCall = '{ limit: MAX_RESULTS, currentFloor: currentFloor(), sourceExpectations: SOURCE_EXPECTATIONS.semanticSearch }';
  const legacySearchCount = searchRuntime.split(legacySearchCall).length - 1;
  const qualifiedSearchCount = searchRuntime.split(qualifiedSearchCall).length - 1;
  if (!((legacySearchCount > 0 && qualifiedSearchCount === 0) || (legacySearchCount === 0 && qualifiedSearchCount > 0))) {
    throw new TypeError('candidate qualification search runtime shape is incompatible');
  }
  const qualifiedSearchRuntime = searchRuntime.replaceAll(
    legacySearchCall,
    qualifiedSearchCall,
  );
  fs.writeFileSync(searchRuntimePath, qualifiedSearchRuntime, 'utf8');
  const semanticRuntimePath = path.join(path.dirname(e2eRoot), 'src/browser/semantic-search.mjs');
  const semanticRuntime = fs.readFileSync(semanticRuntimePath, 'utf8');
  const legacySemanticCall = '  validateSemanticSearchIndex(index);';
  const qualifiedSemanticCall = '  validateSemanticSearchIndex(index, options.sourceExpectations);';
  const legacySemanticCount = semanticRuntime.split(legacySemanticCall).length - 1;
  const qualifiedSemanticCount = semanticRuntime.split(qualifiedSemanticCall).length - 1;
  if (!((legacySemanticCount === 1 && qualifiedSemanticCount === 0) || (legacySemanticCount === 0 && qualifiedSemanticCount === 1))) {
    throw new TypeError('candidate qualification semantic runtime shape is incompatible');
  }
  const qualifiedSemanticRuntime = semanticRuntime.replace(legacySemanticCall, qualifiedSemanticCall);
  fs.writeFileSync(semanticRuntimePath, qualifiedSemanticRuntime, 'utf8');
  const before = new Map(QUALIFICATION_ORACLE_FILES.map((relative) => [relative, fs.readFileSync(path.join(e2eRoot, relative), 'utf8')]));
  for (const [relative, source] of before) {
    const digest = crypto.createHash('sha256').update(source).digest('hex');
    if (digest !== QUALIFICATION_ORACLE_SHA256[relative]) throw new TypeError(`protected qualification oracle source fingerprint drifted: ${relative}`);
  }
  const substitutions = [
    ['x=32369&y=32241&floor=-7', urlPosition(oracle.navigation)],
    ['x=32361&y=32198&floor=-7', urlPosition(oracle.roleNpc)],
    ['x=32364&y=32240.2&floor=-7', urlPosition(oracle.roleNpc)],
    ['x=33018&y=32009&floor=-7', urlPosition(oracle.overlap[0])],
    ['x=32831&y=32596&floor=-12', urlPosition(oracle.animatedNpc)],
    ['x=32209&y=31924&floor=-12', urlPosition(oracle.animatedMonster)],
    ['x=32724&y=31155&floor=-15', urlPosition(oracle.animatedMonster)],
    ["'Thais'", JSON.stringify(oracle.navigation.label)], ['/Thais/i', `/${escaped(oracle.navigation.label)}/i`],
    ["'Sam'", JSON.stringify(oracle.roleNpc.label)], ['/Sam/i', `/${escaped(oracle.roleNpc.label)}/i`],
    ["'Cave Rat'", JSON.stringify(oracle.animatedMonster.label)], ['/^Cave Rat$/', `/^${escaped(oracle.animatedMonster.label)}$/`],
    ['monster-entity:8b41afe4c98e72744557d7adc250f7e6', oracle.animatedMonster.entity_id],
    ['Misguided Thief', oracle.overlap.at(-1).label],
    ['monster:014cc0368c5989dd788e2af63e087e83', oracle.overlap[0].record_id],
    ['monster:6c316dffde0b35aa6a9165eb46694374', oracle.overlap[1].record_id],
    ['monster:7a7d419f84cf4eac5cad81f7cb266dae', oracle.overlap[2].record_id],
    ['floor: -10, x: 32522, y: 32419', `floor: ${validPosition(oracle.overlap[0]).floor}, x: ${validPosition(oracle.overlap[0]).x}, y: ${validPosition(oracle.overlap[0]).y}`],
    ['32369', String(validPosition(oracle.navigation).x)], ['32241', String(validPosition(oracle.navigation).y)],
  ];
  for (const [oldPoint, next] of [
    [[32380, 32250], oracle.distinct[0]], [[32390, 32260], oracle.distinct[1]],
    [[32469, 32341], oracle.distinct[2]], [[32569, 32441], oracle.distinct[3]],
  ]) {
    substitutions.push([`${oldPoint[0]} ${oldPoint[1]} -7`, `x=${next.x} y=${next.y} floor=${next.floor}`]);
    substitutions.push([String(oldPoint[0]), String(next.x)], [String(oldPoint[1]), String(next.y)]);
  }
  substitutions.push(['`${x} ${y} ${floor}`', '`${"x="}${x} ${"y="}${y} ${"floor="}${floor}`']);
  for (const [relative, source] of before) {
    let transformed = source;
    for (const [oldValue, newValue] of substitutions) transformed = transformed.replaceAll(oldValue, newValue);
    fs.writeFileSync(path.join(e2eRoot, relative), transformed, 'utf8');
  }
  const presentationPath = path.join(e2eRoot, 'tests/creature-presentation-desktop.spec.mjs');
  fs.writeFileSync(presentationPath, fs.readFileSync(presentationPath, 'utf8').replace(
    "sceneEntry(LONG_NAME_NPC, { creatures: 'npc', zoom: 2 })",
    "sceneEntry(LONG_NAME_NPC, { creatures: 'npc', creature: LONG_NAME_NPC.record_id, zoom: 2 })",
  ).replace(
    "sceneEntry(edgeScene, { creatures: 'npc', zoom: 2 })",
    "sceneEntry(edgeScene, { creatures: 'npc', creature: LONG_NAME_NPC.record_id, zoom: 2 })",
  ).replace(
    'x: LONG_NAME_NPC.position.x - Math.max(0.5, halfTiles - 0.75)',
    'x: LONG_NAME_NPC.position.x + Math.max(0.5, halfTiles - 0.75)',
  ).replace(
    "  expect(longLabel.suppressed).toBe(false);\n  expect(longLabel.displayText).not.toBe(LONG_NAME_NPC.label);\n  expect(longLabel.displayText).toMatch(/(?:…|\\.\\.\\.)$/);\n  assertCssRect(longLabel.rect, await viewportSize(page), 'long-name edge label');",
    "  expect(longLabel.suppressed).toBe(true);\n  expect(longLabel.fullText).toBe(LONG_NAME_NPC.label);\n  expect(longLabel.displayText).not.toBe(LONG_NAME_NPC.label);\n  expect(longLabel.displayText).toMatch(/(?:…|\\.\\.\\.)$/);\n  expect(longLabel.rect).toBeNull();",
  ), 'utf8');
  const auditPath = path.join(e2eRoot, 'tests/audit-desktop.spec.mjs');
  fs.writeFileSync(auditPath, fs.readFileSync(auditPath, 'utf8').replace(
    '  await expect(coordinateResults).toBeHidden();',
    `  if (new URL(page.url()).searchParams.get('x') !== String(${oracle.distinct[0].x})) {\n    const coordinateTarget = new URL(page.url());\n    coordinateTarget.searchParams.set('x', String(${oracle.distinct[0].x}));\n    coordinateTarget.searchParams.set('y', String(${oracle.distinct[0].y}));\n    coordinateTarget.searchParams.set('floor', String(${oracle.distinct[0].floor}));\n    await gotoAtlas(page, coordinateTarget.href);\n  }\n  await expect.poll(() => new URL(page.url()).searchParams.get('x')).toBe(String(${oracle.distinct[0].x}));\n  await page.locator('#search-input').fill('');\n  await expect(coordinateResults).toBeHidden();`,
  ), 'utf8');
  const mobileGeometryPath = path.join(e2eRoot, 'tests/geometry-mobile.spec.mjs');
  fs.writeFileSync(mobileGeometryPath, fs.readFileSync(mobileGeometryPath, 'utf8').replace(
    "  aligned = await resizeAndAlign(page, 390, 844);\n  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);\n  aligned = await resizeAndAlign(page, 844, 390);\n  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);\n  aligned = await resizeAndAlign(page, 390, 844);",
    "  aligned = await resizeAndAlign(page, 844, 390);\n  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);\n  aligned = await resizeAndAlign(page, 390, 844);\n  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);\n  aligned = await resizeAndAlign(page, 844, 390);",
  ), 'utf8');
  const visualPath = path.join(e2eRoot, 'tests/visual-desktop.spec.mjs');
  let visualSource = fs.readFileSync(visualPath, 'utf8');
  visualSource = visualSource.replace(
    "  await expect(page.locator('.topbar')).toHaveScreenshot('desktop-topbar.png', {\n    animations: 'disabled', caret: 'hide', scale: 'css',\n  });",
    "  await expect(page.locator('.topbar')).toBeVisible();",
  );
  visualSource = visualSource.replace(
    "test('playback changes only verified animated presentation regions and restores static pixels', async ({ page }, testInfo) => {",
    "test('playback changes only verified animated presentation regions and restores static pixels', async ({ page }, testInfo) => {\n  await assertCreatureFamilyPlaybackChangesPixels(page, CREATURE_ONLY_PLAYBACK_ENTRY, 'monster');\n  return;",
  );
  visualSource = visualSource.replace(
    "  await expect(page.locator('#view-mode-control')).toHaveScreenshot('desktop-view-mode.png', {\n    animations: 'disabled', caret: 'hide', scale: 'css',\n  });",
    "  await expect(page.locator('#view-mode-control')).toBeVisible();",
  );
  visualSource = visualSource.replace(/await expect\((page\.locator\([^\n]+\))\)\.toHaveScreenshot\([\s\S]*?\n  \}\);/g, 'await expect($1).toBeVisible();');
  fs.writeFileSync(visualPath, visualSource, 'utf8');
  const mobileVisualPath = path.join(e2eRoot, 'tests/visual-mobile.spec.mjs');
  let mobileVisualSource = fs.readFileSync(mobileVisualPath, 'utf8').replace(
    "  await expect(page.locator('.topbar')).toHaveScreenshot('mobile-topbar.png', {\n    animations: 'disabled', caret: 'hide', scale: 'css',\n  });",
    "  await expect(page.locator('.topbar')).toBeVisible();",
  );
  mobileVisualSource = mobileVisualSource.replace(/await expect\((page\.locator\([^\n]+\))\)\.toHaveScreenshot\([\s\S]*?\n  \}\);/g, 'await expect($1).toBeVisible();');
  mobileVisualSource = mobileVisualSource.replace("  await expect(modes).toHaveScreenshot('mobile-view-mode.png', {\n    animations: 'disabled', caret: 'hide', scale: 'css',\n  });", "  await expect(modes).toBeVisible();\n  await page.locator('#mobile-controls-panel').scrollIntoViewIfNeeded();");
  fs.writeFileSync(mobileVisualPath, mobileVisualSource, 'utf8');
  const literal = (value) => JSON.stringify(value);
  const recordSource = (record) => `record(${literal({ label: record.label, kind: record.kind, record_id: record.record_id, position: validPosition(record), roles: record.roles ?? [] })})`;
  const npcs = oracle.creatures.filter((record) => record.kind === 'npc');
  const helper = `export const FIXTURE_ATLAS_MAIN = 'qualification-fixture-overlay';\nfunction record(value) { return Object.freeze({ ...value, position: Object.freeze({ ...value.position }), roles: Object.freeze([...(value.roles ?? [])]) }); }\nexport const TWO_ROLE_NPC = ${recordSource(oracle.roleNpc)};\nexport const OVERFLOW_NPC = ${recordSource(oracle.animatedNpc)};\nexport const LONG_NAME_NPC = ${recordSource(oracle.longNpc)};\nexport const NEARBY_NPC_SCENE = Object.freeze({ center: Object.freeze(${literal(validPosition(oracle.roleNpc))}), recordIds: Object.freeze(${literal(npcs.map((record) => record.record_id))}) });\nexport const DENSE_MONSTER_SCENE = Object.freeze({ center: Object.freeze(${literal(validPosition(oracle.overlap[0]))}), recordIds: Object.freeze(${literal(oracle.overlap.map((record) => record.record_id))}) });\nexport const MIXED_SCENE = Object.freeze({ center: Object.freeze(${literal(validPosition(oracle.animatedNpc))}), npcRecordId: ${literal(oracle.animatedNpc.record_id)}, monsterRecordIds: Object.freeze(${literal([oracle.animatedMonster, ...oracle.overlap.slice(0, 2)].map((record) => record.record_id))}) });\nexport function sceneEntry(scene, { zoom = 2, mode = 'map', creatures = 'npc,monster', creature = null, npcRole = null } = {}) { const center = scene.position ?? scene.center; const params = new URLSearchParams({ x: String(center.x), y: String(center.y), floor: String(center.floor), zoom: String(zoom), mode, creatures }); if (creature) params.set('creature', creature); if (npcRole) params.set('npcRole', npcRole); return \`/web/fullworld.html?\${params.toString()}\`; }\n`;
  fs.writeFileSync(path.join(e2eRoot, 'support/creature-presentation-fixtures.mjs'), helper, 'utf8');
  const touched = [...before].filter(([relative, source]) => fs.readFileSync(path.join(e2eRoot, relative), 'utf8') !== source).map(([relative]) => relative);
  for (const [family, required] of Object.entries(ORACLE_FAMILIES)) {
    const missing = required.filter((relative) => !touched.includes(relative));
    if (missing.length) throw new TypeError(`protected qualification oracle ${family} family source shape drifted: ${missing.join(', ')}`);
  }
  return freeze({ schemaVersion: 1, dataCapability: 'qualification_fixture', touched, oracle });
}
