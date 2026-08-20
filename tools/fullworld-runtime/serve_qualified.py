#!/usr/bin/env python3
"""Range-capable local server for exact full-world browser qualification."""
from __future__ import annotations

import argparse
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

RANGE_RE = re.compile(r"bytes=(\d+)-(\d*)$")
CHUNK = 1024 * 1024


class QualificationServerError(RuntimeError):
    pass


def safe_file(root: Path, relative: str) -> Path | None:
    relative = unquote(relative).lstrip("/")
    candidate = (root / relative).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_dir():
        candidate = candidate / "index.html"
    return candidate if candidate.is_file() else None


def handler_factory(repo: Path, publication: Path, overview: Path, runtime_index: Path, pixel_buckets: Path):
    roots = [
        ("/fullworld/publication/", publication),
        ("/fullworld/overview/", overview),
        ("/fullworld/runtime-index/", runtime_index),
        ("/fullworld/pixel-buckets/", pixel_buckets),
    ]

    class Handler(BaseHTTPRequestHandler):
        server_version = "OterynAtlasQualification/1"

        def log_message(self, fmt: str, *args) -> None:
            print(f"{self.address_string()} - {fmt % args}")

        def resolve(self) -> Path | None:
            path = urlsplit(self.path).path
            for prefix, root in roots:
                if path.startswith(prefix):
                    return safe_file(root, path[len(prefix):])
            return safe_file(repo, path)

        def send_common(self, path: Path, status: int, length: int, start: int | None = None, end: int | None = None) -> None:
            self.send_response(status)
            mime, _ = mimetypes.guess_type(path.name)
            if path.suffix == ".mjs":
                mime = "text/javascript"
            elif path.suffix in {".rgba", ".jsonl"}:
                mime = "application/octet-stream"
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.send_header("Content-Length", str(length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if start is not None and end is not None:
                self.send_header("Content-Range", f"bytes {start}-{end}/{path.stat().st_size}")
            self.end_headers()

        def do_HEAD(self) -> None:
            path = self.resolve()
            if path is None:
                self.send_error(404)
                return
            self.send_common(path, 200, path.stat().st_size)

        def do_GET(self) -> None:
            path = self.resolve()
            if path is None:
                self.send_error(404)
                return
            size = path.stat().st_size
            range_header = self.headers.get("Range")
            start, end = 0, size - 1
            status = 200
            if range_header:
                match = RANGE_RE.fullmatch(range_header.strip())
                if match is None:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                start = int(match.group(1))
                end = int(match.group(2)) if match.group(2) else size - 1
                if start < 0 or start >= size or end < start or end >= size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.end_headers()
                    return
                status = 206
            length = end - start + 1
            self.send_common(path, status, length, start if status == 206 else None, end if status == 206 else None)
            with path.open("rb") as handle:
                handle.seek(start)
                remaining = length
                while remaining:
                    block = handle.read(min(CHUNK, remaining))
                    if not block:
                        raise QualificationServerError(f"unexpected EOF: {path}")
                    self.wfile.write(block)
                    remaining -= len(block)

    return Handler


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--publication", type=Path, required=True)
    parser.add_argument("--overview", type=Path, required=True)
    parser.add_argument("--runtime-index", type=Path, required=True)
    parser.add_argument("--pixel-buckets", type=Path, required=True)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8877)
    args = parser.parse_args()
    repo = args.repo.resolve()
    publication = args.publication.resolve()
    overview = args.overview.resolve()
    runtime_index = args.runtime_index.resolve()
    pixel_buckets = args.pixel_buckets.resolve()
    for label, root in [("repo", repo), ("publication", publication), ("overview", overview), ("runtime-index", runtime_index), ("pixel-buckets", pixel_buckets)]:
        if not root.is_dir():
            raise SystemExit(f"missing {label} directory: {root}")
    server = ThreadingHTTPServer((args.bind, args.port), handler_factory(repo, publication, overview, runtime_index, pixel_buckets))
    print(f"serving http://{args.bind}:{args.port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
