# Issue #179 / PR #213 — Phase D active status

Status: **OPEN / draft / blocked; do not merge.** This handoff records the
live GitHub state observed on 2026-08-28. GitHub remains the authority for
branch identity, evidence, and readiness.

## Exact GitHub identity

- Repository: `Oteryn/Oteryn-Atlas`
- Lifecycle issue: [#179](https://github.com/Oteryn/Oteryn-Atlas/issues/179)
- Integration PR: [#213](https://github.com/Oteryn/Oteryn-Atlas/pull/213)
- Protected `main`: `8b293eaa42dec11114dee7ba00d79ff6fd3c3bb3`
- PR branch: `feat/issue-179-phase-d-final`
- Exact candidate head: `7064763ad667925fdf00944cb5145d4e7a6ed602`

The stale direct-mount Compose readiness repair was reconciled into this head
as the protected ready-publication topology: it publishes and validates a
ready copy before `atlas-publication` serves it, while retaining the fixture
namespaces required by the browser. Do not copy the earlier direct-mount patch
onto a later head; doing so would remove the protected readiness boundary.

## Exact-head evidence

- [Protected Verification Controller run 33175995633](https://github.com/Oteryn/Oteryn-Atlas/actions/runs/33175995633)
  passed for this exact candidate head, using the protected `main` SHA above.
- The exact-head deterministic artifact
  `atlas-verification-node-33175997255-1` records **570 tests, 570 pass, 0
  fail**.
- [Protected hosted executor run 33175997218](https://github.com/Oteryn/Oteryn-Atlas/actions/runs/33175997218)
  records **4/4 PASS** for `bounded_real_world`. Its protected product is
  `atlas-bounded-real-world-v1` at
  `sha256:a19f0371eb5afcdf8c40156d732d5602e970400ec9369607f901e2f0a58c92b6`.

## Current blocker

The same exact-head hosted executor reaches `qualification_fixture`, where the
final Playwright result is **73 failed, 1 passed (74 total)**. The shared first
failure is `publication trusted root mismatch` (`expected PASS`, `received
FAIL`). This is the current qualification-fixture trust-boundary blocker; it
is not a bounded-real failure and it must remain fail-closed.

`fan-in` is consequently a secondary failure. It observes the failed shard and
cannot accept its protected machine summary (the conversion also reports a
missing `protected/qualification_fixture` capability source). It is not
independent merge evidence.

## Required continuation

1. Reproduce and repair the qualification-fixture trusted-root mismatch without
   weakening publication or provenance validation.
2. Refresh `main`, PR #213, and the exact branch head again.
3. Re-run the protected controller, both hosted capability partitions, and
   fan-in on the new exact head.
4. Merge only after the authoritative exact-head chain is green.

Do not use Molehill-PC or Synology for this ordinary hosted qualification, do
not force-push, and do not merge #213 while this status remains blocked.
