# Security Policy

## Reporting

Report suspected vulnerabilities through GitHub private vulnerability reporting for `Oteryn/Oteryn-Atlas`. Do not publish exploit details, credentials or sensitive evidence in public Issues.

## Scope

Security-sensitive Atlas surfaces include semantic-data ingestion, browser parsing/rendering, generated publication artifacts, dependency/update trust and asset provenance. Oteryn-Game remains authoritative for gameplay/world truth.

## Expectations

- Treat external semantic inputs as untrusted and bounded.
- Keep browser/runtime authority on normalized Atlas projection data only.
- Pin third-party GitHub Actions to immutable commit SHAs.
- Never commit secrets, credentials, private data, raw legacy runtime inputs or assets without confirmed publication rights.
- Preserve deterministic provenance and integrity checks for generated/publication artifacts.