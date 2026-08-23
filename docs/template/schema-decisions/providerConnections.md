# ProviderConnections Schema Decision

Canonical system: `provider-integrations` Disposition: `extend` Status: approved

## Purpose

Workspace provider authorization and redacted connection status

## Data Contract

- Tenant scope: `workspace`
- Sensitivity: `confidential`
- PII categories: none
- Export: `redacted-json`
- Delete/redaction: `delete`
- Retention: `retain-until-workspace-delete`
- Append-only: `false`
- Write authority: `packages/convex/confect/integrations/connections.impl.ts`

## Migration And Rollback

This is a new table, so no backfill is required. `by_workspace_and_provider` is
the authoritative lookup for one provider generation and
`by_workspace_and_status` supports redacted status projections. Rollback first
removes web callers, then the Confect group, and only then the empty table. A
release with customer rows preserves the table until those rows have been
exported or deleted through the workspace lifecycle.
