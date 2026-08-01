# Task 2 report: graph validation, contract diff, and affected selection

## Implementation

- Added deterministic graph/catalog diagnostics and the repository-facing
  `ReleaseSurfaceInventory` contract.
- Added contract-risk comparison for reduced actor, transport, receipt,
  scenario, and negative-outcome coverage.
- Added fail-safe affected-journey selection with transitive dependent
  invalidation.
- Registered `pnpm check:product-journeys` in package scripts, the canonical
  Just recipes, static descriptor registry, config-drift pins, and the verify
  chain.
- Preserved Task 1's catalog-only dependency-cycle throw behavior while
  inventory-aware validation returns sorted diagnostics.

## Files

- `packages/product-journey/src/graph.ts`
- `packages/product-journey/src/contract-diff.ts`
- `packages/product-journey/src/selection.ts`
- `packages/product-journey/src/{graph,contract-diff,selection}.test.ts`
- `tooling/quality/check-product-journeys.mts`
- `tooling/quality/check-product-journeys.test.mts`
- `tooling/quality/src/check-definitions.mts`
- `tooling/quality/src/diagnosticRegistry.test.mts`
- `packages/product-journey/src/{index,manifest}.ts`
- `package.json`
- `Justfile`

## TDD evidence

RED:

```text
rtk pnpm exec vitest run packages/product-journey/src/graph.test.ts packages/product-journey/src/contract-diff.test.ts packages/product-journey/src/selection.test.ts tooling/quality/check-product-journeys.test.mts
4 failed suites: missing graph, contract-diff, selection, and product-journey gate modules.
```

An additional RED test for unclassified release surfaces failed with
`expected [] to deeply equal [ 'SURFACE_UNCLASSIFIED' ]` before the diagnostic
was implemented.

GREEN:

```text
rtk pnpm exec vitest run packages/product-journey/src tooling/quality/check-product-journeys.test.mts tooling/quality/src/diagnosticRegistry.test.mts
6 files passed, 28 tests passed.

rtk pnpm --filter @maestro-template/product-journey typecheck
TypeScript: No errors found.

rtk pnpm check:product-journeys
check:product-journeys: ok

rtk pnpm check:config-drift
check:config-drift: ok (pin-only)

rtk pnpm check:ci-completeness
check:ci-completeness: ok
```

`rtk git diff --check` also passed.

## Self-review

- Diagnostics are closed-code, immutable, and stably sorted.
- Unknown or unowned changed surfaces select the full catalog.
- Receipt edges require exactly one producer and at least one assertion
  consumer.
- Dependency compatibility and invalidation are transitive.
- The new verify term remains outside the protected
  config-drift/Convex-AI/Agent-Pack adjacency.

## Concerns

The canonical command currently validates the empty initial catalog against an
empty inventory, as requested. A later repository adapter must supply real
manifests and generated release-surface inventory to make this gate enforce a
populated product catalog.
