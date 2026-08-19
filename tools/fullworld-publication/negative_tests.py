#!/usr/bin/env python3
"""Run fail-closed negative tests against a verified full-world publication."""
from __future__ import annotations

import argparse
import copy
import importlib.util
import json
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Callable

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location("verify_publication", HERE / "verify_publication.py")
VERIFY = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(VERIFY)
PUB = VERIFY.PUB


def expect_failure(label: str, operation: Callable[[], object]) -> dict[str, str]:
    try:
        operation()
    except (VERIFY.VerifyError, PUB.PublicationError) as exc:
        return {"test": label, "result": "PASS", "rejected": str(exc)}
    raise RuntimeError(f"negative test unexpectedly accepted invalid input: {label}")


def write_manifest(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(PUB.canonical(value))

def link_pack_tree(source_pixel_root: Path, target_pixel_root: Path, skip_first: bool = False) -> None:
    manifest = json.loads((source_pixel_root / "manifest.json").read_text())
    for index, pack in enumerate(manifest["packs"]):
        if skip_first and index == 0:
            continue
        source = source_pixel_root / pack["path"]
        target = target_pixel_root / pack["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.symlink_to(source)


def run(args: argparse.Namespace) -> dict:
    root = args.publication
    publication = VERIFY.load_manifest(root / "publication.json")
    semantic = VERIFY.load_manifest(root / publication["semantic"]["path"])
    pixels = VERIFY.load_manifest(root / publication["pixels"]["path"])
    handoff = PUB.load_handoff(args.handoff, args.expected_handoff_sha256)
    results: list[dict[str, str]] = []

    forged_publication = copy.deepcopy(publication)
    forged_publication["serializerStatus"] = "FROZEN"
    results.append(expect_failure(
        "forged top-level publication root",
        lambda: VERIFY.check_root(forged_publication, PUB.PUBLICATION_DOMAIN, "forged publication"),
    ))

    first_floor_entry = semantic["floors"][0]
    source_semantic_root = (root / publication["semantic"]["path"]).parent
    first_floor = VERIFY.load_manifest(source_semantic_root / first_floor_entry["path"])
    first_chunk = first_floor["chunks"][0]
    with tempfile.TemporaryDirectory(prefix="atlas-neg-sem-") as td:
        temp_root = Path(td)
        temp_semantic = temp_root / "semantic"
        write_manifest(temp_semantic / "world.json", semantic)
        write_manifest(temp_semantic / first_floor_entry["path"], first_floor)
        semantic_pub = {"semantic": {"path": "semantic/world.json", "rootContentId": semantic["rootContentId"]}}
        results.append(expect_failure(
            "missing semantic chunk",
            lambda: VERIFY.verify_semantic(temp_root, semantic_pub),
        ))

        corrupt_path = temp_semantic / first_chunk["path"]
        corrupt_path.parent.mkdir(parents=True, exist_ok=True)
        corrupt_path.write_bytes(b"corrupt\n")
        results.append(expect_failure(
            "corrupt semantic chunk",
            lambda: VERIFY.verify_semantic(temp_root, semantic_pub),
        ))

        forged_floor = copy.deepcopy(first_floor)
        forged_floor["counts"]["tiles"] += 1
        write_manifest(temp_semantic / first_floor_entry["path"], forged_floor)
        results.append(expect_failure(
            "forged floor manifest root",
            lambda: VERIFY.verify_semantic(temp_root, semantic_pub),
        ))
    sprite_ids = {int(key) for key in pixels["spriteIndex"]}
    source_pixel_root = (root / publication["pixels"]["path"]).parent
    pixel_pub = {"pixels": {"path": "pixels/manifest.json", "rootContentId": pixels["rootContentId"]}}

    with tempfile.TemporaryDirectory(prefix="atlas-neg-pixel-missing-") as td:
        temp_root = Path(td)
        write_manifest(temp_root / "pixels/manifest.json", pixels)
        link_pack_tree(source_pixel_root, temp_root / "pixels", skip_first=True)
        results.append(expect_failure(
            "missing pixel pack",
            lambda: VERIFY.verify_pixels(temp_root, pixel_pub, sprite_ids),
        ))

    with tempfile.TemporaryDirectory(prefix="atlas-neg-pixel-corrupt-") as td:
        temp_root = Path(td)
        write_manifest(temp_root / "pixels/manifest.json", pixels)
        link_pack_tree(source_pixel_root, temp_root / "pixels", skip_first=True)
        first_pack = temp_root / "pixels" / pixels["packs"][0]["path"]
        first_pack.parent.mkdir(parents=True, exist_ok=True)
        first_pack.write_bytes(b"corrupt pixel pack")
        results.append(expect_failure(
            "corrupt pixel pack",
            lambda: VERIFY.verify_pixels(temp_root, pixel_pub, sprite_ids),
        ))
    with tempfile.TemporaryDirectory(prefix="atlas-neg-blob-") as td:
        temp_root = Path(td)
        forged_pixels = copy.deepcopy(pixels)
        original_id = forged_pixels["blobs"][0]["contentId"]
        forged_id = "sha256:" + "0" * 64
        forged_pixels["blobs"][0]["contentId"] = forged_id
        for mapping in forged_pixels["spriteIndex"].values():
            if mapping["contentId"] == original_id:
                mapping["contentId"] = forged_id
        core = dict(forged_pixels)
        core.pop("rootContentId", None)
        forged_pixels["rootContentId"] = PUB.rooted(PUB.PIXEL_ROOT_DOMAIN, core)
        forged_pixel_pub = {
            "pixels": {"path": "pixels/manifest.json", "rootContentId": forged_pixels["rootContentId"]}
        }
        write_manifest(temp_root / "pixels/manifest.json", forged_pixels)
        link_pack_tree(source_pixel_root, temp_root / "pixels")
        results.append(expect_failure(
            "forged pixel blob identity with recomputed manifest root",
            lambda: VERIFY.verify_pixels(temp_root, forged_pixel_pub, sprite_ids),
        ))

    sid = min(sprite_ids)
    forged_mapping_pixels = copy.deepcopy(pixels)
    forged_mapping_pixels["spriteIndex"][str(sid)]["contentId"] = "sha256:" + "f" * 64
    results.append(expect_failure(
        "forged sprite-to-pixel mapping",
        lambda: VERIFY.verify_authorized_sprite_mappings(
            args.repo_root, args.asset_zip, handoff, forged_mapping_pixels, {sid}
        ),
    ))
    return {"result": "PASS", "negativeTests": results, "count": len(results)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--publication", type=Path, required=True)
    parser.add_argument("--handoff", type=Path, required=True)
    parser.add_argument("--asset-zip", type=Path, required=True)
    parser.add_argument("--expected-handoff-sha256", required=True)
    args = parser.parse_args()
    try:
        result = run(args)
    except (RuntimeError, VERIFY.VerifyError, PUB.PublicationError, OSError, KeyError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
