# ADR 0002: Maestro Graph Over Convex Workflow

Date: 2026-07-24

## Status

Accepted.

## Context

Maestro needs tenant-safe authoring, typed capability boundaries, policy
snapshots, audit evidence, and stable generated contracts. Convex Workflow
already owns durable replay, journals, events, retries, nested workflows, and
lifecycle operations. Reimplementing those mechanics would create a competing
runtime; exposing them raw would bypass Maestro's architecture contracts.

## Decision

Keep the Maestro graph and policy model as the only application authoring door,
and compile each supported semantic into the pinned Convex Workflow component.
Workflows compose versioned capabilities. Plain Convex component functions are
registered through Confect and generated; application code does not construct a
second workflow manager or import lifecycle primitives directly.

Every official primitive and every Maestro graph field is classified as
`supported`, `intentionally-restricted`, or `unsupported`. A supported entry
requires one typed constructor, compiler mapping, behavior fixture, and repair
reference. Accepted-but-unmapped options fail the semantic gate.

The compatibility record is
[`convex-workflow-compatibility.md`](../convex-workflow-compatibility.md).

## Consequences

- Convex Workflow remains the durable execution authority.
- Maestro may be stricter than upstream where tenant safety, immutable bindings,
  bounded payloads, or portable replay require it.
- Upstream support is not a Maestro support claim until the executable ledger
  and fixtures cover it.
- The current Workpool 0.4.7 pin is compatibility-only. Component behavior
  reproduces the duplicate-completion and duplicate-cancellation regressions on
  both 0.4.7 and candidate 0.4.8, so 0.4.8 is rejected and production workflow
  support remains fail-closed until a runtime avoidance or tested fixed version
  passes both stable semantic rules.
- Dependency changes update the compatibility matrix before semantic
  classifications or generated runners change.
- If this decision changes, this ADR is superseded rather than rewritten.
