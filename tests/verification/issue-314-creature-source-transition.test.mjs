import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/creature-overlays.yml'), 'utf8');
const classifiers = [...workflow.matchAll(/          python - <<'PY'\n([\s\S]*?)\n          PY/g)];
const classifierMatch = classifiers.find((match) => match[1].includes("source = Path('web/fullworld-creatures.mjs').read_text()"));
assert(classifierMatch, 'creature overlay workflow must contain the transitional source classifier');
const classifier = classifierMatch[1].replace(/^          /gm, '');

const legacySource = fs.readFileSync(path.join(ROOT, 'web/fullworld-creatures.mjs'), 'utf8');
const legacyConstants = [
  "const EXPECTED_CAPABILITY = 'animated-creatures-v1';",
  "const EXPECTED_SEMANTIC_DIGEST = 'sha256:7dc951874c95424279737eaaf51cf2d50940162ef4799daea39a187a581ef0e8';",
  'const EXPECTED_NPC_ROLE_SCHEMA = 1;',
];
const trustContract = `
import { ancillarySourceExpectations, FULLWORLD_PATHS, FULLWORLD_TRUST } from '../src/browser/fullworld-trust.mjs';
const SOURCE_EXPECTATIONS = ancillarySourceExpectations(FULLWORLD_TRUST);
state.animationRuntime = await getAnimationRuntime(root, fetch,
      SOURCE_EXPECTATIONS.animation,
);
const expected = SOURCE_EXPECTATIONS.creatures;
requireValue(index.source?.semantic_digest === expected.semanticDigest, 'semantic digest');
requireValue(index.source?.npc_role_schema_version === expected.npcRoleSchemaVersion, 'NPC role schema');
`;

function classify(source) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-creature-source-'));
  try {
    fs.mkdirSync(path.join(temporary, 'web'));
    fs.writeFileSync(path.join(temporary, 'web/fullworld-creatures.mjs'), source);
    return spawnSync('python', ['-c', classifier], { cwd: temporary, encoding: 'utf8' });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

test('Issue #314: creature workflow accepts each complete transition endpoint', () => {
  const legacy = classify(legacySource);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.match(legacy.stdout, /contract: legacy/);

  const trustBound = classify(`${legacyConstants.reduce((source, marker) => source.replace(marker, ''), legacySource)}\n${trustContract}`);
  assert.equal(trustBound.status, 0, trustBound.stderr);
  assert.match(trustBound.stdout, /contract: trust-bound/);
});

test('Issue #314: creature workflow rejects partial and mixed source authority', () => {
  const mixed = classify(`${legacySource}\n${trustContract}`);
  assert.notEqual(mixed.status, 0, 'mixed legacy and trust-bound authority must fail closed');

  const partial = classify(legacySource.replace(legacyConstants[1], ''));
  assert.notEqual(partial.status, 0, 'partial legacy authority must fail closed');
});
