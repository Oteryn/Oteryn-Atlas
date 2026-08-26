import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const PINNED_BROWSER_CONTAINER = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';

function validSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);
}

export function validateGithubHostedE2eSummary(summary, { headSha, workers }) {
  if (!validSha(headSha)) throw new TypeError('headSha must be an exact 40-character SHA');
  if (!Number.isSafeInteger(workers) || workers < 1) throw new TypeError('workers must be a positive integer');
  if (!summary || summary.status !== 'passed') throw new TypeError('GitHub-hosted Playwright summary is not passed');
  if (summary.metadata?.expectedRevision !== headSha) throw new TypeError('summary expectedRevision does not match exact PR head');
  if (summary.metadata?.targetMode !== 'direct-preview') throw new TypeError('ordinary GitHub-hosted E2E must use direct-preview mode');
  if (summary.metadata?.publicationOrigin != null) throw new TypeError('ordinary GitHub-hosted E2E must not depend on LAN publication');
  if (summary.metadata?.browserContainer !== PINNED_BROWSER_CONTAINER) throw new TypeError('browser container identity is not the pinned repository image');
  if (Number(summary.metadata?.workers) !== workers) throw new TypeError('summary worker count does not match the requested GitHub-hosted worker count');
  if (!Array.isArray(summary.scenarios) || summary.scenarios.length === 0) throw new TypeError('Playwright summary has no scenarios');

  const stableIds = new Set();
  for (const scenario of summary.scenarios) {
    if (scenario?.status !== 'passed') throw new TypeError(`scenario ${scenario?.stableTestId ?? 'unknown'} is not passed`);
    if (Number(scenario?.retry) !== 0) throw new TypeError(`scenario ${scenario?.stableTestId ?? 'unknown'} was retried`);
    if (typeof scenario?.stableTestId !== 'string' || !scenario.stableTestId.includes('::')) throw new TypeError('scenario stableTestId is missing');
    if (stableIds.has(scenario.stableTestId)) throw new TypeError(`duplicate scenario stableTestId: ${scenario.stableTestId}`);
    stableIds.add(scenario.stableTestId);
  }

  return Object.freeze({
    status: 'passed',
    headSha,
    workers,
    scenarioCount: summary.scenarios.length,
    browserContainer: PINNED_BROWSER_CONTAINER,
  });
}

function parseArgs(argv) {
  if (argv.length !== 6 || argv[0] !== '--summary' || argv[2] !== '--head-sha' || argv[4] !== '--workers') {
    throw new TypeError('usage: validate-github-hosted-e2e.mjs --summary <summary.json> --head-sha <sha> --workers <n>');
  }
  const workers = Number(argv[5]);
  if (!Number.isSafeInteger(workers) || workers < 1) throw new TypeError('workers must be a positive integer');
  return { summaryPath: argv[1], headSha: argv[3], workers };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { summaryPath, headSha, workers } = parseArgs(process.argv.slice(2));
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  process.stdout.write(`${JSON.stringify(validateGithubHostedE2eSummary(summary, { headSha, workers }))}\n`);
}
