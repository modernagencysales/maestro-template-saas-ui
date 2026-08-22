# Batch Fix 5 Report

Initial implementation commit: `d3f4df6`. Initial report commit: `c70351f`.
Follow-up bypass repair commit: `9906595`.

## Files and reasons

- `tooling/eslint-plugin-template/rules/acceptance-boundary.mjs` and its
  RuleTester cases: close fixture lifecycle, behavior registration,
  loader/storage, and config execution-hook bypasses.
- `tooling/acceptance/playwright-report.mts` and focused tests: fail closed on
  the native config shape, cross-platform paths, and realpath containment.
- `tooling/acceptance/run-acceptance.mts` and
  `tooling/acceptance/product-contract.mts`: apply realpath containment only on
  native production paths, retaining injected unit seams.
- `eslint.config.mjs` and the seed Playwright config: lint the config as a
  closed surface and state its canonical parallel/repeat/ignore settings.
- Follow-up: the same rule and report tests reject side-effect config modules,
  fixture-option overrides, storage-bearing context creation, and spread-based
  `test.use`; path containment normalizes native relative separators.

## Focused evidence

1. `rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test`
   — exit 0; 1 file, 209 tests passed.
2. `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/playwright-report.test.mts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/product-contract.test.mts --maxWorkers=1 --no-file-parallelism`
   — exit 0; 3 files, 57 tests passed.
3. `rtk host-test-slot --class focused pnpm check:product-contract` — exit 0;
   structural materialized-customer contract gate passed.
4. `rtk proxy env ESLINT_SHIFT_LEFT=1 pnpm eslint eslint.config.mjs examples/saas-application/seed/source/playwright.acceptance.config.ts tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs tooling/acceptance/playwright-report.mts tooling/acceptance/playwright-report.test.mts tooling/acceptance/product-contract.mts tooling/acceptance/product-contract.test.mts tooling/acceptance/run-acceptance.mts tooling/acceptance/run-acceptance.test.mts`
   — exit 0; no findings.
5. `rtk git diff --check` — exit 0; no whitespace errors.
6. `rtk git status --short` — exit 0; clean before the ignored report was added.

## Concerns and deferred limits

The native Playwright JSON reporter can omit root-level hook/repeat/ignore
fields in a materialized customer. The parser accepts only omitted/null values
there, while requiring the canonical project values and the closed source
config. Assertion meaning and meaningful use of declared surfaces remain
advisory review obligations, as required.
