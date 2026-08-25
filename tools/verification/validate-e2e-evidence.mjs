import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function readJson(pathname, label) {
  try {
    return JSON.parse(fs.readFileSync(pathname, 'utf8'));
  } catch (error) {
    throw new TypeError(`cannot read ${label}: ${error.message}`);
  }
}

function sha256File(pathname) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(pathname)).digest('hex')}`;
}

function uniqueStableIds(ids, label) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string' || !id.includes('::'))) {
    throw new TypeError(`${label} must contain stable Playwright IDs`);
  }
  const unique = [...new Set(ids)].sort();
  if (unique.length !== ids.length) throw new TypeError(`${label} contains duplicate stable Playwright IDs`);
  return unique;
}

export function validatePlanBoundE2eEvidence({ plan, summary, planSha256, headSha, repository = 'Oteryn/Oteryn-Atlas' }) {
  if (!plan || plan.repository !== repository) throw new TypeError('verification plan repository mismatch');
  if (plan.headSha !== headSha) throw new TypeError('verification plan head SHA does not match tested HEAD');
  const expected = uniqueStableIds(plan.stableTestIds, 'verification plan');
  if (summary?.metadata?.verificationPlanSha256 !== planSha256) {
    throw new TypeError('Playwright summary is not bound to this exact verification plan');
  }
  const actual = uniqueStableIds((summary.scenarios ?? []).map((scenario) => scenario?.stableTestId), 'Playwright summary');
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new TypeError('Playwright stable test-ID census does not match the verification plan');
  }
  for (const scenario of summary.scenarios) {
    if (scenario.status !== 'passed') throw new TypeError(`Playwright scenario ${scenario.stableTestId} is not passed`);
    if (Number(scenario.retry) !== 0) throw new TypeError(`Playwright scenario ${scenario.stableTestId} was retried`);
  }
  return Object.freeze({ expectedScenarioCount: expected.length, planSha256 });
}

function parseArgs(argv) {
  if (argv.length !== 6 || argv[0] !== '--plan' || argv[2] !== '--summary' || argv[4] !== '--head-sha') {
    throw new TypeError('usage: validate-e2e-evidence.mjs --plan <plan> --summary <summary> --head-sha <sha>');
  }
  return { planPath: argv[1], summaryPath: argv[3], headSha: argv[5] };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { planPath, summaryPath, headSha } = parseArgs(process.argv.slice(2));
  const result = validatePlanBoundE2eEvidence({
    plan: readJson(planPath, 'verification plan'),
    summary: readJson(summaryPath, 'Playwright summary'),
    planSha256: sha256File(planPath),
    headSha,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
