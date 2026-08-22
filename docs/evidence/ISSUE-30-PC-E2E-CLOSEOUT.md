# Issue 30 local-PC E2E closeout evidence

- Repository: `Oteryn/Oteryn-Atlas`.
- Lifecycle: Issue `#30`.
- Execution host: `Molehill-PC` via Remote Desktop Commander.
- Refreshed base `main`: `a66ecd57d7b5bb43f7c1ffc52dffa09d14e4ea19`.
- Local harness commit: `6dcb4c818fe502bdffb1e7ff0d76884dd50114d8`.
- Docker Server: `29.6.1`; Docker Compose: `v5.3.0`.
- Playwright: `1.62.0`; Chromium: `151.0.7922.34`.
- Game producer revision: `1ce7c60714dbd5d87da16d2eb0b8eac0c30c2282`.
- Legacy evidence revision: `e417c5e7c22986bf4acef0495eb47f7b72c97cce`.
- Creature digest: `sha256:01921968a6cb4f6ecea237820a053fc5052aaa1da556851f2c2a60d99890b5e1`.
- Product counts: 88,633 placements = 1,068 NPC + 87,565 monster/spawn; 5,746 spatial chunks; 1,945 search records.
- NPC target: `A Bearded Woman`, `npc:473280040fcebbf2bc1bad9e3717d7a9`, X 32594 / Y 31615 / F -10.
- Monster target: `Acid Blob`, `monster:83f049b79b2988bccdfb22f9a46a739d`, X 32831 / Y 32596 / F -12.
- Creature Chromium result: desktop `PASS`, mobile `PASS`; initial visible records 31 / 48.
- Standard Docker Playwright result: `5/5 PASS` with two workers.
- Browser/semantic/trust tests: `62/62 PASS`; static module/Python checks and `git diff --check`: `PASS`.
- Fail-closed digest mismatch: `PASS` (`untrusted Game creature semantic digest`).
- Fail-closed byte cap: `PASS` for a 5,249,116-byte index (`exceeds byte limit`).
- Runtime cache assertion retained: `cacheChunks <= 96`; overlay requires `drawnRecords > 0`.
- Animation remains `off` through factual creature deep-link and static records remain visible.
- Local evidence: `artifacts/e2e/issue30-current/result.json`, `desktop-initial.png`, `desktop-npc-only.png`, `mobile-monster-only.png`.
- Reproduced repair: the live creature harness was hard-coded to the Synology origin/revision header; it now accepts a plain local origin, binds to either exact code/live revision header, and strengthens floor/provenance/runtime HTTP assertions.
- Production creature semantics and trust boundaries were not changed.

The exact post-squash merged-main SHA cannot exist before merge. It is recorded in the terminal Issue #30 closeout comment after the required merged-main PC rerun.
