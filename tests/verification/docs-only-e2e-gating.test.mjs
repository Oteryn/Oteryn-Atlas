import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const classifier = fileURLToPath(new URL('../../tools/verification/classify-pr-changes.mjs', import.meta.url));

function classify(paths) {
  const input = paths.length === 0 ? '' : `${paths.join('\n')}\n`;
  const result = spawnSync(process.execPath, [classifier], {
    encoding: 'utf8',
    input,
  });
  assert.equal(result.status, 0, `classifier failed: ${result.stderr || result.stdout}`);
  const outputs = Object.fromEntries(
    result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('=', 2)),
  );
  return outputs;
}

test('pure Markdown under docs is exempt from heavy E2E', () => {
  assert.deepEqual(classify([
    'docs/evidence/ATLAS-COMPREHENSIVE-VERIFICATION-PLATFORM-CLOSEOUT.md',
    'docs/testing/ATLAS-VERIFICATION-PLATFORM.md',
  ]), {
    docs_only: 'true',
    requires_e2e: 'false',
  });
});

test('root AGENTS governance Markdown is exempt from heavy E2E', () => {
  assert.deepEqual(classify(['AGENTS.md']), {
    docs_only: 'true',
    requires_e2e: 'false',
  });
});

test('root AGENTS plus safe docs Markdown remains exempt from heavy E2E', () => {
  assert.deepEqual(classify([
    'AGENTS.md',
    'docs/testing/ATLAS-VERIFICATION-PLATFORM.md',
  ]), {
    docs_only: 'true',
    requires_e2e: 'false',
  });
});

test('mixed or non-Markdown documentation changes require heavy E2E', () => {
  for (const paths of [
    ['docs/evidence/note.md', 'web/app.mjs'],
    ['AGENTS.md', 'web/app.mjs'],
    ['docs/migration/legacy-atlas-extraction-provenance.json'],
    ['README.md'],
    ['.github/workflows/ci.yml'],
    ['tools/verification/classify-pr-changes.mjs'],
    ['tests/verification/docs-only-e2e-gating.test.mjs'],
    [],
  ]) {
    assert.deepEqual(classify(paths), {
      docs_only: 'false',
      requires_e2e: 'true',
    });
  }
});

test('malformed documentation paths fail closed', () => {
  for (const path of [
    'docs/../web/app.mjs',
    'docs//evidence/note.md',
    '/docs/evidence/note.md',
    'docs/evidence/note.MD',
    'docs\\evidence\\note.md',
    './AGENTS.md',
    '/AGENTS.md',
    'agents.md',
  ]) {
    assert.deepEqual(classify([path]), {
      docs_only: 'false',
      requires_e2e: 'true',
    });
  }
});
