# Capability Authoring Guide

Capabilities are the safe unit of business action. They authenticate, validate,
delegate, and return typed results.

## Capability Contract

Each capability declares:

- name and description;
- args schema;
- returns schema;
- typed expected errors;
- auth policy;
- cost policy;
- idempotency policy;
- rate-limit policy;
- audit policy;
- headless exposure;
- example fixture.

## Runtime-Authored Capabilities

Runtime-authored capabilities are stored data, not arbitrary code. They support
constrained schemas, policy validation, activation, version pinning, rollback,
fixture tests, and promotion to generated Confect source when compile-time
safety is required.

## Workflow-Callable Capabilities

Generated workflow args carry a server-owned V2 principal and pinned policy
snapshot. A `buildArgs` mapper cannot accept identity or policy overrides from
workflow input; it appends the runner values through the generated mapper.
Queries and non-consequential mutations validate tenant and grants. Before any
external or otherwise consequential effect, call the generated current authority
function inside the capability boundary. It reloads membership by the persisted
actor/workspace and rejects revocation, role downgrade, or grant loss before
provider dispatch. System principals cannot use user-only grants.

## Verification

```bash
pnpm --dir packages/convex test capabilities
pnpm --dir apps/web test src/features/capabilities
pnpm check:confect-contracts
```
