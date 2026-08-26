import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const POLICY_ID = 'molehill-bootstrap-safe-v1';
const PLAN_DIGEST = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;

function fail(message) {
  throw new TypeError(message);
}

export function validateResourceAdmissionEvidence(input) {
  if (!input || typeof input !== 'object') fail('resource evidence input is required');
  const { evidence, headSha, verificationPlanSha256 } = input;
  if (!evidence || typeof evidence !== 'object') fail('resource admission evidence is required');
  if (!SHA.test(headSha ?? '')) fail('head revision is invalid');
  if (!PLAN_DIGEST.test(verificationPlanSha256 ?? '')) fail('verification plan digest is invalid');
  if (evidence.version !== 1) fail('resource evidence version is unsupported');
  if (evidence.policyId !== POLICY_ID) fail('resource policy identity is not accepted');
  if (evidence.resourceClass !== 'browser-full') fail('resource class is not browser-full');
  if (evidence.authorityMode !== 'authoritative' || evidence.evidenceEligibility !== 'authoritative') {
    fail('resource evidence is not authoritative');
  }
  if (evidence.revision !== headSha) fail('resource evidence revision does not match exact head');
  if (evidence.verificationPlanSha256 !== verificationPlanSha256) fail('resource evidence is not bound to the exact verification plan');
  if (evidence.hostCapacity !== 2) fail('resource evidence host capacity is not the measured value 2');
  if (![1, 2].includes(evidence.hostAdmissionToken)) fail('resource host admission token is outside measured capacity');
  if (evidence.slotCount !== 2) fail('resource evidence slot capacity is not the measured value 2');
  if (![1, 2].includes(evidence.slotId)) fail('resource evidence slot is outside measured capacity');
  if (typeof evidence.project !== 'string' || evidence.project.length === 0) fail('resource evidence project identity is missing');
  return Object.freeze({
    policyId: evidence.policyId,
    resourceClass: evidence.resourceClass,
    hostCapacity: evidence.hostCapacity,
    slotId: evidence.slotId,
  });
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null || Object.hasOwn(result, flag)) fail('invalid resource validator arguments');
    result[flag] = value;
  }
  return result;
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  for (const flag of ['--evidence', '--head-sha', '--plan-sha256']) {
    if (!Object.hasOwn(args, flag)) fail(`missing ${flag}`);
  }
  const evidence = JSON.parse(fs.readFileSync(args['--evidence'], 'utf8'));
  const result = validateResourceAdmissionEvidence({
    evidence,
    headSha: args['--head-sha'],
    verificationPlanSha256: args['--plan-sha256'],
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { runCli(); }
  catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
