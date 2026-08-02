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

The canonical command no longer permits an empty initial catalog or inventory.
It fails with `ADAPTER_MISSING` until repository adoption supplies the explicit
adapter.

## Review-finding fixes

- Replaced the empty/no-op command input with a strict repository adapter and
  descriptor contract. The descriptor names non-empty, readable catalog,
  generated-inventory, merge-base, and journey-ID migration sources, and must
  declare the complete closed scan-mechanism set.
- Added stable fail-closed diagnostics for missing/unreadable/invalid adapters,
  invalid manifests, unowned/unclassified surfaces, and governed baseline
  contract changes. The CLI supports `--adapter` and `--repo-root` for focused
  fixtures.
- Removed `check:product-journeys` from root `verify` until Task 4 adoption,
  while retaining the package script, static descriptor, config-drift pin, and
  Just recipe. CI-completeness now rejects premature verify registration.
- Expanded contract diffing to canonical SHA-256 structural identities for every
  scenario instance and all scenario semantics, including duplicate classes,
  interactions, terminal outcomes, receipts, forbidden bypasses,
  fixture/assertion metadata, isolation/replay/retry, and deployed proof.
- Added bidirectional entrypoint resolution, actual/generated legacy
  reachability ratchets, and locale-independent code-point ordering.
- Added generic surface-authority witnesses that derive minimum coverage and
  release proof, plus a validated migration ledger that prevents journey
  deletion/rename/split from resetting baseline state.

### Review RED evidence

```text
rtk pnpm exec vitest run packages/product-journey/src/graph.test.ts packages/product-journey/src/contract-diff.test.ts packages/product-journey/src/selection.test.ts tooling/quality/check-product-journeys.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/check-ci-completeness.test.mts
18 failed, 16 passed. Expected failures covered reverse entrypoint ownership,
legacy expansion, locale-sensitive ordering, scenario semantic/multiplicity
changes, adapter failures, baseline comparison, and premature verify inclusion.

rtk pnpm exec vitest run tooling/quality/check-product-journeys.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/check-ci-completeness.test.mts
5 failed, 15 passed. The absent/empty/unknown/unreadable descriptor and empty
catalog/inventory bypasses still passed before descriptor validation.

rtk pnpm exec vitest run packages/product-journey/src/graph.test.ts packages/product-journey/src/contract-diff.test.ts tooling/quality/check-product-journeys.test.mts
7 failed, 29 passed. Surface authority derivation and protected journey-ID
migration semantics were not yet implemented.
```

### Review GREEN evidence

```text
rtk pnpm exec vitest run packages/product-journey/src tooling/quality/check-product-journeys.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/src/diagnosticRegistry.test.mts
8 files passed, 66 tests passed. This includes fixture-backed CLI success and
default CLI exit 1 with ADAPTER_MISSING.

rtk pnpm --filter @maestro-template/product-journey typecheck
TypeScript: No errors found.
```

### Task 4-owned adoption remainder

Task 4 must install the real repository adapter and descriptor, generate and
protect the complete catalog/surface-authority inventory and merge-base source,
maintain the reviewed journey-ID migration ledger, then add the adapter-backed
command to protected CI/root `verify`. Task 2 deliberately fails closed until
those artifacts exist; it does not infer or ship placeholder repository data.

## Second re-review closure

Commit `a473d5d2` closes the four remaining technical blockers: source and
merge-base digest binding, one-to-one authority ownership, protected migration
approval plus continuity, and exact edge-specific producer/consumer witnesses.

Fresh verification:

```text
rtk pnpm --dir packages/product-journey typecheck
TypeScript: no errors.

rtk host-test-slot --class focused pnpm exec vitest run packages/product-journey/src tooling/quality/check-product-journeys.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/src/diagnosticRegistry.test.mts
8 files passed, 71 tests passed.

Targeted ESLint, Prettier, and git diff checks also passed.
```
