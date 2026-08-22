# Issue 30 local-PC E2E closeout evidence

- Repository: `Oteryn/Oteryn-Atlas`.
- Lifecycle: Issue `#30`, terminally closed on 2026-08-22 after exact merged-main local-PC acceptance.
- Execution host: `Molehill-PC` via Remote Desktop Commander.
- Refreshed base before harness PR: `a66ecd57d7b5bb43f7c1ffc52dffa09d14e4ea19`.
- Qualified PR head: `5b28c1b8af5a5d08797d6ad966e612e3b43b20a1`.
- Exact post-squash merged `main`: `183d6ee914071626ccb4684473100292a3eb8779`.
- Docker Server: `29.6.1`; Docker Compose: `v5.3.0`.
- Playwright: `1.62.0`; Chromium: `151.0.7922.34`.
- Game producer revision: `1ce7c60714dbd5d87da16d2eb0b8eac0c30c2282`.
- Legacy evidence revision: `e417c5e7c22986bf4acef0495eb47f7b72c97cce`.
- Creature digest: `sha256:01921968a6cb4f6ecea237820a053fc5052aaa1da556851f2c2a60d99890b5e1`.
- Product counts: 88,633 placements = 1,068 NPC + 87,565 monster/spawn; 5,746 spatial chunks; 1,945 search records.
- NPC target: `A Bearded Woman`, `npc:473280040fcebbf2bc1bad9e3717d7a9`, X 32594 / Y 31615 / F -10.
- Monster target: `Acid Blob`, `monster:83f049b79b2988bccdfb22f9a46a739d`, X 32831 / Y 32596 / F -12.
- Creature Chromium result on exact merged `main`: desktop `PASS`, mobile `PASS`; initial visible records 31 / 48.
- Standard Docker Playwright result: `5/5 PASS` with two workers.
- Browser/semantic/trust tests: `62/62 PASS`; static module/Python checks and `git diff --check`: `PASS`.
- Fail-closed digest mismatch: `PASS` (`untrusted Game creature semantic digest`).
- Fail-closed byte cap: `PASS` for a 5,249,116-byte index (`exceeds byte limit`).
- Runtime cache assertion retained: `cacheChunks <= 96`; overlay requires `drawnRecords > 0`.
- Animation remains `off` through factual creature deep-link and static records remain visible.
- Exact merged-main local evidence: `artifacts/e2e/issue30-merged-183d6ee/result.json`, `desktop-initial.png`, `desktop-npc-only.png`, `mobile-monster-only.png`.
- Final result payload records `status: PASS`, Atlas revision `183d6ee914071626ccb4684473100292a3eb8779`, desktop-selected NPC `npc:473280040fcebbf2bc1bad9e3717d7a9`, and mobile-selected monster `monster:83f049b79b2988bccdfb22f9a46a739d`.
- Exact local FullWorld root acceptance also passed HTTP Range with `206` / `Content-Range: bytes 100-199/72681462`.
- Reproduced repair: the live creature harness was hard-coded to the Synology origin/revision header; it now accepts a plain local origin, binds to either exact code/live revision header, and strengthens floor/provenance/runtime HTTP assertions.
- Production creature semantics and trust boundaries were not changed.
- Harness/evidence implementation was merged by PR `#53`; Issue `#30` is closed after the final exact merged-main rerun and cleanup.

This document is the repository-side terminal record for Issue #30. The exact merged-main SHA and final acceptance evidence above supersede the pre-merge placeholder text that existed in the initial evidence commit.
