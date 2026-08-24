#!/usr/bin/env python3
"""Build the browser-safe Atlas animation product from exact Game semantics and 15.32 pixels."""
from __future__ import annotations

import argparse
import bisect
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import zipfile
from typing import Any

HERE = Path(__file__).resolve().parent
MM_PATH = HERE.parent / "dyn-atlas-pixels" / "measure_metadata.py"
PROFILE = "oteryn-atlas-animation-runtime-v2"
GAME_SHA = "91b73a7566a59991ebf7d471eacb3a858b755c9c"
APPEARANCE_ROOT = "sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1"
OUTFIT_SPATIAL_ROOT = "sha256:62fdd7d0ce02652582f03bf971455f4a2f9ec1e472eaebfec5af739cf11a921e"
CREATURE_SEMANTIC_DIGEST = "sha256:5f10a15758199105584c38634d08254af79973cf7ce25d54bf46e54d8fee26ca"
PLAYBACK_PROJECTION_CAPABILITY = "creature-moving-in-place-v1"
ZIP_SHA = "1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f"
CATALOG_SHA = "35639e000c4c108665a091cfbdf699d549d995b37670bc08de575ab6cd380d85"
APPEARANCE_SHA = "dc4f4c01e3701c77877c67895168e4399837046122d6d17e3e608a12a2fed075"
BUCKET_LIMIT = 8 * 1024 * 1024
ROOT_DOMAIN = b"OTERYN-ATLAS-ANIMATION-RUNTIME-V2\0"


class BuildError(RuntimeError):
    pass


def canonical(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def sha(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def sha_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def load_mm():
    spec = importlib.util.spec_from_file_location("atlas_animation_mm", MM_PATH)
    if spec is None or spec.loader is None:
        raise BuildError("unable to load exact sprite decoder")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def verify_inputs(asset_zip: Path, appearance_product: Path, creatures_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    if sha_file(asset_zip) != ZIP_SHA:
        raise BuildError("exact 15.32 ZIP digest mismatch")
    manifest = read_json(appearance_product / "manifest.json")
    if manifest.get("product_root") != APPEARANCE_ROOT or manifest.get("capability") != "animated-appearances-v1":
        raise BuildError("unsupported Game animation product")
    source = manifest.get("source", {})
    if source.get("zip_sha256") != ZIP_SHA or source.get("catalog_sha256") != CATALOG_SHA or source.get("appearance_sha256") != APPEARANCE_SHA:
        raise BuildError("Game animation product source mismatch")
    creatures = read_json(creatures_path)
    if creatures.get("capability") != "animated-creatures-v1":
        raise BuildError("animated-creatures-v1 required")
    if creatures.get("playback_projection_capability") != PLAYBACK_PROJECTION_CAPABILITY:
        raise BuildError("creature moving-in-place projection capability required")
    if creatures.get("semantic_digest") != CREATURE_SEMANTIC_DIGEST:
        raise BuildError("creature semantic digest mismatch")
    if creatures.get("appearance_product_root") != APPEARANCE_ROOT:
        raise BuildError("creature appearance root mismatch")
    if creatures.get("outfit_spatial_product_root") != OUTFIT_SPATIAL_ROOT:
        raise BuildError("creature outfit spatial root mismatch")
    return manifest, creatures


def catalog_index(asset_zip: Path, mm) -> tuple[zipfile.ZipFile, list[dict[str, Any]], list[int]]:
    archive = zipfile.ZipFile(asset_zip)
    catalog_bytes = archive.read("assets/catalog-content.json")
    if hashlib.sha256(catalog_bytes).hexdigest() != CATALOG_SHA:
        archive.close(); raise BuildError("catalog digest mismatch")
    entries = sorted((entry for entry in json.loads(catalog_bytes) if entry.get("type") == "sprite"), key=lambda row: row["lastspriteid"])
    return archive, entries, [int(row["lastspriteid"]) for row in entries]


def sprite_decoder(archive, entries, last_ids, mm):
    sheet_cache: dict[str, bytes] = {}
    sprite_cache: dict[int, tuple[int, int, bytes]] = {}
    def decode(sprite_id: int) -> tuple[int, int, bytes]:
        if sprite_id in sprite_cache:
            return sprite_cache[sprite_id]
        idx = bisect.bisect_left(last_ids, sprite_id)
        if idx >= len(entries) or sprite_id < int(entries[idx]["firstspriteid"]):
            raise BuildError(f"missing catalog sprite {sprite_id}")
        entry = entries[idx]
        file_name = entry.get("file")
        if not isinstance(file_name, str):
            raise BuildError("sprite sheet file missing")
        rgba = sheet_cache.get(file_name)
        if rgba is None:
            rgba = mm.decode_sheet(archive.read(f"assets/{file_name}")); sheet_cache[file_name] = rgba
        value = mm.extract_sprite(entry, rgba, sprite_id)
        sprite_cache[sprite_id] = value
        return value
    return decode


def blend(dst: bytearray, src: bytes) -> None:
    if len(dst) != len(src):
        raise BuildError("sprite geometry mismatch during outfit composition")
    for i in range(0, len(src), 4):
        sa = src[i + 3]
        if sa == 0:
            continue
        if sa == 255:
            dst[i:i + 4] = src[i:i + 4]; continue
        da = dst[i + 3]
        out_a = sa + (da * (255 - sa) + 127) // 255
        if out_a == 0:
            continue
        for channel in range(3):
            premul = src[i + channel] * sa + (dst[i + channel] * da * (255 - sa) + 127) // 255
            dst[i + channel] = min(255, (premul + out_a // 2) // out_a)
        dst[i + 3] = out_a


def tint_mask(dst: bytearray, mask: bytes, colors: dict[str, list[int]]) -> None:
    roles = {(255,255,0,255): "head", (255,0,0,255): "body", (0,255,0,255): "legs", (0,0,255,255): "feet"}
    if len(dst) != len(mask):
        raise BuildError("mask geometry mismatch")
    for i in range(0, len(mask), 4):
        role = roles.get(tuple(mask[i:i + 4]))
        if role is None:
            continue
        rgb = colors.get(role)
        if not isinstance(rgb, list) or len(rgb) != 3:
            raise BuildError("resolved outfit color missing")
        for channel in range(3):
            dst[i + channel] = (dst[i + channel] * int(rgb[channel]) + 127) // 255


def frame_sprite_id(program: dict[str, Any], phase: int, x: int, y: int, z: int, layer: int) -> int:
    patterns = program["patterns"]
    width, height, depth = int(patterns["width"]), int(patterns["height"]), int(patterns["depth"])
    layers = int(program["layers"])
    if not (0 <= x < width and 0 <= y < height and 0 <= z < depth and 0 <= layer < layers and 0 <= phase < int(program["phase_count"])):
        raise BuildError("program selector outside bounds")
    index = ((((phase * depth + z) * height + y) * width + x) * layers + layer)
    values = program["sprite_source_ids"]
    if index >= len(values):
        raise BuildError("program sprite cardinality mismatch")
    return int(values[index])


def precompose_creature_projection(
    presentation: dict[str, Any],
    projection: dict[str, Any],
    programs_by_id: dict[str, dict[str, Any]],
    decode_sprite,
    *,
    presentation_mode: str,
) -> dict[str, Any]:
    program_id = projection["animation_program_id"]
    program = programs_by_id.get(program_id)
    if program is None:
        raise BuildError(f"missing outfit animation program {program_id}")
    x, z = int(projection["pattern_x"]), int(projection["pattern_z"])
    ys = [int(value) for value in projection["enabled_addon_pattern_y"]]
    colors = presentation["colors_rgb"]
    phase_count = int(projection["phase_count"])
    if phase_count != int(program["phase_count"]):
        raise BuildError("creature projection phase count mismatch")
    frames: list[tuple[int, int, bytes]] = []
    for phase in range(phase_count):
        out: bytearray | None = None
        geometry: tuple[int, int] | None = None
        for y in ys:
            sid = frame_sprite_id(program, phase, x, y, z, 0)
            width, height, rgba = decode_sprite(sid)
            if geometry is None:
                geometry = (width, height); out = bytearray(width * height * 4)
            if geometry != (width, height) or out is None:
                raise BuildError("creature base sprite geometry drift")
            blend(out, rgba)
            if int(program["layers"]) == 2:
                mask_id = frame_sprite_id(program, phase, x, y, z, 1)
                mw, mh, mask = decode_sprite(mask_id)
                if (mw, mh) != geometry:
                    raise BuildError("creature mask sprite geometry drift")
                tint_mask(out, mask, colors)
        if geometry is None or out is None:
            raise BuildError("empty creature presentation")
        frames.append((geometry[0], geometry[1], bytes(out)))
    core = {
        "animation": projection.get("animation"),
        "animation_program_id": program_id,
        "displacement": projection["displacement"],
        "outfit_presentation_id": presentation["outfit_presentation_id"],
        "phase_count": phase_count,
        "presentation_mode": presentation_mode,
        "selection_policy": projection["selection_policy"],
    }
    return {"core": core, "frames": frames}


def finalize_creature_program(composed: dict[str, Any], add_blob) -> dict[str, Any]:
    phase_ids = [add_blob(width, height, rgba) for width, height, rgba in composed["frames"]]
    geometry = {(width, height) for width, height, _ in composed["frames"]}
    if len(geometry) != 1:
        raise BuildError("creature phase geometry drift")
    width, height = next(iter(geometry))
    return {**composed["core"], "phase_content_ids": phase_ids, "width": width, "height": height}


def verify_stable_creature_geometry(static_program: dict[str, Any], walking_program: dict[str, Any]) -> None:
    if static_program["width"] != walking_program["width"] or static_program["height"] != walking_program["height"]:
        raise BuildError("creature playback geometry drift")
    if static_program["displacement"] != walking_program["displacement"]:
        raise BuildError("creature playback displacement drift")


def build(asset_zip: Path, appearance_product: Path, creatures_path: Path, output: Path) -> dict[str, Any]:
    mm = load_mm()
    manifest, creatures = verify_inputs(asset_zip, appearance_product, creatures_path)
    object_programs = read_jsonl(appearance_product / "object-programs.jsonl")
    outfit_programs = read_jsonl(appearance_product / "outfit-programs.jsonl")
    outfit_by_id = {row["program_id"]: row for row in outfit_programs}
    archive, entries, last_ids = catalog_index(asset_zip, mm)
    decode_sprite = sprite_decoder(archive, entries, last_ids, mm)
    blobs: dict[str, tuple[int, int, bytes]] = {}
    sprite_index: dict[str, dict[str, Any]] = {}
    def add_blob(width: int, height: int, rgba: bytes) -> str:
        content_id = "sha256:" + hashlib.sha256(mm.PIXEL_HASH_DOMAIN + width.to_bytes(2, "big") + height.to_bytes(2, "big") + rgba).hexdigest()
        blobs.setdefault(content_id, (width, height, rgba))
        return content_id
    for program in object_programs:
        if int(program.get("layers", 0)) != 1:
            raise BuildError("v2 object runtime requires prequalified one-layer programs")
        for sprite_id in program["sprite_source_ids"]:
            sprite_id = int(sprite_id)
            if str(sprite_id) in sprite_index:
                continue
            width, height, rgba = decode_sprite(sprite_id)
            sprite_index[str(sprite_id)] = {"content_id": add_blob(width, height, rgba), "width": width, "height": height}
    unique_presentations: dict[str, dict[str, Any]] = {}
    for key in ("npcs", "monster_spawns"):
        for record in creatures.get(key, []):
            if record.get("presentation_resolution_state") != "RESOLVED":
                continue
            presentation = record.get("outfit_presentation")
            if not isinstance(presentation, dict):
                raise BuildError("resolved creature presentation missing")
            unique_presentations.setdefault(str(presentation["outfit_presentation_id"]), presentation)
    creature_programs: list[dict[str, Any]] = []
    walking_program_count = 0
    walking_fallback_count = 0
    for presentation_id in sorted(unique_presentations):
        presentation = unique_presentations[presentation_id]
        static_projection = presentation.get("static_projection")
        playback_projection = presentation.get("playback_projection")
        if not isinstance(static_projection, dict) or not isinstance(playback_projection, dict):
            raise BuildError("resolved creature playback projections missing")
        static_program = finalize_creature_program(
            precompose_creature_projection(presentation, static_projection, outfit_by_id, decode_sprite, presentation_mode="static"),
            add_blob,
        )
        playback_state = playback_projection.get("playback_resolution_state")
        walking_program = None
        fallback_reason = None
        if playback_state == "RESOLVED_MOVING_IN_PLACE":
            if playback_projection.get("presentation_mode") != "moving-in-place" or playback_projection.get("world_position_policy") != "UNCHANGED":
                raise BuildError("invalid resolved moving-in-place projection")
            if playback_projection.get("outfit_presentation_id") != presentation_id:
                raise BuildError("moving projection presentation identity mismatch")
            walking_program = finalize_creature_program(
                precompose_creature_projection(presentation, playback_projection, outfit_by_id, decode_sprite, presentation_mode="moving-in-place"),
                add_blob,
            )
            verify_stable_creature_geometry(static_program, walking_program)
            walking_program_count += 1
        elif playback_state == "FALLBACK_STATIC_PROJECTION":
            fallback_reason = playback_projection.get("playback_reason")
            if playback_projection.get("presentation_mode") != "static-fallback" or playback_projection.get("world_position_policy") != "UNCHANGED":
                raise BuildError("invalid static playback fallback projection")
            if playback_projection.get("outfit_presentation_id") != presentation_id:
                raise BuildError("fallback projection presentation identity mismatch")
            if not isinstance(fallback_reason, str) or not fallback_reason:
                raise BuildError("static playback fallback reason missing")
            walking_fallback_count += 1
        else:
            raise BuildError("unknown creature playback resolution state")
        creature_programs.append({
            "outfit_presentation_id": presentation_id,
            "static_program": static_program,
            "walking_program": walking_program,
            "walking_fallback_reason": fallback_reason,
        })
    archive.close()

    output.mkdir(parents=True, exist_ok=True)
    bucket_dir = output / "buckets"; bucket_dir.mkdir(parents=True, exist_ok=True)
    blob_index: dict[str, dict[str, Any]] = {}
    buckets: list[dict[str, Any]] = []
    current = bytearray(); bucket_number = 0
    def flush() -> None:
        nonlocal current, bucket_number
        if not current:
            return
        payload = bytes(current); bucket_id = f"b{bucket_number:04d}"; path = f"buckets/{bucket_id}.rgba"
        (output / path).write_bytes(payload)
        buckets.append({"id": bucket_id, "path": path, "bytes": len(payload), "digest": sha(payload)})
        current = bytearray(); bucket_number += 1
    for content_id, (width, height, rgba) in sorted(blobs.items()):
        if len(rgba) > BUCKET_LIMIT:
            raise BuildError("single animation blob exceeds bucket limit")
        if current and len(current) + len(rgba) > BUCKET_LIMIT:
            flush()
        bucket_id = f"b{bucket_number:04d}"; offset = len(current); current.extend(rgba)
        blob_index[content_id] = {"bucket": bucket_id, "offset": offset, "bytes": len(rgba), "width": width, "height": height}
    flush()
    product = {
        "profile": PROFILE,
        "object_programs": object_programs,
        "creature_programs": creature_programs,
        "sprite_index": sprite_index,
        "blob_index": blob_index,
    }
    program_bytes = canonical(product); (output / "programs.json").write_bytes(program_bytes)
    source = {
        "game_sha": GAME_SHA,
        "appearance_product_root": APPEARANCE_ROOT,
        "outfit_spatial_product_root": OUTFIT_SPATIAL_ROOT,
        "creature_semantic_digest": creatures["semantic_digest"],
        "playback_projection_capability": creatures["playback_projection_capability"],
        "zip_sha256": ZIP_SHA,
        "catalog_sha256": CATALOG_SHA,
        "appearance_sha256": APPEARANCE_SHA,
    }
    manifest_core = {
        "profile": PROFILE,
        "identityAuthority": False,
        "source": source,
        "programs": {"path": "programs.json", "bytes": len(program_bytes), "digest": sha(program_bytes)},
        "buckets": buckets,
        "counts": {
            "object_programs": len(object_programs),
            "creature_programs": len(creature_programs),
            "creature_static_programs": len(creature_programs),
            "creature_walking_programs": walking_program_count,
            "creature_walking_fallbacks": walking_fallback_count,
            "sprite_refs": len(sprite_index),
            "pixel_blobs": len(blobs),
            "pixel_bytes": sum(len(value[2]) for value in blobs.values()),
            "buckets": len(buckets),
        },
    }
    root = sha(ROOT_DOMAIN + canonical(manifest_core))
    runtime_manifest = {**manifest_core, "rootContentId": root}
    manifest_bytes = canonical(runtime_manifest); (output / "manifest.json").write_bytes(manifest_bytes)
    return {"rootContentId": root, **runtime_manifest["counts"], "creature_semantic_digest": creatures["semantic_digest"], "playback_projection_capability": creatures["playback_projection_capability"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("asset_zip", type=Path)
    parser.add_argument("appearance_product", type=Path)
    parser.add_argument("animated_creatures", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        result = build(args.asset_zip, args.appearance_product, args.animated_creatures, args.output)
    except (BuildError, OSError, ValueError, KeyError, TypeError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}", file=sys.stderr); return 1
    print(json.dumps(result, sort_keys=True)); return 0


if __name__ == "__main__":
    raise SystemExit(main())