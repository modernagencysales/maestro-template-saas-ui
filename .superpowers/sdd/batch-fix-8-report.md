# Batch Fix 8 Report

## Scope

Bounded acceptance-provenance and generated-document truth repair from clean
base `d1e7396da603a63759544165ed7f2bb89346efa6`:

- centralize ObjectPattern extraction checks across declarations, function
  parameters, and assignments;
- reject computed route-control extraction and `route.fetch` aliases;
- limit `route.fulfill({ response })` to the canonical direct `const` awaited
  `route.fetch` binding with one direct `url: targetUrl` property and no
  computed or spread properties;
- state the generated-document verification boundary and regenerate the seed
  projection.

No runtime implementation, plan, release, App Map, report-authentication,
checksum, hostile-JavaScript sandbox, or TOCTOU-locking changes were made. No
broad verification was run.

## TDD evidence

Rule RED command:

```sh
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Observed RED: exit 1; `rules/__tests__/rules.test.mjs` ran 231 tests with 223
passed and 8 failed. The old rule emitted no diagnostics for parameter and
assignment ObjectPatterns, computed `route[method]` extraction, `route.fetch`
alias/destructure, noncanonical direct fetch URLs/properties, and unproven
fulfilled responses.

Renderer RED command:

```sh
rtk host-test-slot --class focused pnpm --dir packages/template-core exec vitest run src/productContract.test.ts --maxWorkers=1 --no-file-parallelism
```

Observed RED: exit 1; 4 tests ran with 3 passed and 1 failed because the
rendered Markdown lacked the required structural-link, `unproven`, and
exact-head receipt caveat.

Rule GREEN command:

```sh
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Observed GREEN: exit 0; 1 test file passed and all 231/231 tests passed.

Review-follow-up RED command:

```sh
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Observed RED: exit 1; 233 tests ran with 231 passed and 2 failed. The read-only
review's duplicate `url` override and computed ObjectPattern key fixtures each
received zero diagnostics before the repair.

Review-follow-up GREEN command:

```sh
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Observed GREEN: exit 0; 1 test file passed and all 233/233 tests passed.

Quoted-key follow-up RED command:

```sh
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Observed RED: exit 1; 234 tests ran with 233 passed and 1 failed. A quoted
`"url"` property could otherwise override the direct canonical `url` key without
a diagnostic.

Quoted-key follow-up GREEN command:

```sh
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Observed GREEN: exit 0; 1 test file passed and all 234/234 tests passed.

Renderer GREEN command:

```sh
rtk host-test-slot --class focused pnpm --dir packages/template-core exec vitest run src/productContract.test.ts --maxWorkers=1 --no-file-parallelism
```

Observed GREEN: exit 0; 1 test file passed and all 4/4 tests passed.

## Generated projection and focused structural check

```sh
rtk pnpm product-contract:generate
```

Observed: exit 0; regenerated
`examples/saas-application/seed/source/docs/template/generated/product-contract.md`.

```sh
rtk pnpm check:product-contract
```

Observed: the narrow structural admission completed without product-contract
findings after materializing its disposable generated customer, codegen, and
typecheck. The helper emits no success line.

## Changed-file checks

```sh
rtk pnpm exec eslint tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs packages/template-core/src/productContract.ts packages/template-core/src/productContract.test.ts examples/saas-application/seed/source/tests/acceptance/support/runtime.ts
```

Observed: exit 0 with no diagnostics. This confirms the actual canonical runtime
proxy still lint-passes.

```sh
rtk pnpm exec prettier --check tooling/eslint-plugin-template/rules/acceptance-boundary.mjs tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs packages/template-core/src/productContract.ts packages/template-core/src/productContract.test.ts examples/saas-application/seed/source/docs/template/generated/product-contract.md
```

Observed: exit 0; all matched files use Prettier code style.

```sh
rtk git diff --check
```

Observed: exit 0 with no whitespace errors.

## Read-only review

The review found computed ObjectPattern and duplicate direct-`url` bypasses.
Both received RED regressions and are covered by the final 234/234 RuleTester
GREEN run; the re-review independently confirmed the quoted duplicate emits
`synthetic`.

## Controller dispositions

- Preserve multiple examples per behavior: design lines 291–292 explicitly allow
  them.
- Preserve `headless:records-api`, the current generated-customer App Map node;
  do not rewrite `docs/superpowers/**` or `releases/**`.
- Do not add report authentication, acceptance-source or runtime-controller
  checksums, a hostile-JavaScript sandbox, or TOCTOU locking. Candidate code
  shares the repository/process trust domain; exact-head full verification and
  Woodpecker remain the authority.
- Preserve Node built-in imports and the explicit semantic `unproven`
  limitation.
