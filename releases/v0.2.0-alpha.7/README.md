# Maestro Template v0.2.0-alpha.7

Installable complete Saas UI Starter shell for generated Maestro customer apps.

## What changed

- Omits factory-only `tooling/workflow` files from generated customer targets so
  a frozen install matches the neutral customer lockfile.
- Lets explicit release authority replace inherited path classifications rather
  than retaining conflicting duplicate classifications.
- Adds regression coverage for both production customer creation and release
  sealing at the repaired factory/customer boundary.

## Compatibility and environment

- Node 22 and the checked-in pnpm lockfile are required.
- No new environment variables, live provider credentials, data migrations, or
  provider changes are required.

## Migration and rollback

No data migration is required. See
[migrations/README.md](./migrations/README.md). Roll back to the immutable
`maestro-template-v0.2.0-alpha.6` tag; customer data is unchanged.
