import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const reviewedHarnessBlobs = new Map([
  ['e2e/support/creature-presentation-fixtures.mjs', '9c4b64328a2b3379358020a829d49b7e103643fe'],
  ['e2e/tests/audit-desktop.spec.mjs', '323ad657e4f0c1e9e0a10cd82e844b215729b92c'],
  ['e2e/tests/creature-interaction-desktop.spec.mjs', '226917397dff9f27aeb5f01377f5ff513e68ee96'],
  ['e2e/tests/creature-presentation-desktop.spec.mjs', '6dfac51456cb6947efbe9a9b38625fcd51c0af28'],
  ['e2e/tests/creatures-desktop.spec.mjs', '5bb7f3c15482557561d946f54fb248263b1ee197'],
  ['e2e/tests/desktop.spec.mjs', '3730f3fae0c6b3b2de2c55353c1fcade691fb823'],
  ['e2e/tests/farm-explorer-desktop.spec.mjs', '17f8271cbb33ff2d0e2a374e67326b259be05821'],
  ['e2e/tests/farm-explorer-mobile.spec.mjs', 'bb3f2dcbe02737777cde82a773ac2797c9744286'],
  ['e2e/tests/geometry-desktop.spec.mjs', 'f1fcfa727009efcf4f544ff1961289ec6bd0ee58'],
  ['e2e/tests/geometry-mobile.spec.mjs', '8d200a72c1952cefadc32f8101799bf47c25fdc5'],
  ['e2e/tests/mobile.spec.mjs', '961f2144a8f3804bd15998320bf0b19e55fdb4a1'],
  ['e2e/tests/performance-desktop.spec.mjs', '6cf7aaa3d7e1d943a04c61da5093c8729f63de2c'],
  ['e2e/tests/race-desktop.spec.mjs', '845a132be6f7406893a244a86d858c983b0fdf83'],
  ['e2e/tests/runtime.mjs', 'f91395ef9743d3e4660e3e7cdb43ec3da5464df4'],
  ['e2e/tests/soak-desktop.spec.mjs', '7f57fdd4150c5bc8cbc7789cf615def45a5a4364'],
  ['e2e/tests/state-desktop.spec.mjs', '7a281bad1424d4b12139c0436110219965986029'],
  ['e2e/tests/stress-desktop.spec.mjs', '303fd8217b4d8cc7c80538e4cd0d6c9123a434e0'],
  ['e2e/tests/visual-desktop.spec.mjs', '876cdc62813e234c3e8deec8f50ea8c9c4b3ea01'],
  ['e2e/tests/visual-mobile.spec.mjs', 'd22862c56f6ba41be8b614709635d001f1d29c09'],
]);

function gitBlob(text) {
  const bytes = Buffer.from(text);
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
}

function trimOneBlank(text, path) {
  assert.ok(text.endsWith('\n\n'), `${path} must contain the proven single extra EOF blank line`);
  assert.ok(!text.endsWith('\n\n\n'), `${path} contains more than one extra EOF blank line`);
  return text.slice(0, -1);
}

function exactReplace(text, before, after, label) {
  const count = text.split(before).length - 1;
  assert.equal(count, 1, `${label} must occur exactly once`);
  return text.replace(before, after);
}

function materialize() {
  const gatePath = '.github/workflows/merge-group-gate.yml';
  let gate = fs.readFileSync(gatePath, 'utf8');
  assert.equal(gitBlob(gate), 'dc427173dc596321d37af59be69c013d51e66259', 'materializer must run on exact PR #328 gate bytes');
  const oldBootstrap = `          const changedPaths = fs.readFileSync(process.env.CHANGES, 'utf8').trim().split(/\\r?\\n/).filter(Boolean);\n          const regions = new Set(QUALIFICATION_CREATURES.map(({ position }) => \`\${Math.floor(position.x / 32)}:\${Math.floor(position.y / 32)}:\${position.floor}\`));\n          validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: { fixtureId: QUALIFICATION_FIXTURE_ID, creatureCount: QUALIFICATION_CREATURES.length, creatureRegionCount: regions.size, semanticRecordCount: QUALIFICATION_SEMANTIC_RECORD ? 1 : 0 } });\n`;
  const harnessLiteral = JSON.stringify([...reviewedHarnessBlobs], null, 2).replaceAll('\n', '\n          ');
  const newBootstrap = `          const changedPaths = fs.readFileSync(process.env.CHANGES, 'utf8').trim().split(/\\r?\\n/).filter(Boolean);\n          const reviewedHarnessBlobs = new Map(${harnessLiteral});\n          const gitBlobFile = (relative) => {\n            const bytes = fs.readFileSync(relative);\n            return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(\`blob \${bytes.length}\\0\`), bytes])).digest('hex');\n          };\n          for (const [relative, expectedBlob] of reviewedHarnessBlobs) {\n            if (!changedPaths.includes(relative)) throw new TypeError(\`reviewed qualification harness path is missing: \${relative}\`);\n            if (gitBlobFile(relative) !== expectedBlob) throw new TypeError(\`reviewed qualification harness blob drift: \${relative}\`);\n          }\n          const controlPlanePaths = changedPaths.filter((relative) => !reviewedHarnessBlobs.has(relative));\n          if (controlPlanePaths.length + reviewedHarnessBlobs.size !== changedPaths.length) throw new TypeError('qualification harness bootstrap path accounting mismatch');\n          const regions = new Set(QUALIFICATION_CREATURES.map(({ position }) => \`\${Math.floor(position.x / 32)}:\${Math.floor(position.y / 32)}:\${position.floor}\`));\n          validateQualificationRepairControlPlaneBootstrap({ changedPaths: controlPlanePaths, protectedFixtureShape: { fixtureId: QUALIFICATION_FIXTURE_ID, creatureCount: QUALIFICATION_CREATURES.length, creatureRegionCount: regions.size, semanticRecordCount: QUALIFICATION_SEMANTIC_RECORD ? 1 : 0 } });\n`;
  gate = exactReplace(gate, oldBootstrap, newBootstrap, 'protected self-bootstrap harness insertion');
  gate = trimOneBlank(gate, gatePath);
  const gateSha = gitBlob(gate);

  const verifierPath = 'tools/governance/verify_extraction_provenance.py';
  let verifier = fs.readFileSync(verifierPath, 'utf8');
  verifier = exactReplace(verifier,
    'MERGE_GROUP_GATE_BLOB = "dc427173dc596321d37af59be69c013d51e66259"',
    `MERGE_GROUP_GATE_BLOB = "${gateSha}"`,
    'provenance gate pin');
  const verifierSha = gitBlob(verifier);

  const auditPath = '.github/workflows/merge-authority-audit.yml';
  let audit = fs.readFileSync(auditPath, 'utf8');
  audit = exactReplace(audit,
    'EXPECTED_MERGE_GROUP_GATE_BLOB: "dc427173dc596321d37af59be69c013d51e66259"',
    `EXPECTED_MERGE_GROUP_GATE_BLOB: "${gateSha}"`,
    'audit gate pin');
  audit = exactReplace(audit,
    'EXPECTED_PROVENANCE_VERIFIER_BLOB: "6babb5d8f1ae4838a3cd73fbbf3db9b8319ea546"',
    `EXPECTED_PROVENANCE_VERIFIER_BLOB: "${verifierSha}"`,
    'audit verifier pin');
  audit = trimOneBlank(audit, auditPath);

  const outputs = new Map([
    [gatePath, gate],
    [verifierPath, verifier],
    [auditPath, audit],
  ]);
  for (const path of [
    '.github/workflows/protected-qualification-repair.yml',
    'tests/verification/issue-314-qualification-path.test.mjs',
    'tests/verification/issue-314-qualification-repair-trust.test.mjs',
    'tests/verification/merge-group-qualification-repair-bootstrap.test.mjs',
    'tests/verification/qualification-repair-policy.test.mjs',
    'tools/verification/qualification-repair-policy.mjs',
  ]) outputs.set(path, trimOneBlank(fs.readFileSync(path, 'utf8'), path));

  for (const [path, text] of outputs) {
    const sha = gitBlob(text);
    process.stdout.write(`PR328_MATERIALIZED\t${path}\t${sha}\t${Buffer.from(text).toString('base64')}\n`);
  }
  process.stdout.write(`PR328_FINAL_GATE_BLOB\t${gateSha}\nPR328_FINAL_VERIFIER_BLOB\t${verifierSha}\n`);
}

test('materialize exact reviewed PR328 harness transition bytes', () => {
  assert.equal(reviewedHarnessBlobs.size, 19);
  materialize();
});
