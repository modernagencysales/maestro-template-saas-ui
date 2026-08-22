# Codex setup

Codex works from committed repository instructions and skills before any plugin
or MCP is installed. The primary path is the root `AGENTS.md` plus
`.agents/skills`; it does not configure Convex, authenticate, or write to the
global Codex home.

Validated host baseline: Codex `0.145.0` used its native `debug prompt-input`
renderer to load the complete root `AGENTS.md` and discover `maestro`,
`maestro-convex`, and all six official Convex skills before authentication. Its
native plugin parser also accepted both `.codex-plugin/plugin.json` manifests
through the checked-in local marketplace. This is recorded evidence, not a hard
minimum version; later versions must preserve equivalent discovery.

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

6. Do not rely on checked-in `.codex/config.toml` for discovery. Codex `0.145.0`
   does not load that file as project configuration. Context and skills are
   already complete without it. The optional native Maestro plugin has a
   Codex-specific MCP declaration with no `cwd`; Codex therefore launches it
   from the project selected by `-C`, never from the plugin cache.

The root `.agents/skills/maestro` directory is synchronized directly from the
canonical `agent-pack/skills/maestro` source. Edit only that source and run the
repository skill synchronization command; the drift gate rejects a
hand-maintained root copy.

## Optional temporary-home validation

Maintainers can validate host-level discovery with the committed fixture. It
creates an isolated directory under the operating system temporary directory and
supplies that directory as the test home:

```bash
pnpm --dir tooling/agent-pack test codexInstall
```

The fixture projects committed local sources only. It does not write the real
`~/.codex`, alter the repository `.codex/config.toml`, start Convex MCP, or
authenticate Codex or Convex. Every native lifecycle command and the local
Maestro initialize/list-tools handshake run with an environment allowlist and
syscall tracing that fails on external network attempts.

The native pre-auth lifecycle exercised by the same focused test is:

```bash
codex plugin marketplace add "$PWD" --json
codex plugin list --available --json
codex plugin add maestro@maestro-agent-pack --json
codex plugin add maestro-convex@maestro-agent-pack --json
codex plugin list --json
codex -C "$PWD" debug prompt-input "List applicable Maestro and Convex skills."
codex -C "$PWD" mcp get maestro --json
codex plugin remove maestro@maestro-agent-pack --json
codex plugin remove maestro-convex@maestro-agent-pack --json
codex plugin marketplace remove maestro-agent-pack --json
```

`codex login status` remains `Not logged in` in that isolated root. Marketplace
parsing, plugin installation, `AGENTS.md` loading, skill discovery, MCP config
retrieval, and the four-tool protocol handshake all occur before that boundary.
No auth or API-key environment variable is copied into the fixture.

## Status and removal

Repo-native skills are part of the checkout, so `git status --short` is the
status and normal Git history is the rollback mechanism. Removing an optional
temporary-home projection uses its installation receipt. Removal checks each
recorded SHA-256 first, deletes only unchanged receipt-owned files, preserves
unrelated skills and customer code, and refuses modified files.

Native Codex removal clears the plugin cache and both logical registries but
leaves an empty `CODEX_HOME/config.toml`. The acceptance harness removes that
known empty artifact only inside its path-validated temporary root and proves
the root returns to its empty baseline. Removing the Maestro plugin also removes
its MCP registration; the inactive checked-in compatibility leaf is neither
loaded nor modified. The harness never recursively deletes a real Codex home.

To stop using the repo-native pack, close the checkout or remove it through the
same project-management process that created it. Do not recursively delete a
real Codex home. The project Maestro declaration disappears with the checkout.
No Convex logout is necessary because fake mode never configures Convex MCP.
