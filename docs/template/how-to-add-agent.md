# How To Add An Agent

Use the agent generator:

```bash
pnpm template:systems -- --query workflows
pnpm template:add-agent -- --name workflow_architect --system workflow-runtime --disposition reuse --write
```

Plain `add-agent` creates a neutral declaration. It does not choose a UI seat,
thread lifecycle, tool runtime, CLI/API/MCP surface, or headless exposure.
Choose those patterns only when the product needs them.

Use the product system the agent serves. The declaration is an actor-view of
that owner, not a new system with its own parallel state.

## Files Created

- `packages/convex/confect/agents/<name>.ts`
- `docs/template/generated/agents/<name>.md`
- `docs/template/generated/provenance/add-agent/<name>.json`

Neutral declarations use `surfaces: []`, `capabilities: []`, and no headless
exposure. They do not invent functions, thread state, tools, generated refs, or
registrations.

When a web thread seat is explicitly required, use:

```bash
pnpm template:add-agent-seat -- --name workflow_architect --system workflow-runtime --disposition reuse --write
```

That explicit command preserves the complete web-seat pattern: Confect spec and
implementation, tool declaration, thread tests, docs, and provenance.

After writing a neutral declaration, review the generated docs and run the
focused generator tests. For an explicit seat, also run `pnpm confect:codegen`,
`pnpm confect:manifest`, and the focused agent tests before wiring generated
refs into the selected surface. Keep API, CLI, and MCP denied unless a later
headless contract task adds typed public errors, idempotency posture, generated
manifest/headless metadata, explicit generated ref mappings, and surface tests.

## Tests

- tool grant acceptance and refusal;
- prompt-injection fixture;
- unsupported request refusal;
- memory approval;
- capability permission;
- policy snapshot;
- tool-call telemetry.

## Gates

- `pnpm confect:codegen`
- `pnpm confect:manifest`
- `pnpm --dir packages/convex test agents`
- `pnpm --dir apps/web test src/features/agents`
- `pnpm check:headless-surface-contract` only after a separate headless exposure
  task adds API, CLI, or MCP surfaces.
