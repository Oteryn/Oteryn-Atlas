# Synology Desktop Commander access

Status: **VERIFIED** on 2026-08-18 via Remote Desktop Commander.

## Canonical operational identity

For Oteryn Atlas work that needs the Synology host through Desktop Commander, use the dedicated account below unless a task explicitly requires another identity:

- host reported by the session: `Synology`
- user: `chagpt`
- UID: `1032`
- home: `/var/services/homes/chagpt`

A separate Synology connection for user `Bartek` (UID `1026`) was also observed during verification, but it is **not** the default identity for agent work.

## Revalidation rule

Desktop/terminal sessions are runtime state, not permanent repository authority. Before destructive, privileged, security-sensitive, or long-running Synology operations, revalidate the live target identity with Desktop Commander by checking at least:

```sh
hostname
whoami
id -u
printf '%s\n' "$HOME"
```

Expected values for the default agent identity are `Synology`, `chagpt`, `1032`, and `/var/services/homes/chagpt` respectively.

## Security boundary

Do not commit passwords, tokens, cookies, private keys, session secrets, or other credentials. Device/session identifiers are runtime details and are not treated as canonical access configuration.
