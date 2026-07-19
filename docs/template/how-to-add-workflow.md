# How To Add A Workflow

Dry-run a generated workflow:

```bash
pnpm template:systems -- --query sources
pnpm template:add-workflow -- --name sourceToBrief --system knowledge-brain --disposition extend
```

Write the generated files:

```bash
pnpm template:add-workflow -- --name sourceToBrief --system knowledge-brain --disposition extend --description "Turns approved sources into a reviewed brief." --write
```

`template:add-workflow` writes the production-target workflow contract, durable
graph JSON data, runner, test scaffold, and generated docs directly. Do not run
`template:promote-workflow` as the normal next step for files created by
`template:add-workflow`.

`--system` names the product system whose job the workflow performs. Do not use
`workflow-runtime` merely because all workflows run on that shared primitive.

Regenerate contract artifacts after the files are written and before wiring
generated public wrappers:

```bash
pnpm confect:codegen
pnpm confect:manifest
```

Focused package tests should run after regeneration. If a local Convex codegen
step requires a live deployment connection, record that environment failure and
run the non-live generator tests and generated-file drift checks instead.

## Files Created

Generated workflows have two halves:
`packages/convex/convex/workflowRunners/<name>.ts` is the plain Convex
`defineWorkflow` durable replay handler, and
`packages/convex/confect/workflowContracts/<name>.{spec,impl}.ts` is the typed
start/status/control contract. React Flow remains a projection of durable graph
data.

`template:add-workflow` writes:

- `packages/convex/confect/workflowContracts/<name>.spec.ts`;
- `packages/convex/confect/workflowContracts/<name>.impl.ts`;
- `packages/convex/confect/workflows/<name>.graph.ts`, exporting JSON-safe
  durable graph data;
- `packages/convex/convex/workflowRunners/<name>.ts`;
- `packages/convex/test/<name>.workflow.test.ts`;
- `docs/template/generated/workflows/<name>.md`.

Generated control nodes are only usable through the generated
`workflowContracts.<name>` control mutation, which checks workspace access
before calling the durable event/control path. Generated capability nodes are
only usable when their registry entries include a concrete `buildArgs` mapper
for the target internal capability ref.

Use `template:promote-workflow` only for older review artifacts or private
package promotion flows that still need promotion into production-target paths.
For new generated workflows, `template:add-workflow -- --write` already writes
those production-target paths.

## Tests

- graph validation;
- kickoff auth;
- policy snapshot;
- capability-step composition;
- durable replay;
- retry and idempotency;
- schedule and missed-run policy;
- run-observability ledger.

## Gates

- `pnpm confect:codegen`
- `pnpm confect:manifest`
- `pnpm template:workflow-output-smoke`
- `pnpm --dir packages/convex typecheck`
- `pnpm --dir packages/convex test workflows`
- `pnpm --dir apps/web test src/features/workflows`
- `pnpm check:workflow-graph-boundary`
- `pnpm check:confect-contracts`
