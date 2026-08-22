#!/usr/bin/env python3
"""Build the private bounded Atlas animation pixel/runtime product from Game-owned semantics."""
from __future__ import annotations

import argparse
import bisect
import hashlib
import importlib.util
import json
from collections import OrderedDict
from pathlib import Path
from typing import Any
import zipfile

PROFILE = "oteryn-atlas-animation-runtime-v1"
ROOT_DOMAIN = b"OTERYN-ATLAS-ANIMATION-RUNTIME-V1\0"
PIXEL_DOMAIN = b"OTERYN-DYN-ATLAS-PIXEL-RGBA-V0\0"
EXPECTED_ZIP = "1a6bad8b7598cd874f534cd4aae2d249fb3d9b4458b3ccfa75754f91bb27870f"
EXPECTED_APPEARANCE_ROOT = "sha256:0d1c8fc777d1d220a9d7723507fddd72585f7358d35a40209bd7415f1fe057c1"
EXPECTED_CREATURE_CAPABILITY = "animated-creatures-v1"
MAX_CREATURE_PRESENTATIONS = 4096

class ProductError(RuntimeError):
    pass

def canonical(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")

def sha256(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()

def file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ProductError(f"unable to load decoder module {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def load_programs(appearance_product: Path) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
    manifest = json.loads((appearance_product / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("capability") != "animated-appearances-v1" or manifest.get("product_root") != EXPECTED_APPEARANCE_ROOT:
        raise ProductError("unexpected Game appearance product")
    objects = [json.loads(line) for line in (appearance_product / "object-programs.jsonl").read_text(encoding="utf-8").splitlines() if line]
    outfits = [json.loads(line) for line in (appearance_product / "outfit-programs.jsonl").read_text(encoding="utf-8").splitlines() if line]
    if len(objects) != 5190 or len(outfits) != 2935:
        raise ProductError("appearance program census mismatch")
    return objects, {program["program_id"]: program for program in outfits}

class SpriteReader:
    def __init__(self, asset_zip: Path, decoder) -> None:
        if file_sha(asset_zip) != EXPECTED_ZIP:
            raise ProductError("unexpected 15.32 ZIP digest")
        self.archive = zipfile.ZipFile(asset_zip)
        catalog = json.loads(self.archive.read("assets/catalog-content.json"))
        self.entries = sorted((entry for entry in catalog if entry.get("type") == "sprite"), key=lambda entry: entry["lastspriteid"])
        self.last_ids = [entry["lastspriteid"] for entry in self.entries]
        self.decoder = decoder
        self.sheet_cache: OrderedDict[str, bytes] = OrderedDict()

    def entry(self, sprite_id: int) -> dict[str, Any]:
        index = bisect.bisect_left(self.last_ids, sprite_id)
        if index == len(self.entries) or sprite_id < self.entries[index]["firstspriteid"]:
            raise ProductError(f"missing sprite {sprite_id}")
        return self.entries[index]

    def sprite(self, sprite_id: int) -> tuple[int, int, bytes]:
        entry = self.entry(sprite_id)
        name = entry["file"]
        sheet = self.sheet_cache.pop(name, None)
        if sheet is None:
            sheet = self.decoder.decode_sheet(self.archive.read(f"assets/{name}"))
        self.sheet_cache[name] = sheet
        while len(self.sheet_cache) > 24:
            self.sheet_cache.popitem(last=False)
        return self.decoder.extract_sprite(entry, sheet, sprite_id)

    def close(self) -> None:
        self.archive.close()

def pixel_content_id(width: int, height: int, pixels: bytes) -> str:
    digest = hashlib.sha256(PIXEL_DOMAIN + width.to_bytes(2, "big") + height.to_bytes(2, "big") + pixels).hexdigest()
    return f"sha256:{digest}"

def build_object_pixels(reader: SpriteReader, programs: list[dict[str, Any]], output: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    sprite_ids = sorted({int(sprite_id) for program in programs for sprite_id in program["sprite_source_ids"]})
    pack_path = output / "object-pixels.rgba"
    index: dict[str, Any] = {}
    digest = hashlib.sha256()
    offset = 0
    with pack_path.open("wb") as pack:
        for sprite_id in sprite_ids:
            width, height, pixels = reader.sprite(sprite_id)
            pack.write(pixels)
            digest.update(pixels)
            index[str(sprite_id)] = {
                "bytes": len(pixels), "contentId": pixel_content_id(width, height, pixels),
                "height": height, "offset": offset, "width": width,
            }
            offset += len(pixels)
    descriptor = {
        "bytes": offset, "path": pack_path.name, "sha256": digest.hexdigest(),
        "spriteRefs": len(index),
    }
    return descriptor, index

def blend(canvas: bytearray, source: bytes) -> None:
    for index in range(0, len(source), 4):
        alpha = source[index + 3]
        if not alpha:
            continue
        inverse = 255 - alpha
        for channel in range(3):
            canvas[index + channel] = (source[index + channel] * alpha + canvas[index + channel] * inverse + 127) // 255
        canvas[index + 3] = alpha + (canvas[index + 3] * inverse + 127) // 255

MASK_FIELDS = {
    (255, 255, 0, 255): "head", (255, 0, 0, 255): "body",
    (0, 255, 0, 255): "legs", (0, 0, 255, 255): "feet",
}

def apply_mask(canvas: bytearray, mask: bytes, colors: dict[str, list[int]]) -> None:
    for index in range(0, len(mask), 4):
        field = MASK_FIELDS.get(tuple(mask[index:index + 4]))
        if field is None:
            continue
        color = colors[field]
        for channel in range(3):
            canvas[index + channel] = (canvas[index + channel] * int(color[channel]) + 127) // 255

def sprite_index(program: dict[str, Any], *, layer: int, x: int, y: int, z: int, phase: int) -> int:
    patterns = program["patterns"]
    return ((((phase * int(patterns["depth"]) + z) * int(patterns["height"]) + y) * int(patterns["width"]) + x) * int(program["layers"]) + layer)

def render_creature_frame(reader: SpriteReader, program: dict[str, Any], presentation: dict[str, Any], phase: int) -> tuple[int, int, bytes]:
    projection = presentation["static_projection"]
    x, z = int(projection["pattern_x"]), int(projection["pattern_z"])
    canvas = None
    width = height = 0
    for y in projection["enabled_addon_pattern_y"]:
        base_id = int(program["sprite_source_ids"][sprite_index(program, layer=0, x=x, y=int(y), z=z, phase=phase)])
        sw, sh, base = reader.sprite(base_id)
        if canvas is None:
            width, height, canvas = sw, sh, bytearray(sw * sh * 4)
        if (sw, sh) != (width, height):
            raise ProductError("inconsistent creature sprite geometry")
        blend(canvas, base)
        if int(program["layers"]) == 2:
            mask_id = int(program["sprite_source_ids"][sprite_index(program, layer=1, x=x, y=int(y), z=z, phase=phase)])
            mw, mh, mask = reader.sprite(mask_id)
            if (mw, mh) != (width, height):
                raise ProductError("inconsistent creature mask geometry")
            apply_mask(canvas, mask, presentation["colors_rgb"])
    if canvas is None:
        raise ProductError("creature frame resolved no pixels")
    return width, height, bytes(canvas)

def collect_creature_presentations(source_path: Path) -> tuple[dict[str, dict[str, Any]], dict[str, int]]:
    source = json.loads(source_path.read_text(encoding="utf-8"))
    if source.get("capability") != EXPECTED_CREATURE_CAPABILITY:
        raise ProductError("creature source lacks animated-creatures-v1")
    if source.get("appearance_product_root") != EXPECTED_APPEARANCE_ROOT:
        raise ProductError("creature source appearance root mismatch")
    presentations: dict[str, dict[str, Any]] = {}
    resolved_records = {"npc": 0, "monster": 0}
    for key, kind in (("npcs", "npc"), ("monster_spawns", "monster")):
        records = source.get(key)
        if not isinstance(records, list):
            raise ProductError(f"creature source {key} missing")
        for record in records:
            if record.get("presentation_resolution_state") != "RESOLVED":
                continue
            presentation = record.get("outfit_presentation")
            if not isinstance(presentation, dict):
                raise ProductError("resolved creature presentation missing")
            presentation_id = presentation.get("outfit_presentation_id")
            if not isinstance(presentation_id, str):
                raise ProductError("outfit presentation identity missing")
            current = presentations.setdefault(presentation_id, presentation)
            if current != presentation:
                raise ProductError("outfit presentation identity collision")
            resolved_records[kind] += 1
    if len(presentations) > MAX_CREATURE_PRESENTATIONS:
        raise ProductError("creature presentation product exceeds bounded cap")
    return presentations, resolved_records

def build_creature_pixels(reader: SpriteReader, presentations: dict[str, dict[str, Any]], outfit_programs: dict[str, dict[str, Any]], output: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    pack_path = output / "creature-frames.rgba"
    frame_blobs: dict[str, dict[str, Any]] = {}
    catalogue: dict[str, Any] = {}
    digest = hashlib.sha256()
    offset = 0
    with pack_path.open("wb") as pack:
        for presentation_id in sorted(presentations):
            presentation = presentations[presentation_id]
            projection = presentation["static_projection"]
            program = outfit_programs.get(projection["animation_program_id"])
            if program is None:
                raise ProductError("creature references missing outfit program")
            phase_count = int(projection["phase_count"])
            frames = []
            for phase in range(phase_count):
                width, height, pixels = render_creature_frame(reader, program, presentation, phase)
                content_id = pixel_content_id(width, height, pixels)
                blob = frame_blobs.get(content_id)
                if blob is None:
                    blob = {"bytes": len(pixels), "contentId": content_id, "height": height, "offset": offset, "width": width}
                    pack.write(pixels); digest.update(pixels); frame_blobs[content_id] = blob; offset += len(pixels)
                frames.append(blob)
            catalogue[presentation_id] = {
                "animation": projection.get("animation"), "anchorPolicy": projection["anchor_policy"],
                "displacement": projection["displacement"], "frames": frames,
                "phaseCount": phase_count, "programId": projection["animation_program_id"],
            }
    descriptor = {"bytes": offset, "path": pack_path.name, "sha256": digest.hexdigest(), "uniqueFrames": len(frame_blobs)}
    return descriptor, catalogue

def build(asset_zip: Path, appearance_product: Path, creature_source: Path, output: Path, game_sha: str) -> dict[str, Any]:
    if len(game_sha) != 40 or any(ch not in "0123456789abcdef" for ch in game_sha):
        raise ProductError("Game SHA must be full lowercase hex")
    decoder_path = Path(__file__).resolve().parents[1] / "dyn-atlas-pixels" / "measure_metadata.py"
    decoder = load_module(decoder_path, "atlas_animation_pixel_decoder")
    objects, outfit_programs = load_programs(appearance_product)
    presentations, resolved_records = collect_creature_presentations(creature_source)
    output.mkdir(parents=True, exist_ok=True)
    reader = SpriteReader(asset_zip, decoder)
    try:
        object_pack, object_index = build_object_pixels(reader, objects, output)
        creature_pack, creature_catalogue = build_creature_pixels(reader, presentations, outfit_programs, output)
    finally:
        reader.close()
    objects_path = output / "object-programs.json"
    object_index_path = output / "object-pixels.json"
    creatures_path = output / "creatures.json"
    objects_path.write_bytes(canonical({"programs": objects}))
    object_index_path.write_bytes(canonical({"sprites": object_index}))
    creatures_path.write_bytes(canonical({"presentations": creature_catalogue}))
    appearance_manifest = json.loads((appearance_product / "manifest.json").read_text(encoding="utf-8"))
    core = {
        "capability": "animated-world-and-creatures-v1", "gameRevision": game_sha,
        "identityAuthority": False, "profile": PROFILE,
        "source": appearance_manifest["source"], "appearanceProductRoot": EXPECTED_APPEARANCE_ROOT,
        "objects": {"bytes": objects_path.stat().st_size, "path": objects_path.name, "sha256": file_sha(objects_path), "programs": len(objects)},
        "objectPixels": {**object_pack, "indexBytes": object_index_path.stat().st_size, "indexPath": object_index_path.name, "indexSha256": file_sha(object_index_path)},
        "creatures": {"bytes": creatures_path.stat().st_size, "path": creatures_path.name, "presentations": len(creature_catalogue), "sha256": file_sha(creatures_path)},
        "creaturePixels": creature_pack,
        "counts": {"resolvedNpcRecords": resolved_records["npc"], "resolvedMonsterRecords": resolved_records["monster"]},
        "rights": {"classification": "private-preview-validation", "publicFullWorldRedistributionAuthorized": False},
    }
    manifest = dict(core)
    manifest["rootContentId"] = "sha256:" + hashlib.sha256(ROOT_DOMAIN + canonical(core)).hexdigest()
    (output / "manifest.json").write_bytes(canonical(manifest))
    return manifest

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--appearance-product", type=Path, required=True)
    parser.add_argument("--creature-source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--game-sha", required=True)
    args = parser.parse_args()
    try:
        result = build(args.asset_zip, args.appearance_product, args.creature_source, args.output, args.game_sha)
    except (ProductError, OSError, ValueError, KeyError, IndexError, zipfile.BadZipFile) as exc:
        print(f"ERROR: {exc}")
        return 1
    print(json.dumps({"rootContentId": result["rootContentId"], "counts": result["counts"], "objectPrograms": result["objects"]["programs"], "creaturePresentations": result["creatures"]["presentations"]}, sort_keys=True))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
