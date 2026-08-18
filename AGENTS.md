# Oteryn Atlas agent instructions

These instructions govern all work in `Oteryn/Oteryn-Atlas`.

## Authority

1. Oteryn-Game remains canonical World/Content authority.
2. Atlas is a derived semantic projection/read model and must not invent or override Game-owned coordinate, floor, ordering, identity or content semantics.
3. Platform architecture/programme documents may coordinate Atlas but do not become Atlas runtime data sources.
4. Legacy OTBM/Tibia/Canary/Crystal inputs may only appear behind explicit, pinned conversion/import evidence; browser runtime must never parse them as fallback authority.

## Change discipline

- Work from `main` on a dedicated task branch and PR except for the initial empty-repository bootstrap.
- One active implementation task owns its declared paths.
- Record exact base/head revisions, pinned external revisions, validation commands/results and unresolved `UNKNOWN` facts.
- Do not silently guess coordinates, Z-level mappings, stack/layer semantics, asset rights, or private/server-only state.
- Stop when required authority or provenance is missing rather than weaken the boundary.

## Validation

Before merge-ready status:

- run the repository-selected build/test/typecheck/lint checks applicable to changed code;
- run deterministic fixture/contract tests for generated semantic data;
- review exact changed paths and full diff;
- verify browser runtime consumes Atlas projection data only;
- keep unsupported semantics explicit and deterministic;
- require exact-head CI to pass.

## DYN-ATLAS-001

The initial proof must follow the canonical `DYN-ATLAS-001 — Semantic Thais Z7 Proof` execution prompt from `blakinio/Oteryn-Platform/docs/maps/oteryn-dynamic-semantic-atlas-execution-prompt.md` and current Game-owned Atlas export/spatial contracts. Permanent serializer/chunk-size/framework choices remain deferred unless separately accepted.
