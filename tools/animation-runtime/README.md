# Atlas animation runtime product

This directory builds and verifies the derived browser product for Game-owned exact-15.32 animation semantics.

The product is generated from `Oteryn/Oteryn-Game@8f6a4fdea4487a61c4cdaf1889d421ecd2265a31` `animated-appearances-v1`, `animated-creatures-v1`, and the exact 15.32 ZIP. Atlas never decodes DAT/SPR/OTBM in browser runtime.

The accepted product root is `sha256:43ca727af914da89bba591a9e3c7324bfc72ffe96bd4ba0524bdf71a6c6a4caf`.

The generated RGBA packs are **private preview/validation material only**. This tool does not widen the existing bounded DYN-ATLAS-001 public-pixel authorization into full-world redistribution rights. Generated packs are never committed or uploaded as public CI artifacts.

`verify_product.py` recomputes the manifest root, every declared file identity and every referenced RGBA content identity. Corruption fails closed.
