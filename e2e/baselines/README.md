# Atlas targeted visual baselines

These baselines are deliberately narrow. They cover stable controls and do not replace geometry, framebuffer, or renderer-state oracles.

Generation contract:
- browser: repository-pinned Playwright Chromium image from `e2e/playwright.config.mjs`;
- viewport/DPR: the named Playwright project;
- locale: `en-US`;
- timezone: `UTC`;
- animations: disabled for snapshot assertions;
- update policy: baseline changes are reviewed source changes; CI never auto-accepts new pixels.

Do not add broad full-page map snapshots. WebGL/world correctness belongs to geometry and framebuffer probes; visual baselines should remain small, stable, and high-signal.
