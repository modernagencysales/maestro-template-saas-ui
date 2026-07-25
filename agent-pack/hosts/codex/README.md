# Codex host projection

This directory describes the optional, local Codex projection of the committed
Maestro Agent Pack. The primary Codex path remains the repo-native
`.agents/skills` projection generated from `agent-pack/skills`.

The temporary-home fixture consumes `projection.json` from the checkout. It
copies only committed skill files, records every installed file and checksum in
an in-memory receipt, and removes only unchanged receipt-owned files. It never
writes Codex MCP configuration, starts a process, authenticates Convex, or
contacts a remote registry.

Phase 2 deliberately has no Codex plugin or MCP registration. MCP support is a
later, explicit opt-in surface.
