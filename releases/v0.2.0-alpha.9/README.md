# Maestro Template v0.2.0-alpha.9

Verified complete Saas UI Starter shell for generated Maestro customer apps.

## What changed

- Binds every mechanically adapted Starter file to its generated destination
  hash so customer provenance checks cover the actual shipped shell.
- Restores production `maestro create` verification for the complete pinned
  Starter shell and neutral frozen lockfile.
- Keeps factory-only workflow tooling omitted and inherited release-path
  authority replacement intact.

## Compatibility and environment

- Node 22 and the checked-in pnpm lockfile are required.
- No new environment variables, live provider credentials, data migrations, or
  provider changes are required.

## Migration and rollback

No data migration is required. See
[migrations/README.md](./migrations/README.md). Roll back to the immutable
`maestro-template-v0.2.0-alpha.8` tag; customer data is unchanged.
