# Batch Fix 9 Report

## Scope

Implemented the six accepted Batch Fix 9 findings only. No release, plan,
design, App Map, receipt-schema, Cucumber disposition, target-URL tracing, or
native JSON `browserName` expansion was changed.

## TDD evidence

RED (before production edits):

- `rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test`
  - 240 tests: 6 failed, 234 passed. The six new laundering, ObjectPattern,
    direct-fetch, and suite-configure regressions each received zero findings.
- `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/product-contract.test.mts --maxWorkers=1 --no-file-parallelism`
  - 11 tests: 3 failed, 8 passed. Discovery metadata was admitted, the target
    commit was discarded, and the stale branch bootstrap was admitted.

GREEN (final formatted head):

- `rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test`
  - 240 passed.
- `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/product-contract.test.mts --maxWorkers=1 --no-file-parallelism`
  - 11 passed.
- `rtk pnpm product-contract:generate` passed.
- `rtk pnpm check:product-contract` passed.
- `rtk pnpm exec eslint tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs tooling/acceptance/product-contract.mts tooling/acceptance/product-contract.test.mts examples/saas-application/seed/source/tests/acceptance/support/runtime.ts`
  passed.
- `rtk pnpm exec prettier --check tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs tooling/acceptance/product-contract.mts tooling/acceptance/product-contract.test.mts examples/saas-application/seed/source/tests/acceptance/support/runtime.ts`
  passed.
- `rtk git diff --check` passed.

## Reviewer-finding disposition

1. Target history now retains the resolved target commit while continuing to
   read trusted content from the merge base; stale bootstrap is covered.
2. Discovery now requires expected `passed` status and rejects `skip`, `fixme`,
   and `fail` annotations without treating listing results as runtime evidence.
3. Generic non-callee member checks close value laundering while retaining
   canonical direct-call validation.
4. A generic ObjectPattern visitor covers nested, parameter, assignment, and
   catch extraction; the canonical proxy input uses `requestRoute` locally.
5. Every direct `route.fetch` call is now canonical-runtime, direct-await, and
   exact-shape checked; fulfillment provenance remains unchanged.
6. Test-rooted `describe.configure` is rejected for direct calls and tracked
   aliases.

No broad or full verification gate ran.
