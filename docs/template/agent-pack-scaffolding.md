# Agent Pack Planning And Scaffolding

Status: implemented. WP-3.3 uses shared stack, generator, Agent Pack, and CLI
contracts. MCP projection remains explicitly excluded until WP-3.5.

`plan-check` delegates deterministic manifest validation to
[`tooling/stack/plan.mts`](../../tooling/stack/plan.mts). It reports that
validator's schema, completeness, ordering, contract-risk, and declared ADR
findings without judging business quality.

`scaffold` delegates supported operations to the existing `template:*` generator
API. Preview is the default. A write first previews exact files and collisions,
then requires the current passing preflight fingerprint to equal the caller's
reviewed fingerprint and explicit clean-worktree evidence from that preflight.
Generator output remains the authority for file bytes, provenance, semantic rule
IDs, manual follow-up, codegen, and focused gates.

Canonical authoring and output details remain in the existing references:

- [App Factory Guide](./app-factory-guide.md)
- [Generator Output Contract](./generator-output-contract.md)
- [How To Add A Workflow](./how-to-add-workflow.md)
- [Workflow semantic ledger](./generated/workflow-semantics.md)
- [ADR 0002](./adr/0002-maestro-graph-over-convex-workflow.md)

Unsupported requests return registry-owned nearby recipes and a reviewable
`template-gap` skeleton. Restricted or unsupported workflow primitives proceed
only when the caller selects the semantic ledger's exact declared repair or an
existing accepted ADR path. Missing or invented selections return the
ledger-owned alternative; the command does not invent source files or bypass the
semantic gate.

## Explicit Exclusions

- No generator rules, recipes, or playbook prose are duplicated in Agent Pack.
- No edits to `tooling/generators/src/index.ts` are part of the leaf stack.
- No Agent Pack package dependency, barrel, root CLI composition, router,
  script, Just recipe, or aggregate-gate registration is owned here.
- No MCP transport or WP-3.5 behavior is included.

## Shared Wiring

- `@maestro-template/stack-tooling` exports the deterministic plan validator and
  accepted-ADR reader.
- `@maestro-template/generators` exports the reviewed descriptor registry and
  delegates typed preview/write operations to the unchanged generator CLI API.
- The Agent Pack barrel exports `plan-check` and `scaffold` command factories.
- The factory composition injects repository-aware ADR, preflight, generator,
  and workflow-ledger projections into one command instance each.
- Strict CLI adapters invoke both commands through `executeAgentPackCommand` and
  the shared human/JSON renderer.
