# Codex setup

Codex works from committed repository instructions and skills. Phase 2 does not
require a plugin, an MCP server, Convex authentication, or writes to your global
Codex home.

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
   pnpm --dir tooling/agent-pack test codexInstall
   ```

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
`~/.codex`, create `.codex/config.toml`, add an MCP entry, start an MCP process,
authenticate Convex, or access remote metadata.

## Status and removal

Repo-native skills are part of the checkout, so `git status --short` is the
status and normal Git history is the rollback mechanism. Removing an optional
temporary-home projection uses its installation receipt. Removal checks each
recorded SHA-256 first, deletes only unchanged receipt-owned files, preserves
unrelated skills and customer code, and refuses modified files.

To stop using the repo-native pack, close the checkout or remove it through the
same project-management process that created it. Do not recursively delete a
real Codex home. No MCP cleanup or Convex logout is necessary because Phase 2
configures neither.
