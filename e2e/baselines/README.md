# Atlas targeted visual baselines

These baselines are deliberately targeted. They cover stable controls plus selected composite Atlas-owned user-visible surfaces such as the inspector and mobile drawers; they do not replace geometry, framebuffer, renderer-state or user-facing full-frame review oracles.

Generation contract:
- browser: repository-pinned Playwright Chromium image from `e2e/playwright.config.mjs`;
- viewport/DPR: the named Playwright project;
- locale: `en-US`;
- timezone: `UTC`;
- animations: disabled for snapshot assertions;
- update policy: baseline changes are reviewed source changes; CI never auto-accepts new pixels.

Do not turn broad full-page screenshots into fragile pixel-equality gates. WebGL/world correctness belongs to geometry and framebuffer probes. Full-frame evidence is captured separately for local user-facing visual acceptance and must be reviewed on the exact tested revision; it is not committed as a raster baseline. Blocking pixel baselines remain Atlas-owned, stable, bounded and high-signal.
