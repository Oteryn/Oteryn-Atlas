# Verification capability placement

Load before choosing a verification profile, data capability or runner, or performing specialist/nightly verification. The active maintenance freeze in root `AGENTS.md` remains controlling; this procedure does not restore suspended tests or authorize a workflow change.

- Verification profile (`none`, `focused`, `targeted`, `broad`, `full`) and data capability (`qualification_fixture`, `bounded_real_world`, `real_fullworld`) are independent. `profile=full` does not imply `real_fullworld`.
- GitHub-hosted CI owns ordinary functional E2E against the smallest immutable source that proves the oracle. `bounded_real_world` is only for bounded compatibility checks that depend on selected real bytes.
- Molehill-PC (`oteryn-molehill-atlas`, label `oteryn-atlas-pc`) is specialist-only for a protected plan that requires complete-product bytes, native Windows/GPU, restricted visual review, or another approved specialist capability. Its PowerShell steps use `powershell`.
- `real_fullworld` is reserved for complete publication/census/root linkage, generator/compiler determinism, full-product scale/performance/soak, overview/minimap consistency, or explicit release acceptance.
- Synology (`oteryn-synology-atlas`, label `oteryn-atlas`) is limited to trusted merged-main deployment and live acceptance. It is not an ordinary build/E2E farm or a substitute for Molehill.
- Unavailable specialist capacity blocks only the selected specialist proof. Do not move it to Synology, reuse stale evidence, or weaken failure semantics.
- Nightly specialist depth is additive and must remain read-only. It fails closed unless `X-Oteryn-Atlas-Revision` equals the exact nightly SHA before and after execution, and it must not share concurrency in a way that can cancel deployment.
