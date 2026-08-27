function exactSha(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) throw new TypeError(`${label} must be an exact lowercase SHA`);
  return value;
}

function sha256(value, label) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) throw new TypeError(`${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function ids(value, label) {
  if (!Array.isArray(value) || value.length === 0 || value.some((id) => typeof id !== 'string' || !id.includes('::'))) throw new TypeError(`${label} must be non-empty stable IDs`);
  return [...value];
}

export function validateProtectedFanIn(plan, summaries) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new TypeError('plan must be an object');
  const head = exactSha(plan.candidateHeadSha, 'plan candidate head');
  const planDigest = sha256(plan.planDigest, 'plan digest');
  const expected = ids(plan.stableTestIds, 'planned stableTestIds').sort();
  if (new Set(expected).size !== expected.length) throw new TypeError('planned stableTestIds contain duplicates');
  if (!Array.isArray(summaries) || summaries.length === 0) throw new TypeError('fan-in requires summaries');

  const executed = [];
  const seen = new Set();
  for (const summary of summaries) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new TypeError('fan-in summary must be an object');
    if (summary.status !== 'success') throw new TypeError(`fan-in summary status is not success: ${summary.status ?? 'missing'}`);
    if (exactSha(summary.candidateHeadSha, 'summary candidate head') !== head) throw new TypeError('fan-in candidate head mismatch');
    if (sha256(summary.planDigest, 'summary plan digest') !== planDigest) throw new TypeError('fan-in plan digest mismatch');
    for (const id of ids(summary.executedStableTestIds, 'executedStableTestIds')) {
      if (seen.has(id)) throw new TypeError(`fan-in duplicate stable ID: ${id}`);
      seen.add(id);
      executed.push(id);
    }
  }

  const unexpected = executed.filter((id) => !expected.includes(id)).sort();
  if (unexpected.length) throw new TypeError(`fan-in unexpected stable IDs: ${unexpected.join(', ')}`);
  const missing = expected.filter((id) => !seen.has(id));
  if (missing.length) throw new TypeError(`fan-in missing stable IDs: ${missing.join(', ')}`);
  return Object.freeze({ status: 'success', candidateHeadSha: head, planDigest, executedStableTestIds: Object.freeze([...executed].sort()) });
}
