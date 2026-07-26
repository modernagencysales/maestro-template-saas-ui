# Workflow Authoring Guide

Workflows compose capabilities. They do not call provider SDKs, repos, or raw
Convex functions directly.

The accepted architecture decision is
[ADR 0002](./adr/0002-maestro-graph-over-convex-workflow.md). Before authoring
or changing a primitive, read the canonical
[Convex workflow compatibility record](./convex-workflow-compatibility.md). It
distinguishes upstream behavior, current implementation gaps, and deliberately
stricter Maestro policy.

Version bumps, immutable publication, retirement, and rollback follow the
[workflow versioning guide](./workflow-versioning.md). Generated application
workflows remain draft until their semantic and publication gates are accepted.

## Workflow Definition

Each workflow declares:

- id, name, description, version;
- durable graph nodes and edges;
- input and output schemas;
- capability refs;
- optional agent refs;
- policy snapshot;
- approval gates;
- idempotency and retry policy;
- audit and observability policy.

## React Flow Boundary

React Flow owns canvas interaction only: drag/drop, selection, viewport,
palette, draft commands, and visual validation hints. Durable graph schemas,
validation, and execution live outside React Flow packages.

## Canvas Boundary

The workflow canvas is a projection of durable workflow graph data. Persisted
workflow records store the graph contract and stage/event ledgers. The web app
derives React Flow nodes and edges from that graph, overlays
`workflowStageRuns`, and saves domain workflow commands rather than raw React
Flow mutations.

## Durable Graph Runner Semantics

The persisted `DurableWorkflowGraph` is the source of truth. React Flow and
other editors are projections over this graph, never the persisted source.

Runtime context:

- The graph runner receives `inputs`, `policySnapshot`, and a generated
  capability registry.
- Each node result is stored under `context[node.id]`.
- Capability node args are `{ inputs, context, node, policySnapshot }` unless a
  later schema task declares a narrower generated args schema.
- Source nodes copy `inputs` into `context[node.id]`.
- Output nodes project `{ inputs, context, policySnapshot }` into a
  Convex-serializable object. The first output node reached becomes the final
  result; if no output node is reached, the full context is returned.
- Agent nodes may only dispatch generated internal capability refs tagged as
  agent seats. They do not call provider adapters or repos directly.

Graph traversal:

- Nodes become ready when all incoming edges without false conditions have
  satisfied source nodes.
- Join nodes must wait for every required incoming source.
- Edges with conditions use the safe expression grammar below; false edges do
  not activate their target.
- Delay nodes call `step.sleep(delayMs, { name })` for stable workflow journal
  naming and return `{ delayedMs }`.
- Approval nodes call `step.awaitEvent({ name })`, where name is
  `${graph.id}.${node.id}.approved`, and return the event payload.
- Capability nodes resolve `node.capability` through the generated capability
  registry and call only `step.runAction`, `step.runMutation`, or
  `step.runQuery`.

Condition grammar:

- Allowed identifiers: `inputs`, `context`, `policySnapshot`.
- Allowed operators: `===`, `!==`, `&&`, `||`, `!`, parentheses, string and
  number literals.
- No function calls, property writes, constructor access, global identifiers,
  regex literals, or dynamic imports.
- Invalid conditions fail validation before workflow start.

Failures:

- Missing capability refs fail as typed workflow validation errors before
  dispatch.
- Unsupported node kinds fail as typed workflow validation errors.
- Stage observability failures are quarantined; the original workflow failure or
  result is preserved.
- All outputs must be Convex JSON-safe.

## Bounded Repeated Work

Use the current-only bounded-subworkflow-batch V2 node for dynamic repeated
work. Declare positive maxItems, batchSize, and fanOut; bind it to one exact
published child workflow/version through the generated registry; and provide a
typed selectItems plus mapBatchArgs binding. Prefer stable item identities;
ordinal identities are deterministic when no domain identity exists. The runner
rejects overflow, invalid identities, cycles, excess depth/fan-out, version
drift, and oversized mapped args before starting a child. It returns an explicit
empty receipt for zero items, uses stable child/link names across replay, and
waits for every started child in a wave to reconcile before advancing. Workpool
remains the only scheduler; scheduled children are still unsupported on 0.4.4.

## Durable Runtime Boundary

Generated workflow replay handlers live in
`packages/convex/convex/workflowRunners/*.ts` and are plain Convex
`defineWorkflow(components.workflow, ...)` handlers. Confect owns start, status,
event, cancel, restart, cleanup, manifest, and capability step contracts. Do not
move replay handlers into Confect impl files: the workflow component is the
durable runtime, while Confect is the typed contract layer around it.

## Tenant-Safe Lifecycle

Generated start results include the tenant-owned `workflowRunId`. Generated
contracts use that ID for authenticated cancel, restart, step pagination, and
cleanup; list and list-by-name results are tenant-filtered, bounded product
projections. Component IDs are never accepted as cross-workspace authority.

Cancellation is cooperative, so an action already running may finish.
Compensation is modeled as a separate explicit workflow. Restart accepts only
the beginning or a unique stable step instance and fails closed until the
selected generation has no exposed Workpool work. Its graph inspection is
generation-scoped and every downstream external action must have a matching
restart-safe reservation with a sufficient dedupe horizon. Query and mutation
steps are not classified as external effects.

Cleanup waits for terminal quiescence, parent/child links, and the longest
required evidence-retention deadline. Retention automation invokes the bounded
`workflows.lifecycle.sweepRetention` control. The product may report
`product-cleaned` after all exposed work is reconciled while separately
recording `component-residuals-unverifiable` for hidden component records. This
is deliberately not a full-deletion guarantee.

Generated `onComplete` context contains only validated, size-bounded stable
workspace, run, workflow-version, and generation identifiers. Reconciliation
accepts each terminal outcome exactly once: an identical replay is a no-op and a
conflicting replay returns a redacted conflict without overwriting the first
accepted result.

## Payloads And Artifacts

Every generated capability measures Convex values before dispatch and before
returning to Workpool. Nodes reserve a fixed maximum inline result or declare
`artifact-reference`; cumulative reservations are checked before execution and
observed sizes are checked after each await. Events, child arguments, completion
context, workflow returns, and product projections have smaller Maestro limits
than their pinned upstream ceilings.

Large values go through the generated `workflowArtifacts` capability. The
durable graph receives only its tenant/run/version/generation-bound artifact ID,
hash, measured size, and sensitivity. Stage records contain bounded receipts,
never the value. Provider exceptions are converted to a fixed redacted failure
before component persistence; do not include SDK messages, stacks, previews,
tokens, webhook bodies, or unnecessary PII.

## Principal And Policy Replay

Public starts never accept actor, role, grants, auth epoch, or system-principal
fields. The authenticated Confect mutation constructs a V2 principal and an
explicit `none` or exact version/hash policy snapshot, persists both with the
run, and passes them through the generated runner. Capability mappers append
those fields after rejecting reserved-field overrides. Child workflows inherit
the principal or receive a grant subset; widening is invalid.

Pinned policy drives deterministic business decisions through sleep, events,
children, and restart. It is never replaced with the latest active policy.
Immediately before a consequential action, the generated capability boundary
reloads current membership for the persisted actor and tenant. Revocation, role
downgrade, or missing current grants blocks the effect without changing the
pinned decision. Legacy active runs may finish non-consequential work but must
reauthorize before starting an external effect.

## Reviewer-Safe Run Receipt

The deterministic sample receipt lives in `packages/template-core/src/index.ts`
as `createSampleWorkflowRunReceipt`. It is projected through
`tooling/workflow/src/index.ts` and exposed through:

```bash
pnpm exec tsx apps/cli/src/index.ts workflow run
```

The receipt includes ordered steps, evidence references, audit event names, and
a Trust Receipt. It is intentionally fake/local and contains only synthetic
reviewer-safe data.

## Verification

Focused workflow changes run:

```bash
pnpm --dir packages/workflow-ui test
pnpm --dir apps/web test src/features/workflows
pnpm --dir packages/convex test workflows
pnpm check:workflow-graph-boundary
```
