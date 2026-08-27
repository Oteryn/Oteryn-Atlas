# ATLAS-E2E-VERIFICATION-OPTIMIZATION-FINAL-CLOSEOUT-COORDINATOR

ALIAS:
`ATLAS-E2E-VERIFICATION-OPTIMIZATION-FINAL-CLOSEOUT-COORDINATOR`

ROLE:
Single authoritative closeout coordinator for `Oteryn/Oteryn-Atlas` Issue #179.

MISSION:
Finish the complete `ATLAS-E2E-VERIFICATION-OPTIMIZATION-IMPLEMENTATION` lifecycle through protected-main merge, hosted Phase E measurements, Phase F shadow/cutover proof, administrative/full-safety proof and terminal #179 closeout. Do not stop at another handoff or intermediate green PR.

MANDATORY STARTUP:
1. Resolve protected `main`, branch protection, required checks and rulesets fresh from GitHub.
2. Resolve PRs #208, #209, #213, #195, #200 and Issue #179 fresh; never trust the SHAs below if GitHub moved.
3. Read the implementation prompt plus both P0/data-capability amendments and `docs/agents/tasks/active/ATLAS-E2E-VERIFICATION-OPTIMIZATION-FINAL-HANDOFF.md`.
4. Inspect all lane PRs/branches listed in that handoff before duplicating work.
5. Treat `UPSTREAM_ADVANCED` as reconcile, not restart.

KNOWN CHECKPOINT AT HANDOFF CREATION (discovery hints only):
- protected main: `b26f4fdf5a80581eaf699815023c7aaadc01d42f`;
- #208 head: `9564aa6724da19ba32781c1a3ebefc53996bb851`, mergeable, non-draft;
- #208 exact physical qualification: 77/77 PASS, 0 failure/skip on that SHA; visual review/status publication still required;
- #209 head observed locally/remote: `a4e85d1d599be58f35e9b67e66c4011f08556e12`;
- #213 authoritative remote advanced beyond earlier checkpoints; resolve fresh;
- #195 and #200 remain historical drafts and MUST be rebuilt after their prerequisites merge.

PARALLEL EXECUTION MODEL:
The coordinator may run the four prepared lane prompts concurrently, each on its own branch/worktree. Lane agents MUST NOT merge/retarget protected-main PRs, mutate branch protection, publish legacy local statuses, or enable selective execution. The coordinator alone owns integration order and authoritative acceptance.

Prepared lanes:
- `ATLAS-E2E-OPT-LANE-A-PROTECTED-HOSTED-CONTROL-PLANE`
- `ATLAS-E2E-OPT-LANE-B-HOSTED-QUALIFICATION-BROWSER`
- `ATLAS-E2E-OPT-LANE-C-PHASE-E-HOSTED-BENCHMARK-HARNESS`
- `ATLAS-E2E-OPT-LANE-D-PHASE-F-SHADOW-BACKTEST`

SEQUENTIAL CRITICAL PATH — DO NOT PARALLELIZE THESE MUTATIONS:
1. Finish #208 exact visual review, bind it to the exact 77/77 summary + plan, publish `atlas-local-e2e`, rerun failed checks on the SAME SHA, require `atlas-gate` + `provenance-gate` green, merge with expected-head fencing, re-resolve main.
2. Reconcile #209 onto merged #208/main; qualify under protected controller; keep selective execution disabled; merge only exact-head green; re-resolve main.
3. Integrate protected hosted controller/executor/fan-in work from Lane A and hosted-Q runtime work from Lane B into final Phase D. Candidate census may widen protected census but may never erase protected-base IDs.
4. Require final Phase D full functional hosted plan with `requiresRealFullWorld=false` / empty real-FullWorld groups unless an explicit complete-product oracle is selected.
5. Require exact zero-retry hosted full-safety evidence, current-head fences before expensive execution and final fan-in, exact stable-ID set equality and immutable publication readiness.
6. Merge final Phase D; only then rebuild Phase E.
7. Merge measured Phase E; only then rebuild/activate Phase F.
8. Cut over selective execution only after zero unexplained false negatives, full current-main safety net, force-full widening and tested `SELECTOR_ESCAPE`.
9. Perform final administrative/concurrency/rights/provenance/Synology/Molehill audit and close #179 only when every acceptance criterion is terminal.

NON-NEGOTIABLE ARCHITECTURE:
- verification profile and data capability are independent;
- `qualification_fixture`, `bounded_real_world`, `real_fullworld` are semantic data capabilities;
- `profile=full` MUST NOT imply `real_fullworld`;
- ordinary functional E2E runs GitHub-hosted on immutable qualification fixture through production publication/manifest/floor/chunk/range/digest/loader/runtime/render/interaction seams;
- B is small canonical real-source compatibility only;
- F is complete-product specialist proof only and is the only capability allowed to route to Molehill;
- Synology is deployment-only;
- retries remain zero; no widened tolerances/sleeps/skips;
- exact stable IDs, not counts, are correctness identity;
- impact selection is union(all matching rules) + cross-domain escalation + dependency closure;
- candidate policy/census can widen protected lower bound but cannot narrow it;
- full fan-in rejects missing, unexpected or duplicate IDs and stale/cancelled/mismatched evidence;
- protected plan/fan-in must be from protected authority; do not execute untrusted candidate code under `pull_request_target`;
- ordinary candidate execution may run in normal GitHub-hosted `pull_request` isolation without trusted secrets/LAN;
- restricted visual/private bytes never enter public artifacts.

PC USAGE:
Use Molehill only for the transitional legacy #208/#209 status gate while that protected requirement still exists, or for an explicitly protected-plan-selected `real_fullworld`/native/private specialist group. Never use it to avoid normal hosted CI. Synology must not run ordinary browser/depth verification.

MERGE DISCIPLINE:
Before every merge: re-resolve protected main/head/checks; compare actual diff; reject stale evidence; merge exact expected head only; verify merged SHA and post-merge required checks. Do not force-push merely because main moved.

STOP CONDITION:
Do not stop because Phase D, Phase E or Phase F is individually green. Stop only after #179 is closed against a freshly resolved protected-main state and the final report separates FACT / INFERENCE / UNKNOWN with exact SHAs, checks, stable-ID census, execution policy, benchmark evidence, selector proof and remaining external blockers (if any).
