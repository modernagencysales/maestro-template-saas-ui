# Maestro Preflight

Status: implemented. The typed read-only command, bounded Node host reader, CLI
registration, and MCP projection share one fact model.

Before dependencies exist, use the dependency-free bootstrap check:

```bash
node scripts/bootstrap-preflight.mjs
```

It reads `packageManager` from the root manifest, compares the ambient pnpm
without contacting a registry, and prints the exact pinned frozen-install
command. It also documents the `npx` recovery path for hosts where Corepack has
stale signing keys. The typed Maestro preflight below runs after installation
and accepts only the repository-declared pnpm version. When Corepack remains
unavailable, keep the displayed `npx --yes pnpm@10.12.1` prefix on subsequent
pnpm commands as well.

Run preflight from the resolved repository root:

```bash
pnpm maestro -- preflight
pnpm maestro -- preflight --details
pnpm maestro -- preflight --json
```

The default view contains only what works now, what still uses sample data, and
the next action. Details and JSON add source/template/target roots, tool and
package versions, workflow compatibility, provider posture names, indexes, and
the preflight fingerprint.

Preflight is read-only. It does not create files, authenticate, contact a
production deployment, print environment values, or expose provider payloads.
The host probe supplies facts to the shared `AgentPackCommand`; CLI and MCP
projections consume the same structured result.

The Node reader uses timeout-protected argument arrays to observe pnpm and
Corepack, Git version/worktree/root/commit/status, the pinned npm registry
reachability posture, and repository metadata. Dirty paths are attributed to the
resolved target root as collisions. Package manifests, install state, disk,
ports, workflow support, and provider environment-variable names are read
without returning environment values. A domain-separated aggregate binding
changes when configured values change under the same names; it is folded only
into the overall preflight fingerprint, never emitted as a value or an
individual reusable secret hash. Fake mode truthfully reports auth as
not-required. Test/live mode reports auth as unknown unless a future safe
provider observation can prove connection; it never authenticates as part of
preflight.

`unknown` means the bounded observation was attempted and unavailable. Every
unknown network, auth, Git-root, dirty, collision, or generated-drift fact has a
diagnostic explaining why and an exact rerun. Missing/wrong tools and a Git-root
mismatch block mutation instead of being replaced with optimistic facts.

Pack, CLI, and template versions come from exact package versions, a validated
customer release identity, or the full observed Git commit. A missing immutable
authority is reported as unavailable and makes versions incompatible; the
literal `workspace` is never presented as a version. Host integration is current
only when every managed Maestro skill file matches the canonical generated
projection. When a packaged customer-context manifest is present, its Maestro
checksums must match that same canonical authority; a target-local manifest
cannot self-certify modified content. Missing, extra, or locally modified
managed files report stale with the Agent Pack repair rerun.

## Fingerprint And Mutation Safety

The fingerprint binds the resolved repository context and all mutation-relevant
preflight facts through stable-key SHA-256 serialization. Later write commands
must require a passing fingerprint and reject it if the repository, environment,
versions, workflow support, provider posture, or target collision state changes.
Changing a deployment, project, account, or token value under an unchanged
environment-variable name therefore invalidates the fingerprint without
disclosing that value.

Mutation remains blocked for ambiguous repository roles, incompatible versions,
dirty overlapping targets, unknown dirty/collision/root state, unsupported
prerequisites, or collisions. Public customer creation also remains blocked
unless HEAD exactly equals the reviewed immutable release tag. When required by
the selected mode, offline network posture, unknown/cancelled optional
authentication, missing providers, and stale host integration produce explicit
diagnostics with one recovery action and exact rerun.

Fake mode does not require network access. An offline or indeterminate registry
probe remains visible in `data.facts.network`, but it is not a diagnostic and
does not make `pnpm maestro -- preflight` exit nonzero. Test and live modes keep
the network diagnostic because those modes may require connected providers.

Terms shown to users are “sample data,” “saved locally,” “connected test
account,” and “live.” Internal fake/seam/evidence labels remain in details.
