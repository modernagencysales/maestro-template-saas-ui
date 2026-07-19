# How To Add An Agent

Use the agent generator:

```bash
pnpm template:systems -- --query workflows
pnpm template:add-agent -- --name workflow_architect --system workflow-runtime --disposition reuse --write
```

`pnpm template:add-agent-seat` remains an alias for older task briefs.

Use the product system the agent serves. The generated seat is an actor-view of
that owner, not a new system with its own parallel state.

## Files Created

- `packages/convex/confect/agents/<name>.spec.ts`
- `packages/convex/confect/agents/<name>.impl.ts`
- `packages/convex/confect/agents/<name>.tools.ts`
- `packages/convex/test/<name>.agent.test.ts`
- `docs/template/generated/agents/<name>.md`

Generated agent seats are web-facing by default with `surfaces: ["web"]`. They
do not create API, CLI, MCP, generated manifest/headless metadata, or explicit
generated ref mappings until a separate headless contract review approves them.

After writing an agent slice, run `pnpm confect:codegen`,
`pnpm confect:manifest`, and the focused agent tests before wiring generated
refs into the web surface. Keep API, CLI, and MCP denied unless a later headless
contract task adds typed public errors, idempotency posture, generated
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
