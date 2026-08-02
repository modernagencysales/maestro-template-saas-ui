# GenerateCompleteBuildPack Workflow

Generated generateCompleteBuildPack workflow. Replace the source-to-receipt
graph after review.

## Generated Files

- `packages/convex/convex/workflowRunners/generateCompleteBuildPack.ts`: plain
  Convex `defineWorkflow` durable replay handler.
- `packages/convex/confect/workflowContracts/generateCompleteBuildPack.spec.ts`:
  typed start, status, and approval contract.
- `packages/convex/confect/workflowContracts/generateCompleteBuildPack.impl.ts`:
  Confect implementation that records workflow ownership and projects component
  status.
- `packages/convex/confect/workflows/generateCompleteBuildPack.graph.ts`:
  durable graph data, initially source to Trust Receipt output only.
- `packages/convex/test/generateCompleteBuildPack.workflow.test.ts`: focused
  runner scaffold for the default graph.

## Required Follow-Up

1. Add the generated Confect group to the workflow spec tree.
2. Run `pnpm --dir packages/convex exec convex codegen` after writing the
   generated files so `workflowRunners/generateCompleteBuildPack:run` exists
   before typecheck. Run `pnpm confect:codegen` when validating the generated
   `workflowContracts.generateCompleteBuildPack` public wrappers; if Confect
   sync removes
   `packages/convex/convex/workflowRunners/generateCompleteBuildPack.ts`, rerun
   this generator before Convex codegen and typecheck.
3. Keep React Flow as a projection of `generateCompleteBuildPack.graph.ts`; do
   not persist canvas node state as the workflow contract.
4. Generated approval nodes require the generated
   `workflowContracts.generateCompleteBuildPack.approve` mutation before they
   are usable.
5. Generated capability nodes require registry entries with concrete `buildArgs`
   mappers for the target internal capability ref.
6. Run `pnpm check:workflow-graph-boundary`, `pnpm check:confect-contracts`, and
   focused workflow tests.
