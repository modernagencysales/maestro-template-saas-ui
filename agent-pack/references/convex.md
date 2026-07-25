# Convex coaching reference

Use this reference after `pnpm maestro -- doctor convex --environment <name>`.
The doctor is read-only: it reports environment **names**, never values, and it
does not authenticate, create a project, start MCP, deploy, or select
production.

## Start with the consequential choice

Ask only:

1. Is fake mode sufficient for the first customer outcome?
2. If persistence is needed, may local data be discarded, or is an authenticated
   personal development deployment required?
3. Has dev evidence passed before preview or staging is requested?

Fake mode is a complete working stopping point. It uses deterministic adapters,
requires no Convex account, and has no Convex MCP process or configuration.

## Install official AI guidance

From the repository root, explicitly approve and run:

```bash
npx convex ai-files install
```

This is the official Convex source for Claude Code and Codex guidance. Maestro's
host installer verifies the managed projections; do not copy or invent a second
rules bundle. Re-run the provider doctor if either host projection is missing or
drifted.

## Choose local or personal dev

- **Local:** start the reviewed local mode. The local backend binds the web app
  to `http://127.0.0.1:3210`; ambient cloud selectors and deploy credentials are
  removed from child environments.
- **Personal dev:** authenticate with the Convex CLI only after the user chooses
  this path. Create/select a personal development project, never a production
  deployment. Generated Convex deployment, site URL, and browser URL names are
  wired through
  [`docs/template/env-manifest.md`](../../docs/template/env-manifest.md) and
  generated project configuration; do not hand-copy values into logs or coaching
  output.

Authentication, project creation, and deployment selection are user-executed
Convex CLI steps. The doctor only identifies the missing names and next command.

## Code generation order

After changing an Effect table or Confect spec/implementation:

```bash
pnpm confect:codegen
pnpm convex:codegen
```

Confect generation must run first so Convex generation observes the canonical
schema, registered functions, and refs. Never edit either generated tree by
hand. Then run the focused Confect contract and target typechecks named by the
generator output.

## Optional development MCP

Fake and local modes have no MCP. For an authenticated personal dev deployment,
the existing profile contract may preview an explicit opt-in command equivalent
to:

```bash
pnpm exec convex mcp start --project-dir . --deployment dev
```

Always use
[`docs/template/convex-mcp-profiles.json`](../../docs/template/convex-mcp-profiles.json)
to add the required disabled-tool arguments. `envGet`, `envList`, `envRemove`,
and `envSet` remain disabled in every profile. Start with `inspect`; `dev-power`
needs a separate confirmation because it can read or mutate development data.
Production MCP and automatic MCP startup are unsupported.

## Workflow and Workpool compatibility

Workflow behavior is available only where
[`docs/template/convex-workflow-compatibility.md`](../../docs/template/convex-workflow-compatibility.md)
and the semantic ledger mark every exact primitive supported. Workpool is used
for bounded asynchronous work, not as a substitute for workflow semantics. Any
Convex, Workflow, or Workpool version change must update and pass the pinned
compatibility matrix before recipes or generated code claim support.

## Diagnose common failures

- **Authentication/project:** confirm the user chose personal dev and that the
  CLI selected a development project. Never solve this by adding production
  flags.
- **Generated URL wiring:** rerun generation and inspect missing environment
  names. Do not print current values.
- **Confect/Convex refs:** rerun Confect codegen first, then Convex codegen;
  check schema and registered-function projections rather than editing generated
  files.
- **Component or Workpool:** confirm the component is mounted, generated refs
  include the module segment, and the pinned compatibility matrix still passes.
- **Workflow primitive:** stop when the ledger reports restricted or
  unsupported; use the documented alternative or record a template-gap.
- **MCP:** use the checked-in profile, `--project-dir .`, deployment `dev`, and
  the exact disabled-tool set. Unknown tools or forbidden flags fail closed.

## Dev to preview or staging

After dev doctor, codegen, focused tests, fake/local smoke, data review, and
rollback evidence pass, explicitly select **preview** or **staging** and wire
its generated non-production URLs. Re-run the doctor for that environment. This
coaching never appends production flags, creates a production deployment, or
promotes automatically.
