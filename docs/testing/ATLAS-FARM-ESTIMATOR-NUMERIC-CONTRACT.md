# Atlas Farm Estimator numeric contract

Lifecycle authority: `Oteryn/Oteryn-Atlas#114`.

The Farm Explorer estimator is deterministic Atlas-derived `ESTIMATE` logic. It never upgrades a Game-published probability, quantity model, KPH assumption, or task requirement into a stronger factual claim.

## Supported stochastic processes

Probability thresholds are enabled only for:
- a stationary IID per-qualifying-kill Bernoulli process with exact rational success probability and fixed positive success quantity; or
- a stationary IID exact finite per-kill quantity PMF whose probabilities sum exactly to one as rationals.

Stateful, pity, first-kill, sequence-dependent, player-dependent, bounded-unknown, or otherwise unproven processes return `UNAVAILABLE` for exact completion thresholds.

## Numeric envelope

The executable envelope is exported as `FARM_NUMERIC_ENVELOPE` from `src/browser/farm-intelligence.mjs`:
- target quantity: at most `100000` for fixed Bernoulli;
- binomial threshold search: at most `1000000000` qualifying kills;
- exact PMF target: at most `5000` items;
- exact PMF outcomes: at most `128`;
- exact PMF threshold iterations: at most `200000` kills;
- exact PMF transition work: at most `20000000` state transitions.

## Algorithms and verified numerical error

Fixed-Bernoulli completion tails are evaluated without factorials. The implementation uses `log1p`/`expm1` for the one-success tail, log-space recurrence with scaled summation for the general binomial CDF complement, and a bounded integer binary search for the minimum completion threshold.

Exact finite PMFs use two separate deterministic recurrences: an absorbing hitting-time recurrence for expected kills, and bounded forward convolution for P50/P80/P95 thresholds. No Monte Carlo result is accepted as a deterministic oracle.

For the small independent binomial oracle cases, the reference probability comparison margin is `1e-12` and the final P50/P80/P95 integer threshold must match exactly. The rare-drop case is additionally checked against an independent closed-form `log1p` oracle. The near-one/large-target case verifies exact minimum thresholds and expected-kill absolute error below `1e-9`.
