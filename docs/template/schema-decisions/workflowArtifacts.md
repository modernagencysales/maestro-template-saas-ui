# WorkflowArtifacts Schema Decision

Canonical system: `workflow-runtime` Disposition: `extend` Status: additive

## Purpose

Large workflow inputs and outputs referenced by ID.

## Data Contract

- Tenant scope: `workspace`
- Sensitivity: `confidential`
- PII categories: none
- Export: `redacted-json`
- Delete/redaction: `delete`
- Retention: `retain-audit-window`
- Append-only: `true`; a stable run reference can only resolve to identical
  content
- Write authority: `packages/convex/confect/workflows`

## Migration And Rollback

The table is additive and existing small workflow runs require no backfill.
Artifacts retain tenant/run/version/generation ownership and cannot be deleted
until product cleanup is complete and every current run/reference retention
anchor has expired. Roll back artifact-producing callers before removing the
table; retained rows remain readable through the tenant-safe capability during
the compatibility window.
