# Maestro Template v0.2.0-alpha.4

Canonical SaaS UI foundation release for generated customer applications.

## What changed

- Generated targets use the checked-in SaaS UI paved path and pattern catalog.
- Generated features expose a client-safe Confect React ref projection.
- Workspace dashboards use the canonical `_app/$workspace/_dashboard` route.
- Generated feature transactions materialize in isolated customer targets.
- Starter UI states retain static accessible names and typed error/success
  feedback.

## Compatibility and environment

- Node 22 and the checked-in pnpm lockfile are required.
- No new environment variables, live provider credentials, data migrations, or
  provider changes are required.

## Migration and rollback

No data migration is required. See
[migrations/README.md](./migrations/README.md). Roll back to the immutable
`maestro-template-v0.2.0-alpha.3` tag; customer data is unchanged.
