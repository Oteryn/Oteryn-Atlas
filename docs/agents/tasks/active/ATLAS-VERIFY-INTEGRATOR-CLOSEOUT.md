# ATLAS-VERIFY-INTEGRATOR-CLOSEOUT — active checkpoint

Status: **INCOMPLETE / HANDOFF REQUIRED**

Lifecycle authority: `Oteryn/Oteryn-Atlas#85`
Coordinator contract: `docs/agents/prompts/ATLAS-VERIFICATION-INTEGRATION-COORDINATOR.md`
Continuation prompt: `docs/agents/prompts/ATLAS-VERIFY-INTEGRATOR-CLOSEOUT-CONTINUATION.md`
Continuation plan: `docs/superpowers/plans/2026-08-24-atlas-verify-integrator-closeout-continuation.md`

Checkpoint time: 2026-08-24 Europe/Warsaw.
GitHub authority at checkpoint:
- current `main`: `319d85c36ffa626403adf2b701748c13eac1592b`;
- branch protection still requires `atlas-gate` and `provenance-gate`;
- Issue #85 is OPEN / reopened;
- Issue #105 is OPEN;
- Issue #109 is OPEN;
- Issue #111 is OPEN;
- Issue #121 is OPEN.

Do not declare #85 complete from this checkpoint. Refresh GitHub before every mutation because `main` and the open verification PRs are moving concurrently.
## Terminally completed lineage

- Verification foundation PR #87 merged as `69dee2a867b5b335b148164fc0ea1b47de816423`.
- Race/fault PR #96 merged as `e95445ce5fa8b0dfc71f9ea95d2ee3128d7504fd`.
- Performance/soak PR #97 merged as `d90089805b8d5646d36af7c779958e14cd7861f8`.
- Visual/a11y PR #99 merged as `4a88b5a256c818e55eb52d8e285b9c811c6eec0a`.
- Visual/a11y follow-up PR #100 merged as `c36f93bd5a20032547687f5936ab66ed1e7d4339`.
- CI/nightly integrator PR #98 merged as `b0f2827965fcf02294456c1bdb3ff8242048b433`.
- Runner-role separation PR #106 merged as `db5de3938ef815fb467dd2ad911a1ed92b13dccf`.
- Runner-context parse fix PR #122 merged as `74ee3086e3a8b128f7fd5f83069417759416c0dc`.
- Legacy extraction closeout PR #103 merged as `e35efcc3e518aff61458ef7aa1b154f9f267a5e4`; Issue #102 is CLOSED/completed and its task branch is deleted.
- Creature animation completeness PR #112 merged as current `main@319d85c36ffa626403adf2b701748c13eac1592b`; Issue #108 is closed by that merge.

Historical failed nightly evidence must be preserved:
- run `32649146414`, browser artifact `9497081732`: Synology placement/capacity failure;
- run `32726232049`, browser job `97428026708`: correct Molehill runner selected, but `shell: pwsh` failed with `pwsh: command not found` before checkout.
## Active repair PR #126

PR #126: `fix(ci): use Windows PowerShell for Molehill nightly`.
Task branch: `fix/issue-109-molehill-shell`.
Checkpoint head before this handoff commit: `c73d3ffe6dfb92e9848538cd3dafa1e62ca81739`.
Its base is stale relative to current main and MUST be refreshed before merge.

TDD evidence already proved:
- RED commit `8d68cf4`: 10 PASS / 1 expected FAIL; only failure proves four Molehill nightly steps still request `shell: pwsh`;
- GREEN `c73d3ff`: exactly four `pwsh -> powershell` changes plus the permanent shell regression;
- focused workflow contracts: 11/11 PASS;
- full deterministic Node/contract/property matrix: 183/183 PASS, 0 fail/skip;
- `git diff --check`: PASS;
- PR #126 review threads: 0;
- hosted deterministic/repository/semantic/WebGL/provenance/CodeQL checks were green except the expected exact-head local browser gate.

Do not merge #126 on the basis of these checks alone. Its final exact-head local Docker qualification has NOT passed.
## Latest exact-head browser failure — DO NOT CONVERT TO PASS

The isolated PR #126 Docker qualification at `c73d3ffe6dfb92e9848538cd3dafa1e62ca81739` produced:
- artifact summary: `artifacts/e2e/atlas126-final-c73d3ff/summary.json` on Molehill-PC;
- target mode: `checkout-overlay`;
- publication origin: `http://192.168.1.2:8097`;
- workers: 1;
- scenarios: 48 total, 47 PASS / 1 FAIL;
- retries: 0;
- failed scenario: `stress-desktop.spec.mjs / seeded interaction sequence preserves committed renderer/creature geometry`;
- deterministic seed: `133`;
- first failing action index: `7`, action `{"type":"pan","dx":-32,"dy":-78}`;
- failure: `HTTP 502 .../fullworld/pixel-buckets/buckets/12.rgba`.

Nginx evidence for the same request reported `connect() failed (111: Connection refused)` to the Windows-local publication forwarder (`host.docker.internal:49889`). Other publication requests were returning 200/206. The forwarder stdout contains only its READY line and stderr is empty; the process was no longer alive by diagnosis time.

FACT: the failed request was refused at the local forwarder boundary, not returned as a 502 by Synology.
UNKNOWN: why the forwarder process disappeared. Do not label this a product defect or forwarder defect until reproduced under a serialized, ownership-safe run.

No `atlas-local-e2e=success` may be published for `c73d3ff`.
## Remaining programme work

1. Refresh/rebase PR #126 onto current GitHub `main` and re-review the exact diff.
2. Reproduce the forwarder disappearance only after proving Molehill has no competing heavy E2E/cleanup process. PR #118 introduces a machine-wide heavy-run lock; account for its status before changing the forwarder.
3. If the forwarder failure reproduces, add a permanent deterministic regression before fixing it. If it does not reproduce and evidence proves external interruption, record that classification explicitly; do not hide the failed run.
4. Qualify the refreshed exact PR #126 head with the repository-required current scenario count (current main after #112 uses 50), workers=1, retries=0; publish `atlas-local-e2e` only through the repository publisher.
5. Merge #126 only with exact-head `atlas-gate` + `provenance-gate` and applicable security checks green.
6. Complete PR #118 / Issue #111 on top of the then-current main. It owns required user-facing visual acceptance and reviewed full-frame evidence.
7. Complete Issue #121 Firefox/WebKit real-browser depth; it explicitly declares #85 as parent and follows #111.
8. After the final verification-related merge, run post-merge CI/provenance/CodeQL and Synology Live Acceptance on one exact final `main` SHA.
9. Verify live `X-Oteryn-Atlas-Revision` equals that exact current main SHA.
10. Dispatch/run `Verification Nightly Depth` on the same final SHA and require deterministic + Molehill browser-depth SUCCESS. Preserve stress seeds `133`, `1096043585`, `2779096485`, `3735928559` and zero hidden retries.
11. Close #109 and #105 only after their post-merge acceptance is satisfied.
12. Add line-by-line terminal evidence to #85 and close it only after every applicable DoD item and all parent-programme follow-ups are terminally evidenced.

Do not mutate Oteryn-Game for this closeout. Do not weaken retries, timeouts, tolerances, allowlists, assertions, provenance, runner identity or deployment authority.