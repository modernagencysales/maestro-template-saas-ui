---
name: maestro-convex
description:
  Route Convex implementation work through official Convex skills and Maestro's
  pinned workflow compatibility policy.
---

# Maestro Convex

Use the official Convex skills installed by the pinned `convex ai-files`
workflow for framework APIs and current authoring guidance. Read
`docs/template/convex-workflow-compatibility.md` before designing or changing a
durable workflow.

The repository root is the only Convex project. Run Convex operations from the
root and use `--project-dir .` where the command supports it.

Phase 2 is skill-only. Do not add or launch MCP, authenticate Convex, read
environment values, or select a production deployment. Future host-local MCP
configuration must go through the Maestro CLI safety policy. Fake mode has no
MCP; `inspect` is the least-powerful opt-in profile, and `dev-power` requires a
separate explicit confirmation.
