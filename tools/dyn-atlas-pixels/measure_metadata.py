#!/usr/bin/env python3
"""Measure exact DYN-ATLAS-001 pixel content identity without publishing pixels.

This tool consumes the exact Game semantic fixture plus the exact 15.32 asset
archive. It decodes only sprite IDs referenced by the Game fixture, computes
content-domain hashes and emits metadata-only deduplication evidence. It never
writes decoded RGBA, BMP, sprite sheets, or PNG files to the output.
"""

from __future__ import annotations

import argparse
import bisect
from collections import Counter, defaultdict
import hashlib
import json
import lzma
from pathlib import Path
import time
from typing import Any
import zipfile

ASSET_ZIP_SHA256 = "1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f"
ASSET_CATALOG_SHA256 = "35639e000c4c108665a091cfbdf699d549d995b37670bc08de575ab6cd380d85"
GAME_ARTIFACT_DIGEST = "sha256:d38a98acaf019b07a05c0bee922505fe4c9852b38e65644e488e92df9031da2e"
GAME_TILES_SHA256 = "ff14efee3fc376d8f18432c628294c64ffe89450a59aaa498a28e6d705815984"
DRIVE_FILE_ID = "1Dlo3bS4K1nS3mw4BhPZdlHT7lX5zRAvv"
PIXEL_HASH_DOMAIN = b"OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0"
SPRITE_SIZES = ((32, 32), (32, 64), (64, 32), (64, 64))
EXPECTED_REFERENCED_SPRITES = 990


class MeasureError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def decode_sheet(data: bytes) -> bytes:
    position = 0
    while position < len(data) and data[position] == 0:
        position += 1
    if data[position : position + 5] != b"\x70\x0a\xfa\x80\x24":
        raise MeasureError("invalid CipSoft sprite sheet header")
    position += 5
    while position < len(data) and data[position] & 0x80:
        position += 1
    position += 1
    if position + 13 > len(data):
        raise MeasureError("truncated LZMA properties")

    properties = data[position]
    lc = properties % 9
    remainder = properties // 9
    lp, pb = remainder % 5, remainder // 5
    dictionary = int.from_bytes(data[position + 1 : position + 5], "little")
    position += 13
    bmp = lzma.decompress(
        data[position:],
        format=lzma.FORMAT_RAW,
        filters=[{"id": lzma.FILTER_LZMA1, "dict_size": dictionary, "lc": lc, "lp": lp, "pb": pb}],
    )
    if bmp[:2] != b"BM":
        raise MeasureError("decoded sprite sheet is not BMP")
    pixel_offset = int.from_bytes(bmp[10:14], "little")
    width = int.from_bytes(bmp[18:22], "little", signed=True)
    height = int.from_bytes(bmp[22:26], "little", signed=True)
    if width != 384 or abs(height) != 384:
        raise MeasureError(f"unexpected sprite sheet dimensions {width}x{height}")
    pixels = bmp[pixel_offset : pixel_offset + width * abs(height) * 4]
    if len(pixels) != width * abs(height) * 4:
        raise MeasureError("truncated sprite sheet pixels")

    rows = [pixels[index * width * 4 : (index + 1) * width * 4] for index in range(abs(height))]
    if height > 0:
        rows.reverse()
    rgba = bytearray()
    for row in rows:
        for index in range(0, len(row), 4):
            blue, green, red, alpha = row[index : index + 4]
            rgba.extend((red, green, blue, alpha))
    return bytes(rgba)


def extract_sprite(entry: dict[str, Any], rgba: bytes, sprite_id: int) -> tuple[int, int, bytes]:
    sprite_type = entry.get("spritetype")
    if not isinstance(sprite_type, int) or not 0 <= sprite_type < len(SPRITE_SIZES):
        raise MeasureError(f"unsupported sprite type {sprite_type!r}")
    width, height = SPRITE_SIZES[sprite_type]
    first_id = entry.get("firstspriteid")
    last_id = entry.get("lastspriteid")
    if not isinstance(first_id, int) or not isinstance(last_id, int) or not first_id <= sprite_id <= last_id:
        raise MeasureError(f"sprite {sprite_id} outside catalog range")
    columns = 384 // width
    offset = sprite_id - first_id
    x = (offset % columns) * width
    y = (offset // columns) * height
    result = bytearray()
    for row in range(y, y + height):
        start = (row * 384 + x) * 4
        result.extend(rgba[start : start + width * 4])
    if len(result) != width * height * 4:
        raise MeasureError("extracted sprite byte count mismatch")
    return width, height, bytes(result)


def referenced_sprite_ids(game_fixture: Path) -> set[int]:
    manifest_path = game_fixture / "manifest.json"
    tiles_path = game_fixture / "tiles.jsonl"
    if not manifest_path.is_file() or not tiles_path.is_file():
        raise MeasureError("Game semantic fixture must contain manifest.json and tiles.jsonl")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("artifact_digest") != GAME_ARTIFACT_DIGEST:
        raise MeasureError("unexpected Game semantic artifact digest")
    if sha256_file(tiles_path) != GAME_TILES_SHA256:
        raise MeasureError("unexpected Game tiles digest")

    ids: set[int] = set()
    presentation_count = 0
    primitive_count = 0
    with tiles_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            try:
                tile = json.loads(line)
            except json.JSONDecodeError as exc:
                raise MeasureError(f"invalid Game tile JSON line {line_number}") from exc
            presentations = tile.get("presentation")
            if not isinstance(presentations, list):
                raise MeasureError(f"missing presentation list on line {line_number}")
            for presentation in presentations:
                presentation_count += 1
                primitives = presentation.get("resolved_primitives")
                if not isinstance(primitives, list):
                    raise MeasureError("missing resolved primitives")
                for primitive in primitives:
                    sprite_id = primitive.get("sprite_source_id")
                    if not isinstance(sprite_id, int) or sprite_id < 0:
                        raise MeasureError("invalid sprite source id")
                    ids.add(sprite_id)
                    primitive_count += 1
    if presentation_count != 39282 or primitive_count != 39282:
        raise MeasureError("Game semantic presentation/primitive reconciliation failed")
    if len(ids) != EXPECTED_REFERENCED_SPRITES:
        raise MeasureError(f"expected {EXPECTED_REFERENCED_SPRITES} unique sprite IDs, got {len(ids)}")
    return ids


def measure(game_fixture: Path, asset_zip: Path) -> dict[str, Any]:
    started = time.perf_counter()
    if sha256_file(asset_zip) != ASSET_ZIP_SHA256:
        raise MeasureError("unexpected 15.32 asset ZIP digest")
    sprite_ids = referenced_sprite_ids(game_fixture)

    with zipfile.ZipFile(asset_zip) as archive:
        catalog_bytes = archive.read("assets/catalog-content.json")
        if hashlib.sha256(catalog_bytes).hexdigest() != ASSET_CATALOG_SHA256:
            raise MeasureError("unexpected 15.32 catalog digest")
        catalog = json.loads(catalog_bytes)
        sheets = [entry for entry in catalog if entry.get("type") == "sprite"]
        sheets.sort(key=lambda entry: entry["lastspriteid"])
        last_ids = [entry["lastspriteid"] for entry in sheets]

        def sheet_for(sprite_id: int) -> dict[str, Any]:
            index = bisect.bisect_left(last_ids, sprite_id)
            if index == len(sheets) or sprite_id < sheets[index]["firstspriteid"]:
                raise MeasureError(f"missing sprite catalog entry for {sprite_id}")
            return sheets[index]

        by_file: dict[str, list[int]] = defaultdict(list)
        for sprite_id in sprite_ids:
            entry = sheet_for(sprite_id)
            file_name = entry.get("file")
            if not isinstance(file_name, str):
                raise MeasureError("sprite catalog file name missing")
            by_file[file_name].append(sprite_id)

        content_to_ids: dict[tuple[int, int, str], list[int]] = defaultdict(list)
        dimensions: Counter[tuple[int, int]] = Counter()
        non_transparent_pixels = 0
        total_pixels = 0

        for file_name in sorted(by_file):
            entry = sheet_for(by_file[file_name][0])
            rgba = decode_sheet(archive.read(f"assets/{file_name}"))
            for sprite_id in sorted(by_file[file_name]):
                width, height, pixels = extract_sprite(entry, rgba, sprite_id)
                digest = hashlib.sha256()
                digest.update(PIXEL_HASH_DOMAIN)
                digest.update(width.to_bytes(2, "big"))
                digest.update(height.to_bytes(2, "big"))
                digest.update(pixels)
                content_digest = digest.hexdigest()
                content_to_ids[(width, height, content_digest)].append(sprite_id)
                dimensions[(width, height)] += 1
                total_pixels += width * height
                non_transparent_pixels += sum(1 for index in range(3, len(pixels), 4) if pixels[index] != 0)

    raw_before = sum(width * height * 4 * len(ids) for (width, height, _digest), ids in content_to_ids.items())
    raw_after = sum(width * height * 4 for width, height, _digest in content_to_ids)
    duplicate_groups = [
        {
            "contentDigest": f"sha256:{digest}",
            "height": height,
            "spriteSourceIds": sorted(ids),
            "width": width,
        }
        for (width, height, digest), ids in content_to_ids.items()
        if len(ids) > 1
    ]
    duplicate_groups.sort(key=lambda group: group["spriteSourceIds"])

    return {
        "alpha": {
            "nonTransparentFraction": non_transparent_pixels / total_pixels,
            "nonTransparentPixelsAcrossReferencedSprites": non_transparent_pixels,
            "totalPixelsAcrossReferencedSprites": total_pixels,
        },
        "decode": {
            "dimensions": {f"{width}x{height}": count for (width, height), count in sorted(dimensions.items())},
            "pixelHashDomain": PIXEL_HASH_DOMAIN[:-1].decode("ascii"),
            "spriteSheetsRead": len(by_file),
            "spriteSourceIdsDecoded": len(sprite_ids),
        },
        "dedupe": {
            "dedupeFraction": (len(sprite_ids) - len(content_to_ids)) / len(sprite_ids),
            "duplicateGroups": duplicate_groups,
            "duplicateSpriteReferencesByContent": len(sprite_ids) - len(content_to_ids),
            "rawRgbaBytesAfterContentDedupe": raw_after,
            "rawRgbaBytesBeforeContentDedupe": raw_before,
            "rawRgbaBytesSaved": raw_before - raw_after,
            "uniquePixelBlobs": len(content_to_ids),
        },
        "measurement": {
            "classification": "private exact-source metadata-only analysis",
            "decoderSecondsObserved": time.perf_counter() - started,
            "pixelPublication": False,
            "productionSlo": False,
        },
        "source": {
            "assetZipSha256": ASSET_ZIP_SHA256,
            "driveFileId": DRIVE_FILE_ID,
            "gameSemanticArtifact": GAME_ARTIFACT_DIGEST,
            "gameUniqueSpriteSourceIds": len(sprite_ids),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game-fixture", type=Path, required=True)
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        report = measure(args.game_fixture, args.asset_zip)
    except (MeasureError, OSError, KeyError, ValueError, zipfile.BadZipFile, lzma.LZMAError) as exc:
        print(f"ERROR: {exc}")
        return 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
