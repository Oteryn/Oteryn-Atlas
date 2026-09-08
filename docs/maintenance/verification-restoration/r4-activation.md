# R4 structural preparation and shadow activation

Status: structural preparation for PR #396. R4 is incomplete; R5 is not authorized.
Protected base: `67dab78fb1bdae4221b3e4512ce0e8f4b4d6d326`.
This candidate adds no active workflow. The existing three workflows and required
checks are unchanged.

## Exact transition

1. Integrate the reviewed structural preparation: the frozen maintenance validator,
   dormant `tools/maintenance/verification-shadow.yml`, the exact restoration rules,
   and the runtime/tests in this PR. The old protected gate intentionally rejects
   this preparation because its maintenance authority cannot authorize its own
   replacement. This step needs an explicit protected-owner transition; R4 task
   authorization alone does not authorize a bypass or a ruleset change.
2. A separate ordinary PR adds only `.github/workflows/verification-shadow.yml`,
   byte-identical to the template then present in protected base. The new validator
   admits this exact fourth workflow for both PR and MQ and rejects other workflow
   additions, changes, removals, renames, archive edits, template self-edits,
   validator self-edits, and unrelated frozen code. The original three workflows
   must remain byte-identical and regular files.
3. Qualify S0, S1, S2, S3 and an actual MQ execution using fresh exact-head runs.
   Do not treat local tests, a template, or an unconsumed receipt as activation.

The rule inventory increases from 97 to 104 exact paths. New runtime additions
are the shadow runner, selected-gameplay source verifier and HTTP harness; four
existing source/environment/spec paths gain explicit modification authority.
There is no wildcard control-plane admission. Candidate changes still cannot
modify the validator, template or allowlist through ordinary maintenance review.

## One workflow, protected execution

The dormant workflow listens to `pull_request_target` and to completion of the
existing `Atlas maintenance Merge Queue gate`. The latter uses `workflow_run`,
so candidate merge-group YAML does not supply the shadow executable workflow.
The protected runner reads back the parent run, requires merge_group/success/
attempt 1 and the exact gate path, and compares its workflow bytes with protected
base. It binds the synthetic head, first-parent base and workflow source revision.
It accepts a just-integrated head but rejects unrelated main drift or rollback.
The current run is also read back through the GitHub API. PR run `head_sha` is
bound to the candidate (GitHub reports that field separately from the protected
workflow source); workflow_run binds its default-branch source revision.

The planner recomputes changed-file obligations from protected catalog, impact
manifest and stable IDs. S0 produces `NO_PRODUCT_WORK` with zero product jobs.
The product job recomputes the contract; candidate policy/config never supplies
commands. The bounded browser scope is only `e2e.layer-availability` and
`integration.source-contract-http`; unsupported obligations fail unresolved.

S1 uses a pinned image, UID/GID 1000, readonly root and candidate mounts, no network,
no capabilities or credentials, bounded resources, and zero retries. Dependencies
are a nested readonly mount; the host never creates a symlink in the candidate.
The host checks actual Docker inspect state and records exact command/spec census,
exit, signal, timeout, image/container identity and output digest. This is process
and spec evidence, not a claim of Python assertion tracing or arbitrary hostile
in-process test census. The ADD regression uses a temporary test fixture so the
real candidate tree stays readonly.

S2 builds and verifies the existing qualification product, then uses the existing
protected Compose harness, one worker, retries 0, and exact stable test selection.
Candidate web/source bytes are inert input; executable test/harness bytes are from
protected base. S3 uses the protected HTTP-only test described below.

A compact job summary is provisional until external readback verifies the final
run/attempt/jobs, actual workflow source bytes against protected template, required
maintenance audit/gate on the same head, and exact head/tree/base/plan/command
census. Failure stays visible in the nonblocking shadow job. No shadow check is
made required. No deploy, publication, FullWorld generation, RDM or Molehill is
introduced.

## Real selected gameplay source

The source is available and reconstructed; the earlier missing-input blocker is
resolved. The unchanged Game exporter and identity helper are pinned at
`Oteryn/Oteryn-Game@b56ce339281d252a9e01a5a2bed583582bf29e68`.
Sam and Rat are legacy input evidence at
`blakinio/Otheryn@e417c5e7c22986bf4acef0495eb47f7b72c97cce`.
The protected module records all four repository paths, Git blobs, byte lengths
and SHA-256 hashes; no caller can replace the producer command or expected outputs.

A fresh temporary-root Python execution with a stripped environment creates exactly one manifest and two shards.
Every output is checked against its protected byte hash and census. Their semantic
digest is `sha256:be06f49180535bcc764579209370cb5f1edafe2c7882e3380fb9cbdb807c153f`.
These are Game-producer-derived selected gameplay facts, not committed canonical
Game output bytes and not a map/publication product. The proof expressly declares
`mapAuthority: false`, `completeWorld: false`, and `candidateProductEvidence: false`.
No selected-product proof can authorize another bounded browser or FullWorld group.

The real protected HTTP test runs the existing source-contract spec with fixed
`selected-gameplay-v1` mode, one worker and zero retries. Its two exact stable IDs,
all four GET requests, status codes and passing result census are checked. The
server exposes only the exact three verified paths.

## Validation and remaining evidence

- Independent source reconstruction rejected each individual input and output
  mutation. The integrated source producer plus actual Playwright HTTP execution
  passed 2 tests, 0 skipped/unexpected/flaky, with all four expected HTTP requests.
- The qualification fixture builds and verifies 86 files with product digest
  `sha256:ded7f9c2fce9a9b7a8e327abd7f8766bbb97ee60b49d96081b8ee1bb787a5021`.
- Independent local mode-enforced compatibility probe ran all 202 existing
  deterministic commands successfully. UID 0 lacked DAC override; create/append
  probes returned EACCES. This is not UID1000/Docker qualification.
- New admission tests exercise positive and adversarial PR/MQ parity. Runtime
  tests cover event spoofing, source drift, exact S0/S2/S3 routing, malformed source
  evidence, retries/skips/census, and actual container-attestation mutations.
- The local environment has no Docker daemon. Actual pinned Docker execution,
  GitHub-hosted S2, fresh S0/S1/S3 runs, external final evidence acceptance and
  actual MQ shadow remain mandatory after the protected-owner transition.
