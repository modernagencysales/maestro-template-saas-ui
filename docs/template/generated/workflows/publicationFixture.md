# PublicationFixture Workflow

Isolated immutable publication contract fixture.

Canonical system: `workflow-runtime` (`extend`).

## Generated Files

- `packages/convex/confect/workflowRunners/publicationFixture/v1.ts`:
  immutable-version Confect-owned runner source.
- `packages/convex/convex/workflowRunners/publicationFixture/v1.ts`:
  reproducible versioned Confect projection; never edit it by hand.
- `docs/template/generated/workflows/publicationFixture.semantics.json`:
  semantic coverage keyed by executable rule id.
- `packages/convex/confect/workflowContracts/publicationFixture.spec.ts`: typed
  start, status, event, cancel, restart, list, step-list, and cleanup contract.
- `packages/convex/confect/workflowContracts/publicationFixture.impl.ts`:
  Confect implementation that records workflow ownership and projects component
  status.
- `packages/convex/confect/workflows/publicationFixture/v1.graph.ts`: versioned
  durable graph data, initially source to Trust Receipt output only.
- `packages/convex/confect/workflows/publicationFixture/v1.registry.ts`: exact
  versioned capability, event, child-workflow, and internal-ref bindings.
- `packages/convex/confect/workflows/publicationFixture.predeploy.ts`: collected
  workflow-component Workpool declarations and the injected canonical predeploy
  findings gate.
- `packages/convex/test/publicationFixture.workflow.test.ts`: focused runner
  scaffold for the default graph.

## Required Follow-Up

1. Keep the generated `startInteractive` and `startQueued` mutations as the only
   kickoff-mode selectors; callers never supply the mode or principal.
2. Run `pnpm confect:codegen`, then
   `pnpm --dir packages/convex exec convex codegen`, so Confect reproduces
   `workflowRunners/publicationFixture/v1:run` before typecheck.
3. Preserve the authenticated handler's server-derived principal projection when
   specializing start behavior.
4. Keep React Flow as a projection of `publicationFixture/v1.graph.ts`; do not
   persist canvas node state as the workflow contract.
5. Generated event nodes require
   `workflowContracts.publicationFixture.sendEvent`; callers select an owned
   opaque ID or generated definition key and never provide workspace, principal,
   or raw component names.
6. Generated capability nodes require registry entries with generated internal
   refs, concrete `buildArgs` and logical instance-key mappers, and complete
   effect/guard/redaction/evidence contracts.
7. Generated subworkflow entries require one immutable publication binding for
   the child graph snapshot, stable generated runner-reference identity, stable
   mapper/result export descriptors, lifecycle contract, typed Args/Result
   schemas, declared transitive children, principal posture, and
   `publicationFixtureSubworkflowLinkRefs`; cycle, depth, and fan-out checks run
   before child dispatch.
8. The child registry exposes reserve, reconcile, and reconciliation-failure
   reporting only. Cascade cancellation and cleanup remain restricted until
   product lifecycle controls drive them end to end. Workflow 0.4.4 scheduled
   children remain rejected; use a named sleep plus an unscheduled child only as
   a deliberately non-equivalent alternative.
9. Query and mutation capabilities use independent Workpool transactions by
   default. Inline is restricted to declared small atomic work: novice authors
   choose `tiny` or `small-atomic`; raw counters require the reviewed advanced
   constructor. Actions and scheduled steps cannot be inline.
10. Cancel is cooperative: an already-running action may finish, and
    compensation is a separate explicit workflow. Restart refuses unstable
    anchors, active Workpool/exposed work, and downstream external actions
    without generation-scoped dedupe evidence.
11. Cleanup is retention-gated and never claims full component deletion.
    Schedule bounded calls to `workflows.lifecycle.sweepRetention`; pinned
    Workflow 0.4.4 may leave never-awaited events or failed completion records
    as explicitly unverifiable residuals.
12. Run `pnpm check:workflow:fast`, `pnpm check:confect-contracts`, and focused
    workflow tests.
