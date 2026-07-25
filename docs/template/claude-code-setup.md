# Claude Code setup

Claude Code works from committed repository context before any plugin is
installed. Start it at the repository root so `CLAUDE.md` includes `AGENTS.md`
and the committed `.claude/skills` directory supplies the pinned official Convex
skills. Normal onboarding is offline and does not refresh remote skill metadata.

Validated host baseline: Claude Code `2.1.220` successfully added the local `./`
marketplace, installed, listed, inspected, and uninstalled both plugins in a
disposable `CLAUDE_CONFIG_DIR`. Plugin details initially reported one skill and
zero hooks or LSP servers. The Maestro plugin now declares only the thin
repository-local Maestro MCP server; the Convex plugin remains skill-only. This
is recorded evidence, not a hard minimum version.

## Verify the primary path

From the repository root, run:

```bash
pnpm exec convex ai-files status
pnpm maestro -- preflight --human
```

Review any reported drift before continuing. Do not run the maintainer-only
AI-files refresh during normal onboarding.

See the [preflight readiness guide](./preflight.md) for the facts, safety
boundary, fingerprint, and exact recovery commands behind this read-only check.

## Optional local plugins

The `maestro` plugin adds skill routing and the read-oriented Maestro MCP
declaration. It invokes `pnpm maestro -- mcp` from `CLAUDE_PROJECT_DIR`; it does
not authenticate Convex or start a background Convex process. The
`maestro-convex` plugin remains skill-only.

Before trusting the local marketplace, inspect
`.claude-plugin/marketplace.json`, both plugin manifests, and their `skills/`
content. Then open Claude Code in the repository root and run:

```text
/plugin marketplace add ./
/plugin install maestro@maestro-agent-pack
/plugin install maestro-convex@maestro-agent-pack
```

Accept the trust prompt only after the inspected local path matches this
checkout. Restart Claude Code so it reloads installed skills. Open `/plugin` and
confirm both plugins are enabled, then ask Claude to list the `maestro` and
`maestro-convex` skills. Official Convex skills remain repository-native and do
not depend on these optional plugins.

The plugin's `.mcp.json` names only Maestro and does not register Convex. To opt
into the audited read-only Convex `inspect` profile for a personal development
deployment, review [`convex-mcp-profiles.json`](./convex-mcp-profiles.json),
then run from the one repository root:

```bash
claude mcp add --transport stdio --scope local convex -- pnpm exec convex mcp start --project-dir . --deployment dev --disable-tools data,envGet,envList,envRemove,envSet,logs,run,runOneoffQuery
```

Remove it without changing customer code:

```bash
claude mcp remove --scope local convex
```

`dev-power` is a separate local choice. Review its data, log, and function
execution effects before using its preview; production and environment-value
tools are unsupported.

## Remove or roll back

In Claude Code, run:

```text
/plugin uninstall maestro@maestro-agent-pack
/plugin uninstall maestro-convex@maestro-agent-pack
/plugin marketplace remove maestro-agent-pack
```

Restart Claude Code and use `/plugin` to confirm removal. Repository-native
`CLAUDE.md`, `AGENTS.md`, and official Convex skills continue to work.

Automated install/remove fixtures use a disposable temporary home and committed
local sources. Removal is checksum-guarded: it deletes only files recorded in
the install receipt whose contents still match. A file changed after install is
refused and left for manual review. Customer code and unrelated host files are
never removal targets, and rollback needs no network access.
