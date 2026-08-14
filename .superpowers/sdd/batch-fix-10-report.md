# Batch Fix 10 Report

## Scope

Applied the five bounded repairs from `batch-fix-10-brief.md`: Playwright
process-output retention/redaction, successful-wrapper stderr suppression, suite
parallel/destructured-describe rejection, and the four reproduced browser
execution APIs. No release, plan, design, App Map, contract/docs truth claim,
receipt schema, target-URL provenance, report-authentication/checksum, generic
CDP provenance, hostile-JavaScript allowlist, or arbitrary dataflow handling
changed.

## TDD evidence

RED (before production edits):

- `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/run-acceptance.test.mts tooling/acceptance/template-product-contract-admission.test.mts --maxWorkers=1 --no-file-parallelism`
  - exit 1; 23/24 tests passed. The injected Playwright stderr regression
    received raw, unlabelled, unredacted process stderr rather than bounded
    `native stderr` output.
- `rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test`
  - exit 1; 243/246 tests passed. Direct `test.describe.parallel` was missed;
    destructured `describe` received zero diagnostics; and all four reproduced
    browser APIs received zero diagnostics. The already-covered member-value
    laundering fixture supplied the one existing annotation diagnostic.

GREEN (final focused head):

- The acceptance command above: exit 0; 24/24 tests passed.
- The rule command above: exit 0; 246/246 tests passed.
- `rtk pnpm check:product-contract`: exit 0 after the disposable generated
  customer structural admission and Convex typecheck.
- `rtk pnpm exec eslint tooling/acceptance/run-acceptance.mts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/template-product-contract-admission.mts tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs examples/saas-application/seed/source/tests/acceptance/support/runtime.ts`:
  exit 0.
- `rtk pnpm exec prettier --check tooling/acceptance/run-acceptance.mts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/template-product-contract-admission.mts tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs examples/saas-application/seed/source/tests/acceptance/support/runtime.ts`:
  exit 0.
- `rtk git diff --check`: exit 0.

No broad or full verification gate ran.

## Task-review follow-up

The read-only task review found that the initial secret-shaped matcher omitted
hyphenated credential fields such as `X-API-KEY`. A RED regression was added
before changing production code:

- `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/run-acceptance.test.mts tooling/acceptance/template-product-contract-admission.test.mts --maxWorkers=1 --no-file-parallelism`
  - exit 1; 23/24 tests passed. Injected `X-API-KEY: hyphen-canary` remained in
    rendered native stderr.

The existing key/value matcher now accepts conventional hyphenated names. The
same focused command returned exit 0 with 24/24 passing after the minimum source
change.

## Reviewer-finding disposition

1. Process output now retains only a 20,000-character rolling tail; rendered
   failure stderr goes through the existing 500-character head/tail witness
   renderer after Bearer, authorization/cookie header, and secret-shaped
   key/value redaction, including conventional hyphenated credential names.
2. Successful generated-customer admission forwards only child stdout, which
   preserves the receipt summary without forwarding Playwright stderr to CI.
3. Direct test-rooted `describe.parallel` is rejected; ordinary `test.describe`
   grouping remains valid, and existing member-value laundering diagnostics
   remain in force.
4. Test-rooted `describe` ObjectPattern extraction is rejected for direct and
   renamed bindings.
5. The browser boundary adds exactly `waitForFunction`, `evaluateHandle`,
   `addScriptTag`, and `newCDPSession`; no generic CDP-command tracking or
   allowlist framework was added.

The prior whole-batch and acceptance reviews are repaired by this bounded fix;
the new frozen head remains review-pending.
