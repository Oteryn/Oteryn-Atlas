#!/usr/bin/env python3
"""Run a fail-closed real-Chrome smoke against an Atlas preview URL."""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def find_chrome(explicit: str | None) -> str:
    candidates: list[str] = []
    if explicit:
        candidates.append(explicit)
    if os.environ.get("CHROME"):
        candidates.append(os.environ["CHROME"])
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser"):
        resolved = shutil.which(name)
        if resolved:
            candidates.append(resolved)
    if os.name == "nt":
        for base_var in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
            base = os.environ.get(base_var)
            if base:
                candidates.append(str(Path(base) / "Google" / "Chrome" / "Application" / "chrome.exe"))
    for candidate in candidates:
        if Path(candidate).is_file():
            return str(Path(candidate).resolve())
    raise SystemExit("Chrome/Chromium executable not found; pass --chrome or set CHROME")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Exact preview URL to qualify")
    parser.add_argument("--chrome", help="Chrome/Chromium executable")
    parser.add_argument("--expect", action="append", default=[], help="Required DOM substring; repeatable")
    parser.add_argument("--timeout-seconds", type=int, default=60)
    parser.add_argument("--virtual-time-ms", type=int, default=30000)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    chrome = find_chrome(args.chrome)
    expected = args.expect or ["VERIFIED", "WEBGL2"]
    with tempfile.TemporaryDirectory(prefix="oteryn-atlas-chrome-") as profile:
        command = [
            chrome,
            "--headless=new",
            "--disable-dev-shm-usage",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--force-device-scale-factor=1",
            "--window-size=1920,1080",
            f"--virtual-time-budget={args.virtual_time_ms}",
            f"--user-data-dir={profile}",
            "--dump-dom",
            args.url,
        ]
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=args.timeout_seconds,
        )
    dom = result.stdout
    if result.returncode != 0:
        print(result.stderr[-4000:], file=sys.stderr)
        raise SystemExit(f"Chrome exited with code {result.returncode}")
    if not dom.strip():
        raise SystemExit("Chrome returned an empty DOM")
    missing = [needle for needle in expected if needle not in dom]
    if missing:
        raise SystemExit(f"Missing required DOM markers: {missing}")
    print(
        "LAN Chrome smoke PASS: "
        f"url={args.url} chrome={chrome} dom_bytes={len(dom.encode('utf-8'))} "
        f"markers={expected}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
