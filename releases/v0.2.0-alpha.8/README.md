# Maestro Template v0.2.0-alpha.8

Verified complete Saas UI Starter shell for generated Maestro customer apps.

## What changed

- Publishes the repaired Alpha.7 customer artifact from a reviewed release head
  whose immutable tag preserves sealed-source ancestry.
- Restores production `maestro create` verification from the published tag while
  retaining the complete pinned Starter shell and neutral frozen lockfile.
- Keeps factory-only workflow tooling omitted and inherited release-path
  authority replacement intact.

## Compatibility and environment

- Node 22 and the checked-in pnpm lockfile are required.
- No new environment variables, live provider credentials, data migrations, or
  provider changes are required.

## Migration and rollback

No data migration is required. See
[migrations/README.md](./migrations/README.md). Roll back to the immutable
`maestro-template-v0.2.0-alpha.7` tag; customer data is unchanged.
