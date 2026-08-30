import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testsRoot = fileURLToPath(new URL('../../e2e/tests/', import.meta.url));

test('Playwright specs navigate through the shared qualification-aware helper', () => {
  const bypasses = [];
  for (const entry of fs.readdirSync(testsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.spec.mjs')) continue;
    const source = fs.readFileSync(path.join(testsRoot, entry.name), 'utf8');
    if (/\bpage\.goto\s*\(/.test(source)) bypasses.push(entry.name);
  }
  assert.deepEqual(bypasses, [], `direct page.goto bypasses: ${bypasses.join(', ')}`);
});
