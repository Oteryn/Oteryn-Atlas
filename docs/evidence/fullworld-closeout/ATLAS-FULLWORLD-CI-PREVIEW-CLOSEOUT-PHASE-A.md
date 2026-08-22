# ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT — Phase A checkpoint

Status: `PLANNING_ACTIVE_FINAL_DELIVERY_BLOCKED`

This checkpoint records only verified Phase A planning and live delivery-environment evidence. It does not claim a complete-world publication, final preview, final CI, or programme closeout.

## Exact execution basis

- Atlas repository: `Oteryn/Oteryn-Atlas`
- task branch: `ci/ATLAS-FULLWORLD-CI-PREVIEW-CLOSEOUT`
- branch base: `e87bdd54207ba9a1e412a24315c28e0507a23e5f`
- Game authority repository: `Oteryn/Oteryn-Game`
- Game `main` observed for this checkpoint: `63a6cb8cb3e69b7c2f792475f24093e90bd7fd81`
- canonical prompt: `docs/agents/prompts/ATLAS-FULLWORLD-AGENT-SUITE.md`
- coordinator ledger: `docs/evidence/ATLAS-FULLWORLD-PROGRAMME-LEDGER.md`

## PROVEN startup state

- Coordinator G6 state is `PLANNING_STARTABLE`; final delivery waits for accepted publication/layer/GUI hand-offs.
- No complete-world subordinate hand-off is accepted in the coordinator ledger at this checkpoint.
- Current hosted CI on `main` does not perform heavy full-world generation. It currently contains repository-contract, semantic-proof, browser-semantic, browser-WebGL-proof and project jobs.
- Open draft PR #8 (`gov/issue-6-atlas-governance-closeout`) also changes `.github/workflows/ci.yml`, so this task will not create a competing workflow edit until that path conflict is reconciled.
- PR #8 head is `d1043bc99e4c2c777842e03ff6a426a8b1e90099`; GitHub Actions run `32227092152` completed `success` on that exact head.
- PR #8 remains draft and its body requires independent review for security/protection/governance surfaces; no submitted PR review was present when checked.

## Hosted CI contract to implement after stable full-world hand-offs

The final hosted gate must remain qualification-only and must not regenerate the complete world. It will verify, against accepted stable paths/contracts:

1. repository/runtime authority boundaries and forbidden legacy/runtime fallback;
2. exact full-world manifest/root identities and per-floor publication identities;
3. selected deterministic shard regeneration or reproducibility fixtures that are intentionally bounded for hosted runners;
4. missing/corrupt/forged semantic and pixel negatives;
5. semantic-layer and search/spatial-index contracts;
6. real Chrome/WebGL smoke across representative accepted floors/regions;
7. truthful disabled/unsupported-layer UI state;
8. temporary/debug/secret/raw-legacy-input absence;
9. one stable aggregate `atlas-gate` that requires every mandatory component on the exact PR head.

Self-hosted CI is not introduced by this Phase A checkpoint. If later required, it must remain optional or explicitly protected so successful hosted CI does not depend on unavailable private hardware without separate approval.

## Live Synology delivery baseline

Observed through the authorized Remote Desktop Commander device named `Synology`.

### PROVEN

- device ping succeeded at `2026-08-19T07:18:48.896Z`;
- hostname: `Synology`;
- execution identity: `uid=1032(chagpt) gid=100(users)` with groups including `administrators`, `http` and `chatgpt-docker`;
- Docker server version: `24.0.2`;
- `/volume1`: `3.5T` total, `1.2T` used, `2.4T` available at observation time;
- existing bounded semantic preview container: `oteryn-atlas-semantic-preview`;
- existing bounded semantic preview bind: `192.168.1.2:8096 -> 8080/tcp`;
- existing bounded semantic preview image: `ghcr.io/nginx/nginx-unprivileged:1.31.3-alpine3.24-slim@sha256:22f839c5fb4007dc24d203a170a9e03fc185d660bfefc34ac6823a7aef085cbc`;
- existing bounded semantic preview revision label: `0b4a802cff408f9fc7c53509b9f071b1928c783c`;
- existing preview root is read-only bind-mounted from `/volume1/docker/otheryn/atlas-semantic-preview/revisions/0b4a802cff408f9fc7c53509b9f071b1928c783c`;
- existing NGINX config serves `.mjs` as `application/javascript`, `.json` as `application/json`, `.rgba` as `application/octet-stream`, and emits `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN`, `Cache-Control: no-store`;
- ports `8097`, `8098` and `8099` were free when probed; `8095` and `8096` were occupied by existing Atlas previews.

### Separate-client LAN proof of the current bounded baseline

Observed from authorized device `Molehill-PC` over the actual LAN route to `http://192.168.1.2:8096/`.

- HTTP request returned `200` for `/web/index.html?x=32377&y=32238&floor=-7&zoom=2`.
- Response headers included the expected content type and security/cache headers listed above.
- Real installed Google Chrome was executed headless against that LAN URL.
- The rendered DOM contained `VERIFIED · WEBGL2`, `30 / 30`, the bounded Thais Z7 title, and the explicit statement that only exported floor `-7` exists in that proof.

This proves the delivery path and browser-smoke method, not complete-world coverage.

## RECOMMENDED final preview contract

These values are planning choices only until final hand-offs are accepted and the NAS is revalidated again immediately before mutation:

- isolated container name: `oteryn-atlas-fullworld-preview`;
- isolated revision root pattern: `/volume1/docker/otheryn/atlas-fullworld-preview/revisions/<exact-atlas-head>/`;
- candidate LAN port: `8097` if still free at deployment time;
- use a digest-pinned unprivileged static server image;
- mount the exact revision read-only;
- keep root redirect/static serving only; no runtime fallback to legacy sources;
- preserve explicit MIME types required by the accepted final publication and ES modules;
- preserve fail-closed integrity loading in the browser rather than trusting transport or container path identity;
- record exact container/image/revision/root hashes/URL only after successful deployment.

## BLOCKED final gates

Final G6/G7 execution remains blocked until the coordinator accepts all required hand-offs:

- `ATLAS-FULLWORLD-LOCAL-GENERATION-FABRIC`: complete deterministic generation evidence;
- `ATLAS-FULLWORLD-COMPILER-PUBLICATION`: world/per-floor roots, semantic and pixel publication contracts;
- `ATLAS-SEMANTIC-LAYERS-AND-INDEXES`: authoritative layer status and implemented proven layers;
- `ATLAS-FULLWORLD-GUI-RUNTIME`: complete-world browser runtime and representative qualification evidence.

The `.github/workflows/**` implementation is additionally deferred while draft PR #8 owns the same workflow path. That is an integration dependency, not permission to bypass or weaken PR #8.

## Resume conditions

When the upstream hand-offs become available:

1. re-read current `main`, `AGENTS.md`, coordinator ledger and all accepted hand-off evidence;
2. reconcile or rebase after PR #8 before any `.github/workflows/**` write;
3. bind CI checks to exact accepted full-world paths and identities without guessing serializer/layout details;
4. run final hosted exact-head CI and inspect every mandatory job result;
5. live-revalidate Synology identity, Docker, filesystem, port ownership and free space;
6. deploy the isolated exact revision;
7. verify from `Molehill-PC` in real Chrome over the LAN path;
8. record exact revision, roots, container, URL/port and smoke result;
9. perform full-diff/path-ownership/review-thread review and merge only against the expected final head SHA;
10. inspect post-merge `main` and archive the task only when the intended complete-world Atlas is present and temporary/debug/runtime-authority regressions are absent.
