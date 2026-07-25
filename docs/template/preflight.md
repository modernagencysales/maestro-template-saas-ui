# Maestro Preflight

Status: seam. The typed read-only command and fixtures are implemented; central
CLI registration and host-reader wiring remain controller-owned integration.

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
The host probe supplies facts to the shared `AgentPackCommand`; CLI and future
MCP projections consume the same structured result.

## Fingerprint And Mutation Safety

The fingerprint binds the resolved repository context and all mutation-relevant
preflight facts through stable-key SHA-256 serialization. Later write commands
must require a passing fingerprint and reject it if the repository, environment,
versions, workflow support, provider posture, or target collision state changes.

Mutation remains blocked for ambiguous repository roles, incompatible versions,
dirty overlapping targets, unsupported prerequisites, or collisions. Offline,
cancelled optional authentication, missing providers, and stale host integration
produce explicit diagnostics with one recovery action and exact rerun.

Terms shown to users are “sample data,” “saved locally,” “connected test
account,” and “live.” Internal fake/seam/evidence labels remain in details.
