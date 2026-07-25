# Codex host projection

This directory describes the optional, local Codex projection of the committed
Maestro Agent Pack. The primary Codex path remains the repo-native
`.agents/skills` projection generated from `agent-pack/skills`.

The temporary-home fixture consumes `projection.json` from the checkout. It
copies only committed skill files, records every installed file and checksum in
an in-memory receipt, and removes only unchanged receipt-owned files. It never
writes Codex MCP configuration, starts a process, authenticates Convex, or
contacts a remote registry.

WP-3.5 provides `maestro-mcp.config.toml` for root integration to project as one
repository-native Maestro entry in `.codex/config.toml`. This temporary-home
installer still writes skills only and never alters global Codex configuration.
Convex MCP remains a separately previewed local opt-in.
