import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobile = await readFile(new URL('../web/fullworld-mobile.mjs', import.meta.url), 'utf8');

test('mobile drawer Escape consumes the event before lower interaction layers', () => {
  assert.match(
    mobile,
    /if \(event\.key === 'Escape'\) \{\n\s+event\.preventDefault\(\);\n\s+event\.stopImmediatePropagation\(\);\n\s+closeDrawer\(\);\n\s+\}/,
  );
});

test('responsive crossing redirects focus from any desktop Find descendant', () => {
  assert.match(
    mobile,
    /if \(active\.closest\('#search-form'\)\) return \$\('#mobile-find-toggle'\);/,
  );
});
