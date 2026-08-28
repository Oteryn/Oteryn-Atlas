import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

test('Playwright image materializes the trusted fixture definition required by qualification support', () => {
  const support = read('e2e/support/qualification-fixture-scenarios.mjs');
  const dockerfile = read('e2e/Dockerfile');

  assert.match(
    support,
    /from '\.\.\/\.\.\/tools\/verification\/qualification-fixture-definition\.mjs';/,
    'qualification scenarios must continue to consume the trusted fixture definition instead of duplicating its facts',
  );
  assert.match(
    dockerfile,
    /^COPY tools\/verification\/qualification-fixture-definition\.mjs \/workspace\/tools\/verification\/qualification-fixture-definition\.mjs$/m,
    'the image must materialize the support module\'s transitive trusted fixture dependency at its resolved path',
  );
});
