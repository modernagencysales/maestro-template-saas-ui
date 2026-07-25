# Agent Pack Planning And Scaffolding

Status: seam. WP-3.3 leaf commands are implemented; root package exports,
dependency bindings, CLI adapters, and router registration remain integration
work.

`plan-check` delegates deterministic manifest validation to
[`tooling/stack/plan.mts`](../../tooling/stack/plan.mts). It reports that
validator's schema, completeness, ordering, contract-risk, and declared ADR
findings without judging business quality.

`scaffold` delegates supported operations to the existing `template:*` generator
API. Preview is the default. A write first previews exact files and collisions,
then requires the current passing preflight fingerprint to equal the caller's
reviewed fingerprint. Generator output remains the authority for file bytes,
provenance, semantic rule IDs, manual follow-up, codegen, and focused gates.

Canonical authoring and output details remain in the existing references:

- [App Factory Guide](./app-factory-guide.md)
- [Generator Output Contract](./generator-output-contract.md)
- [How To Add A Workflow](./how-to-add-workflow.md)
- [Workflow semantic ledger](./generated/workflow-semantics.md)
- [ADR 0002](./adr/0002-maestro-graph-over-convex-workflow.md)

Unsupported requests return registry-owned nearby recipes and a reviewable
`template-gap` skeleton. Restricted or unsupported workflow primitive requests
return the semantic ledger's declared alternative and ADR path; the command does
not invent source files or bypass the semantic gate.

## Explicit Exclusions

- No generator rules, recipes, or playbook prose are duplicated in Agent Pack.
- No edits to `tooling/stack/plan.mts` or `tooling/generators/src/index.ts` are
  part of the leaf stack.
- No Agent Pack package dependency, barrel, root CLI composition, router,
  script, Just recipe, or aggregate-gate registration is owned here.
- No MCP transport or WP-3.5 behavior is included.

## Root Integration Request

Bind the leaf factories without adding behavior:

- Export `tooling/stack/plan.mts` as a package callable whose runtime input
  validation returns deterministic findings instead of throwing on malformed
  JSON, then inject it as `createPlanCheckCommand({ validate })`.
- Export a typed generator operation and reviewed generator/recipe registry from
  `tooling/generators/src/index.ts`. Its operation must return exact files,
  provenance paths, collisions, semantic rule IDs, manual follow-up, codegen,
  and focused gates, and must preserve every existing `pnpm template:*`
  entrypoint.
- Project `WORKFLOW_SEMANTICS` into `WorkflowScaffoldRestriction` values using
  the existing status, repair, and documentation/ADR evidence; do not maintain a
  second primitive list.
- Bind scaffold preflight inspection to the shared preflight command for the
  trusted repository context, returning only `fingerprint` and `safeToMutate`.
- Add the required workspace dependencies and Agent Pack barrel exports for
  `planCheck.ts` and `scaffold.ts`.
- Add leaf CLI argument adapters, then register exactly one `plan-check` and one
  `scaffold` command in the root factory composition/router. The adapters must
  call the shared commands through `executeAgentPackCommand` and preserve the
  JSON/human renderer.
- Add package scripts, Just/CI coverage, and documentation links only after the
  bindings above exist. Do not expose scaffold write through MCP in WP-3.3.
