# DYN-ATLAS-001 — Synology semantic Atlas preview

Classification: **DELIVERY PREVIEW — NOT WORLD AUTHORITY OR PRODUCTION SLO**.

## Exact runtime revision

```text
repository = Oteryn/Oteryn-Atlas
runtime revision = 0b4a802cff408f9fc7c53509b9f071b1928c783c
exact-head CI run = 32222917103 (SUCCESS)
preview URL = http://192.168.1.2:8096/web/index.html?x=32377&y=32238&floor=-7&zoom=2
```

The preview serves the new semantic Atlas runtime only. The pre-existing legacy/older preview `oteryn-atlas-preview` remains isolated on `192.168.1.2:8095` and was not modified.

## Live Synology revalidation

Before mutation the authorized Remote Desktop Commander session reported:

```text
user = chagpt (uid 1032)
host = Synology
Docker Server = 24.0.2
old Atlas preview = 192.168.1.2:8095
new target port 8096 = free
```
## Deployed identities

The exact GitHub revision archive was downloaded into a revision-specific directory before the running container was switched. The deployed bytes were checked before start:

```text
semantic root = sha256:6d5c452c8bff7c74345f489db8b5ba1d3f52947a68673099bde73052159d6fc1
pixel root = sha256:91bbce72598fc3887d8e0d454d03d0aa5cc4d9ef0d30c3848e3ab1b711ede70a
pixel pack SHA-256 = 4f0b32786dc7601764c8a2596bc1ab49a24881d9778ecb4f54c894b113d84d62
pixel pack bytes = 7,725,056
```

Runtime container:

```text
name = oteryn-atlas-semantic-preview
host binding = 192.168.1.2:8096 -> container 8080/tcp
revision label = 0b4a802cff408f9fc7c53509b9f071b1928c783c
source mount = revision-specific repository tree, read-only
nginx config SHA-256 = 790a71f6e7371542ad784fe2472386fb05a00feae794687027979d3c97feb722
```

The preview-specific nginx configuration maps `.mjs` to `application/javascript`; the first LAN qualification intentionally caught the default nginx `application/octet-stream` MIME mismatch and the isolated preview configuration was corrected rather than weakening browser module checks.
## Independent client verification

`Molehill-PC` verified HTTP 200 from the LAN endpoint and then ran Chrome 151.0.7922.140 against the Synology URL with normal insecure-LAN semantics: no `--unsafely-treat-insecure-origin-as-secure` override was used.

The first normal-LAN Chrome run exposed that WebCrypto `crypto.subtle` is unavailable outside a secure context. Atlas failed closed as designed. Revision `0b4a802cff408f9fc7c53509b9f071b1928c783c` therefore adds and tests a portable SHA-256 implementation used only when WebCrypto is unavailable; verification identities and algorithms remain SHA-256 and are not weakened.

Final independent Chrome result:

```text
PC_HTTP = PASS (HTTP 200)
PC_CHROME_SYNOLOGY = PASS
DOM bytes = 8,118
Chrome stderr bytes = 0
runtime badge = VERIFIED · WEBGL2
semantic chunks = 30 / 30
draw calls = 1
```

This preview is LAN delivery evidence only. It does not add public DNS, Cloudflare, production routing, Game authority, or full-world claims.
