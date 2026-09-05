import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const repair = fs.readFileSync('.github/workflows/protected-qualification-repair.yml', 'utf8');
const mergeGroup = fs.readFileSync('.github/workflows/merge-group-gate.yml', 'utf8');

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
