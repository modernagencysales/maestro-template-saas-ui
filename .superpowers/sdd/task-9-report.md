# Task 9 / C8 evidence report

## Status

- Base: `5eb36cafef9d3725fae9071769476765be611dde`
- Branch/worktree: `codex/cucumber-product-contracts-design` in the requested
  linked worktree
- Result: strict Cucumber Messages verifier, genuine reviewed fixture, focused
  mutation suite, package command, Just recipe, and quality registration
  implemented
- Pre-existing unrelated changes preserved and excluded from staging:
  `.superpowers/sdd/task-2-report.md` plus three deleted nested Confect fixture
  artifacts

## TDD evidence

Red command:

```text
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts
```

Observed red: Vitest exited 1 because `./verify-messages.mjs` did not exist.

Fresh green command (the host remained above the default 10.0 load threshold, so
the same required semaphore was run with an explicit focused-only
`HOST_TEST_MAX_LOAD_1M=20` cap):

```text
rtk proxy env HOST_TEST_MAX_LOAD_1M=20 host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts
```

Observed green: 1 file passed, 14 tests passed, 0 failed, exit 0.

The table-driven mutations cover:

- blank, invalid JSON, empty/unknown/two-payload envelopes, schema-invalid
  nested fields, missing/duplicate meta, and incompatible protocol;
- wrong Source bytes/URI, missing/duplicate AST linkage, wrong Outline row, and
  missing/substituted/duplicate PickleSteps;
- zero/multiple/unresolved StepDefinition links, unaligned arguments,
  unresolved/missing Hook links, wrong selection, and invalid TestCase-to-Pickle
  linkage;
- every non-PASSED status (`UNKNOWN`, `SKIPPED`, `PENDING`, `UNDEFINED`,
  `AMBIGUOUS`, `FAILED`), attempt > 0, retry, orphan/missing step events, failed
  run hook, and missing/unsuccessful run finish;
- missing/duplicate BeforeStep/AfterStep markers, extra attachment fields,
  artifact/backend drift, and replay to another TestCaseStarted or non-After
  TestStep.

## Fixture evidence

Generated with the exact brief command:

```text
rtk pnpm exec cucumber-js --config tooling/acceptance/fixtures/messages/cucumber.cjs tooling/acceptance/fixtures/messages/passing.feature --format message:tooling/acceptance/fixtures/messages/passing.ndjson
```

Observed: 1 scenario passed, 2 ordinary hooks passed, 4 emitted test steps
passed. The reviewed stream has 28 envelopes, exactly one Meta and one
Attachment. A fresh byte comparison reports `Source.data === passing.feature` as
`true`.

The one-row Outline exercises Scenario/Examples-row identity. Its real action
increments the fixture counter and its outcome asserts the result. The
fixture-only support registers BeforeAll/AfterAll/Before/After plus
BeforeStep/AfterStep markers; the protected After attaches one closed synthetic
observation envelope.

## Verifier behavior

- Loads `@cucumber/messages/schema` with `createRequire(import.meta.url)`,
  compiles it through `Ajv2020({ strict: true })`, validates every raw nonblank
  line, enforces exactly one known payload, then calls official `parseEnvelope`.
- Pins the reviewed Cucumber 13.2.0 stream protocol (`33.0.4`), validates exact
  selected Source/GherkinDocument pairs and bytes, indexes unique runtime and
  AST IDs, and re-derives stable Pickle/step identity from runtime AST linkage.
- Derives execution only from TestCase -> Pickle, requires exact selected
  equality, unique attempt-zero starts, exact PickleStep/StepDefinition match
  linkage, ordinary and run Hook events, paired step events, PASSED statuses, no
  retry, and a successful matching run finish.
- Validates a closed observation attachment through Attachment ->
  TestCaseStarted -> TestCase -> TestRunStarted and its unique passing After
  hook. It compares checkout/artifact/backend identities, Action/Outcome
  observations, exact marker lists, surface/transport pairs, scenario nonce, and
  Action/server correlations.

`@cucumber/messages@34.0.1` is a direct root dev dependency in addition to the
brief-required `ajv@8.18.0`; pnpm's strict dependency layout otherwise cannot
resolve the required root verifier imports or
`createRequire("@cucumber/messages/schema")`.

## Other fresh checks

```text
rtk pnpm exec eslint tooling/acceptance/verify-messages.mts tooling/acceptance/verify-messages.test.mts tooling/acceptance/fixtures/messages/passing.steps.ts tooling/acceptance/fixtures/messages/passing.support.ts
```

Exit 0. No non-null assertions remain in verifier or tests.

```text
rtk pnpm acceptance:verify-messages -- --help
```

Exit 0 and prints verifier usage.

`rtk git diff --check` exits 0. Prettier was applied to all supported Task 9
files.

## External gate

Protected controller attestation is unavailable in this worker, as stated in the
task dispatch. Focused protocol verification is complete; authoritative
attestation mint/verification remains an external C10 gate and was not simulated
or weakened here.

## Strict review follow-up

The follow-up closes the eight review gaps: exact emitted-Pickle selection,
Pickle tag AST/source identity, semantic match groups, per-start protected After
attachments, expected observation transports, unique complete Action
correlations, exhaustive run-hook envelopes, and the corresponding mutation
matrix.

Red was re-run against the pre-follow-up verifier with the new tests left in
place. Vitest exited 1 with 8 failed and 12 passed tests; the newly added tag,
match-argument, transport, correlation, and run-hook mutations were accepted by
the old verifier.

Fresh green and static checks:

```text
rtk proxy env HOST_TEST_MAX_LOAD_1M=30 host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts
```

Observed: 1 file passed, 20 tests passed, 0 failed, exit 0.

```text
rtk pnpm exec eslint tooling/acceptance/verify-messages.mts tooling/acceptance/verify-messages.test.mts
rtk pnpm acceptance:verify-messages -- --help
```

Both exited 0; the help command printed the verifier usage.

## Final strict-proof follow-up

The final follow-up closes the remaining proof gaps at the verifier boundary:

- observed transport sets must equal each Pickle's expected transport set;
- Action observation and server-correlation nonces are unique and have exact
  one-to-one coverage;
- match groups and parameter type names are re-derived with the pinned
  `@cucumber/cucumber-expressions@20.0.0` implementation from each linked
  StepDefinition and PickleStep text;
- the mixed-selection mutation now emits a second, expected-but-unselected
  Pickle with its own Source, GherkinDocument, AST IDs, runtime IDs, and stable
  keys.

Fresh red evidence against the pre-follow-up verifier: 22 tests ran, 3 failed
and 19 passed. The semantic-match, missing-transport, and reused-nonce streams
were incorrectly accepted. The new genuine unselected-Pickle stream was
correctly rejected by the existing emitted-selection guard.

Fresh green focused evidence:

```text
rtk proxy env HOST_TEST_MAX_LOAD_1M=30 host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts
```

Observed: 1 file passed, 22 tests passed, 0 failed, exit 0.

## Cross-Pickle nonce replay follow-up

The final strict follow-up moves the Action-observation and server-correlation
nonce registries to verifier-run scope. Two selected Pickles can no longer reuse
an otherwise internally consistent correlation nonce across their separate
protected After attachments.

The regression mutation emits a fully linked second Source, GherkinDocument,
Pickle, TestCase, attempt-zero execution, step event set, and protected After
attachment while deliberately replaying the first Pickle's Action/server nonce.
Against the pre-fix verifier, the focused test exited 1 because the mutated
two-Pickle stream was incorrectly accepted.

Fresh green focused evidence:

```text
rtk proxy env HOST_TEST_MAX_LOAD_1M=30 host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts
```

Observed: 1 file passed, 23 tests passed, 0 failed, exit 0.
