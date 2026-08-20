#!/usr/bin/env python3
"""Build a deterministic visual minimap from verified Atlas publication pixels.

The product is presentation-only. It never assigns terrain, walkability, region,
or gameplay semantics. One output PNG pixel represents one canonical world tile.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import struct
import zlib

WORLD_PROFILE = "oteryn-atlas-visual-minimap-world-v0"
FLOOR_PROFILE = "oteryn-atlas-visual-minimap-floor-v0"
WORLD_DOMAIN = b"OTERYN-ATLAS-VISUAL-MINIMAP-WORLD-V0\0"
FLOOR_DOMAIN = b"OTERYN-ATLAS-VISUAL-MINIMAP-FLOOR-V0\0"
REGION_SPAN = 256

_SPRITE_COLORS: dict[int, tuple[int, int, int, int]] = {}
_OUTPUT: Path | None = None
def canonical_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode("utf-8")


def content_id(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def rooted(domain: bytes, value: dict) -> str:
    core = dict(value)
    core.pop("rootContentId", None)
    return content_id(domain + canonical_bytes(core))


def png_rgba(width: int, height: int, rgba: bytes) -> bytes:
    if len(rgba) != width * height * 4:
        raise ValueError("RGBA byte count mismatch")
    def chunk(kind: bytes, payload: bytes) -> bytes:
        body = kind + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    rows = b"".join(b"\x00" + rgba[y * width * 4:(y + 1) * width * 4] for y in range(height))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b"")
def _mean_sprite_color(data: bytes) -> tuple[int, int, int, int]:
    rs = gs = bs = alphas = count = 0
    for index in range(0, len(data), 4):
        alpha = data[index + 3]
        if alpha == 0:
            continue
        rs += data[index] * alpha
        gs += data[index + 1] * alpha
        bs += data[index + 2] * alpha
        alphas += alpha
        count += 1
    if count == 0 or alphas == 0:
        return (0, 0, 0, 0)
    return (
        round(rs / alphas), round(gs / alphas), round(bs / alphas),
        round(alphas / count),
    )


def build_sprite_colors(publication: Path) -> dict[int, tuple[int, int, int, int]]:
    pixels = publication / "pixels"
    manifest = json.loads((pixels / "manifest.json").read_text(encoding="utf-8"))
    by_content = {entry["contentId"]: entry for entry in manifest["blobs"]}
    packs = [open(pixels / entry["path"], "rb") for entry in manifest["packs"]]
    color_by_content: dict[str, tuple[int, int, int, int]] = {}
    result: dict[int, tuple[int, int, int, int]] = {}
    try:
        for sprite_id, sprite in sorted(manifest["spriteIndex"].items(), key=lambda pair: int(pair[0])):
            cid = sprite["contentId"]
            if cid not in color_by_content:
                blob = by_content[cid]
                packs[blob["pack"]].seek(blob["offset"])
                color_by_content[cid] = _mean_sprite_color(packs[blob["pack"]].read(blob["bytes"]))
            result[int(sprite_id)] = color_by_content[cid]
    finally:
        for handle in packs:
            handle.close()
    return result
def _composite(dst: tuple[int, int, int, int], src: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    sa = src[3] / 255.0
    da = dst[3] / 255.0
    out_a = sa + da * (1.0 - sa)
    if out_a <= 0:
        return (0, 0, 0, 0)
    rgb = []
    for channel in range(3):
        value = (src[channel] * sa + dst[channel] * da * (1.0 - sa)) / out_a
        rgb.append(max(0, min(255, round(value))))
    return (rgb[0], rgb[1], rgb[2], max(0, min(255, round(out_a * 255))))


def _presentation_color(presentation: dict) -> tuple[int, int, int, int]:
    colors = [_SPRITE_COLORS.get(int(p["sprite_source_id"]), (0, 0, 0, 0)) for p in presentation.get("resolved_primitives", [])]
    colors = [color for color in colors if color[3] > 0]
    if not colors:
        return (0, 0, 0, 0)
    weight = sum(color[3] for color in colors)
    return tuple(
        round(sum(color[index] * color[3] for color in colors) / weight) if index < 3 else round(weight / len(colors))
        for index in range(4)
    )


def _tile_color(record: dict) -> tuple[int, int, int, int]:
    color = (0, 0, 0, 0)
    for presentation in record.get("presentation", []):
        color = _composite(color, _presentation_color(presentation))
    return color
def _init_worker(colors: dict[int, tuple[int, int, int, int]], output: str) -> None:
    global _SPRITE_COLORS, _OUTPUT
    _SPRITE_COLORS = colors
    _OUTPUT = Path(output)


def _build_chunk(args: tuple[int, dict, str]) -> dict:
    floor, entry, semantic_base = args
    source = Path(semantic_base) / entry["path"]
    pixels = bytearray(REGION_SPAN * REGION_SPAN * 4)
    tile_count = 0
    with source.open("r", encoding="utf-8") as handle:
        for line in handle:
            record = json.loads(line)
            position = record["position"]
            if position["floor"] != floor:
                raise ValueError(f"source floor mismatch in {source}")
            lx = int(position["x"]) - int(entry["logicalAddress"]["region_x"]) * REGION_SPAN
            ly = int(position["y"]) - int(entry["logicalAddress"]["region_y"]) * REGION_SPAN
            if not (0 <= lx < REGION_SPAN and 0 <= ly < REGION_SPAN):
                raise ValueError(f"source tile outside logical region in {source}")
            offset = (ly * REGION_SPAN + lx) * 4
            pixels[offset:offset + 4] = bytes(_tile_color(record))
            tile_count += 1
    if tile_count != entry["tiles"]:
        raise ValueError(f"source tile count mismatch for {source}")
    encoded = png_rgba(REGION_SPAN, REGION_SPAN, bytes(pixels))
    logical = entry["logicalAddress"]
    relative = f"tiles/f{floor}/rx{logical['region_x']}_ry{logical['region_y']}.png"
    target = _OUTPUT / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(encoded)
    return {
        "bytes": len(encoded), "contentId": content_id(encoded), "logicalAddress": logical,
        "path": relative, "sourceContentId": entry["contentId"], "tiles": tile_count,
    }
def build(publication: Path, output: Path, workers: int) -> dict:
    publication_manifest = json.loads((publication / "publication.json").read_text(encoding="utf-8"))
    semantic_base = publication / "semantic"
    semantic_world = json.loads((semantic_base / "world.json").read_text(encoding="utf-8"))
    sprite_colors = build_sprite_colors(publication)
    output.mkdir(parents=True, exist_ok=True)
    floor_entries = []
    total_bytes = total_chunks = total_tiles = 0
    for floor_entry in semantic_world["floors"]:
        floor = json.loads((semantic_base / floor_entry["path"]).read_text(encoding="utf-8"))
        jobs = [(floor["floor"], entry, str(semantic_base)) for entry in floor["chunks"]]
        if workers == 1:
            _init_worker(sprite_colors, str(output))
            built = [_build_chunk(job) for job in jobs]
        else:
            with ProcessPoolExecutor(max_workers=workers, initializer=_init_worker, initargs=(sprite_colors, str(output))) as pool:
                built = list(pool.map(_build_chunk, jobs, chunksize=1))
        built.sort(key=lambda item: (item["logicalAddress"]["region_x"], item["logicalAddress"]["region_y"]))
        core = {
            "bounds": floor["bounds"], "chunks": built, "floor": floor["floor"],
            "pixelPerWorldTile": 1, "profile": FLOOR_PROFILE, "regionSpan": REGION_SPAN,
            "sourceFloorRoot": floor["rootContentId"],
        }
        core["counts"] = {"bytes": sum(x["bytes"] for x in built), "chunks": len(built), "tiles": sum(x["tiles"] for x in built)}
        floor_product = {**core, "rootContentId": rooted(FLOOR_DOMAIN, core)}
        floor_path = f"floors/f{floor['floor']}.json"
        (output / "floors").mkdir(exist_ok=True)
        (output / floor_path).write_bytes(canonical_bytes(floor_product))
        floor_entries.append({"floor": floor["floor"], "path": floor_path, "rootContentId": floor_product["rootContentId"], "bounds": floor["bounds"]})
        total_bytes += core["counts"]["bytes"]
        total_chunks += core["counts"]["chunks"]
        total_tiles += core["counts"]["tiles"]
    world_core = {
        "counts": {"bytes": total_bytes, "chunks": total_chunks, "floors": len(floor_entries), "tiles": total_tiles},
        "floors": floor_entries,
        "pixelPerWorldTile": 1,
        "profile": WORLD_PROFILE,
        "regionSpan": REGION_SPAN,
        "semantics": {
            "classification": "VISUAL_PRESENTATION_ONLY",
            "terrainClassification": "NOT_CLAIMED",
            "walkability": "NOT_CLAIMED",
            "canonicalRegions": "NOT_CLAIMED",
        },
        "source": {
            "authority": "Oteryn/Oteryn-Game",
            "gameSha": publication_manifest["source"]["gameSha"],
            "pixelRoot": publication_manifest["pixels"]["rootContentId"],
            "publicationRoot": publication_manifest["rootContentId"],
            "semanticRoot": publication_manifest["semantic"]["rootContentId"],
        },
    }
    world = {**world_core, "rootContentId": rooted(WORLD_DOMAIN, world_core)}
    (output / "world.json").write_bytes(canonical_bytes(world))
    return world


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--publication", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=max(1, min(8, os.cpu_count() or 1)))
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 32:
        raise SystemExit("workers must be 1..32")
    world = build(args.publication.resolve(), args.output.resolve(), args.workers)
    print(f"PASS root={world['rootContentId']} floors={world['counts']['floors']} chunks={world['counts']['chunks']} tiles={world['counts']['tiles']} bytes={world['counts']['bytes']}")


if __name__ == "__main__":
    main()
