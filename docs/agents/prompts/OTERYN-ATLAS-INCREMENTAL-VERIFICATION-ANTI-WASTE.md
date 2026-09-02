# OTERYN-ATLAS-INCREMENTAL-VERIFICATION-ANTI-WASTE

**Alias:** `OTERYN-ATLAS-INCREMENTAL-VERIFICATION-ANTI-WASTE`

**Repository:** `Oteryn/Oteryn-Atlas`

**Purpose:** autonomous implementation prompt for incremental semantic verification, evidence reuse, anti-waste execution, and anti-loop hardening.

> After every major stage, obligatorily execute the **MANDATORY STAGE SELF-AUDIT** defined below. If it reports `LOOP RISK: HIGH`, `ROOT CAUSE: NOT_PROVEN`, or no justification for heavy execution, do not mechanically continue. Stop candidate churn and return to evidence/root-cause analysis.

---

## Mission

Work autonomously in:

`Oteryn/Oteryn-Atlas`

Your task is to **stabilize and simplify the Oteryn Atlas verification architecture** so that fail-closed safety and test value are preserved while eliminating unnecessary repeated browser E2E / Molehill execution after changes that do not semantically affect the tested product.

The system must evolve toward **Incremental Semantic Verification**.

Do not optimize for making one specific PR green. Optimize for making this entire class of verification-loop and verification-waste failures structurally impossible or bounded by explicit fail-closed architecture.

---

# 1. Root problem

The current system has historically bound browser/heavy evidence too strongly to the complete `candidateHeadSha`.

That can create the following sequence:

1. heavy E2E passes;
2. only control-plane/workflow/validator/pin bytes change;
3. a new commit SHA is created;
4. previous browser evidence is classified as stale;
5. another complete browser run is requested;
6. the follow-up repair changes SHA again;
7. verification can enter a loop.

This is the wrong abstraction.

**A changed commit SHA alone MUST NOT invalidate heavy browser evidence.**

SHA remains important forensic/provenance identity. Re-execution must instead be driven by the semantic dependency identity of the thing the evidence actually proves.

---

# 2. Primary architectural goal

Build an incremental evidence system in which every meaningful evidence node has:

- semantic identity;
- dependency identity;
- execution/provenance identity;
- availability/lifecycle state;
- explicit disposition such as `EXECUTED` or `REUSED`.

The planner must be able to decide:

`EXECUTE`

or:

`REUSE`

from real dependency changes.

Full E2E remains a safety net, not the default answer to governance/control-plane changes.

---

# 3. Separate provenance from semantic identity

Do not use `candidateHeadSha` as the primary validity identity of heavy evidence.

Introduce or extend a semantic browser evidence identity, for example:

`browserEvidenceSemanticDigest`

or an equivalent name consistent with repository conventions.

It should derive from all inputs that can actually change the meaning/result of the proof, including where applicable:

- runtime/browser implementation required by the evidence node;
- stable test IDs and test-body identity;
- E2E harness identity;
- verification policy that affects execution semantics;
- product identity for the required data capability;
- authority identity only to the extent that authority bytes affect the evidence semantics;
- environment identity;
- browser/Playwright/container identity;
- worker/retry/shard policy;
- other bounded dependencies that actually influence the oracle.

`candidateHeadSha` MUST still be recorded in evidence as provenance.

However:

**different candidate SHA != automatic semantic invalidation.**

Reuse requires formal compatibility proof. It must never be inferred merely because a diff looks small.

---

# 4. Evidence graph instead of one monolithic PASS

Where the dependency graph permits it, do not treat all browser scenarios as one indivisible evidence unit.

Prefer evidence nodes at a useful bounded granularity such as group/capability/stable-ID or another architecture-consistent unit.

Possible domains include, where supported by the existing catalog:

- geometry;
- search;
- animation;
- creature interaction;
- state/history;
- responsive/mobile;
- accessibility;
- visual;
- Farm Explorer;
- fault/race/resilience.

Do not create arbitrary categories if the existing verification catalog and stable-ID architecture already provide the appropriate dependency graph. Extend the current system rather than building a parallel second planner.

---

# 5. Minimal affected-set execution

The planner should:

1. identify changed semantic components;
2. map them to dependency identities;
3. determine the affected evidence nodes;
4. execute only invalidated/missing nodes;
5. reuse all still-compatible valid evidence.

Example:

A change isolated to semantic search should normally mean:

- search evidence -> `EXECUTE`;
- geometry evidence -> `REUSE`;
- animation evidence -> `REUSE`;
- unrelated responsive evidence -> `REUSE`.

A control-plane-only change to an audit, workflow, gate validator, or provenance mapping should execute the appropriate deterministic governance/control-plane tests while reusing browser evidence **if and only if** browser semantic dependency identities remain unchanged.

---

# 6. Full E2E is a safety fallback, not the planner default

Keep the complete E2E census.

Full E2E is appropriate when, for example:

- shared browser runtime changes affect most surfaces;
- the E2E harness changes materially;
- the qualification fixture/product changes in a way affecting the full census;
- the stable-ID algorithm changes;
- dependency impact cannot be proven precisely;
- protected policy explicitly requires fail-closed escalation;
- scheduled/nightly/release safety verification intentionally requests the full matrix.

Do NOT run the complete browser census merely because:

- SHA changed;
- a workflow changed;
- an audit pin changed;
- provenance JSON changed;
- a gate validator changed;
- control-plane bytes changed without a browser semantic dependency change.

Unknown impact must fail closed to broader verification, but known unaffected evidence should not be discarded mechanically.

---

# 7. Preserve Phase-D profile/capability separation

Verification profile and data capability are separate concepts and MUST remain separate.

Data capabilities include:

- `qualification_fixture`;
- `bounded_real_world`;
- `real_fullworld`.

Preserve explicit semantic metadata such as `requiresRealFullWorld` or the repository's equivalent.

Only an oracle that genuinely depends on complete real-world product bytes should normally require `real_fullworld`.

Ordinary functional E2E such as:

- NPC/monster interaction;
- cards;
- inspector;
- search;
- state/history;
- geometry;
- pan/zoom;
- floor/LOD;
- accessibility;
- responsive;
- race/fault;
- resilience;

must use the smallest immutable qualification world when their oracle does not depend on real complete-product bytes.

The qualification world must continue through the same production manifest/floor/chunk/range/digest/loader/runtime/renderer/interaction path. Do not replace it with mocks or an alternate test application that bypasses production seams.

---

# 8. Execution routing

Target routing:

### `qualification_fixture`

GitHub-hosted.

### `bounded_real_world`

GitHub-hosted whenever the bounded canonical product fits the approved hosted execution envelope.

### `real_fullworld`

Specialist execution such as Molehill when explicitly selected by protected semantic policy.

Molehill must not become a generic answer to CI problems.

Profile breadth, number of browser scenarios, accessibility, geometry, stress, or `profile=full` do not by themselves imply `real_fullworld`.

---

# 9. Molehill anti-waste invariant

This is a hard requirement.

For the same semantic evidence identity:

**the same heavy proof MUST NOT execute twice while an available, non-revoked, policy-compatible PASS already exists.**

The system should instead produce a truthful disposition such as:

`REUSED`

or:

`HEAVY_EXECUTION_SUPPRESSED_REUSABLE_EVIDENCE`

A control-plane-only commit must not restart Molehill when runtime/product/test semantic identities have not changed.

Molehill must never be invoked:

- "just in case";
- after every new SHA;
- by mechanically toggling a label;
- solely because previous proof was exact-head;
- to validate control-plane-only changes when browser semantics are unchanged;
- when compatible semantic PASS evidence already exists.

---

# 10. Merge Queue must reuse semantic evidence

Merge Queue creates a synthetic commit SHA.

That new SHA must not itself invalidate compatible browser evidence.

The merge-group gate should prove, as applicable:

- correct protected base;
- correct merge-group identity;
- exact candidate content/tree or another strictly equivalent bound identity;
- compatible semantic dependency identity;
- evidence availability;
- evidence is not revoked/expired/incompatible;
- product identity matches;
- environment identity matches;
- authority identity matches where semantically required;
- test/harness/policy identities match.

If the synthetic candidate proves the same semantic evidence identity:

`REUSE -> atlas-gate`

Do not rerun the browser matrix solely because Merge Queue generated a different commit SHA.

---

# 11. Explicit evidence disposition

Evidence lifecycle must clearly distinguish at least:

- `EXECUTED`;
- `REUSED`.

Reused evidence should preserve:

- original evidence ID;
- original execution provenance;
- current consumer provenance;
- semantic digest;
- instance/provenance digest;
- dependency identities;
- compatibility/reuse reasoning in bounded machine-readable form.

Never represent reused evidence as if a new execution occurred.

---

# 12. SHA remains important as forensic identity

Do not remove SHA from the system.

Keep at least two conceptual levels:

### Semantic identity

"Does this evidence still prove exactly the same semantic obligation?"

### Instance/provenance identity

"Where/when/on which PR, SHA and workflow run was this evidence executed or consumed?"

Semantic equality may permit reuse after formal compatibility validation.

Instance equality is not required for reuse when the dependency model formally proves compatibility.

---

# 13. Reduce verification cost without reducing coverage

The goal is NOT "fewer tests".

The goal is:

> **Do not execute a test again when its previously successful proof is still logically valid.**

The complete safety census remains available.

Expose useful summaries such as:

`planned stable IDs: 77`

`executed: 5`

`reused: 72`

`missing: 0`

`unexpected: 0`

For each node provide a bounded reason for:

- execution;
- reuse;
- invalidation;
- escalation.

---

# 14. Do not build more PR-specific bootstrap hacks

Current/historical repair work may include PRs such as:

- #268;
- #299;
- #300;
- #303.

Some recovery code may be pinned to exact PR numbers, branch refs, or historical base SHAs.

Treat that as temporary bootstrap/recovery logic, not the target architecture.

Do not solve new cases by adding an endless sequence of conditions like:

`if PR == 303`

`if branch == X`

`if base == Y`.

After stabilization, remove or tightly retire one-shot paths that are no longer necessary.

The normal mechanism must operate through semantic dependency/evidence identity, not PR numbers.

---

# 15. Do not weaken governance

Forbidden:

- weakening branch/ruleset protection;
- bypassing required Merge Queue;
- fabricating success statuses;
- synthesizing `atlas-gate=success` without authoritative proof;
- increasing retries to hide deterministic failures;
- broadening tolerances merely to turn red into green;
- reducing meaningful coverage solely because verification is expensive;
- allowing candidate-controlled approval of its own protected control plane;
- auto-approving manual/full-frame visual acceptance;
- moving ordinary E2E to FullWorld;
- invoking Molehill "just to be safe";
- using stale evidence without formal semantic compatibility validation.

Fail closed must remain intact.

---

# 16. TDD is mandatory

For every substantial semantic mechanism:

1. create the regression/contract test;
2. prove RED for the intended reason;
3. implement the smallest root-cause fix;
4. prove targeted GREEN;
5. run the appropriate wider deterministic verification.

Required regression categories include at least:

### Semantic reuse

Same browser semantic digest + different candidate SHA -> `REUSE`.

### Real semantic change

Runtime dependency digest changes -> affected node(s) `EXECUTE`.

### Product change

Qualification product digest changes -> dependent node(s) `EXECUTE`.

### Irrelevant control-plane change

Audit/provenance/workflow change with unchanged browser semantic dependencies -> browser evidence `REUSE`.

### Merge Queue

New synthetic SHA + same candidate content/tree + same semantic dependency identity -> `REUSE`.

### Tampered/stale dependency evidence

Mismatch -> fail closed / execute as policy requires.

### Revoked or expired evidence

Must not be reused.

### Missing evidence

Must execute the missing required evidence.

### Unknown impact

Must fail closed to appropriately broader/full verification rather than inventing compatibility.

---

# 17. Anti-loop invariant

Introduce a tested rule preventing an unchanged semantic identity from producing an unbounded sequence like:

`EXECUTE -> commit -> EXECUTE -> commit -> EXECUTE`.

If the same semantic problem identity repeatedly reappears without new evidence, surface a state equivalent to:

`ARCHITECTURE_STABILIZATION_REQUIRED`.

Do not keep mutating the candidate simply to create another SHA and repeat the same proof.

---

# 18. Current repair context is evidence, not timeless authority

The recent repair lane demonstrated the class of problem this task must eliminate:

- a heavy browser proof passed;
- a later control-plane change changed the commit SHA;
- the previous proof stopped being accepted;
- another heavy run was mechanically requested;
- Merge Queue generated a synthetic SHA and attempted browser qualification again;
- protected-base qualification machinery could fail for reasons unrelated to candidate runtime.

Do not assume any PR/head/run identifiers described in historical handoffs remain current.

**GitHub is the authority. Refresh all current state before mutation.**

Do not fix this architecture by adding another one-shot bootstrap.

---

# 19. Initial repository analysis

Before implementation:

1. read current `AGENTS.md` and all nearer applicable instructions;
2. resolve current GitHub `main`;
3. resolve current relevant Issue/task authority or record `NOT_APPLICABLE` only for genuinely bounded trivial work;
4. refresh current #268, #299, #300, #303 if they still exist/relevant;
5. inspect current verification catalog;
6. inspect existing planner and impact policy;
7. inspect evidence manifest/lifecycle;
8. inspect protected hosted execution;
9. inspect protected hosted gate;
10. inspect fan-in;
11. inspect verification state machine;
12. inspect Merge Queue gate;
13. inspect PR CI gate;
14. inspect authority/environment/product identities;
15. inspect existing reuse code;
16. inspect stable-ID logic;
17. inspect data-capability routing.

Do not assume the prompt's historical state is still current.

---

# 20. Prefer extending the existing architecture

The repository already has concepts such as, depending on the current head:

- `planSemanticDigest`;
- `planInstanceDigest`;
- evidence dispositions/lifecycle;
- stable IDs;
- product identities;
- authority identity;
- environment identity;
- dependency/reuse logic;
- anti-loop state.

Prefer strengthening those concepts.

Do not create a parallel verification framework unless the existing model is proven structurally incapable of supporting the required semantics.

First determine precisely why current reuse is still too dependent on candidate SHA or instance identity.

Fix the source abstraction.

---

# 21. Implementation-lane discipline

Do not endlessly expand a historical recovery PR.

Determine whether:

A. an existing recovery PR can safely serve as the minimal bootstrap required to land the semantic-reuse architecture;

or:

B. the recovery PR should remain bounded while the target incremental-verification architecture is implemented through one controlled dedicated lane.

Do not create a cascade of repair PRs.

At most one primary active implementation lane should own this architecture at a time unless clearly independent parallel lanes are explicitly planned and isolated.

---

# 22. Heavy execution rule during this task

**Do not automatically run Molehill / 77-test E2E after each commit.**

Before any heavy execution, explicitly prove all of the following:

1. which semantic dependency identity changed;
2. why existing evidence cannot be reused;
3. exactly which evidence node requires execution;
4. why deterministic/targeted GitHub-hosted verification cannot provide the required proof.

If all four cannot be proven:

`HEAVY_EXECUTION_NOT_JUSTIFIED`

and do not invoke the heavy runner.

Do not use label toggling as a mechanical retry mechanism.

---

# 23. Preferred verification order during development

Use, in order where applicable:

1. unit tests;
2. deterministic verification contracts;
3. dependency/reuse planner tests;
4. workflow contract tests;
5. targeted GitHub-hosted browser tests;
6. full GitHub-hosted qualification census only when semantic impact proves it necessary;
7. Molehill only for genuine specialist / `real_fullworld` obligations or another explicitly protected specialist oracle.

---

# 24. Definition of Done

The task is complete only when fresh terminal evidence proves all applicable requirements:

1. control-plane-only commit does not invalidate browser evidence without semantic reason;
2. new candidate SHA can reuse browser evidence when semantic dependency identity is compatible;
3. Merge Queue synthetic SHA can reuse appropriate evidence;
4. tampered/stale semantic dependencies fail closed;
5. changed runtime/product/test body invalidates the correct evidence nodes;
6. unknown impact escalates safely;
7. ordinary `qualification_fixture` E2E remains GitHub-hosted;
8. `real_fullworld` is the normal specialist/Molehill data capability;
9. same semantic evidence identity cannot trigger repeated heavy execution while a valid compatible PASS exists;
10. full safety census remains executable when required;
11. evidence summary distinguishes executed/reused/missing/unexpected nodes;
12. deterministic verification is GREEN;
13. required GitHub CI is GREEN;
14. required `atlas-gate` is GREEN;
15. Merge Queue succeeds without rerunning Molehill for a control-plane-only semantic no-op;
16. no branch/ruleset bypass was used;
17. retries were not increased to hide failures;
18. no success status was fabricated;
19. manual visual review was not auto-approved;
20. documentation and regression contracts describe the new model.

---

# 25. Final report

At completion report concretely:

- verified root cause;
- previous invalidation model;
- new semantic evidence model;
- identities that affect reuse;
- changes that cause `EXECUTE`;
- changes that cause `REUSE`;
- conditions that still cause full E2E;
- conditions that still require Molehill;
- executed vs reused counts in a representative verification plan;
- evidence that Merge Queue reuse works;
- evidence that tampering fails closed;
- exact PR/commit/workflow/run IDs used for final verification.

Do not declare success from a plan or from stale/local assumptions.

Completion requires fresh authoritative terminal evidence.

---

# MANDATORY STAGE SELF-AUDIT — ANTI-HALLUCINATION / ANTI-LOOP

After **EVERY major completed stage**, perform this self-audit before moving on.

The audit exists to detect:

- hallucination;
- unverified assumptions;
- stale evidence;
- scope drift;
- verification loops;
- unnecessary candidate churn;
- unnecessary heavy execution;
- deviation from the agreed architecture/plan.

Do not expose private chain-of-thought.

Record only concise factual conclusions, evidence, classifications, and the next action.

---

## A. FACT / HALLUCINATION CHECK

After every stage ask:

1. Which claims from this stage are verified facts?

2. What exact evidence supports them?

Prefer evidence such as:

- exact GitHub PR/head SHA;
- terminal workflow/job result;
- artifact identity/digest;
- exact diff;
- deterministic test output;
- repository bytes;
- GitHub API response;
- reproducible failure/result.

3. Am I treating anything as fact that I have not actually verified?

If YES:

- label it `UNKNOWN` / `NOT VERIFIED` / `EVIDENCE MISSING` as appropriate;
- do not use it as a premise for a mutating decision;
- gather evidence or use a safe fail-closed path.

4. Am I using evidence from an old SHA/run as proof for current state?

If YES, formally prove semantic compatibility/reuse first.

Do not assume compatibility because a change appears small.

5. Does authoritative GitHub/repository state still match my description?

If not:

`STOP — REFRESH AUTHORITATIVE STATE`

---

## B. LOOP CHECK

After every stage ask:

1. Am I about to perform an action already performed for the same semantic identity?

2. Did the previous stage end with the same failure class/signature?

3. Will the proposed fix merely change SHA and cause the same exact-head proof to be requested again?

4. Am I building:

`bootstrap -> bootstrap bootstrap -> bootstrap bootstrap bootstrap`

instead of fixing the underlying abstraction?

5. Am I about to rerun a heavy test even though a compatible valid semantic PASS already exists?

6. Did the previous attempt produce any genuinely new information?

If NO new information would be produced, do not repeat the attempt.

### Hard anti-loop rule

If a proposed attempt:

- does not change the hypothesis;
- does not change dependency identity;
- does not gather new evidence;
- does not test a new root-cause theory;

then:

`DO NOT EXECUTE`

Return to root-cause/architecture analysis.

---

## C. PLAN ADHERENCE CHECK

After every stage ask:

1. What was the goal of the completed stage?

2. Was it achieved?

Use only:

- `DONE`;
- `FAILED_WITH_NEW_EVIDENCE`;
- `BLOCKED`;
- `NO_LONGER_NEEDED`.

3. Does the next planned action still directly serve the main task?

4. Has scope drift occurred?

Examples of scope drift:

- fixing unrelated tests;
- creating unrelated PRs;
- mutating product/runtime to solve a control-plane issue;
- using FullWorld for a qualification-fixture problem;
- altering branch protection;
- increasing retries;
- opportunistic unrelated refactoring.

If detected:

`STOP SCOPE DRIFT`

Return to the original objective.

---

## D. ROOT-CAUSE CHECK

Before every new fix ask:

> Am I fixing the root cause or merely the next symptom?

Do not make another code change unless you can identify:

- observed failure;
- failing layer/component;
- input entering that layer;
- expected behavior;
- actual behavior;
- specific difference that constitutes the root cause.

If you cannot:

`ROOT_CAUSE_NOT_PROVEN`

Gather evidence first.

---

## E. HEAVY EXECUTION CHECK

Before EVERY:

- Molehill run;
- FullWorld run;
- full Playwright census;
- 77-test E2E;
- other expensive browser proof;

perform an additional audit.

You must prove all four:

1. `semantic dependency identity changed`;
2. no compatible available PASS can be reused;
3. a named evidence node actually requires `EXECUTE`;
4. equivalent proof cannot be obtained from deterministic tests, targeted GitHub-hosted tests, or evidence reuse.

If any item cannot be proven:

`HEAVY_EXECUTION_NOT_JUSTIFIED`

Do NOT start the heavy runner.

Before Molehill specifically, record concise facts:

`Changed semantic identity: ...`

`Invalidated evidence nodes: ...`

`Existing reusable evidence: ...`

`Why GitHub-hosted is insufficient: ...`

If any field is unclear, Molehill is forbidden.

---

## F. CANDIDATE CHURN CHECK

Before every new commit ask:

1. Does this commit fix a specific proven root cause?

2. Does it only change SHA without changing the semantic identity under test?

3. Will the SHA change cause the current system to request another heavy proof?

4. Should evidence reuse be fixed before creating another commit?

If the sequence is:

`new SHA -> same semantics -> heavy proof again`

that is an architecture warning, not a normal iteration cycle.

Do not mechanically continue it.

---

## G. PR / BRANCH PROLIFERATION CHECK

Before creating a new PR or branch ask:

> Can the existing authorized implementation lane safely contain this change?

If YES, do not create another PR.

A new PR requires a concrete architectural or isolation reason.

Do not use:

`repair of repair of repair`

as a mechanism for escaping a verification deadlock.

---

# THREE-STRIKE ARCHITECTURE BREAKER

If three consecutive fixes in the same area:

- expose another bootstrap layer;
- require another special-case exception;
- trigger another heavy execution;
- or merely move the same problem between PR gate and Merge Queue;

immediately stop candidate churn.

Set:

`ARCHITECTURE_STABILIZATION_REQUIRED`

Do not implement a fourth similar patch.

Instead:

1. describe the common failure mechanism;
2. identify the wrong abstraction;
3. design the model-level correction;
4. add architectural regression tests;
5. only then implement the corrected model.

---

# EVIDENCE FRESHNESS RULE

Before consuming evidence validate, where applicable:

- repository;
- PR number;
- branch/ref;
- base SHA;
- candidate SHA provenance;
- semantic digest;
- product digest;
- test census digest;
- environment digest;
- execution policy;
- workflow/run identity;
- run attempt;
- terminal result;
- availability/revocation/expiry.

Do not require SHA equality where the new architecture formally proves semantic reuse.

But never assume semantic reuse without validating the relevant dependency identities.

---

# UNKNOWN INSTEAD OF GUESSING

When data is missing, do not fill gaps with a plausible story.

Use explicit states such as:

- `UNKNOWN`;
- `NOT VERIFIED`;
- `EVIDENCE MISSING`;
- `STALE EVIDENCE`.

Missing evidence is not proof of product failure.

Missing evidence is also not PASS.

---

# MANDATORY STAGE CHECKPOINT OUTPUT

After every major stage emit a concise checkpoint using exactly this semantic structure:

`STAGE: <name>`

`RESULT: DONE | FAILED_WITH_NEW_EVIDENCE | BLOCKED | NO_LONGER_NEEDED`

`FACTS VERIFIED: <concise evidence-backed facts>`

`UNKNOWN: <missing information or NONE>`

`ROOT CAUSE: PROVEN | NOT_PROVEN`

`PLAN DRIFT: NO | YES`

`LOOP RISK: NONE | LOW | HIGH`

`HEAVY EXECUTION NEXT: NOT_NEEDED | JUSTIFIED | FORBIDDEN`

`NEXT ACTION: <one concrete action>`

This checkpoint must not contain private chain-of-thought.

It contains only the result of the audit.

---

# FINAL PRE-ACTION SANITY CHECK

Immediately before every repository mutation or expensive CI execution ask:

> If I do NOT perform this action, what exact missing evidence will still be missing?

If you cannot name a concrete missing evidence obligation:

**do not perform the action.**

---

# FINAL COMPLETION SELF-AUDIT

Before declaring completion verify:

1. Do I have fresh terminal evidence?
2. Does GitHub authority match my report?
3. Am I accidentally presenting an old SHA as current?
4. Am I describing partial success as complete success?
5. Was Merge Queue actually verified if required?
6. Was no required gate bypassed?
7. Was no status fabricated?
8. Did I avoid unnecessary Molehill execution?
9. Was existing PASS evidence reused wherever semantic compatibility proved it valid?
10. Is the repository left in a simpler, more general architecture rather than with another one-shot exception layer?

If any answer remains uncertain, do not report `DONE`.

Use the truthful state, for example:

`BLOCKED`

or:

`ARCHITECTURE_STABILIZATION_REQUIRED`.

---

# FINAL OPERATING PRINCIPLE

Do not optimize for:

> "How do I make this one PR green?"

Optimize for:

> **"How do I make this class of problem unable to recur through the normal architecture?"**

A green result achieved by stacking special-case exceptions is not architectural success.

Success means the next equivalent change follows the normal path, reuses valid evidence when semantics are unchanged, executes only invalidated obligations, and reaches the required protected Merge Queue without unnecessary specialist work.
