# Product Topology

The system catalog answers who owns a responsibility. The product topology
answers which production resources implement and project that responsibility.

The machine-readable baseline is
[`product-topology.json`](./product-topology.json). It records the canonical
owner, responsibility, actor surfaces, lifecycle, and cross-system dependencies
for hand-authored capabilities, workflows, agents, jobs, routes, headless
gateways, and provider seams.

Generated production resources do not need a manual topology entry when their
checked-in generator provenance records a canonical `system` and
`reuse`/`extend` disposition. `pnpm check:system-topology` discovers production
artifacts and blocks any path that is covered by neither the baseline topology
nor valid generator provenance.

## Agent Workflow

Before creating a production resource:

1. Run `pnpm template:systems -- --query <responsibility-or-resource>`.
2. Reuse or extend the returned system.
3. Use the matching generator so ownership provenance is emitted.
4. Keep experiments behind the promotion boundary until the responsibility and
   owner are settled.
5. Run `pnpm check:system-topology` before promotion.

Hand-written production resources are exceptional. Add them to
`product-topology.json` in the same change and state a responsibility that is
not already owned by another resource. Actor-specific web/API/CLI/MCP views may
depend on multiple systems, but each resource still has one primary owner and
must delegate rather than create parallel state or orchestration.

## Deterministic And Semantic Roles

The topology gate checks exact coverage, paths, owners, dependencies, and
generated provenance. Contract review checks the meaning: whether two different
resource names actually implement the same lifecycle or authority. Do not add
fuzzy repository-wide matching to the deterministic gate.
