# TEMP PR #328 publication handoff

Base commit: `63be104b0982baf141931fb2deb059c0ea63e3b6`

This file contains the complete UTF-8 content for every implementation file changed by the reconstructed hardening.

## Original blob SHAs

- `.github/workflows/merge-authority-audit.yml`: `8c7c3b1f30cc1aa9f7d10120915ab52f39dc30ca`
- `.github/workflows/merge-group-gate.yml`: `e9e8d45dc2bb5ef2d045cc5a4606f0cf3d58422c`
- `.github/workflows/protected-qualification-repair.yml`: `5d46883abe84010a2c386f59df5cb47a103c7c9d`
- `tests/verification/issue-314-qualification-path.test.mjs`: `173a00a47eb9ff7db76ec6dac6493c0c629f0632`
- `tests/verification/issue-314-qualification-repair-trust.test.mjs`: `168fe52f7bdf96711b07374c36461da904c1e1a1`
- `tests/verification/merge-group-qualification-repair-bootstrap.test.mjs`: `3d802c8a74495a539bf67639e18f88517630e9bb`
- `tests/verification/qualification-repair-policy.test.mjs`: `82738e512ab58e22a4a592bbe01143ada46b0d32`
- `tools/governance/verify_extraction_provenance.py`: `ced468aadb792ffaf759679ee20d40dacbba1de6`
- `tools/verification/qualification-repair-policy.mjs`: `ffe03d2c2f82e29e43e366698e426ec2d9506fae`

## `.github/workflows/merge-authority-audit.yml`

````text
name: Merge authority audit

on:
  pull_request_target:
    branches:
      - main
    types:
      - opened
      - reopened
      - synchronize
      - edited

permissions: {}

concurrency:
  group: atlas-merge-authority-audit-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  audit:
    name: Merge authority audit / protected-base validate
    runs-on: ubuntu-24.04
    timeout-minutes: 10
    permissions:
      contents: read
      pull-requests: read
    env:
      EXPECTED_PR_CI_BLOB: "6d1ca9d28fc1f73d284fa140d2917694b4c0a3fe"
      EXPECTED_MERGE_GROUP_GATE_BLOB: "77a520ab25b609e55be40da9454f67eda922a371"
      EXPECTED_PROVENANCE_VERIFIER_BLOB: "5c2e51a2d6bb6c708f24ab7829ad555af1a0c340"
      EXPECTED_PROVENANCE_TEST_BLOB: "0e2dda25befd0b66ab870ffe05416986c27ceb61"
      EXPECTED_PROVENANCE_MAP_BLOB: "763c797cf23f18a157b2c8ca51f0b7b279ae5ac5"
    steps:
      - name: Validate Atlas merge-authority candidate as inert data
        shell: bash
        env:
          EVENT_PR_NUMBER: ${{ github.event.pull_request.number }}
          EVENT_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
          GH_TOKEN: ${{ github.token }}
          REPOSITORY: ${{ github.repository }}
        run: |
          set -euo pipefail
          python - <<'PY'
          import base64
          import hashlib
          import json
          import os
          import re
          import urllib.parse
          import urllib.request

          repository = os.environ['REPOSITORY']
          number = os.environ['EVENT_PR_NUMBER'].strip()
          expected_head = os.environ['EVENT_PR_HEAD_SHA'].strip().lower()
          pins = {
              '.github/workflows/ci.yml': os.environ['EXPECTED_PR_CI_BLOB'].strip().lower(),
              '.github/workflows/merge-group-gate.yml': os.environ['EXPECTED_MERGE_GROUP_GATE_BLOB'].strip().lower(),
              'tools/governance/verify_extraction_provenance.py': os.environ['EXPECTED_PROVENANCE_VERIFIER_BLOB'].strip().lower(),
              'tools/governance/test_verify_extraction_provenance.py': os.environ['EXPECTED_PROVENANCE_TEST_BLOB'].strip().lower(),
              'docs/migration/legacy-atlas-extraction-provenance.json': os.environ['EXPECTED_PROVENANCE_MAP_BLOB'].strip().lower(),
          }
          governance_prefix = 'tools/governance/'

          if re.fullmatch(r'[1-9][0-9]*', number) is None:
              raise SystemExit('invalid pull request number')
          if re.fullmatch(r'[0-9a-f]{40}', expected_head) is None:
              raise SystemExit('invalid pull request head SHA')
          for path, blob in pins.items():
              if re.fullmatch(r'[0-9a-f]{40}', blob) is None:
                  raise SystemExit(f'invalid protected-base blob pin for {path}')

          headers = {
              'Accept': 'application/vnd.github+json',
              'Authorization': f"Bearer {os.environ['GH_TOKEN']}",
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'Oteryn-Atlas-protected-base-merge-authority-audit',
          }

          def api(path: str):
              request = urllib.request.Request(
                  f'https://api.github.com/repos/{repository}{path}',
                  headers=headers,
              )
              with urllib.request.urlopen(request, timeout=30) as response:
                  return json.load(response)

          def read_candidate_text(path: str) -> tuple[str, str]:
              encoded = urllib.parse.quote(path, safe='/')
              payload = api(f'/contents/{encoded}?ref={expected_head}')
              if payload.get('encoding') != 'base64' or not isinstance(payload.get('content'), str):
                  raise SystemExit(f'unable to read candidate path as inert content: {path}')
              raw = base64.b64decode(payload['content'])
              try:
                  text = raw.decode('utf-8')
              except UnicodeDecodeError as exc:
                  raise SystemExit(f'candidate path is not UTF-8 text: {path}') from exc
              blob = hashlib.sha1(f'blob {len(raw)}\0'.encode('ascii') + raw).hexdigest()
              return text, blob

          pull = api(f'/pulls/{number}')
          live_head = pull.get('head', {}).get('sha', '').lower()
          if pull.get('state') != 'open':
              raise SystemExit('audit requires an open pull request')
          if live_head != expected_head:
              raise SystemExit('pull request head moved after event identity was recorded')
          if pull.get('head', {}).get('repo', {}).get('full_name') != repository:
              raise SystemExit('audit accepts only same-repository pull request heads')
          if pull.get('base', {}).get('ref') != 'main':
              raise SystemExit('audit accepts only pull requests targeting main')

          commit = api(f'/git/commits/{expected_head}')
          candidate_tree_sha = commit.get('tree', {}).get('sha', '').lower()
          if re.fullmatch(r'[0-9a-f]{40}', candidate_tree_sha) is None:
              raise SystemExit('candidate commit does not expose an exact tree SHA')
          candidate_tree = api(f'/git/trees/{candidate_tree_sha}?recursive=1')
          if candidate_tree.get('truncated') is True:
              raise SystemExit('candidate tree enumeration is truncated')
          tree_entries = {
              item.get('path'): item
              for item in candidate_tree.get('tree', [])
              if isinstance(item, dict) and isinstance(item.get('path'), str)
          }
          for path, expected_blob in pins.items():
              entry = tree_entries.get(path)
              if not isinstance(entry, dict):
                  raise SystemExit(f'pinned control-plane path missing from candidate tree: {path}')
              if entry.get('type') != 'blob' or entry.get('mode') != '100644':
                  raise SystemExit(
                      f'pinned control-plane path must be a regular non-symlink blob: {path}: '
                      f'type={entry.get("type")!r} mode={entry.get("mode")!r}'
                  )
              if entry.get('sha', '').lower() != expected_blob:
                  raise SystemExit(
                      f'pinned control-plane tree entry drift: {path}: '
                      f'{entry.get("sha")!r} != {expected_blob}'
                  )

          changed_files = pull.get('changed_files')
          if not isinstance(changed_files, int) or changed_files < 0 or changed_files > 3000:
              raise SystemExit('invalid or over-cap changed-files count')

          changed = []
          page = 1
          while True:
              batch = api(f'/pulls/{number}/files?per_page=100&page={page}')
              for item in batch:
                  filename = item.get('filename', '')
                  if isinstance(filename, str) and filename:
                      changed.append(filename)
                  previous = item.get('previous_filename')
                  if isinstance(previous, str) and previous:
                      changed.append(previous)
              if len(batch) < 100:
                  break
              page += 1
          if len({path for path in changed if path}) < changed_files:
              raise SystemExit('changed-files enumeration is incomplete')

          protected_audit = '.github/workflows/merge-authority-audit.yml'
          retired_provenance = '.github/workflows/extraction-provenance.yml'
          touches_control_plane = any(
              path == protected_audit
              or path == retired_provenance
              or path in pins
              or path.startswith('.github/workflows/')
              or path.startswith(governance_prefix)
              for path in changed
          )
          if not touches_control_plane:
              print('No Atlas merge-authority control-plane paths changed; protected-base audit not applicable.')
              raise SystemExit(0)

          if protected_audit in changed:
              raise SystemExit(
                  'candidate modifies the protected-base audit itself; require explicit owner-authorized '
                  'audit rotation and independent deep review before integration'
              )
          if retired_provenance in changed:
              raise SystemExit('separate provenance-gate workflow is retired and may not be restored')

          unpinned_governance = sorted({
              path for path in changed
              if path.startswith(governance_prefix) and path not in pins
          })
          if unpinned_governance:
              raise SystemExit(
                  'candidate adds or mutates unpinned Python import authority beside the pinned provenance '
                  f'verifier: {unpinned_governance!r}'
              )

          texts = {}
          for path, expected_blob in pins.items():
              text, actual_blob = read_candidate_text(path)
              if actual_blob != expected_blob:
                  raise SystemExit(
                      f'candidate protected path does not match protected-base approved blob: {path}: '
                      f'expected {expected_blob}, got {actual_blob}'
                  )
              texts[path] = text

          gate = texts['.github/workflows/merge-group-gate.yml']
          verifier = texts['tools/governance/verify_extraction_provenance.py']

          required_gate = (
              '  merge_group:\n    types: [checks_requested]\n',
              '    name: atlas-gate\n',
              'name: Check out exact protected merge-group base',
              'path: trusted-base',
              "catalog.groups?.['e2e.full']?.specs",
              "ATLAS_E2E_WORKERS: '1'",
              "ATLAS_E2E_SHARD: '1/1'",
              '--retries=0',
              'compose run --no-deps --rm e2e',
          )
          for fragment in required_gate:
              if fragment not in gate:
                  raise SystemExit(f'candidate merge-group gate missing protected fragment: {fragment}')
          for forbidden in (
              'continue-on-error:',
              'workflow_dispatch:',
              'pull_request_target:',
              'contents: write',
              'actions: write',
              'checks: write',
              'pull-requests: write',
              'statuses: write',
              'id-token: write',
          ):
              if forbidden in gate:
                  raise SystemExit(f'candidate merge-group gate contains forbidden behavior: {forbidden}')

          required_verifier = (
              'SOURCE_REPOSITORY = "https://github.com/blakinio/Otheryn.git"',
              'SOURCE_PREFIXES = ("tools/otbm_atlas/", "tools/otbm_atlas_facts/", ".github/workflows/otbm-atlas-")',
              'MERGE_GROUP_GATE_PATH = ".github/workflows/merge-group-gate.yml"',
              f'MERGE_GROUP_GATE_BLOB = "{pins[".github/workflows/merge-group-gate.yml"]}"',
              'verify_control_plane_pin(MERGE_GROUP_GATE_PATH, MERGE_GROUP_GATE_BLOB)',
              'verify_source_coverage(rows, source_root, source_sha)',
              'fetch_pinned_source(source_sha, source_root)',
          )
          for fragment in required_verifier:
              if fragment not in verifier:
                  raise SystemExit(f'candidate provenance verifier missing protected fragment: {fragment}')

          workflow_listing = api(f'/contents/.github/workflows?ref={expected_head}')
          atlas_gate_paths = set()
          provenance_gate_paths = set()
          status_line = re.compile(r'^\s*name:\s*[\'\"]?atlas-gate[\'\"]?\s*$', re.MULTILINE)
          provenance_line = re.compile(r'^\s*name:\s*[\'\"]?provenance-gate[\'\"]?\s*$', re.MULTILINE)
          for item in workflow_listing:
              path = item.get('path', '')
              if not isinstance(path, str) or not path.endswith(('.yml', '.yaml')):
                  continue
              text, _ = read_candidate_text(path)
              if status_line.search(text):
                  atlas_gate_paths.add(path)
              if provenance_line.search(text):
                  provenance_gate_paths.add(path)

          expected_atlas_gate_paths = {
              '.github/workflows/ci.yml',
              '.github/workflows/merge-group-gate.yml',
          }
          if atlas_gate_paths != expected_atlas_gate_paths:
              raise SystemExit(
                  f'atlas-gate must be emitted only by canonical PR and merge-group workflows: '
                  f'{sorted(atlas_gate_paths)!r}'
              )
          if provenance_gate_paths:
              raise SystemExit(f'separate provenance-gate status is retired: {sorted(provenance_gate_paths)!r}')

          print(
              f'Protected-base Atlas merge-authority audit PASS for PR #{number} exact head '
              f'{expected_head}; pinned_paths={len(pins)}.'
          )
          PY

````

## `.github/workflows/merge-group-gate.yml`

````text
name: Atlas Merge Queue gate

on:
  merge_group:
    types: [checks_requested]

permissions:
  contents: read
  actions: read
  pull-requests: read

concurrency:
  group: atlas-merge-group-${{ github.event.merge_group.head_sha }}
  cancel-in-progress: true

env:
  ATLAS_CANDIDATE_IMAGE: mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07

jobs:
  candidate-checks:
    name: merge-group-candidate-checks
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - name: Check out exact merge-group candidate for isolated candidate checks
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.merge_group.head_sha }}
          fetch-depth: 0
          persist-credentials: false

      - name: Validate candidate range and inert repository contract
        shell: bash
        env:
          BASE_SHA: ${{ github.event.merge_group.base_sha }}
          HEAD_SHA: ${{ github.event.merge_group.head_sha }}
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$HEAD_SHA"
          git cat-file -e "${BASE_SHA}^{commit}"
          git diff --check "$BASE_SHA" "$HEAD_SHA"
          test -s README.md
          test -s AGENTS.md
          test -s SECURITY.md
          test -s .github/CODEOWNERS
          test -s web/proof/semantic/manifest.json
          test -s web/proof/pixels/manifest.json
          test -s web/proof/pixels/pack.rgba
          test -s docs/migration/legacy-atlas-extraction-provenance.json
          test -s tools/governance/verify_extraction_provenance.py
          if find . -type f \( -name '*.otbm' -o -name '*.otb' -o -name '*.spr' -o -name '*.dat' \) -print -quit | grep -q .; then
            echo 'Forbidden raw legacy/proprietary runtime input committed to repository.' >&2
            exit 1
          fi
          if grep -R --line-number --include='*.ts' --include='*.js' --include='*.mjs' --include='*.svelte' -E '(\.otbm|Legacy IR|world\.otbm)' src web 2>/dev/null; then
            echo 'Browser source must not reference legacy world formats.' >&2
            exit 1
          fi
          test ! -f package.json || { echo 'Root package.json requires a separately reviewed isolated dependency-install contract.' >&2; exit 1; }

      - name: Run candidate executable contracts in networkless sandbox
        shell: bash
        env:
          ATLAS_CODE_REVISION: ${{ github.event.merge_group.head_sha }}
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$ATLAS_CODE_REVISION"
          timeout --signal=KILL 600s docker run --rm \
            --network none \
            --read-only \
            --cap-drop ALL \
            --security-opt no-new-privileges \
            --pids-limit 256 \
            --memory 2g \
            --cpus 2 \
            --user 1000:1000 \
            --tmpfs /tmp:rw,nosuid,nodev,size=256m \
            --mount "type=bind,src=$PWD,dst=/candidate,readonly" \
            "$ATLAS_CANDIDATE_IMAGE" \
            bash -lc '
              set -euo pipefail
              mkdir -p /tmp/bin /tmp/pycache
              ln -s /usr/bin/python3 /tmp/bin/python
              export PATH="/tmp/bin:$PATH" PYTHONPYCACHEPREFIX=/tmp/pycache
              cd /candidate
              python -m py_compile \
                tools/dyn-atlas-semantic/compiler.py \
                tools/dyn-atlas-semantic/verify.py \
                tools/dyn-atlas-semantic/self_test.py \
                tools/dyn-atlas-semantic/benchmark.py \
                tools/dyn-atlas-pixels/measure_metadata.py \
                tools/dyn-atlas-pixels/publish_store.py
              python tools/dyn-atlas-semantic/self_test.py
              files=(
                tests/animation-runtime.mjs
                tests/browser-semantic.mjs
                tests/deployment-policy.mjs
                tests/creature-presentation-geometry.mjs
                tests/creature-interaction.mjs
                tests/creature-interaction-target.mjs
                tests/map-activation.mjs
                tests/creature-map-activation-contract.mjs
                tests/creature-interaction-runtime-contract.mjs
                tests/creature-gameplay-profiles.mjs
                tests/creature-inspector-state.mjs
                tests/creature-gameplay-model.mjs
                tests/creature-gameplay-runtime-contract.mjs
                tests/gui-contract.mjs
                tests/npc-markers.mjs
                tests/pixel-store.mjs
                tests/semantic-search.mjs
                tests/semantic-search-creatures.mjs
                tests/synology-live-workflow.mjs
                tests/fullworld-layers/*.test.mjs
                tests/fullworld-runtime/*.test.mjs
                tests/properties/*.test.mjs
                tests/verification/*.test.mjs
              )
              node --test "${files[@]}"
            '

      - name: Run real Chrome WebGL2 parity and GUI smoke
        shell: bash
        run: |
          set -euo pipefail
          CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)"
          test -n "$CHROME"
          python -m http.server 8765 --bind 127.0.0.1 >/tmp/atlas-http.log 2>&1 &
          SERVER_PID=$!
          trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
          for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:8765/tests/browser-proof.html >/dev/null && break; sleep 1; done
          rm -rf /tmp/chrome-browser-proof /tmp/chrome-app-proof /tmp/chrome-shot-proof
          "$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=1 --window-size=800,600 --virtual-time-budget=30000 --user-data-dir=/tmp/chrome-browser-proof --dump-dom http://127.0.0.1:8765/tests/browser-proof.html > /tmp/browser-proof.html
          grep -q 'data-status="PASS"' /tmp/browser-proof.html
          test "$(grep -c '"maxAbs": 0' /tmp/browser-proof.html)" -eq 5
          "$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage --use-angle=swiftshader --enable-unsafe-swiftshader --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=30000 --user-data-dir=/tmp/chrome-app-proof --dump-dom 'http://127.0.0.1:8765/web/index.html?x=32377&y=32238&floor=-7&zoom=2' > /tmp/app-dom.html
          grep -q 'VERIFIED' /tmp/app-dom.html
          grep -q 'WEBGL2' /tmp/app-dom.html
          grep -q '>30 / 30<' /tmp/app-dom.html
          grep -q '<strong id="diag-draws">1</strong>' /tmp/app-dom.html
          "$CHROME" --headless=new --no-sandbox --disable-dev-shm-usage --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --force-device-scale-factor=1 --window-size=1920,1080 --virtual-time-budget=30000 --user-data-dir=/tmp/chrome-shot-proof --screenshot=/tmp/gui.png 'http://127.0.0.1:8765/web/index.html?x=32377&y=32238&floor=-7&zoom=2'
          python - <<'PY'
          import struct
          from pathlib import Path
          data = Path('/tmp/gui.png').read_bytes()
          assert data[:8] == b'\x89PNG\r\n\x1a\n'
          assert struct.unpack('>II', data[16:24]) == (1920, 1080)
          PY

  atlas-gate:
    name: atlas-gate
    needs: candidate-checks
    if: ${{ always() }}
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    steps:
      - name: Require isolated candidate checks to pass
        shell: bash
        env:
          CANDIDATE_CHECKS_RESULT: ${{ needs.candidate-checks.result }}
        run: |
          set -euo pipefail
          [[ "$CANDIDATE_CHECKS_RESULT" == success ]]

      - name: Validate exact merge-group identity
        shell: bash
        env:
          EVENT_NAME: ${{ github.event_name }}
          EVENT_ACTION: ${{ github.event.action }}
          BASE_REF: ${{ github.event.merge_group.base_ref || '' }}
          BASE_SHA: ${{ github.event.merge_group.base_sha || '' }}
          HEAD_SHA: ${{ github.event.merge_group.head_sha || '' }}
          GITHUB_SHA_VALUE: ${{ github.sha }}
        run: |
          set -euo pipefail
          [[ "$EVENT_NAME" == merge_group ]]
          [[ "$EVENT_ACTION" == checks_requested ]]
          [[ "$BASE_REF" == refs/heads/main ]]
          [[ "$BASE_SHA" =~ ^[0-9a-f]{40}$ ]]
          [[ "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]]
          [[ "$HEAD_SHA" == "$GITHUB_SHA_VALUE" ]]
          [[ "$HEAD_SHA" != "$BASE_SHA" ]]

      - name: Check out exact merge-group candidate
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.merge_group.head_sha }}
          fetch-depth: 0
          persist-credentials: false

      - name: Verify exact pinned extraction provenance
        shell: bash
        run: |
          set -euo pipefail
          python -m py_compile tools/governance/verify_extraction_provenance.py tools/governance/test_verify_extraction_provenance.py
          python tools/governance/test_verify_extraction_provenance.py
          python tools/governance/verify_extraction_provenance.py

      - name: Check out exact protected merge-group base
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.merge_group.base_sha }}
          fetch-depth: 0
          persist-credentials: false
          path: trusted-base

      - name: Validate one-shot PR 303 merge-group bootstrap proof
        id: legacy-bootstrap
        shell: bash
        env:
          GH_TOKEN: ${{ github.token }}
          ATLAS_CODE_REVISION: ${{ github.event.merge_group.head_sha }}
          ATLAS_PROTECTED_BASE_SHA: ${{ github.event.merge_group.base_sha }}
          ATLAS_MERGE_GROUP_HEAD_REF: ${{ github.event.merge_group.head_ref || '' }}
          ATLAS_LEGACY_CUTOVER_BASE_SHA: e31015d0880e9f81a4b96f990658490af45e8fa6
          ATLAS_LEGACY_CUTOVER_PR_NUMBER: '303'
          ATLAS_LEGACY_CUTOVER_HEAD_REF: feat/issue-179-legacy-transition-qualifier
        run: |
          set -euo pipefail
          printf 'use_legacy_proof=false\n' >> "$GITHUB_OUTPUT"
          expected_queue_ref="refs/heads/gh-readonly-queue/main/pr-$ATLAS_LEGACY_CUTOVER_PR_NUMBER-$ATLAS_LEGACY_CUTOVER_BASE_SHA"
          if [[ "$ATLAS_PROTECTED_BASE_SHA" != "$ATLAS_LEGACY_CUTOVER_BASE_SHA" \
            || "$ATLAS_MERGE_GROUP_HEAD_REF" != "$expected_queue_ref" ]]; then
            exit 0
          fi
          test "$GITHUB_REPOSITORY" = Oteryn/Oteryn-Atlas
          work="$RUNNER_TEMP/atlas-merge-group-legacy-bootstrap"
          rm -rf "$work"
          mkdir -p "$work"
          live_pr="$work/live-pr.json"
          changed_files="$work/changed-files.txt"
          synthetic_commit="$work/synthetic-commit.json"
          candidate_commit="$work/candidate-commit.json"
          gh api "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_LEGACY_CUTOVER_PR_NUMBER" > "$live_pr"
          candidate_head_sha="$(jq -r '.head.sha' "$live_pr")"
          [[ "$candidate_head_sha" =~ ^[0-9a-f]{40}$ ]]
          gh api "repos/$GITHUB_REPOSITORY/git/commits/$ATLAS_CODE_REVISION" > "$synthetic_commit"
          gh api "repos/$GITHUB_REPOSITORY/git/commits/$candidate_head_sha" > "$candidate_commit"
          current_main_sha="$(gh api "repos/$GITHUB_REPOSITORY/branches/main" --jq '.commit.sha')"
          [[ "$current_main_sha" =~ ^[0-9a-f]{40}$ ]]
          gh api --paginate "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_LEGACY_CUTOVER_PR_NUMBER/files?per_page=100" \
            --jq '.[].filename' | sort > "$changed_files"
          runs="$work/legacy-transition-runs.json"
          gh api "repos/$GITHUB_REPOSITORY/actions/workflows/legacy-molehill-transition-qualification.yml/runs?event=pull_request&branch=$ATLAS_LEGACY_CUTOVER_HEAD_REF&per_page=100" > "$runs"
          mapfile -t legacy_run_ids < <(node --input-type=module - "$runs" "$candidate_head_sha" <<'NODE'
          import fs from 'node:fs';
          const [runsPath, candidateHeadSha] = process.argv.slice(2);
          const runs = JSON.parse(fs.readFileSync(runsPath, 'utf8')).workflow_runs ?? [];
          const ids = runs
            .filter((run) => run.status === 'completed'
              && run.path === '.github/workflows/legacy-molehill-transition-qualification.yml'
              && run.event === 'pull_request'
              && run.head_branch === process.env.ATLAS_LEGACY_CUTOVER_HEAD_REF
              && run.head_sha === candidateHeadSha
              && run.repository?.full_name === process.env.GITHUB_REPOSITORY
              && Number(run.run_attempt) === 1)
            .map((run) => Number(run.id))
            .filter((id) => Number.isSafeInteger(id) && id > 0)
            .sort((left, right) => right - left);
          for (const id of ids) process.stdout.write(`${id}\n`);
          NODE
          )
          selected_legacy_run=''
          for legacy_run_id in "${legacy_run_ids[@]}"; do
            run_json="$work/run-$legacy_run_id.json"
            jobs_json="$work/jobs-$legacy_run_id.json"
            gh api "repos/$GITHUB_REPOSITORY/actions/runs/$legacy_run_id" > "$run_json"
            gh api "repos/$GITHUB_REPOSITORY/actions/runs/$legacy_run_id/jobs?per_page=100" > "$jobs_json"
            if CURRENT_MAIN_SHA="$current_main_sha" node --input-type=module - \
              "$run_json" "$jobs_json" "$live_pr" "$changed_files" "$synthetic_commit" "$candidate_commit" <<'NODE'
          import fs from 'node:fs';
          import { validateLegacyTransitionMergeGroupBootstrapGate } from './tools/verification/protected-hosted-gate.mjs';
          const [runPath, jobsPath, livePrPath, changedFilesPath, syntheticPath, candidatePath] = process.argv.slice(2);
          const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
          const changedFiles = fs.readFileSync(changedFilesPath, 'utf8').split(/\r?\n/).filter(Boolean);
          const result = validateLegacyTransitionMergeGroupBootstrapGate({
            producerRun: read(runPath),
            producerJobs: read(jobsPath),
            livePr: read(livePrPath),
            changedFiles,
            expectedRepository: process.env.GITHUB_REPOSITORY,
            expectedPrNumber: Number(process.env.ATLAS_LEGACY_CUTOVER_PR_NUMBER),
            expectedProtectedBaseSha: process.env.ATLAS_PROTECTED_BASE_SHA,
            expectedSyntheticHeadSha: process.env.ATLAS_CODE_REVISION,
            currentMainSha: process.env.CURRENT_MAIN_SHA,
            mergeGroup: {
              baseRef: 'refs/heads/main',
              baseSha: process.env.ATLAS_PROTECTED_BASE_SHA,
              headRef: process.env.ATLAS_MERGE_GROUP_HEAD_REF,
              headSha: process.env.ATLAS_CODE_REVISION,
            },
            syntheticCommit: read(syntheticPath),
            candidateCommit: read(candidatePath),
          });
          process.stdout.write(`${JSON.stringify(result)}\n`);
          NODE
            then
              selected_legacy_run="$legacy_run_id"
              break
            fi
          done
          [[ "$selected_legacy_run" =~ ^[1-9][0-9]*$ ]]
          printf 'use_legacy_proof=true\nproducer_run_id=%s\n' "$selected_legacy_run" >> "$GITHUB_OUTPUT"

      - name: Validate exact protected qualification repair bootstrap evidence
        id: qualification-repair
        shell: bash
        env:
          GH_TOKEN: ${{ github.token }}
          ATLAS_CODE_REVISION: ${{ github.event.merge_group.head_sha }}
          ATLAS_PROTECTED_BASE_SHA: ${{ github.event.merge_group.base_sha }}
          ATLAS_MERGE_GROUP_HEAD_REF: ${{ github.event.merge_group.head_ref || '' }}
        run: |
          set -euo pipefail
          printf 'use_repair_proof=false\n' >> "$GITHUB_OUTPUT"
          if [[ ! "$ATLAS_MERGE_GROUP_HEAD_REF" =~ ^refs/heads/gh-readonly-queue/main/pr-([1-9][0-9]*)- ]]; then
            exit 0
          fi
          ATLAS_PR_NUMBER="${BASH_REMATCH[1]}"
          export ATLAS_PR_NUMBER
          work="$RUNNER_TEMP/atlas-merge-group-qualification-repair"
          rm -rf "$work" && mkdir -p "$work"
          gh api "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_PR_NUMBER" > "$work/live-pr.json"
          candidate_head_sha="$(jq -er '.head.sha' "$work/live-pr.json")"
          candidate_base_sha="$(jq -er '.base.sha' "$work/live-pr.json")"
          test "$candidate_base_sha" = "$ATLAS_PROTECTED_BASE_SHA"
          current_main_sha="$(gh api "repos/$GITHUB_REPOSITORY/branches/main" --jq '.commit.sha')"
          test "$current_main_sha" = "$ATLAS_PROTECTED_BASE_SHA"
          gh api --paginate --slurp "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_PR_NUMBER/files?per_page=100" > "$work/file-pages.json"
          jq '[.[][] | {path: .filename, previousPath: (.previous_filename // null)}]' "$work/file-pages.json" > "$work/changes.json"
          jq -r '.[] | [.path, .previousPath] | .[] | select(. != null)' "$work/changes.json" | sort -u > "$work/changed-files.txt"
          gh api "repos/$GITHUB_REPOSITORY/git/commits/$ATLAS_CODE_REVISION" > "$work/synthetic-commit.json"
          gh api "repos/$GITHUB_REPOSITORY/git/commits/$candidate_head_sha" > "$work/candidate-commit.json"
          synthetic_tree_sha="$(jq -er '.tree.sha' "$work/synthetic-commit.json")"
          candidate_tree_sha="$(jq -er '.tree.sha' "$work/candidate-commit.json")"
          test "$synthetic_tree_sha" = "$candidate_tree_sha"
          jq -e --arg base "$ATLAS_PROTECTED_BASE_SHA" '.parents | any(.sha == $base)' "$work/synthetic-commit.json" >/dev/null

          # This narrowly bootstraps the control-plane fix itself, and retires as
          # soon as protected main no longer has the one-region/one-search fixture.
          if CHANGES="$work/changed-files.txt" node --input-type=module <<'NODE'
          import crypto from 'node:crypto';
          import fs from 'node:fs';
          import { QUALIFICATION_CREATURES, QUALIFICATION_FIXTURE_ID, QUALIFICATION_SEMANTIC_RECORD } from './trusted-base/tools/verification/qualification-fixture-definition.mjs';
          import { validateQualificationRepairControlPlaneBootstrap } from './trusted-base/tools/verification/qualification-repair-policy.mjs';
          const changedPaths = fs.readFileSync(process.env.CHANGES, 'utf8').trim().split(/\r?\n/).filter(Boolean);
          const regions = new Set(QUALIFICATION_CREATURES.map(({ position }) => `${Math.floor(position.x / 32)}:${Math.floor(position.y / 32)}:${position.floor}`));
          validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: { fixtureId: QUALIFICATION_FIXTURE_ID, creatureCount: QUALIFICATION_CREATURES.length, creatureRegionCount: regions.size, semanticRecordCount: QUALIFICATION_SEMANTIC_RECORD ? 1 : 0 } });
          const read = (root, relative) => fs.readFileSync(`${root}/${relative}`, 'utf8');
          const blob = (text) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(text)}\0`), Buffer.from(text)])).digest('hex');
          const exactOne = (text, expression, label) => { const matches = text.match(expression) ?? []; if (matches.length !== 1) throw new TypeError(`${label} must occur exactly once`); return matches[0]; };
          const gateText = read('.', '.github/workflows/merge-group-gate.yml');
          const verifierProtected = read('trusted-base', 'tools/governance/verify_extraction_provenance.py');
          const verifierCandidate = read('.', 'tools/governance/verify_extraction_provenance.py');
          const auditProtected = read('trusted-base', '.github/workflows/merge-authority-audit.yml');
          const auditCandidate = read('.', '.github/workflows/merge-authority-audit.yml');
          const gateBlob = blob(gateText);
          const oldVerifierPin = exactOne(verifierProtected, /MERGE_GROUP_GATE_BLOB = "[0-9a-f]{40}"/g, 'protected verifier gate pin');
          const expectedVerifier = verifierProtected.replace(oldVerifierPin, `MERGE_GROUP_GATE_BLOB = "${gateBlob}"`);
          if (verifierCandidate !== expectedVerifier) throw new TypeError('candidate provenance verifier is not an exact gate-pin rotation');
          const verifierBlob = blob(verifierCandidate);
          const oldAuditGate = exactOne(auditProtected, /EXPECTED_MERGE_GROUP_GATE_BLOB: "[0-9a-f]{40}"/g, 'protected audit gate pin');
          const oldAuditVerifier = exactOne(auditProtected, /EXPECTED_PROVENANCE_VERIFIER_BLOB: "[0-9a-f]{40}"/g, 'protected audit verifier pin');
          const expectedAudit = auditProtected.replace(oldAuditGate, `EXPECTED_MERGE_GROUP_GATE_BLOB: "${gateBlob}"`).replace(oldAuditVerifier, `EXPECTED_PROVENANCE_VERIFIER_BLOB: "${verifierBlob}"`);
          if (auditCandidate !== expectedAudit) throw new TypeError('candidate merge authority audit is not an exact pin rotation');
          NODE
          then
            printf 'use_repair_proof=true\nproof_mode=self-retiring-control-plane-bootstrap\n' >> "$GITHUB_OUTPUT"
            exit 0
          fi

          gh api "repos/$GITHUB_REPOSITORY/commits/$candidate_head_sha/status" > "$work/statuses.json"
          repair_status_count="$(jq '[.statuses[] | select(.context == "atlas-protected-product-qualification")] | length' "$work/statuses.json")"
          if test "$repair_status_count" = 0; then
            exit 0
          fi
          test "$repair_status_count" = 1
          jq -e '[.statuses[] | select(.context == "atlas-protected-product-qualification" and .state == "success")] | length == 1' "$work/statuses.json" >/dev/null
          jq '[.statuses[] | select(.context == "atlas-protected-product-qualification")][0]' "$work/statuses.json" > "$work/status.json"
          target_url="$(jq -er '.target_url' "$work/status.json")"
          [[ "$target_url" =~ ^https://github.com/$GITHUB_REPOSITORY/actions/runs/([1-9][0-9]*)$ ]]
          producer_run_id="${BASH_REMATCH[1]}"
          gh api "repos/$GITHUB_REPOSITORY/actions/runs/$producer_run_id" > "$work/run.json"
          gh api "repos/$GITHUB_REPOSITORY/actions/runs/$producer_run_id/jobs?per_page=100" > "$work/jobs.json"
          MERGE_BASE_SHA="$(git merge-base "$candidate_head_sha" "$ATLAS_PROTECTED_BASE_SHA")" node --input-type=module - "$work" <<'NODE'
          import fs from 'node:fs';
          import { buildVerificationPlan } from './trusted-base/tools/verification/build-verification-plan.mjs';
          import { validateProtectedProductQualificationGate } from './trusted-base/tools/verification/protected-hosted-gate.mjs';
          import { validateQualificationRepairTransition } from './trusted-base/tools/verification/qualification-repair-policy.mjs';
          const work = process.argv[2];
          const read = (name) => JSON.parse(fs.readFileSync(`${work}/${name}`, 'utf8'));
          const livePr = read('live-pr.json');
          const changes = read('changes.json');
          const changedPaths = [...new Set(changes.flatMap(({ path, previousPath }) => [path, previousPath].filter(Boolean)))].sort();
          const trustedImpact = JSON.parse(fs.readFileSync('./trusted-base/tools/verification/impact-manifest.json'));
          const candidateImpact = JSON.parse(fs.readFileSync('./tools/verification/impact-manifest.json'));
          const trustedCatalog = JSON.parse(fs.readFileSync('./trusted-base/tools/verification/verification-catalog.json'));
          const candidateCatalog = JSON.parse(fs.readFileSync('./tools/verification/verification-catalog.json'));
          const common = {
            repository: process.env.GITHUB_REPOSITORY,
            headSha: livePr.head.sha,
            integrationBaseSha: process.env.ATLAS_PROTECTED_BASE_SHA,
            mergeBaseSha: process.env.MERGE_BASE_SHA,
            changedFiles: changes,
            requiredGroupFloor: ['deterministic.core', 'e2e.full'],
          };
          const protectedPlan = buildVerificationPlan({ ...common, trustedImpactManifest: trustedImpact, candidateImpactManifest: trustedImpact, trustedVerificationCatalog: trustedCatalog, candidateVerificationCatalog: trustedCatalog });
          const candidatePlan = buildVerificationPlan({ ...common, trustedImpactManifest: trustedImpact, candidateImpactManifest: candidateImpact, trustedVerificationCatalog: trustedCatalog, candidateVerificationCatalog: candidateCatalog });
          validateQualificationRepairTransition({ changedPaths, protectedPlan, candidatePlan });
          validateProtectedProductQualificationGate({
            livePr,
            status: read('status.json'),
            producerRun: read('run.json'),
            producerJobs: read('jobs.json'),
            expectedRepository: process.env.GITHUB_REPOSITORY,
            expectedPrNumber: Number(process.env.ATLAS_PR_NUMBER),
            expectedCandidateHeadSha: livePr.head.sha,
            expectedProtectedBaseSha: process.env.ATLAS_PROTECTED_BASE_SHA,
          });
          const syntheticCommit = read('synthetic-commit.json');
          const candidateCommit = read('candidate-commit.json');
          const syntheticTreeSha = syntheticCommit.tree?.sha;
          const candidateTreeSha = candidateCommit.tree?.sha;
          if (syntheticTreeSha !== candidateTreeSha) throw new TypeError('merge-group synthetic tree is not exact candidate tree');
          NODE
          printf 'use_repair_proof=true\nproof_mode=protected-full-e2e-census\nproducer_run_id=%s\n' "$producer_run_id" >> "$GITHUB_OUTPUT"

      - name: Prove complete protected-base browser qualification for synthetic candidate
        if: ${{ steps.legacy-bootstrap.outputs.use_legacy_proof != 'true' && steps.qualification-repair.outputs.use_repair_proof != 'true' }}
        shell: bash
        env:
          ATLAS_CODE_REVISION: ${{ github.event.merge_group.head_sha }}
          ATLAS_PROTECTED_BASE_SHA: ${{ github.event.merge_group.base_sha }}
          ATLAS_E2E_WORKERS: '1'
          ATLAS_E2E_SHARD: '1/1'
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$ATLAS_CODE_REVISION"
          test "$(git -C trusted-base rev-parse HEAD)" = "$ATLAS_PROTECTED_BASE_SHA"
          grep -Fq -- '--retries=0' trusted-base/e2e/compose.protected-hosted-executor.yml

          npm ci --prefix trusted-base/e2e --ignore-scripts --no-audit --no-fund
          protected_list="$RUNNER_TEMP/atlas-merge-group-protected-list.txt"
          qualification_list="$RUNNER_TEMP/atlas-merge-group-qualification-list.txt"
          (
            cd trusted-base
            ATLAS_ARTIFACTS_DIR="$RUNNER_TEMP/atlas-merge-group-list-artifacts" \
              npm exec --prefix e2e -- playwright test --config=e2e/playwright.config.mjs --list
          ) > "$protected_list"

          PROTECTED_LIST="$protected_list" QUALIFICATION_LIST="$qualification_list" node --input-type=module <<'NODE'
          import fs from 'node:fs';
          const catalog = JSON.parse(fs.readFileSync('./trusted-base/tools/verification/verification-catalog.json', 'utf8'));
          const specs = new Set(catalog.groups?.['e2e.full']?.specs ?? []);
          if (!specs.size) throw new TypeError('protected e2e.full qualification catalog is empty');
          const rows = fs.readFileSync(process.env.PROTECTED_LIST, 'utf8').split(/\r?\n/);
          const selected = [];
          for (const line of rows) {
            const match = line.match(/^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/);
            if (!match) continue;
            const spec = `e2e/tests/${match[2]}`;
            if (specs.has(spec)) selected.push(line.trim());
          }
          if (!selected.length) throw new TypeError('protected e2e.full qualification selection is empty');
          fs.writeFileSync(process.env.QUALIFICATION_LIST, `${selected.join('\n')}\n`, 'utf8');
          NODE
          test -s "$qualification_list"

          source_root="$RUNNER_TEMP/atlas-merge-group-qualification-world"
          trust_path="$RUNNER_TEMP/atlas-merge-group-qualification-trust.json"
          rm -rf "$source_root"
          SOURCE_ROOT="$source_root" TRUST_PATH="$trust_path" node --input-type=module <<'NODE'
          import fs from 'node:fs';
          import { buildQualificationWorld, qualificationTrustDescriptor, verifyQualificationWorld } from './trusted-base/tools/verification/qualification-world.mjs';
          await buildQualificationWorld(process.env.SOURCE_ROOT);
          const verified = await verifyQualificationWorld(process.env.SOURCE_ROOT);
          fs.writeFileSync(process.env.TRUST_PATH, `${JSON.stringify(qualificationTrustDescriptor(verified))}\n`, 'utf8');
          NODE
          test -s "$trust_path"

          execution_context="$RUNNER_TEMP/atlas-merge-group-execution-context"
          artifacts="$RUNNER_TEMP/atlas-merge-group-browser-artifacts"
          rm -rf "$execution_context" "$artifacts"
          mkdir -p "$execution_context" "$artifacts"
          rsync -a --delete --exclude='.git' --exclude='trusted-base' ./ "$execution_context/"
          for path in web src; do
            test -d "$execution_context/$path"
            test ! -L "$execution_context/$path"
          done
          rm -rf "$execution_context/e2e"
          cp -a trusted-base/e2e "$execution_context/e2e"
          rm -rf "$execution_context/e2e/node_modules"
          rm -f "$execution_context/.dockerignore" "$execution_context/e2e/Dockerfile.dockerignore"
          mkdir -p "$execution_context/tools/verification"
          cp trusted-base/tools/verification/stable-id.mjs "$execution_context/tools/verification/stable-id.mjs"

          digest() {
            printf '%s' "$1" | sha256sum | awk '{print "sha256:" $1}'
          }
          export ATLAS_PLAN_SEMANTIC_DIGEST="$(digest "merge-group-semantic:$ATLAS_CODE_REVISION")"
          export ATLAS_PLAN_INSTANCE_DIGEST="$(digest "merge-group-instance:$ATLAS_PROTECTED_BASE_SHA:$ATLAS_CODE_REVISION")"
          export ATLAS_AUTHORITY_DIGEST="$(digest "merge-group-authority:$ATLAS_PROTECTED_BASE_SHA")"
          export ATLAS_ENVIRONMENT_DIGEST="$(digest 'merge-group-github-hosted-ubuntu-24.04')"
          export ATLAS_QUALIFICATION_PUBLICATION_HOST="$source_root"
          export ATLAS_QUALIFICATION_TRUST_JSON="$(cat "$trust_path")"
          export ATLAS_EXECUTION_CONTEXT="$execution_context"
          export ATLAS_E2E_ARTIFACTS_HOST="$artifacts"
          export ATLAS_PROTECTED_TEST_LIST="$qualification_list"
          export COMPOSE_PROJECT_NAME="atlas-merge-group-$GITHUB_RUN_ID"

          compose() {
            docker compose \
              -f trusted-base/e2e/compose.protected-hosted-executor.yml \
              -f trusted-base/e2e/compose.github-hosted.yml \
              "$@"
          }
          cleanup() {
            compose down -v --remove-orphans >/dev/null 2>&1 || true
          }
          trap cleanup EXIT
          compose config -q
          compose up -d --wait atlas-publication atlas-web
          compose run --no-deps --rm e2e

````

## `.github/workflows/protected-qualification-repair.yml`

````text
name: Protected qualification repair

on:
  pull_request_target:
    types: [opened, synchronize, reopened]
    paths:
      - src/browser/animation-runtime-service.mjs
      - src/browser/fullworld-trust.mjs
      - src/browser/semantic-search.mjs
      - tools/verification/qualification-fixture-definition.mjs
      - tools/verification/qualification-world.mjs
      - web/fullworld-app.mjs
      - web/fullworld-creatures.mjs
      - web/fullworld-farm-explorer.mjs
      - web/fullworld-search.mjs
      - tools/verification/protected-hosted-product-identities.json
      - tests/verification/protected-hosted-product-identities.test.mjs

permissions:
  contents: read

concurrency:
  group: atlas-protected-qualification-repair-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  qualification-repair:
    name: Protected qualification repair
    if: >-
      github.event.pull_request.base.ref == 'main' &&
      github.event.pull_request.base.repo.full_name == github.repository &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-24.04
    timeout-minutes: 30
    permissions:
      contents: read
      pull-requests: read
      statuses: write
    env:
      GH_TOKEN: ${{ github.token }}
      ATLAS_PR_NUMBER: ${{ github.event.pull_request.number }}
      ATLAS_CODE_REVISION: ${{ github.event.pull_request.head.sha }}
      ATLAS_BASE_SHA: ${{ github.event.pull_request.base.sha }}
      ATLAS_CHANGED_FILE_COUNT: ${{ github.event.pull_request.changed_files }}
      ATLAS_CANDIDATE_IMAGE: mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07
    steps:
      - name: Check out exact protected-base authority
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.base.sha }}
          persist-credentials: false
          fetch-depth: 0
          path: trusted-base

      - name: Check out exact candidate as untrusted repair data
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.pull_request.head.sha }}
          persist-credentials: false
          fetch-depth: 0
          path: candidate

      - name: Fence exact candidate before admission
        shell: bash
        run: |
          set -euo pipefail
          payload="$RUNNER_TEMP/atlas-qualification-repair-pr-before.json"
          gh api "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_PR_NUMBER" > "$payload"
          node trusted-base/tools/verification/assert-current-pr-head.mjs \
            --payload "$payload" \
            --repository "$GITHUB_REPOSITORY" \
            --pr-number "$ATLAS_PR_NUMBER" \
            --expected-head-sha "$ATLAS_CODE_REVISION"
          test "$(git -C candidate rev-parse HEAD)" = "$ATLAS_CODE_REVISION"
          test "$(git -C trusted-base rev-parse HEAD)" = "$ATLAS_BASE_SHA"

      - name: Admit only exact-scope monotonic qualification repair
        id: admission
        shell: bash
        run: |
          set -euo pipefail
          pages="$RUNNER_TEMP/atlas-qualification-repair-change-pages.json"
          changes="$RUNNER_TEMP/atlas-qualification-repair-changes.json"
          admission="$RUNNER_TEMP/atlas-qualification-repair-admission.json"
          gh api --paginate --slurp \
            "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_PR_NUMBER/files?per_page=100" > "$pages"
          jq '[.[][] | {path: .filename, previousPath: (.previous_filename // null)}]' "$pages" > "$changes"
          test "$(jq 'length' "$changes")" = "$ATLAS_CHANGED_FILE_COUNT"
          merge_base="$(git -C candidate merge-base HEAD "$ATLAS_BASE_SHA")"
          [[ "$merge_base" =~ ^[a-f0-9]{40}$ ]]
          ATLAS_MERGE_BASE_SHA="$merge_base" node --input-type=module - "$changes" "$admission" <<'NODE'
          import fs from 'node:fs';
          import { buildVerificationPlan } from './trusted-base/tools/verification/build-verification-plan.mjs';
          import { validateQualificationRepairTransition } from './trusted-base/tools/verification/qualification-repair-policy.mjs';
          const read = (target) => JSON.parse(fs.readFileSync(target, 'utf8'));
          const [changesPath, outputPath] = process.argv.slice(2);
          const changes = read(changesPath);
          const trustedImpact = read('./trusted-base/tools/verification/impact-manifest.json');
          const candidateImpact = read('./candidate/tools/verification/impact-manifest.json');
          const trustedCatalog = read('./trusted-base/tools/verification/verification-catalog.json');
          const candidateCatalog = read('./candidate/tools/verification/verification-catalog.json');
          const common = {
            repository: process.env.GITHUB_REPOSITORY,
            headSha: process.env.ATLAS_CODE_REVISION,
            integrationBaseSha: process.env.ATLAS_BASE_SHA,
            mergeBaseSha: process.env.ATLAS_MERGE_BASE_SHA,
            changedFiles: changes,
            requiredGroupFloor: ['deterministic.core', 'e2e.full'],
          };
          const protectedPlan = buildVerificationPlan({
            ...common,
            trustedImpactManifest: trustedImpact,
            candidateImpactManifest: trustedImpact,
            trustedVerificationCatalog: trustedCatalog,
            candidateVerificationCatalog: trustedCatalog,
          });
          const candidatePlan = buildVerificationPlan({
            ...common,
            trustedImpactManifest: trustedImpact,
            candidateImpactManifest: candidateImpact,
            trustedVerificationCatalog: trustedCatalog,
            candidateVerificationCatalog: candidateCatalog,
          });
          const changedPaths = [...new Set(changes.flatMap(({ path, previousPath }) => [path, previousPath].filter(Boolean)))].sort();
          const result = validateQualificationRepairTransition({ changedPaths, protectedPlan, candidatePlan });
          fs.writeFileSync(outputPath, `${JSON.stringify({ ...result, protectedPlan, candidatePlan }, null, 2)}\n`, 'utf8');
          NODE
          test "$(jq -r '.eligible' "$admission")" = true
          printf 'admission_path=%s\n' "$admission" >> "$GITHUB_OUTPUT"

      - name: Materialize protected execution context with admitted candidate overlay
        id: context
        shell: bash
        run: |
          set -euo pipefail
          admission="${{ steps.admission.outputs.admission_path }}"
          execution_context="$RUNNER_TEMP/atlas-qualification-repair-context"
          rm -rf "$execution_context"
          mkdir -p "$execution_context"
          rsync -a --delete --exclude='.git' --exclude='e2e/node_modules' trusted-base/ "$execution_context/"
          while IFS= read -r relative; do
            test -f "candidate/$relative"
            test ! -L "candidate/$relative"
            mkdir -p "$execution_context/$(dirname "$relative")"
            cp "candidate/$relative" "$execution_context/$relative"
          done < <(jq -r '.changedPaths[]' "$admission")
          printf 'execution_context=%s\n' "$execution_context" >> "$GITHUB_OUTPUT"

      - name: Rebuild exact repair fixture in networkless read-only sandbox
        id: fixture
        shell: bash
        run: |
          set -euo pipefail
          execution_context="${{ steps.context.outputs.execution_context }}"
          source_root="$RUNNER_TEMP/atlas-qualification-repair-world"
          trust_dir="$RUNNER_TEMP/atlas-qualification-repair-trust"
          trust_path="$trust_dir/qualification_fixture.json"
          rm -rf "$source_root" "$trust_dir"
          mkdir -p "$source_root" "$trust_dir"
          chmod 0777 "$source_root" "$trust_dir"
          proof="$RUNNER_TEMP/atlas-qualification-repair-product-proof.mjs"
          cat > "$proof" <<'NODE'
          import fs from 'node:fs';
          import { resolveFullWorldTrust } from '/trusted/src/browser/fullworld-trust.mjs';
          import { independentlyVerifyQualificationProduct } from '/trusted/tools/verification/qualification-repair-policy.mjs';
          import { buildQualificationWorld, qualificationTrustDescriptor } from '/candidate/tools/verification/qualification-world.mjs';
          await buildQualificationWorld('/out/product');
          const manifest = JSON.parse(fs.readFileSync('/out/product/fixture-manifest.json', 'utf8'));
          const independent = independentlyVerifyQualificationProduct('/out/product', manifest);
          const descriptor = qualificationTrustDescriptor(manifest);
          const trust = resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: descriptor });
          if (descriptor.dataCapability !== 'qualification_fixture' || trust.qualificationFixtureId !== descriptor.fixtureId || trust.qualificationProductDigest !== independent.productDigest) {
            throw new TypeError('protected trust rejected independently verified qualification repair fixture');
          }
          fs.writeFileSync('/out/qualification_fixture.json', `${JSON.stringify(descriptor)}\n`, 'utf8');
          NODE
          timeout --signal=KILL 180s docker run --rm \
            --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
            --pids-limit 192 --memory 1024m --cpus 2 --user 1000:1000 \
            --tmpfs /tmp:rw,nosuid,nodev,size=128m \
            --mount "type=bind,src=$PWD/trusted-base,dst=/trusted,readonly" \
            --mount "type=bind,src=$execution_context,dst=/candidate,readonly" \
            --mount "type=bind,src=$proof,dst=/proof.mjs,readonly" \
            --mount "type=bind,src=$source_root,dst=/out" \
            "$ATLAS_CANDIDATE_IMAGE" node /proof.mjs
          test -s "$source_root/qualification_fixture.json"
          mv "$source_root/qualification_fixture.json" "$trust_path"
          REBUILT_DIGEST="$(jq -er '.productDigest' "$trust_path")" node --input-type=module <<'NODE'
          import fs from 'node:fs';
          import { validateQualificationRepairProductRepin } from './trusted-base/tools/verification/qualification-repair-policy.mjs';
          const protectedIdentities = JSON.parse(fs.readFileSync('./trusted-base/tools/verification/protected-hosted-product-identities.json'));
          const candidateIdentities = JSON.parse(fs.readFileSync('./candidate/tools/verification/protected-hosted-product-identities.json'));
          const protectedMirrorText = fs.readFileSync('./trusted-base/tests/verification/protected-hosted-product-identities.test.mjs', 'utf8');
          const candidateMirrorText = fs.readFileSync('./candidate/tests/verification/protected-hosted-product-identities.test.mjs', 'utf8');
          validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: process.env.REBUILT_DIGEST, protectedMirrorText, candidateMirrorText });
          NODE
          printf 'source_root=%s\ntrust_path=%s\n' "$source_root/product" "$trust_path" >> "$GITHUB_OUTPUT"

      - name: Run protected deterministic regressions against admitted overlay
        shell: bash
        run: |
          set -euo pipefail
          execution_context="${{ steps.context.outputs.execution_context }}"
          timeout --signal=KILL 180s docker run --rm \
            --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
            --pids-limit 256 --memory 1536m --cpus 2 --user 1000:1000 \
            --tmpfs /tmp:rw,nosuid,nodev,size=256m \
            --mount "type=bind,src=$execution_context,dst=/candidate,readonly" \
            "$ATLAS_CANDIDATE_IMAGE" \
            bash -lc 'set -euo pipefail
              cd /candidate
              mkdir -p /tmp/atlas-python-bin /tmp/atlas-python-pycache
              ln -s /usr/bin/python3 /tmp/atlas-python-bin/python
              export PATH="/tmp/atlas-python-bin:$PATH"
              export PYTHONPYCACHEPREFIX=/tmp/atlas-python-pycache
              node --test tests/verification/*.test.mjs'

      - name: Resolve exact protected qualification repair browser proof
        id: tests
        shell: bash
        run: |
          set -euo pipefail
          npm ci --prefix trusted-base/e2e --ignore-scripts --no-audit --no-fund
          full_list="$RUNNER_TEMP/atlas-qualification-repair-full-list.txt"
          qualification_list="$RUNNER_TEMP/atlas-qualification-repair-full-census.txt"
          (
            cd trusted-base
            ATLAS_ARTIFACTS_DIR="$RUNNER_TEMP/atlas-qualification-repair-list-artifacts" \
              npm exec --prefix e2e -- playwright test --config=e2e/playwright.config.mjs --list
          ) > "$full_list"
          FULL_LIST="$full_list" QUALIFICATION_LIST="$qualification_list" node --input-type=module <<'NODE'
          import fs from 'node:fs';
          const catalog = JSON.parse(fs.readFileSync('./trusted-base/tools/verification/verification-catalog.json'));
          const specs = new Set(catalog.groups?.['e2e.full']?.specs ?? []);
          if (!specs.size) throw new TypeError('protected e2e.full qualification catalog is empty');
          const selected = [];
          for (const line of fs.readFileSync(process.env.FULL_LIST, 'utf8').split(/\r?\n/)) {
            const match = line.match(/^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/);
            if (match && specs.has(`e2e/tests/${match[2]}`)) selected.push(line.trim());
          }
          if (selected.length !== 68) throw new TypeError(`protected e2e.full qualification census must contain exactly 68 scenarios, received ${selected.length}`);
          fs.writeFileSync(process.env.QUALIFICATION_LIST, `${selected.join('\n')}\n`, 'utf8');
          NODE
          test -s "$qualification_list"
          printf 'qualification_list=%s\n' "$qualification_list" >> "$GITHUB_OUTPUT"

      - name: Bind protected authority and exact repair instance identities
        id: identity
        shell: bash
        run: |
          set -euo pipefail
          identity_dir="$RUNNER_TEMP/atlas-qualification-repair-identities"
          mkdir -p "$identity_dir"
          IDENTITY_DIR="$identity_dir" \
          ADMISSION_PATH="${{ steps.admission.outputs.admission_path }}" \
          TRUST_PATH="${{ steps.fixture.outputs.trust_path }}" \
          TEST_LIST="${{ steps.tests.outputs.qualification_list }}" \
          node --input-type=module <<'NODE'
          import fs from 'node:fs';
          import path from 'node:path';
          import { bytesDigest, canonicalDigest } from './trusted-base/tools/verification/anti-loop-common.mjs';
          import { buildProtectedExecutionEnvironmentIdentity } from './trusted-base/tools/verification/protected-execution-environment.mjs';
          import { buildVerificationAuthorityIdentity } from './trusted-base/tools/verification/verification-authority.mjs';
          const read = (target) => JSON.parse(fs.readFileSync(target, 'utf8'));
          const authority = await buildVerificationAuthorityIdentity({
            manifest: read('./trusted-base/tools/verification/verification-authority-manifest.json'),
            readFile: async (relative) => fs.readFileSync(path.join('trusted-base', relative)),
          });
          const environment = buildProtectedExecutionEnvironmentIdentity(read('./trusted-base/tools/verification/protected-execution-environment.json'));
          const admission = read(process.env.ADMISSION_PATH);
          const trust = read(process.env.TRUST_PATH);
          const semanticCore = {
            schemaVersion: 1,
            identityId: 'atlas-protected-qualification-repair-semantic-v1',
            repository: process.env.GITHUB_REPOSITORY,
            candidateHeadSha: process.env.ATLAS_CODE_REVISION,
            authorityDigest: authority.authorityDigest,
            environmentDigest: environment.environmentDigest,
            dataCapability: 'qualification_fixture',
            productDigest: trust.productDigest,
            changedPaths: admission.changedPaths,
            protectedTestListDigest: bytesDigest(fs.readFileSync(process.env.TEST_LIST)),
            execution: { shard: '1/1', workers: 1, retries: 0 },
          };
          const semantic = { ...semanticCore, planSemanticDigest: canonicalDigest(semanticCore) };
          const instanceCore = {
            schemaVersion: 1,
            identityId: 'atlas-protected-qualification-repair-instance-v1',
            repository: process.env.GITHUB_REPOSITORY,
            protectedBaseSha: process.env.ATLAS_BASE_SHA,
            candidateHeadSha: process.env.ATLAS_CODE_REVISION,
            planSemanticDigest: semantic.planSemanticDigest,
            runId: String(process.env.GITHUB_RUN_ID),
            runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
          };
          const instance = { ...instanceCore, planInstanceDigest: canonicalDigest(instanceCore) };
          fs.writeFileSync(path.join(process.env.IDENTITY_DIR, 'authority.json'), `${JSON.stringify(authority, null, 2)}\n`);
          fs.writeFileSync(path.join(process.env.IDENTITY_DIR, 'environment.json'), `${JSON.stringify(environment, null, 2)}\n`);
          fs.writeFileSync(path.join(process.env.IDENTITY_DIR, 'semantic.json'), `${JSON.stringify(semantic, null, 2)}\n`);
          fs.writeFileSync(path.join(process.env.IDENTITY_DIR, 'instance.json'), `${JSON.stringify(instance, null, 2)}\n`);
          NODE
          printf 'identity_dir=%s\n' "$identity_dir" >> "$GITHUB_OUTPUT"

      - name: Prove complete protected e2e.full qualification repair in Chromium
        shell: bash
        run: |
          set -euo pipefail
          execution_context="${{ steps.context.outputs.execution_context }}"
          source_root="${{ steps.fixture.outputs.source_root }}"
          trust_path="${{ steps.fixture.outputs.trust_path }}"
          qualification_list="${{ steps.tests.outputs.qualification_list }}"
          identity_dir="${{ steps.identity.outputs.identity_dir }}"
          artifacts="$RUNNER_TEMP/atlas-qualification-repair-browser-artifacts"
          mkdir -p "$artifacts"
          rm -rf "$execution_context/e2e/node_modules"
          export COMPOSE_PROJECT_NAME="atlas-qualification-repair-${GITHUB_RUN_ID}"
          export ATLAS_CODE_REVISION="$ATLAS_CODE_REVISION"
          export ATLAS_PLAN_SEMANTIC_DIGEST="$(jq -er '.planSemanticDigest' "$identity_dir/semantic.json")"
          export ATLAS_PLAN_INSTANCE_DIGEST="$(jq -er '.planInstanceDigest' "$identity_dir/instance.json")"
          export ATLAS_AUTHORITY_DIGEST="$(jq -er '.authorityDigest' "$identity_dir/authority.json")"
          export ATLAS_ENVIRONMENT_DIGEST="$(jq -er '.environmentDigest' "$identity_dir/environment.json")"
          export ATLAS_E2E_SHARD='1/1'
          export ATLAS_E2E_WORKERS='1'
          export ATLAS_QUALIFICATION_PUBLICATION_HOST="$source_root"
          export ATLAS_QUALIFICATION_TRUST_JSON="$(jq -c . "$trust_path")"
          export ATLAS_EXECUTION_CONTEXT="$execution_context"
          export ATLAS_E2E_ARTIFACTS_HOST="$artifacts"
          export ATLAS_PROTECTED_TEST_LIST="$qualification_list"
          compose_down() {
            docker compose \
              -f trusted-base/e2e/compose.protected-hosted-executor.yml \
              -f trusted-base/e2e/compose.github-hosted.yml \
              down -v --remove-orphans >/dev/null 2>&1 || true
          }
          trap compose_down EXIT
          compose_down
          docker compose \
            -f trusted-base/e2e/compose.protected-hosted-executor.yml \
            -f trusted-base/e2e/compose.github-hosted.yml \
            up -d --wait atlas-publication atlas-web
          docker compose \
            -f trusted-base/e2e/compose.protected-hosted-executor.yml \
            -f trusted-base/e2e/compose.github-hosted.yml \
            build e2e
          docker compose \
            -f trusted-base/e2e/compose.protected-hosted-executor.yml \
            -f trusted-base/e2e/compose.github-hosted.yml \
            run --rm e2e \
            bash -lc 'exec ./node_modules/.bin/playwright test --config=playwright.config.mjs --test-list=/run/atlas-protected-test-list.txt --workers=1 --retries=0'

      - name: Fence exact head and publish generic protected qualification evidence
        shell: bash
        run: |
          set -euo pipefail
          payload="$RUNNER_TEMP/atlas-qualification-repair-pr-after.json"
          gh api "repos/$GITHUB_REPOSITORY/pulls/$ATLAS_PR_NUMBER" > "$payload"
          node trusted-base/tools/verification/assert-current-pr-head.mjs \
            --payload "$payload" \
            --repository "$GITHUB_REPOSITORY" \
            --pr-number "$ATLAS_PR_NUMBER" \
            --expected-head-sha "$ATLAS_CODE_REVISION"
          gh api --method POST \
            "repos/$GITHUB_REPOSITORY/statuses/$ATLAS_CODE_REVISION" \
            -f state='success' \
            -f context='atlas-protected-product-qualification' \
            -f description='Protected GitHub-hosted qualification repair safety net' \
            -f target_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"

````

## `tests/verification/issue-314-qualification-path.test.mjs`

````text
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PRODUCTION_ANIMATION_SOURCE } from '../../src/browser/animation-runtime.mjs';
import { buildVerificationPlan } from '../../tools/verification/build-verification-plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const impactManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/impact-manifest.json'), 'utf8'));
const verificationCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/verification/verification-catalog.json'), 'utf8'));
const classifierPath = path.join(ROOT, 'tools/verification/classify-pr-changes.mjs');
const creatureSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-creatures.mjs'), 'utf8');
const searchSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-search.mjs'), 'utf8');
const farmSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-farm-explorer.mjs'), 'utf8');

function classify(paths) {
  const result = spawnSync(process.execPath, [classifierPath], {
    cwd: ROOT,
    input: `${paths.join('\n')}\n`,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return Object.fromEntries(result.stdout.trim().split(/\r?\n/).map((line) => line.split('=')));
}

function planFor(pathname) {
  return buildVerificationPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    headSha: 'a'.repeat(40),
    integrationBaseSha: 'b'.repeat(40),
    mergeBaseSha: 'c'.repeat(40),
    changedFiles: [{ path: pathname }],
    trustedImpactManifest: impactManifest,
    candidateImpactManifest: impactManifest,
    trustedVerificationCatalog: verificationCatalog,
    candidateVerificationCatalog: verificationCatalog,
  });
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

function responseFor(bytes) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => String(bytes.byteLength) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

test('A: root instruction-only governance does not recursively require browser qualification', () => {
  assert.deepEqual(classify(['AGENTS.md']), { docs_only: 'true', requires_e2e: 'false' });
  const plan = planFor('AGENTS.md');
  assert.equal(plan.profile, 'none');
  assert.deepEqual(plan.requiredGroupIds, []);

  const unknownMarkdown = planFor('README.md');
  assert.equal(unknownMarkdown.profile, 'full', 'arbitrary Markdown must remain fail-closed');
  assert.deepEqual(unknownMarkdown.requiredGroupIds, ['deterministic.core', 'e2e.full']);
});

test('B: pure verification regressions stay deterministic while executable authority stays broad and fail-closed', () => {
  const regression = planFor('tests/verification/new-regression.test.mjs');
  assert.equal(regression.profile, 'focused');
  assert.deepEqual(regression.requiredGroupIds, ['deterministic.core']);

  for (const pathname of [
    'tools/verification/classify-pr-changes.mjs',
    '.github/workflows/protected-hosted-executor.yml',
  ]) {
    const plan = planFor(pathname);
    assert.equal(plan.profile, 'full', pathname);
    assert.deepEqual(plan.requiredGroupIds, ['deterministic.core', 'e2e.full'], pathname);
  }
});

test('C: verification profile remains independent from product data capability', () => {
  assert.equal(verificationCatalog.groups['e2e.full'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(verificationCatalog.groups['e2e.common-smoke'].capabilities.dataCapability, 'qualification_fixture');
  assert.equal(verificationCatalog.groups['integration.source-contract'].capabilities.dataCapability, 'bounded_real_world');
  assert.equal(verificationCatalog.groups['fullworld.animation-census'].capabilities.dataCapability, 'real_fullworld');
  assert.equal(planFor('web/fullworld-creatures.mjs').profile, 'broad');
});

test('D/E: qualification repair admission is branch-agnostic, exact-scope and executes protected e2e.full', async () => {
  const policyUrl = pathToFileURL(path.join(ROOT, 'tools/verification/qualification-repair-policy.mjs')).href;
  const { QUALIFICATION_REPAIR_BROWSER_PROOF, validateQualificationRepairTransition } = await import(policyUrl);
  const protectedPlan = {
    profile: 'full',
    requiredGroupIds: ['deterministic.core', 'e2e.full'],
    requiredDataCapabilities: ['qualification_fixture'],
    retryPolicy: { retries: 0 },
  };
  const candidatePlan = structuredClone(protectedPlan);

  const accepted = validateQualificationRepairTransition({
    changedPaths: ['tools/verification/qualification-fixture-definition.mjs', 'web/fullworld-creatures.mjs'],
    protectedPlan,
    candidatePlan,
  });
  assert.equal(accepted.eligible, true);
  assert.deepEqual(accepted.planFloorGroupIds, ['deterministic.core', 'e2e.full']);
  assert.deepEqual(accepted.requiredGroupIds, ['deterministic.core']);
  assert.deepEqual(accepted.browserProof, QUALIFICATION_REPAIR_BROWSER_PROOF);
  assert.deepEqual(accepted.browserProof, {
    groupId: 'e2e.full',
    dataCapability: 'qualification_fixture',
    workers: 1,
    retries: 0,
  });
  assert.equal(JSON.stringify(accepted).includes('branch'), false);
  assert.equal(JSON.stringify(accepted).includes('prNumber'), false);

  assert.throws(() => validateQualificationRepairTransition({
    changedPaths: ['tools/verification/qualification-fixture-definition.mjs'],
    protectedPlan,
    candidatePlan: { ...candidatePlan, requiredGroupIds: ['deterministic.core'] },
  }), /narrow|protected|safety/i);

  assert.throws(() => validateQualificationRepairTransition({
    changedPaths: ['.github/workflows/protected-hosted-executor.yml'],
    protectedPlan,
    candidatePlan,
  }), /scope|eligible|repair/i);
});

test('D/E: generic qualification repair admits regression companions and all trust-bound FullWorld ancillary callers', async () => {
  const policyUrl = pathToFileURL(path.join(ROOT, 'tools/verification/qualification-repair-policy.mjs')).href;
  const { validateQualificationRepairTransition } = await import(policyUrl);
  const plan = {
    profile: 'full',
    requiredGroupIds: ['deterministic.core', 'e2e.full'],
    requiredDataCapabilities: ['qualification_fixture'],
    retryPolicy: { retries: 0 },
  };

  const accepted = validateQualificationRepairTransition({
    changedPaths: [
      'src/browser/animation-runtime-service.mjs',
      'tests/verification/issue-314-animation-trust-callers.test.mjs',
      'web/fullworld-app.mjs',
      'web/fullworld-creatures.mjs',
      'web/fullworld-farm-explorer.mjs',
      'web/fullworld-search.mjs',
    ],
    protectedPlan: plan,
    candidatePlan: plan,
  });

  assert.equal(accepted.eligible, true);
  assert(accepted.changedPaths.includes('tests/verification/issue-314-animation-trust-callers.test.mjs'));
  assert(accepted.changedPaths.includes('web/fullworld-app.mjs'));
  assert(accepted.changedPaths.includes('web/fullworld-search.mjs'));
  assert(accepted.changedPaths.includes('web/fullworld-farm-explorer.mjs'));
});

test('D/E: protected qualification repair resolves the exact complete protected browser census', () => {
  const workflowPath = path.join(ROOT, '.github/workflows/protected-qualification-repair.yml');
  assert.equal(fs.existsSync(workflowPath), true, 'generic protected qualification repair workflow must exist');
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const job = workflow.split('  qualification-repair:')[1] ?? '';
  const gateSource = fs.readFileSync(path.join(ROOT, 'tools/verification/protected-hosted-gate.mjs'), 'utf8');

  assert.match(workflow, /pull_request_target:/);
  assert.match(job, /validateQualificationRepairTransition/);
  assert.match(job, /requiredGroupFloor:\s*\['deterministic\.core', 'e2e\.full'\]/);
  assert.match(job, /catalog\.groups\?\.\['e2e\.full'\]\?\.specs/);
  assert.match(job, /selected\.length !== 68/);
  assert.doesNotMatch(job, /candidateCensus|candidate-list-artifacts/);
  assert.doesNotMatch(job, /selected\.length !== 1/);
  assert.match(job, /runs-on:\s*ubuntu-24\.04/);
  assert.match(job, /--network none/);
  assert.match(job, /--read-only/);
  assert.match(job, /--workers=1/);
  assert.match(job, /--retries=0/);
  assert.match(job, /context='atlas-protected-product-qualification'/);
  assert.doesNotMatch(job, /ATLAS_HEAD_REF|head\.ref|fix\/issue-|pull_request\.number\s*==/);

  assert.match(gateSource, /\.github\/workflows\/protected-qualification-repair\.yml/);
  assert.doesNotMatch(gateSource, /resolveProtectedPromotionQualification|resolveProtectedAuthorityRepinQualification/);
});

test('F: FullWorld ancillary browser consumers derive exact source authority from active trust', () => {
  assert.match(creatureSource, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/);
  assert.doesNotMatch(creatureSource, /validateCreatureIndex\(index,\s*\{[\s\S]*EXPECTED_GAME_SHA256/);

  for (const [source, label] of [[searchSource, 'search'], [farmSource, 'farm']]) {
    assert.match(source, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/, label);
    assert.match(source, /SOURCE_EXPECTATIONS\.semanticSearch/, label);
    assert.match(source, /creatureContractId/, label);
    assert.match(source, /creatureCapability/, label);
    assert.match(source, /creatureSemanticDigest/, label);
    assert.match(source, /fixture_id/, label);
  }
  assert.match(searchSource, /validateSemanticSearchIndex\(raw, SOURCE_EXPECTATIONS\.semanticSearch\)/);
});

test('F2: implicit and explicit production animation authority share one singleton identity', async () => {
  const programs = jsonBytes({
    profile: 'oteryn-atlas-animation-runtime-v1',
    object_programs: [],
    creature_programs: [],
    sprite_index: {},
    blob_index: {},
  });
  const programsDigest = `sha256:${crypto.createHash('sha256').update(programs).digest('hex')}`;
  const manifest = jsonBytes({
    profile: 'oteryn-atlas-animation-runtime-v1',
    identityAuthority: false,
    source: {
      game_sha: PRODUCTION_ANIMATION_SOURCE.gameSha,
      appearance_product_root: PRODUCTION_ANIMATION_SOURCE.appearanceProductRoot,
      outfit_spatial_product_root: PRODUCTION_ANIMATION_SOURCE.outfitSpatialProductRoot,
    },
    buckets: [],
    programs: { path: 'programs.json', digest: programsDigest, bytes: programs.byteLength },
  });
  const fetcher = async (url) => {
    if (url.pathname.endsWith('/manifest.json')) return responseFor(manifest);
    if (url.pathname.endsWith('/programs.json')) return responseFor(programs);
    throw new Error(`unexpected animation fixture URL: ${url}`);
  };
  const serviceUrl = pathToFileURL(path.join(ROOT, 'src/browser/animation-runtime-service.mjs'));
  serviceUrl.searchParams.set('regression', 'implicit-explicit-production-authority');
  const { getAnimationRuntime } = await import(serviceUrl.href);
  const base = new URL('https://atlas.example/fullworld/animation/');

  const implicit = getAnimationRuntime(base, fetcher);
  const explicit = getAnimationRuntime(base, fetcher, PRODUCTION_ANIMATION_SOURCE);
  assert.strictEqual(explicit, implicit);
  await implicit;

  assert.throws(() => getAnimationRuntime(base, fetcher, {
    ...PRODUCTION_ANIMATION_SOURCE,
    gameSha: 'fixture',
  }), /identity changed/i);
});

test('G: genuine runtime-impacting browser changes retain full plan floor while generic repair proof stays fixture-bound', async () => {
  const plan = planFor('web/fullworld-creatures.mjs');
  assert.equal(plan.profile, 'broad');
  assert(plan.requiredGroupIds.includes('e2e.full'));
  const group = verificationCatalog.groups['e2e.full'];
  assert.equal(group.capabilities.browser, true);
  assert.equal(group.capabilities.hosted, true);
  assert.equal(group.capabilities.dataCapability, 'qualification_fixture');

  const policyUrl = pathToFileURL(path.join(ROOT, 'tools/verification/qualification-repair-policy.mjs')).href;
  const { QUALIFICATION_REPAIR_BROWSER_PROOF } = await import(policyUrl);
  assert.equal(QUALIFICATION_REPAIR_BROWSER_PROOF.dataCapability, 'qualification_fixture');
  assert.equal(QUALIFICATION_REPAIR_BROWSER_PROOF.workers, 1);
  assert.equal(QUALIFICATION_REPAIR_BROWSER_PROOF.retries, 0);
});

````

## `tests/verification/issue-314-qualification-repair-trust.test.mjs`

````text
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { resolveFullWorldTrust } from '../../src/browser/fullworld-trust.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENT = `sha256:${'1'.repeat(64)}`;

function qualificationDescriptor() {
  return Object.freeze({
    marker: 'oteryn-atlas-qualification-trust-v1',
    fixtureId: 'atlas-qualification-world-v2',
    dataCapability: 'qualification_fixture',
    publicationRoot: CONTENT,
    semanticRoot: CONTENT,
    pixelRoot: CONTENT,
    overviewRoot: CONTENT,
    minimapRoot: CONTENT,
    runtimeIndexRoot: CONTENT,
    pixelBucketRoot: CONTENT,
    sourceFingerprint: CONTENT,
    productDigest: CONTENT,
  });
}

test('qualification repair proof validates the actual runtime-trust contract', () => {
  const descriptor = qualificationDescriptor();
  const trust = resolveFullWorldTrust({ __OTERYN_ATLAS_QUALIFICATION_TRUST__: descriptor });

  assert.equal(descriptor.dataCapability, 'qualification_fixture');
  assert.equal(Object.hasOwn(trust, 'dataCapability'), false);
  assert.equal(trust.qualificationFixtureId, descriptor.fixtureId);
  assert.equal(trust.qualificationProductDigest, descriptor.productDigest);

  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.doesNotMatch(workflow, /trust\.dataCapability/);
  assert.match(workflow, /descriptor\.dataCapability\s*!==\s*'qualification_fixture'/);
  assert.match(workflow, /trust\.qualificationFixtureId\s*!==\s*descriptor\.fixtureId/);
  assert.match(workflow, /trust\.qualificationProductDigest\s*!==\s*independent\.productDigest/);
});

 test('repair digest is independently derived under protected authority', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.match(workflow, /independentlyVerifyQualificationProduct/);
  assert.doesNotMatch(workflow, /verifyQualificationWorld } from '\/candidate/);
});

````

## `tests/verification/merge-group-qualification-repair-bootstrap.test.mjs`

````text
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/merge-group-gate.yml'), 'utf8');

function stepBody(name) {
  const marker = `      - name: ${name}\n`;
  const start = WORKFLOW.indexOf(marker);
  assert.notEqual(start, -1, `missing workflow step: ${name}`);
  const next = WORKFLOW.indexOf('\n      - name: ', start + marker.length);
  return WORKFLOW.slice(start, next === -1 ? WORKFLOW.length : next);
}

test('merge queue consumes exact protected qualification repair evidence before stale-base full fixture proof', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  const full = stepBody('Prove complete protected-base browser qualification for synthetic candidate');

  assert.match(repair, /validateProtectedProductQualificationGate/);
  assert.match(repair, /validateQualificationRepairTransition/);
  assert.match(repair, /pulls\/\$ATLAS_PR_NUMBER/);
  assert.match(repair, /git\/commits\/\$ATLAS_CODE_REVISION/);
  assert.match(repair, /git\/commits\/\$candidate_head_sha/);
  assert.match(repair, /candidateTreeSha|candidate_tree_sha/);
  assert.match(repair, /syntheticTreeSha|synthetic_tree_sha/);
  assert.match(repair, /use_repair_proof=true/);
  assert.match(repair, /refs\/heads\/gh-readonly-queue\/main\/pr-\(\[1-9\]\[0-9\]\*\\d*\)|gh-readonly-queue\/main\/pr-/);
  assert.match(repair, /current_main_sha/);
  assert.match(repair, /producerJobs/);
  assert.match(repair, /producerRun:\s*read\('run\.json'\)/);
  assert.doesNotMatch(repair, /fix\/issue-|ATLAS_REPAIR_PR_NUMBER|pull_request\.number\s*==/);

  assert.match(full, /steps\.qualification-repair\.outputs\.use_repair_proof != 'true'/);
  assert.ok(
    WORKFLOW.indexOf('Validate exact protected qualification repair bootstrap evidence')
      < WORKFLOW.indexOf('Prove complete protected-base browser qualification for synthetic candidate'),
    'repair evidence must be checked before stale-base full qualification',
  );
});

test('protected repair producer executes the entire protected e2e.full stable-ID census', () => {
  const repairWorkflow = fs.readFileSync(path.join(ROOT, '.github/workflows/protected-qualification-repair.yml'), 'utf8');
  assert.match(repairWorkflow, /catalog\.groups\?\.\['e2e\.full'\]/);
  assert.match(repairWorkflow, /selected\.length !== 68/);
  assert.doesNotMatch(repairWorkflow, /candidateCensus|candidate-list-artifacts/);
  assert.doesNotMatch(repairWorkflow, /selected\.length\s*!==\s*1/);
  assert.match(repairWorkflow, /--workers=1 --retries=0/);
});

test('self-retiring bootstrap remains a closed control-plane-only path', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  assert.match(repair, /from '\.\/trusted-base\/tools\/verification\/qualification-repair-policy\.mjs'/);
  assert.doesNotMatch(repair, /from '\.\/tools\/verification\/qualification-repair-policy\.mjs'/);
  assert.match(repair, /candidate provenance verifier is not an exact gate-pin rotation/);
  assert.match(repair, /creatureRegionCount/);
  assert.match(repair, /semanticRecordCount/);
  assert.match(repair, /self-retiring-control-plane-bootstrap/);
});

test('candidate policy bytes cannot self-authorize bootstrap', () => {
  const repair = stepBody('Validate exact protected qualification repair bootstrap evidence');
  assert.doesNotMatch(repair, /import .* from '\.\/tools\/verification\/qualification-repair-policy\.mjs'/);
  assert.match(repair, /trusted-base\/tools\/verification\/qualification-repair-policy\.mjs/);
});

````

## `tests/verification/qualification-repair-policy.test.mjs`

````text
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  classifyQualificationRepairStatuses,
  independentlyVerifyQualificationProduct,
  validateQualificationRepairBootstrapPinRotations,
  validateQualificationRepairControlPlaneBootstrap,
  validateQualificationRepairProductRepin,
  validateQualificationRepairTransition,
} from '../../tools/verification/qualification-repair-policy.mjs';
const digest = (c) => `sha256:${c.repeat(64)}`;
const plan = { profile: 'full', requiredGroupIds: ['deterministic.core', 'e2e.full'], requiredDataCapabilities: ['qualification_fixture'], retryPolicy: { retries: 0 } };
const gitBlob = (text) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(text)}\0`), Buffer.from(text)])).digest('hex');

test('candidate E2E is never admitted and product paths remain closed', () => {
  assert.throws(() => validateQualificationRepairTransition({ changedPaths: ['e2e/tests/desktop.spec.mjs'], protectedPlan: plan, candidatePlan: plan }), /not eligible/);
  assert.equal(validateQualificationRepairTransition({ changedPaths: ['tools/verification/qualification-world.mjs'], protectedPlan: plan, candidatePlan: plan }).eligible, true);
});

test('absent repair status is inapplicable while present malformed evidence fails closed', () => {
  assert.deepEqual(classifyQualificationRepairStatuses([]), { applicable: false });
  assert.equal(classifyQualificationRepairStatuses([{ context: 'atlas-protected-product-qualification', state: 'success' }]).applicable, true);
  assert.throws(() => classifyQualificationRepairStatuses([{ context: 'atlas-protected-product-qualification', state: 'pending' }]), /present/);
  assert.throws(() => classifyQualificationRepairStatuses([{ context: 'atlas-protected-product-qualification', state: 'success' }, { context: 'atlas-protected-product-qualification', state: 'success' }]), /one authoritative/);
});

test('independent product proof rejects tampered bytes and lying manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-repair-'));
  fs.writeFileSync(path.join(root, 'data'), 'truth');
  const entry = { path: 'data', bytes: 5, digest: digest('0') };
  entry.digest = `sha256:${crypto.createHash('sha256').update('truth').digest('hex')}`;
  const productDigest = `sha256:${crypto.createHash('sha256').update('[{\"bytes\":5,\"digest\":'+JSON.stringify(entry.digest)+',\"path\":\"data\"}]').digest('hex')}`;
  assert.equal(independentlyVerifyQualificationProduct(root, { files: [entry], productDigest }).productDigest, productDigest);
  fs.writeFileSync(path.join(root, 'data'), 'lie');
  assert.throws(() => independentlyVerifyQualificationProduct(root, { files: [entry], productDigest }), /independently/);
});

test('identity repin preserves the complete protected mirror', () => {
  const protectedIdentities = { qualification_fixture: { id: 'atlas-qualification-world-v2', digest: digest('1') }, bounded_real_world: { id: 'real', digest: digest('2') } };
  const candidateIdentities = structuredClone(protectedIdentities); candidateIdentities.qualification_fixture.digest = digest('3');
  const protectedMirrorText = `assert.equal(identity.digest, '${digest('1')}');\n`;
  const candidateMirrorText = protectedMirrorText.replace(digest('1'), digest('3'));
  assert.equal(validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), protectedMirrorText, candidateMirrorText }).productDigest, digest('3'));
  assert.throws(() => validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest: digest('3'), protectedMirrorText, candidateMirrorText: `// ${digest('3')}` }), /mirror/);
});

test('control-plane bootstrap activates only for narrow protected shape and retires', () => {
  const changedPaths = ['.github/workflows/merge-authority-audit.yml', '.github/workflows/merge-group-gate.yml', '.github/workflows/protected-qualification-repair.yml', 'tools/governance/verify_extraction_provenance.py', 'tools/verification/qualification-repair-policy.mjs', 'tests/verification/qualification-repair-policy.test.mjs'];
  const narrow = { fixtureId: 'atlas-qualification-world-v2', creatureCount: 12, creatureRegionCount: 1, semanticRecordCount: 1 };
  assert.equal(validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: narrow }).eligible, true);
  assert.throws(() => validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape: { ...narrow, creatureRegionCount: 2 } }), /no longer/);
});

test('bootstrap pins permit only exact mechanical rotations', () => {
  const oldGate = '1'.repeat(40), gateText = 'gate\n', gateBlob = gitBlob(gateText);
  const protectedVerifierText = `MERGE_GROUP_GATE_BLOB = "${oldGate}"\n`; const candidateVerifierText = `MERGE_GROUP_GATE_BLOB = "${gateBlob}"\n`; const verifierBlob = gitBlob(candidateVerifierText);
  const protectedAuditText = `EXPECTED_MERGE_GROUP_GATE_BLOB: "${oldGate}"\nEXPECTED_PROVENANCE_VERIFIER_BLOB: "${'2'.repeat(40)}"\n`;
  const candidateAuditText = `EXPECTED_MERGE_GROUP_GATE_BLOB: "${gateBlob}"\nEXPECTED_PROVENANCE_VERIFIER_BLOB: "${verifierBlob}"\n`;
  const args = { protectedVerifierText, candidateVerifierText, protectedAuditText, candidateAuditText, candidateGateText: gateText, candidateGateBlob: gateBlob, candidateVerifierBlob: verifierBlob };
  assert.equal(validateQualificationRepairBootstrapPinRotations(args).eligible, true);
  assert.throws(() => validateQualificationRepairBootstrapPinRotations({ ...args, candidateAuditText: `${candidateAuditText}# x\n` }), /more than/);
  assert.throws(() => validateQualificationRepairBootstrapPinRotations({ ...args, candidateGateBlob: 'A'.repeat(40) }), /lowercase/);
});

````

## `tools/governance/verify_extraction_provenance.py`

````text
#!/usr/bin/env python3
"""Verify the pinned legacy Atlas selective-extraction provenance map."""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
from collections import Counter
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / "docs" / "migration" / "legacy-atlas-extraction-provenance.json"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
SOURCE_REPOSITORY = "https://github.com/blakinio/Otheryn.git"
SOURCE_PREFIXES = ("tools/otbm_atlas/", "tools/otbm_atlas_facts/", ".github/workflows/otbm-atlas-")
MERGE_GROUP_GATE_PATH = ".github/workflows/merge-group-gate.yml"
MERGE_GROUP_GATE_BLOB = "77a520ab25b609e55be40da9454f67eda922a371"
ALLOWED = {
    "GAME_OWNED_LEGACY_REFERENCE",
    "SPLIT_REWRITE_WORKFLOW",
    "SPLIT_REWRITE_TEST_EVIDENCE",
    "ATLAS_REIMPLEMENTED",
    "SPLIT_REIMPLEMENTED",
    "LEGACY_REFERENCE_REVIEWED",
}


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(
            f"git {' '.join(args)} failed in {repo}: {result.stderr.strip() or result.stdout.strip()}"
        )
    return result.stdout.strip()


def target_git_blob(path: str) -> str:
    candidate = ROOT / path
    if not candidate.is_file():
        raise AssertionError(f"mapped target path missing: {path}")
    return git(ROOT, "hash-object", path)


def verify_control_plane_pin(path: str, expected_blob: str) -> None:
    assert HEX40.fullmatch(expected_blob), f"invalid expected control-plane blob: {expected_blob}"
    actual = target_git_blob(path)
    assert actual == expected_blob, f"control-plane blob drift: {path}: {actual} != {expected_blob}"


def verify_source_row(row: dict, source_root: Path, source_sha: str) -> None:
    path = row["source_path"]
    pure = PurePosixPath(path)
    assert ".." not in pure.parts, f"source path traversal is forbidden: {path}"
    assert path.startswith(SOURCE_PREFIXES), path
    assert HEX40.fullmatch(row["source_blob"]), path

    actual_type = git(source_root, "cat-file", "-t", f"{source_sha}:{path}")
    assert actual_type == "blob", f"source path is not a blob: {path}: {actual_type}"
    actual_blob = git(source_root, "rev-parse", f"{source_sha}:{path}")
    assert actual_blob == row["source_blob"], (
        f"source blob drift: {path}: {actual_blob} != {row['source_blob']}"
    )
    actual_size = int(git(source_root, "cat-file", "-s", actual_blob))
    assert actual_size == row["source_size"], (
        f"source size drift: {path}: {actual_size} != {row['source_size']}"
    )


def verify_source_repository(source_root: Path, source_sha: str) -> None:
    assert source_root.is_dir(), f"source checkout missing: {source_root}"
    assert HEX40.fullmatch(source_sha), source_sha
    resolved = git(source_root, "rev-parse", f"{source_sha}^{{commit}}")
    assert resolved == source_sha, f"source commit mismatch: {resolved} != {source_sha}"


def verify_source_coverage(rows: list[dict], source_root: Path, source_sha: str) -> int:
    raw = git(source_root, "ls-tree", "-r", "--name-only", source_sha)
    selected = sorted(path for path in raw.splitlines() if path.startswith(SOURCE_PREFIXES))
    mapped = sorted(row["source_path"] for row in rows)
    missing = sorted(set(selected) - set(mapped))
    extra = sorted(set(mapped) - set(selected))
    assert not missing and not extra, f"bounded source coverage mismatch: missing={missing}, extra={extra}"
    return len(selected)


def verify_terminal_lifecycle(data: dict) -> None:
    assert data["schema_version"] == 2
    source = data["source"]
    assert source["repository"] == "blakinio/Otheryn"
    assert HEX40.fullmatch(source["sha"]) and HEX40.fullmatch(source["tree_sha"])
    work = data["source_work"]
    assert work["pull_request"] == 447
    assert work["state"] == "CLOSED_UNMERGED" and work["merged"] is False
    assert work["disposition"] == "CLOSED_UNMERGED_HISTORICAL_PROVENANCE"
    assert work["authority"] == "NON_AUTHORITATIVE_READ_ONLY"
    assert work["retention"] == "RETAIN_HISTORICAL_SOURCE_BRANCH"
    target = data["target"]
    merge = target["immutable_extraction_closeout"]
    assert merge == {"pull_request": 4, "merge_sha": "750ecab7b600ea078a832f5f95059f08ce57a06a"}
    coverage = data["bounded_source_coverage"]
    assert coverage["source_commit_sha"] == source["sha"]
    assert coverage["source_tree_sha"] == source["tree_sha"]
    assert coverage["selected_blob_count"] == 144
    assert coverage["manifest_row_count"] == 144
    assert coverage["missing_manifest_paths"] == 0
    assert coverage["blob_identity_mismatches"] == 0
    assert coverage["extra_manifest_rows"] == 0


def verify(map_path: Path, source_root: Path | None = None) -> dict[str, int]:
    data = json.loads(map_path.read_text(encoding="utf-8"))
    verify_terminal_lifecycle(data)
    verify_control_plane_pin(MERGE_GROUP_GATE_PATH, MERGE_GROUP_GATE_BLOB)
    assert data["source"]["repository"] == "blakinio/Otheryn"
    assert data["target"]["repository"] == "Oteryn/Oteryn-Atlas"
    source_sha = data["source"]["sha"]
    if source_root is not None:
        verify_source_repository(source_root, source_sha)
        actual_tree = git(source_root, "rev-parse", f"{source_sha}^{{tree}}")
        assert actual_tree == data["source"]["tree_sha"], f"source tree mismatch: {actual_tree} != {data['source']['tree_sha']}"

    rows = data["rows"]
    assert len(rows) >= 100
    paths = [row["source_path"] for row in rows]
    assert paths == sorted(paths)
    assert len(paths) == len(set(paths))
    assert data["bounded_source_coverage"]["manifest_row_count"] == len(rows)
    if source_root is not None:
        selected_count = verify_source_coverage(rows, source_root, source_sha)
        assert data["bounded_source_coverage"]["selected_blob_count"] == selected_count
    counts = Counter()
    for row in rows:
        path = row["source_path"]
        if source_root is not None:
            verify_source_row(row, source_root, source_sha)
        cls = row["ownership_classification"]
        assert cls in ALLOWED, (path, cls)
        counts[cls] += 1
        targets = row["target_paths"]
        if cls in {"GAME_OWNED_LEGACY_REFERENCE", "LEGACY_REFERENCE_REVIEWED"}:
            assert not targets, path
        for target in targets:
            target_path = target["path"]
            assert ".." not in PurePosixPath(target_path).parts
            assert not target_path.startswith("vendor/")
            assert not target_path.lower().endswith((".otbm", ".otb", ".spr", ".dat"))
            actual = target_git_blob(target_path)
            assert actual == target["blob"], (
                f"target blob drift: {target_path}: {actual} != {target['blob']}"
            )
    return dict(sorted(counts.items()))


def fetch_pinned_source(source_sha: str, destination: Path) -> None:
    assert HEX40.fullmatch(source_sha), source_sha
    destination.mkdir(parents=True, exist_ok=False)
    subprocess.run(["git", "init", "--quiet", str(destination)], check=True)
    git(destination, "remote", "add", "origin", SOURCE_REPOSITORY)
    git(destination, "fetch", "--quiet", "--depth=1", "origin", source_sha)
    git(destination, "checkout", "--quiet", "--detach", source_sha)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source-root",
        type=Path,
        help="optional inert checkout containing the exact pinned blakinio/Otheryn source commit; when omitted, the verifier materializes that exact public source into a disposable temporary repository",
    )
    args = parser.parse_args()
    data = json.loads(MAP.read_text(encoding="utf-8"))
    source_sha = data["source"]["sha"]
    if args.source_root is not None:
        source_root = args.source_root.resolve()
        counts = verify(MAP, source_root)
    else:
        with tempfile.TemporaryDirectory(prefix="atlas-pinned-source-") as tmp:
            source_root = Path(tmp) / "source"
            fetch_pinned_source(source_sha, source_root)
            counts = verify(MAP, source_root)
    rows = len(data["rows"])
    print(f"legacy extraction provenance PASS: rows={rows} source=verified classes={counts}")


if __name__ == "__main__":
    main()

````

## `tools/verification/qualification-repair-policy.mjs`

````text
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { canonicalJson, profileRank } from './verification-plan-schema.mjs';

export const QUALIFICATION_REPAIR_PATHS = Object.freeze([
  'src/browser/animation-runtime-service.mjs',
  'src/browser/fullworld-trust.mjs',
  'src/browser/semantic-search.mjs',
  'tools/verification/qualification-fixture-definition.mjs',
  'tools/verification/qualification-world.mjs',
  'web/fullworld-app.mjs',
  'web/fullworld-creatures.mjs',
  'web/fullworld-farm-explorer.mjs',
  'web/fullworld-search.mjs',
]);

export const QUALIFICATION_REPAIR_BROWSER_PROOF = Object.freeze({
  groupId: 'e2e.full',
  dataCapability: 'qualification_fixture',
  workers: 1,
  retries: 0,
});

export const QUALIFICATION_REPAIR_PRODUCT_IDENTITY_PATHS = Object.freeze([
  'tools/verification/protected-hosted-product-identities.json',
  'tests/verification/protected-hosted-product-identities.test.mjs',
]);

const ALLOWED_PATHS = new Set([
  ...QUALIFICATION_REPAIR_PATHS,
  ...QUALIFICATION_REPAIR_PRODUCT_IDENTITY_PATHS,
]);
const REQUIRED_PLAN_FLOOR = Object.freeze(['deterministic.core', 'e2e.full']);
const EXECUTED_DETERMINISTIC_GROUPS = Object.freeze(['deterministic.core']);
const REQUIRED_DATA_CAPABILITIES = Object.freeze(['qualification_fixture']);
const VERIFICATION_REGRESSION = /^tests\/verification\/[A-Za-z0-9][A-Za-z0-9._-]*\.test\.mjs$/;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function exactStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)
    || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${label} must be a non-empty string array`);
  }
  if (new Set(value).size !== value.length) throw new TypeError(`${label} contains duplicates`);
  return [...value].sort();
}

function exactChangedPaths(value) {
  const paths = exactStringArray(value, 'qualification repair changed paths');
  for (const path of paths) {
    if (path.startsWith('/') || path.includes('\\') || path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
      throw new TypeError(`qualification repair scope contains an unsafe path: ${path}`);
    }
    if (!ALLOWED_PATHS.has(path) && !VERIFICATION_REGRESSION.test(path)) {
      throw new TypeError(`qualification repair scope is not eligible: ${path}`);
    }
  }
  return paths;
}

function validatePlan(plan, label) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new TypeError(`${label} plan is invalid`);
  profileRank(plan.profile);
  const requiredGroupIds = exactStringArray(plan.requiredGroupIds, `${label} required groups`);
  const requiredDataCapabilities = exactStringArray(plan.requiredDataCapabilities, `${label} data capabilities`);
  if (!plan.retryPolicy || plan.retryPolicy.retries !== 0) throw new TypeError(`${label} retry policy must remain zero`);
  return { profile: plan.profile, requiredGroupIds, requiredDataCapabilities };
}

function requireSuperset(candidate, protectedValues, label) {
  const candidateSet = new Set(candidate);
  const missing = protectedValues.filter((value) => !candidateSet.has(value));
  if (missing.length) throw new TypeError(`qualification repair candidate narrows protected ${label}: ${missing.join(', ')}`);
}

export function validateQualificationRepairTransition({ changedPaths, protectedPlan, candidatePlan } = {}) {
  const paths = exactChangedPaths(changedPaths);
  const protectedState = validatePlan(protectedPlan, 'protected');
  const candidateState = validatePlan(candidatePlan, 'candidate');

  if (profileRank(candidateState.profile) < profileRank(protectedState.profile)) {
    throw new TypeError('qualification repair candidate narrows protected verification profile');
  }
  requireSuperset(candidateState.requiredGroupIds, protectedState.requiredGroupIds, 'required groups');
  requireSuperset(candidateState.requiredDataCapabilities, protectedState.requiredDataCapabilities, 'data capabilities');
  requireSuperset(candidateState.requiredGroupIds, REQUIRED_PLAN_FLOOR, 'plan safety groups');

  if (candidateState.requiredDataCapabilities.length !== REQUIRED_DATA_CAPABILITIES.length
    || candidateState.requiredDataCapabilities[0] !== REQUIRED_DATA_CAPABILITIES[0]) {
    throw new TypeError('qualification repair must remain qualification_fixture-only GitHub-hosted evidence');
  }

  return freeze({
    schemaVersion: 1,
    eligible: true,
    changedPaths: paths,
    profile: candidateState.profile,
    planFloorGroupIds: REQUIRED_PLAN_FLOOR,
    requiredGroupIds: EXECUTED_DETERMINISTIC_GROUPS,
    browserProof: QUALIFICATION_REPAIR_BROWSER_PROOF,
    requiredDataCapabilities: REQUIRED_DATA_CAPABILITIES,
    retryPolicy: { retries: 0 },
  });
}

export function classifyQualificationRepairStatuses(statuses) {
  if (!Array.isArray(statuses)) throw new TypeError('qualification repair statuses must be an array');
  const matches = statuses.filter((status) => status?.context === 'atlas-protected-product-qualification');
  if (matches.length === 0) return freeze({ applicable: false });
  if (matches.length !== 1 || matches[0]?.state !== 'success') {
    throw new TypeError('qualification repair evidence is present but not one authoritative success');
  }
  return freeze({ applicable: true, status: matches[0] });
}

export function independentlyVerifyQualificationProduct(root, manifest) {
  if (!root || !manifest || typeof manifest !== 'object') throw new TypeError('qualification product proof is invalid');
  const entries = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new TypeError(`qualification product contains symlink: ${relative}`);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && relative !== 'fixture-manifest.json') {
        const bytes = fs.readFileSync(absolute);
        entries.push({ path: relative, bytes: bytes.length, digest: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}` });
      } else if (!entry.isFile()) throw new TypeError(`qualification product contains unsupported entry: ${relative}`);
    }
  };
  walk(root);
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const productDigest = `sha256:${crypto.createHash('sha256').update(Buffer.from(canonicalJson(entries))).digest('hex')}`;
  if (canonicalJson(entries) !== canonicalJson(manifest.files) || productDigest !== manifest.productDigest) {
    throw new TypeError('qualification product manifest does not match independently enumerated bytes');
  }
  return freeze({ entries, productDigest });
}

export function validateQualificationRepairProductRepin({ protectedIdentities, candidateIdentities, rebuiltProductDigest, protectedMirrorText, candidateMirrorText } = {}) {
  const protectedProducts = structuredClone(protectedIdentities);
  const candidateProducts = structuredClone(candidateIdentities);
  const digest = /^sha256:[0-9a-f]{64}$/.test(rebuiltProductDigest ?? '') ? rebuiltProductDigest : null;
  if (!protectedProducts || !candidateProducts || !digest || typeof protectedMirrorText !== 'string' || typeof candidateMirrorText !== 'string') {
    throw new TypeError('qualification repair product repin does not match rebuilt candidate product');
  }
  const oldDigest = protectedProducts.qualification_fixture?.digest;
  if (!/^sha256:[0-9a-f]{64}$/.test(oldDigest ?? '') || candidateProducts.qualification_fixture?.digest !== digest) {
    throw new TypeError('qualification repair candidate digest is not the rebuilt product digest');
  }
  const expected = structuredClone(protectedProducts);
  expected.qualification_fixture = { ...expected.qualification_fixture, digest };
  if (canonicalJson(candidateProducts) !== canonicalJson(expected)) {
    throw new TypeError('qualification repair product identity repin changes more than qualification_fixture.digest');
  }
  const occurrences = protectedMirrorText.split(oldDigest).length - 1;
  if (occurrences !== 1 || candidateMirrorText !== protectedMirrorText.replace(oldDigest, digest)) {
    throw new TypeError('qualification repair identity mirror changes more than the exact digest');
  }
  return freeze({ schemaVersion: 1, productDigest: digest });
}


const CONTROL_PLANE_BOOTSTRAP_PATHS = new Set([
  '.github/workflows/merge-group-gate.yml',
  '.github/workflows/merge-authority-audit.yml',
  '.github/workflows/protected-qualification-repair.yml',
  'tools/governance/verify_extraction_provenance.py',
  'tools/verification/qualification-repair-policy.mjs',
]);

export function validateQualificationRepairControlPlaneBootstrap({ changedPaths, protectedFixtureShape } = {}) {
  const paths = exactStringArray(changedPaths, 'qualification repair bootstrap changed paths');
  if (!paths.includes('tools/verification/qualification-repair-policy.mjs')
    || paths.some((path) => !CONTROL_PLANE_BOOTSTRAP_PATHS.has(path) && !VERIFICATION_REGRESSION.test(path))) {
    throw new TypeError('qualification repair bootstrap scope is not the closed control-plane repair set');
  }
  const shape = protectedFixtureShape;
  if (!shape || shape.fixtureId !== 'atlas-qualification-world-v2'
    || shape.creatureCount !== 12 || shape.creatureRegionCount !== 1 || shape.semanticRecordCount !== 1) {
    throw new TypeError('qualification repair bootstrap protected base no longer has the narrow pre-fix fixture');
  }
  return freeze({ schemaVersion: 1, eligible: true, mode: 'self-retiring-narrow-fixture-control-plane-bootstrap', changedPaths: paths });
}


const GIT_BLOB = /^[0-9a-f]{40}$/;
function replaceExactlyOnce(source, pattern, replacement, label) {
  const matches = source.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? [];
  if (matches.length !== 1) throw new TypeError(`${label} must occur exactly once`);
  return source.replace(pattern, replacement);
}

export function validateQualificationRepairBootstrapPinRotations({ protectedVerifierText, candidateVerifierText, protectedAuditText, candidateAuditText, candidateGateText, candidateGateBlob, candidateVerifierBlob } = {}) {
  for (const [label, value] of Object.entries({ candidateGateBlob, candidateVerifierBlob })) {
    if (!GIT_BLOB.test(value ?? '')) throw new TypeError(`${label} must be a lowercase 40-character git blob`);
  }
  const gitBlob = (text) => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${Buffer.byteLength(text)}\0`), Buffer.from(text)])).digest('hex');
  if (gitBlob(candidateGateText) !== candidateGateBlob || gitBlob(candidateVerifierText) !== candidateVerifierBlob) throw new TypeError('candidate pin blob does not match supplied bytes');
  const verifierMatch = protectedVerifierText.match(/MERGE_GROUP_GATE_BLOB = "([0-9a-f]{40})"/g) ?? [];
  if (verifierMatch.length !== 1) throw new TypeError('protected verifier gate pin must occur exactly once');
  const expectedVerifier = replaceExactlyOnce(protectedVerifierText, verifierMatch[0], `MERGE_GROUP_GATE_BLOB = "${candidateGateBlob}"`, 'protected verifier gate pin');
  if (candidateVerifierText !== expectedVerifier) throw new TypeError('candidate provenance verifier changes more than the exact gate pin');
  const gateMatches = protectedAuditText.match(/EXPECTED_MERGE_GROUP_GATE_BLOB: "([0-9a-f]{40})"/g) ?? [];
  const verifierMatches = protectedAuditText.match(/EXPECTED_PROVENANCE_VERIFIER_BLOB: "([0-9a-f]{40})"/g) ?? [];
  if (gateMatches.length !== 1 || verifierMatches.length !== 1) throw new TypeError('protected audit pins must each occur exactly once');
  const expectedAudit = replaceExactlyOnce(replaceExactlyOnce(protectedAuditText, gateMatches[0], `EXPECTED_MERGE_GROUP_GATE_BLOB: "${candidateGateBlob}"`, 'audit gate pin'), verifierMatches[0], `EXPECTED_PROVENANCE_VERIFIER_BLOB: "${candidateVerifierBlob}"`, 'audit verifier pin');
  if (candidateAuditText !== expectedAudit) throw new TypeError('candidate merge authority audit changes more than exact pin rotations');
  return freeze({ schemaVersion: 1, eligible: true, candidateGateBlob, candidateVerifierBlob });
}

````
