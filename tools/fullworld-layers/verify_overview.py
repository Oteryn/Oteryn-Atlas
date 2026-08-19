#!/usr/bin/env python3
"""Fail-closed verifier for the derived full-world overview layer publication."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

OVERVIEW_WORLD_PROFILE = "oteryn-atlas-overview-world-v0"
OVERVIEW_FLOOR_PROFILE = "oteryn-atlas-overview-floor-v0"
OVERVIEW_CHUNK_PROFILE = "oteryn-atlas-overview-chunk-v0"
OVERVIEW_WORLD_DOMAIN = b"OTERYN-ATLAS-OVERVIEW-WORLD-V0\0"
OVERVIEW_FLOOR_DOMAIN = b"OTERYN-ATLAS-OVERVIEW-FLOOR-V0\0"
PUBLICATION_PROFILE = "oteryn-atlas-fullworld-publication-v0"
SEMANTIC_PROFILE = "oteryn-atlas-fullworld-semantic-publication-v0"
PUBLICATION_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0"
SEMANTIC_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0"
SEMANTIC_FLOOR_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0"


class VerifyError(RuntimeError):
    pass


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def rooted(domain: bytes, value: dict[str, Any]) -> str:
    core = dict(value)
    core.pop("rootContentId", None)
    return "sha256:" + hashlib.sha256(domain + canonical(core)).hexdigest()


def safe_join(root: Path, relative: str) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts:
        raise VerifyError(f"unsafe relative path: {relative!r}")
    return root / rel


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise VerifyError(f"unable to read JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise VerifyError(f"JSON root is not an object: {path}")
    if raw != canonical(value):
        raise VerifyError(f"non-canonical JSON: {path}")
    return value


def check_root(value: dict[str, Any], domain: bytes, label: str) -> None:
    if value.get("rootContentId") != rooted(domain, value):
        raise VerifyError(f"{label} root mismatch")


def _load_source(publication_root: Path, expected_publication_root: str) -> tuple[dict[str, Any], dict[str, Any], dict[int, dict[str, Any]]]:
    publication = load_manifest(publication_root / "publication.json")
    if publication.get("profile") != PUBLICATION_PROFILE:
        raise VerifyError("unsupported source publication profile")
    check_root(publication, PUBLICATION_DOMAIN, "source publication")
    if publication.get("rootContentId") != expected_publication_root:
        raise VerifyError("source publication root does not match expected authoritative root")
    semantic_path = safe_join(publication_root, publication["semantic"]["path"])
    semantic = load_manifest(semantic_path)
    if semantic.get("profile") != SEMANTIC_PROFILE:
        raise VerifyError("unsupported source semantic profile")
    check_root(semantic, SEMANTIC_DOMAIN, "source semantic world")
    if publication["semantic"].get("rootContentId") != semantic.get("rootContentId"):
        raise VerifyError("source semantic linkage mismatch")
    floors: dict[int, dict[str, Any]] = {}
    for entry in semantic.get("floors", []):
        floor = int(entry["floor"])
        if floor in floors:
            raise VerifyError("duplicate source floor")
        manifest = load_manifest(safe_join(semantic_path.parent, entry["path"]))
        check_root(manifest, SEMANTIC_FLOOR_DOMAIN, f"source floor {floor}")
        if manifest.get("rootContentId") != entry.get("rootContentId"):
            raise VerifyError(f"source floor linkage mismatch: {floor}")
        floors[floor] = manifest
    return publication, semantic, floors


def verify_overview(root: Path, source_publication_root: Path | None = None, expected_publication_root: str | None = None) -> dict[str, Any]:
    world = load_manifest(root / "world.json")
    if world.get("profile") != OVERVIEW_WORLD_PROFILE:
        raise VerifyError("unsupported overview world profile")
    check_root(world, OVERVIEW_WORLD_DOMAIN, "overview world")
    if world.get("source", {}).get("authority") != "Oteryn/Oteryn-Game":
        raise VerifyError("overview Game authority missing")
    semantics = world.get("semantics", {})
    for key in ("collision", "terrainClassification", "walkability"):
        if semantics.get(key) != "NOT_CLAIMED":
            raise VerifyError(f"overview must not claim {key}")
    cell_size = world.get("cellSizeTiles")
    if not isinstance(cell_size, int) or cell_size <= 0:
        raise VerifyError("invalid overview cell size")

    source_publication = source_semantic = None
    source_floors: dict[int, dict[str, Any]] = {}
    if source_publication_root is not None:
        if not expected_publication_root:
            raise VerifyError("expected publication root is required with source publication verification")
        source_publication, source_semantic, source_floors = _load_source(source_publication_root, expected_publication_root)
        source = world["source"]
        if source.get("publicationRoot") != source_publication.get("rootContentId"):
            raise VerifyError("overview source publication root mismatch")
        if source.get("semanticRoot") != source_semantic.get("rootContentId"):
            raise VerifyError("overview source semantic root mismatch")
        if source.get("sourceFingerprint") != source_semantic.get("sourceFingerprint"):
            raise VerifyError("overview source fingerprint mismatch")
        if source.get("gameSha") != source_publication.get("source", {}).get("gameSha"):
            raise VerifyError("overview source Game revision mismatch")

    seen_floors: set[int] = set()
    seen_addresses: set[tuple[int, int, int]] = set()
    totals = {"cells": 0, "chunks": 0, "floors": 0, "resolvedPrimitives": 0, "tiles": 0}
    for floor_entry in world.get("floors", []):
        floor = floor_entry.get("floor")
        if not isinstance(floor, int) or floor in seen_floors:
            raise VerifyError(f"invalid or duplicate overview floor: {floor!r}")
        seen_floors.add(floor)
        floor_manifest = load_manifest(safe_join(root, floor_entry["path"]))
        if floor_manifest.get("profile") != OVERVIEW_FLOOR_PROFILE:
            raise VerifyError(f"unsupported overview floor profile: {floor}")
        check_root(floor_manifest, OVERVIEW_FLOOR_DOMAIN, f"overview floor {floor}")
        if floor_manifest.get("floor") != floor or floor_manifest.get("rootContentId") != floor_entry.get("rootContentId"):
            raise VerifyError(f"overview floor linkage mismatch: {floor}")
        if floor_manifest.get("cellSizeTiles") != cell_size:
            raise VerifyError(f"overview floor cell size mismatch: {floor}")
        if floor_manifest.get("sourceFingerprint") != world["source"].get("sourceFingerprint"):
            raise VerifyError(f"overview floor source fingerprint mismatch: {floor}")

        source_floor = source_floors.get(floor) if source_publication_root is not None else None
        if source_floor is not None:
            if floor_manifest.get("sourceFloorRoot") != source_floor.get("rootContentId"):
                raise VerifyError(f"overview source floor root mismatch: {floor}")
            if floor_manifest.get("bounds") != source_floor.get("bounds"):
                raise VerifyError(f"overview/source bounds mismatch: {floor}")
            source_entries = {
                (c["logicalAddress"]["floor"], c["logicalAddress"]["region_x"], c["logicalAddress"]["region_y"]): c
                for c in source_floor.get("chunks", [])
            }
        else:
            source_entries = {}

        floor_counts = {"cells": 0, "chunks": 0, "resolvedPrimitives": 0, "tiles": 0}
        for entry in floor_manifest.get("chunks", []):
            logical = entry.get("logicalAddress", {})
            address = (logical.get("floor"), logical.get("region_x"), logical.get("region_y"))
            if address[0] != floor or not all(isinstance(v, int) for v in address):
                raise VerifyError(f"invalid overview logical address: {address!r}")
            if address in seen_addresses:
                raise VerifyError(f"duplicate overview logical address: {address!r}")
            seen_addresses.add(address)
            path = safe_join(root, entry["path"])
            raw = path.read_bytes()
            if len(raw) != entry.get("bytes"):
                raise VerifyError(f"overview chunk byte mismatch: {address!r}")
            content_id = "sha256:" + hashlib.sha256(raw).hexdigest()
            if content_id != entry.get("contentId"):
                raise VerifyError(f"overview chunk content identity mismatch: {address!r}")
            try:
                chunk = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise VerifyError(f"invalid overview chunk JSON: {address!r}") from exc
            if raw != canonical(chunk):
                raise VerifyError(f"non-canonical overview chunk: {address!r}")
            if chunk.get("profile") != OVERVIEW_CHUNK_PROFILE or chunk.get("logicalAddress") != logical:
                raise VerifyError(f"overview chunk identity mismatch: {address!r}")
            if chunk.get("cellSizeTiles") != cell_size or chunk.get("sourceFingerprint") != world["source"].get("sourceFingerprint"):
                raise VerifyError(f"overview chunk source/cell linkage mismatch: {address!r}")
            if chunk.get("sourceContentId") != entry.get("sourceContentId"):
                raise VerifyError(f"overview chunk source content linkage mismatch: {address!r}")

            source_entry = source_entries.pop(address, None) if source_floor is not None else None
            if source_floor is not None:
                if source_entry is None:
                    raise VerifyError(f"overview chunk absent from source floor: {address!r}")
                if entry.get("sourceContentId") != source_entry.get("contentId"):
                    raise VerifyError(f"overview source chunk content mismatch: {address!r}")

            cells = chunk.get("cells")
            if not isinstance(cells, list):
                raise VerifyError(f"overview cells missing: {address!r}")
            last: tuple[int, int] | None = None
            counted_tiles = counted_primitives = 0
            for cell in cells:
                if not isinstance(cell, dict):
                    raise VerifyError(f"invalid overview cell: {address!r}")
                coord = (cell.get("cell_x"), cell.get("cell_y"))
                if not all(isinstance(v, int) for v in coord):
                    raise VerifyError(f"invalid overview cell coordinate: {address!r}")
                if last is not None and coord <= last:
                    raise VerifyError(f"duplicate/unsorted overview cells: {address!r}")
                last = coord
                tiles = cell.get("tiles")
                primitives = cell.get("resolvedPrimitives")
                if not isinstance(tiles, int) or tiles <= 0 or not isinstance(primitives, int) or primitives < 0:
                    raise VerifyError(f"invalid overview cell counts: {address!r}")
                counted_tiles += tiles
                counted_primitives += primitives
            expected_counts = {"cells": len(cells), "resolvedPrimitives": counted_primitives, "tiles": counted_tiles}
            if chunk.get("counts") != expected_counts or entry.get("counts") != expected_counts:
                raise VerifyError(f"overview chunk count mismatch: {address!r}")
            if source_entry is not None:
                if counted_tiles != source_entry.get("tiles") or counted_primitives != source_entry.get("resolvedPrimitives"):
                    raise VerifyError(f"overview/source chunk reconciliation mismatch: {address!r}")
            floor_counts["chunks"] += 1
            for key in ("cells", "resolvedPrimitives", "tiles"):
                floor_counts[key] += expected_counts[key]

        if source_floor is not None and source_entries:
            raise VerifyError(f"source chunks missing from overview floor {floor}: {len(source_entries)}")
        if floor_manifest.get("counts") != floor_counts or floor_entry.get("counts") != floor_counts:
            raise VerifyError(f"overview floor count mismatch: {floor}")
        if source_floor is not None:
            if floor_counts["tiles"] != source_floor["counts"]["tiles"] or floor_counts["resolvedPrimitives"] != source_floor["counts"]["resolvedPrimitives"]:
                raise VerifyError(f"overview/source floor reconciliation mismatch: {floor}")
        totals["floors"] += 1
        for key in ("cells", "chunks", "resolvedPrimitives", "tiles"):
            totals[key] += floor_counts[key]

    if world.get("counts") != totals:
        raise VerifyError("overview world count mismatch")
    if source_semantic is not None:
        source_counts = source_semantic["counts"]
        if totals["floors"] != source_counts["floors"] or totals["chunks"] != source_counts["shards"]:
            raise VerifyError("overview/source world floor/chunk reconciliation mismatch")
        if totals["tiles"] != source_counts["tiles"] or totals["resolvedPrimitives"] != source_counts["resolvedPrimitives"]:
            raise VerifyError("overview/source world semantic reconciliation mismatch")
        if set(source_floors) != seen_floors:
            raise VerifyError("overview/source floor set mismatch")
    return world


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("overview_root", type=Path)
    parser.add_argument("--source-publication", type=Path)
    parser.add_argument("--expected-publication-root")
    args = parser.parse_args()
    try:
        world = verify_overview(args.overview_root, args.source_publication, args.expected_publication_root)
    except (VerifyError, OSError) as exc:
        print(f"ERROR: {exc}")
        return 1
    c = world["counts"]
    print(f"PASS root={world['rootContentId']} floors={c['floors']} chunks={c['chunks']} cells={c['cells']} tiles={c['tiles']} primitives={c['resolvedPrimitives']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
