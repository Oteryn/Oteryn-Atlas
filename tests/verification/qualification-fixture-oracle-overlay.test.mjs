import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repair = fs.readFileSync('.github/workflows/protected-qualification-repair.yml', 'utf8');
const mergeGroup = fs.readFileSync('.github/workflows/merge-group-gate.yml', 'utf8');

for (const scenario of [
  { name: 'pre-adapter protected base', source: 'export const existingProtectedPolicy = true;', succeeds: true },
  { name: 'valid protected adapter', source: "export function materializeQualificationFixtureOracleOverlay() { return {dataCapability:'qualification_fixture',touched:['tests/desktop.spec.mjs']}; }", succeeds: true },
  { name: 'invalid protected adapter result', source: "export function materializeQualificationFixtureOracleOverlay() { return {dataCapability:'real_fullworld',touched:[]}; }", succeeds: false },
  { name: 'rejected fixture', source: "export function materializeQualificationFixtureOracleOverlay() { throw new Error('invalid fixture'); }", succeeds: false },
]) {
  test(`ordinary Merge Queue retains protected qualification for ${scenario.name}`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-protected-adapter-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const policy = path.join(root, 'trusted-base/tools/verification/qualification-repair-policy.mjs');
    fs.mkdirSync(path.dirname(policy), { recursive: true });
    fs.writeFileSync(policy, scenario.source);
    const marker = 'E2E_ROOT="$execution_context/e2e" PRODUCT_ROOT="$source_root" node --input-type=module <<\'NODE\'\n';
    const start = mergeGroup.indexOf(marker);
    assert.ok(start >= 0);
    const end = mergeGroup.indexOf('          NODE', start + marker.length);
    const source = mergeGroup.slice(start + marker.length, end).split('\n').map((line) => line.replace(/^          /, '')).join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: source, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status === 0, scenario.succeeds, result.stderr);
  });
}

test('both protected browser qualification paths materialize the same protected oracle overlay', () => {
  for (const [label, workflow] of [['repair', repair], ['merge group', mergeGroup]]) {
    assert.match(workflow, /materializeQualificationFixtureOracleOverlay/,
      `${label} must materialize protected qualification fixture oracles`);
    assert.match(workflow, /\.\/trusted-base\/tools\/verification\/qualification-repair-policy\.mjs/,
      `${label} must use protected policy authority`);
    assert.doesNotMatch(workflow, /candidate\/.*materializeQualificationFixtureOracleOverlay/,
      `${label} must not execute candidate E2E authority`);
  }
  assert.match(repair, /--workers=1 --retries=0/);
  assert.match(repair, /selected\.length !== 68/);
});
