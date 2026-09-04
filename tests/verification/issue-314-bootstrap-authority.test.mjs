import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const impactManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/impact-manifest.json'), 'utf8'));
const verificationCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-catalog.json'), 'utf8'));

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

function classify(paths) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools/verification/classify-pr-changes.mjs')], {
    cwd: ROOT,
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(result.stdout.trim().split(/\r?\n/).map((line) => line.split('=')));
}

test('Issue #314 bootstrap: root AGENTS is instruction-only and does not recurse into browser qualification', () => {
  assert.deepEqual(classify(['AGENTS.md']), { docs_only: 'true', requires_e2e: 'false' });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.profile, 'none');
  assert.deepEqual(plan.requiredGroupIds, []);
});

test('Issue #314 bootstrap: pure verification regressions remain deterministic-only', () => {
  const plan = planFor('tests/verification/example-regression.test.mjs');
  assert.equal(plan.profile, 'focused');
  assert.deepEqual(plan.requiredGroupIds, ['deterministic.core']);
  assert.deepEqual(plan.requiredDataCapabilities, ['qualification_fixture']);
});

test('Issue #314 bootstrap: generic repair authority is protected and branch agnostic', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-authority-manifest.json'), 'utf8'));
  const paths = new Set(manifest.components.map(({ path: pathname }) => pathname));
  assert.equal(paths.has('.github/workflows/protected-qualification-repair.yml'), true);
  assert.equal(paths.has('tools/verification/qualification-repair-policy.mjs'), true);

  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /runs-on:\s*ubuntu-24\.04/);
  assert.match(workflow, /--network none/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--workers=1/);
  assert.match(workflow, /--retries=0/);
  assert.doesNotMatch(workflow, /ATLAS_HEAD_REF|head\.ref\s*==|fix\/issue-/);
});

test('Issue #314 bootstrap: creature overlay source contract accepts exactly one complete authority form', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/creature-overlays.yml'), 'utf8');
  for (const marker of [
    'legacy_markers=(',
    'trust_markers=(',
    "EXPECTED_SEMANTIC_DIGEST = 'sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8'",
    "EXPECTED_CAPABILITY = 'animated-creatures-v1'",
    'EXPECTED_NPC_ROLE_SCHEMA = 1',
    'const SOURCE_EXPECTATIONS = ancillarySourceExpectations(FULLWORLD_TRUST);',
    'SOURCE_EXPECTATIONS.animation,',
    'const expected = SOURCE_EXPECTATIONS.creatures;',
    'index.source?.semantic_digest === expected.semanticDigest',
    'index.source?.npc_role_schema_version === expected.npcRoleSchemaVersion',
    'all_markers_present "${legacy_markers[@]}" && no_markers_present "${trust_markers[@]}"',
    'all_markers_present "${trust_markers[@]}" && no_markers_present "${legacy_markers[@]}"',
  ]) assert.equal(workflow.includes(marker), true, marker);
  assert.match(workflow, /Creature source authority contract is incomplete or mixed/);
});
