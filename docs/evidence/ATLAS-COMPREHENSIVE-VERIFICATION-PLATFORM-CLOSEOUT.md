# Atlas comprehensive verification platform — terminal closeout

Evidence snapshot: 2026-08-24

## Purpose

This document records the terminal delivery and qualification evidence for the comprehensive Atlas verification platform owned by Issue #85.

It is an evidence record only. It does not change runtime behavior, deployment authority, Game/Atlas data ownership, test thresholds, retry policy, or provenance rules.

## Lifecycle authority

- Programme issue: #85 — `completed`.
- Runner-placement lifecycle: #105 — `completed`.
- Nightly runner-context repair: #109 — `completed`.
- Legacy bounded extraction closeout: #102 — `completed`.
- Mobile creature restore-oracle defect: #128 — `completed`.
- Superseded runtime hypothesis: #130 — `not_planned`.
- Final oracle repair delivery: PR #135.

The bounded documentation change that adds this closeout uses `NOT_APPLICABLE` as a new lifecycle issue because all substantive programme issues above are already terminal.

## Final qualified delivery line

PR #135 (`fix(test): scope creature animation restore oracle to backing canvas`) was merge-updated against the then-current `main` and qualified on exact head:

- exact PR head: `39a02517fede449edb0300af47ac186b9a686981`;
- exact-head local Docker Playwright: **50/50 PASS**;
- workers: `1`;
- retries: `0`;
- `atlas-local-e2e=success` published by the repository publisher only after clean-tree, remote-head, revision, count, worker and retry validation;
- `atlas-gate`: SUCCESS;
- `provenance-gate`: SUCCESS;
- Docker E2E Harness: SUCCESS;
- CodeQL: SUCCESS.

PR #135 was squash-merged with expected-head fencing as:

`a48248ac17051506a307b866152ebd5044ab434b`

Tree:

`1a8413b49578fed14c46d7aced87d6618e74babe`

## Post-merge GitHub qualification

The merged revision `a48248ac17051506a307b866152ebd5044ab434b` received successful post-merge checks:

- CI run `32767192058`: SUCCESS;
- Extraction Provenance run `32767192057`: SUCCESS;
- CodeQL run `32767192095`: SUCCESS;
- Synology Live Acceptance run `32767192048`: SUCCESS;
- Verification Nightly Depth run `32771039681`: SUCCESS.

No failed or stale earlier run is promoted as success evidence. Historical failures remain diagnostic evidence for the regressions they produced.

## Synology live acceptance

`Synology Live Acceptance` run `32767192048` executed on exact merged `main@a48248ac17051506a307b866152ebd5044ab434b` and completed successfully.

The following stages were individually successful:

1. Atlas organization runner boundary;
2. exact Atlas workflow checkout;
3. main-only deployment authority;
4. exact merged-main candidate staging;
5. exact animated Game and Atlas product build;
6. atomic qualified-candidate publication and cutover;
7. bounded Chromium acceptance image build;
8. live desktop and mobile Chromium E2E;
9. browser evidence publication;
10. task-owned cleanup/finalization.

Fresh live identity checks at terminal closeout returned:

- `X-Oteryn-Atlas-Revision: a48248ac17051506a307b866152ebd5044ab434b`;
- live container `org.oteryn.revision=a48248ac17051506a307b866152ebd5044ab434b`;
- running-state proof: `true`.

Live browser evidence artifact:

- artifact id: `9535900736`;
- name: `atlas-synology-live-e2e-32767192048-1`;
- digest: `sha256:dcea0f99a84e71f267171782e150900c7509430ea2f0446f843038239e372a1f`.

## Mobile creature restore-oracle closeout

Earlier live acceptance exposed `monster static pixels were not restored` after playback was disabled on the mobile path.

The investigation retained the original failures and proved that the creature backing-canvas RGBA restored exactly while DOM element screenshot bytes could differ because the mobile element rectangle also contained composited presentation outside the creature backing store.

The accepted repair therefore did **not** loosen pixel equality. It moved the oracle boundary to the actual creature backing canvas and retained zero-tolerance decoded RGBA equality.

No retry, timeout, tolerance, allowlist, Game authority, or animation-runtime behavior was weakened to obtain the final PASS.

## Nightly depth closeout

Manual `Verification Nightly Depth` run `32771039681` was dispatched exactly once after live acceptance and was bound to:

`main@a48248ac17051506a307b866152ebd5044ab434b`

Both jobs completed successfully:

- `Deterministic contracts and controlled mutants`: SUCCESS;
- `Read-only Docker browser depth`: SUCCESS.

The browser-depth job proved all of the following before running depth:

- immutable Molehill runner identity;
- exact scheduled-main checkout;
- exact live publication revision;
- bounded optional-depth applicability record.

The additive depth then exercised the scheduled verification layer without replaying the generic full PR matrix. It included repeated critical geometry/render probes, fixed replayable stress seeds, additional profile coverage, visual/accessibility/race/soak depth as applicable, with one worker and no retry-based success.

After browser depth, the workflow re-checked the served live revision and confirmed it still matched `a48248ac17051506a307b866152ebd5044ab434b` before publishing evidence.

Nightly artifacts:

- browser artifact id: `9536619123`;
- browser artifact name: `atlas-verification-nightly-browser-32771039681-1`;
- browser artifact digest: `sha256:e1fe88ab821a7fd9d36dfddffc6d0383cd2e87418a84e405fe8fde860edeccb7`;
- deterministic artifact id: `9536187318`;
- deterministic artifact name: `atlas-verification-nightly-node-32771039681-1`;
- deterministic artifact digest: `sha256:7ce99726b987100c1b102069d162ee1ac20de78b6b7f27a751bffae1d1a32f41`.

## Permanent regressions produced by the programme

The programme converted discovered failures into durable verification contracts instead of hiding them. Important examples include:

- semantic/deep-link reload and history coherence;
- race handling for superseded range requests and historical views;
- checkout-overlay release behavior;
- bounded local publication forwarder burst capacity;
- exact-head local E2E status publication;
- Molehill/Synology execution-role separation;
- unsupported job-level runner-context prevention;
- Molehill Windows PowerShell shell identity;
- nightly/live concurrency isolation;
- nightly exact-live-revision checks before and after depth;
- strict backing-canvas creature static-pixel restoration.

Historical failing runs remain part of the audit trail and are not reclassified as successful runs.

## Terminal programme state

Issue #85 is terminally `completed` because its acceptance chain is fully represented by executable evidence:

- comprehensive deterministic/contract/property verification is integrated;
- full exact-head real-browser PR qualification is required;
- `atlas-gate` and `provenance-gate` remain protected merge gates;
- rendering/geometry/race/stress/visual/accessibility/failure behavior has executable coverage;
- heavy PR and nightly browser work is owned by Molehill-PC;
- Synology remains merged-main deployment/live-acceptance authority;
- exact served revision identity is required for live acceptance;
- nightly depth is additive and fail-closed on stale/changing live revision;
- bugs discovered during qualification retain permanent regression coverage.

## Later-main note

The terminal qualification above applies to the programme closeout revision `a48248ac17051506a307b866152ebd5044ab434b` and its recorded run/artifact identities.

After that closeout, unrelated work continued and `main` advanced. At the time this evidence document branch was created, the repository `main` was:

`3125c5212d55b240b94e562023c3b9faede8db90`

That later revision is outside the historical qualification claim recorded here and must rely on its own normal exact-head, post-merge and live/nightly evidence as applicable.

## Final disposition

**ATLAS-COMPREHENSIVE-VERIFICATION-PLATFORM: COMPLETE**

The durable source of truth remains the repository workflows, protected checks, run records, artifacts, regression tests and issue/PR lifecycle. This document is a human-readable index of that evidence, not a substitute for it.
