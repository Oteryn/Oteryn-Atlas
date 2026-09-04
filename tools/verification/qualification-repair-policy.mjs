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
  const productDigest = `sha256:${crypto.createHash('sha256').update(Buffer.from(canonicalJson(entries))).digest('hex')}`;
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

