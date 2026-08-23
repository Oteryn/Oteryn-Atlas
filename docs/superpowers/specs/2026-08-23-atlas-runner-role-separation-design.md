# Atlas runner role separation design

## Goal
Separate Atlas verification workloads by purpose and hardware capability: GitHub-hosted CI for deterministic/hosted checks, Molehill-PC for heavy browser qualification and nightly depth, and Synology only for merged-main deployment/live acceptance.

## Authority and lifecycle
- Repository authority: GitHub `Oteryn/Oteryn-Atlas`.
- Parent verification lifecycle: #85.
- Runner-placement lifecycle: #105.
- Delivery path: PR #106 (`ci/issue-105-molehill-nightly`).
- PR #104 is a diagnostic precursor whose additive-nightly rule is absorbed into #106; it must not be merged independently after the rule is ported.

## Runner responsibilities
### GitHub-hosted CI
GitHub-hosted jobs own deterministic Node/contract/property verification, provenance verification, CodeQL/security, lightweight browser/WebGL contract checks and `atlas-gate` fan-in. They must not perform the expensive 48-scenario Docker Playwright qualification.

### Molehill-PC
The dedicated Windows runner `oteryn-molehill-atlas` in runner group `atlas-runners` with custom label `oteryn-atlas-pc` owns:
- exact-head full local Docker Playwright qualification (currently 48 scenarios, workers=1, retries=0);
- scheduled/manual browser-depth work: repeated critical geometry/render probes, fixed replayable stress seeds, extra viewport/DPR projects, and stable performance/visual/accessibility/race/soak depth;
- generation of bounded machine-readable browser evidence.

Molehill work is read-only against the publication origin. It must not deploy or replace the Synology live container.

### Synology
The Synology runner `oteryn-synology-atlas` in runner group `atlas-runners` with custom label `oteryn-atlas` is reserved for trusted merged-main live acceptance. Its responsibilities are limited to:
- exact merged-main checkout/revision identity;
- candidate publication/build/cutover and rollback boundaries already owned by the live workflow;
- exact container/header revision equality;
- publication/product-root availability and integrity checks;
- bounded desktop/mobile real-browser live smoke required to prove the deployed environment.

Synology must not run the full 48-scenario PR matrix, stress matrices, soak, performance depth, broad visual regression or nightly browser-depth workloads.

## Nightly semantics
Nightly is additive to the exact-head PR gate, not a duplicate of it. The full required browser matrix is proven before merge through `atlas-local-e2e=success` on the exact PR SHA. Nightly therefore runs only additional depth categories.

The nightly workflow must not invoke the generic full-suite entry point for a second copy of the required matrix. It may run specifically enumerated repeated critical probes, deterministic stress seeds, additional DPR/viewport projects and stable worker-delivered depth suites.

## Safety constraints
- No increase in Playwright retries, per-test timeouts, tolerances or allowlists to compensate for slow hardware.
- No weakening of `atlas-gate`, `provenance-gate`, CodeQL/security or Game/Atlas authority boundaries.
- Heavy read-only verification and live cutover retain shared concurrency exclusion so they cannot race on the publication target.
- Exact-head evidence remains mandatory before PR merge; stale or copied evidence is invalid.
- A runner outage blocks the corresponding physical proof rather than authorizing a bypass.

## Regression contracts
Repository tests must permanently assert:
1. nightly browser depth selects `atlas-runners` + `oteryn-atlas-pc` and validates Windows/Molehill identity;
2. Synology live acceptance remains on `atlas-runners` + `oteryn-atlas` and validates `oteryn-synology-atlas` identity;
3. nightly does not duplicate the full required PR browser matrix;
4. required PR qualification still requires authenticated exact-head `atlas-local-e2e=success`;
5. no runner-placement repair weakens retries/timeouts/assertions/tolerances/allowlists.

## Acceptance
- #106 contains both Molehill routing and additive-nightly semantics.
- #104 is closed as superseded after its unique rule is present in #106.
- exact #106 head receives fresh Molehill 48/48, workers=1, retries=0 evidence and `atlas-local-e2e=success`.
- required GitHub gates are green on that exact head.
- #106 is squash-merged.
- one manual/scheduled nightly on the resulting exact merged main passes deterministic depth and Molehill browser depth.
- Synology live acceptance remains green and serves the exact merged-main revision.
- #105 closes only after those proofs; #85 closes only when its remaining Definition of Done is independently satisfied.