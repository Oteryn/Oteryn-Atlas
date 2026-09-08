> Current continuation: see [inactive execution readiness](execution-readiness.md). The preparation evidence below records the earlier baseline and is historical; it does not override current Issue #315 or the current canonical catalog.

# Verification restoration — admissible preparation

Baseline: protected `main@f00815858bb5b031c502ad19fb96a05ff66b4d84`.
Lifecycle: [#315](https://github.com/Oteryn/Oteryn-Atlas/issues/315), still
`PAUSED_BEFORE_VERIFICATION_RESTORATION`. This is a bounded maintenance change,
not a resumption decision or qualification of the future verification system.

## Delivered change and exact evidence

The candidate deletes only these two obsolete executable contracts:

- `tests/verification/anti-loop-transition-compose-contract.test.mjs`
- `tests/verification/bootstrap-catalog-workflow-contract.test.mjs`

Both paths were already authorized for deletion by protected-base
`docs/maintenance/OBSOLETE_VERIFICATION_CONTRACTS.json`. Their baseline execution
fails with ENOENT while reading intentionally absent workflows. Neither the
inventory nor protected admission is changed. The rest of this candidate is
preparatory documentation with per-file source evidence, not executable routing.

`validation.json` records 35 passing focused maintenance/planner/impact tests,
zero failures, zero skips, and static completeness checks against the exact Git
tree. These checks are not restoration canaries or product CI acceptance.

The audit in [#385](https://github.com/Oteryn/Oteryn-Atlas/pull/385) is open at
`3f1be95378bbd0e9938edbcdd3550c805ce01487`; its baseline remains current. Its useful
findings are carried forward, with the following more precise evidence:

| Evidence | Result and limit |
| --- | --- |
| `contract-ownership.json` | All 198 baseline `tests/**` files classified; 190 deterministic entrypoints, eight supporting/browser-harness files. |
| Verification contracts | 137 baseline contracts: 98 provisionally retained, 28 rewrite, nine historical, two retirement candidates removed here. |
| Absent workflow references | 56 contracts contain such literals; 17 use them only as identity fixtures. The other 39 are file/presence-contract candidates, not a claim that all 39 were executed and failed. |
| Deterministic ownership | 53 entrypoints lack direct catalog ownership; 11 are registered transitively through imports, leaving 42 effective catalog gaps. |
| Actual command authority | `tools/verification/run-protected-admission.mjs:152` reads the absent active `ci.yml` to resolve deterministic commands. Catalog declarations alone do not prove execution. |
| `browser-ownership.json` | All 36 specs have inspected oracles and proposed semantic concerns; 33 fixture, two bounded real, one real FullWorld. Matches the current capability inventory exactly. |
| Visual obligations | Nine specs explicitly capture full-frame scenarios. Current visual catalog ownership covers only the two broad visual specs; capture can silently return `not-captured` when disabled. |

The candidate has 135 remaining verification contracts and 188 deterministic
entrypoints. The complete ownership and routing closure are still **BLOCKED**,
not PASS. Provisional classification is not permission to skip, quarantine, or
delete any additional contract.

## Concrete next changes, in dependency order

These are implementation specifications for the next authorized phase. None is
an active catalog, execution entrypoint, allowlist, or alternative admission path.

1. **Reset command ownership.** Replace the absent-workflow command parser with
   protected catalog-owned exact entrypoints. Separate Node and Python commands;
   do not pass Python files to `node --test`. Resolve test-to-test imports to avoid
   duplicate registration while preserving independent semantic ownership. Keep
   browser HTML harnesses as browser proofs, not falsely counted Node tests.
2. **Reset historical contracts.** Review each of the 28 rewrite and nine historical
   rows. Preserve candidate/base identity and negative trust tests that merely use
   old filenames as fixtures. Extract valid behavior assertions from workflow
   topology assertions. Additional deletion needs a previously protected exact
   inventory entry; changing that inventory and deleting in one candidate remains
   forbidden. Do not redirect tests to archives merely to make them green.
3. **Close #376 with regression-first routing.** An isolated
   `src/browser/creature-gameplay-profiles.mjs` change must select gameplay
   deterministic/functional proof and the bounded real gameplay source contract.
   The source-contract spec must route to its own bounded owner. Ordinary gameplay
   specs remain fixture capable. Assert no FullWorld group is selected. These
   bindings are still missing in the active model; #376 must remain open.
4. **Split browser ownership.** Use the per-spec oracle rows to separate smoke,
   search/navigation/state, creature interaction/gameplay/presentation, geometry
   and render synchronization, shell accessibility/responsiveness, fault/race,
   farm explorer, cross-feature journeys, source contracts, and visual review.
   Multiple semantic concerns in a row are not permission to execute a spec twice.
   Bind a deduplicated exact test-ID execution set to every applicable group and
   preserve independent review obligations. `e2e.full` remains broad/fallback proof.
5. **Expose expensive workloads.** Performance and stress assertions currently
   prove normalized fixture behavior, not complete-world scale or timing SLOs.
   Give performance/stress and soak their resource semantics and separate bounded
   PR cases from rotating scheduled depth. Do not make a performance filename
   imply real FullWorld. A request-only census/source proof should not launch a
   browser unless a remaining assertion actually needs rendering.
6. **Make visual proof explicit.** A selected restricted-review obligation must
   require full-frame artifacts, exact test result, screenshot digests and an
   independent reviewer who inspected them. Machine execution of overlapping
   specs cannot satisfy or erase review. Split broad chrome visual scenarios from
   creature-only scenarios before narrowing creature routing. A missing required
   capture fails closed; it cannot become a successful `not-captured` result.
7. **Close all routes.** Include exact changed test/owner selection; newly added or
   unknown files cannot be silently covered by a broad prefix whose group omits
   them. Union protected and candidate requirements, include rename-source paths,
   preserve capability and evidence floors, and reject missing ownership. For
   unclassified complete-product changes, stop qualification on unresolved oracle
   requirements rather than claim generic fixture breadth proves full-product
   correctness. Broad verification profile is not all specialist capabilities.

The proposed deterministic families in the ledger are initial ownership
boundaries, not an accepted final impact model. In particular, the broad
browser-runtime and world-pipeline buckets must be refined by actual producer,
consumer and fixture dependencies before selective activation. Do not replace
the 42 gaps with one massive deterministic glob.

## Admission and activation transitions

**FACT:** current protected validator admits ordinary documentation/governance
paths and exactly the two obsolete deletions above. Planner, impact-manifest,
additional contract changes and active workflows are frozen. F01–F16 is complete;
remaining mechanical entries in that remediation allowlist do not authorize
repurposing its lanes for a new restoration programme. A draft PR is not a scope
exception. The owner's programme prompt expressly preserves #315's stop point.

Minimal owner decisions are separable:

| Transition | Required concrete change | Still prohibited |
| --- | --- | --- |
| Preparation implementation | Owner records in #315 that R1–R3 contract/ownership/routing implementation may resume, identifying its exact bounded paths and acceptance. A separate approved protected admission transition must admit those paths before their integration. | Shadow, canaries, product blocking, deployment/publication. |
| Shadow activation | Owner explicitly resumes R4–R5 in #315 after R1–R3 correctness and independent review; approved workflow transition preserves protected-base policy and candidate isolation. | Blocking promotion before canary acceptance; deployment/publication. |
| Blocking promotion | Qualified representative PR/MQ evidence plus independent pre-promotion review; align the one stable product fan-in with rulesets without creating an unproducible required context. | Direct merge, status fabrication, bypass, unrelated environment changes. |

Current admission self-freezes `tools/maintenance/**`, the remediation allowlist,
the obsolete inventory and workflow transitions. A candidate cannot authorize
its own transition, even after an issue comment. The protected transition needs
an independently authorized repository/GitHub authority mechanism that preserves
the required check and Merge Queue. **UNKNOWN:** a currently available permitted
mechanism for that self-frozen transition. No new bootstrap branch, PR-number
exception, authority parser or ad-hoc bypass is proposed here.

The reviewable state ready now is this maintenance candidate and its exact
per-file ledgers. There is no hidden R1–R3 implementation branch, patch, restored
workflow, or pending background execution. A later lead should reuse unchanged
blob evidence from `context-ledger.json` and reconcile only changed inputs.

## Required closure checks after implementation authority

Add regression-first, table-driven checks for the actual protected catalog and
planner, including these negative cases. A design table is not executed evidence.

| Input | Required proof | Negative obligation |
| --- | --- | --- |
| Docs / instruction-only | Applicable governance | No product browser/source/FullWorld allocation |
| Changed deterministic test | Its exact owner executes it | No unowned test hidden behind `deterministic.core` |
| Changed Playwright spec | Exact spec/test IDs and capability owner | No stale inventory entry; no unrelated broad rerun by default |
| Gameplay profile / source-contract spec | Functional fixture + bounded real contract where applicable | No real FullWorld escalation |
| Geometry/render | Geometry, transforms, synchronization, bounded performance and applicable visual evidence | No source-contract/complete-world bytes merely by filename |
| Performance / soak | Intended independent resource class and workload | No generic browser-full scheduling |
| Visual plus overlapping machine group | Execution union and surviving restricted review | No machine summary replacing image review |
| Genuine complete-product change | Explicit specialist oracle or blocked unresolved proof | No false success from fixture-only broad profile |
| Planner/catalog/manifest / unknown / rename | Conservative protected floors and ownership closure | Candidate cannot narrow protected selection or hide old paths |
| Equivalent PR and MQ diff | Equal semantic groups/capabilities/test obligations | Identity digests must still bind their different exact candidates |

## Current topology, security and observed cost

Exactly three workflow files remain on protected main: `merge-authority-audit.yml`,
`merge-group-gate.yml`, and `terminal-branch-lifecycle.yml`. The Actions registry
returns 33 records labeled `active`, including historical absent paths and dynamic
Dependabot; registry labels do not establish current default-branch topology.

Repository ruleset `22103758` requires strict
`Merge authority audit / protected-base validate` (GitHub Actions integration
15368), linear history, resolved review threads and Merge Queue (ALLGREEN,
SQUASH, build limit five, merge batch one–five, timeout 60 minutes). Organization
ruleset `22352928` independently requires the protected main workflow
`.github/workflows/merge-authority-audit.yml`. Neither is changed.

On exact MQ candidate `f00815858...`, run `34159140292` / job `101857107613`
executed the required validator in seven seconds; run `34159140161` / job
`101857106985` executed the same validator in eight seconds. This directly proves
two runner starts and four checkouts for this one candidate, not a measured
programme saving or proof that all external `atlas-gate` consumers are absent.

Closure run `34159178035` / job `101857222133` used a runner for two seconds to
validate the constant `close` operation while cleanup was skipped. The pinned
Platform reusable permits cleanup only when `merged == false` and the head repo
matches. A later safe parent guard must preserve exactly that predicate; daily
inventory remains separate. No active workflow optimization is made here.

Keep authority `pull_request_target: edited` until base-retarget behavior and
required-status freshness are independently proven; do not infer that title/body
edits justify product execution. Future product events are candidate-changing
PR actions and MQ, with superseded non-authority cancellation. Avoid unconditional
main/review-event duplication. Plan exact build obligations before runner
allocation; the root has no `package.json` and no root npm build to discover.

**UNKNOWN:** repository default/organization code-scanning coverage. The repository
CodeQL file is archived; unauthenticated configuration/analyses reads return 401,
and the available connector rejects those endpoint families. This does not prove
coverage absent. A connector with authorized code-scanning read access must read
default setup, analyses and organization enforcement before the security lane is
qualified. Dependabot currently covers weekly Actions and `/e2e` npm updates.

No Molehill, Synology, FullWorld dataset, browser runner, Docker build, deployment
or publication was used. No CI savings are claimed. Product PR/MQ canaries,
blocking promotion, historical controller retirement and final architecture
acceptance remain blocked by lifecycle/admission and unimplemented proof.
