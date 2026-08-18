#!/usr/bin/env python3
"""Measure proof-local semantic chunk candidates without selecting a permanent format."""

from __future__ import annotations

import argparse
import gzip
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import compiler

POINT = (32360, 32230)
VIEWPORT = (32348, 32372, 32220, 32238)  # inclusive 25 x 19 representative viewport
SPANS = (16, 32, 48)


def source_jsonl_chunks(tiles: list[dict[str, Any]], source: Path, span: int) -> dict[tuple[int, int, int], bytes]:
    lines = (source / "tiles.jsonl").read_bytes().splitlines(keepends=True)
    if len(lines) != len(tiles):
        raise compiler.CompileError("source line/tile count mismatch")
    grouped: dict[tuple[int, int, int], list[bytes]] = defaultdict(list)
    for tile, line in zip(tiles, lines, strict=True):
        position = tile["position"]
        key = (
            position["floor"],
            (position["x"] - compiler.ORIGIN_X) // span,
            (position["y"] - compiler.ORIGIN_Y) // span,
        )
        grouped[key].append(line)
    return {key: b"".join(values) for key, values in grouped.items()}


def compact_chunks(tiles: list[dict[str, Any]], span: int) -> dict[tuple[int, int, int], bytes]:
    compiled, _manifest = compiler.compile_tiles(tiles, span)
    by_key: dict[tuple[int, int, int], bytes] = {}
    for relative_path, data in compiled.items():
        name = Path(relative_path).stem
        floor_text, cx_text, cy_text = name.split("-")
        floor = int(floor_text[1:])
        cx = int(cx_text[1:])
        cy = int(cy_text[1:])
        by_key[(floor, cx, cy)] = data
    return by_key


def candidate_metrics(blobs: dict[tuple[int, int, int], bytes], span: int) -> dict[str, Any]:
    raw = {key: len(data) for key, data in blobs.items()}
    compressed = {key: len(gzip.compress(data, compresslevel=9, mtime=0)) for key, data in blobs.items()}
    sizes = sorted(raw.values())
    point_key = (
        compiler.FLOOR,
        (POINT[0] - compiler.ORIGIN_X) // span,
        (POINT[1] - compiler.ORIGIN_Y) // span,
    )

    x1, x2, y1, y2 = VIEWPORT
    viewport_keys = {
        (compiler.FLOOR, cx, cy)
        for cx in range((x1 - compiler.ORIGIN_X) // span, (x2 - compiler.ORIGIN_X) // span + 1)
        for cy in range((y1 - compiler.ORIGIN_Y) // span, (y2 - compiler.ORIGIN_Y) // span + 1)
        if (compiler.FLOOR, cx, cy) in blobs
    }

    return {
        "chunkCount": len(blobs),
        "gzipBytes": sum(compressed.values()),
        "maxChunkBytes": max(sizes),
        "p95ChunkBytes": sizes[math.ceil(0.95 * len(sizes)) - 1],
        "pointFetch": {
            "gzipBytes": compressed[point_key],
            "rawBytes": raw[point_key],
        },
        "rawBytes": sum(raw.values()),
        "span": span,
        "viewport": {
            "chunkCount": len(viewport_keys),
            "gzipBytes": sum(compressed[key] for key in viewport_keys),
            "rawBytes": sum(raw[key] for key in viewport_keys),
            "xInclusive": [x1, x2],
            "yInclusive": [y1, y2],
        },
    }


def build_report(source: Path) -> dict[str, Any]:
    _source_manifest, tiles = compiler.load_source(source)
    candidates = []
    for span in SPANS:
        candidates.append(
            {
                "encoding": "debug-source-jsonl-grid-v0",
                **candidate_metrics(source_jsonl_chunks(tiles, source, span), span),
            }
        )
        candidates.append(
            {
                "encoding": compiler.PROFILE,
                **candidate_metrics(compact_chunks(tiles, span), span),
            }
        )

    return {
        "candidates": candidates,
        "measurementScope": "deterministic byte/locality comparison; gzip mtime=0; no production SLO",
        "point": {"x": POINT[0], "y": POINT[1], "floor": compiler.FLOOR},
        "selectedProofCandidate": {
            "encoding": compiler.PROFILE,
            "reason": "32x32 balances bounded file count and representative point/viewport bytes for this proof only; permanent format/chunk size remain deferred",
            "span": 32,
        },
        "sourceArtifact": compiler.SOURCE_ARTIFACT,
        "version": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        report = build_report(args.source)
    except (compiler.CompileError, OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}")
        return 1
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(payload, encoding="utf-8", newline="\n")
    print(payload, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
