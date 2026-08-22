# Issue #35 — Atlas runner-group access proof

Status: `PROVEN`

## Direct organization ACL evidence

The organization runner-group ACL was directly read by the temporary Platform seal workflow using the dedicated organization-admin secret, not inferred from labels or from a queued job.

Authoritative historical execution:

- Platform source commit: `efe35c1ffa4af5f10904580fe3a587aa5c343a50` (`fix(runner): seal Platform steady-state registration`).
- Workflow: `Organization Runner Platform Seal`.
- Run/job: `32512311186` / `96866035808`, conclusion `SUCCESS`.
- The workflow queried:
  - `GET /orgs/Oteryn/actions/runner-groups?per_page=100`;
  - `GET /orgs/Oteryn/actions/runners?per_page=100`;
  - `GET /orgs/Oteryn/actions/runner-groups/<id>/runners?per_page=100`;
  - `GET /orgs/Oteryn/actions/runner-groups/<id>/repositories?per_page=100`.
- For each group it required exactly one selected repository (`total_count == 1`) and exact `repositories[0].full_name` equality.

The successful log recorded both before and after the Platform blank-token force-recreate:

```text
runner=oteryn-synology-platform group=platform-runners label=oteryn-platform status=online selected_repo=Oteryn/Oteryn-Platform
runner=oteryn-synology-atlas group=atlas-runners label=oteryn-atlas status=online selected_repo=Oteryn/Oteryn-Atlas
runner=oteryn-synology-game group=game-runners label=oteryn-game status=online selected_repo=Oteryn/Oteryn-Game
organization-runner-estate=PASS
```

Therefore the Atlas group authorization boundary was directly proven as:

`atlas-runners` → exactly one selected repository → `Oteryn/Oteryn-Atlas`.

## Subsequent Atlas-owned execution proof

The ACL seal was followed by real Atlas-owned execution through the same group/name/label identity:

- Atlas trusted-main run/job: `32526864123` / `96911114022`, conclusion `SUCCESS`.
- Runner: `oteryn-synology-atlas`.
- Group/label: `atlas-runners` / `oteryn-atlas`.
- Organization scope and persisted `.runner` metadata: PASS.
- Platform staging-state mount absent: PASS.
- Exact Game-derived creature product: 88,633 placements / 5,746 chunks / 1,945 search records.
- Exact served bytes, seven FullWorld roots and HTTP Range: PASS.
- Real Chromium desktop: PASS.
- Real Chromium mobile: PASS.
- Evidence artifact: `9463015639`, digest `sha256:9582ac4fa7b388498aab22f64911f66e53ed3c5059ff0eef505065ba8beeece0`.

Platform then removed the superseded Atlas execution scaffold in PR #1212, merge `a8d46c91571a8df5193d6ddd2c28b35db2e85934`.

## Current repository/control-plane surfaces

The presently connected repository-scoped GitHub connector still cannot independently re-read the organization runner-group endpoint. That limitation does not invalidate the earlier direct API evidence above: run `32512311186` already performed the organization-level read with the authorized admin secret and failed closed on any repository-count/name mismatch.

The temporary META/Atlas scheduling canaries created during this closeout are no longer needed as ACL evidence and are intentionally closed without merge where applicable.

## Verdict

`PROVEN`: Atlas host-local work is owned by `Oteryn/Oteryn-Atlas`, routes through `atlas-runners + oteryn-atlas`, the registered runner is `oteryn-synology-atlas`, Platform staging state is not exposed, and the runner group was directly verified to select only `Oteryn/Oteryn-Atlas`.