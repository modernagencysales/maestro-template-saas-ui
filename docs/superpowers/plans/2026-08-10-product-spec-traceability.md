# Product Spec Traceability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one typed product contract flow through guided plans, App Map
targets, native Playwright acceptance observations, generated documentation, and
exact-head Maestro verification evidence.

**Architecture:** Browser-safe Effect schemas in `packages/template-core` own
contract and plan shapes. Thin tooling under `tooling/acceptance` loads
YAML/frontmatter, compares the trusted Git base, reuses the current App Map,
consumes Playwright's native JSON reports, and renders committed projections.
The existing Records runtime becomes the walking skeleton; the factory projects
that authority into customers, then active Cucumber code and policy are removed
in the same delivery batch.

**Tech Stack:** TypeScript, Effect Schema 4, YAML 2.9.0, Playwright 1.61.1,
Vitest, ESLint, dependency-cruiser, existing App Map and Agent Pack receipt
machinery.

**Design authority:**
`docs/superpowers/specs/2026-08-10-product-spec-traceability-design.md`

## Global Constraints

- `product.contract.yaml` is declarative data, never executable YAML or a step
  registry.
- Version 1 surfaces are exactly `web-ui`, `cli-process`, and `public-http`.
- Behavior tags are revision-bound: `@BHV-<DOMAIN>-<NUMBER>-R<REVISION>`.
- A required behavior needs a typed plan mapping, current App Map targets, a
  discovered black-box test, fresh generated docs, and a non-skipped,
  non-expected-failure, non-flaky passing runtime result.
- Unit, integration, coverage, and mutation tests may supplement but never
  satisfy a product behavior.
- Playwright is exactly `1.61.1`, with one Chromium project, one worker, zero
  retries, `forbidOnly: true`, and no `only`, `skip`, `fixme`, or `fail` escape
  hatch.
- Acceptance uses a fresh local runtime from the generated-customer checkout.
  Web and child-process CLI observations share one disposable backend; the
  template first materializes that customer rather than running the seed tree.
- A draft-only contract is admissible: `acceptance:required` reports zero
  required observations and exits without starting Playwright. It never labels a
  draft as accepted.
- The acceptance tree imports only Playwright, Node built-ins, and its own
  support files. Product internals, database clients, dynamic imports, response
  synthesis, HAR replay, storage injection, and application-response mocks are
  forbidden.
- Generated output is `product.contract.schema.json` and
  `docs/template/generated/product-contract.md`; generation is byte-stable and
  checking never rewrites.
- Trusted-base comparison follows
  `tooling/quality/check-workflow-version-immutability.mts` and
  `CI_COMMIT_TARGET_BRANCH`; retired records are immutable and semantic edits
  require a greater revision.
- `--allow-first-contract` is bootstrap permission, not a history bypass: it is
  valid only when the trusted merge-base history has never contained the bounded
  contract path.
- The deterministic acceptance status is “runtime execution observed.” Causal
  strength and meaningful use of every declared surface remain explicit review
  obligations and stay reported as `unproven`.
- Verification receipts record only the atomic product-contract and acceptance
  gate results and canonical argv, not per-behavior evidence records.
- Do not modify `releases/**` or rewrite historical `docs/superpowers/**`
  artifacts.
- Cucumber may coexist only during the parity tasks below. No active Cucumber
  dependency, config, CLI route, projection, script, or policy remains at the
  final batch head.
- Woodpecker is the only merge authority. Run broad verification once on the
  immutable final head.

## Delivery Batches

### Batch 1: Product contract authority cutover

- **Tasks:** 1–6.
- **Branch:** `docs/deployment-lessons-20260810`.
- **Base:** `b8ae957` (`docs: harden product contract traceability`).
- **PR target:** `main`.
- **Why one batch:** Schema, acceptance runner, customer projection, policy, and
  Cucumber removal are not independently safe authorities. A partial merge would
  leave two competing completion contracts or generate customers that cannot
  verify themselves.
- **Task checks:** Each task runs only the focused commands listed in that task
  through `host-test-slot` where required.
- **Whole-batch review:** Generate a review package from `b8ae957` to the frozen
  Task 6 head and review it against this plan and the design authority.
- **Required verification:** On the frozen committed head, run
  `rtk maestro-remote-test -- pnpm maestro -- verify --scope full --json`.
  Retain stdout's `data.receipt` and confirm its `subject.commit` is the exact
  frozen SHA; the remote worktree is deleted, so do not inspect a remote receipt
  file. If the remote worker is unavailable, run
  `rtk host-test-slot --class full pnpm maestro -- verify --scope full --json`
  locally.
- **Frozen head:** Record the immutable Task 6 SHA in
  `.superpowers/sdd/progress.md` before whole-batch review; any later edit
  invalidates review and verification evidence.

---

### Task 1: Establish the browser-safe typed authority

**Files:**

- Create: `packages/template-core/src/workPackage.ts`
- Create: `packages/template-core/src/workPackage.test.ts`
- Create: `packages/template-core/src/productContract.ts`
- Create: `packages/template-core/src/productContract.test.ts`
- Create: `packages/template-core/src/productPlan.ts`
- Create: `packages/template-core/src/productPlan.test.ts`
- Modify: `packages/template-core/src/index.ts`
- Modify: `packages/app-idea-evaluator/src/maestroMapping.ts`
- Modify: `packages/app-idea-evaluator/src/maestroMapping.test.ts`
- Modify: `packages/app-idea-evaluator/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces:

```ts
export type WorkPackage =
  | {
      readonly kind: "pattern-instance";
      readonly target: string;
      readonly generatorCommand: string;
      readonly followUpGates: readonly string[];
    }
  | {
      readonly kind: "fixture-to-real";
      readonly target: string;
      readonly persistenceOrProviderBoundary: string;
      readonly followUpGates: readonly string[];
    }
  | {
      readonly kind: "template-gap";
      readonly target: string;
      readonly templateBacklogRef: string;
      readonly templateResolutionPath: string;
      readonly followUpGates: readonly string[];
    };

export const WorkPackageSchema: Schema.Schema<WorkPackage>;
export const validateWorkPackage: (value: unknown) => WorkPackage;

export type ProductSurface = "web-ui" | "cli-process" | "public-http";
export type ProductBehaviorStatus = "draft" | "required" | "retired";
type ProductBehaviorFields = {
  readonly id: string;
  readonly revision: number;
  readonly title: string;
  readonly actor: string;
  readonly surfaces: readonly [ProductSurface, ...ProductSurface[]];
  readonly preconditions: readonly string[];
  readonly action: string;
  readonly outcomes: readonly [string, ...string[]];
};
export type ProductBehavior = ProductBehaviorFields &
  (
    | {
        readonly status: "draft" | "required";
        readonly retirementReason?: never;
        readonly replacementBehaviorId?: never;
      }
    | {
        readonly status: "retired";
        readonly retirementReason: string;
        readonly replacementBehaviorId?: string;
      }
  );
export type ProductContract = {
  readonly schemaVersion: 1;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
  };
  readonly behaviors: readonly [ProductBehavior, ...ProductBehavior[]];
};

export const ProductContractSchema: Schema.Schema<ProductContract>;
export const validateProductContract: (value: unknown) => ProductContract;
export const behaviorRevisionTag: (
  behavior: Pick<ProductBehavior, "id" | "revision">,
) => string;
export type ProductBehaviorDocumentation = {
  readonly behaviorId: string;
  readonly planPaths: readonly string[];
  readonly appMapTargets: readonly string[];
  readonly acceptancePaths: readonly string[];
};
export const renderProductContractMarkdown: (input: {
  readonly contract: ProductContract;
  readonly links: readonly ProductBehaviorDocumentation[];
}) => string;
export const renderProductContractJsonSchema: () => string;

export type ProductPlanFrontmatter = {
  readonly planSchemaVersion: 1;
  readonly productContract: "product.contract.yaml";
  readonly workPackages: readonly [
    {
      readonly id: string;
      readonly behaviorIds: readonly [string, ...string[]];
      readonly appMapTargets: readonly [string, ...string[]];
      readonly work: WorkPackage;
    },
    ...{
      readonly id: string;
      readonly behaviorIds: readonly [string, ...string[]];
      readonly appMapTargets: readonly [string, ...string[]];
      readonly work: WorkPackage;
    }[],
  ];
  readonly proofs: readonly [
    {
      readonly behavior: string;
      readonly behaviorRevision: number;
      readonly level: "black-box";
      readonly surfaces: readonly [ProductSurface, ...ProductSurface[]];
      readonly observation: string;
      readonly failureWitness: string;
    },
    ...{
      readonly behavior: string;
      readonly behaviorRevision: number;
      readonly level: "black-box";
      readonly surfaces: readonly [ProductSurface, ...ProductSurface[]];
      readonly observation: string;
      readonly failureWitness: string;
    }[],
  ];
};

export const ProductPlanFrontmatterSchema: Schema.Schema<ProductPlanFrontmatter>;
export const validateProductPlanFrontmatter: (
  value: unknown,
) => ProductPlanFrontmatter;
export const validateProductPlanBindings: (input: {
  readonly contract: ProductContract;
  readonly plans: readonly ProductPlanFrontmatter[];
}) => readonly string[];
```

- `packages/app-idea-evaluator` imports and re-exports `WorkPackage`,
  `WorkPackageSchema`, and `validateWorkPackage`; it owns no duplicate schema.
  Add `"@maestro-template/template-core": "workspace:*"` to its direct
  dependencies and update the lockfile.

- [ ] **Step 1: Write failing schema and binding tests**

Add tests that prove all of these failures, not merely successful decoding:

```ts
expect(() => validateProductContract(contractWith({ outcomes: [] }))).toThrow();
expect(() => validateProductContract(contractWith({ surfaces: [] }))).toThrow();
expect(() => validateProductContract(contractWith({ revision: 0 }))).toThrow();
expect(() =>
  validateProductContract(contractWith({ surfaces: ["mcp"] })),
).toThrow();
expect(() =>
  validateProductContract(contractWith({ unexpected: true })),
).toThrow();
expect(() => validateProductContract(duplicateBehaviorIds)).toThrow(
  /duplicate/i,
);
expect(() => validateProductContract(retiredWithUnknownReplacement)).toThrow(
  /replacement/i,
);
expect(() => validateProductContract(retiredWithoutReason)).toThrow(/reason/i);
expect(() => validateProductContract(activeWithRetirementReason)).toThrow();
expect(
  validateProductPlanBindings({ contract, plans: [matchingPlan] }),
).toEqual([]);
expect(
  validateProductPlanBindings({ contract, plans: [staleRevisionPlan] }).join(
    "\n",
  ),
).toMatch(/revision/i);
expect(
  validateProductPlanBindings({ contract, plans: [wrongSurfacePlan] }).join(
    "\n",
  ),
).toMatch(/surfaces/i);
expect(
  validateProductPlanBindings({ contract, plans: [retiredBehaviorPlan] }).join(
    "\n",
  ),
).toMatch(/retired/i);
```

Retain the current `maestroMapping.test.ts` mapping assertions so the promoted
schema remains backward-compatible.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```sh
rtk host-test-slot --class focused pnpm --dir packages/template-core exec vitest run src/workPackage.test.ts src/productContract.test.ts src/productPlan.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the three modules and exports do not exist.

- [ ] **Step 3: Implement the minimum Effect schemas and cross-record
      validators**

Use the existing `Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))`,
`Schema.NonEmptyArray`, and
`Schema.decodeUnknownSync(..., { onExcessProperty: "error" })` pattern. Enforce
these exact invariants:

- IDs match `^BHV-[A-Z0-9]+-[0-9]+$`; work-package IDs match
  `^WP-[A-Z0-9]+-[0-9]+$`.
- Revisions are positive integers.
- Text fields are trimmed and nonblank; surface and outcome arrays are nonempty
  and duplicate-free; preconditions may be empty.
- Retired behaviors require `retirementReason` and may accept
  `replacementBehaviorId`; active behaviors accept neither field, and
  replacements name another known non-retired behavior.
- Behavior IDs and work-package IDs are unique.
- Within each plan, the union of work-package behavior IDs equals the union of
  proof behavior IDs.
- Across all opted-in plans, every required behavior has a black-box proof with
  exact revision and set-equal surfaces.
- Active plans cannot cite retired or unknown behavior IDs.
- The two pure renderers sort IDs and paths bytewise, emit a trailing newline,
  and have no filesystem or process dependency so both acceptance tooling and
  the customer factory can produce identical bytes.

After adding the evaluator's workspace dependency, run
`rtk pnpm install --lockfile-only` so the importer is recorded mechanically.

Do not add a class hierarchy, registry, executable callbacks, or a new package.

- [ ] **Step 4: Verify GREEN and the re-exported consumer**

Run:

```sh
rtk host-test-slot --class focused pnpm --dir packages/template-core exec vitest run src/workPackage.test.ts src/productContract.test.ts src/productPlan.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator exec vitest run src/maestroMapping.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir packages/template-core typecheck
rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator typecheck
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Task 1**

```sh
rtk git add packages/template-core/src packages/app-idea-evaluator/src/maestroMapping.ts packages/app-idea-evaluator/src/maestroMapping.test.ts packages/app-idea-evaluator/package.json pnpm-lock.yaml
rtk git commit -m "feat: add typed product contract authority"
```

### Task 2: Load, compare, join, and project the contract deterministically

**Files:**

- Create: `tooling/acceptance/product-contract.mts`
- Create: `tooling/acceptance/product-contract.test.mts`
- Create: `tooling/acceptance/playwright-report.mts`
- Create: `tooling/acceptance/playwright-report.test.mts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type LoadedProductPlan = {
  readonly path: string;
  readonly frontmatter: ProductPlanFrontmatter;
};

export type AcceptanceTestIdentity = {
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly behaviorTag: string;
};

export type AcceptanceTestAnnotation = {
  readonly type: string;
  readonly description?: string;
};

export type AcceptanceTestResult = {
  readonly status: string;
  readonly retry: number;
};

export type PlaywrightTestRecord = AcceptanceTestIdentity & {
  readonly expectedStatus: string;
  readonly annotations: readonly AcceptanceTestAnnotation[];
  readonly results: readonly AcceptanceTestResult[];
};

export type ParsedPlaywrightJsonReport = {
  readonly config: {
    readonly workers: number;
    readonly forbidOnly: boolean;
    readonly projects: readonly {
      readonly name: string;
      readonly retries: number;
    }[];
  };
  readonly tests: readonly PlaywrightTestRecord[];
};

export const parsePlanFrontmatter: (
  markdown: string,
  sourcePath: string,
) => ProductPlanFrontmatter | undefined;

export const deriveTrustedMergeBase: (
  readGit: (args: readonly string[]) => string,
  environment: Readonly<Record<string, string | undefined>>,
) => string;

export const compareProductContractHistory: (
  trusted: ProductContract | null,
  current: ProductContract,
) => readonly string[];

export const parsePlaywrightJsonReport: (
  value: unknown,
) => ParsedPlaywrightJsonReport;

export const validateAcceptanceDiscovery: (input: {
  readonly contract: ProductContract;
  readonly tests: readonly AcceptanceTestIdentity[];
}) => readonly string[];

export const checkProductContract: (options: {
  readonly repoRoot: string;
  readonly sourceRoot: string;
  readonly allowFirstContract: boolean;
  readonly resolveAppMapNodeIds?: () => Promise<ReadonlySet<string>>;
}) => Promise<readonly string[]>;

export const generateProductContract: (options: {
  readonly repoRoot: string;
  readonly sourceRoot: string;
}) => Promise<void>;
```

`sourceRoot` is `examples/saas-application/seed/source` for template generation
and `.` in a generated customer. Direct checking is customer-root-only; the
template adapter in Task 5 supplies a materialized customer's App Map while
checking the seed history. The contract, editor schema, product plans,
acceptance config, and generated document are always resolved beneath the
bounded source root.

- [ ] **Step 1: Write failing loader, history, join, discovery, and freshness
      tests**

Use temporary repositories and injected Git readers. Cover:

```ts
expect(parsePlanFrontmatter("# Untyped\n", "docs/plain.md")).toBeUndefined();
expect(() =>
  parsePlanFrontmatter("---\nplanSchemaVersion: 1\n---\n", "docs/bad.md"),
).toThrow();
expect(
  compareProductContractHistory(trusted, deletedBehavior).join("\n"),
).toMatch(/deleted/i);
expect(
  compareProductContractHistory(trustedRequired, downgradedDraft).join("\n"),
).toMatch(/required.*draft/i);
expect(compareProductContractHistory(trustedDraft, promotedRequired)).toEqual(
  [],
);
expect(compareProductContractHistory(trustedDraft, retiredDraft)).toEqual([]);
expect(compareProductContractHistory(trustedRequired, retiredRequired)).toEqual(
  [],
);
expect(
  compareProductContractHistory(trustedRetired, restoredRequired).join("\n"),
).toMatch(/retired.*immutable|transition/i);
expect(
  compareProductContractHistory(trustedRetired, restoredDraft).join("\n"),
).toMatch(/retired.*immutable|transition/i);
expect(
  compareProductContractHistory(trustedRetired, editedRetired).join("\n"),
).toMatch(/retired.*immutable/i);
expect(
  compareProductContractHistory(trustedRevisionTwo, revisionOne).join("\n"),
).toMatch(/revision/i);
expect(
  compareProductContractHistory(trusted, semanticEditWithoutIncrement).join(
    "\n",
  ),
).toMatch(/revision/i);
expect(
  compareProductContractHistory(trusted, missingHistoricalBehavior).join("\n"),
).toMatch(/deleted|missing/i);
expect(compareProductContractHistory(trustedDraft, revisedDraft)).toEqual([]);
expect(compareProductContractHistory(trustedRequired, revisedRequired)).toEqual(
  [],
);
expect(
  validateAcceptanceDiscovery({ contract, tests: staleRevisionTests }).join(
    "\n",
  ),
).toMatch(/stale revision/i);
expect(
  validateAcceptanceDiscovery({ contract, tests: duplicateTags }).join("\n"),
).toMatch(/exactly one/i);
expect(renderedMarkdown).not.toMatch(/verified\s*:/i);
expect(await checkGeneratedBytes(staleMarkdown)).toContain(
  "docs/template/generated/product-contract.md is stale",
);
expect(parsePlaywrightJsonReport(runtimeReport).tests[0]?.results).toEqual([
  { status: "passed", retry: 0 },
]);
```

App Map tests inject node IDs and assert `route:records` and `headless:executor`
resolve while `capability:records.create` fails. Playwright JSON fixtures use
the native `suites[].specs[].id`, `suites[].specs[].tags`,
`specs[].tests[].projectName`, `expectedStatus`, and `results[]` shape. Flatten
each project result with the enclosing spec ID; because the config admits one
project, join discovery and runtime by that spec ID. Do not scan TypeScript
source or test names for behavior IDs. Add one rejected fixture for each config
invariant: workers other than `1`, `forbidOnly: false`, zero or multiple
projects, a project not named `acceptance-chromium`, and retries other than `0`.

Use temporary Git repositories for the bootstrap guard itself, not only the pure
history comparator. One `checkProductContract` case has no contract anywhere in
the trusted branch history and succeeds with `allowFirstContract: true`; another
adds and deletes the bounded contract path before the merge base and must still
fail with the flag because `git log <merge-base> -- <path>` is nonempty.

- [ ] **Step 2: Run the focused tests and confirm RED**

```sh
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/product-contract.test.mts tooling/acceptance/playwright-report.test.mts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the loader and report modules do not exist.

- [ ] **Step 3: Implement the thin tooling using installed machinery**

Implementation requirements:

- Add root `yaml: "2.9.0"`; do not add a frontmatter package.
- Read YAML with `yaml.parse`; extract only a leading `---` frontmatter block
  and decode it with `ProductPlanFrontmatterSchema`.
- Discover Markdown beneath `sourceRoot/docs`, ignore
  `docs/template/generated/**`, and validate only frontmatter containing
  `planSchemaVersion`.
- Reuse `composeAppMap` and `resolveRepositoryRevision` from
  `tooling/app-map/src/composition.ts`. Resolve literal node IDs; do not add
  aliases or App Map sources.
- Reuse the safe target-branch and merge-base algorithm from
  `check-workflow-version-immutability.mts`. Never compare with `HEAD~1`. A
  missing trusted contract is accepted only when `allowFirstContract` is true; a
  missing trusted branch is always an error. Even with that flag, reject a
  missing trusted contract when
  `git log --format=%H <merge-base> -- <bounded-contract-path>` shows that the
  target history contained the contract before. Cover this deletion/recreation
  case with a regression test.
- Enforce exactly these history transitions: `draft -> required`,
  `draft -> retired`, and `required -> retired`. Reject every transition out of
  `retired`, `required -> draft`, missing historical IDs, revision decreases,
  and edits to retired bytes. Same-status `draft -> draft` and
  `required -> required` records remain valid; semantic edits within them
  require a strictly greater revision.
- Treat `actor`, `surfaces`, `preconditions`, `action`, and `outcomes` as
  semantic fields. Any change requires `current.revision > trusted.revision`;
  revisions never decrease; retired bytes are immutable.
- Use `Schema.toJsonSchemaDocument(ProductContractSchema)` for
  `product.contract.schema.json`.
- Validate the native listing config: `workers === 1`, `forbidOnly === true`,
  one project named `acceptance-chromium`, and project retries `0`.
- Resolve every required behavior's App Map targets. A draft may retain an
  unresolved target only when its owning work package is `template-gap`.
  Programmatic callers may inject `resolveAppMapNodeIds` for a real materialized
  customer projection; the CLI exposes no option for supplying arbitrary node
  IDs and otherwise composes the current checkout directly.
- Render one deterministic Markdown table per behavior with revision, lifecycle,
  surfaces, typed plan paths, App Map targets, and acceptance file paths. Sort
  paths and IDs bytewise. Never render pass/fail state.
- Generation renders the declared, schema-valid plan targets; it does not claim
  they resolve. `checkProductContract` owns current App Map resolution, and the
  template-side adapter supplies nodes composed from a materialized customer.
- `checkProductContract` compares generated bytes but never writes them;
  `generateProductContract` writes only the two declared projections.
- The CLI accepts exactly `generate --source-root <bounded-relative-path>` or
  `check --source-root . [--allow-first-contract]` and exits nonzero on
  findings. Task 5's separate template adapter is the only check command that
  accepts the seed root.

- [ ] **Step 4: Verify GREEN and focused type/lint behavior**

```sh
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/product-contract.test.mts tooling/acceptance/playwright-report.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm eslint tooling/acceptance/product-contract.mts tooling/acceptance/playwright-report.mts
rtk host-test-slot --class focused pnpm --dir tooling/app-map test
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Task 2**

```sh
rtk git add tooling/acceptance/product-contract.mts tooling/acceptance/product-contract.test.mts tooling/acceptance/playwright-report.mts tooling/acceptance/playwright-report.test.mts package.json pnpm-lock.yaml
rtk git commit -m "feat: validate product contract projections"
```

### Task 3: Bind required Playwright execution and lint the black-box boundary

**Files:**

- Create: `tooling/acceptance/run-acceptance.mts`
- Create: `tooling/acceptance/run-acceptance.test.mts`
- Create: `tooling/eslint-plugin-template/rules/acceptance-boundary.mjs`
- Modify: `tooling/eslint-plugin-template/index.mjs`
- Modify: `tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs`
- Modify: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

```ts
export type PlaywrightProcessResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export const requiredBehaviorTags: (
  contract: ProductContract,
) => readonly string[];
export const escapedTagPattern: (tags: readonly string[]) => string;
export const validateAcceptanceRuntime: (input: {
  readonly requiredTags: readonly string[];
  readonly discovered: ParsedPlaywrightJsonReport;
  readonly runtime: ParsedPlaywrightJsonReport;
  readonly processExitCode: number;
}) => readonly string[];
export const runAcceptance: (options: {
  readonly repoRoot: string;
  readonly sourceRoot: string;
  readonly scope: "required" | "all";
}) => Promise<void>;
```

- [ ] **Step 1: Write failing runtime-result and ESLint adversarial tests**

Runtime fixtures must prove that process exit 0 is insufficient:

```ts
expect(validateAcceptanceRuntime(passInput)).toEqual([]);
expect(validateAcceptanceRuntime(missingRequiredResult).join("\n")).toMatch(
  /missing/i,
);
expect(validateAcceptanceRuntime(skippedResult).join("\n")).toMatch(/skipped/i);
expect(validateAcceptanceRuntime(expectedFailureResult).join("\n")).toMatch(
  /expected status/i,
);
expect(validateAcceptanceRuntime(flakyResult).join("\n")).toMatch(
  /flaky|retry/i,
);
expect(validateAcceptanceRuntime(unselectedRuntimeTest).join("\n")).toMatch(
  /selection/i,
);
expect(
  validateAcceptanceRuntime({ ...passInput, processExitCode: 1 }).join("\n"),
).toMatch(/exit/i);
await expect(runAcceptance(draftOnlyInput)).resolves.toBeUndefined();
expect(writeOutput).toHaveBeenCalledWith(
  expect.stringMatching(/0 required.*0 runtime/iu),
);
expect(playwrightSpawn).not.toHaveBeenCalled();
```

Add RuleTester cases for both generated and seed paths. Valid files may import
`@playwright/test`, `node:*`, and relative `./support/*`. Invalid fixtures must
include:

```ts
import { db } from "../../../packages/convex/confect/db";
import { model } from "../../../apps/web/src/features/records/model";
test.skip("hidden", async () => {});
test.fixme(true, "hidden");
test.fail(true, "expected failure");
test.only("exclusive", async () => {});
await page.route("**/api/**", (route) => route.fulfill({ json: { ok: true } }));
await context.route("**/api/**", (route) => route.continue());
await route.fulfill({ json: { ok: true } });
await page.routeFromHAR("fixture.har");
await page.evaluate(() => localStorage.setItem("auth", "fake"));
await context.addInitScript(() => sessionStorage.setItem("auth", "fake"));
const module = await import("./hidden-helper");
vi.mock("product-module");
```

The audited proxy exception applies only beneath `tests/acceptance/support/**`
and the corresponding factory seed path. It may call
`context.route`/`route.fulfill`; scenario specs may not.

Add a RuleTester case whose filename is beneath `tests/acceptance/support/**`
and whose relative import resolves into `apps/**`. Because the rule applies to
every file in the acceptance tree, this is the transitive-laundering regression;
do not add a duplicate dependency-cruiser edge.

- [ ] **Step 2: Run the focused tests and confirm RED**

```sh
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/run-acceptance.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
```

Expected: FAIL because the runner and ESLint rule do not exist.

- [ ] **Step 3: Implement the native Playwright argv adapter and boundary rule**

`runAcceptance` must:

1. load and decode `sourceRoot/product.contract.yaml`;
2. derive the current required revision tags; for required scope with zero
   required behaviors, report zero runtime observations and return before
   spawning any Playwright process;
3. run
   `pnpm exec playwright test --config <sourceRoot>/playwright.acceptance.config.ts --list --reporter=json`;
4. for nonempty required scope, build one escaped OR grep from the current
   revision tags and execute with that grep; all scope executes the discovered
   draft and required examples;
5. set `PLAYWRIGHT_JSON_OUTPUT_NAME` to a fresh `mkdtemp` file so application
   logs cannot corrupt JSON;
6. parse and join the runtime report to discovery test IDs;
7. require every selected test to have exactly one result with
   `status: "passed"`, `expectedStatus: "passed"`, and `retry: 0` and no
   skip/fixme/fail annotation;
8. reject missing, extra, skipped, expected-failure, flaky, or unexecuted
   selected tests even when the subprocess exits 0;
9. remove the temporary directory in `finally` and preserve Playwright stderr on
   failure.

The ESLint rule applies to both `tests/acceptance/**` and
`examples/*/seed/source/tests/acceptance/**`. Apply the import allowlist to
every file in the tree so relative helpers cannot launder product imports. Add a
RuleTester helper case proving the recursive boundary.

Pin `@playwright/test` to exactly `1.61.1`; keep Cucumber installed for the
parity task.

- [ ] **Step 4: Verify GREEN**

```sh
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/run-acceptance.test.mts tooling/acceptance/playwright-report.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
rtk host-test-slot --class focused pnpm eslint tooling/acceptance/run-acceptance.mts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Task 3**

```sh
rtk git add tooling/acceptance/run-acceptance.mts tooling/acceptance/run-acceptance.test.mts tooling/eslint-plugin-template eslint.config.mjs package.json pnpm-lock.yaml
rtk git commit -m "feat: bind required acceptance execution"
```

### Task 4: Define the Records Playwright walking-skeleton seed

**Files:**

- Create: `examples/saas-application/seed/source/product.contract.yaml`
- Create: `examples/saas-application/seed/source/product.contract.schema.json`
- Create: `examples/saas-application/seed/source/docs/product/records-plan.md`
- Create:
  `examples/saas-application/seed/source/docs/template/generated/product-contract.md`
- Create:
  `examples/saas-application/seed/source/playwright.acceptance.config.ts`
- Create:
  `examples/saas-application/seed/source/tests/acceptance/records.spec.ts`
- Create:
  `examples/saas-application/seed/source/tests/acceptance/support/fixtures.ts`
- Create:
  `examples/saas-application/seed/source/tests/acceptance/support/runtime.ts`
- Create:
  `examples/saas-application/seed/source/tests/acceptance/support/runtime.test.ts`
- Modify:
  `examples/saas-application/seed/source/features/support/contracts-runtime.ts`
- Modify: `package.json`

**Consumes:** `ProductContractSchema`, `ProductPlanFrontmatterSchema`,
`runAcceptance`, and the existing runtime mechanics under
`examples/saas-application/seed/source/features/support/`.

**Produces:** Four revision-bound examples, tested runtime support, and the
canonical seed projections used by Task 5. Full real-surface execution waits
until Task 5 materializes a runnable generated customer; the partial seed tree
is never treated as an app root.

- [ ] **Step 1: Establish the existing Cucumber parity baseline**

Run the existing generated-customer Records integration before changing its
source:

```sh
rtk host-test-slot --class full pnpm --dir apps/cli exec vitest run src/factory/createRootIntegration.test.ts -t "executes the selected records example by journey name" --maxWorkers=1 --no-file-parallelism
```

Expected: the existing test exits 0 after asserting `4 scenarios (4 passed)`.

- [ ] **Step 2: Write the four required behaviors and typed plan**

Use these exact IDs and revisions in `product.contract.yaml`:

```yaml
# yaml-language-server: $schema=./product.contract.schema.json
schemaVersion: 1
product:
  id: records-demo
  name: Records Demo
  summary:
    Workspace members manage the same records through the web app and CLI.
behaviors:
  - id: BHV-REC-001
    revision: 1
    status: required
    title: A web-created record appears in the CLI
    actor: workspace member
    surfaces: [web-ui, cli-process]
    preconditions: [The member has an active workspace.]
    action: The member saves a uniquely named record from the web form.
    outcomes: [Listing records from the CLI includes the saved title.]
  - id: BHV-REC-002
    revision: 1
    status: required
    title: A CLI-created record appears in the web app
    actor: workspace member with an API key
    surfaces: [cli-process, web-ui]
    preconditions: [The API key is bound to the member's workspace.]
    action: The member creates a uniquely named record from the CLI.
    outcomes: [The web record list includes the created title.]
  - id: BHV-REC-003
    revision: 1
    status: required
    title: A missing API key cannot create a record
    actor: CLI caller without an API key
    surfaces: [cli-process, web-ui]
    preconditions: [The workspace does not contain the proposed title.]
    action: The caller requests record creation without an API key.
    outcomes:
      - The CLI reports that an API key is required.
      - Independent authorized reads show that the proposed title was not
        created.
  - id: BHV-REC-004
    revision: 1
    status: required
    title: A workspace-bound key cannot write to another workspace
    actor: CLI caller with an API key bound to a different workspace
    surfaces: [cli-process]
    preconditions:
      [The destination workspace does not contain the proposed title.]
    action: The caller requests record creation in the destination workspace.
    outcomes:
      - The CLI reports that the key is bound to a different workspace.
      - Authorized CLI reads of both workspaces exclude the proposed title.
```

The plan frontmatter uses one `fixture-to-real` package, the exact App Map IDs
`route:records` and `headless:executor`, all four behavior IDs, and four
black-box proofs. Each proof uses revision `1`, surfaces set-equal to its
behavior, an observable sentence, and a failure witness. The Markdown body
records `Scope Guard`, `Quality Targets`, and `Test Plan`, naming the four
acceptance examples and the current Records runtime reuse.

- [ ] **Step 3: Write failing runtime-support tests and the four examples**

The runtime tests must prove that UI proxy and CLI receive the same disposable
API base, successful proxy responses preserve backend status/content-type/body
bytes, proxy failure produces only a safe failure response, and diagnostics
redact API keys and authorization headers. The proxy may synthesize failure but
never product success.

`support/fixtures.ts` exports `test` and `expect` from a native `test.extend`
setup with:

- worker-scoped `runtime` started once and stopped in `finally`;
- test-scoped `scenario` with unique primary and observer workspaces;
- test-scoped `acceptancePage` created from an authorized browser context and
  closed in `finally`.

Keep `commandArgs` and JSON title parsing visible in `records.spec.ts`. Each
test carries exactly one tag:

```ts
test(
  "a web-created record appears in the CLI",
  { tag: "@BHV-REC-001-R1" },
  async ({ acceptancePage: page, runtime, scenario }) => {
    const title = `web-${scenario.namespace}`;
    await page.goto(`${runtime.webUrl}/records`);
    await page.getByRole("button", { name: "Create record" }).click();
    await page.getByLabel("Record title").fill(title);
    await page
      .getByLabel("Record detail")
      .fill("Created by Playwright acceptance.");
    await page.getByRole("button", { name: "Save record" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(await listedTitlesFromPrimaryCli(runtime, scenario)).toContain(
      title,
    );
  },
);
```

The other three tests mirror the contract literally. Missing-key denial checks
the CLI error, an authorized primary CLI list, and the rendered web list.
Cross-workspace denial checks the error and authorized primary and observer CLI
lists. Use unique sentinels; do not inspect Convex or application modules.

Add `playwright.acceptance.config.ts` with one project named
`acceptance-chromium`, one worker, retries 0, `forbidOnly: true`, and
`testDir: "./tests/acceptance"`. Hosted URL environment overrides are absent.

- [ ] **Step 4: Confirm the support and discovery path are RED**

Add only the projection authoring script alongside the still-active Cucumber
scripts. Do not add a root acceptance command that points Playwright at the
partial seed tree:

```json
{
  "product-contract:generate": "tsx tooling/acceptance/product-contract.mts generate --source-root examples/saas-application/seed/source"
}
```

Run:

```sh
rtk host-test-slot --class focused pnpm exec vitest run examples/saas-application/seed/source/tests/acceptance/support/runtime.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm exec playwright test --config examples/saas-application/seed/source/playwright.acceptance.config.ts --list --reporter=json
```

Expected: FAIL because the support implementation and fixture export do not yet
exist. The failure must come from those missing interfaces, not malformed YAML
or a typo in a behavior tag.

- [ ] **Step 5: Implement the support, generate projections, and verify
      structural GREEN**

Move the existing process, port, seeding, redaction, API-key proxy,
CLI-child-process, and cleanup mechanics into `support/runtime.ts`; replace the
old Cucumber runtime module with a compatibility re-export for the parity
window. There must be one implementation, not an 860-line copy. Do not carry
over Cucumber imports, World state, Given/When/Then wrappers, or
`createRecordsJourneyActions`. Implement only the fixtures and helpers exercised
by the four visible examples, the temporary Cucumber adapter, and runtime tests.

Run:

```sh
rtk pnpm product-contract:generate
rtk host-test-slot --class focused pnpm exec vitest run examples/saas-application/seed/source/tests/acceptance/support/runtime.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm exec playwright test --config examples/saas-application/seed/source/playwright.acceptance.config.ts --list --reporter=json
rtk host-test-slot --class focused pnpm lint
```

Expected: the support tests pass, discovery lists the four exact revision tags,
and lint passes. App Map resolution, real runtime execution, and the sabotage
trial occur in Task 5 after the current customer projection is runnable.

- [ ] **Step 6: Commit Task 4**

```sh
rtk git add examples/saas-application/seed/source package.json
rtk git commit -m "test: add Records product behavior examples"
```

### Task 5: Project the new authority into generated customers

**Files:**

- Create: `tooling/acceptance/template-product-contract.mts`
- Create: `tooling/acceptance/template-product-contract.test.mts`
- Create: `apps/cli/src/factory/productContractAcceptance.test.ts`
- Modify: `package.json`
- Modify: `apps/cli/package.json`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `tooling/app-map/src/composition.test.ts`
- Modify: `tooling/release/src/customerTarget/ownership.ts`
- Modify: `tooling/release/src/customerTarget/ownership.test.ts`

**Produces:** Every current generated customer receives one root contract,
editor schema, generated docs, acceptance config, checker/runner, and
customer-local scripts. The Records pattern additionally receives its typed
plan, four specs, and support files.

**Interfaces:**

```ts
export const withMaterializedRecordsCustomer: <Value>(
  repoRoot: string,
  operation: (targetRoot: string) => Promise<Value>,
) => Promise<Value>;

export const checkTemplateProductContract: (options: {
  readonly repoRoot: string;
  readonly sourceRoot: "examples/saas-application/seed/source";
  readonly allowFirstContract: boolean;
}) => Promise<readonly string[]>;
```

- [ ] **Step 1: Change generator tests first**

Replace Cucumber-only projection assertions with these exact outcomes while
retaining old Cucumber assertions until Task 6:

- neutral customer: `product.contract.yaml`, `product.contract.schema.json`,
  `docs/template/generated/product-contract.md`, and
  `playwright.acceptance.config.ts` exist; its first outcome is a draft behavior
  and no required test is fabricated;
- Records customer: `docs/product/records-plan.md`,
  `tests/acceptance/records.spec.ts`, `tests/acceptance/support/fixtures.ts`,
  and `tests/acceptance/support/runtime.ts` exist;
- generated package scripts use `--source-root .` for
  `product-contract:generate`, `check:product-contract`, `acceptance:all`, and
  `acceptance:required`;
- generated Records discovery exposes the four exact revision tags;
- generated contract docs are byte-equal to a fresh `product-contract:generate`
  run;
- provenance and ownership list the new contract, plan, config, spec, and
  support paths;
- current customer projections include `eslint.config.mjs` and the
  acceptance-boundary plugin/rule;
- current customer projections include the complete App Map runtime closure used
  by the checker: `composition.ts`, `schema.ts`, `build.ts`, `gitDiff.ts`, and
  `validate.ts`; the imported template-core modules `dataResourceCatalog.ts`,
  `productTopology.ts`, `systemCatalog.ts`, and `templateInstance/index.ts`; and
  the two otherwise-missing required manifest sources: a self-contained empty
  current-customer registry at
  `packages/convex/confect/workflows/_generated/workflowRegistry.ts` and
  `docs/template/generated/workflow-semantics.md`; the registry must not copy
  the template-only publication fixture import graph;
- generated `package.json` pins `@playwright/test` to `1.61.1`, includes
  `yaml: 2.9.0`, and installs from the existing offline store;
- a draft-only neutral customer's `acceptance:required` reports zero required
  observations without spawning Playwright, and its complete `verify` remains
  admissible without fabricating a required promise;
- immutable alpha projections still exclude all current contract files.

Add two isolated assertions in `productContractAcceptance.test.ts`. The first,
named exactly `validates generated customer product contract`, runs the
template-side check, installs the materialized target, runs
`pnpm --dir packages/convex typecheck`, and runs that target's own
`pnpm check:product-contract`. The second, named exactly
`executes required Records product behaviors`, installs the target and runs its
`pnpm acceptance:required`, reporting four passing native Playwright tests.
After offline install and `confect:codegen`, each stages and commits any
generated changes and asserts `git status --short` is empty before its gate.
Every temporary-repository commit uses an inline deterministic identity:
`git -c user.name="Maestro Acceptance" -c user.email="acceptance@maestro.local" commit`.
Exclude this runtime file from the ordinary `apps/cli` unit-test script; point
`test:product-contract-admission` and `test:create-root-admission` at the exact
respective tests. This keeps the atomic gates out of the broad unit/integration
gate. Replace no existing Cucumber integration yet.

- [ ] **Step 2: Run focused projection tests and confirm RED**

```sh
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/candidateComposition.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/template-product-contract.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class full pnpm --dir apps/cli test:product-contract-admission
rtk host-test-slot --class full pnpm --dir apps/cli test:create-root-admission
```

Expected: FAIL because the current factory still projects only
Features/Cucumber; the new isolated tests must reach a missing projected
contract/checker failure rather than pass vacuously.

- [ ] **Step 3: Implement one deterministic customer projection**

Replace `currentContractFiles` with a product-contract projection that:

- always emits one contract, schema, generated document, Playwright config, and
  the two acceptance tooling modules plus runner;
- projects the new `packages/template-core/src/workPackage.ts`,
  `productContract.ts`, and `productPlan.ts` authorities required by those
  customer-local tools;
- emits the Records plan/spec/support only when `records-example` is selected;
- converts `name` to a stable lowercase kebab product ID and preserves the
  supplied product name;
- adds the supplied `firstOutcome` as `BHV-OUTCOME-001`, revision 1, status
  draft, without inventing a plan or acceptance proof;
- customizes the seed Records contract in memory and uses the same pure renderer
  as `product-contract:generate` so generated bytes are identical;
- adds the exact new paths to current blueprint plans, ownership, and Records
  provenance;
- projects the current root ESLint config and acceptance-boundary plugin/rule
  into generated customers;
- projects `tooling/app-map/src/build.ts`, `gitDiff.ts`, and `validate.ts`
  alongside the already projected `composition.ts` and `schema.ts`;
- projects the imported App Map parser modules
  `packages/template-core/src/dataResourceCatalog.ts`, `productTopology.ts`,
  `systemCatalog.ts`, and `templateInstance/index.ts`, plus generated
  `workflow-semantics.md`;
- emits the required current-customer `workflowRegistry.ts` as this
  self-contained, typecheck-safe empty registry rather than copying the
  template-only publication fixture and its transitive imports:

  ```ts
  const definePublicationRegistry = <const Registry>(
    registry: Registry,
  ): Registry => registry;

  export const workflowPublicationRegistry = definePublicationRegistry({
    capabilities: [],
    workflows: [],
  });
  ```

  Update `workflowRegistryEntries` to distinguish a missing registry call from a
  structurally valid registry with empty arrays. The former still fails; the
  latter produces zero workflow facts. Add both cases to `composition.test.ts`.
  All other required manifest sources remain supplied by the existing customer
  chassis, and `template-instance.json` remains materialized by the test
  adapter;

- leaves `buildAlpha1SaasApplicationFiles` and every `releases/**` byte
  untouched.

In `customerPackage`, add the four customer-local scripts with
`--source-root .`; the contract check includes `--allow-first-contract`, whose
history guard makes it effective only for a path never present on the trusted
branch. Add `yaml: 2.9.0` and pin `@playwright/test` to `1.61.1`. Do not switch
customer `verify` away from Cucumber until Task 6; Task 5 is the explicit parity
window.

Implement `template-product-contract.mts` as the thin template-side structural
adapter. It writes
`buildSaasApplicationTargetPlan({ patterns: ["records-example"] })` to a
temporary directory, writes the complete projection and a canonical
`template-instance.json`, then runs `git init -b main`, stages, commits, and
verifies the checkout is clean before any App Map, contract, or Playwright
operation. Commit with
`git -c user.name="Maestro Acceptance" -c user.email="acceptance@maestro.local" commit -m "materialize Records customer"`
so CI does not depend on ambient Git configuration. Build that instance by
passing the existing generator `buildTemplateInstance` through the existing
`createTemplateInstanceMigration(templateInstanceSchemaProvider)` and
serializing the successful migration; do not hand-build a second instance
schema. It composes that target's real App Map, passes the resulting node IDs
through the programmatic `resolveAppMapNodeIds` hook, and checks the seed
contract against the template repository's trusted merge base. It always removes
the temporary repository. Its CLI accepts only
`check --source-root examples/saas-application/seed/source --allow-first-contract`;
no arbitrary App Map IDs are accepted from argv.

Add temporary root scripts for authoring and parity:

```json
{
  "check:product-contract": "pnpm --dir apps/cli test:product-contract-admission",
  "acceptance:required": "pnpm --dir apps/cli test:create-root-admission"
}
```

- [ ] **Step 4: Verify generated customer parity**

```sh
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/candidateComposition.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/template-product-contract.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class full pnpm --dir apps/cli exec vitest run src/factory/createRootIntegration.test.ts -t "executes the selected records example by journey name" --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class full pnpm --dir apps/cli test:create-root-admission
rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/customerTarget/ownership.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/app-map test
rtk host-test-slot --class focused pnpm check:product-contract
```

Expected: the generated target passes both the old four-scenario Cucumber proof
and the new four-test Playwright proof; neutral and historical projections
remain honest.

Perform the credibility trial only now, against the materialized customer. Use
`apply_patch` to return from the Save handler before persistence in
`examples/saas-application/seed/source/apps/web/src/features/records/records-surface.tsx`.
Run:

```sh
rtk host-test-slot --class full pnpm --dir apps/cli test:create-root-admission
```

Expected: nonzero, with the generated Playwright report identifying
`BHV-REC-001-R1` and the missing CLI title. Restore the exact Save
implementation with `apply_patch`, confirm `rtk git diff --check`, and rerun the
same command; all four tests must pass. Do not commit the sabotage or a
generated target.

- [ ] **Step 5: Commit Task 5**

```sh
rtk git add package.json apps/cli/package.json tooling/acceptance/template-product-contract.mts tooling/acceptance/template-product-contract.test.mts tooling/generators/src/blueprints apps/cli/src/factory tooling/app-map/src/composition.test.ts tooling/release/src/customerTarget
rtk git commit -m "feat: project typed product contracts"
```

### Task 6: Cut over policy, gates, receipts, and remove Cucumber

**Files:**

- Delete: `cucumber.cjs`
- Delete: `tooling/acceptance/source-check.mts`
- Delete: `tooling/acceptance/source-check.test.mts`
- Delete: `tooling/acceptance/required-selection.mts`
- Delete: `tooling/acceptance/required-selection.test.mts`
- Delete: `apps/cli/src/factory/contracts.ts`
- Delete: `apps/cli/src/factory/contracts.test.ts`
- Delete: `examples/saas-application/seed/source/features/records.feature`
- Delete:
  `examples/saas-application/seed/source/features/step_definitions/records.journeys.ts`
- Delete:
  `examples/saas-application/seed/source/features/step_definitions/records.steps.ts`
- Delete:
  `examples/saas-application/seed/source/features/support/contracts-scenario.ts`
- Delete:
  `examples/saas-application/seed/source/features/support/contracts-runtime.ts`
- Delete:
  `examples/saas-application/seed/source/features/support/contracts-runtime.test.ts`
- Delete:
  `examples/saas-application/seed/source/features/support/contracts-world.ts`
- Delete:
  `examples/saas-application/seed/source/features/support/contracts-world.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.github/CODEOWNERS`
- Modify: `apps/cli/src/factory/customerComposition.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `tooling/ci/dependency-allowlist.json`
- Modify: `tooling/ci/dependency-proxy.test.mts`
- Modify: `tooling/ci/verify-chassis.test.mts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `tooling/quality/delivery-batch-authority.test.mts`
- Modify: `tooling/release-seal.mts`
- Modify: `tooling/release/src/customerTarget/ownership.ts`
- Modify: `tooling/release/src/customerTarget/ownership.test.ts`
- Modify: `AGENTS.md`
- Modify: `.claude/skills/planning/SKILL.md`
- Modify: `docs/template/enforced-engineering-rules.md`
- Modify: `docs/template/blueprints/saas-application.md`
- Modify: `docs/template/coding-standards.md`
- Modify: `docs/template/hosting.md`
- Modify: `docs/rule-coverage.md`
- Modify: `tooling/quality/contract-review-rubric.md`

**Produces:** One active product-contract authority and two required receipt
observations: structural product contract and runtime acceptance.

- [ ] **Step 1: Write the final authority and gate assertions before removal**

Update tests to require:

```ts
expect(rootPackage.devDependencies).not.toHaveProperty("@cucumber/cucumber");
expect(rootPackage.devDependencies?.["@playwright/test"]).toBe("1.61.1");
expect(rootPackage.scripts.verify).toContain("pnpm check:product-contract");
expect(rootPackage.scripts.verify).toContain("pnpm acceptance:required");
expect(projectedPackage.scripts.verify).toContain(
  "pnpm check:product-contract",
);
expect(projectedPackage.scripts.verify).toContain("pnpm acceptance:required");
expect(projectedPackage.scripts.verify).not.toMatch(
  /cucumber|contracts test/iu,
);
expect(projectedPaths).not.toContain("cucumber.cjs");
expect(projectedPaths.some((path) => path.startsWith("features/"))).toBe(false);
```

Add quality registry expectations for:

- `product-contract`: posture `required`, evidence class `static`, canonical
  argv `pnpm check:product-contract`;
- `acceptance-required`: posture `required`, evidence class `runtime`, canonical
  argv `pnpm acceptance:required`.

Receipt tests must assert only those atomic gate IDs/statuses and must not add
behavior-result fields to the receipt schema.

- [ ] **Step 2: Run focused tests and confirm RED**

```sh
rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/delivery-batch-authority.test.mts tooling/ci/dependency-proxy.test.mts tooling/ci/verify-chassis.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL while Cucumber remains the active verify authority and the new
descriptors are absent.

- [ ] **Step 3: Switch package and receipt authority once**

- Add `check:product-contract` and `acceptance:required` exactly once to root
  `verify` and generated-customer `verify`.
- Register the two descriptors in `check-definitions.mts`; reuse the current
  Agent Pack runner and receipt types unchanged.
- Remove all generated Cucumber scripts/projections and the `maestro contracts`
  handler/help line.
- Remove `@cucumber/cucumber`; run `rtk pnpm install --lockfile-only` to update
  the lock mechanically.
- Remove Cucumber-only dependency allowlist and release-seal pins; keep
  unrelated dependency closures unchanged.
- Update integration expectations so the generated customer admission path runs
  `pnpm check:product-contract` and `pnpm acceptance:required` directly.

- [ ] **Step 4: Rewrite active guidance around the typed flow**

`AGENTS.md` and `.claude/skills/planning/SKILL.md` must state this order:

1. create or select behavior IDs in `product.contract.yaml`;
2. write typed plan frontmatter with existing `WorkPackageSchema` classification
   and current App Map targets;
3. design the black-box proof and failure witness before implementation;
4. add focused unit/integration tests only for named implementation risks;
5. generate docs, check the contract, and run required acceptance;
6. promote draft to required only with its revision-bound passing example;
7. run full verification once on the immutable delivery head and inspect the
   exact-head receipt.

`coding-standards.md`, `enforced-engineering-rules.md`, `hosting.md`,
`blueprints/saas-application.md`, and `rule-coverage.md` must name the new
scripts and must not describe Features, Gherkin, or Cucumber as current
authority. Historical deployment lessons may continue to name the old tool as
historical evidence.

Add these four questions verbatim to `contract-review-rubric.md`:

1. Would the test fail if the promised user outcome stopped working?
2. Does it exercise the public surface named by the contract?
3. Would it still pass against a no-op, canned-success, or mocked product path?
4. Does it observe the important denial or absence outcome where applicable?

A yes to question 3 or no to questions 1 or 2 is a review finding. State that
semantic usefulness remains advisory judgment, not a deterministic
self-certification.

- [ ] **Step 5: Verify the focused cutover and active-reference cleanup**

```sh
rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts tooling/quality/delivery-batch-authority.test.mts tooling/ci/dependency-proxy.test.mts tooling/ci/verify-chassis.test.mts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/eslint-plugin-template test
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm check:product-contract
rtk host-test-slot --class full pnpm acceptance:required
rtk rg -n -i "cucumber|gherkin|contracts (add|check|test)|acceptance:cucumber|acceptance:syntax|acceptance:check|required-selection|features/.*\.feature" . --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!.superpowers/**' --glob '!releases/**' --glob '!docs/superpowers/**' --glob '!docs/template/deployment-lessons.md'
```

Expected: every command before the final scan exits 0; the final scan returns no
active-authority match. The explicitly historical
`docs/template/deployment-lessons.md`, immutable releases, and Superpowers
design/plan history are excluded deliberately.

- [ ] **Step 6: Format, inspect, and commit Task 6**

```sh
rtk prettier --check package.json AGENTS.md .claude/skills/planning/SKILL.md docs/template/enforced-engineering-rules.md docs/template/coding-standards.md docs/template/hosting.md docs/template/blueprints/saas-application.md docs/rule-coverage.md tooling/quality/contract-review-rubric.md
rtk git diff --check
rtk git status --short
rtk git add package.json pnpm-lock.yaml AGENTS.md .claude .github apps tooling examples docs/template docs/rule-coverage.md cucumber.cjs
rtk git commit -m "feat: cut over product contract authority"
```

The `git add` command intentionally names deleted active Cucumber paths through
their parent directories while leaving `releases/**` and historical
`docs/superpowers/**` untouched.

## Batch closeout

After Task 6 task review is clean:

1. Record the Task 6 SHA as the frozen batch head.
2. Generate a whole-batch review package from `b8ae957` to that SHA.
3. Resolve every Critical or Important finding and repeat whole-batch review if
   the head changes.
4. Run required verification once on that immutable head with
   `rtk maestro-remote-test -- pnpm maestro -- verify --scope full --json` (or
   the local full semaphore fallback), retain stdout's `data.receipt`, and
   confirm its `subject.commit` is that exact SHA. The remote worktree is
   deleted, so do not inspect a vanished remote receipt file.
5. Confirm the exact-head product-contract and acceptance observations in that
   receipt; do not treat a dirty or prior-head receipt as delivery evidence.
6. Use Woodpecker `ci/woodpecker/pr/verify` as the sole merge verdict.
