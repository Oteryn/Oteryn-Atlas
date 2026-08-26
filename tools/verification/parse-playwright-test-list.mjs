import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const LIST_ROW = /^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/;

export function parsePlaywrightStableTestIds(text) {
  if (typeof text !== 'string') throw new TypeError('Playwright test list must be text');
  const ids = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(LIST_ROW);
    if (!match) continue;
    const [, project, spec, title] = match;
    ids.push(`${project}::e2e/tests/${spec}::${title}`);
  }
  if (ids.length === 0) throw new TypeError('Playwright test list contains no scenarios');
  const stable = [...new Set(ids)].sort();
  if (stable.length !== ids.length) throw new TypeError('Playwright test list contains duplicate stable IDs');
  return stable;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const pathname = process.argv[2];
  if (!pathname || process.argv.length !== 3) throw new TypeError('usage: parse-playwright-test-list.mjs <list-output>');
  process.stdout.write(`${JSON.stringify(parsePlaywrightStableTestIds(fs.readFileSync(pathname, 'utf8')))}\n`);
}
