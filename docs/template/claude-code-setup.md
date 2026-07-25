# Claude Code setup

Claude Code works from committed repository context before any plugin is
installed. Start it at the repository root so `CLAUDE.md` includes `AGENTS.md`
and the committed `.claude/skills` directory supplies the pinned official Convex
skills. Normal onboarding is offline and does not refresh remote skill metadata.

## Verify the primary path

From the repository root, run:

```bash
pnpm exec convex ai-files status
pnpm maestro -- preflight --human
```

Review any reported drift before continuing. Do not run the maintainer-only
AI-files refresh during normal onboarding.

## Optional local plugins

The `maestro` and `maestro-convex` plugins add skill routing only. They contain
no hooks or MCP server, do not authenticate Convex, and do not start background
processes.

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

Phase 2 intentionally creates no `.mcp.json`. Do not add a Convex MCP server or
production deployment while following this setup. Later opt-in MCP setup must
use the Maestro CLI's audited personal-development profile.

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
