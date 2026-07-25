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
