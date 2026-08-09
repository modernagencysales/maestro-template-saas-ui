# Agent Pack Scaffolding

Status: implemented. Scaffolding uses the generator, Agent Pack, and CLI
contracts. MCP exposes preview only.

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
  package script, or aggregate-gate registration is owned here.
- MCP exposes scaffold preview only. Reviewed writes remain CLI-only.

## Shared Wiring

- `@maestro-template/generators` exports the reviewed descriptor registry and
  delegates typed preview/write operations to the unchanged generator CLI API.
- The Agent Pack barrel exports the `scaffold` command factory.
- The factory composition injects repository-aware ADR, preflight, generator,
  and workflow-ledger projections into one scaffold command instance.
- The strict CLI adapter invokes it through `executeAgentPackCommand` and the
  shared human/JSON renderer.
