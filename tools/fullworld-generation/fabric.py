#!/usr/bin/env python3
"""Evidence-driven, resumable full-world local generation fabric for Oteryn Atlas.

This tool is orchestration only. It deliberately delegates every per-tile semantic
presentation decision to the exact pinned Oteryn-Game DYN producer implementation.
Legacy OTBM and Tibia asset inputs stay on the local producer/import side and are
never browser/runtime fallback authority.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import heapq
import importlib.util
import json
import math
import multiprocessing
import os
import pickle
import re
import resource
import shutil
import struct
import subprocess
import sys
import threading
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO, Iterable, Iterator

FABRIC_FORMAT = "oteryn-atlas-fullworld-generation-fabric-v0"
CACHE_FORMAT = "oteryn-atlas-fullworld-private-tile-cache-v0"
BATCH_FORMAT = "oteryn-atlas-fullworld-generation-batch-v0"
SHARD_FORMAT = "oteryn-atlas-fullworld-generation-shard-v0"
HANDOFF_FORMAT = "oteryn-atlas-fullworld-generation-handoff-v0"
CACHE_MAGIC = b"OTERYN-ATLAS-FULLWORLD-PRIVATE-TILE-CACHE-V0\n"
SHARD_RECORD = struct.Struct("<iiI")
GAME_EXPORT_REL = Path("tools/game-atlas-thais-fixture/export.py")
DEFAULT_BENCHMARK_WORKERS = (1, 2, 4, 8, 12, 14)
DEFAULT_SAMPLE_PER_FLOOR = 1536
DEFAULT_BATCH_SIZE = 384
DEFAULT_REGION_SPAN = 256

_GAME_EXPORT: Any = None
_APPEARANCES: dict[int, Any] | None = None
_SHEETS: list[Any] | None = None
_SHEET_FOR_SPRITE: Any = None


class FabricError(RuntimeError):
    pass


def canonical_json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def atomic_write_json(path: Path, value: Any) -> None:
    atomic_write_bytes(path, canonical_json_bytes(value))


def git_head(root: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(root), "rev-parse", "HEAD"], text=True, stderr=subprocess.STDOUT
        ).strip()
    except subprocess.CalledProcessError as exc:
        raise FabricError(f"unable to resolve git head for {root}: {exc.output.strip()}") from exc


def safe_int(value: int) -> str:
    prefix = "p" if value >= 0 else "m"
    return f"{prefix}{abs(value):06d}"


def shard_identity(floor: int, rx: int, ry: int) -> str:
    return f"f{safe_int(floor)}_rx{safe_int(rx)}_ry{safe_int(ry)}"


def parse_shard_identity(value: str) -> tuple[int, int, int]:
    pattern = r"^f([pm])(\d{6})_rx([pm])(\d{6})_ry([pm])(\d{6})$"
    match = re.fullmatch(pattern, value)
    if match is None:
        raise FabricError(f"invalid shard identity {value!r}")
    values: list[int] = []
    for sign, digits in ((match[1], match[2]), (match[3], match[4]), (match[5], match[6])):
        number = int(digits)
        values.append(number if sign == "p" else -number)
    return values[0], values[1], values[2]


def _load_game_export(game_root: Path) -> Any:
    path = game_root / GAME_EXPORT_REL
    if not path.is_file():
        raise FabricError(f"missing Game producer implementation: {path}")
    name = "oteryn_fullworld_pinned_game_export"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise FabricError(f"unable to load Game producer implementation: {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def prepare_runtime(game_root: Path, legacy_root: Path, map_path: Path, asset_zip: Path, assets_dir: Path) -> Any:
    global _GAME_EXPORT, _APPEARANCES, _SHEETS, _SHEET_FOR_SPRITE
    if _GAME_EXPORT is not None:
        return _GAME_EXPORT
    module = _load_game_export(game_root)
    appearance_path = module._validate_inputs(map_path, asset_zip, assets_dir)
    legacy_assets, _legacy_semantic = module._load_legacy_modules(legacy_root)
    _APPEARANCES = legacy_assets.load_object_appearances(appearance_path)
    _SHEETS = legacy_assets.load_sprite_catalog(assets_dir)
    _SHEET_FOR_SPRITE = legacy_assets.sheet_for_sprite
    _GAME_EXPORT = module
    return module


def transform_tile(tile: Any) -> tuple[bytes, dict[str, Any]]:
    if _GAME_EXPORT is None or _APPEARANCES is None or _SHEETS is None or _SHEET_FOR_SPRITE is None:
        raise FabricError("worker runtime is not initialized")
    record, stats = _GAME_EXPORT._tile_record(
        tile,
        appearances=_APPEARANCES,
        sheets=_SHEETS,
        sheet_for_sprite=_SHEET_FOR_SPRITE,
    )
    line = _GAME_EXPORT._canonical_json_bytes(record)
    if len(line) > int(_GAME_EXPORT.MAX_TILE_LINE_BYTES):
        pos = tile.position
        raise FabricError(f"canonical tile line exceeds Game proof cap at {pos.x},{pos.y},{pos.z}")
    return line, stats


def visible_items(tile: Any) -> Iterator[Any]:
    if tile.ground is not None:
        yield tile.ground
    yield from tile.items


def walk_item_count(item: Any) -> int:
    return 1 + sum(walk_item_count(child) for child in item.children)


def floor_template() -> dict[str, Any]:
    return {
        "tile_count": 0,
        "x_min": None,
        "x_max_inclusive": None,
        "y_min": None,
        "y_max_inclusive": None,
        "ground_items": 0,
        "top_level_tile_items": 0,
        "source_item_tree_without_ground": 0,
        "visible_appearance_source_ids": set(),
    }


def update_structural_floor(state: dict[str, Any], tile: Any) -> None:
    x, y = tile.position.x, tile.position.y
    state["tile_count"] += 1
    state["x_min"] = x if state["x_min"] is None else min(state["x_min"], x)
    state["x_max_inclusive"] = x if state["x_max_inclusive"] is None else max(state["x_max_inclusive"], x)
    state["y_min"] = y if state["y_min"] is None else min(state["y_min"], y)
    state["y_max_inclusive"] = y if state["y_max_inclusive"] is None else max(state["y_max_inclusive"], y)
    if tile.ground is not None:
        state["ground_items"] += 1
        state["visible_appearance_source_ids"].add(tile.ground.server_id)
    state["top_level_tile_items"] += len(tile.items)
    for item in tile.items:
        state["visible_appearance_source_ids"].add(item.server_id)
        state["source_item_tree_without_ground"] += walk_item_count(item)


def stable_sample_key(tile: Any) -> int:
    pos = tile.position
    payload = f"{pos.z}:{pos.x}:{pos.y}".encode("ascii")
    return int.from_bytes(hashlib.blake2b(payload, digest_size=8, person=b"ATLASFW0").digest(), "big")


def _serialize_structural_floor(state: dict[str, Any]) -> dict[str, Any]:
    result = dict(state)
    result["visible_appearance_source_ids"] = sorted(state["visible_appearance_source_ids"])
    return result


def _fingerprint_core(
    *,
    game_sha: str,
    legacy_sha: str,
    map_sha: str,
    asset_zip_sha: str,
    catalog_sha: str,
    appearance_sha: str,
    fabric_code_sha: str,
    region_span: int,
) -> dict[str, Any]:
    return {
        "format": FABRIC_FORMAT,
        "game_sha": game_sha,
        "legacy_sha": legacy_sha,
        "world_otbm_sha256": map_sha,
        "asset_zip_sha256": asset_zip_sha,
        "catalog_sha256": catalog_sha,
        "appearance_sha256": appearance_sha,
        "fabric_code_sha256": fabric_code_sha,
        "region_span": region_span,
    }


def source_fingerprint(core: dict[str, Any]) -> str:
    digest = hashlib.sha256()
    digest.update(b"OTERYN-ATLAS-FULLWORLD-SOURCE-FINGERPRINT-V0\0")
    digest.update(canonical_json_bytes(core))
    return f"sha256:{digest.hexdigest()}"


def build_private_cache(
    *,
    game_export: Any,
    legacy_root: Path,
    map_path: Path,
    cache_root: Path,
    source_fp: str,
    sample_per_floor: int,
) -> tuple[dict[str, Any], bool]:
    cache_path = cache_root / "tiles.private.pkl"
    sample_path = cache_root / "benchmark-sample.private.pkl"
    manifest_path = cache_root / "cache-manifest.json"
    if manifest_path.is_file() and cache_path.is_file() and sample_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if (
                manifest.get("format") == CACHE_FORMAT
                and manifest.get("source_fingerprint") == source_fp
                and manifest.get("cache_sha256") == sha256_file(cache_path)
                and manifest.get("sample_sha256") == sha256_file(sample_path)
            ):
                return manifest, True
        except (OSError, json.JSONDecodeError):
            pass

    cache_root.mkdir(parents=True, exist_ok=True)
    for candidate in (cache_path, sample_path, manifest_path):
        candidate.unlink(missing_ok=True)

    _legacy_assets, legacy_semantic = game_export._load_legacy_modules(legacy_root)
    floor_states: dict[int, dict[str, Any]] = defaultdict(floor_template)
    sample_heaps: dict[int, list[tuple[int, int, int, Any]]] = defaultdict(list)
    map_header: dict[str, Any] | None = None
    towns_seen = 0
    waypoints_seen = 0
    tile_count = 0

    started = time.monotonic()
    with cache_path.open("wb") as handle:
        handle.write(CACHE_MAGIC)
        for record in legacy_semantic.iter_map_records(map_path, strict=True):
            if isinstance(record, legacy_semantic.MapHeader):
                map_header = {name: getattr(record, name) for name in record.__dataclass_fields__}
                continue
            if isinstance(record, legacy_semantic.Town):
                towns_seen += 1
                continue
            if isinstance(record, legacy_semantic.Waypoint):
                waypoints_seen += 1
                continue
            if not isinstance(record, legacy_semantic.Tile):
                continue
            pickle.dump(record, handle, protocol=5)
            tile_count += 1
            floor = -record.position.z
            update_structural_floor(floor_states[floor], record)
            key = stable_sample_key(record)
            heap = sample_heaps[floor]
            entry = (-key, record.position.x, record.position.y, record)
            if len(heap) < sample_per_floor:
                heapq.heappush(heap, entry)
            elif entry > heap[0]:
                heapq.heapreplace(heap, entry)

    sample: list[Any] = []
    sample_by_floor: dict[str, int] = {}
    for floor in sorted(sample_heaps):
        selected = [entry[3] for entry in sample_heaps[floor]]
        selected.sort(key=lambda tile: (tile.position.y, tile.position.x))
        sample.extend(selected)
        sample_by_floor[str(floor)] = len(selected)
    with sample_path.open("wb") as handle:
        pickle.dump(sample, handle, protocol=5)

    cache_sha = sha256_file(cache_path)
    sample_sha = sha256_file(sample_path)
    elapsed = time.monotonic() - started
    structural_floors = {
        str(floor): _serialize_structural_floor(floor_states[floor]) for floor in sorted(floor_states)
    }
    manifest = {
        "format": CACHE_FORMAT,
        "source_fingerprint": source_fp,
        "private_non_authoritative_intermediate": True,
        "browser_runtime_eligible": False,
        "tile_count": tile_count,
        "map_header": map_header,
        "town_records_seen_not_exported": towns_seen,
        "waypoint_records_seen_not_exported": waypoints_seen,
        "floors": structural_floors,
        "sample_per_floor_cap": sample_per_floor,
        "sample_tiles": len(sample),
        "sample_by_floor": sample_by_floor,
        "cache_file": cache_path.name,
        "cache_bytes": cache_path.stat().st_size,
        "cache_sha256": cache_sha,
        "sample_file": sample_path.name,
        "sample_bytes": sample_path.stat().st_size,
        "sample_sha256": sample_sha,
        "scan_elapsed_seconds": elapsed,
    }
    atomic_write_json(manifest_path, manifest)
    return manifest, False


def load_private_tiles(cache_path: Path) -> Iterator[Any]:
    with cache_path.open("rb") as handle:
        magic = handle.read(len(CACHE_MAGIC))
        if magic != CACHE_MAGIC:
            raise FabricError(f"private tile cache magic mismatch: {cache_path}")
        while True:
            try:
                yield pickle.load(handle)
            except EOFError:
                return


def load_sample(sample_path: Path) -> list[Any]:
    with sample_path.open("rb") as handle:
        value = pickle.load(handle)
    if not isinstance(value, list):
        raise FabricError("benchmark sample is not a list")
    return value


def batched(values: Iterable[Any], size: int) -> Iterator[list[Any]]:
    batch: list[Any] = []
    for value in values:
        batch.append(value)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def _benchmark_batch(batch: list[Any]) -> dict[str, Any]:
    digest = hashlib.sha256()
    presentations = 0
    primitives = 0
    byte_count = 0
    for tile in batch:
        line, stats = transform_tile(tile)
        digest.update(line)
        presentations += int(stats["presentation_count"])
        primitives += int(stats["primitive_count"])
        byte_count += len(line)
    return {
        "tiles": len(batch),
        "presentations": presentations,
        "primitives": primitives,
        "bytes": byte_count,
        "digest": digest.hexdigest(),
    }


def benchmark_workers(sample: list[Any], worker_values: list[int], batch_size: int) -> dict[str, Any]:
    if not sample:
        raise FabricError("benchmark sample is empty")
    batches = list(batched(sample, batch_size))
    results: list[dict[str, Any]] = []
    reference_signature: tuple[int, int, int, int, str] | None = None
    context = multiprocessing.get_context("fork")

    for workers in worker_values:
        before = resource.getrusage(resource.RUSAGE_CHILDREN)
        started = time.monotonic()
        with concurrent.futures.ProcessPoolExecutor(max_workers=workers, mp_context=context) as pool:
            parts = list(pool.map(_benchmark_batch, batches, chunksize=1))
        elapsed = time.monotonic() - started
        after = resource.getrusage(resource.RUSAGE_CHILDREN)
        aggregate = hashlib.sha256()
        for part in parts:
            aggregate.update(bytes.fromhex(part["digest"]))
        signature = (
            sum(part["tiles"] for part in parts),
            sum(part["presentations"] for part in parts),
            sum(part["primitives"] for part in parts),
            sum(part["bytes"] for part in parts),
            aggregate.hexdigest(),
        )
        if reference_signature is None:
            reference_signature = signature
        if signature != reference_signature:
            raise FabricError(f"worker benchmark semantic divergence at workers={workers}")
        child_cpu = (after.ru_utime + after.ru_stime) - (before.ru_utime + before.ru_stime)
        results.append(
            {
                "workers": workers,
                "elapsed_seconds": elapsed,
                "tiles": signature[0],
                "presentations": signature[1],
                "primitives": signature[2],
                "canonical_bytes": signature[3],
                "aggregate_batch_digest": signature[4],
                "tiles_per_second": signature[0] / elapsed if elapsed else None,
                "child_cpu_seconds": child_cpu,
                "cpu_equivalent_cores": child_cpu / elapsed if elapsed else None,
                "stable": True,
            }
        )

    fastest = max(results, key=lambda row: float(row["tiles_per_second"] or 0.0))
    threshold = float(fastest["tiles_per_second"]) * 0.97
    near_fastest = [row for row in results if float(row["tiles_per_second"]) >= threshold]
    selected = min(near_fastest, key=lambda row: int(row["workers"]))
    return {
        "sample_tiles": len(sample),
        "batch_size": batch_size,
        "selection_rule": "smallest stable worker count within 3% of maximum observed tile throughput",
        "runs": results,
        "fastest_observed_workers": fastest["workers"],
        "selected_workers": selected["workers"],
        "selected_tiles_per_second": selected["tiles_per_second"],
    }


def _batch_dir(spool_root: Path, batch_index: int) -> Path:
    return spool_root / "batches" / f"batch-{batch_index:06d}"


def _batch_manifest_valid(
    *,
    spool_root: Path,
    batch_index: int,
    source_fp: str,
    fabric_code_sha: str,
    region_span: int,
    verify_hashes: bool,
) -> dict[str, Any] | None:
    root = _batch_dir(spool_root, batch_index)
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if (
        manifest.get("format") != BATCH_FORMAT
        or manifest.get("batch_index") != batch_index
        or manifest.get("source_fingerprint") != source_fp
        or manifest.get("fabric_code_sha256") != fabric_code_sha
        or manifest.get("region_span") != region_span
    ):
        return None
    outputs = manifest.get("outputs")
    if not isinstance(outputs, list):
        return None
    for output in outputs:
        path = root / output.get("file", "")
        if not path.is_file() or path.stat().st_size != output.get("bytes"):
            return None
        if verify_hashes and sha256_file(path) != output.get("sha256"):
            return None
    return manifest


def _spool_batch(payload: tuple[int, list[Any], str, str, str, int]) -> int:
    batch_index, batch, spool_root_raw, source_fp, fabric_code_sha, region_span = payload
    spool_root = Path(spool_root_raw)
    root = _batch_dir(spool_root, batch_index)
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)

    grouped: dict[str, bytearray] = defaultdict(bytearray)
    grouped_counts: dict[str, int] = defaultdict(int)
    floor_stats: dict[int, dict[str, Any]] = defaultdict(
        lambda: {
            "tiles": 0,
            "presentation_records": 0,
            "resolved_primitives": 0,
            "canonical_jsonl_bytes": 0,
            "appearance_source_ids": set(),
            "sprite_source_ids": set(),
        }
    )

    for tile in batch:
        line, stats = transform_tile(tile)
        floor = -tile.position.z
        rx = tile.position.x // region_span
        ry = tile.position.y // region_span
        shard_id = shard_identity(floor, rx, ry)
        grouped[shard_id].extend(SHARD_RECORD.pack(tile.position.x, tile.position.y, len(line)))
        grouped[shard_id].extend(line)
        grouped_counts[shard_id] += 1

        fs = floor_stats[floor]
        fs["tiles"] += 1
        fs["presentation_records"] += int(stats["presentation_count"])
        fs["resolved_primitives"] += int(stats["primitive_count"])
        fs["canonical_jsonl_bytes"] += len(line)
        fs["appearance_source_ids"].update(stats["appearance_ids"])
        fs["sprite_source_ids"].update(stats["sprite_ids"])

    outputs: list[dict[str, Any]] = []
    for shard_id in sorted(grouped):
        data = bytes(grouped[shard_id])
        file_name = f"{shard_id}.spool"
        path = root / file_name
        atomic_write_bytes(path, data)
        outputs.append(
            {
                "shard_id": shard_id,
                "file": file_name,
                "bytes": len(data),
                "sha256": sha256_bytes(data),
                "tile_count": grouped_counts[shard_id],
            }
        )
    serialized_floor_stats: dict[str, Any] = {}
    for floor in sorted(floor_stats):
        fs = floor_stats[floor]
        serialized_floor_stats[str(floor)] = {
            "tiles": fs["tiles"],
            "presentation_records": fs["presentation_records"],
            "resolved_primitives": fs["resolved_primitives"],
            "canonical_jsonl_bytes": fs["canonical_jsonl_bytes"],
            "appearance_source_ids": sorted(fs["appearance_source_ids"]),
            "sprite_source_ids": sorted(fs["sprite_source_ids"]),
        }
    manifest = {
        "format": BATCH_FORMAT,
        "batch_index": batch_index,
        "source_fingerprint": source_fp,
        "fabric_code_sha256": fabric_code_sha,
        "region_span": region_span,
        "tile_count": len(batch),
        "floors": serialized_floor_stats,
        "outputs": outputs,
    }
    atomic_write_json(root / "manifest.json", manifest)
    return batch_index


def generate_batches(
    *,
    cache_path: Path,
    spool_root: Path,
    total_tiles: int,
    source_fp: str,
    fabric_code_sha: str,
    region_span: int,
    batch_size: int,
    workers: int,
) -> dict[str, Any]:
    total_batches = math.ceil(total_tiles / batch_size)
    reused = 0
    generated = 0
    context = multiprocessing.get_context("fork")

    def tasks() -> Iterator[tuple[int, list[Any], str, str, str, int]]:
        nonlocal reused
        for index, batch in enumerate(batched(load_private_tiles(cache_path), batch_size)):
            existing = _batch_manifest_valid(
                spool_root=spool_root,
                batch_index=index,
                source_fp=source_fp,
                fabric_code_sha=fabric_code_sha,
                region_span=region_span,
                verify_hashes=True,
            )
            if existing is not None:
                reused += 1
                continue
            yield (index, batch, str(spool_root), source_fp, fabric_code_sha, region_span)

    started = time.monotonic()
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers, mp_context=context) as pool:
        for _index in pool.map(_spool_batch, tasks(), chunksize=1):
            generated += 1
    elapsed = time.monotonic() - started

    manifests: list[dict[str, Any]] = []
    for index in range(total_batches):
        manifest = _batch_manifest_valid(
            spool_root=spool_root,
            batch_index=index,
            source_fp=source_fp,
            fabric_code_sha=fabric_code_sha,
            region_span=region_span,
            verify_hashes=True,
        )
        if manifest is None:
            raise FabricError(f"missing or invalid deterministic batch {index}/{total_batches}")
        manifests.append(manifest)
    if sum(int(manifest["tile_count"]) for manifest in manifests) != total_tiles:
        raise FabricError("batch tile total does not reconcile with structural census")
    return {
        "total_batches": total_batches,
        "generated_batches": generated,
        "reused_batches": reused,
        "elapsed_seconds": elapsed,
        "manifests": manifests,
    }


def semantic_census_from_batches(
    structural: dict[str, Any],
    batch_manifests: list[dict[str, Any]],
) -> dict[str, Any]:
    floor_states: dict[int, dict[str, Any]] = defaultdict(
        lambda: {
            "presentation_records": 0,
            "resolved_primitives": 0,
            "canonical_jsonl_bytes": 0,
            "appearance_source_ids": set(),
            "sprite_source_ids": set(),
        }
    )
    for manifest in batch_manifests:
        for floor_raw, stats in manifest["floors"].items():
            floor = int(floor_raw)
            fs = floor_states[floor]
            fs["presentation_records"] += int(stats["presentation_records"])
            fs["resolved_primitives"] += int(stats["resolved_primitives"])
            fs["canonical_jsonl_bytes"] += int(stats["canonical_jsonl_bytes"])
            fs["appearance_source_ids"].update(stats["appearance_source_ids"])
            fs["sprite_source_ids"].update(stats["sprite_source_ids"])

    floors: dict[str, Any] = {}
    global_appearances: set[int] = set()
    global_sprites: set[int] = set()
    total_presentations = 0
    total_primitives = 0
    total_jsonl_bytes = 0
    for floor_raw, structural_stats in structural["floors"].items():
        floor = int(floor_raw)
        semantic = floor_states[floor]
        if int(structural_stats["tile_count"]) != sum(
            int(manifest["floors"].get(floor_raw, {}).get("tiles", 0)) for manifest in batch_manifests
        ):
            raise FabricError(f"semantic census tile count mismatch for floor {floor}")
        appearances = semantic["appearance_source_ids"]
        sprites = semantic["sprite_source_ids"]
        global_appearances.update(appearances)
        global_sprites.update(sprites)
        total_presentations += semantic["presentation_records"]
        total_primitives += semantic["resolved_primitives"]
        total_jsonl_bytes += semantic["canonical_jsonl_bytes"]
        floors[floor_raw] = {
            "legacy_z": -floor,
            "bounds": {
                "x_min": structural_stats["x_min"],
                "x_max_exclusive": structural_stats["x_max_inclusive"] + 1,
                "y_min": structural_stats["y_min"],
                "y_max_exclusive": structural_stats["y_max_inclusive"] + 1,
            },
            "tiles": structural_stats["tile_count"],
            "ground_items": structural_stats["ground_items"],
            "top_level_tile_items": structural_stats["top_level_tile_items"],
            "source_item_tree_without_ground": structural_stats["source_item_tree_without_ground"],
            "presentation_records": semantic["presentation_records"],
            "resolved_primitives": semantic["resolved_primitives"],
            "unique_appearance_source_ids": len(appearances),
            "unique_sprite_source_ids": len(sprites),
            "canonical_jsonl_bytes": semantic["canonical_jsonl_bytes"],
        }
    return {
        "floors": floors,
        "global": {
            "floors": len(floors),
            "tiles": sum(int(item["tiles"]) for item in floors.values()),
            "presentation_records": total_presentations,
            "resolved_primitives": total_primitives,
            "unique_appearance_source_ids": len(global_appearances),
            "unique_sprite_source_ids": len(global_sprites),
            "canonical_jsonl_bytes": total_jsonl_bytes,
        },
    }


def read_spool_records(path: Path) -> Iterator[tuple[int, int, bytes]]:
    with path.open("rb") as handle:
        while True:
            header = handle.read(SHARD_RECORD.size)
            if not header:
                return
            if len(header) != SHARD_RECORD.size:
                raise FabricError(f"truncated spool record header in {path}")
            x, y, length = SHARD_RECORD.unpack(header)
            if length <= 0 or length > 1_048_576:
                raise FabricError(f"invalid spool record length {length} in {path}")
            line = handle.read(length)
            if len(line) != length:
                raise FabricError(f"truncated spool record body in {path}")
            yield x, y, line


def _shard_manifest_valid(
    root: Path,
    *,
    source_fp: str,
    fabric_code_sha: str,
    region_span: int,
    verify_hash: bool,
) -> dict[str, Any] | None:
    manifest_path = root / "manifest.json"
    tiles_path = root / "tiles.jsonl"
    if not manifest_path.is_file() or not tiles_path.is_file():
        return None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if (
        manifest.get("format") != SHARD_FORMAT
        or manifest.get("source_fingerprint") != source_fp
        or manifest.get("fabric_code_sha256") != fabric_code_sha
        or manifest.get("region_span") != region_span
        or manifest.get("tiles_jsonl_bytes") != tiles_path.stat().st_size
    ):
        return None
    if verify_hash and manifest.get("tiles_jsonl_sha256") != sha256_file(tiles_path):
        return None
    return manifest


def _finalize_shard(payload: tuple[str, list[str], str, str, str, int]) -> dict[str, Any]:
    shard_id, sources_raw, output_root_raw, source_fp, fabric_code_sha, region_span = payload
    output_root = Path(output_root_raw)
    root = output_root / "shards" / shard_id
    valid = _shard_manifest_valid(
        root,
        source_fp=source_fp,
        fabric_code_sha=fabric_code_sha,
        region_span=region_span,
        verify_hash=True,
    )
    if valid is not None:
        return {"shard_id": shard_id, "reused": True, "manifest": valid}

    floor, rx, ry = parse_shard_identity(shard_id)
    rows: list[tuple[int, int, bytes]] = []
    for source_raw in sources_raw:
        rows.extend(read_spool_records(Path(source_raw)))
    rows.sort(key=lambda row: (row[1], row[0]))
    seen: set[tuple[int, int]] = set()
    output = bytearray()
    for x, y, line in rows:
        if (x, y) in seen:
            raise FabricError(f"duplicate tile position in shard {shard_id}: {x},{y}")
        seen.add((x, y))
        if x // region_span != rx or y // region_span != ry:
            raise FabricError(f"tile {x},{y} routed outside shard {shard_id}")
        try:
            record = json.loads(line)
        except json.JSONDecodeError as exc:
            raise FabricError(f"invalid canonical tile JSON in shard {shard_id}: {exc}") from exc
        if canonical_json_bytes(record) != line:
            raise FabricError(f"non-canonical JSON line in shard {shard_id}")
        if record.get("position") != {"floor": floor, "x": x, "y": y}:
            raise FabricError(f"semantic position mismatch in shard {shard_id} at {x},{y}")
        output.extend(line)
    tiles_bytes = bytes(output)
    tiles_sha = sha256_bytes(tiles_bytes)
    manifest_core = {
        "format": SHARD_FORMAT,
        "source_fingerprint": source_fp,
        "fabric_code_sha256": fabric_code_sha,
        "region_span": region_span,
        "logical_address": {"floor": floor, "region_x": rx, "region_y": ry},
        "tile_count": len(rows),
        "tiles_jsonl_bytes": len(tiles_bytes),
        "tiles_jsonl_sha256": tiles_sha,
    }
    root_hash = hashlib.sha256()
    root_hash.update(b"OTERYN-ATLAS-FULLWORLD-GENERATION-SHARD-V0\0")
    root_hash.update(canonical_json_bytes(manifest_core))
    root_hash.update(tiles_bytes)
    manifest = dict(manifest_core)
    manifest["shard_root"] = f"sha256:{root_hash.hexdigest()}"
    root.mkdir(parents=True, exist_ok=True)
    atomic_write_bytes(root / "tiles.jsonl", tiles_bytes)
    atomic_write_json(root / "manifest.json", manifest)
    return {"shard_id": shard_id, "reused": False, "manifest": manifest}


def collect_shard_sources(spool_root: Path, batch_manifests: list[dict[str, Any]]) -> dict[str, list[str]]:
    sources: dict[str, list[str]] = defaultdict(list)
    for manifest in batch_manifests:
        batch_root = _batch_dir(spool_root, int(manifest["batch_index"]))
        for output in manifest["outputs"]:
            sources[output["shard_id"]].append(str(batch_root / output["file"]))
    for shard_id in sources:
        sources[shard_id].sort()
    return dict(sources)


def finalize_shards(
    *,
    spool_root: Path,
    output_root: Path,
    batch_manifests: list[dict[str, Any]],
    source_fp: str,
    fabric_code_sha: str,
    region_span: int,
    workers: int,
) -> dict[str, Any]:
    shard_sources = collect_shard_sources(spool_root, batch_manifests)
    tasks = [
        (shard_id, paths, str(output_root), source_fp, fabric_code_sha, region_span)
        for shard_id, paths in sorted(shard_sources.items())
    ]
    started = time.monotonic()
    context = multiprocessing.get_context("fork")
    results: list[dict[str, Any]] = []
    with concurrent.futures.ProcessPoolExecutor(max_workers=workers, mp_context=context) as pool:
        for result in pool.map(_finalize_shard, tasks, chunksize=1):
            results.append(result)
    elapsed = time.monotonic() - started
    return {
        "shards": results,
        "generated_shards": sum(1 for result in results if not result["reused"]),
        "reused_shards": sum(1 for result in results if result["reused"]),
        "elapsed_seconds": elapsed,
    }


def verify_deterministic_shard(
    *,
    shard_id: str,
    source_paths: list[str],
    output_root: Path,
    source_fp: str,
    fabric_code_sha: str,
    region_span: int,
) -> dict[str, Any]:
    canonical_root = output_root / "shards" / shard_id
    canonical = _shard_manifest_valid(
        canonical_root,
        source_fp=source_fp,
        fabric_code_sha=fabric_code_sha,
        region_span=region_span,
        verify_hash=True,
    )
    if canonical is None:
        raise FabricError(f"cannot determinism-check invalid canonical shard {shard_id}")
    proof_root = output_root / ".determinism-proof"
    if proof_root.exists():
        shutil.rmtree(proof_root)
    result = _finalize_shard(
        (shard_id, source_paths, str(proof_root), source_fp, fabric_code_sha, region_span)
    )
    rebuilt = result["manifest"]
    proof_tiles = proof_root / "shards" / shard_id / "tiles.jsonl"
    canonical_tiles = canonical_root / "tiles.jsonl"
    same = (
        canonical["shard_root"] == rebuilt["shard_root"]
        and canonical["tiles_jsonl_sha256"] == rebuilt["tiles_jsonl_sha256"]
        and canonical_tiles.read_bytes() == proof_tiles.read_bytes()
    )
    shutil.rmtree(proof_root)
    if not same:
        raise FabricError(f"deterministic rebuild mismatch for shard {shard_id}")
    return {
        "shard_id": shard_id,
        "result": "PASS",
        "shard_root": canonical["shard_root"],
        "tiles_jsonl_sha256": canonical["tiles_jsonl_sha256"],
    }


def _cpu_snapshot() -> tuple[int, int]:
    fields = Path("/proc/stat").read_text(encoding="ascii").splitlines()[0].split()[1:]
    values = [int(value) for value in fields]
    total = sum(values)
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    return total, idle


def _mem_snapshot() -> dict[str, int]:
    values: dict[str, int] = {}
    for line in Path("/proc/meminfo").read_text(encoding="ascii").splitlines():
        key, raw = line.split(":", 1)
        if key in {"MemTotal", "MemAvailable", "SwapTotal", "SwapFree"}:
            values[key] = int(raw.strip().split()[0]) * 1024
    return values


def _root_disk_device() -> str | None:
    try:
        source = subprocess.check_output(["findmnt", "-n", "-o", "SOURCE", "/"], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        return None
    if not source.startswith("/dev/"):
        return None
    return Path(source).name


def _disk_snapshot(device: str | None) -> dict[str, int] | None:
    if device is None:
        return None
    for line in Path("/proc/diskstats").read_text(encoding="ascii").splitlines():
        parts = line.split()
        if len(parts) >= 14 and parts[2] == device:
            return {
                "read_sectors": int(parts[5]),
                "write_sectors": int(parts[9]),
                "reads": int(parts[3]),
                "writes": int(parts[7]),
            }
    return None


def _process_tree_pids(root_pid: int) -> set[int]:
    result = {root_pid}
    frontier = [root_pid]
    while frontier:
        pid = frontier.pop()
        children_path = Path(f"/proc/{pid}/task/{pid}/children")
        try:
            children = [int(value) for value in children_path.read_text(encoding="ascii").split()]
        except (OSError, ValueError):
            continue
        for child in children:
            if child not in result:
                result.add(child)
                frontier.append(child)
    return result


def _tree_rss_bytes(root_pid: int) -> int:
    total = 0
    for pid in _process_tree_pids(root_pid):
        try:
            for line in Path(f"/proc/{pid}/status").read_text(encoding="ascii").splitlines():
                if line.startswith("VmRSS:"):
                    total += int(line.split()[1]) * 1024
                    break
        except OSError:
            continue
    return total


@dataclass
class MonitorResult:
    peak_tree_rss_bytes: int = 0
    minimum_mem_available_bytes: int | None = None
    maximum_swap_used_bytes: int = 0


class SystemMonitor:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.result = MonitorResult()

    def start(self) -> None:
        def loop() -> None:
            while not self._stop.wait(0.25):
                mem = _mem_snapshot()
                available = mem.get("MemAvailable")
                swap_used = mem.get("SwapTotal", 0) - mem.get("SwapFree", 0)
                rss = _tree_rss_bytes(os.getpid())
                self.result.peak_tree_rss_bytes = max(self.result.peak_tree_rss_bytes, rss)
                self.result.maximum_swap_used_bytes = max(self.result.maximum_swap_used_bytes, swap_used)
                if available is not None:
                    current = self.result.minimum_mem_available_bytes
                    self.result.minimum_mem_available_bytes = available if current is None else min(current, available)
        self._thread = threading.Thread(target=loop, name="atlas-fullworld-monitor", daemon=True)
        self._thread.start()

    def stop(self) -> MonitorResult:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=2)
        return self.result


def disk_free_bytes(path: Path) -> int:
    usage = shutil.disk_usage(path)
    return usage.free


def build_handoff(
    *,
    output_root: Path,
    source_core: dict[str, Any],
    source_fp: str,
    structural: dict[str, Any],
    semantic_census: dict[str, Any],
    benchmark: dict[str, Any],
    batch_result: dict[str, Any],
    shard_result: dict[str, Any],
    determinism: dict[str, Any],
    timing: dict[str, float],
    resource_evidence: dict[str, Any],
    private_cache: dict[str, Any],
) -> dict[str, Any]:
    shard_descriptors: list[dict[str, Any]] = []
    final_bytes = 0
    final_tiles = 0
    for result in sorted(shard_result["shards"], key=lambda item: item["shard_id"]):
        manifest = result["manifest"]
        descriptor = {
            "shard_id": result["shard_id"],
            "logical_address": manifest["logical_address"],
            "shard_root": manifest["shard_root"],
            "tile_count": manifest["tile_count"],
            "tiles_jsonl_bytes": manifest["tiles_jsonl_bytes"],
            "tiles_jsonl_sha256": manifest["tiles_jsonl_sha256"],
            "relative_path": f"shards/{result['shard_id']}",
        }
        final_bytes += int(manifest["tiles_jsonl_bytes"])
        final_tiles += int(manifest["tile_count"])
        shard_descriptors.append(descriptor)
    if final_tiles != int(semantic_census["global"]["tiles"]):
        raise FabricError("final shard tile count does not reconcile with semantic census")
    root_hash = hashlib.sha256()
    root_hash.update(b"OTERYN-ATLAS-FULLWORLD-GENERATION-HANDOFF-V0\0")
    root_hash.update(canonical_json_bytes(shard_descriptors))
    fabric_root = f"sha256:{root_hash.hexdigest()}"

    spool_bytes = 0
    for manifest in batch_result["manifests"]:
        spool_bytes += sum(int(item["bytes"]) for item in manifest["outputs"])
    return {
        "format": HANDOFF_FORMAT,
        "classification": "verified local generation handoff; not final Atlas publication format",
        "source_authority": "Oteryn/Oteryn-Game",
        "consumer_target": "Oteryn/Oteryn-Atlas",
        "browser_runtime_legacy_fallback": False,
        "source_fingerprint": source_fp,
        "source": source_core,
        "canonical_world_id": None,
        "canonical_world_id_state": "UNKNOWN",
        "census": semantic_census,
        "benchmark": benchmark,
        "generation": {
            "batch_size": benchmark["generation_batch_size"],
            "region_span": source_core["region_span"],
            "selected_transform_workers": benchmark["selected_workers"],
            "finalization_workers": benchmark["finalization_workers"],
            "total_batches": batch_result["total_batches"],
            "generated_batches": batch_result["generated_batches"],
            "reused_batches": batch_result["reused_batches"],
            "shard_count": len(shard_descriptors),
            "generated_shards": shard_result["generated_shards"],
            "reused_shards": shard_result["reused_shards"],
            "private_cache_reused": private_cache["reused"],
            "private_cache_bytes": private_cache["manifest"]["cache_bytes"],
            "intermediate_spool_bytes": spool_bytes,
            "final_jsonl_bytes": final_bytes,
        },
        "resumability": {
            "private_source_cache": "digest-verified and reusable only for identical source fingerprint",
            "semantic_batches": "individually manifest+digest verified and reusable",
            "final_shards": "individually manifest+digest verified and reusable",
        },
        "determinism_proof": determinism,
        "timing_seconds": timing,
        "resource_evidence": resource_evidence,
        "fabric_root": fabric_root,
        "shards": shard_descriptors,
    }


def validate_worker_values(values: list[int], logical_cpus: int) -> list[int]:
    normalized = sorted(set(value for value in values if 1 <= value <= logical_cpus))
    if not normalized:
        raise FabricError("no valid benchmark worker counts")
    return normalized


def run(args: argparse.Namespace) -> int:
    started_all = time.monotonic()
    game_root = args.game_root.resolve()
    legacy_root = args.legacy_root.resolve()
    map_path = args.map_path.resolve()
    asset_zip = args.asset_zip.resolve()
    assets_dir = args.assets_dir.resolve()
    work_root = args.workdir.resolve()
    output_root = args.output.resolve()
    work_root.mkdir(parents=True, exist_ok=True)
    output_root.mkdir(parents=True, exist_ok=True)

    actual_game_sha = git_head(game_root)
    actual_legacy_sha = git_head(legacy_root)
    if actual_game_sha != args.game_sha:
        raise FabricError(f"Game head mismatch: {actual_game_sha} != {args.game_sha}")
    if actual_legacy_sha != args.legacy_sha:
        raise FabricError(f"legacy importer head mismatch: {actual_legacy_sha} != {args.legacy_sha}")

    fabric_code_sha = sha256_file(Path(__file__).resolve())
    game_export = prepare_runtime(game_root, legacy_root, map_path, asset_zip, assets_dir)
    appearance_candidates = sorted(assets_dir.glob("appearances-*.dat"))
    if len(appearance_candidates) != 1:
        raise FabricError(f"expected one appearance file, got {len(appearance_candidates)}")
    source_core = _fingerprint_core(
        game_sha=actual_game_sha,
        legacy_sha=actual_legacy_sha,
        map_sha=sha256_file(map_path),
        asset_zip_sha=sha256_file(asset_zip),
        catalog_sha=sha256_file(assets_dir / "catalog-content.json"),
        appearance_sha=sha256_file(appearance_candidates[0]),
        fabric_code_sha=fabric_code_sha,
        region_span=args.region_span,
    )
    source_fp = source_fingerprint(source_core)

    logical_cpus = os.cpu_count() or 1
    mem_start = _mem_snapshot()
    disk_device = _root_disk_device()
    disk_start = _disk_snapshot(disk_device)
    cpu_start = _cpu_snapshot()
    free_start = disk_free_bytes(work_root)
    monitor = SystemMonitor()
    monitor.start()

    timing: dict[str, float] = {}
    cache_started = time.monotonic()
    cache_manifest, cache_reused = build_private_cache(
        game_export=game_export,
        legacy_root=legacy_root,
        map_path=map_path,
        cache_root=work_root / "cache",
        source_fp=source_fp,
        sample_per_floor=args.sample_per_floor,
    )
    timing["structural_census_and_private_cache"] = time.monotonic() - cache_started
    atomic_write_json(work_root / "structural-census.json", cache_manifest)

    sample = load_sample(work_root / "cache" / "benchmark-sample.private.pkl")
    worker_values = validate_worker_values(args.benchmark_workers, logical_cpus)
    benchmark_started = time.monotonic()
    benchmark = benchmark_workers(sample, worker_values, args.batch_size)
    timing["worker_benchmark"] = time.monotonic() - benchmark_started
    selected_workers = int(benchmark["selected_workers"])
    finalization_workers = min(selected_workers, max(1, args.max_finalization_workers))
    benchmark["generation_batch_size"] = args.batch_size
    benchmark["finalization_workers"] = finalization_workers
    benchmark["logical_cpus"] = logical_cpus
    atomic_write_json(work_root / "benchmark.json", benchmark)

    generation_started = time.monotonic()
    batch_result = generate_batches(
        cache_path=work_root / "cache" / "tiles.private.pkl",
        spool_root=work_root / "spool",
        total_tiles=int(cache_manifest["tile_count"]),
        source_fp=source_fp,
        fabric_code_sha=fabric_code_sha,
        region_span=args.region_span,
        batch_size=args.batch_size,
        workers=selected_workers,
    )
    timing["semantic_generation_batches"] = time.monotonic() - generation_started

    semantic_census = semantic_census_from_batches(cache_manifest, batch_result["manifests"])
    atomic_write_json(work_root / "semantic-census.json", semantic_census)

    finalize_started = time.monotonic()
    shard_result = finalize_shards(
        spool_root=work_root / "spool",
        output_root=output_root,
        batch_manifests=batch_result["manifests"],
        source_fp=source_fp,
        fabric_code_sha=fabric_code_sha,
        region_span=args.region_span,
        workers=finalization_workers,
    )
    timing["shard_finalization"] = time.monotonic() - finalize_started

    shard_sources = collect_shard_sources(work_root / "spool", batch_result["manifests"])
    if not shard_sources:
        raise FabricError("no final shards were produced")
    proof_shard = sorted(
        shard_result["shards"],
        key=lambda item: (-int(item["manifest"]["tile_count"]), item["shard_id"]),
    )[0]["shard_id"]
    determinism_started = time.monotonic()
    determinism = verify_deterministic_shard(
        shard_id=proof_shard,
        source_paths=shard_sources[proof_shard],
        output_root=output_root,
        source_fp=source_fp,
        fabric_code_sha=fabric_code_sha,
        region_span=args.region_span,
    )
    timing["determinism_rebuild_proof"] = time.monotonic() - determinism_started

    monitor_result = monitor.stop()
    cpu_end = _cpu_snapshot()
    disk_end = _disk_snapshot(disk_device)
    mem_end = _mem_snapshot()
    total_delta = cpu_end[0] - cpu_start[0]
    idle_delta = cpu_end[1] - cpu_start[1]
    cpu_util = ((total_delta - idle_delta) / total_delta) if total_delta > 0 else None
    disk_delta: dict[str, Any] = {"device": disk_device}
    if disk_start is not None and disk_end is not None:
        disk_delta.update(
            {
                "read_bytes_observed": (disk_end["read_sectors"] - disk_start["read_sectors"]) * 512,
                "write_bytes_observed": (disk_end["write_sectors"] - disk_start["write_sectors"]) * 512,
                "reads_observed": disk_end["reads"] - disk_start["reads"],
                "writes_observed": disk_end["writes"] - disk_start["writes"],
            }
        )
    resource_evidence = {
        "logical_cpus": logical_cpus,
        "mem_total_bytes": mem_start.get("MemTotal"),
        "mem_available_start_bytes": mem_start.get("MemAvailable"),
        "mem_available_end_bytes": mem_end.get("MemAvailable"),
        "minimum_mem_available_bytes": monitor_result.minimum_mem_available_bytes,
        "peak_process_tree_rss_bytes_observed": monitor_result.peak_tree_rss_bytes,
        "maximum_swap_used_bytes_observed": monitor_result.maximum_swap_used_bytes,
        "wsl_cpu_utilization_fraction_over_run": cpu_util,
        "disk_free_start_bytes": free_start,
        "disk_free_end_bytes": disk_free_bytes(work_root),
        "disk_io": disk_delta,
    }
    timing["total"] = time.monotonic() - started_all

    handoff = build_handoff(
        output_root=output_root,
        source_core=source_core,
        source_fp=source_fp,
        structural=cache_manifest,
        semantic_census=semantic_census,
        benchmark=benchmark,
        batch_result=batch_result,
        shard_result=shard_result,
        determinism=determinism,
        timing=timing,
        resource_evidence=resource_evidence,
        private_cache={"manifest": cache_manifest, "reused": cache_reused},
    )
    atomic_write_json(output_root / "handoff.json", handoff)

    print(
        json.dumps(
            {
                "result": "PASS",
                "source_fingerprint": source_fp,
                "fabric_root": handoff["fabric_root"],
                "floors": semantic_census["global"]["floors"],
                "tiles": semantic_census["global"]["tiles"],
                "presentation_records": semantic_census["global"]["presentation_records"],
                "resolved_primitives": semantic_census["global"]["resolved_primitives"],
                "shards": len(handoff["shards"]),
                "selected_workers": selected_workers,
                "generated_batches": batch_result["generated_batches"],
                "reused_batches": batch_result["reused_batches"],
                "generated_shards": shard_result["generated_shards"],
                "reused_shards": shard_result["reused_shards"],
                "output": str(output_root),
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game-root", type=Path, required=True)
    parser.add_argument("--game-sha", required=True)
    parser.add_argument("--legacy-root", type=Path, required=True)
    parser.add_argument("--legacy-sha", required=True)
    parser.add_argument("--map", dest="map_path", type=Path, required=True)
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--assets", dest="assets_dir", type=Path, required=True)
    parser.add_argument("--workdir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--region-span", type=int, default=DEFAULT_REGION_SPAN)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--sample-per-floor", type=int, default=DEFAULT_SAMPLE_PER_FLOOR)
    parser.add_argument(
        "--benchmark-workers",
        type=lambda text: [int(value) for value in text.split(",") if value],
        default=list(DEFAULT_BENCHMARK_WORKERS),
    )
    parser.add_argument("--max-finalization-workers", type=int, default=8)
    args = parser.parse_args(argv)
    if args.region_span < 32 or args.region_span > 4096:
        parser.error("--region-span must be in [32, 4096]")
    if args.batch_size < 32 or args.batch_size > 4096:
        parser.error("--batch-size must be in [32, 4096]")
    if args.sample_per_floor < 64 or args.sample_per_floor > 16384:
        parser.error("--sample-per-floor must be in [64, 16384]")
    if args.max_finalization_workers < 1:
        parser.error("--max-finalization-workers must be positive")
    for label in ("game_sha", "legacy_sha"):
        value = getattr(args, label)
        if re.fullmatch(r"[0-9a-f]{40}", value) is None:
            parser.error(f"--{label.replace('_', '-')} must be a full lowercase SHA")
    return args


def main() -> int:
    try:
        return run(parse_args())
    except (FabricError, OSError, ValueError, pickle.PickleError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
