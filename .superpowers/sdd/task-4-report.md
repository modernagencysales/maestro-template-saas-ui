# Task 4 report: Records Playwright walking skeleton

## Implementation summary

- Added the four revision-bound Records behaviors, typed fixture-to-real plan,
  generated JSON schema, and generated contract documentation.
- Added the one-worker Chromium Playwright config, four black-box examples, and
  worker/test-scoped runtime fixtures.
- Moved the existing 863-line runtime implementation into acceptance support;
  `features/support/contracts-runtime.ts` is now a Cucumber compatibility
  re-export. The proxy uses native `route.fetch` and
  `route.fulfill({ response })`, with `{ status: 502 }` as the safe failure.
- Kept the existing Cucumber mechanics and updated its proxy parity assertion to
  the native response path.

## RED/GREEN evidence

- RED:
  `rtk host-test-slot --class focused pnpm exec vitest run examples/saas-application/seed/source/tests/acceptance/support/runtime.test.ts --maxWorkers=1 --no-file-parallelism`
  failed with `Cannot find module './runtime'`.
- RED:
  `rtk host-test-slot --class focused pnpm exec playwright test --config examples/saas-application/seed/source/playwright.acceptance.config.ts --list --reporter=json`
  reported missing `./runtime` support and no tests.
- GREEN: focused support Vitest: `4 tests passed`.
- GREEN: compatibility runtime Vitest: `15 tests passed`.
- GREEN: native Playwright discovery: exactly four specs with `@BHV-REC-001-R1`
  through `@BHV-REC-004-R1`, no discovery errors.
- GREEN: `rtk host-test-slot --class focused pnpm lint`: 0 errors (30 existing
  unused-disable warnings).
- GREEN: `rtk pnpm product-contract:generate` completed successfully; a second
  generation left projections byte-stable.

## Baseline evidence

The mandated Cucumber parity command exited 1 before scenarios ran. Its
`BeforeAll` deployment hook failed with
`unable to get local issuer certificate`; output showed `0 scenarios`, so the
expected `4 scenarios (4 passed)` evidence was unavailable due to the local
TLS/deployment environment.

## Changed files

`examples/saas-application/seed/source/{product.contract.yaml,product.contract.schema.json,playwright.acceptance.config.ts}`;
`docs/product/records-plan.md`; generated contract documentation;
`tests/acceptance/{records.spec.ts,support/fixtures.ts,support/runtime.ts,support/runtime.test.ts}`;
the Cucumber runtime re-export and parity test update.

## Self-review

Each visible example has one revision tag, uses only public web/CLI surfaces,
uses unique namespace sentinels, and asserts the contract outcome or denial. No
product imports, database access, mocks, canned success responses, HAR, or
storage APIs are used. Runtime tests cover shared API-base wiring, native
response preservation, safe proxy failure, and diagnostic redaction.

## Concerns

Playwright 1.61 strips one leading `@` from serialized tags. Source uses one
literal extra leading `@` (`@@BHV-...`) so native discovery emits the canonical
`@BHV-...-R1` identity required by the existing parser. Full generated-customer
execution remains intentionally deferred to Task 5. The parity baseline needs to
be rerun when the local TLS/deployment issuer issue is resolved.
