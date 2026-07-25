# SaaS Application Blueprint

Status: implemented generator blueprint. Classification: `template-gap`, backlog
`AP-008 generic application blueprint`.

## Outcome

`saas-application` is the workflow-optional starting point for an ordinary
workspace SaaS application. It supplies one neutral `record` vertical slice so a
new owner can rename the noun, start in fake mode, create a row, return to the
list, and read its detail before configuring a provider.

```bash
pnpm template:quickstart -- --blueprint saas-application --name "My App"
pnpm template:quickstart -- --blueprint saas-application --name "My App" --write
pnpm maestro -- start --mode fake
```

The preview lists every target and any collision. Write refuses all collisions;
it never silently replaces an existing path.

## Canonical Slice

The contract reuses the existing layer order:

```text
workspace route -> screen -> record feature -> Confect adapter
headless surface ---------------------------> shared operation contract
                                              -> Confect functions -> table
```

- Entity: `record`, deliberately neutral and renameable.
- Tenancy: `workspaceId` on every list, read, and create operation.
- Primitive: table and route CRUD.
- UI states: loading, empty, error, list, detail, and create.
- Headless parity: web/API/CLI projections use the same operation IDs and
  payload contract.
- Governed operations: no capability is generated for ordinary CRUD. Introduce
  one only for a reviewed policy, approval, audit, or similar governed action.

This blueprint does not introduce a second shell, state adapter, feature model,
Confect tree, or Convex access path.

## Fake, Local, And Provider Posture

The fake adapter is behavior, not a green placeholder: its workspace-scoped
store performs create/list/read with deterministic synthetic records. The local
adapter is a `seam` until generated Confect refs are wired and verified. Missing
local or live setup reports unavailable behavior and cannot claim success.

No live provider, plugin, MCP server, GTM pack, agency behavior, or
customer-specific rule is required. Every handoff/readiness entry uses one of
`real`, `fake`, `seam`, or `unavailable`.

## Optional Automation

The base blueprint has no workflow. Approval or background automation remains
`unavailable` unless the workflow semantic ledger supports every exact primitive
required by that variant. A later reviewed variant must separately prove stable
versions, principal reauthorization, bounded payloads, cleanup, and its Trust
Receipt; none of those claims are inferred here.

## Deterministic Sources

- `examples/saas-application/seed/workspace.json`
- `examples/saas-application/seed/records.json`
- `examples/saas-application/seed/source.json`
- `examples/saas-application/seed/crud-scenario.json`

All values are public synthetic fixtures. Replace them through the renamed
entity contract, never with copied customer files.
