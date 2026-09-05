import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PRODUCTION_ANIMATION_SOURCE } from '../../src/browser/animation-runtime.mjs';
import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const impactManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/impact-manifest.json'), 'utf8'));
const verificationCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-catalog.json'), 'utf8'));
const classifierPath = path.join(ROOT, 'tools/verification/classify-pr-changes.mjs');
const creatureSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-creatures.mjs'), 'utf8');
const searchSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-search.mjs'), 'utf8');
const farmSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-farm-explorer.mjs'), 'utf8');

function classify(paths) {
  const result = spawnSync(process.execPath, [classifierPath], {
    cwd: ROOT,
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(result.stdout.trim().split(/\r?\n/).map((line) => line.split('=')));
}

function planFor(pathname) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: pathname }],
    trustedImpactManifest: impactManifest,
    candidateImpactManifest: impactManifest,
    trustedVerificationCatalog: verificationCatalog,
    candidateVerificationCatalog: verificationCatalog,
  });
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function responseFor(bytes) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => String(bytes.byteLength) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

test('A: root instruction-only governance does not recursively require browser qualification', () => {
  assert.deepEqual(classify(['AGENTS.md']), { docs_only: 'true', requires_e2e: 'false' });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.profile, 'none');
  assert.deepEqual(plan.requiredGroupIds, []);

  const unknownMarkdown = planFor('README.md');
  assert.equal(unknownMarkdown.profile, 'full', 'arbitrary Markdown must remain fail-closed');
  assert.deepEqual(unknownMarkdown.requiredGroupIds, ['deterministic.core', 'e2e.full']);
});

test('B: pure verification regressions stay deterministic while executable authority stays broad and fail-closed', () => {
  const regression = planFor('tests/verification/new-regression.test.mjs');
  assert.equal(regression.profile, 'focused');
  assert.deepEqual(regression.requiredGroupIds, ['deterministic.core']);

  for (const pathname of [
    'tools/verification/classify-pr-changes.mjs',
    '.github/workflows/protected-hosted-executor.yml',
  ]) {
    const plan = planFor(pathname);
    assert.equal(plan.profile, 'full', pathname);
    assert.deepEqual(plan.requiredGroupIds, ['deterministic.core', 'e2e.full'], pathname);
  }
});

test('C: verification profile remains independent from product data capability', () => {
  assert.equal(verificationCatalog.groups['e2e.full'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(verificationCatalog.groups['e2e.common-smoke'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(verificationCatalog.groups['integration.source-contract'].capabilities.dataCapability, 'bounded_real_world');
  assert.equal(verificationCatalog.groups['fullworld.animation-census'].capabilities.dataCapability, 'real_fullworld');
  assert.equal(planFor('web/fullworld-creatures.mjs').profile, 'broad');
});

test('D/E: qualification repair admission is branch-agnostic, exact-scope and executes protected e2e.full', async () => {
  const policyUrl = pathToFileURL(path.join(ROOT, 'tools/verification/qualification-repair-policy.mjs')).href;
  const { QUALIFICATION_REPAIR_BROWSER_PROOF, validateQualificationRepairTransition } = await import(policyUrl);
  const protectedPlan = {
    profile: 'full',
    requiredGroupIds: ['deterministic.core', 'e2e.full'],
    requiredDataCapabilities: ['qualification_fixture'],
    retryPolicy: { retries: 0 },
  };
  const candidatePlan = structuredClone(protectedPlan);

  const accepted = validateQualificationRepairTransition({
    changedPaths: ['tools/verification/qualification-fixture-definition.mjs', 'web/fullworld-creatures.mjs'],
    protectedPlan,
    candidatePlan,
  });
  assert.equal(accepted.eligible, true);
  assert.deepEqual(accepted.planFloorGroupIds, ['deterministic.core', 'e2e.full']);
  assert.deepEqual(accepted.requiredGroupIds, ['deterministic.core']);
  assert.deepEqual(accepted.browserProof, QUALIFICATION_REPAIR_BROWSER_PROOF);
  assert.deepEqual(accepted.browserProof, {
    groupId: 'e2e.full',
    dataCapability: 'qualification_fixture',
    workers: 1,
    retries: 0,
  });
  assert.equal(JSON.stringify(accepted).includes('branch'), false);
  assert.equal(JSON.stringify(accepted).includes('prNumber'), false);

  assert.throws(() => validateQualificationRepairTransition({
    changedPaths: ['tools/verification/qualification-fixture-definition.mjs'],
    protectedPlan,
    candidatePlan: { ...candidatePlan, requiredGroupIds: ['deterministic.core'] },
  }), /narrow|protected|safety/i);

  assert.throws(() => validateQualificationRepairTransition({
    changedPaths: ['.github/workflows/protected-hosted-executor.yml'],
    protectedPlan,
    candidatePlan,
  }), /scope|eligible|repair/i);
});

test('D/E: generic qualification repair admits regression companions and all trust-bound FullWorld ancillary callers', async () => {
  const policyUrl = pathToFileURL(path.join(ROOT, 'tools/verification/qualification-repair-policy.mjs')).href;
  const { validateQualificationRepairTransition } = await import(policyUrl);
  const plan = {
    profile: 'full',
    requiredGroupIds: ['deterministic.core', 'e2e.full'],
    requiredDataCapabilities: ['qualification_fixture'],
    retryPolicy: { retries: 0 },
  };

  const accepted = validateQualificationRepairTransition({
    changedPaths: [
      'src/browser/animation-runtime-service.mjs',
      'tests/verification/issue-314-animation-trust-callers.test.mjs',
      'web/fullworld-app.mjs',
      'web/fullworld-creatures.mjs',
      'web/fullworld-farm-explorer.mjs',
      'web/fullworld-search.mjs',
    ],
    protectedPlan: plan,
    candidatePlan: plan,
  });

  assert.equal(accepted.eligible, true);
  assert(accepted.changedPaths.includes('tests/verification/issue-314-animation-trust-callers.test.mjs'));
  assert(accepted.changedPaths.includes('web/fullworld-app.mjs'));
  assert(accepted.changedPaths.includes('web/fullworld-search.mjs'));
  assert(accepted.changedPaths.includes('web/fullworld-farm-explorer.mjs'));
});

test('D/E: protected qualification repair resolves the exact complete protected browser census', () => {
  const workflowPath = path.join(ROOT, '.github/workflows/protected-qualification-repair.yml');
  assert.equal(fs.existsSync(workflowPath), true, 'generic protected qualification repair workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const job = workflow.split('  qualification-repair:')[1] ?? '';
  const gateSource = fs.readFileSync(path.join(ROOT, 'tools/verification/protected-hosted-gate.mjs'), 'utf8');

  assert.match(workflow, /pull_request_target:/);
  assert.match(job, /validateQualificationRepairTransition/);
  assert.match(job, /requiredGroupFloor:\s*\['deterministic\.core', 'e2e\.full'\]/);
  assert.match(job, /catalog\.groups\?\.\['e2e\.full'\]\?\.specs/);
  assert.match(job, /selected\.length !== 68/);
  assert.doesNotMatch(job, /candidateCensus|candidate-list-artifacts/);
  assert.doesNotMatch(job, /selected\.length !== 1/);
  assert.match(job, /runs-on:\s*ubuntu-24\.04/);
  assert.match(job, /--network none/);
  assert.match(job, /--read-only/);
  assert.match(job, /--workers=1/);
  assert.match(job, /--retries=0/);
  assert.match(job, /context='atlas-protected-product-qualification'/);
  assert.doesNotMatch(job, /ATLAS_HEAD_REF|head\.ref|fix\/issue-|pull_request\.number\s*==/);

  assert.match(gateSource, /\.github\/workflows\/protected-qualification-repair\.yml/);
  assert.doesNotMatch(gateSource, /resolveProtectedPromotionQualification|resolveProtectedAuthorityRepinQualification/);
});

test('F: FullWorld ancillary browser consumers derive exact source authority from active trust', () => {
  assert.match(creatureSource, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/);
  assert.doesNotMatch(creatureSource, /validateCreatureIndex\(index,\s*\{[\s\S]*EXPECTED_GAME_SHA256/);

  for (const [source, label] of [[searchSource, 'search'], [farmSource, 'farm']]) {
    assert.match(source, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/, label);
    assert.match(source, /SOURCE_EXPECTATIONS\.semanticSearch/, label);
    assert.match(source, /creatureContractId/, label);
    assert.match(source, /creatureCapability/, label);
    assert.match(source, /creatureSemanticDigest/, label);
    assert.match(source, /fixture_id/, label);
  }
  assert.match(searchSource, /validateSemanticSearchIndex\(raw, SOURCE_EXPECTATIONS\.semanticSearch\)/);
});

test('F2: implicit and explicit production animation authority share one singleton identity', async () => {
  const programs = jsonBytes({
    profile: 'oteryn-atlas-animation-runtime-v1',
    object_programs: [],
    creature_programs: [],
    sprite_index: {},
    blob_index: {},
  });
  const programsDigest = `sha256:${crypto.createHash('sha256').update(programs).digest('hex')}`;
  const manifest = jsonBytes({
    profile: 'oteryn-atlas-animation-runtime-v1',
    identityAuthority: false,
    source: {
      game_sha: PRODUCTION_ANIMATION_SOURCE.gameSha,
      appearance_product_root: PRODUCTION_ANIMATION_SOURCE.appearanceProductRoot,
      outfit_spatial_product_root: PRODUCTION_ANIMATION_SOURCE.outfitSpatialProductRoot,
    },
    buckets: [],
    programs: { path: 'programs.json', digest: programsDigest, bytes: programs.byteLength },
  });
  const fetcher = async (url) => {
    if (url.pathname.endsWith('/manifest.json')) return responseFor(manifest);
    if (url.pathname.endsWith('/programs.json')) return responseFor(programs);
    throw new Error(`unexpected animation fixture URL: ${url}`);
  };
  const serviceUrl = pathToFileURL(path.join(ROOT, 'src/browser/animation-runtime-service.mjs'));
  serviceUrl.searchParams.set('regression', 'implicit-explicit-production-authority');
  const { getAnimationRuntime } = await import(serviceUrl.href);
  const base = new URL('https://atlas.example/fullworld/animation/');

  const implicit = getAnimationRuntime(base, fetcher);
  const explicit = getAnimationRuntime(base, fetcher, PRODUCTION_ANIMATION_SOURCE);
  assert.strictEqual(explicit, implicit);
  await implicit;

  assert.throws(() => getAnimationRuntime(base, fetcher, {
    ...PRODUCTION_ANIMATION_SOURCE,
    gameSha: 'fixture',
  }), /identity changed/i);
});

test('G: genuine runtime-impacting browser changes retain full plan floor while generic repair proof stays fixture-bound', async () => {
  const plan = planFor('web/fullworld-creatures.mjs');
  assert.equal(plan.profile, 'broad');
  assert(plan.requiredGroupIds.includes('e2e.full'));
  const group = verificationCatalog.groups['e2e.full'];
  assert.equal(group.capabilities.browser, true);
  assert.equal(group.capabilities.hosted, true);
  assert.equal(group.capabilities.dataCapability, 'qualification_fixture');

  const policyUrl = pathToFileURL(path.join(ROOT, 'tools/verification/qualification-repair-policy.mjs')).href;
  const { QUALIFICATION_REPAIR_BROWSER_PROOF } = await import(policyUrl);
  assert.equal(QUALIFICATION_REPAIR_BROWSER_PROOF.dataCapability, 'qualification_fixture');
  assert.equal(QUALIFICATION_REPAIR_BROWSER_PROOF.workers, 1);
  assert.equal(QUALIFICATION_REPAIR_BROWSER_PROOF.retries, 0);
});
