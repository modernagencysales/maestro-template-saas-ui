# Claude Code setup

Claude Code works from committed repository context before any plugin is
installed. Start it at the repository root so `CLAUDE.md` includes `AGENTS.md`
and the committed `.claude/skills` directory supplies the pinned official Convex
skills. Normal onboarding is offline and does not refresh remote skill metadata.

Validated host baseline: Claude Code `2.1.220` strictly parsed the marketplace,
added the local `./` source, installed, listed, inspected, and uninstalled both
plugins in a disposable `CLAUDE_CONFIG_DIR`. `maestro-convex` reported one skill
and zero MCP servers, hooks, agents, or LSP servers. The core `maestro` plugin
reported its one skill and the separate thin repository-local Maestro MCP
server. This is recorded evidence, not a hard minimum version.

No credential is needed for manifest validation or the plugin lifecycle. A fresh
isolated invocation loaded all seven committed project skills before it stopped
at the exact external boundary `Not logged in · Please run /login`. Model-backed
skill invocation, not parsing or discovery, is the authentication boundary.

## Verify the primary path

From the repository root, run:

```bash
pnpm exec convex ai-files status
pnpm maestro -- preflight --human
```

Review any reported drift before continuing. Do not run the maintainer-only
AI-files refresh during normal onboarding.

The official Convex install path is the root Convex CLI:

```bash
pnpm exec convex ai-files install
```

That command is for a reviewed maintainer refresh. It projects the official
skills to Claude Code's `.claude/skills` and Codex's `.agents/skills`, updates
the managed markers and lock state, and is then checked in with its checksums.
Novice onboarding consumes those committed outputs and does not install a second
Convex rules plugin or contact the skills repository.

See the [preflight readiness guide](./preflight.md) for the facts, safety
boundary, fingerprint, and exact recovery commands behind this read-only check.

## Optional local plugins

The `maestro` plugin adds skill routing and the read-oriented Maestro MCP
declaration. It invokes `pnpm maestro -- mcp` from `CLAUDE_PROJECT_DIR`; it does
not authenticate Convex or start a background Convex process. The
`maestro-convex` plugin remains skill-only.

Before trusting the local marketplace, inspect
`.claude-plugin/marketplace.json`, both plugin manifests, and their `skills/`
content. The same lifecycle is available directly from the current native CLI:

```bash
claude plugin validate --strict .
claude plugin marketplace add ./ --scope user
claude plugin install maestro@maestro-agent-pack --scope user
claude plugin install maestro-convex@maestro-agent-pack --scope user
claude plugin list --json
claude plugin details maestro@maestro-agent-pack
claude plugin details maestro-convex@maestro-agent-pack
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

Run:

```bash
claude plugin uninstall maestro@maestro-agent-pack --scope user --yes
claude plugin uninstall maestro-convex@maestro-agent-pack --scope user --yes
claude plugin marketplace remove maestro-agent-pack --scope user
claude plugin list --json
claude plugin marketplace list --json
```

Both final list commands return `[]`. Restart Claude Code and use `/plugin` to
confirm removal. Repository-native `CLAUDE.md`, `AGENTS.md`, and official Convex
skills continue to work.

Automated install/remove fixtures use a disposable temporary home and committed
local sources. Claude's native uninstall intentionally leaves orphaned cache and
state files even after both registries are empty, so the harness does not claim
native uninstall alone restores a pristine directory. It path-validates and
removes the entire harness-owned temporary root, then proves the root is empty;
it never applies that teardown to a real home. The offline projection removal
path remains checksum-guarded and preserves changed or unrelated files.
