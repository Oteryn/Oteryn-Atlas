# Atlas repository audits — 6 September 2026

Lifecycle: Oteryn/Oteryn-Atlas#315. Artifact class: historical audit evidence, not execution or merge authority.

## Reports

Start with the [in-depth second report](round-2/REPORT.md). The [first report](round-1/REPORT.md) preserves the initial findings and their original scope. Both examine `Oteryn/Oteryn-Atlas@51623c7dab2346cee39cd51e3caa845bf4b65426` and retain explicit limitations; neither is complete product, security, browser or deployment qualification.

The owner requested repository persistence after both audits. Their reports, scripts, source snapshots and selected recorded results are imported byte-for-byte. Statements inside the originals that no repository changes were made or that files were not saved to GitHub describe the original audit sessions, before this archival import. They are not statements about this persistence commit.

## Custody and exclusions

[import-manifest.json](import-manifest.json) identifies the supplied archives, exact imported round trees and exclusions. [SHA256SUMS](SHA256SUMS) covers every imported file and this index/manifest, excluding the checksum file itself. Git tree equality verifies names, bytes and file modes, not the truth of every conclusion in a report. Source snapshots are evidence of the inspected revision, not replacement runtime code or new canonical authority.

The import retains 77 original text files. It excludes the two rendered report HTML duplicates, original package checksum files, packaging helpers, screenshots, expanded browser script, redundant browser-environment diagnostics and 4,838 regenerable synthetic working-product files. Generators, summary outcomes, detailed probe JSON/logs and mutation TAP results are retained. The ZIP archives and binary images/pixels are not committed. No omitted screenshot is claimed as product visual acceptance.

The original per-round READMEs are preserved unchanged: use `REPORT.md` instead of their references to `REPORT.html`, and this directory's `SHA256SUMS` instead of the omitted package checksum files. References to `/response/turn...`, temporary paths and run timestamps in recorded evidence are historical locators, not current GitHub state.

## Reproduction boundary

From this directory, integrity checking is read-only:

```sh
sha256sum -c SHA256SUMS
```

Reproduction is optional and separate from persistence. Use a disposable copy outside the repository because the runners overwrite their own result files:

```sh
work=$(mktemp -d)
cp -R round-2 "$work/round-2"
(cd "$work/round-2" && python run-audit.py)
```

Round 2 requires Node 22 and Python with `lzma`; its main replay is network-free. Browser probes have separate optional dependencies and are not part of that runner. Round 1 additionally requires Git, POSIX file-mode/symlink support and a writable `/mnt/data` directory as encoded in its unchanged historical script. Never point the destructive-overlap experiment or copied product generators at real repositories or publications.

Do not wire this evidence directory into automatic test discovery or CI. Recorded PASS, failure and deliberate-mutation results belong to the audit fixtures and original runs, not a new acceptance result for current main. Persistence does not restore suspended tests or implement the proposed repairs.

## Scope of this delivery

Only this new `docs/evidence/repository-audit-2026-09-06/` subtree is added. No runtime, original tests, prompts, AGENTS, maintenance policy, workflow, ruleset, publication, deployment or other repository is modified. Strategy: single agent, one dedicated branch; this bounded archival write has no parallel ownership or shared-runner requirement. Normal protected review and PR/Merge Queue policy still govern any later integration. Do not close #315 on the strength of this archival delivery.
