# Maestro Template v0.2.0-alpha.5

Non-destructive provenance repair for the canonical SaaS UI foundation release.

## What changed

- Preserves the Alpha.4 canonical SaaS UI foundation bytes without product
  changes.
- Binds the customer release source to a commit that remains an ancestor after
  the normal squash merge.
- Restores detached-tag materialization through the canonical create path.

## Compatibility and environment

- Node 22 and the checked-in pnpm lockfile are required.
- No new environment variables, live provider credentials, data migrations, or
  provider changes are required.

## Migration and rollback

No data migration is required. See
[migrations/README.md](./migrations/README.md). Roll back to the immutable
`maestro-template-v0.2.0-alpha.4` tag; customer data is unchanged.
