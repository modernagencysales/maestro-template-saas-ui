---
name: maestro
description:
  Build and extend Maestro template applications through canonical systems,
  generators, typed contracts, and safe host boundaries.
---

# Maestro

Read the repository `AGENTS.md` before acting. For Convex work, also read the
committed official guideline at
`packages/convex/convex/_generated/ai/guidelines.md` and use the focused
official Convex skills installed for the current host.

Before planning a subsystem or durable resource, query the canonical system
catalog. Record `reuse`, `extend`, or a reviewed `introduce` decision. Use the
matching `pnpm template:*` generator before hand-writing registrations, and keep
web, capability, workflow, storage, and provider boundaries intact.

Read [workflow-authoring.md](references/workflow-authoring.md) for durable
workflow changes. Read [host-safety.md](references/host-safety.md) before any
host integration or optional MCP work.

Prefer committed fake/local providers. Never infer permission to authenticate,
deploy, access production, expose secrets, or mutate a real host home.

For common product outcomes, resolve the generated catalog at
`docs/template/recipes/index.generated.json` through
`pnpm maestro -- add <outcome-or-recipe>`. Use `recipes list/show` only for
advanced inspection. Ask only the consequential questions in the selected
recipe. If no exact recipe matches, return its adjacent reviewed recipes and
`template-gap`; never invent an architecture or claim an unsupported workflow
primitive.

For Convex setup or diagnosis, run the read-only provider doctor and load
`agent-pack/references/convex.md`. Load `agent-pack/references/storage.md` only
when the accepted file-import recipe genuinely requires retained object bytes.
