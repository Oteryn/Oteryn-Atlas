# Issue #35 — Atlas runner-group access proof

Status: `VALIDATING`

This record proves effective scheduling isolation for the Atlas organization runner group without claiming direct readback of the GitHub organization settings UI.

## Positive provider evidence

- Dedicated runner contract: `atlas-runners` / `oteryn-atlas` / `oteryn-synology-atlas`.
- Existing trusted-main live workload proof: run `32526864123`, job `96911114022`, `SUCCESS`.
- The bounded allow canary on this branch must run only in `Oteryn/Oteryn-Atlas` and performs no checkout, Docker mutation, product mutation, secret access or deployment.

## Negative cross-repository evidence

- `Oteryn/Oteryn#42` targets the same `atlas-runners + oteryn-atlas` selector from META.
- Its canary contains no checkout and exits `97` immediately if the unauthorized repository ever reaches the Atlas runner.
- Final classification requires the Atlas allow canary to complete while the META canary remains unscheduled.

## Direct settings readback

The currently connected GitHub repository API does not expose organization runner-group `Selected repositories` readback. Therefore this evidence will distinguish:

- `PROVEN`: effective positive/negative scheduling behavior;
- `UNKNOWN`: literal settings-page dropdown value, unless a later authorized organization API surface returns it.

The temporary allow-canary workflow is removed before merge; this file is the retained evidence record.