# ATLAS-CI-TEST-BUILD-RESTORATION-PROGRAMME-LEAD

Lifecycle: `Oteryn/Oteryn-Atlas#315`  
Alias: `Oteryn: Atlas Restoration Lead`  
Execution profile: Astra Mid lead; Sol High architecture veto; Astra Low/Mid bounded work.

This is a fresh independent continuation of an existing programme. Treat live GitHub code, tests and current authority as evidence; do not inherit architectural conclusions from earlier agent sessions merely because they already exist in PR #390. This prompt is a task-specific delta over the META policy selected by `docs/agents/META_AGENT_POLICY_BINDING.json`.

## Outcome

Complete the still-authorized R1–R3 CI/test/build restoration work with the smallest truthful, maintainable verification architecture, then prepare the exact protected-admission transition needed for normal integration. Do not start R4, shadow execution, product canaries, FullWorld/Molehill execution, blocking promotion, publication or deployment.

Expected checkpoint to refresh, not assume: protected `main@6a4172d518dd85b6447d6a4785eb0f87fc6c8a46`; #387 bootstrap consumed; #388 integrated normally; #376 completed; #315 open; current candidates #389/#390. Keep #389/#390 unmerged until the correction and simplification gate below passes.

## Scope

- Refresh only live `main`, #315, #389/#390, applicable rulesets/checks and the small central source set needed for the current decision. Do not restart the historical audit or reread the suspended workflow corpus unless a relevant authority/input revision changed.
- Astra Mid is Programme Lead/Integrator. Before delegation classify work as `mechanical`, `implementation`, `architectural`, `oracle/correctness`, `trust/security`, `adversarial` or `execution/integration`.
- Use Astra Low for inventories, path/census comparison, repetitive classification and bounded edits; Astra Mid for implementation/integration; Sol Medium only for bounded semantic ambiguity; Sol High for architecture, trust, oracle, FullWorld, anti-overengineering and final adversarial review. High effort is not the default and must not be selected merely because a diff is large.
- Safety-critical design follows: Astra identifies -> Sol High designs/reviews -> Astra Mid implements -> different independent Sol High reviews. `CHANGES_REQUIRED` blocks integration.
- **Read once per revision.** Maintain a compact context/invalidation ledger keyed by exact file/blob or authority revision. Once a shared file has been inspected and its relevant invariants recorded, do not reread it merely to reconstruct known context. Reread only when its revision changed, a needed fact is absent, or independent review intentionally requires a fresh source read. Invalidate only affected ledger entries, not the whole programme.
- Give subagents only current main SHA, relevant authority facts, exact lane files, unresolved question and expected output. Do not pass the full parent transcript or ask multiple subagents to reread the same large catalog/manifest/audit. Prefer targeted symbol/range/search reads.
- Resolve the current changed-test trust concern before any admission request. Reproduce with an **actual candidate filesystem byte mutation**: protected metadata owns `tests/example.mjs` with its baseline source hash, candidate changes that file, planner selects its canonical owner, and execution must safely run the candidate version without requiring protected metadata repin. Changing only `changedFiles` metadata is not a valid regression. Protected policy may own path/group/interpreter/command shape and reviewed dependency semantics; candidate bytes are test subjects, not policy authority. Source hashes may protect authority/helpers or unchanged transitive/dedup assumptions, but must not self-freeze ordinary changed leaf tests.
- Audit canonical metadata duplication. If `verification-catalog.json` remains the ownership/execution source of truth, derive changed-test -> owner directly from it where possible. Keep `impact-manifest.json` for product/source semantic impact and only explicit additional obligations; do not manually store the same test-to-owner fact twice without a concrete reason.
- Review `execution-producer.mjs`, `verification-execution-contract.mjs` and adjacent fan-in/review transport. Retain semantic/trust contracts required for safe R4; defer speculative GitHub artifact naming, API transport, receipt plumbing or workflow-specific details that have no current consumer. Every retained layer must own a distinct trust boundary/invariant.
- Review `deployment-execution-contract.mjs`. Preserve only the inactive semantics needed now: merged-main identity, qualification-before-cutover, previous-revision retention/rollback proof and isolation. Defer future deployment orchestration that is not required by an authorized R1–R3 invariant.
- Preserve FullWorld fail-closed behavior: ordinary E2E uses minimum truthful capability; `qualification_fixture`, `bounded_real_world` and `real_fullworld` stay independent; schema-only/local PASS claims do not authenticate complete product; genuine complete-product proof remains specialist-only. Independent verifier complexity is acceptable where it prevents producer/verifier circularity.
- Historical workflow-contract tests should be rewritten to semantic invariants, not restored workflow filenames. Do not invent replacement control-plane objects solely to give an old test something analogous to inspect.
- #389 is an admission transition only. If #390 changes, regenerate #389 from the exact final diff with exact A/M paths, no prefixes or unused historical union, rerun maintenance policy regressions and obtain fresh independent review. Any older exact-head owner authorization becomes stale. No bypass is currently authorized.

## Atlas invariants

- One canonical editable ownership/execution policy where practical; older ownership registries are generated projections/pointers, not parallel authorities.
- A changed deterministic test executes the candidate test itself or a proven owner. Optimization/deduplication may fail closed without preventing ordinary candidate-byte testing.
- Candidate metadata may widen required proof but cannot narrow protected obligations or become protected execution/admission authority.
- Product/source impact and test ownership are separate concerns. Unknown/unowned executable impact remains explicit/fail-closed.
- Every current deterministic entrypoint has truthful interpreter/command ownership; imports/subprocess edges are modeled only when proven and overlapping roots do not silently duplicate or omit execution.
- Every current Playwright spec has one canonical machine owner. Visual review is additive and exact; machine PASS never discharges restricted review.
- `e2e.full` may be a conservative aggregate alias but must not become a duplicate routine execution job when child groups define exact work.
- Profile and data capability remain separate. Routine functional E2E must not require the ~FullWorld product; only a genuine complete-product oracle may set `real_fullworld` / `requiresRealFullWorld=true`.
- Equivalent PR and Merge Queue content yields equivalent semantic obligations even though run/event identity differs.
- The target architecture must be materially simpler than the retired control plane. Do not replace workflow sprawl with a maze of registries, controllers, promotion layers or receipts.
- Repeated exceptional bootstrap/bypass transitions are not normal operation. A further self-freeze after the current migration candidate triggers Sol architecture review of the maintenance authority model before requesting another exception.

## Acceptance

Before requesting any owner admission decision:

- The actual changed-test byte-mutation regression fails before the fix and passes after it; no ordinary changed leaf test needs a protected metadata repin merely to run.
- All current deterministic tests have truthful once-only effective coverage; all current Playwright specs and required visual frames have canonical ownership; exact current counts are reported rather than assumed.
- Test-to-owner duplication that can be derived from the canonical catalog is removed or generated; any remaining duplicate fact has an explicit semantic reason.
- R4 transport/fan-in code is classified as `required-now` or `defer-to-R4`, with redundant adjacent validation removed; deployment code is similarly bounded to current semantics.
- FullWorld/provenance remains fail-closed and no local fixture/receipt is misrepresented as protected or complete-product evidence.
- Focused red/green regressions pass first; if shared execution/routing semantics changed, run the complete current verification/maintenance suite with zero skips/retries and record exact results.
- Independent Sol High reviews the exact final candidate and answers explicitly: changed candidate tests run; candidate bytes cannot become authority; ownership is canonical once; unknowns fail closed; ordinary E2E avoids FullWorld; bounded-real/visual/provenance semantics are truthful; PR/MQ semantics agree; R4/deployment abstractions are minimal; no normal-test self-freeze remains. Required verdict: `PASS`, `CHANGES_REQUIRED` or `BLOCKED`.
- Only after Sol `PASS`, regenerate and independently review the exact #389-style protected-admission candidate. Ordinary implementation integration after that must use required checks and Merge Queue; do not activate R4.
- Continue autonomously through authorized R1–R3 work. Stop only when the exact final admission candidate is ready for the minimal owner decision, or a genuine external/protected blocker remains after all independent authorized work is exhausted.
- Final report: protected main SHA; final implementation/admission PR heads; changed-test regression evidence; deterministic/browser/visual counts; canonical sources and duplication removed; R4/deployment deferrals; FullWorld disposition; exact test results; Sol verdict; remaining UNKNOWNs; exact next owner action.
