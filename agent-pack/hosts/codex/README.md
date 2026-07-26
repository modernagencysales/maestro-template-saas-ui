# Codex host projection

This directory describes the optional, local Codex projection of the committed
Maestro Agent Pack. The primary Codex path remains the repo-native
`.agents/skills` projection generated from `agent-pack/skills`.

The temporary-home fixture consumes `projection.json` from the checkout. It
copies only committed skill files, records every installed file and checksum in
an in-memory receipt, and removes only unchanged receipt-owned files. It never
writes Codex MCP configuration, starts a process, authenticates Convex, or
contacts a remote registry.

The optional native plugin uses its own `.codex-plugin/mcp.json`. It
deliberately omits `cwd`, so Codex applies the project selected by `-C` instead
of resolving a Claude placeholder below the plugin cache. The Claude plugin
keeps its separate `${CLAUDE_PROJECT_DIR}` declaration.

WP-3.5 retains `maestro-mcp.config.toml` as an inactive compatibility leaf:
Codex `0.145.0` does not load checked-in `.codex/config.toml` as project
configuration. Do not use or forge that file as native discovery evidence.
Convex MCP remains a separately previewed host-local opt-in.
