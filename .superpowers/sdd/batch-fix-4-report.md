# Batch Fix 4 Report

## Files and reasons

- `tooling/acceptance/playwright-report.mts` and focused tests: preserve native
  `testDir`/`testMatch`, normalize Playwright's singleton matcher array, and
  bind report files to the acceptance tree.
- `tooling/acceptance/product-contract.mts` and `run-acceptance.mts`, with
  focused tests: reject redirected discovery, structural, and runtime reports.
- `tooling/eslint-plugin-template/rules/acceptance-boundary.mjs` and rule tests:
  resolve tagged registrations by canonical lexical binding, close indirect
  Playwright escapes, and require the exported auto-runtime fixture shape.
- `tooling/agent-pack/src/verify.ts`: split `execute` and `decodeVerifyInput`
  into helpers so changed-file complexity is at most 10 without behavior change.

## Focused evidence

1. `rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test`
   — exit 0; 1 file, 186 tests passed.
2. `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/playwright-report.test.mts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/product-contract.test.mts --maxWorkers=1 --no-file-parallelism`
   — exit 0; 3 files, 41 tests passed.
3. `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/receipt.test.ts src/verify.test.ts --maxWorkers=1 --no-file-parallelism`
   — exit 0; 2 files, 34 tests passed.
4. `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack typecheck`
   — exit 0; TypeScript completed with no diagnostics.
5. `rtk host-test-slot --class focused pnpm check:product-contract` — exit 0;
   structural admission completed for the generated customer.
6. `rtk proxy env ESLINT_SHIFT_LEFT=1 pnpm eslint tooling/acceptance/playwright-report.mts tooling/acceptance/playwright-report.test.mts tooling/acceptance/product-contract.mts tooling/acceptance/product-contract.test.mts tooling/acceptance/run-acceptance.mts tooling/acceptance/run-acceptance.test.mts tooling/agent-pack/src/verify.ts tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs tooling/eslint-plugin-template/rules/acceptance-boundary.mjs`
   — exit 0; no lint findings.
7. `rtk git diff --check` — exit 0; no whitespace errors.

## Commit

Implementation: `d5a002b` (`fix: harden acceptance admissions`).

## Concerns and deferred limits

- The rule closes the reviewed mechanical indirect API paths (`call`/`apply`/
  `bind`, extraction, `Reflect`, and `Proxy`); arbitrary assertion semantics
  remain advisory.
- `apiBaseUrl` and declared `public-http`/`fetch` use remain intentionally
  permitted as recorded by the reviewed minor disposition.
