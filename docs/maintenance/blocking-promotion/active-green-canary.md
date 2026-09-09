# Blocking Promotion active green canary

This documentation-only candidate proves that the source-bound selective verification workflow is actively required on protected `main` for both pull-request and Merge Queue admission.

Expected selective semantics: no product verification groups, zero commands, and `execute` skipped while the required workflow itself completes successfully.
