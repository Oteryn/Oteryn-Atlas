# Oteryn Atlas agent instructions

These instructions govern `Oteryn/Oteryn-Atlas`.

## Authority

- Oteryn-Game is canonical World/Content authority.
- Atlas is a derived semantic projection/read model and may not invent Game-owned coordinates, floors, ordering, identity or content semantics.
- Legacy OTBM/Tibia/Canary/Crystal inputs are migration/reference evidence only; browser runtime must never parse them as fallback authority.
- Platform may coordinate Atlas contracts but is not an Atlas runtime data source.

## Work boundary

- Use a GitHub Issue as lifecycle authority for substantial work.
- Work from `main` on one dedicated task branch and one PR; never push ordinary work directly to `main`.
- Record exact base/head revisions and any pinned external evidence used by the task.
- Treat `UNKNOWN` provenance, rights, coordinates or semantics as a blocker to the affected claim, not permission to guess.

## Preflight

Before editing, inspect the current default-branch head, this file, the active Issue/PR, overlapping work, and only the architecture/contracts relevant to the paths being changed. Read a nearer `AGENTS.md` if one exists for a touched path.

## Validation and merge

- Run repository-selected checks applicable to the changed paths and deterministic fixture/contract tests for generated semantic data.
- Review the complete changed-file set and full diff on the exact final head.
- Verify browser runtime consumes Atlas projection data only.
- Require exact-head CI, including stable `atlas-gate`, before merge.
- Squash merge only after all required checks/reviews pass; delete the completed task branch unless it has a documented continuing provenance role.

## Safety

- Do not commit raw OTBM/OTB/SPR/DAT inputs, secrets, credentials, private data or unlicensed proprietary assets.
- Do not publish Tibia/CipSoft-derived pixels without explicit rights/provenance authority for that publication surface.
- Do not weaken protection, validation or provenance gates to make a task pass.
- Production deployment, protected environments, secrets and live-system mutation require separate explicit authority.