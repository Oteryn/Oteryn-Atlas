#!/usr/bin/env python3
"""Build a byte-range transport index from a verified G3 full-world publication.

The index is an Atlas-derived browser transport aid. It never changes semantic
identity: every range is exact bytes from a content-addressed G3 semantic chunk.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any

PUBLICATION_PROFILE = "oteryn-atlas-fullworld-publication-v0"
SEMANTIC_PROFILE = "oteryn-atlas-fullworld-semantic-publication-v0"
RUNTIME_WORLD_PROFILE = "oteryn-atlas-fullworld-runtime-index-v0"
RUNTIME_FLOOR_PROFILE = "oteryn-atlas-fullworld-runtime-floor-index-v0"
PUBLICATION_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-PUBLICATION-V0\0"
SEMANTIC_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-SEMANTIC-V0\0"
FLOOR_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-FLOOR-V0\0"
RUNTIME_WORLD_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-WORLD-V0\0"
RUNTIME_FLOOR_DOMAIN = b"OTERYN-ATLAS-FULLWORLD-RUNTIME-INDEX-FLOOR-V0\0"
POSITION_RE = re.compile(br'"position":\{"floor":(-?\d+),"x":(-?\d+),"y":(-?\d+)\}')
SPRITE_RE = re.compile(br'"sprite_source_id":(\d+)')
WIDTH_RE = re.compile(br'"width_units":(\d+)')
HEIGHT_RE = re.compile(br'"height_units":(\d+)')
DX_RE = re.compile(br'"dx_units":(-?\d+)')
DY_RE = re.compile(br'"dy_units":(-?\d+)')
REGION_SPAN = 256  # verified G1/G2 hand-off generation.region_span


class RuntimeIndexError(RuntimeError):
    pass


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def rooted(domain: bytes, value: dict[str, Any]) -> str:
    core = dict(value)
    core.pop("rootContentId", None)
    return "sha256:" + hashlib.sha256(domain + canonical(core)).hexdigest()


def safe_join(root: Path, relative: str) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or "." in rel.parts:
        raise RuntimeIndexError(f"unsafe relative path: {relative!r}")
    return root / rel


def load_manifest(path: Path) -> dict[str, Any]:
    raw = path.read_bytes()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeIndexError(f"invalid JSON: {path}") from exc
    if not isinstance(value, dict) or raw != canonical(value):
        raise RuntimeIndexError(f"manifest is not canonical JSON object: {path}")
    return value


def require_root(value: dict[str, Any], domain: bytes, expected: str | None, label: str) -> None:
    actual = rooted(domain, value)
    if value.get("rootContentId") != actual:
        raise RuntimeIndexError(f"{label} self root mismatch")
    if expected is not None and actual != expected:
        raise RuntimeIndexError(f"{label} trusted root mismatch: {actual} != {expected}")


def finalize_group(state: dict[str, Any] | None) -> dict[str, Any] | None:
    if state is None:
        return None
    return {
        "bytes": state["bytes"],
        "contentId": "sha256:" + state["digest"].hexdigest(),
        "offset": state["offset"],
        "resolvedPrimitives": state["resolvedPrimitives"],
        "tiles": state["tiles"],
        "yMaxExclusive": state["yMaxExclusive"],
        "yMin": state["yMin"],
    }


def scan_chunk(path: Path, entry: dict[str, Any], floor: int, row_group_span: int) -> tuple[list[dict[str, Any]], dict[str, int]]:
    logical = entry.get("logicalAddress", {})
    rx, ry = logical.get("region_x"), logical.get("region_y")
    if not isinstance(rx, int) or not isinstance(ry, int) or logical.get("floor") != floor:
        raise RuntimeIndexError(f"invalid logical address for {path}")
    expected_x_min, expected_x_max = rx * REGION_SPAN, (rx + 1) * REGION_SPAN
    expected_y_min, expected_y_max = ry * REGION_SPAN, (ry + 1) * REGION_SPAN

    chunk_digest = hashlib.sha256()
    groups: list[dict[str, Any]] = []
    visual = {"maxWidthUnits": 32, "maxHeightUnits": 32, "minDxUnits": 0, "maxDxUnits": 0, "minDyUnits": 0, "maxDyUnits": 0}
    current: dict[str, Any] | None = None
    offset = 0
    line_count = 0
    primitive_count = 0
    previous: tuple[int, int] | None = None

    with path.open("rb") as handle:
        for line in handle:
            if not line.endswith(b"\n"):
                raise RuntimeIndexError(f"unterminated semantic record: {path}")
            chunk_digest.update(line)
            match = POSITION_RE.search(line)
            if match is None:
                raise RuntimeIndexError(f"semantic position missing: {path}:{line_count + 1}")
            line_floor, x, y = (int(value) for value in match.groups())
            if line_floor != floor or not (expected_x_min <= x < expected_x_max) or not (expected_y_min <= y < expected_y_max):
                raise RuntimeIndexError(f"record outside logical chunk: {path}:{line_count + 1}")
            order = (y, x)
            if previous is not None and order <= previous:
                raise RuntimeIndexError(f"semantic records not strictly y,x ordered: {path}:{line_count + 1}")
            previous = order

            group_y_min = (y // row_group_span) * row_group_span
            if current is None or current["yMin"] != group_y_min:
                completed = finalize_group(current)
                if completed is not None:
                    groups.append(completed)
                current = {
                    "bytes": 0,
                    "digest": hashlib.sha256(),
                    "offset": offset,
                    "resolvedPrimitives": 0,
                    "tiles": 0,
                    "yMin": group_y_min,
                    "yMaxExclusive": group_y_min + row_group_span,
                }
            assert current is not None
            current["digest"].update(line)
            current["bytes"] += len(line)
            current["tiles"] += 1
            sprites = SPRITE_RE.findall(line)
            current["resolvedPrimitives"] += len(sprites)
            primitive_count += len(sprites)
            line_count += 1
            offset += len(line)

            widths = [int(value) for value in WIDTH_RE.findall(line)]
            heights = [int(value) for value in HEIGHT_RE.findall(line)]
            dxs = [int(value) for value in DX_RE.findall(line)]
            dys = [int(value) for value in DY_RE.findall(line)]
            if widths:
                visual["maxWidthUnits"] = max(visual["maxWidthUnits"], max(widths))
            if heights:
                visual["maxHeightUnits"] = max(visual["maxHeightUnits"], max(heights))
            if dxs:
                visual["minDxUnits"] = min(visual["minDxUnits"], min(dxs))
                visual["maxDxUnits"] = max(visual["maxDxUnits"], max(dxs))
            if dys:
                visual["minDyUnits"] = min(visual["minDyUnits"], min(dys))
                visual["maxDyUnits"] = max(visual["maxDyUnits"], max(dys))

    completed = finalize_group(current)
    if completed is not None:
        groups.append(completed)
    expected_digest = str(entry.get("contentId", "")).removeprefix("sha256:")
    if chunk_digest.hexdigest() != expected_digest:
        raise RuntimeIndexError(f"source semantic chunk digest mismatch: {path}")
    if offset != entry.get("bytes") or line_count != entry.get("tiles") or primitive_count != entry.get("resolvedPrimitives"):
        raise RuntimeIndexError(f"source semantic chunk count mismatch: {path}")
    return groups, visual


def merge_visual(target: dict[str, int], source: dict[str, int]) -> None:
    target["maxWidthUnits"] = max(target["maxWidthUnits"], source["maxWidthUnits"])
    target["maxHeightUnits"] = max(target["maxHeightUnits"], source["maxHeightUnits"])
    target["minDxUnits"] = min(target["minDxUnits"], source["minDxUnits"])
    target["maxDxUnits"] = max(target["maxDxUnits"], source["maxDxUnits"])
    target["minDyUnits"] = min(target["minDyUnits"], source["minDyUnits"])
    target["maxDyUnits"] = max(target["maxDyUnits"], source["maxDyUnits"])


def previous_chunks(previous_output: Path | None, row_group_span: int, expected_previous_root: str | None) -> dict[str, dict[str, Any]]:
    if previous_output is None:
        return {}
    if expected_previous_root is None:
        raise RuntimeIndexError("previous runtime index reuse requires an exact trusted root")
    if not (previous_output / "world.json").is_file():
        raise RuntimeIndexError("trusted previous runtime index world is missing")
    try:
        world = load_manifest(previous_output / "world.json")
    except (OSError, RuntimeIndexError):
        return {}
    if world.get("profile") != RUNTIME_WORLD_PROFILE or world.get("regionSpan") != REGION_SPAN or world.get("rowGroupSpan") != row_group_span:
        raise RuntimeIndexError("trusted previous runtime index profile/span mismatch")
    require_root(world, RUNTIME_WORLD_DOMAIN, expected_previous_root, "previous runtime index world")
    result: dict[str, dict[str, Any]] = {}
    for floor_entry in world.get("floors", []):
        floor = load_manifest(safe_join(previous_output, floor_entry["path"]))
        require_root(floor, RUNTIME_FLOOR_DOMAIN, floor_entry.get("rootContentId"), f"previous runtime floor {floor_entry.get('floor')}")
        for chunk in floor.get("chunks", []):
            logical = chunk.get("logicalAddress", {})
            if not all(isinstance(logical.get(key), int) for key in ("floor", "region_x", "region_y")):
                continue
            key = f"{logical['floor']}:{logical['region_x']}:{logical['region_y']}"
            result[key] = chunk
    return result


def build(publication_root: Path, output_root: Path, expected_publication_root: str, row_group_span: int, previous_output: Path | None = None, expected_previous_root: str | None = None) -> dict[str, Any]:
    publication = load_manifest(publication_root / "publication.json")
    if publication.get("profile") != PUBLICATION_PROFILE or publication.get("source", {}).get("authority") != "Oteryn/Oteryn-Game":
        raise RuntimeIndexError("unsupported or non-Game publication")
    require_root(publication, PUBLICATION_DOMAIN, expected_publication_root, "publication")

    semantic_path = safe_join(publication_root, publication["semantic"]["path"])
    semantic = load_manifest(semantic_path)
    if semantic.get("profile") != SEMANTIC_PROFILE:
        raise RuntimeIndexError("unsupported semantic world profile")
    require_root(semantic, SEMANTIC_DOMAIN, publication["semantic"]["rootContentId"], "semantic world")
    semantic_root = semantic_path.parent

    output_root.mkdir(parents=True, exist_ok=True)
    (output_root / "floors").mkdir(exist_ok=True)
    visual = {"maxWidthUnits": 32, "maxHeightUnits": 32, "minDxUnits": 0, "maxDxUnits": 0, "minDyUnits": 0, "maxDyUnits": 0}
    world_floor_entries: list[dict[str, Any]] = []
    total_groups = 0
    prior_chunks = previous_chunks(previous_output, row_group_span, expected_previous_root)
    reused_chunks = 0
    scanned_chunks = 0

    for floor_entry in semantic["floors"]:
        floor = floor_entry["floor"]
        floor_manifest = load_manifest(safe_join(semantic_root, floor_entry["path"]))
        require_root(floor_manifest, FLOOR_DOMAIN, floor_entry["rootContentId"], f"floor {floor}")
        if floor_manifest.get("sourceFingerprint") != semantic.get("sourceFingerprint"):
            raise RuntimeIndexError(f"floor source fingerprint mismatch: {floor}")
        indexed_chunks = []
        floor_groups = 0
        for chunk in floor_manifest["chunks"]:
            logical = chunk["logicalAddress"]
            key = f"{logical['floor']}:{logical['region_x']}:{logical['region_y']}"
            previous_chunk = prior_chunks.get(key)
            reusable = (
                previous_chunk is not None
                and previous_chunk.get("contentId") == chunk.get("contentId")
                and previous_chunk.get("bytes") == chunk.get("bytes")
                and previous_chunk.get("tiles") == chunk.get("tiles")
                and previous_chunk.get("resolvedPrimitives") == chunk.get("resolvedPrimitives")
                and previous_chunk.get("logicalAddress") == logical
                and isinstance(previous_chunk.get("groups"), list)
                and isinstance(previous_chunk.get("visualBounds"), dict)
            )
            if reusable:
                groups = previous_chunk["groups"]
                chunk_visual = previous_chunk["visualBounds"]
                reused_chunks += 1
            else:
                chunk_path = safe_join(semantic_root, chunk["path"])
                groups, chunk_visual = scan_chunk(chunk_path, chunk, floor, row_group_span)
                scanned_chunks += 1
            merge_visual(visual, chunk_visual)
            floor_groups += len(groups)
            chunk_bounds = {
                "x_min": logical["region_x"] * REGION_SPAN,
                "x_max_exclusive": (logical["region_x"] + 1) * REGION_SPAN,
                "y_min": logical["region_y"] * REGION_SPAN,
                "y_max_exclusive": (logical["region_y"] + 1) * REGION_SPAN,
            }
            world_chunk = {
                "chunk_id": f"world-chunk:f{floor}:rx{logical['region_x']}:ry{logical['region_y']}",
                "floor": floor,
                "bounds": chunk_bounds,
                "semantic_root": semantic["rootContentId"],
                "pixel_root": publication["pixels"]["rootContentId"],
                "dependencies": sorted([floor_entry["rootContentId"], semantic["rootContentId"], publication["pixels"]["rootContentId"]]),
                "content_hash": chunk["contentId"],
                "estimated_memory_cost": chunk["bytes"],
                "identityAuthority": False,
            }
            indexed_chunks.append({
                "bytes": chunk["bytes"],
                "contentId": chunk["contentId"],
                "groups": groups,
                "logicalAddress": logical,
                "path": chunk["path"],
                "resolvedPrimitives": chunk["resolvedPrimitives"],
                "tiles": chunk["tiles"],
                "visualBounds": chunk_visual,
                "worldChunk": world_chunk,
            })
        counts = {
            "chunks": len(indexed_chunks),
            "groups": floor_groups,
            "resolvedPrimitives": floor_manifest["counts"]["resolvedPrimitives"],
            "sourceBytes": floor_manifest["counts"]["bytes"],
            "tiles": floor_manifest["counts"]["tiles"],
        }
        floor_index = {
            "bounds": floor_manifest["bounds"],
            "chunks": indexed_chunks,
            "counts": counts,
            "floor": floor,
            "profile": RUNTIME_FLOOR_PROFILE,
            "regionSpan": REGION_SPAN,
            "rowGroupSpan": row_group_span,
            "sourceFingerprint": semantic["sourceFingerprint"],
            "sourceFloorRoot": floor_entry["rootContentId"],
            "sourcePublicationRoot": publication["rootContentId"],
            "sourceSemanticRoot": semantic["rootContentId"],
        }
        floor_index["rootContentId"] = rooted(RUNTIME_FLOOR_DOMAIN, floor_index)
        relative = f"floors/f{floor}.json"
        data = canonical(floor_index)
        (output_root / relative).write_bytes(data)
        world_floor_entries.append({
            "bounds": floor_manifest["bounds"],
            "bytes": len(data),
            "counts": counts,
            "floor": floor,
            "path": relative,
            "rootContentId": floor_index["rootContentId"],
            "sourceFloorRoot": floor_entry["rootContentId"],
        })
        total_groups += floor_groups

    visual["overscanTiles"] = {
        "bottom": math.ceil(max(0, visual["maxDyUnits"]) / 32),
        "left": math.ceil(max(0, (visual["maxWidthUnits"] - 32) - visual["minDxUnits"]) / 32),
        "right": math.ceil(max(0, visual["maxDxUnits"]) / 32),
        "top": math.ceil(max(0, (visual["maxHeightUnits"] - 32) - visual["minDyUnits"]) / 32),
    }
    source_counts = semantic["counts"]
    world = {
        "counts": {
            "floors": source_counts["floors"],
            "groups": total_groups,
            "resolvedPrimitives": source_counts["resolvedPrimitives"],
            "shards": source_counts["shards"],
            "sourceBytes": source_counts["bytes"],
            "tiles": source_counts["tiles"],
        },
        "floors": world_floor_entries,
        "profile": RUNTIME_WORLD_PROFILE,
        "regionSpan": REGION_SPAN,
        "rowGroupSpan": row_group_span,
        "source": {
            "authority": "Oteryn/Oteryn-Game",
            "gameSha": publication["source"]["gameSha"],
            "pixelRoot": publication["pixels"]["rootContentId"],
            "publicationRoot": publication["rootContentId"],
            "semanticRoot": semantic["rootContentId"],
            "sourceFingerprint": semantic["sourceFingerprint"],
        },
        "visualBounds": visual,
    }
    world["rootContentId"] = rooted(RUNTIME_WORLD_DOMAIN, world)
    (output_root / "world.json").write_bytes(canonical(world))
    result = dict(world)
    result["_buildEvidence"] = {
        "previousOutputUsed": previous_output is not None and bool(prior_chunks),
        "reusedChunks": reused_chunks,
        "scannedChunks": scanned_chunks,
    }
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publication", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--expected-publication-root", required=True)
    parser.add_argument("--row-group-span", type=int, default=4)
    parser.add_argument("--previous-output", type=Path)
    parser.add_argument("--expected-previous-root")
    args = parser.parse_args()
    if args.row_group_span < 1 or args.row_group_span > REGION_SPAN or REGION_SPAN % args.row_group_span:
        raise SystemExit("row-group-span must be a positive divisor of 256")
    previous_output = args.previous_output.resolve() if args.previous_output else None
    world = build(args.publication.resolve(), args.output.resolve(), args.expected_publication_root, args.row_group_span, previous_output, args.expected_previous_root)
    print(json.dumps({"result": "PASS", "rootContentId": world["rootContentId"], "counts": world["counts"], "visualBounds": world["visualBounds"], "buildEvidence": world["_buildEvidence"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
