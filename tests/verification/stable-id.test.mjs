import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeStableSpecPath,
  normalizeStableTitlePath,
  stableTestId,
} from '../../tools/verification/stable-id.mjs';

test('canonical stable IDs normalize platform paths without truncating long path or title boundaries', () => {
  const longPath = `C:\\work\\Atlas\\e2e\\tests\\${'nested/'.repeat(100)}case.spec.mjs`;
  const longTitle = `${'nested › '.repeat(100)}π punctuation: []`;
  const id = stableTestId('desktop-chromium', longPath, longTitle);

  assert.match(id, /^desktop-chromium::e2e\/tests\/nested\//);
  assert.ok(id.endsWith(longTitle));
  assert.ok(id.length > 1500);
  assert.equal(normalizeStableSpecPath(longPath), longPath.replace(/^C:\\work\\Atlas\\/, '').replaceAll('\\', '/'));
});

test('canonical stable IDs preserve supported unicode and whitespace while joining nested titles once', () => {
  assert.equal(normalizeStableTitlePath([' suite ', ' case\u00a0π ']), ' suite  ›  case\u00a0π ');
  assert.equal(
    stableTestId('mobile-chromium', 'e2e\\tests\\mobile.spec.mjs', ['suite', 'case']),
    'mobile-chromium::e2e/tests/mobile.spec.mjs::suite › case',
  );
});
