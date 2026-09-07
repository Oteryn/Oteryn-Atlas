# Live deployment and acceptance

Load before any separately authorized deployment, live acceptance or rollback. The active maintenance freeze in root `AGENTS.md` remains controlling; these retained procedures are not permission to publish, deploy or mutate a live system.

- Live deployment originates only from a clean, merged `main` revision selected by GitHub Actions. Task branches and detached experimental revisions are never deployment sources.
- The deployed revision must match both the live container `org.oteryn.revision` label and the `X-Oteryn-Atlas-Revision` header before acceptance.
- Historical Atlas SHAs are not live deployment targets. Emergency rollback may restore only a previously merged `main` revision and must be requalified.
