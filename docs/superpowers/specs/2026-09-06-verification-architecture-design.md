# Atlas verification architecture after the recovery reset

Governed by #315. The owner retired the old recovery merge plans and requested a coherent test and Merge Queue architecture. This is a design, not accepted implementation or qualification evidence.

## Starting evidence

Protected main at design admission is `c9129a9e65c57a56ed63aeff061caa54e0de0868`, tree `b630ef908c22734ea896a26f2361824891f09aed`. Refresh LIVE GitHub before implementation and integration; these hashes are provenance, never admission exceptions.

Source PRs #321, #328, #333 and #336 are closed without merge. Their commits remain available. #330/#329 are superseded by the installed generic governance-removal audit. #326/#322 and #310/#324 still contain unfinished downstream requirements.

The last exact product tree passed 1190 deterministic tests, 6 bounded browser scenarios and 66 of 68 fixture browser scenarios in run 34024416449. Two inspector screenshots failed because the corrected candidate attributes synthetic data to Atlas while the base-rendered reference still attributes it to Game. The reference must not require a new implementation to reproduce that obsolete behavior. Those failures remain failures; their partial results do not qualify a future candidate.

The current MQ consumer reuses one exact-tree PR proof. Its visual fallback rejects merge-group execution, and its snapshot model confuses protected authority with speculative queue base. Multi-PR queue qualification is not established.

## Outcome and boundaries

One protected semantic planner determines obligations for PRs and actual merge-group trees. Tests express independent semantic, geometry, presentation and provenance properties. Intended changes to visual expectations receive explicit independent review. Ordinary implementation and test maintenance do not depend on historical branches or promotion PRs.

Reuse the existing evaluator, fixture verifier, generated scenario bindings, sandbox, evidence validation and review identity machinery. Do not create another general workflow platform, mutable task registry, synthetic status service or historical bootstrap allowlist.

Preserve required `atlas-gate`, strict freshness, normal MQ ALLGREEN, workers=1 and retries=0. Do not mutate rulesets, add bypass actors, patch application/test bytes while running, substitute FullWorld, increase screenshot tolerances or remove geometry assertions.

## 1. Separate authority from the candidate being executed

Every envelope binds the repository and exact protected authority revision. Execution identity is a tagged union:

```text
PR: repository, authoritySha, PR number, current head, base, tree, complete changedFiles
MQ: repository, authoritySha, targetRef, group base/head/tree,
    complete aggregate changedFiles, verified queue entries and current member PR heads
```

PR numbers and refs are identity data, never scope exceptions. A queue base may be speculative; that does not make it the source of protected validation code. The protected authority remains the current protected main. The aggregate candidate must incorporate it.

Read the complete, paginated GitHub MergeQueue entries and bind the chain of entry base/head commits to the webhook group head/base, current member PR heads and queue positions. Reject missing/null members, incomplete pagination, duplicate or disconnected chains and rebuilt groups. Do not infer membership from branch spelling or combine unrelated PR statuses.

GitHub documents `MergeQueueEntry.baseCommit`, `headCommit`, `position` and `pullRequest` at <https://docs.github.com/en/graphql/reference/pulls#mergequeueentry>. A read-only LIVE query must verify the available schema before implementation; real single and multi-PR canaries must verify the association semantics before claiming completion.

## 2. One semantic selection model

Use `protected-semantic-routing.mjs` in the producer and both consumers. Resolve:

```text
complete changed paths -> affected properties -> group/dependency closure
-> exact stable scenario IDs -> minimum data capabilities -> execution placement
```

Replace blanket `web/ -> e2e.full` with audited mappings. Existing prefix matching is additive: narrower paths cannot override a broad full-suite rule. Initially group existing specs; do not pretend `stableTestIds` narrows a spec match in the current implementation.

Separate the need to validate product/bindings from the need for full browser breadth. Ordinary runtime files are not full-suite changes merely because they appear in a legacy product path set. Shared loader/trust changes and unknown impact retain broad fail-closed coverage. Verification authority transitions require full transition proof.

Docs, inert instructions and pure deterministic regressions select deterministic obligations without browser execution. Candidate regression maintenance does not redefine the independent protected minimum contract. Keep protected oracle execution and candidate-authored regression execution separate in evidence; never infer safety from candidate test counts alone.

The current inventory contains 77 IDs: 73 functional and four depth scenarios. The historical transition floor contains 68 IDs. Preserve the inventory and protected properties when regrouping. Full transition proof covers the applicable union; final architecture is not defined by a historical group name.

Scale, performance, soak and stress are selected for their actual affected seams and also run through protected depth execution. Their unique functional assertions must not disappear: invalid/empty queries, bounded DOM, unique/drawn anchors, view roundtrip, bounded retained state and committed geometry. Extract independent bounded functional assertions before deferring any scenario that is their sole owner.

Profiles `none`, `focused`, `targeted`, `broad`, `full` are independent of `qualification_fixture`, `bounded_real_world`, `real_fullworld`. Full functional coverage does not imply complete Game data or a specialist host.

## 3. Explicit visual expectations

Keep screenshot comparisons and their protected options. Introduce a small protected catalog of baseline obligations: stable baseline/scenario IDs, selector, project, viewport/DPR, expected path and comparison options. Candidates cannot add obligations or alter selectors/tolerances through input data.

An unchanged expectation continues to use its existing protected reference. For an intended change:

1. A protected capture-only producer captures old and proposed crops plus full-frame context, with validated fixture bindings and the same pinned browser. The candidate application remains sandboxed. This operation never publishes qualification success.
2. A real authenticated maintainer review explicitly approves the exact proposed expected images after inspecting the old/new difference and context. The proposal binds candidate identity, producer workflow/source/run/job/attempt, plan/oracle/product and every image digest.
3. A fresh full protected qualification mounts approved expected images read-only. Application and test source bytes remain unchanged. All required semantic, geometry and screenshot assertions still run, workers=1, retries=0.
4. Final full-frame acceptance remains separate from approving the visual expectation. Both PR and MQ consumers verify the complete chain and final readbacks.

Candidate-generated pixels are only a proposal. Serialized `accepted: true`, candidate workflow output or an unverified reviewer identity is not authority. Reuse the existing validated in-process token pattern and authenticated GitHub review lookup. Review approval does not waive a failed behavior or geometry test.

For the inspector, independently assert correct authority/provenance and navigation capabilities against trusted publication metadata. A screenshot match alone cannot establish those semantics.

A merge-group with a different aggregate tree needs evidence and visual acceptance bound to that group. Individual PR visual approvals do not implicitly approve the combination.

## 4. Shared evidence consumption

The same consumer validates PR and MQ envelopes. It verifies exact code/product/tree, selected properties and IDs, environment, producer workflow/source/run/job/attempt, required proof kinds, any reference approval and final visual review.

Exact-tree PR reuse is allowed only when every authority, plan, environment, product, freshness and association condition also matches. Otherwise qualify the actual aggregate queue tree. Never add individual PR GREEN results together.

Re-read authority, candidate/group identity and membership, changed paths, producer status, artifacts and reviewer authority before publication and consumption. New failures, revoked/changed approval, movement or missing evidence reject. Successful capture is not successful qualification.

Specialist routing is a separate capability: the current primitive rejects a specialist obligation without evidence and does not implement candidate specialist transport. Prove routing and missing-evidence rejection first; do not label them actual specialist execution. Required real specialist execution remains an explicit closeout gate.

## Implementation boundaries

- Identity: `protected-candidate-snapshot.mjs`, `run-protected-merge-group.mjs`, shared evidence schemas and their direct regressions.
- Selection: `protected-admission-policy.mjs`, `impact-manifest.json`, `verification-catalog.json`, `protected-scenario-properties.json`, `protected-semantic-routing.mjs`, `protected-routing.json` and direct contracts.
- Expectations: existing protected visual-reference/review modules, bounded proposal producer, approved-reference consumption and direct negative tests.
- Wiring: protected PR/MQ workflows, `run-protected-admission.mjs`, `consume-protected-admission.mjs`; only mechanically required provenance pins.
- Product delta: select still-needed source corrections from the retired locators into a fresh exact candidate. No mechanical branch stacking or inherited success.

No prompt/AGENTS/registry cleanup is mixed into this architecture implementation. It remains downstream work with retained requirements.

## Installation is a separate, explicit gate

Current main rejects modifications to these source-level authority files. A candidate cannot authorize its own replacement validator. This design therefore does not claim it can be installed through the current normal path unchanged.

Do not create or merge another incomplete prerequisite to discover missing dependencies afterward. Before any installation decision, prepare the complete reviewed delta and shadow-prove producer, reference approval, exact full qualification and both consumer modes together. Report the remaining installation operation explicitly. No further exceptional integration occurs during design/preparation, and no product bypass is implied by this document.

## Acceptance gates

- Full diff review, selected deterministic tests, exact isolated-container execution, provenance/schema validation and final exact-head GitHub review; no unresolved material findings.
- Positive PR and MQ contracts; wrong/stale repository, association, head, base, tree, paths, producer, run/job/attempt, incomplete proof, lower-bound/census/oracle alteration and candidate self-approval all reject.
- Proposed references reject missing context/images, changed bytes, unknown obligations, partial/revoked approval and candidate-writable mounts. Full qualification still rejects a semantic or geometry failure after baseline approval.
- Real light MQ canary: deterministic-only change, zero browser, atlas-gate and protected-main readback.
- Real functional MQ canary: actual runtime/layout fix with permanent regression and independently reviewed visual proof.
- Real multi-PR MQ canary and negative aggregate-only failure/rebuilt-group cases; no claim based solely on a mocked same-tree queue fixture.
- Protected specialist routing and required actual execution evidence, distinctly reported.
- Future ordinary short task completes the normal lifecycle without a historical repair chain.
- Then resume the remaining Atlas/META/Astra programme and all retained #331 exit criteria. Closing historical PRs does not complete those requirements.
