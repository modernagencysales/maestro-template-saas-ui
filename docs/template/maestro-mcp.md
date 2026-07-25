# Maestro MCP

Status: implemented. WP-3.5 projects four accepted typed library commands
through a thin JSON-RPC stdio transport:

- `maestro_preflight`
- `maestro_plan_check`
- `maestro_scaffold_preview`
- `maestro_verify`

Run it only through the reproducible repository command:

```bash
pnpm maestro -- mcp
```

The server injects the repository and execution context. Tool inputs cannot
supply identity, workspace, tokens, secrets, function references, commands,
production flags, or scaffold writes. MCP contains no planner, coaching, repair
generation, chat state, telemetry, shell command construction, or Convex
administration. Stdout is reserved for protocol frames; operational diagnostics
on stderr contain fixed codes rather than request data.

Claude Code consumes the plugin-local `.mcp.json`. Root integration projects the
Codex leaf declaration to the trusted repository `.codex/config.toml`. Both
launch the same command from the resolved target root. Removing or disabling
either declaration leaves the CLI and customer code unchanged.

Convex MCP is independent and absent in fake mode. `inspect` is the default
explicit personal-development preview; `dev-power` has separate effects and
confirmation posture. Both use the root `convex.json`, personal `dev`
deployment, exact audited upstream inventory, and an environment-tool deny list.
Unknown tools and every production flag fail closed.
