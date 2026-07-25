# Codex setup

Codex works from committed repository instructions and skills. The Agent Pack
provides the thin Maestro server declaration through Codex's current project
`config.toml` mechanism. Root integration projects that leaf declaration to
`.codex/config.toml`; it does not configure Convex, authenticate, or write to
the global Codex home.

Validated host baseline: Codex `0.145.0` loaded the repository metadata and
discovered `maestro`, `maestro-convex`, `convex`, and `convex-quickstart`. This
is recorded evidence, not a hard minimum version; later versions must preserve
equivalent repo-native discovery.

## Repo-native setup

1. Create or clone the project through its supported creation path.
2. Open the repository root in Codex and review `AGENTS.md` before granting
   trust.
3. Confirm these committed skill directories are present:

   ```text
   .agents/skills/maestro
   .agents/skills/maestro-convex
   .agents/skills/convex
   ```

   The complete official Convex set is projected under `.agents/skills`; the
   three paths above are the routing entry points.

4. Ask Codex to list the applicable Maestro and Convex skills for the current
   task. The skills are available immediately from the checkout.
5. Check the pinned official context without refreshing it from the network:

   ```bash
   pnpm exec convex ai-files status
   pnpm maestro -- preflight --human
   pnpm --dir tooling/agent-pack test codexInstall
   ```

   The [preflight readiness guide](./preflight.md) explains the read-only result
   and its exact recovery actions.

6. After root integration, review `.codex/config.toml`. Its sole MCP entry
   invokes `pnpm maestro -- mcp` with `cwd = "."`; repository trust therefore
   resolves the server context to this target root. Disable that one table to
   roll back MCP while retaining CLI and skill support. The exact source
   declaration is `agent-pack/hosts/codex/maestro-mcp.config.toml`.

The root `.agents/skills/maestro` directory is generated from
`agent-pack/skills/maestro`. Edit only the canonical source and run the
repository skill synchronization command; the drift gate rejects a
hand-maintained second copy.

## Optional temporary-home validation

Maintainers can validate host-level discovery with the committed fixture. It
creates an isolated directory under the operating system temporary directory and
supplies that directory as the test home:

```bash
pnpm --dir tooling/agent-pack test codexInstall
```

The fixture projects committed local sources only. It does not write the real
`~/.codex`, alter the repository `.codex/config.toml`, start Convex MCP,
authenticate Convex, or access remote metadata.

## Status and removal

Repo-native skills are part of the checkout, so `git status --short` is the
status and normal Git history is the rollback mechanism. Removing an optional
temporary-home projection uses its installation receipt. Removal checks each
recorded SHA-256 first, deletes only unchanged receipt-owned files, preserves
unrelated skills and customer code, and refuses modified files.

To stop using the repo-native pack, close the checkout or remove it through the
same project-management process that created it. Do not recursively delete a
real Codex home. The project Maestro declaration disappears with the checkout.
No Convex logout is necessary because fake mode never configures Convex MCP.
