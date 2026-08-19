#!/usr/bin/env python3
"""Build a deterministic full-world occupancy overview from verified Atlas semantic publication bytes.

This layer is deliberately weak semantically: it records only the presence density of
already-published semantic tile records plus their resolved primitive counts.  It does
not claim walkability, collision, terrain type, quest state, or any other Game fact.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import shutil
from typing import Any

PUBLICATION_PROFILE = "oteryn-atlas-fullworld-publication-v0"
SEMANTIC_PROFILE = "oteryn-atlas-fullworld-semantic-publication-v0"
OVERVIEW_WORLD_PROFILE = "oteryn-atlas-overview-world-v0"
OVERVIEW_FLOOR_PROFILE = "oteryn-atlas-overview-floor-v0"
OVERVIEW_CHUNK_PROFILE = "oteryn-atlas-overview-chunk-v0"
PUBLICATION_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0"
SEMANTIC_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0"
SEMANTIC_FLOOR_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0"
OVERVIEW_WORLD_DOMAIN = b"OTERYN-ATLAS-OVERVIEW-WORLD-V0\0"
OVERVIEW_FLOOR_DOMAIN = b"OTERYN-ATLAS-OVERVIEW-FLOOR-V0\0"
POSITION_RE = re.compile(br'^\{"position":\{"floor":(-?\d+),"x":(-?\d+),"y":(-?\d+)\}')
SPRITE_TOKEN = b'"sprite_source_id":'


class OverviewError(RuntimeError):
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
        raise OverviewError(f"unsafe relative path: {relative!r}")
    return root / rel


def load_canonical_manifest(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise OverviewError(f"unable to read manifest {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise OverviewError(f"manifest root is not an object: {path}")
    if raw != canonical(value):
        raise OverviewError(f"manifest is not canonical JSON: {path}")
    return value


def check_root(value: dict[str, Any], domain: bytes, label: str) -> None:
    expected = rooted(domain, value)
    if value.get("rootContentId") != expected:
        raise OverviewError(f"{label} root mismatch")


def write_canonical(path: Path, value: dict[str, Any]) -> tuple[int, str]:
    raw = canonical(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return len(raw), "sha256:" + hashlib.sha256(raw).hexdigest()


def _scan_chunk(task: tuple[str, dict[str, Any], int, str, str]) -> tuple[dict[str, Any], bytes]:
    source_path_s, entry, cell_size, source_fingerprint, output_name = task
    source_path = Path(source_path_s)
    logical = entry["logicalAddress"]
    expected_floor = int(logical["floor"])
    expected_digest = str(entry["contentId"]).removeprefix("sha256:")
    expected_bytes = int(entry["bytes"])
    expected_tiles = int(entry["tiles"])
    expected_primitives = int(entry["resolvedPrimitives"])

    digest = hashlib.sha256()
    tile_count = 0
    primitive_count = 0
    cells: dict[tuple[int, int], list[int]] = {}
    with source_path.open("rb") as handle:
        for line in handle:
            digest.update(line)
            if not line.endswith(b"\n"):
                raise OverviewError(f"unterminated semantic record in {source_path}")
            match = POSITION_RE.match(line)
            if match is None:
                raise OverviewError(f"semantic record missing canonical position prefix in {source_path}")
            floor, x, y = map(int, match.groups())
            if floor != expected_floor:
                raise OverviewError(f"semantic record floor mismatch in {source_path}")
            primitives = line.count(SPRITE_TOKEN)
            primitive_count += primitives
            tile_count += 1
            key = (x // cell_size, y // cell_size)
            slot = cells.setdefault(key, [0, 0])
            slot[0] += 1
            slot[1] += primitives

    if source_path.stat().st_size != expected_bytes:
        raise OverviewError(f"source semantic chunk byte mismatch: {source_path}")
    if digest.hexdigest() != expected_digest:
        raise OverviewError(f"source semantic chunk digest mismatch: {source_path}")
    if tile_count != expected_tiles:
        raise OverviewError(f"source semantic chunk tile count mismatch: {source_path}")
    if primitive_count != expected_primitives:
        raise OverviewError(f"source semantic chunk primitive count mismatch: {source_path}")

    ordered_cells = [
        {"cell_x": cx, "cell_y": cy, "resolvedPrimitives": values[1], "tiles": values[0]}
        for (cx, cy), values in sorted(cells.items())
    ]
    if ordered_cells:
        cell_bounds = {
            "cell_x_min": min(item["cell_x"] for item in ordered_cells),
            "cell_x_max_exclusive": max(item["cell_x"] for item in ordered_cells) + 1,
            "cell_y_min": min(item["cell_y"] for item in ordered_cells),
            "cell_y_max_exclusive": max(item["cell_y"] for item in ordered_cells) + 1,
        }
    else:
        cell_bounds = None

    chunk = {
        "cellSizeTiles": cell_size,
        "cells": ordered_cells,
        "counts": {"cells": len(ordered_cells), "resolvedPrimitives": primitive_count, "tiles": tile_count},
        "logicalAddress": {"floor": expected_floor, "region_x": int(logical["region_x"]), "region_y": int(logical["region_y"])},
        "profile": OVERVIEW_CHUNK_PROFILE,
        "sourceContentId": entry["contentId"],
        "sourceFingerprint": source_fingerprint,
    }
    raw = canonical(chunk)
    index_entry = {
        "bytes": len(raw),
        "cellBounds": cell_bounds,
        "contentId": "sha256:" + hashlib.sha256(raw).hexdigest(),
        "counts": chunk["counts"],
        "logicalAddress": chunk["logicalAddress"],
        "path": f"chunks/{output_name}",
        "sourceContentId": entry["contentId"],
    }
    return index_entry, raw


def build_overview(publication_root: Path, output_root: Path, *, expected_publication_root: str, cell_size: int = 16, workers: int = 1) -> dict[str, Any]:
    if cell_size <= 0:
        raise OverviewError("cell size must be positive")
    publication = load_canonical_manifest(publication_root / "publication.json")
    if publication.get("profile") != PUBLICATION_PROFILE:
        raise OverviewError("unsupported full-world publication profile")
    check_root(publication, PUBLICATION_DOMAIN, "publication")
    if publication.get("rootContentId") != expected_publication_root:
        raise OverviewError("source publication root does not match expected authoritative root")
    if publication.get("source", {}).get("authority") != "Oteryn/Oteryn-Game":
        raise OverviewError("Game authority missing from publication")

    semantic_path = safe_join(publication_root, publication["semantic"]["path"])
    semantic = load_canonical_manifest(semantic_path)
    if semantic.get("profile") != SEMANTIC_PROFILE:
        raise OverviewError("unsupported semantic publication profile")
    check_root(semantic, SEMANTIC_DOMAIN, "semantic world")
    if semantic.get("rootContentId") != publication["semantic"].get("rootContentId"):
        raise OverviewError("semantic root linkage mismatch")
    source_fingerprint = semantic.get("sourceFingerprint")
    if source_fingerprint != publication.get("source", {}).get("sourceFingerprint"):
        raise OverviewError("source fingerprint linkage mismatch")

    if output_root.exists():
        shutil.rmtree(output_root)
    (output_root / "chunks").mkdir(parents=True)
    (output_root / "floors").mkdir(parents=True)

    world_floors: list[dict[str, Any]] = []
    world_counts = {"cells": 0, "chunks": 0, "floors": 0, "resolvedPrimitives": 0, "tiles": 0}
    seen_addresses: set[tuple[int, int, int]] = set()
    seen_output_paths: set[str] = set()
    semantic_root = semantic_path.parent

    for floor_entry in semantic.get("floors", []):
        floor = int(floor_entry["floor"])
        source_floor = load_canonical_manifest(safe_join(semantic_root, floor_entry["path"]))
        check_root(source_floor, SEMANTIC_FLOOR_DOMAIN, f"semantic floor {floor}")
        if source_floor.get("rootContentId") != floor_entry.get("rootContentId"):
            raise OverviewError(f"semantic floor root linkage mismatch: {floor}")
        if source_floor.get("sourceFingerprint") != source_fingerprint:
            raise OverviewError(f"semantic floor source fingerprint mismatch: {floor}")

        tasks: list[tuple[str, dict[str, Any], int, str, str]] = []
        for entry in source_floor.get("chunks", []):
            logical = entry.get("logicalAddress", {})
            address = (logical.get("floor"), logical.get("region_x"), logical.get("region_y"))
            if address[0] != floor or not all(isinstance(v, int) for v in address):
                raise OverviewError(f"invalid semantic logical address: {address!r}")
            if address in seen_addresses:
                raise OverviewError(f"duplicate semantic logical address: {address!r}")
            seen_addresses.add(address)
            source_chunk = safe_join(semantic_root, entry["path"])
            output_name = Path(entry["path"]).with_suffix(".overview.json").name
            output_rel = f"chunks/{output_name}"
            if output_rel in seen_output_paths:
                raise OverviewError(f"duplicate overview output path: {output_rel}")
            seen_output_paths.add(output_rel)
            tasks.append((str(source_chunk), entry, cell_size, source_fingerprint, output_name))

        if workers == 1:
            results = [_scan_chunk(task) for task in tasks]
        else:
            with ProcessPoolExecutor(max_workers=workers) as pool:
                results = list(pool.map(_scan_chunk, tasks, chunksize=1))

        indexed: list[dict[str, Any]] = []
        floor_counts = {"cells": 0, "chunks": 0, "resolvedPrimitives": 0, "tiles": 0}
        for index_entry, raw in results:
            target = output_root / index_entry["path"]
            target.write_bytes(raw)
            indexed.append(index_entry)
            floor_counts["chunks"] += 1
            for key in ("cells", "resolvedPrimitives", "tiles"):
                floor_counts[key] += int(index_entry["counts"][key])

        if floor_counts["tiles"] != source_floor.get("counts", {}).get("tiles"):
            raise OverviewError(f"overview/source tile reconciliation mismatch: floor {floor}")
        if floor_counts["resolvedPrimitives"] != source_floor.get("counts", {}).get("resolvedPrimitives"):
            raise OverviewError(f"overview/source primitive reconciliation mismatch: floor {floor}")

        floor_manifest: dict[str, Any] = {
            "bounds": source_floor.get("bounds"),
            "cellSizeTiles": cell_size,
            "chunks": indexed,
            "counts": floor_counts,
            "floor": floor,
            "profile": OVERVIEW_FLOOR_PROFILE,
            "sourceFingerprint": source_fingerprint,
            "sourceFloorRoot": source_floor["rootContentId"],
        }
        floor_manifest["rootContentId"] = rooted(OVERVIEW_FLOOR_DOMAIN, floor_manifest)
        floor_rel = f"floors/f{floor}.json"
        floor_bytes, _ = write_canonical(output_root / floor_rel, floor_manifest)
        world_floors.append({
            "bytes": floor_bytes,
            "counts": floor_counts,
            "floor": floor,
            "path": floor_rel,
            "rootContentId": floor_manifest["rootContentId"],
            "sourceFloorRoot": source_floor["rootContentId"],
        })
        world_counts["floors"] += 1
        for key in ("cells", "chunks", "resolvedPrimitives", "tiles"):
            world_counts[key] += floor_counts[key]

    source_counts = semantic.get("counts", {})
    if world_counts["floors"] != source_counts.get("floors") or world_counts["chunks"] != source_counts.get("shards"):
        raise OverviewError("overview/source world floor or chunk reconciliation mismatch")
    if world_counts["tiles"] != source_counts.get("tiles") or world_counts["resolvedPrimitives"] != source_counts.get("resolvedPrimitives"):
        raise OverviewError("overview/source world semantic reconciliation mismatch")

    world: dict[str, Any] = {
        "cellSizeTiles": cell_size,
        "counts": world_counts,
        "floors": world_floors,
        "profile": OVERVIEW_WORLD_PROFILE,
        "semantics": {
            "collision": "NOT_CLAIMED",
            "terrainClassification": "NOT_CLAIMED",
            "walkability": "NOT_CLAIMED",
            "meaning": "semantic tile presence density only",
        },
        "source": {
            "authority": "Oteryn/Oteryn-Game",
            "gameSha": publication["source"].get("gameSha"),
            "publicationRoot": publication["rootContentId"],
            "semanticRoot": semantic["rootContentId"],
            "sourceFingerprint": source_fingerprint,
        },
    }
    world["rootContentId"] = rooted(OVERVIEW_WORLD_DOMAIN, world)
    write_canonical(output_root / "world.json", world)
    return world


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("publication_root", type=Path)
    parser.add_argument("output_root", type=Path)
    parser.add_argument("--expected-publication-root", required=True)
    parser.add_argument("--cell-size", type=int, default=16)
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    try:
        world = build_overview(args.publication_root, args.output_root, expected_publication_root=args.expected_publication_root, cell_size=args.cell_size, workers=max(1, args.workers))
    except OverviewError as exc:
        print(f"ERROR: {exc}")
        return 1
    print(
        "PASS "
        f"root={world['rootContentId']} floors={world['counts']['floors']} chunks={world['counts']['chunks']} "
        f"cells={world['counts']['cells']} tiles={world['counts']['tiles']} primitives={world['counts']['resolvedPrimitives']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
