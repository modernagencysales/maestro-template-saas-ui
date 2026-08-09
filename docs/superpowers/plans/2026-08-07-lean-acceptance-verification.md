# Lean Acceptance And Verification Implementation Plan

> **For the lane owner:** Treat this as one continuous subsystem goal. Make
> coherent commits, run focused checks while authoring, and keep moving until
> the complete lane outcome is ready for review.

**Goal:** Preserve real Cucumber UI/CLI customer-journey evidence while removing
the parallel Gherkin policy compiler, duplicate suite execution, duplicate
readiness polling, and source-wording substitutes for behavior.

**Architecture:** Cucumber's public `loadConfiguration`/`loadSources` APIs
become the sole source-selection authority, with one thin guard that rejects an
empty `@required` plan before Cucumber executes it. Generated contract support
uses one supervised `maestro start` process and one browser per Cucumber
invocation, with a fresh browser context/page per Scenario. Package scripts own
verification; hooks and CI invoke those owners without independently restating
or rerunning their internals.

**Tech Stack:** TypeScript 5.9, Node.js 22, pnpm 10, Cucumber.js 13 public API,
Playwright, Vitest, Turbo, Woodpecker.

## Global Constraints

- Start branch `codex/lean-acceptance-verification` from the current
  `origin/main`; do not build on the dirty main checkout or on
  `codex/template-enforced-engineering-rules`.
- At lane startup, compare commits `326a2761a` through `76c24a137` once and
  record reusable hunks/rejected policies in the worker brief; do not repeat
  per-file archaeology or merge that branch wholesale.
- Keep Cucumber and executable UI/CLI contracts in generated customer
  applications.
- `@required` selects blocking promises; `@wip` and untagged Features are
  drafts.
- Do not require `@ui`, `@cli`, or `@cross_surface` metadata. Observable steps
  identify the exercised surfaces.
- The only custom selection rule is that `contracts test --required` must match
  at least one Cucumber pickle. Do not add a parser, manifest, receipt, frozen
  finding set, or evidence database.
- Keep generated product Features focused on high-value customer journeys;
  outlines, validation matrices, and parser edge cases belong in Vitest or Node
  tests. Review this qualitatively rather than adding a scenario-count gate.
- Keep the four records example journeys because they prove UI-to-CLI
  continuity, CLI-to-UI continuity, missing-key denial, and cross-workspace
  denial. Lane 1 is responsible for retaining that Feature as an explicit
  factory example rather than projecting it as every neutral customer's required
  promise.
- `maestro start` is the only readiness owner. Contract support may await its
  ready announcement and retain its diagnostics, but must not independently poll
  `/health` or use a fixed sleep.
- Launch one browser per Cucumber invocation and create a fresh browser context
  and page for every Scenario.
- Focused checks run while authoring. Woodpecker runs the sole blocking full
  verification against the current PR head.
- Woodpecker is the only blocking CI authority. Qlty and AI review remain
  advisory.
- This core lane publishes coherent commits to the shared composition owner; it
  does not open its own PR or run a duplicate full gate.
- Preserve tenant isolation, missing-key denial, secret redaction, process
  cleanup, path safety, and all destructive-operation protections.
- Qlty authoring thresholds are identical `12`, similar `15`, function
  complexity `10`, file complexity `50`, returns `5`, boolean logic `4`,
  parameters `5`, and nesting `4`. Qlty is advisory and excludes `tooling/**`;
  ESLint deterministically enforces changed-code complexity `10`, nesting `4`,
  and parameters `5` where configured.
- Preserve strict TypeScript, no new `any`, non-null assertions, unchecked
  suppressions, or type-coverage regression below `99.7%`; keep Effect
  diagnostics, dependency-cruiser/Knip, Gitleaks, tenant, and architecture
  gates.
- Use repository-pinned tools. Do not accept host-global formatter, linter,
  test, or scanner output as evidence.
- Run repository-pinned Qlty on the lane diff with the host's 30-second cap for
  visibility; record findings without treating provider/runtime failure as
  admission.
- Touch no deployment, migration, rollback, promotion, or immutable
  release-archive authority in this lane.

## File Structure

- `tooling/acceptance/required-selection.mts`: thin adapter from Cucumber's
  resolved configuration to its filtered pickle plan; owns only non-empty
  `@required` admission.
- `tooling/acceptance/required-selection.test.mts`: native-API tests for
  required, draft-only, outlines, and invalid Gherkin selection.
- `tooling/acceptance/check-features.mts` and `.test.mts`: deleted custom parser
  and policy tests.
- `apps/cli/src/factory/contracts.ts` and `.test.ts`: route `contracts check` to
  Cucumber dry-run and `contracts test --required` through the thin selection
  guard followed by Cucumber execution.
- `examples/saas-application/seed/source/features/support/contracts-world.ts`:
  per-Scenario browser state and cleanup.
- `examples/saas-application/seed/source/features/support/contracts-runtime.ts`:
  one product process, one browser, bounded startup evidence, and teardown for a
  contract invocation.
- `examples/saas-application/seed/source/features/step_definitions/records.steps.ts`:
  business steps consuming the shared world/runtime without owning browsers or
  readiness.
- `tooling/generators/src/blueprints/saasApplicationFactory.ts`: project the
  support runtime with the selected records example.
- `tooling/generators/src/blueprints/saasRegistrationProjections.ts`: project
  the native selection guard and the non-overlapping customer scripts.
- `tooling/generators/src/blueprints/saasApplication.test.ts`: prove the
  projected runtime, scripts, tags, support files, and journey count.
- `apps/cli/src/factory/createRootIntegration.test.ts`: one installed
  current-target acceptance fixture and explicit records/security journey
  execution.
- `apps/cli/package.json`, `tooling/ci/verify-chassis.sh`, and
  `tooling/ci/verify-chassis.test.mts`: expose and run the narrow
  generated-customer admission suite, reusing the coherent shape from
  `8ca3f5b20`.
- `package.json`: one owner for each root suite plus native Cucumber scripts.
- `tooling/ci/firewall.sh`, `tooling/ci/epoch.sh`, `tooling/ci/phase1.sh`, and
  `lefthook.yml`: call script owners without duplicate acceptance or post-verify
  checks.
- `tooling/quality/src/check-definitions.mts`,
  `tooling/quality/check-ci-completeness.test.mts`,
  `tooling/quality/check-config-drift.test.mts`, and
  `tooling/quality/woodpecker-template-pipeline.test.mts`: update compatibility
  pins only where command text is the contract.
- Existing CI-completeness tests prove root test/verify ownership has no
  duplicate suite path; this lane does not add another command registry.
- `tooling/quality/check-headless-surface-contract.mts` and `.test.mts`: remove
  prose/source-fragment substitutes for runtime behavior while retaining
  manifest parity checks.
- `packages/convex/test/headless-executor.test.ts`: behavior-driven,
  manifest-derived idempotency denial proof.

## Lane Contribution

### Batch 1: Lean acceptance and verification

- **Core tasks:** 1, 2, and 5. Tasks 3-4 are explicit handoffs to the
  composition and Active Cleanup owners.
- **Branch:** `codex/lean-acceptance-verification`.
- **Base:** current `origin/main` at execution start.
- **PR target:** none from this lane; the composed branch targets `main`.
- **Focused task checks:** the exact Vitest/Cucumber commands listed in each
  task.
- **Whole-batch review command:**
  `rtk git diff --check origin/main...HEAD && rtk git diff --stat origin/main...HEAD && rtk git diff origin/main...HEAD`.
- **Required verification:** focused lane checks plus handoff to the composed
  delivery branch; that branch owns the single PR and Woodpecker result.
- **Lane value:** keeps current records journeys executable, makes required
  selection truthful through Cucumber, and supplies tested compatibility
  contracts to the shared owners.

---

### Task 1: Replace the custom Feature compiler with native Cucumber selection

**Files:**

- Create: `tooling/acceptance/required-selection.mts`
- Create: `tooling/acceptance/required-selection.test.mts`
- Create: `tooling/acceptance/source-check.mts`
- Create: `tooling/acceptance/source-check.test.mts`
- Delete: `tooling/acceptance/check-features.mts`
- Delete: `tooling/acceptance/check-features.test.mts`
- Modify: `apps/cli/src/factory/contracts.ts`
- Modify: `apps/cli/src/factory/contracts.test.ts`

**Interfaces:**

- Consumes: Cucumber `loadConfiguration({ file, provided }, { cwd })` and
  `loadSources(runConfiguration.sources, { cwd })`.
- Produces: `assertRequiredSelection(cwd: string): Promise<void>`.
- Defines generated-customer scripts `acceptance:syntax`, `acceptance:check`,
  `acceptance:required-selection`, and `acceptance:cucumber` for Task 3. Removes
  legacy `acceptance:features` from generated customers. Active Cleanup owns
  removal of factory-root no-op scripts.

- [ ] **Step 1: Write native selection tests before the implementation**

Create temporary projects with `cucumber.cjs` and `.feature` files. Use the
actual public API, not a mocked parser. Cover a required Scenario, a draft-only
Feature with undefined steps, and malformed Gherkin. `assertValidSources` parses
every Feature and accepts undefined draft steps; required dry-run owns binding
validation. The central assertions are:

```ts
await expect(assertRequiredSelection(requiredRoot)).resolves.toBeUndefined();
await expect(assertRequiredSelection(draftOnlyRoot)).rejects.toThrow(
  "@required must select at least one Cucumber Scenario",
);
await expect(assertRequiredSelection(invalidRoot)).rejects.toThrow(
  /features\/broken\.feature:\d+:/,
);
await expect(assertValidSources(draftOnlyRoot)).resolves.toBeUndefined();
await expect(assertValidSources(invalidRoot)).rejects.toThrow(
  /features\/broken\.feature:\d+:/,
);
```

- [ ] **Step 2: Implement only the native selection adapter**

Use this shape; keep error formatting in small helpers so complexity stays below
the repository threshold:

```ts
import { loadConfiguration, loadSources } from "@cucumber/cucumber/api";

const formatSourceError = (error: {
  readonly uri: string;
  readonly location: { readonly line: number; readonly column?: number };
  readonly message: string;
}): string =>
  `${error.uri}:${error.location.line}:${error.location.column ?? 1}: ${error.message}`;

export async function assertRequiredSelection(cwd: string): Promise<void> {
  const { runConfiguration } = await loadConfiguration(
    { file: "cucumber.cjs", provided: ["--tags", "@required"] },
    { cwd },
  );
  const loaded = await loadSources(runConfiguration.sources, { cwd });
  if (loaded.errors.length > 0) {
    throw new Error(loaded.errors.map(formatSourceError).join("\n"));
  }
  if (loaded.plan.length === 0) {
    throw new Error(
      "@required must select at least one Cucumber Scenario before delivery.",
    );
  }
}
```

Add a direct-run boundary that calls `assertRequiredSelection(process.cwd())`,
prints no success receipt, and writes the error message to stderr with exit code
`1`.

`source-check.mts` uses the same `loadConfiguration`/`loadSources` path without
a tag filter, throws only `loaded.errors` with the shared formatter, and does
not inspect steps, tags, or lifecycle policy. Its direct-run boundary has the
same quiet-success/error-exit behavior.

- [ ] **Step 3: Replace CLI routing and publish the generated-script handoff**

Task 3 sets generated-customer scripts to:

```json
{
  "acceptance:syntax": "tsx tooling/acceptance/source-check.mts",
  "acceptance:check": "pnpm acceptance:syntax && cucumber-js --config cucumber.cjs --dry-run --tags @required",
  "acceptance:required-selection": "tsx tooling/acceptance/required-selection.mts",
  "acceptance:cucumber": "cucumber-js --config cucumber.cjs"
}
```

Change only the required branch in `testContracts`. The composition owner sets
the generated scripts; Active Cleanup removes factory-root no-op scripts.

```ts
const admission = await run(["--silent", "acceptance:required-selection"], cwd);
if (admission.exitCode !== 0) return admission;
return run(["--silent", "acceptance:cucumber", "--tags", "@required"], cwd);
```

Update the CLI tests to expect that exact two-command sequence and to stop after
`acceptance:required-selection` fails. Keep the tests for all Features, one
named Feature, draft creation, collision denial, and `contracts check`. Remove
`@cross_surface` from generated `contracts add`/first-outcome content and their
expectations; observable steps, not inert metadata, identify surfaces.

- [ ] **Step 4: Delete the parallel compiler and run focused acceptance tests**

Delete both `check-features` files. Run:

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/required-selection.test.mts tooling/acceptance/source-check.test.mts apps/cli/src/factory/contracts.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: Vitest PASS; syntax checks cover every draft and required Feature,
while undefined/ambiguous-step dry-run is limited to `@required`. Zero required
pickles is allowed by `contracts check` and rejected only by
`contracts test --required`.

- [ ] **Step 6: Commit the native acceptance authority**

```bash
rtk git add tooling/acceptance apps/cli/src/factory/contracts.ts apps/cli/src/factory/contracts.test.ts
rtk git commit -m "refactor: use cucumber as acceptance authority"
```

### Task 2: Give Cucumber one process, one browser, and isolated Scenario state

**Files:**

- Create:
  `examples/saas-application/seed/source/features/support/contracts-world.ts`
- Create:
  `examples/saas-application/seed/source/features/support/contracts-runtime.ts`
- Modify:
  `examples/saas-application/seed/source/features/step_definitions/records.steps.ts`
- Modify: `examples/saas-application/seed/source/features/records.feature`
- Modify: `packages/convex/confect/headless/apiKeys.spec.ts`
- Modify: `packages/convex/confect/headless/apiKeys.impl.ts`
- Modify: `packages/convex/test/headless-auth.test.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Test:
  `examples/saas-application/seed/source/features/support/contracts-runtime.test.ts`

**Interfaces:**

- Produces: `ContractsWorld` with `page`, `cliFailure`, and a unique authorized
  workspace/CLI execution boundary per Scenario; no mutable browser/process
  globals remain in step definitions.
- Produces: `startContractsRuntime(): Promise<ContractsRuntime>` and
  `stopContractsRuntime(): Promise<void>`; `ContractsRuntime` exposes browser,
  web URL, scenario provisioning, and redacted CLI execution. It does not expose
  the API key as a general world accessor.
- Consumes: the existing `maestro start --mode local` ready announcement. It
  does not call `/health` itself.

- [ ] **Step 1: Add failing lifecycle/projection tests**

Extend `saasApplication.test.ts` to assert support-file projection and the four
business journey names using Cucumber's loaded sources:

```ts
expect(entries.has("features/support/contracts-world.ts")).toBe(true);
expect(entries.has("features/support/contracts-runtime.ts")).toBe(true);
expect(recordsJourneyNames).toEqual([
  "Create in UI and read in CLI",
  "Create in CLI and read in UI",
  "Reject a missing API key",
  "Reject a cross-workspace write without side effects",
]);
```

Test browser/process ownership through injected boundaries and invocation
counts, not source-string searches. Load tags with Cucumber and assert no
surface tag is required.

- [ ] **Step 2: Implement the World and hooks**

`contracts-world.ts` owns fresh Scenario state:

```ts
import { After, Before, setWorldConstructor, World } from "@cucumber/cucumber";
import type { BrowserContext, Page } from "@playwright/test";
import { contractsRuntime } from "./contracts-runtime";

export class ContractsWorld extends World {
  context: BrowserContext | undefined;
  page: Page | undefined;
  scenario: ContractsScenario | undefined;
  cliFailure = "";
}

setWorldConstructor(ContractsWorld);

Before(async function (this: ContractsWorld) {
  const runtime = requireContractsRuntime();
  this.scenario = await runtime.provisionScenario();
  this.context = await runtime.browser.newContext();
  this.page = await this.context.newPage();
  this.cliFailure = "";
});

After(async function (this: ContractsWorld) {
  await this.context?.close();
  this.context = undefined;
  this.page = undefined;
});
```

Use one helper such as `requirePage(world): Page` so a missing hook produces a
clear typed failure rather than a non-null assertion. Provision a unique
workspace and key for every Scenario through the public test lifecycle, so
database rows and idempotency keys cannot leak across scenarios. Add a focused
test that executes the journeys independently and in a different order.

Extend the existing internal `seedLocalContracts` fixture, rather than adding a
public operation. It accepts a `contracts-<nonce>` namespace plus two key
hashes, creates two workspace-scoped actors, returns only workspace/user/key IDs
(never plaintext keys), and refuses unless `MAESTRO_CONTRACT_TEST=1`. The
contract runtime generates plaintext keys locally, starts the local backend with
that flag, hashes before calling the internal fixture, and keeps credentials
inside scenario-scoped CLI closures. Test rejection without the flag, namespace
validation, distinct workspaces, and correct key scope in
`headless-auth.test.ts`. Regenerate derived Confect refs through the existing
codegen owner; do not hand-edit generated authority.

Use one explicit lifecycle: `BeforeAll` awaits `startContractsRuntime()` and
stores it; `Before` calls `requireContractsRuntime().provisionScenario()`;
`After` closes the Scenario context; `AfterAll` awaits `stopContractsRuntime()`.
Startup and stop are idempotent, and partial startup closes any
browser/process/port already acquired before rethrowing. The focused runtime
test proves invocation counts and partial-start cleanup.

- [ ] **Step 3: Implement bounded startup around `maestro start`**

Move process, ports, key, output, CLI execution, and browser ownership into
`contracts-runtime.ts`. Launch Chromium once in `BeforeAll`, close it and
terminate the managed process in `AfterAll`. Resolve startup only after the
child output contains the existing `[maestro] URL:` announcement, because
`maestro start` emits that announcement only after its own bounded readiness
succeeds. Race that promise against child completion and a 30-second timer. On
failure, include redacted bounded child output and the last `maestro start`
diagnostic; never include the API key. Apply the same redactor to every CLI
child stdout/stderr and thrown diagnostic before it reaches the World or an
assertion message.

Construct child environments from the minimal local-test allowlist. Remove
secret-bearing name classes (`TOKEN`, `API_KEY`, `DEPLOY_KEY`, `SECRET`,
`PASSWORD`, `COOKIE`, and provider credentials) before spawning product, Convex,
browser, or CLI children; then add only the generated local fixture values.
Redaction is the second defense. The runtime test injects secret canaries into
inherited environment and child output and proves neither is retained.

The startup wait must have this observable shape:

```ts
await Promise.race([
  readyAnnouncement,
  app.completion.then(() => {
    throw new Error(`maestro start exited before readiness\n${safeOutput()}`);
  }),
  timeoutAfter(
    30_000,
    () => `maestro start did not announce readiness\n${safeOutput()}`,
  ),
]);
```

Do not retain the existing `eventually(fetch(.../health))` loop. Keep bounded
polling only for the later Convex seed operation, where retrying the actual
operation is the observable dependency check.

- [ ] **Step 4: Rewrite steps to use the shared World**

Each UI step uses `requirePage(this)` and no longer launches/closes a browser.
Each CLI step calls `contractsRuntime().runCli(...)`. Store expected command
failure in `this.cliFailure`. Keep the current observable selectors and typed
denial codes:

```ts
When(
  "I create a record named {string} in the app",
  async function (this: ContractsWorld, title: string) {
    const page = requirePage(this);
    await page.goto(`${contractsRuntime().webUrl}/records`);
    await page.getByRole("button", { name: "Create record" }).click();
    await page.getByLabel("Record title").fill(title);
    await page.getByLabel("Record detail").fill("Created by Cucumber.");
    await page.getByRole("button", { name: "Save record" }).click();
    await page.getByRole("heading", { name: title }).waitFor();
  },
);
```

Remove all `@cross_surface` tags from `records.feature`; the steps already
demonstrate UI and CLI behavior. Keep the four existing customer journeys and do
not add parser, option, or validation matrices to Gherkin. For the
cross-workspace denial, provision a separately authorized observer for the
target workspace, assert the typed mismatch code, then use a real CLI or UI read
with that observer to prove the denied title is absent. Never inspect the
database directly.

- [ ] **Step 5: Project the two support files with the records example**

Add both support paths to `currentContractFiles` beside `records.feature` and
`records.steps.ts`, and include them in records provenance `generatedPaths`. Do
not put these files in the neutral chassis independently of the records example;
Lane 1 may select the example as a pattern.

- [ ] **Step 6: Run focused generator and type checks**

```bash
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
rtk pnpm --dir tooling/generators typecheck
```

Expected: PASS; injected lifecycle tests observe one browser launch, no
duplicate readiness owner, fresh browser and product namespaces per Scenario,
redacted child failures, and four journeys including target-state denial.

- [ ] **Step 7: Commit the contract runtime lifecycle**

```bash
rtk git add examples/saas-application/seed/source/features tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.test.ts
rtk git commit -m "test: isolate cucumber customer journeys"
```

### Task 3: Project and execute one truthful generated-customer admission

> The shared composition owner executes this task after consuming Tasks 1-2; the
> acceptance core worker does not edit blueprint hot files.

**Files:**

- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/package.json`
- Modify: `tooling/ci/verify-chassis.sh`
- Modify: `tooling/ci/verify-chassis.test.mts`

**Interfaces:**

- Consumes: `tooling/acceptance/required-selection.mts` from Task 1 and support
  files from Task 2.
- Produces: customer scripts with all-source syntax loading, required-only
  dry-run, non-empty required selection, and Cucumber execution.
- Produces: `test:create-root-admission`, the sole Woodpecker-owned
  generated-current-target acceptance check.

- [ ] **Step 1: Write failing projection and CI-closure expectations**

Update blueprint tests to require `tooling/acceptance/required-selection.mts`,
reject `tooling/acceptance/check-features.mts`, require
`acceptance:required-selection`, and reject `acceptance:features`. Keep `verify`
ending in `pnpm maestro -- contracts test --required`: a fresh neutral target is
intentionally bootstrappable but not deliverable until its first real journey is
implemented and promoted.

Update `verify-chassis.test.mts` to require:

```ts
expect(script).toContain("pnpm --dir apps/cli test:create-root-admission");
expect(script).not.toContain(
  "pnpm --dir apps/cli test:create-root-integration",
);
```

- [ ] **Step 2: Update current customer projection**

Replace `acceptance:features` with `acceptance:syntax` and
`acceptance:required-selection` in `CUSTOMER_ROOT_SCRIPTS`. Project both native
API adapters and stop projecting `check-features.mts`. Ensure the generated
package receives the four scripts from Task 1 exactly once.

- [ ] **Step 3: Narrow the generated admission test without weakening its
      journey proof**

Reuse the coherent change from `8ca3f5b20`: add this script to
`apps/cli/package.json`:

```json
"test:create-root-admission": "vitest run src/factory/createRootIntegration.test.ts -t 'executes the required records contract in a fresh current target' --maxWorkers=1 --no-file-parallelism"
```

In that test, create/materialize one target, install it once, run
`confect:codegen` once, and run the actual required contract once. Keep the
assertions that the personalized first-outcome Feature is a draft and that the
records example executes four passing Scenarios, including tenant-isolation and
missing-key denial. Remove the nested generated `pnpm verify` and source-label
mutation: those rerun unrelated suites and test implementation wording rather
than the journey.

Use required execution while records is still the selected required contract on
this branch:

```ts
const requiredContract = spawnSync(
  "pnpm",
  ["--silent", "maestro", "--", "contracts", "test", "--required"],
  { cwd: targetRoot, encoding: "utf8", timeout: 180_000 },
);
expect(requiredContract.status, outputOf(requiredContract)).toBe(0);
expect(requiredContract.stdout).toContain("4 scenarios (4 passed)");
```

Acceptance merges first. The dependent Customer Projection lane then moves the
records vertical behind `records-example` and changes this single stable factory
example invocation to `contracts test records`; it must not add a second
invocation. Neutral product delivery remains red on zero required selection.

- [ ] **Step 4: Make Woodpecker call only the narrow admission owner**

Change `verify-chassis.sh` from `test:create-root-integration` to
`test:create-root-admission`. Do not copy the Cucumber commands into Woodpecker;
the selected Vitest owns target creation and calls the customer CLI.

- [ ] **Step 5: Run focused projection and generated-customer admission tests**

```bash
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm test:chassis-ci
rtk pnpm --dir apps/cli test:create-root-admission
```

Expected: all PASS; the last command installs/codegens one target and reports
four passing records Scenarios.

- [ ] **Step 6: Commit the generated admission boundary**

```bash
rtk git add tooling/generators/src/blueprints/saasRegistrationProjections.ts tooling/generators/src/blueprints/saasApplication.test.ts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/package.json tooling/ci/verify-chassis.sh tooling/ci/verify-chassis.test.mts
rtk git commit -m "test: narrow generated customer admission"
```

### Task 4: Give each deterministic suite one executable owner

> The Active Authority Cleanup owner executes this global package/hook task and
> consumes the acceptance script handoff; the acceptance core worker does not
> edit root verification, firewall, Lefthook, or diagnostic definitions.

**Files:**

- Modify: `package.json`
- Modify: `tooling/ci/firewall.sh`
- Modify: `tooling/ci/epoch.sh`
- Modify: `tooling/ci/phase1.sh`
- Modify: `lefthook.yml`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `tooling/quality/woodpecker-template-pipeline.test.mts`

**Interfaces:**

- Produces: root `test` as the sole owner of workspace/component tests and root
  `verify` as the sole owner of the complete deterministic local gate sequence.
- Keeps aliases such as `test:tooling`, `test:workflow`, `test:pr-backlog`, and
  `evals` available for focused developer use; `verify` no longer calls them
  after `test` has already run their packages.

- [ ] **Step 1: Make root test and verify non-overlapping**

Prefix root `test` with `pnpm test:bootstrap &&`. Keep Turbo as the single owner
for workspace tests and the existing direct commands only for packages/suites
excluded from Turbo. Remove `pnpm test:tooling`, `pnpm test:workflow`,
`pnpm test:pr-backlog`, and `pnpm evals` from `verify`; keep the aliases for
focused use.

Use Turbo's native `turbo run test --dry=json` output plus the resolved root
scripts during review to confirm each workspace test task has one owner. Do not
add a tokenizer, persistent suite registry, or source-text command parser.

Do not reorder security/architecture checks except where necessary to remove an
exact duplicate. Do not add Cucumber to factory root `verify` while the factory
has no root product Features.

- [ ] **Step 2: Remove nested acceptance and post-verify duplication**

- `firewall.sh`: delete the no-op root acceptance calls; generated-customer
  admission owns the real product Features.
- `epoch.sh`: delete both pre-verify acceptance calls; `pnpm verify` owns full
  deterministic verification for that lane.
- `phase1.sh`: after `pnpm verify`, retain only
  `pnpm template:workflow-output-smoke` if it is not already in `verify`; delete
  repeated system, topology, data, promotion, workflow, AI-file, agent-pack, and
  app-map checks.
- `lefthook.yml`: remove the no-op root Cucumber hook. Generated applications
  retain `acceptance:check` and required-selection commands.

- [ ] **Step 3: Update compatibility pins to describe owners, not duplicate
      internals**

In `check-definitions.mts`, remove every `acceptance:features` pin and update
the package pin to `acceptance:required-selection`. Change firewall/epoch/phase1
requirements to the exact ownership above. Update the three focused tests; keep
tests that prove Woodpecker calls trusted scripts, but do not require duplicate
suite terms.

- [ ] **Step 4: Run focused ownership, CI, and static-definition tests**

```bash
rtk host-test-slot --class focused pnpm --dir tooling/quality exec vitest run check-ci-completeness.test.mts check-config-drift.test.mts woodpecker-template-pipeline.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm test:chassis-ci
rtk pnpm check:ci-completeness
rtk pnpm check:config-drift
rtk pnpm turbo run test --dry=json
```

Expected: PASS; no retained test accepts concatenated script terms or duplicate
owners.

- [ ] **Step 5: Commit verification ownership**

```bash
  rtk git add package.json tooling/ci lefthook.yml tooling/quality/src/check-definitions.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/woodpecker-template-pipeline.test.mts
rtk git commit -m "refactor: run deterministic suites once"
```

### Task 5: Replace source-wording proofs with runtime behavior

**Files:**

- Modify: `tooling/quality/check-headless-surface-contract.mts`
- Modify: `tooling/quality/check-headless-surface-contract.test.mts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `packages/convex/test/headless-executor.test.ts`

**Interfaces:**

- Keeps manifest parity, generated ref mapping, typed-error, validation-error,
  and surface exposure checks in `check-headless-surface-contract`.
- Moves idempotency enforcement and successful adapter dispatch evidence to
  executable `executeHeadlessOperation` tests.
- Removes `cannedRuntimeSuccess(source)` and
  `missingIdempotencyProof(operations, source)`.

- [ ] **Step 1: Add manifest-derived behavior coverage before deleting source
      checks**

Import `confectManifest` in `headless-executor.test.ts` and derive every
externally exposed non-idempotent mutation/action. Build adapter refs for that
set and assert each operation rejects a missing idempotency key before either
adapter function runs:

```ts
const guardedWrites = confectManifest.functions.filter(
  (operation) =>
    operation.idempotent === false &&
    ["mutation", "action"].includes(operation.kind) &&
    operation.surfaces.some((surface) =>
      ["api", "cli", "mcp"].includes(surface),
    ),
);

it.each(guardedWrites)(
  "rejects missing idempotency for $operationId",
  async (operation) => {
    const dispatched = vi.fn();
    const result = await executeHeadlessOperation(
      adapterFor(operation.operationId, dispatched),
      { operationId: operation.operationId, surface: "api", input: {} },
    );
    expect(dispatched).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: { _tag: "ValidationFailed" },
    });
  },
);
```

Choose an external surface actually declared by each operation instead of
assuming `api`; expose a small `firstExternalSurface` helper. Keep the existing
exact success-dispatch test that asserts the adapter ref, normalized idempotency
input, operation ID, and returned value.

- [ ] **Step 2: Run the executor behavior test**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/headless-executor.test.ts --maxWorkers=1 --no-file-parallelism`

Expected: PASS against the current runtime and every currently guarded manifest
write.

- [ ] **Step 3: Delete source-fragment substitutes**

Remove `cannedRuntimeSuccess`, its source-regex unit test,
`missingIdempotencyProof`, and the extra test/doc file reads used only to find
the exact sentence `Operation ... requires a nonblank idempotencyKey.` Keep the
runtime source reads still required for generated-ref and adapter-dispatch
parity.

Update the `headless-surface-contract` descriptor to stop pinning
`cannedRuntimeSuccess`. Do not weaken `missingTypedErrors`,
`missingExternalValidationError`, generated-ref parity, forbidden canned
registry imports, or runtime adapter dispatch checks.

- [ ] **Step 4: Run focused quality and runtime checks**

```bash
rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/headless-executor.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/quality exec vitest run check-headless-surface-contract.test.mts --maxWorkers=1 --no-file-parallelism
rtk pnpm check:headless-surface-contract
```

Expected: PASS; adding the formerly forbidden literal
`{ ok: true, result: ... }` to an unrelated test no longer affects the gate,
while a runtime that dispatches without idempotency or returns a fabricated
value fails executable behavior tests.

- [ ] **Step 5: Review the entire lane against the design and commit**

Run:

```bash
rtk rg -n "check-features|acceptance:features|@cross_surface|cannedRuntimeSuccess|missingIdempotencyProof" package.json lefthook.yml tooling apps/cli examples/saas-application/seed/source/features
rtk git diff --check origin/main...HEAD
```

Expected: no active checker/script/surface-tag/source-proof references;
historical docs may still mention prior designs and should not be rewritten in
this lane.

Then commit:

```bash
rtk git add tooling/quality packages/convex/test/headless-executor.test.ts
rtk git commit -m "test: prove headless behavior at runtime"
```

## Lane Handoff

- [ ] Ask one independent reviewer to inspect the complete `origin/main...HEAD`
      diff for Cucumber API correctness, process cleanup, browser isolation,
      tenant-denial preservation, verification duplication, and cross-lane
      conflicts. Fix valid findings with focused tests and a normal commit; do
      not create a standing integrator or frozen finding ledger.
- [ ] Run only the security-sensitive focused aggregate not already owned by
      another lane:

```bash
rtk maestro-remote-test -- pnpm test:chassis-ci
rtk maestro-remote-test -- pnpm --dir packages/convex exec vitest run test/headless-executor.test.ts
rtk maestro-remote-test -- pnpm --dir apps/cli test:create-root-admission
```

- [ ] Push `codex/lean-acceptance-verification` and hand its commit list,
      focused evidence, and shared-seam requirements to the composition owner.
      Do not open a separate PR or run full CI.

## Self-Review Findings Incorporated

- Journey focus remains a design/review judgment; it does not become a second
  general Gherkin policy engine or scenario-count gate.
- The records contract remains a real four-journey factory example and security
  proof, but the stable admission command addresses it explicitly so Lane 1 can
  stop presenting it as every neutral customer's required promise.
- The plan does not claim a browser can be shared across separate Cucumber
  processes. It shares one browser within one Feature invocation and always
  creates a fresh context/page per Scenario.
- The plan awaits `maestro start`'s ready announcement rather than racing a
  second health checker against the command's own readiness owner.
- Script source inspection is retained only for package/CI command ownership,
  where exact command composition is itself the compatibility contract. Runtime
  success and idempotency are exercised behaviorally.
- The unmerged narrow-admission work is reused selectively; its deletion of
  nested generated `verify` and mutation-by-label checks matches this design,
  while no fingerprint, clean-tree, or surface-tag guidance is imported.
