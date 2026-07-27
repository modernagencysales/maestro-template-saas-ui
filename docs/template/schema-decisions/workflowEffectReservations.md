# WorkflowEffectReservations Schema Decision

Canonical system: `workflow-runtime` Disposition: `extend` Status: active

## Purpose

Record append-only authorization and reconciliation evidence for one logical
external workflow effect. The resource prevents duplicate dispatch across
retry/restart generations without persisting raw provider requests or results.

## Data Contract

- Tenant scope: `workspace`
- Sensitivity: `confidential`
- PII categories: none
- Export: `redacted-json`
- Delete/redaction: `retain-audit`
- Retention: `retain-audit-window`
- Append-only: `true`
- Write authority: `packages/convex/confect/workflows`

Each row pins the workspace, workflow/run/version/generation, stable step,
logical effect key, generated capability ref, one of the three supported retry
strategies, guard results, transition state, dedupe/restart horizons, and an
optional hashed provider correlation value. There is deliberately no provider
payload field.

## Indexes

- `by_workspace_effect` resolves the full append-only history for a workspace
  and logical effect before dispatch.
- `by_workspace_state_expiry` supports bounded reconciliation/expiry work.
- `by_run_generation_step` projects effect evidence for one durable step.

## Migration And Rollback

This is a new additive table, so there is no existing-data backfill and no
widen/narrow migration. Runtime code must land only after generated schema
registration succeeds.

Rollback disables new automatic retry/dispatch first. Existing reservation and
ambiguous-effect rows remain readable until their declared dedupe and restart
horizons expire and reconciliation reaches a terminal or manual-review state;
rollback must not delete or reinterpret unresolved evidence.

The necessity query is the indexed lookup by workspace and logical effect key
performed before an external-effect dispatch. `workflowRuns` cannot answer
whether a particular external business effect was accepted, ambiguous, or safe
to redispatch.
