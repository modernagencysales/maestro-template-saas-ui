# Agent Worker Playbook

Use this when asking an AI worker to modify the template or a client fork.

## Start Here

1. Read `AGENTS.md`.
2. Read `docs/template/repo-map.md`.
3. Read `docs/template/blueprint-catalog.md`.
4. Read `docs/template/generator-output-contract.md`.
5. Read the relevant package README or authoring guide.

## Effect And Confect

- Treat `repos/effect` and `repos/confect` as read-only reference material.
- Do not import from `repos/*`.
- Prefer local pattern files and vendored source examples over guesses.
- Use Confect specs, Effect schemas, typed errors, generated refs, and focused
  tests for backend behavior.

## Generator-First Rule

Choose generators before hand-writing modules:

- `template:quickstart` for a new fork.
- `template:add-client-domain` for client nouns.
- `template:add-capability` for a new operation.
- `template:add-workflow` for a production-target workflow graph, contract,
  runner, and test scaffold.
- `template:promote-capability` after review when starting from reviewed
  runtime/private capability artifacts.
- `template:promote-workflow` only for older reviewed or private-package
  workflow artifacts that still need migration into production-target paths.

## Layer Law

Preserve this flow:

```text
web routes -> screens -> features -> blocks -> Saas UI/shared primitives
client hooks -> @confect/react refs -> Confect specs -> Convex functions
agents -> workflows -> capabilities -> domain/checks -> schema
API/CLI/MCP/OpenAPI/Scalar -> generated Confect manifest/exposure metadata
  plus explicit generated ref mappings -> same capabilities/workflows as web
storage/notifications/observability -> Effect services -> provider adapters
```

## Status Labels

Use `real`, `fake`, `seam`, or `planned` for every subsystem doc. Do not let a
fake provider read like production behavior.

## Checks

Run the narrowest focused test first, then the relevant static gates. Common
commands:

- `pnpm check:generators`
- `pnpm check:confect-contracts`
- `pnpm check:workflow-graph-boundary`
- `pnpm check:secret-canaries`
- package-specific Vitest suites

## Handoff Notes

Summaries should name files changed, commands run, provider posture, generated
artifacts, and any remaining seams. Do not include secrets or raw client data.
