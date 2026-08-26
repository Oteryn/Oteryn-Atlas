# Heavy E2E slot benchmark — 2026-08-25

Benchmark candidate: `ca6059f9ab56202f838960bd5b2c236b89375498`.
Publication origin: `http://192.168.1.2:8097`, revision `f48edc9170708b341df06339cae6cc113985dce8` before and after every group.
Every full gate used Playwright `workers=1`, retries remained `0`, and the benchmark held the legacy migration fence across all timed groups.

| Concurrent slots | Run result | Wall time | Throughput | Minimum free RAM |
| ---: | --- | ---: | ---: | ---: |
| 1 | 71/71 PASS | 1552.450 s | 2.319 gates/h | 17.24 GiB |
| 2 | 2 × 71/71 PASS | 1833.577 s | 3.927 gates/h | 25.91 GiB |
| 3 | 3 × (70 PASS + 1 timed out) | 2219.226 s | 4.867 attempted gates/h | 23.26 GiB |

At three slots every process independently timed out the same scenario after the unchanged 120 s limit: `tests/user-journey-mobile.spec.mjs:153` — `mobile seeded exploratory user session is replayable and checks invariants after every action`.
No retry, timeout, tolerance, worker-count or product assertion was weakened to make three slots pass.

The measured safe default is therefore **2 concurrent heavy E2E slots**. This improves successful full-gate throughput by about 69% over one slot while preserving 71/71 PASS in both simultaneous processes. Three slots remain explicit opt-in capacity for diagnostics, not the repository default.

Two benchmark bookkeeping defects discovered during measurement are excluded from the capacity decision and permanently fixed by contract tests: Windows PowerShell `Start-Process -PassThru` with redirected output did not expose a usable `Process.ExitCode`, and unavailable `Win32_Processor.LoadPercentage` samples were previously coerced to `0`. The final harness records a child-owned exit-code evidence file and represents unavailable CPU telemetry explicitly instead of inventing zero utilization.
