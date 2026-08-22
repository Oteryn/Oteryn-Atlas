# Atlas terminal source-branch lifecycle decision

- Status: Accepted
- Date: 2026-08-23
- Decision owner: repository owner
- Lifecycle issue: #93
- Organization implementation: `Oteryn/Oteryn-Platform@e145f7c03bd0b15f0b0fecc0f6fae7884fe3e0db`

## Context

Atlas creates short-lived feature, verification, audit, recovery, and agent branches. GitHub's `delete_branch_on_merge` already removes accepted merged-PR heads, but closed-unmerged, superseded, diagnostic, and historical orphan refs remain outside that mechanism. Deleting by age or branch prefix would be unsafe because branch state can still represent active, retained, recovery-sensitive, or ambiguous work.

Oteryn Platform exposes the proven exact-head Terminal Branch Lifecycle through separate reusable workflows for read-only inventory and write-capable close/apply operations.

## Decision

Atlas adopts those workflows through a repository-local caller pinned to the exact merged Platform SHA above. Inventory and deletion use only the Atlas repository `GITHUB_TOKEN`; no organization-wide destructive token is introduced.

Read-only inventory uses the physically separate Platform read reusable workflow. Write-capable close/apply operations use the separate write reusable workflow. A same-repository PR intentionally closed without merge must state exactly one `Branch-Disposition: delete` or `Branch-Disposition: retain` and one non-empty `Branch-Disposition-Reason`. Delete authorization remains fail-closed: trusted-main automation revalidates exact branch/head/PR identity, absence of open PRs and active claims, protection/retention state, and release/rollback/recovery/backup-sensitive branch policy immediately before deletion.

Merged PR branches remain handled by `delete_branch_on_merge=true`. Scheduled/manual inventory is read-only. Existing orphan branches are not deleted merely because this decision is adopted; historical cleanup requires a separately reviewed manifest/approval bound to the exact live candidate set.

## Shared policy compatibility

`docs/agents/BRANCH_LIFECYCLE_POLICY.json` preserves the shared Platform classifier schema, including compatibility marker `issue: 658`. Atlas lifecycle authority is Issue #93 and this decision record, not that compatibility marker.

## Consequences

Future terminal branch leakage is detectable and deterministic, while ambiguous or sensitive refs remain untouched. Any implementation upgrade must update both reusable workflow `uses:` references and all `platform_ref` values to the same reviewed merged Platform SHA in a normal Atlas PR.
