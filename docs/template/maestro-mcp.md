# Maestro MCP

Status: implemented. WP-3.5 projects accepted typed library commands through a
thin JSON-RPC stdio transport:

- `maestro_preflight`
- `maestro_scaffold_preview`
- `maestro_support_bundle_preview`
- `maestro_verify`
- `maestro_app_map`
- `maestro_app_map_impact`
- `maestro_build_readiness`

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

All projected tools are read-oriented. In particular, `maestro_verify` returns
an in-memory receipt projection and never creates `.maestro` or exports a
receipt. The explicit `verify-export --write` mutation exists only in the CLI
command registry and is absent from MCP tool schemas and dispatch.

Claude Code consumes the plugin-local `.mcp.json` with `${CLAUDE_PROJECT_DIR}`
as its working directory. Codex consumes the separate plugin-local
`.codex-plugin/mcp.json`, which omits `cwd` so the native `-C` project remains
authoritative instead of the plugin cache. Both declarations use pnpm silent
mode so stdout contains JSON-RPC frames only.

The Codex leaf declaration is retained for compatibility, but Codex `0.145.0`
does not load the checked-in `.codex/config.toml` as project configuration. Do
not claim that file is active without a newer native-host proof. Removing the
Codex plugin removes its MCP registration without modifying that inactive leaf,
the CLI, or customer code.

Convex MCP is independent and absent in fake mode. `inspect` is the default
explicit personal-development preview; `dev-power` has separate effects and
confirmation posture. Both use the root `convex.json`, personal `dev`
deployment, exact audited upstream inventory, and an environment-tool deny list.
Unknown tools and every production flag fail closed.

`pnpm maestro -- mcp configure --host <claude-code|codex>` previews `inspect` by
default. `--write` is the only apply action and `--remove` removes only the
exact local `convex` registration owned by its Maestro receipt. The command
accepts no paths, commands, production profile, or host-global scope; its host
configuration store is injected by the CLI boundary.
