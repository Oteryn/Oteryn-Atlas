# ATLAS-E2E-OPT-LANE-A-PROTECTED-HOSTED-CONTROL-PLANE

ALIAS:
`ATLAS-E2E-OPT-LANE-A-PROTECTED-HOSTED-CONTROL-PLANE`

EFFORT: Extra High

SCOPE:
Build/review the protected authoritative hosted plan/execution/fan-in boundary for Issue #179. Work on an isolated branch/worktree. Do NOT merge/retarget #208/#209/#213, publish `atlas-local-e2e`, alter branch protection or enable selective execution.

MANDATORY START:
Resolve protected `main`, #208, #209 and #213 fresh. Read the main implementation prompt, P0 amendment, data-capability amendment, coordinator prompt and final handoff. Reuse current protected policy-v2 implementation; do not recreate it from summaries.

GOAL:
Provide a reviewable delta the coordinator can integrate after #209 is protected, covering protected v2 plan authority plus GitHub-hosted execution and exact fan-in.

REQUIRED DESIGN:
- protected code owns trusted catalog/impact/schema/parser/stable-ID algorithm/lower bound;
- changed-file evidence includes rename source+destination and cross-checks GitHub API vs exact merge-base diff;
- protected-base census is non-removable lower bound;
- candidate census may only ADD newly introduced stable IDs and must be obtained in an unprivileged/no-secrets/no-LAN sandbox or equivalent safe isolation;
- exact plan IDs = `(protected census union accepted candidate census) intersect selected browser group specs/projects` plus explicit catalog IDs;
- candidate policy can widen but never narrow;
- `full` profile does not imply FullWorld;
- only `requiresRealFullWorld` / `dataCapability=real_fullworld` can select specialist execution.

IMPLEMENT/PROVE:
1. TDD negative cases for candidate deletion/replacement of protected IDs, newly added candidate tests, duplicate IDs, unsupported projects/specs and sandbox census failure.
2. Protected v2 planner binds head/base/merge-base/diff/catalog/impact/stable-ID algorithm/worker-policy/product identities and exact stable-ID digest.
3. Hosted executor consumes an already-published protected plan; it never invents/narrows selection.
4. Stale-head fence occurs before expensive execution and again before evidence acceptance.
5. Fan-in requires exact stable-ID set equality; missing/unexpected/duplicate IDs, retries, skips, stale head, wrong plan digest, cancellation or sibling partial evidence fail closed.
6. PR-scoped concurrency cancels superseded expensive hosted runs without letting cancelled evidence satisfy a new head.
7. Fork/untrusted candidates cannot reach Molehill/private LAN or trusted credentials.
8. Keep `selectiveExecution=false` until Phase F cutover; this lane establishes correctness authority, not savings activation.

TESTS:
Use narrow Node contract tests first, then workflow contract/static tests. Do not run full physical E2E. Provide commands/results and `git diff --check`. If a GitHub PR is opened, keep it draft/stacked and explicitly non-merge-ready until the coordinator rebases it onto protected #209/main.

HANDOFF OUTPUT:
Commit/push all work to a dedicated branch; update the PR/body or add a repository checkpoint stating base SHA, head SHA, changed files, tests, unresolved integration assumptions and exact files/interfaces the coordinator must consume. Return only FACTs, no completion claim for #179.
