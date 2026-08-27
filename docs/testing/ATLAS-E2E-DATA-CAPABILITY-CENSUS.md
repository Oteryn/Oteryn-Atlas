# Atlas E2E data-capability census

This census separates *verification profile* from the minimum immutable data
capability consumed by each oracle. `profile=full` does not imply
`real_fullworld`.

| Capability | Meaning | Current cases |
| --- | --- | ---: |
| `qualification_fixture` | Contract-valid, immutable minimal world; same publication, manifest, floor, runtime-index, range and loader path. | 50 |
| `bounded_real_world` | Immutable bounded projection/corpus/pixel slice; production scale is not asserted. | 20 |
| `real_fullworld` | The oracle asserts exhaustive production bytes/census/scale. | 1 |

## Per-spec assignment

The entries below enumerate every current Playwright test by its assertion
subject. Semicolon-separated subjects have the capability immediately before
them; this is intentionally finer than a spec-file label.

- `accessibility-desktop`: Q controls names; Q keyboard search/zoom; Q keyboard mode/playback.
- `accessibility-mobile`: Q drawer focus/hidden state; Q portrait/landscape touch reachability.
- `api-contract-desktop`: B semantic API diagnostics; B published records through search.
- `audit-desktop`: Q controls/LOD modes; Q coordinate, wheel and drag pan.
- `audit-mobile`: Q drawer and mode transitions.
- `creature-interaction-desktop`: Q NPC geometry activation; B fixed monster overlap/card; Q details/copy; Q stale-geometry invalidation; Q hidden placement.
- `creature-interaction-mobile`: Q NPC tap; Q monster tap; Q details/escape stack.
- `creature-presentation-desktop`: B mixed presentation scene; B role/filter facts; B dense names/edges; B LOD; B selection/camera/floor/animation lifetime.
- `creature-presentation-mobile`: B DPR2 factual badges/card; B AUTO detail/minimap labels.
- `creatures-desktop`: Q controls/persistence; B Sam search/deep-link; Q NPC category/icons; Q repaint during pan.
- `degraded-search-desktop`: Q semantic outage; Q creature-catalog outage; Q malformed schema/stale state.
- `desktop`: B Thais navigation and representative verified range.
- `farm-explorer-desktop`: B Cave Rat fixed-ID/URL flow.
- `farm-explorer-mobile`: B Cave Rat flow.
- `geometry-desktop`: Q continuous-pan commit pairing; Q floor isolation/deep-link reload.
- `geometry-mobile`: Q portrait/landscape geometry.
- `layer-audit-desktop`: Q availability/fail-closed controls.
- `mobile`: B Sam semantic navigation.
- `performance-desktop`: B bounded high-density structural budget.
- `race-desktop`: Q reordered range; Q abort; Q resize/toggle; Q reload; Q back-navigation supersession.
- `render-probes-desktop`: Q committed nonblank frame after pan.
- `resilience-desktop`: Q required-publication outage; Q malformed product; Q optional index outage; Q favicon classification; Q stale profile; Q corrupt range.
- `responsive-mobile`: Q control/backdrop resize; Q optional creature controls.
- `scale-desktop`: B search corpus (>50, sampled <=60), not production scale.
- `soak-desktop`: B bounded repeated structural-growth workload.
- `state-desktop`: Q invalid/out-of-bounds state; Q replace-state/reload/history.
- `stress-desktop`: Q seeded renderer/geometry workload.
- `user-journey-desktop`: Q cross-feature session; Q seeded replayable session.
- `user-journey-mobile`: Q touch session; Q seeded replayable touch session.
- `visual-desktop`: B chrome/Thais journey; Q prior-floor isolation; Q NPC playback; Q verified-rectangle playback.
- `visual-fullworld-desktop`: **F full animation coverage census**.
- `visual-mobile`: B chrome/drawers with Thais result; Q local pixel toggle.
- `workflows-desktop`: Q dynamically selected record reload/history.

Only `visual-fullworld-desktop`'s full animation coverage census is
`real_fullworld`: it downloads all `animation/programs.json` bytes and proves
their manifest digest plus the exact production coverage counts. Every other
current oracle either discovers an adequate record or has a bounded asserted
corpus, and must not force a 19-GB publication.
