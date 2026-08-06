# Lean Cucumber Product Contracts Implementation Plan

> **For agentic workers:** Implement inline with `executing-plans`. Do not
> dispatch review swarms or create a PR/CI run per task.

**Goal:** Make four natural-language records scenarios execute through a fresh
generated target's real UI and CLI, starting with UI-create → CLI-list.

**Architecture:** Cucumber starts the existing local Maestro process tree and
drives Playwright plus the existing CLI executable. Both surfaces use the same
API-key-authenticated Convex HTTP boundary and backend. A minimal Gherkin
checker owns tag structure; Cucumber owns step binding and the verdict.

**Tech stack:** TypeScript, Cucumber/Gherkin, Playwright, Vite, Confect, Convex,
Vitest. All dependencies are already installed.

## Global Constraints

- One branch, one PR, one final Woodpecker run.
- At most four implementation commits, 35 added/modified source or test files,
  and no new dependency or service. Documentation and deletions are excluded
  from the file count.
- Use only `@wip` and `@required` Feature lifecycle tags.
- Use exactly one of `@ui`, `@cli`, or `@cross_surface` per Scenario.
- The raw fixture API key remains process-memory/environment-only and is never
  written, logged, placed in browser code, or committed.
- Progress is only `0/4` through `4/4 scenarios`.
- Stop on any controller, daemon, custom protocol, generalized auth framework,
  persistent acceptance store, or second records service.

## Delivery Batch

There is one delivery batch containing Tasks 1-4.

- Branch/head: `codex/cucumber-product-contracts-lean` / frozen after Task 4
- Base and PR target: `origin/main`
- Per-task verification: focused tests named below
- Whole-batch verification: fresh generated target, mutation proof, then
  `rtk maestro-remote-test -- pnpm verify`
- Blocking external verdict: one `ci/woodpecker/pr/verify` run on the frozen
  head; Qlty remains advisory

## Task 1: Replace The Custom Static Contract Rules

**Disposition:** `template-gap`; replace the custom journey language with the
installed Gherkin/Cucumber standard.

**Files:**

- Modify: `tooling/acceptance/check-features.mts`
- Modify: `tooling/acceptance/check-features.test.mts`
- Delete: `tooling/acceptance/check-contracts.mts`
- Delete: `tooling/acceptance/check-contracts.test.mts`
- Modify: `package.json`

**Interface produced:**

```ts
compileFeatureContracts(source: string): {
  readonly ok: boolean;
  readonly findings: readonly string[];
}
```

- [ ] Write tests proving valid `@wip`/`@required` Features pass and invalid
      syntax, zero/two lifecycle tags, zero/two Scenario surface tags, and a
      required Feature without `@cross_surface` fail.
- [ ] Run the tests and observe failures caused by the old journey/topology
      rules.
- [ ] Reduce the checker to parser and tag cardinality checks only. Remove
      `@journey_*`, topology lookup, wording regexes, custom journey output, and
      the exact-byte Cucumber-config checker. Point `acceptance:check` at the
      small feature checker plus Cucumber dry-run.
- [ ] Run:

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/check-features.test.mts
  rtk pnpm acceptance:features
  rtk pnpm acceptance:check
  ```

- [ ] Commit: `feat: simplify cucumber contract checks`

## Task 2: Make The First Real Cross-surface Scenario Pass

**Disposition:** `pattern-instance` for generated records; `reuse`
`access-and-tenancy` for API keys and workspace authorization.

**Files:**

- Modify: `packages/convex/confect/headless/auth.ts`
- Modify: `packages/convex/test/headless-auth.test.ts`
- Create: `packages/convex/confect/headless/apiKeys.spec.ts`
- Create: `packages/convex/confect/headless/apiKeys.impl.ts`
- Modify: `packages/convex/confect/http.ts`
- Modify: `packages/convex/test/http-docs.test.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/web/vite.config.ts`
- Create:
  `examples/saas-application/seed/source/apps/web/src/adapters/records/http.ts`
- Modify:
  `examples/saas-application/seed/source/apps/web/src/features/records/records-surface.tsx`
- Modify:
  `examples/saas-application/seed/source/packages/convex/confect/records.spec.ts`
- Modify:
  `examples/saas-application/seed/source/packages/convex/confect/records.impl.ts`
- Create: `examples/saas-application/seed/source/features/records.feature`
- Create:
  `examples/saas-application/seed/source/features/step_definitions/records.steps.ts`

**Interfaces produced:**

```ts
verifyApiKeyHash(input: {
  readonly presentedHash: string;
  readonly rows: readonly ApiKeyRow[];
  readonly nowMs: number;
  readonly requiredScope: ApiKeyScope;
}): ApiKeyVerificationResult

runRemoteCapability(argv: readonly string[], env: NodeJS.ProcessEnv):
  Promise<CliResult | undefined>

createHttpRecordAdapter(baseUrl?: string): RecordAdapter
```

The internal `headless/apiKeys` group resolves an already-hashed key to a
workspace/user actor and idempotently seeds the fixed `template-demo` local
fixture. The generated records group adds internal actor list/read/create
functions which share the existing persistence helpers and call
`requireWorkspaceActorAccess`.

- [ ] Add failing unit tests for hash verification, remote CLI request shape,
      and stable 401/403 HTTP behavior. The first Cucumber Scenario is the
      runnable check for the thin web response adapter.
- [ ] Run them and observe the expected missing-interface failures.
- [ ] Add the minimal server, CLI, Vite proxy, and contract-mode UI bindings.
      Keep the general in-process CLI path unchanged when remote environment
      variables are absent.
- [ ] Add the single `@required` UI-create → CLI-list Feature and its minimal
      Cucumber World/hooks/steps. Generate the raw key in the Cucumber process,
      hash it for the internal seed, start `maestro start --mode local` with
      free port overrides, and terminate it in `AfterAll`.
- [ ] Extend the existing create-root integration only far enough to materialize
      a current disposable target, install/codegen it, initialize a clean git
      repository, and invoke Cucumber from that target. Never execute the
      records contract against the factory checkout itself.
- [ ] Run the Scenario in that generated target and record its initial failure
      before completing the binding, then rerun until `1/4 scenarios` passes:

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run packages/convex/test/headless-auth.test.ts packages/convex/test/http-docs.test.ts apps/cli/src/index.test.ts
  rtk host-test-slot --class focused pnpm --dir apps/cli test:create-root-integration
  ```

- [ ] Commit: `feat: prove records through ui and cli`

## Task 3: Complete The Four-scenario Reference Contract

**Files:**

- Modify: `examples/saas-application/seed/source/features/records.feature`
- Modify:
  `examples/saas-application/seed/source/features/step_definitions/records.steps.ts`
- Modify: `packages/convex/test/http-docs.test.ts`
- Modify: `apps/cli/src/index.test.ts`

- [ ] Add the CLI-create → UI-list Scenario and watch it fail before adding only
      the missing steps.
- [ ] Add missing-key denial and watch it fail; make the CLI return a stable
      nonzero result and prove absence through the UI.
- [ ] Add bound-key/other-slug denial and watch it fail; make the server return
      403 without mutation and prove the bound workspace stayed unchanged.
- [ ] Run the four-Scenario Feature until it reports `4/4 scenarios`:

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run packages/convex/test/http-docs.test.ts apps/cli/src/index.test.ts
  rtk pnpm acceptance:cucumber -- --tags @required
  ```

- [ ] Commit: `test: complete records product contract`

## Task 4: Embed Contracts In Generated App Work

**Files:**

- Create: `apps/cli/src/factory/contracts.ts`
- Create: `apps/cli/src/factory/contracts.test.ts`
- Modify: `apps/cli/src/factory/customerComposition.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `Justfile`
- Modify: `tooling/ci/verify-chassis.sh`
- Modify: `AGENTS.md`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/src/diagnosticRegistry.test.mts`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `tsconfig.json`
- Delete: `packages/product-journey/**`
- Delete: `tooling/quality/check-product-journeys.mts`
- Delete: `tooling/quality/check-product-journeys.test.mts`
- Modify: gate registrations and active docs that reference the deleted
  authority

**Commands produced:**

```text
maestro contracts add <journey>
maestro contracts check
maestro contracts test [journey|--required]
```

- [ ] Write failing CLI tests: `add` writes one `@wip` Feature; `check` invokes
      the small checker plus Cucumber dry-run; `test` runs the chosen Feature.
- [ ] Add the three handlers to `createCustomerCliComposition`; do not add a
      second factory-only command system.
- [ ] Project the contract files and personalized first-outcome Feature into a
      current generated target. Run required contracts from customer CI only
      when `template-instance.json` exists.
- [ ] Extend `createRootIntegration.test.ts` to generate, project, install,
      codegen, compile, initialize a disposable git repository, and run
      `pnpm maestro -- contracts test --required`.
- [ ] In that disposable target, change the visible `Save record` behavior,
      observe the contract command fail, restore it, and observe it pass.
- [ ] Remove the old custom product-journey authority and its active gate
      registrations only after the Cucumber replacement proof passes.
- [ ] Commit: `feat: make cucumber contracts the product gate`

## Frozen-head Verification

- [ ] Confirm the worktree contains only the intended batch and no raw key:

  ```sh
  rtk git diff --check origin/main...HEAD
  rtk git status --short
  rtk rg -n 'mtk_live_' --glob '!docs/**'
  ```

- [ ] Run the focused generated-target integration through the host semaphore.
- [ ] Commit any verification-only correction into Task 4, freeze the head, and
      run exactly one remote full verification:

  ```sh
  rtk maestro-remote-test -- pnpm verify
  ```

- [ ] Open one PR. Use only `ci/woodpecker/pr/verify` as the blocking GitHub
      status.
