#!/usr/bin/env python3
"""Deterministic proof-local compiler from the exact Game Thais artifact to Atlas chunks."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

PROFILE = "dyn-atlas-compact-json-v0"
SOURCE_ARTIFACT = "sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e"
SOURCE_PRODUCER_SHA = "8553e2b6e354a7ccb7d273d16f1a2e0cf49b6ad0"
SOURCE_TILES_SHA = "ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984"
SOURCE_DIAGNOSTICS_SHA = "60326e4e048106d4366a2fd8fe472ccfdf06667fcd0f234977febfeaa38f31b8"
SOURCE_APPEARANCE_PROFILE = "oteryn-atlas-15-32-appearance-spatial-v1"
SOURCE_COORDINATE_PROFILE = "oteryn-world-spatial-v1"
SOURCE_CONTRACT = "oteryn-game-atlas-export-v1"
SOURCE_PHYSICAL_PROFILE = "dyn-atlas-thais-z7-jsonl-v0"
ORIGIN_X = 32280
ORIGIN_Y = 32155
MAX_X_EXCLUSIVE = 32441
MAX_Y_EXCLUSIVE = 32306
FLOOR = -7
EXPECTED_TILES = 24311
EXPECTED_PRESENTATIONS = 39282
EXPECTED_PRIMITIVES = 39282
MAX_SOURCE_BYTES = 32 * 1024 * 1024
MAX_LINE_BYTES = 1_048_576


class CompileError(RuntimeError):
    pass


def canonical_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_source(source: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    manifest_path = source / "manifest.json"
    tiles_path = source / "tiles.jsonl"
    diagnostics_path = source / "diagnostics.json"
    for path in (manifest_path, tiles_path, diagnostics_path):
        if not path.is_file():
            raise CompileError(f"missing source file {path.name}")

    if tiles_path.stat().st_size > MAX_SOURCE_BYTES:
        raise CompileError("source tiles exceed proof compiler cap")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("artifact_digest") != SOURCE_ARTIFACT:
        raise CompileError("unexpected source artifact digest")
    if manifest.get("producer_repository_sha") != SOURCE_PRODUCER_SHA:
        raise CompileError("unexpected source producer SHA")
    if manifest.get("contract_id") != SOURCE_CONTRACT or manifest.get("coordinate_profile") != SOURCE_COORDINATE_PROFILE:
        raise CompileError("unsupported source semantic profiles")
    if manifest.get("appearance_profile") != SOURCE_APPEARANCE_PROFILE or manifest.get("physical_profile") != SOURCE_PHYSICAL_PROFILE:
        raise CompileError("unsupported source appearance/physical profile")
    if sha256_file(tiles_path) != SOURCE_TILES_SHA:
        raise CompileError("source tiles digest mismatch")
    if sha256_file(diagnostics_path) != SOURCE_DIAGNOSTICS_SHA:
        raise CompileError("source diagnostics digest mismatch")
    if json.loads(diagnostics_path.read_text(encoding="utf-8")) != {"diagnostics": []}:
        raise CompileError("source diagnostics are not empty")

    tiles: list[dict[str, Any]] = []
    with tiles_path.open("rb") as handle:
        for line_number, line in enumerate(handle, 1):
            if len(line) > MAX_LINE_BYTES or not line.endswith(b"\n"):
                raise CompileError(f"invalid source line {line_number}")
            value = json.loads(line)
            if canonical_bytes(value) != line:
                raise CompileError(f"source line {line_number} is not canonical")
            tiles.append(value)

    if len(tiles) != EXPECTED_TILES:
        raise CompileError(f"expected {EXPECTED_TILES} source tiles, got {len(tiles)}")
    return manifest, tiles


def compact_tile(tile: dict[str, Any]) -> list[Any]:
    position = tile["position"]
    source = tile["source_position"]
    presentations = []

    for item in tile["presentation"]:
        if item.get("canonical_entity_id") is not None or item.get("entity_identity_state") != "UNRESOLVED":
            raise CompileError("unexpected canonical identity state")

        primitives = []
        for primitive in item["resolved_primitives"]:
            coverage: list[int] = []
            for offset in primitive["visual_coverage_offsets"]:
                coverage.extend([offset["dx_tiles"], offset["dy_tiles"]])
            primitives.append(
                [
                    primitive["sprite_source_id"],
                    primitive["frame_group_id"],
                    primitive["frame_group_type"],
                    primitive["phase"],
                    primitive["layer_index"],
                    primitive["pattern"]["x"],
                    primitive["pattern"]["y"],
                    primitive["pattern"]["z"],
                    primitive["width_units"],
                    primitive["height_units"],
                    primitive["displacement"]["dx_units"],
                    primitive["displacement"]["dy_units"],
                    coverage,
                ]
            )

        role = 0 if item["source_role"] == "ground" else 1 if item["source_role"] == "tile_item" else None
        if role is None:
            raise CompileError("unsupported source role")
        presentations.append(
            [
                item["export_record_id"],
                item["appearance_source_id"],
                0,  # explicit UNRESOLVED canonical entity identity
                item["presentation_order"]["plane"],
                item["presentation_order"]["order"],
                role,
                primitives,
            ]
        )

    return [
        position["x"],
        position["y"],
        position["floor"],
        source["legacy_x"],
        source["legacy_y"],
        source["legacy_z"],
        tile["tile_record_id"],
        presentations,
    ]


def compile_tiles(tiles: Iterable[dict[str, Any]], span: int) -> tuple[dict[str, bytes], dict[str, Any]]:
    if span not in {8, 16, 24, 32, 48, 64}:
        raise CompileError("unsupported proof chunk span")

    grouped: dict[tuple[int, int, int], list[list[Any]]] = defaultdict(list)
    tile_count = presentation_count = primitive_count = 0

    for tile in tiles:
        position = tile["position"]
        x, y, floor = position["x"], position["y"], position["floor"]
        if floor != FLOOR or not (ORIGIN_X <= x < MAX_X_EXCLUSIVE and ORIGIN_Y <= y < MAX_Y_EXCLUSIVE):
            raise CompileError("tile outside bounded selection")
        cx = (x - ORIGIN_X) // span
        cy = (y - ORIGIN_Y) // span
        compact = compact_tile(tile)
        grouped[(floor, cx, cy)].append(compact)
        tile_count += 1
        presentation_count += len(compact[7])
        primitive_count += sum(len(record[6]) for record in compact[7])

    if (tile_count, presentation_count, primitive_count) != (EXPECTED_TILES, EXPECTED_PRESENTATIONS, EXPECTED_PRIMITIVES):
        raise CompileError("source counts do not reconcile")

    chunks: dict[str, bytes] = {}
    chunk_entries = []
    for floor, cx, cy in sorted(grouped):
        values = grouped[(floor, cx, cy)]
        address = f"f{floor}/x{cx}/y{cy}"
        chunk = {
            "address": {"cx": cx, "cy": cy, "floor": floor, "span": span},
            "appearanceProfile": SOURCE_APPEARANCE_PROFILE,
            "profile": PROFILE,
            "sourceArtifact": SOURCE_ARTIFACT,
            "tiles": values,
        }
        data = canonical_bytes(chunk)
        digest = sha256_bytes(data)
        path = f"chunks/f{floor}-x{cx}-y{cy}.json"
        chunks[path] = data
        chunk_entries.append(
            {
                "address": address,
                "bytes": len(data),
                "contentId": f"sha256:{digest}",
                "gzipBytes": len(gzip.compress(data, compresslevel=9, mtime=0)),
                "path": path,
                "tiles": len(values),
            }
        )

    manifest_core = {
        "bounds": {
            "floor": FLOOR,
            "xMaxExclusive": MAX_X_EXCLUSIVE,
            "xMin": ORIGIN_X,
            "yMaxExclusive": MAX_Y_EXCLUSIVE,
            "yMin": ORIGIN_Y,
        },
        "chunking": {"originX": ORIGIN_X, "originY": ORIGIN_Y, "span": span},
        "chunks": chunk_entries,
        "counts": {
            "presentationRecords": presentation_count,
            "resolvedPrimitives": primitive_count,
            "tiles": tile_count,
        },
        "profile": PROFILE,
        "source": {
            "appearanceProfile": SOURCE_APPEARANCE_PROFILE,
            "artifactDigest": SOURCE_ARTIFACT,
            "contractId": SOURCE_CONTRACT,
            "coordinateProfile": SOURCE_COORDINATE_PROFILE,
            "physicalProfile": SOURCE_PHYSICAL_PROFILE,
            "producerRepositorySha": SOURCE_PRODUCER_SHA,
            "tilesSha256": SOURCE_TILES_SHA,
        },
        "version": 0,
    }

    root_hash = hashlib.sha256()
    root_hash.update(b"OTERYN-DYN-ATLAS-COMPACT-JSON-V0\0")
    root_hash.update(canonical_bytes(manifest_core))
    manifest = dict(manifest_core)
    manifest["rootContentId"] = f"sha256:{root_hash.hexdigest()}"
    return chunks, manifest


def write_compiled(source: Path, output: Path, span: int) -> dict[str, Any]:
    _source_manifest, tiles = load_source(source)
    chunks, manifest = compile_tiles(tiles, span)
    output.mkdir(parents=True, exist_ok=True)
    for relative_path, data in chunks.items():
        path = output / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    (output / "manifest.json").write_bytes(canonical_bytes(manifest))
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--span", type=int, default=32)
    args = parser.parse_args()
    try:
        manifest = write_compiled(args.source, args.output, args.span)
    except (CompileError, OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
