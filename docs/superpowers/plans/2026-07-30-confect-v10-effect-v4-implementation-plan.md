# Confect v10 and Effect v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the factory and an untouched candidate customer target to the
exact Confect `10.0.0-next.9` / Effect `4.0.0-beta.102` compatibility cohort,
leaving the tree ready to seal alpha.3 without publishing, deploying, or
changing the public default.

**Architecture:** Establish a machine-checked dependency boundary first, then
migrate shared Effect contracts before Confect-authored backend code and
generated artifacts. Validate the candidate through the same
composition/materialization boundary used by `maestro create`; keep immutable
alpha.2 untouched and make alpha.3 sealing a separately authorized post-merge
operation.

**Tech Stack:** Node 22.23.2 locally (CI 22.12.0), pnpm, TypeScript, Effect 4
beta.102, Confect 10 next.9, Convex 1.42.1, Vitest 3, React 19.1, repository
generators and release tooling.

## Global Constraints

- Preserve design commits `57f912ab` and `75e55098`; all migration commits
  descend from `75e55098`.
- Pin every `@confect/*` package to exact `10.0.0-next.9`.
- Pin `effect`, `@effect/platform-node`, and `@effect/vitest` to exact
  `4.0.0-beta.102`; pin `@effect/language-service` to exact `0.87.1`.
- Add exact `ioredis@5.11.1` beside the Convex/backend importer of
  `@confect/cli`; remove active direct `@effect/platform` and `@effect/cluster`
  dependencies.
- Keep `convex@1.42.1`, `convex-test@0.0.54`, React 19.1, and Vitest 3 unless a
  focused test proves an independently reviewed incompatibility.
- Use exact upstream source commits `de2a9a69099993087e57c64df58537c765ac0224`
  and `ba0fb82222d487bdf62fde2c429e92628f8a0585` for `repos/effect` and
  `repos/confect`; application code must never import from `repos/*`.
- Do not manually edit Confect, Convex, route-tree, release, or
  factory-generated output. Change authored inputs and rerun the canonical
  generator.
- Every shell command is prefixed with `rtk`. Every Node command runs through
  `rtk fnm exec --using=22.23.2`.
- Every focused test/typecheck uses `rtk host-test-slot --class focused`; do not
  start a full host slot, `just verify`, broad `pnpm verify`, broad `pnpm test`,
  Turbo-wide run, or full Vitest suite locally.
- `check:generators` includes connected `convex codegen`; never classify it as
  offline or place it in a generic preflight. Connected Convex and exact-head
  broad gates wait for the controlled release lane.
- Treat provider 402/429, unavailable Convex credentials, and occupied
  release-critical host lanes as external blockers; do not cancel active
  tmux/Fabro workers or relaunch identical broad work.
- Never rewrite `releases/v0.2.0-alpha.2`. Do not publish packages/tags, deploy,
  seal alpha.3, or switch `maestro create`/quickstart public defaults without
  explicit authority.
- Work-package classification: this is a `template-gap` compatibility migration
  of the existing Confect/Effect boundary, not a new product subsystem; preserve
  every current layer and customer contract.

---

## File and Interface Map

The tasks below divide ownership rather than treating compiler errors as an
unbounded search:

- Dependency authority: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
  `knip.json`, and the package manifests under `apps/cli`, `apps/web`,
  `packages/convex`, `packages/editor-core`, `packages/integrations`,
  `packages/template-core`, `tooling/confect-manifest`, and
  `tooling/effectified-api-proof`.
- Compatibility authority: rename `tooling/quality/check-confect-v9.mts`,
  `tooling/quality/check-confect-v9.test.mts`, and
  `tooling/effectified-api-proof/confect-v9-proof.ts`; follow registrations in
  `package.json`, `tooling/quality/src/check-definitions.mts`,
  `tooling/generators/src/blueprints/saasRegistrationProjections.ts`,
  `tooling/generators/src/blueprints/saasApplication.test.ts`,
  `apps/cli/src/factory/customerCliRuntime.test.ts`,
  `tooling/agent-pack/src/nodeAdapters.test.ts`,
  `tooling/agent-pack/src/preflightProbe.test.ts`,
  `tooling/release-seal.test.mts`, and
  `tooling/release/src/customerTarget/ownership.test.ts`.
- Shared Effect boundary: authored `.ts`/`.tsx` files in
  `packages/editor-core/src`, `packages/template-core/src`,
  `packages/integrations/src`, `tooling/confect-manifest/src`,
  `tooling/effectified-api-proof`, and `apps/web/src/adapters` plus their
  colocated tests.
- Backend authoring boundary: authored files under
  `packages/convex/confect/access`, `brain`, `capabilities`, `editor`,
  `headless`, `ops`, `policy`, `shared`, `tables`, `workflowContracts`, and
  `workflows`, plus `packages/convex/test`. Files under `_generated` and
  generated `packages/convex/convex/*` registries are outputs only.
- Factory projection boundary: `tooling/generators/src/customer-runtime.ts`,
  `tooling/generators/src/index.ts`, `tooling/generators/src/workflow-files.ts`,
  `tooling/generators/src/blueprints/saasRegistrationProjections.ts`, their
  tests, and `examples/saas-application/seed/source`.
- Release boundary: `apps/cli/src/factory/createComposition.ts`,
  `apps/cli/src/factory/composition.ts`,
  `apps/cli/src/factory/createRootIntegration.test.ts`,
  `apps/cli/src/factory/customerCliRuntime.test.ts`, `tooling/release-seal.mts`,
  `tooling/release-seal.test.mts`, and `tooling/release/src/customerTarget/*`.
  Candidate injection changes test seams only; alpha.2 constants stay
  authoritative until a separately authorized alpha.3 rollout.

### Task 1: Make the Compatibility Contract Fail for the Old Cohort

**Files:**

- Rename: `tooling/quality/check-confect-v9.mts` →
  `tooling/quality/check-confect-effect-compat.mts`
- Rename: `tooling/quality/check-confect-v9.test.mts` →
  `tooling/quality/check-confect-effect-compat.test.mts`
- Modify: `package.json`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

- Consumes: active workspace package manifests and authored import text.
- Produces:
  `collectConfectEffectCompatibilityFindings(repoRoot): readonly CompatibilityFinding[]`
  and `runConfectEffectCompatibilityCheck(repoRoot): void`; root command
  `pnpm check:confect-effect-compat`.

- [ ] **Step 1: Rename the gate files and write target-cohort tests**

Use `git mv`, rename exported v9 symbols to the version-neutral names, and
change the fixture to the target set. Add assertions that separately reject a
mixed Confect pin, Effect 3, mismatched platform-node/vitest, missing `ioredis`,
active platform/cluster, a stale 9.1.5 patch mapping, and an application import
from `repos/*`:

```ts
expect(collectConfectEffectCompatibilityFindings(repoRoot)).toEqual([]);

await mutatePackage(repoRoot, "apps/web/package.json", "effect", "3.21.4");
expect(collectConfectEffectCompatibilityFindings(repoRoot)).toContainEqual(
  expect.objectContaining({
    message: expect.stringContaining("effect must be exactly 4.0.0-beta.102"),
  }),
);
```

- [ ] **Step 2: Run the focused test and verify red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/quality/check-confect-effect-compat.test.mts`

Expected: FAIL because current manifests still resolve Confect 9.1.5 / Effect
3.21.4 and the new package-cohort checks are not implemented.

- [ ] **Step 3: Implement the target compatibility collector**

Define exact constants and inspect both dependencies and devDependencies across
every active manifest:

```ts
const EXPECTED = {
  confect: "10.0.0-next.9",
  effect: "4.0.0-beta.102",
  languageService: "0.87.1",
  ioredis: "5.11.1",
} as const;

export type CompatibilityFinding = {
  readonly file: string;
  readonly message: string;
};
```

Retain the valuable Confect authoring-shape checks (no root aggregate, submodule
imports, lazy spec schemas, `databaseSchema`, finalized groups, lazy tables),
but remove v9 wording. Scan active manifests, `pnpm-workspace.yaml`, and
authored source; explicitly exclude `releases/`, historical `docs/superpowers/`,
`.git/`, and `repos/` from stale-current vocabulary scans.

- [ ] **Step 4: Register the version-neutral command**

Replace `check:confect-v9` in `package.json` and the quality definition with
`check:confect-effect-compat`. Keep it red until Task 3 updates manifests.

- [ ] **Step 5: Run the gate test and commit the intentional red contract**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/quality/check-confect-effect-compat.test.mts`

Expected: PASS for synthetic fixtures. Then run
`rtk fnm exec --using=22.23.2 pnpm check:confect-effect-compat`; expected
repository-level FAIL listing the old cohort.

Commit:

```bash
rtk git add package.json tooling/quality/check-confect-effect-compat.mts tooling/quality/check-confect-effect-compat.test.mts tooling/quality/src/check-definitions.mts
rtk git commit -m "test: define Confect Effect compatibility"
```

### Task 2: Refresh Exact Vendored Upstream Authorities

**Files:**

- Replace generated subtree contents: `repos/effect/**`
- Replace generated subtree contents: `repos/confect/**`
- Modify: `repos/README.md`
- Modify: `agent-patterns/effect-confect.md`

**Interfaces:**

- Consumes: exact tagged source trees at commits specified in Global
  Constraints.
- Produces: read-only local API authority matching the installed cohort; no
  workspace/package import edge.

- [ ] **Step 1: Record current subtree provenance and add reference assertions**

Add checks to `tooling/release/src/customerTarget/ownership.test.ts` that read
the guide and assert both exact commits and absence of `workspace:*`
registrations or customer ownership entries for `repos/*`.

- [ ] **Step 2: Run the focused vendored-source test red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/release/src/customerTarget/ownership.test.ts`

Expected: FAIL because the guides and current squashed trees name older refs.

- [ ] **Step 3: Replace the squashed trees from the already fetched exact-tag
      clones**

Use `/tmp/maestro-effect-beta102-20260730` and
`/tmp/maestro-confect-next9-20260730` only after verifying `git rev-parse HEAD`
equals the approved commits. Preserve repository exclusion rules and omit
upstream `.git` directories. Do not modify upstream source.

- [ ] **Step 4: Update the working references**

Document tag, commit, upstream URL, squashed/read-only status, and the rule
“application code never imports from `repos/*`” in `repos/README.md` and
`agent-patterns/effect-confect.md`.

- [ ] **Step 5: Verify and commit**

Run the focused test from Step 2 and
`rtk fnm exec --using=22.23.2 pnpm check:confect-effect-compat`; the latter may
still fail only on package pins, never on `repos/*` imports.

Commit:

```bash
rtk git add repos/effect repos/confect repos/README.md agent-patterns/effect-confect.md
rtk git commit -m "docs: refresh Effect Confect authorities"
```

### Task 3: Install One Exact Dependency Cohort

**Files:**

- Modify: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `knip.json`
- Modify: `packages/convex/package.json`, `apps/cli/package.json`,
  `apps/web/package.json`
- Modify: `packages/editor-core/package.json`,
  `packages/integrations/package.json`, `packages/template-core/package.json`
- Modify: `tooling/confect-manifest/package.json`,
  `tooling/effectified-api-proof/package.json`
- Delete: `patches/@confect__cli@9.1.5.patch`

**Interfaces:**

- Consumes: compatibility constants from Task 1 and pnpm peer metadata.
- Produces: one lockfile cohort; `@confect/cli` importer in `packages/convex`
  owns `@effect/platform-node` and `ioredis` pins.

- [ ] **Step 1: Extend tests to inspect the lockfile resolution**

Assert no active importer requests Effect 3, no active manifest contains
`@effect/platform` or `@effect/cluster`, every Confect request is exact next.9,
and resolved `@effect/platform-node-shared` (if present) is beta.102. Assert
`packages/convex` directly owns `ioredis: 5.11.1` and
`@effect/platform-node: 4.0.0-beta.102`; assert `apps/cli` does not.

- [ ] **Step 2: Run the compatibility test red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/quality/check-confect-effect-compat.test.mts`

Expected: FAIL on the old fixtures/lockfile.

- [ ] **Step 3: Update manifests and patch mapping**

Apply the exact matrix, remove obsolete package allowlists in `knip.json`,
remove the 9.1.5 patched-dependency entry, and temporarily leave next.9
unpatched until Task 9 creates its tested patch.

- [ ] **Step 4: Regenerate and inspect the lockfile**

Run: `rtk fnm exec --using=22.23.2 pnpm install --lockfile-only`

Expected: exit 0 with no peer warning attributable to
Confect/Effect/platform-node/ioredis. Inspect with
`rtk fnm exec --using=22.23.2 pnpm why effect @effect/platform-node @effect/platform-node-shared @effect/vitest ioredis`
and record any unrelated transitive Effect 3 package in the PR notes rather than
suppressing it.

- [ ] **Step 5: Verify package contract and commit**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/quality/check-confect-effect-compat.test.mts`

Run: `rtk fnm exec --using=22.23.2 pnpm check:confect-effect-compat`

Expected: both PASS.

Commit:

```bash
rtk git add package.json pnpm-workspace.yaml pnpm-lock.yaml knip.json packages/convex/package.json apps/cli/package.json apps/web/package.json packages/editor-core/package.json packages/integrations/package.json packages/template-core/package.json tooling/confect-manifest/package.json tooling/effectified-api-proof/package.json patches/@confect__cli@9.1.5.patch
rtk git commit -m "build: pin Confect 10 and Effect 4"
```

### Task 4: Port Shared Schema and Manifest Boundaries

**Files:**

- Modify: `packages/editor-core/src/index.ts`
- Modify: `packages/template-core/src/**/*.ts`
- Modify:
  `packages/integrations/src/{billing,dodo,flags,index,llm,llmResponse,rateLimit,spend,workos}.ts`
- Modify: `tooling/confect-manifest/src/index.ts`,
  `tooling/confect-manifest/src/index.test.ts`
- Modify: `tooling/effectified-api-proof/{effect-config-proof.ts,package.json}`

**Interfaces:**

- Consumes: Effect beta.102 Schema/Exit/JsonSchema APIs.
- Produces: serializable shared schemas;
  `buildContractJsonSchemas(registry): ContractJsonSchemas` retaining OpenAPI
  3.1 and JSON Schema 2020-12 output shapes.

- [ ] **Step 1: Add golden schema and persisted-value tests**

Extend `tooling/confect-manifest/src/index.test.ts` with exact snapshots for
object required keys, literal enum, `$schema`, definitions/references, and
OpenAPI vs MCP target differences. In shared package tests, decode
representative old persisted values and assert `Exit.isSuccess`; assert invalid
input is `Exit.isFailure` with a formatted `SchemaIssue`.

- [ ] **Step 2: Run focused tests red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir tooling/confect-manifest test`

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/template-core test`

Expected: compile/runtime failures for removed `effect/JSONSchema`, old Schema
constructors, and parser Either APIs.

- [ ] **Step 3: Port schema constructors and codecs**

Use the audited mappings, preserving encoded types:

```ts
const Status = Schema.Literals(["queued", "running", "failed"]);
const Value = Schema.Union([Schema.String, Schema.Number]);
const OptionalOwner = Schema.OptionFromNullOr(Schema.String);
const parsed = Schema.decodeUnknownExit(Status)(input);
```

Replace `Schema.TaggedError` with `Schema.TaggedErrorClass`; translate
checks/filters/transforms from exact beta.102 source. Do not use Result for
parser outcomes.

- [ ] **Step 4: Port JSON Schema document generation**

Replace `JSONSchema.make` with a small internal conversion using
`Schema.toJsonSchemaDocument` and `effect/JsonSchema` document conversion APIs.
Keep the public `ContractJsonSchemas` type and stable sorted registry behavior;
normalize only target-specific document envelope fields proven by goldens.

- [ ] **Step 5: Verify shared packages and commit**

Run the two tests from Step 2 plus:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir tooling/confect-manifest typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/template-core typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/integrations typecheck`

Expected: PASS.

Commit:
`rtk git add packages/editor-core packages/template-core packages/integrations tooling/confect-manifest tooling/effectified-api-proof && rtk git commit -m "refactor: port shared schemas to Effect 4"`

### Task 5: Migrate Domain Either Values to Result

**Files:**

- Modify: `packages/template-core/src/workflow-semantics/failure-policy.ts`,
  `packages/template-core/src/workflow-semantics/failure-policy.test.ts`
- Modify:
  `apps/web/src/adapters/{confect-state,effectBoundary,failure-message}.ts`,
  `apps/web/src/adapters/confect-state.test.ts`
- Modify: authored files reported by
  `rtk rg -l 'effect/Either' packages/convex/confect packages/convex/test tooling/generators examples/saas-application/seed/source`

**Interfaces:**

- Consumes: domain success/failure values formerly expressed as `Either<E, A>`.
- Produces: `Result.Result<A, E>` with `Result.succeed`, `Result.fail`,
  `Result.isSuccess`, `Result.isFailure`, `.success`, and `.failure`; parser
  outcomes remain Exit.

- [ ] **Step 1: Freeze success/failure behavior before renaming**

For failure policy, graph validation, workflow admission, access lifecycle, and
web adapter boundaries, add paired tests proving the exact successful payload
and typed failure payload. Include one exhaustiveness/narrowing test so swapped
type parameters fail compilation.

- [ ] **Step 2: Run the focused behavior tests red after changing test
      vocabulary**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/template-core test`

Run named Convex test files only:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex exec vitest run test/workflow-graph-v2.test.ts test/workflow-lifecycle-state.test.ts test/access-lifecycle.test.ts`

Expected: compile failures for missing Result exports/fields in current
implementations.

- [ ] **Step 3: Translate domain values by semantic branch**

For each import, inspect every constructor, matcher, guard, and property access.
Apply:

```ts
const accepted: Result.Result<Decision, AdmissionFailure> =
  Result.succeed(decision);
if (Result.isFailure(accepted)) return accepted.failure;
return accepted.success;
```

Never bulk-replace `.left`/`.right` without a test identifying which branch it
represents. Do not change Schema decode calls here.

- [ ] **Step 4: Verify absence and behavior**

Run Step 2 commands plus
`rtk rg 'effect/Either|Either\.(left|right|isLeft|isRight)|\.(left|right)\b' packages apps tooling examples --glob '!**/_generated/**'`.

Expected: tests PASS; search returns no authored domain Either usage (historical
docs and vendored source excluded).

- [ ] **Step 5: Commit**

`rtk git add packages/template-core packages/convex/confect packages/convex/test apps/web/src/adapters tooling/generators examples/saas-application/seed/source && rtk git commit -m "refactor: migrate domain Either to Result"`

### Task 6: Migrate Parser Exit and Remaining Schema APIs

**Files:**

- Modify: all authored files reported by
  `rtk rg -l 'decodeUnknownEither|encodeUnknownEither|Schema\.Literal\([^\n]*,|Schema\.Union\([^\[]|Schema\.TaggedError|Schema\.Option\(' packages apps tooling examples --glob '!**/_generated/**'`
- Modify: corresponding tests under `packages/convex/test`, `apps/web/src`,
  `packages/integrations/src`, and generator tests.

**Interfaces:**

- Consumes: unknown external/Convex/persisted values.
- Produces: parser `Exit` values and stable encoded contracts using
  `SchemaError`/`SchemaIssue`; domain Result remains separate.

- [ ] **Step 1: Add parser failure-shape tests**

For representative config, workflow graph, lifecycle state, integration
response, and Confect state decoders, assert both `Exit.isSuccess(decoded)` and
`Exit.isFailure(decoded)`. Assert the UI/log-facing formatter receives a
`SchemaIssue` and returns a redacted stable message rather than serializing the
whole input.

- [ ] **Step 2: Run named tests red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex exec vitest run test/shared-env.test.ts test/workflow-graph-migration.test.ts test/workflow-definition.test.ts`

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/web exec vitest run src/adapters/confect-state.test.ts`

Expected: failures from removed `decodeUnknownEither` and old Schema error
shapes.

- [ ] **Step 3: Apply the parser migration**

Use `Schema.decodeUnknownExit`, `decodeExit`, `encodeUnknownExit`, or
`encodeExit` according to the existing input type. Narrow with
`Exit.isSuccess`/`Exit.isFailure`; use beta.102 `SchemaError` and `SchemaIssue`
formatting. Translate multi-literals, array-form unions, tagged error classes,
optional/check/transform signatures, and `OptionFromNullOr` at serialization
boundaries.

- [ ] **Step 4: Verify and commit**

Run the two Step 2 commands and these package typechecks. Search authored code
for every removed API pattern; expected zero matches.

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex typecheck`

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/web typecheck`

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/integrations typecheck`

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/template-core typecheck`

Commit:
`rtk git add packages apps tooling examples && rtk git commit -m "refactor: port schema parsing to Exit"`

### Task 7: Port Services, Test Clock, Cause, and Layer APIs

**Files:**

- Modify: authored files reported by
  `rtk rg -l 'Context\.(Tag|GenericTag)|effect/TestClock|effect/TestContext|Cause\.|Layer\.' packages apps tooling examples --glob '!**/_generated/**'`
- Modify: corresponding service and clock tests in `packages/convex/test`,
  `packages/integrations/src`, and `tooling/effectified-api-proof`.

**Interfaces:**

- Consumes: existing service interfaces and live/fake layers.
- Produces: `Context.Service` tags, beta.102 Layer composition,
  `effect/testing/TestClock`, `TestClock.layer()`, and behavior-equivalent Cause
  inspection.

- [ ] **Step 1: Add layer-substitution and clock tests**

Prove fake/live services are independently injectable, Config keeps
default/empty-string semantics, and advancing TestClock drives the same
retry/deadline result. Test expected failures by inspecting Cause/Exit without
unsafe casts.

- [ ] **Step 2: Run focused tests red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex exec vitest run test/shared-env.test.ts test/workflow-effect-retry.test.ts test/workflow-deadline.test.ts`

Expected: compile failures for removed tag constructors, TestContext, or
Layer/Cause APIs.

- [ ] **Step 3: Port without flattening boundaries**

Define services with
`Context.Service<ServiceName>("qualified/ServiceName", { ... })` following
beta.102 signatures. Import `TestClock` from `effect/testing/TestClock` and
provide `TestClock.layer()` directly. Translate renamed Effect
catches/forks/Layer combinators from the exact vendored source; preserve typed
error channels.

- [ ] **Step 4: Verify and commit**

Run Step 2 tests plus:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/integrations typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir tooling/effectified-api-proof typecheck`

Search with
`rtk rg 'Context\.(Tag|GenericTag)|effect/TestClock|effect/TestContext' packages apps tooling examples --glob '!**/_generated/**'`;
expected zero authored matches.

Commit:
`rtk git add packages apps tooling examples && rtk git commit -m "refactor: port Effect services and test layers"`

### Task 8: Port Confect Authored Contracts and Consumers

**Files:**

- Modify: authored `.ts` files under
  `packages/convex/confect/{access,auth,brain,capabilities,demo,editor,headless,ops,policy,shared,tables,workflowContracts,workflows}`
- Modify: `packages/convex/test/**/*.test.ts`
- Modify: `apps/web/src/features/notifications/notification-center-surface.tsx`
- Modify: Confect React/JS tests under `apps/web/src` and `apps/cli/src`

**Interfaces:**

- Consumes: migrated shared schemas/Results/Exits/services and Confect next.9
  authoring APIs.
- Produces: loadable table/spec/impl graph with lazy schema thunks, lazy tables,
  `databaseSchema`, and finalized group implementations; typed React/JS refs
  remain behavior compatible.

- [ ] **Step 1: Add contract tests for each function kind and typed failure**

In the existing Confect contract suite, cover one public query, mutation,
action, internal function, expected typed error, React reference, JS reference,
and `@confect/test` invocation. Preserve query loading/empty/ready, mutation
success/failure, and action failure UI states.

- [ ] **Step 2: Run Confect contract tests red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex test:contract`

Expected: compile/load errors identifying remaining v9/v3 API shapes.

- [ ] **Step 3: Port authored Confect code only**

Retain `Table.make(() => schema)`,
`FunctionSpec.*({ args: () => ..., returns: () => ..., error: () => ... })`,
`FunctionImpl.make(databaseSchema, ...)`,
`GroupImpl.make(databaseSchema, spec)`, and `GroupImpl.finalize`. Adapt only
actual next.9 signature differences. Use `Schema.OptionFromNullOr` for Options
crossing Confect/Convex serialization.

- [ ] **Step 4: Port React/JS/test harness consumers**

Update typed error and Result handling without changing visible state semantics.
Keep generated refs as the only client/backend link.

- [ ] **Step 5: Verify authored graph and commit**

Run the contract command from Step 2 plus:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/web typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/web exec vitest run src/adapters/confect-state.test.ts`

Expected: PASS. Do not run codegen yet.

Commit:
`rtk git add packages/convex/confect packages/convex/test apps/web apps/cli && rtk git commit -m "refactor: port Confect contracts to v10"`

### Task 9: Rebase and Prove the Confect CLI Patch

**Files:**

- Create: `patches/@confect__cli@10.0.0-next.9.patch`
- Modify: `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- Modify: `packages/convex/test/confect-codegen-component-roots.test.ts`
- Modify:/add focused fixture files used by that test under its existing fixture
  directory.

**Interfaces:**

- Consumes: pristine `@confect/cli@10.0.0-next.9` installation.
- Produces: patch that excludes `workflows/subworkflowLinksCurrent.spec.ts`,
  preserves component roots plus
  `deadlinesCurrent.ts`/`subworkflowLinksCurrent.ts`, and wraps generated
  declarations.

- [ ] **Step 1: Expand the regression test**

Run codegen twice in the fixture and assert preserved files remain
byte-identical, the excluded spec is not registered twice, extinct owned groups
are removed, and generated registration declarations pass Prettier.

- [ ] **Step 2: Run the test against pristine next.9 red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex exec vitest run test/confect-codegen-component-roots.test.ts`

Expected: FAIL by deletion/duplicate discovery/unformatted declaration, proving
each patch hunk remains necessary.

- [ ] **Step 3: Create the patch with pnpm's canonical patch workflow**

Patch the exact installed package, port only the three proven behaviors to
next.9 source positions, then commit the patch through `pnpm patch-commit`.
Register exactly `patches/@confect__cli@10.0.0-next.9.patch` and refresh the
lockfile.

Run:
`rtk fnm exec --using=22.23.2 pnpm patch @confect/cli@10.0.0-next.9 --edit-dir .pnpm-patch/confect-cli-next9`

After editing only that temporary directory, run:
`rtk fnm exec --using=22.23.2 pnpm patch-commit .pnpm-patch/confect-cli-next9`

The edit directory is ephemeral and must not be committed; verify the resulting
repository path is exactly `patches/@confect__cli@10.0.0-next.9.patch`.

- [ ] **Step 4: Verify repeatability and commit**

Run Step 2 twice; expected PASS both times with a clean fixture diff. Run
compatibility gate; expected PASS.

Commit:
`rtk git add patches/@confect__cli@10.0.0-next.9.patch pnpm-workspace.yaml pnpm-lock.yaml packages/convex/test && rtk git commit -m "fix: preserve Convex roots in Confect codegen"`

### Task 10: Regenerate Canonical Confect Output

**Files:**

- Generated modify/delete/create: `packages/convex/confect/_generated/**`
- Generated modify/delete/create: Confect-owned registries/modules under
  `packages/convex/convex/**`
- Authored fixes, if a generation error identifies them: exact originating file
  under `packages/convex/confect/**` or patch from Task 9.

**Interfaces:**

- Consumes: loadable authored Confect graph and tested next.9 CLI patch.
- Produces: deterministic next.9 generated output while preserving
  Maestro/Convex-owned modules.

- [ ] **Step 1: Snapshot ownership expectations**

Run the preservation regression test and record `git status --short`. Confirm
`packages/convex/convex/workflows/deadlinesCurrent.ts`,
`subworkflowLinksCurrent.ts`, and component roots are tracked before generation.

- [ ] **Step 2: Run canonical offline Confect codegen**

Run: `rtk fnm exec --using=22.23.2 pnpm --dir packages/convex confect:codegen`

Do not invoke `check:generators` or connected Convex codegen.

Expected: exit 0. If it fails, fix authored source or the tested patch and
rerun; never edit generated output.

- [ ] **Step 3: Review generated ownership and determinism**

Inspect
`rtk git diff -- packages/convex/confect/_generated packages/convex/convex`.
Re-run the same command; expected no second-run diff. Run the component-root
regression test.

- [ ] **Step 4: Verify package and commit**

Run:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex typecheck`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex test:contract`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir packages/convex exec vitest run test/confect-codegen-component-roots.test.ts`

Expected: PASS.

Commit:
`rtk git add packages/convex/confect packages/convex/convex packages/convex/test && rtk git commit -m "chore: regenerate Confect v10 output"`

### Task 11: Port Factory Generators, Seed, and Projections

**Files:**

- Modify: `tooling/generators/src/customer-runtime.ts`,
  `tooling/generators/src/index.ts`, `tooling/generators/src/workflow-files.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`,
  `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify/regenerate: `examples/saas-application/seed/source/**`
- Modify: relevant generator snapshot/contract fixtures identified by the named
  test.

**Interfaces:**

- Consumes: canonical migrated factory source and `check:confect-effect-compat`
  vocabulary.
- Produces: new customer source strings/manifests using v10/v4 APIs and exact
  pins; no current v9 command or v3 import.

- [ ] **Step 1: Change generator expectations first**

Assert projected package metadata contains exact cohort pins and no
platform/cluster; projected checks contain `check:confect-effect-compat`;
generated source uses Result/Exit/new Schema APIs and never `repos/*`.

- [ ] **Step 2: Run focused generator tests red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/generators/src/blueprints/saasApplication.test.ts`

Expected: FAIL on old emitted source/pins/gate name.

- [ ] **Step 3: Update generator sources, then regenerate owned seed output**

Change source templates rather than seed output. Run the canonical seed command:

`rtk fnm exec --using=22.23.2 pnpm template:seed-demo`

Review every output change and rerun the same command; expected no second-run
diff.

- [ ] **Step 4: Verify and commit**

Run the named generator test plus:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir tooling/generators typecheck`

Run
`rtk rg '9\.1\.5|3\.21\.4|check:confect-v9|effect/Either|decodeUnknownEither' tooling/generators examples/saas-application/seed/source`;
expected zero current-contract matches.

Commit:
`rtk git add tooling/generators examples/saas-application/seed/source && rtk git commit -m "refactor: emit Confect 10 customer sources"`

### Task 12: Align Proofs, Gate Registrations, and Active Documentation

**Files:**

- Rename: `tooling/effectified-api-proof/confect-v9-proof.ts` →
  `tooling/effectified-api-proof/confect-effect-compat-proof.ts`
- Modify: `tooling/effectified-api-proof/package.json`, `package.json`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `tooling/agent-pack/src/nodeAdapters.test.ts`,
  `tooling/agent-pack/src/preflightProbe.test.ts`
- Modify: `tooling/release-seal.test.mts`,
  `tooling/release/src/customerTarget/ownership.test.ts`
- Modify: `docs/template/confect-effect-guide.md`, `docs/rule-coverage.md`,
  `docs/template/quickstart.md`, `docs/template/app-factory-guide.md`,
  `docs/template/customer-target-contract.md`, and active
  compatibility/status/generated-instruction docs found by the stale scan.

**Interfaces:**

- Consumes: migrated source/generator vocabulary.
- Produces: one version-neutral gate/proof name and truthful candidate-stage
  docs; public quickstart remains alpha.2 until authorized rollout.

- [ ] **Step 1: Add stale-vocabulary coverage**

Extend compatibility tests to scan active code/docs while excluding sealed
releases and historical plans. Permit alpha.2 only where it accurately describes
the still-public create default. Reject active `check:confect-v9`,
`confect-v9-proof`, current v9/v3 compatibility claims, or instructions using
removed APIs.

- [ ] **Step 2: Run tests red**

Run these exact focused commands:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/quality/check-confect-effect-compat.test.mts`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/generators/src/blueprints/saasApplication.test.ts`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/cli test:customer-cli-runtime`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/agent-pack/src/nodeAdapters.test.ts tooling/agent-pack/src/preflightProbe.test.ts`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/release/src/customerTarget/ownership.test.ts tooling/release-seal.test.mts`

Expected: FAIL on stale registrations and docs.

- [ ] **Step 3: Rename all registrations and update proofs/docs**

Port the proof to Result/Exit/v4 Schema semantics. Document the exact cohort,
unstable import boundary, separate Confect vs connected Convex codegen, absence
of `repos/*` in customers, and the candidate truth: canonical source is v10/v4
while public `maestro create` still selects alpha.2 until alpha.3 is sealed and
authorized.

- [ ] **Step 4: Verify and commit**

Run all Step 2 commands plus:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm check:effect-diagnostics`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm check:confect-contracts`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm check:confect-manifest`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir tooling/effectified-api-proof typecheck`

Run
`rtk rg 'check:confect-v9|confect-v9-proof|effect/Either|decodeUnknownEither' package.json apps packages tooling docs/template docs/rule-coverage.md examples --glob '!releases/**' --glob '!docs/superpowers/**'`;
expected zero matches.

Commit:
`rtk git add package.json tooling apps/cli/src/factory/customerCliRuntime.test.ts docs && rtk git commit -m "docs: align Confect Effect compatibility guidance"`

### Task 13: Validate an Injected Candidate Customer Composition

**Files:**

- Modify: `apps/cli/src/factory/createComposition.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `tooling/release/src/customerTarget/finalFilesystem.test.ts`
- Create only if no existing helper fits:
  `apps/cli/src/factory/candidateComposition.test.ts`

**Interfaces:**

- Consumes: a `CustomerCompositionSource` containing repository root, manifest
  path/checksum, tag, source commit, blueprint/authority paths and checksums.
- Produces: `createCustomerCreateComposition(source = ALPHA_2_SOURCE)`;
  production default remains immutable alpha.2, tests may inject a candidate
  source rooted at the current checkout.

- [ ] **Step 1: Write a candidate-injection acceptance test**

Add a test-only `buildCandidateReleaseFixture` beside the acceptance test. It
must use `buildCustomerOwnershipInventory` and the real blueprint plan to write
a temporary ownership manifest/blueprint/authority trio whose checksums are
computed from the current committed source; it must not copy alpha.2 checksums
or write under `releases/`. Feed those paths and checksums through the injected
composition, materialize an untouched customer target, and assert exact pins,
the new gate name, no `repos/*`, no old APIs, and candidate source identity.
Also assert a zero-argument call still selects alpha.2.

- [ ] **Step 2: Run the acceptance test red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/cli exec vitest run src/factory/candidateComposition.test.ts`

Expected: FAIL because composition constants are not injectable.

- [ ] **Step 3: Add the narrow injection seam**

Define:

```ts
export type CustomerCompositionSource = Readonly<{
  repositoryRoot: string;
  manifestPath: string;
  ownershipManifestChecksum: `sha256:${string}`;
  tag: string;
  sourceCommit: string;
  blueprintManifestPath: string;
  blueprintManifestChecksum: `sha256:${string}`;
  blueprintAuthorityManifestPath: string;
  blueprintAuthorityManifestChecksum: `sha256:${string}`;
}>;
```

Export `ALPHA_2_SOURCE` with the existing constants and allow
`createCustomerCreateComposition(source = ALPHA_2_SOURCE)`. Do not change a
single alpha.2 value.

- [ ] **Step 4: Materialize and run offline focused customer checks**

Use the Vitest `mkdtemp` fixture, never copy fixes into the output. The test
must run `pnpm install --offline --frozen-lockfile --ignore-scripts`,
`pnpm check:confect-effect-compat`, `pnpm check:confect-contracts`,
`pnpm check:confect-manifest`, `pnpm --dir packages/convex typecheck`, and
`pnpm --dir packages/convex confect:codegen` in the untouched target. Invoke the
outer acceptance test through the focused host slot and Node 22; do not run
connected Convex codegen.

- [ ] **Step 5: Verify default stability and commit**

Run:

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/cli test:create-root-integration`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/cli test:customer-cli-runtime`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm --dir apps/cli exec vitest run src/factory/candidateComposition.test.ts`

`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/release/src/customerTarget/finalFilesystem.test.ts`

Expected: candidate v10/v4 passes and zero-argument production composition
remains alpha.2.

Commit:
`rtk git add apps/cli/src/factory tooling/release/src/customerTarget && rtk git commit -m "test: validate candidate customer composition"`

### Task 14: Prepare Exact-Head and Connected Gate Handoff

**Files:**

- Modify only if required by discovered failures: authored source or generator
  ownership files from earlier tasks.
- Create:
  `docs/superpowers/plans/2026-07-30-confect-v10-effect-v4-gate-evidence.md`

**Interfaces:**

- Consumes: locally green focused suite and clean deterministic generated
  output.
- Produces: exact commit SHA, focused evidence, connected gate command list, and
  explicit external blockers; no deployment or broad local run.

- [ ] **Step 1: Run the bounded focused verification matrix**

Run each package typecheck/test named in Tasks 1–13 through a focused host slot,
serially. Run non-test scans/format checks without a slot. Do not run
`just verify`, `pnpm verify`, broad `pnpm test`, or `check:generators` locally.

- [ ] **Step 2: Check generated determinism and clean ownership**

Re-run Confect-only codegen and candidate materialization; expected no
second-run factory diff and untouched target checks PASS. Confirm
`git diff 57f912ab^..HEAD -- releases/v0.2.0-alpha.2` is empty.

- [ ] **Step 3: Record deferred connected/exact-head gates**

Write the exact HEAD SHA and commands owned by the controlled lane: connected
Convex codegen/`check:generators`, broad repository verification, build, launch
acceptance, and PR CI. State whether each was run, passed, or is externally
queued; never imply an unrun gate passed.

- [ ] **Step 4: Commit evidence**

Run Prettier on the evidence file, then:

`rtk git add docs/superpowers/plans/2026-07-30-confect-v10-effect-v4-gate-evidence.md && rtk git commit -m "docs: record migration gate evidence"`

### Task 15: Establish Alpha.3 Readiness Without Publishing or Switching Defaults

**Files:**

- Modify: `tooling/release-seal.test.mts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `docs/template/template-release-process.md`
- Create: `docs/superpowers/plans/2026-07-30-alpha-3-readiness.md`
- Explicitly do not create/modify: `releases/v0.2.0-alpha.3/**`, public tag
  refs, or production `ALPHA_2_SOURCE` defaults.

**Interfaces:**

- Consumes: exact merged migration candidate and release-seal dry-run/test APIs.
- Produces: tested readiness contract for future `v0.2.0-alpha.3` /
  `maestro-template-v0.2.0-alpha.3`, plus a stop-point checklist requiring
  explicit publish/default-switch authority.

- [ ] **Step 1: Add alpha.3 dry-run expectations**

Test that the release tool would reject a dirty/non-exact head, never overwrite
alpha.2, derives a new alpha.3 directory/tag/checksums, and requires the
published-tag materialization check before public-default advancement. Mock all
network/tag mutations; do not invoke publish.

- [ ] **Step 2: Run release tests red**

Run:
`rtk host-test-slot --class focused fnm exec --using=22.23.2 pnpm exec vitest run tooling/release-seal.test.mts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/customerCliRuntime.test.ts`

Expected: FAIL until release readiness behavior/documentation represents alpha.3
as a new immutable version.

- [ ] **Step 3: Implement only non-mutating readiness support**

Add/adjust pure validation or dry-run test seams needed to describe alpha.3. Do
not execute seal, create tags, write `releases/v0.2.0-alpha.3`, change
quickstart, or replace alpha.2 constants. The readiness doc must list the later
authorized sequence: merge exact head → controlled connected/broad gates → seal
alpha.3 → publish immutable tag/archive → verify checksums/materialization →
reviewed default composition/quickstart update → published-tag untouched create
acceptance.

- [ ] **Step 4: Verify stop boundary and commit**

Run Step 2 tests; expected PASS. Run:

`rtk git diff origin/main -- releases/v0.2.0-alpha.2 releases/v0.2.0-alpha.3 apps/cli/src/factory/createComposition.ts docs/template/quickstart.md`

Expected: no alpha.2 bytes changed, no alpha.3 release directory, and production
default/quickstart still alpha.2 (the injection seam may alter source structure
without altering values).

Commit:
`rtk git add tooling/release-seal.test.mts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/customerCliRuntime.test.ts docs/template/template-release-process.md docs/superpowers/plans/2026-07-30-alpha-3-readiness.md && rtk git commit -m "test: establish alpha 3 release readiness"`

## Final Local Acceptance Checklist

- [ ] `rtk git log --oneline origin/main..HEAD` still contains `57f912ab` and
      `75e55098` in ancestry.
- [ ] Exact cohort and peer checks pass; no active v3-only platform/cluster
      package or stale v9 gate remains.
- [ ] Domain Result and parser Exit migrations have separate tests and zero
      removed authored API imports.
- [ ] Manifest OpenAPI 3.1 / JSON Schema 2020-12 goldens pass.
- [ ] Confect-only codegen is deterministic and preserves Maestro/Convex-owned
      roots.
- [ ] Factory generators and untouched injected candidate emit and validate
      v10/v4 without manual repair.
- [ ] Alpha.2 is byte-stable; no alpha.3 artifact/tag was published; no public
      default or deployment changed.
- [ ] Unrun connected/broad exact-head gates are named as external handoff
      items, not reported green.
