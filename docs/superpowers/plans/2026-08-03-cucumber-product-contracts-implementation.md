# Cucumber Product Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`
> (recommended) or `executing-plans` to implement this plan task-by-task. Keep
> the checkbox state in this file current and use a fresh isolated worktree for
> each pull request.

**Goal:** Make reviewed Gherkin the sole human-maintained behavioral contract
for Maestro-built products, execute every admitted contract against the built
browser and built CLI on one real backend, and let only a strict protected
Cucumber Messages verdict authorize the completion claim.

**Approved design:**
[`2026-08-02-cucumber-product-contracts-design.md`](../specs/2026-08-02-cucumber-product-contracts-design.md)
at commit `d3c551215`.

**Implementation baseline:** Start every implementation branch from protected
`origin/main`. The repository snapshot used to write this plan was
`bcf39c9b54a2e4565f8e531c036fa233f553304d`; re-read protected main before each
task and record its immutable base SHA in the pull request. Do not build from
the older design branch.

**Architecture:** Official Cucumber owns parsing, compilation, step matching,
execution, status semantics, and Messages. Existing Maestro registration,
principal, process-supervision, upgrade, release, and Woodpecker authorities
gain only the policy Cucumber cannot provide: exhaustive public-surface
inventory, lifecycle darkness, exact source/execution equality, real runtime
identity, and protected merge-candidate binding. No second BDD protocol, receipt
service, dashboard, retry layer, sharding system, or parallel release authority
is introduced.

**Tech stack:** Node 22, TypeScript, Effect Schema, Convex, Confect,
`@cucumber/cucumber@13.2.0`, `@cucumber/gherkin@41.0.0`,
`@cucumber/messages@34.0.1`, Playwright, pnpm, Vitest, Woodpecker, GitHub merge
queue.

## Scope Guard

- This plan changes `maestro-template-saas-ui` first and consumes the sealed
  result in Maestro as one downstream pilot. It does not redesign Brain.
- Woodpecker is the sole blocking CI authority. Qlty stays advisory under its
  30-second cap. Buildkite, Fabro, and Graphite are not restored or invoked.
- Existing process supervision, API-key crypto/indexes, principal union,
  feature-policy deny boundary, staged upgrade transaction, customer release
  materializer, and deploy authority are extended in place.
- Candidate application/build/runtime processes are untrusted. Cucumber,
  protected steps and drivers, Messages storage, tuple verification, and status
  posting stay outside candidate namespaces.
- No product slice may claim completion. Slices retain `@assembling`, run all
  journeys already admitted on protected main, and keep newly activation-owned
  entrypoints dark. Only a final current-main pull request may flip a Feature
  already assembling on protected main to `@admitted`.
- An admission pull request cannot change contract-control code. Control-plane
  changes and lifecycle flips use separate pull requests and merge-queue batch
  size one.
- Feature prose never owns routes, selectors, auth rules, shell commands, or
  implementation paths. Stable coverage tags join Features to generated
  technical authority.
- Broad verification runs on `maestro-worker` after a commit. If unavailable,
  run broad local commands only through `host-test-slot`; focused Vitest and
  documentation checks use the same host policy.

## Work Classification

Every task is one of:

- `template-gap`: reusable capability absent from the template;
- `pattern-instance`: extend one existing authority instead of making a new one;
- `fixture-to-real`: replace fake or structural evidence with a real product
  boundary.

## Program Invariants

1. Checked-in UTF-8/LF `.feature` bytes are the only manually maintained
   behavioral contract bytes.
2. Each Feature has one stable `@journey_*` tag and one Feature-level lifecycle
   tag. Reserved tags cannot be shadowed below Feature.
3. The public-surface inventory is a generated bijection over every reachable
   public registration and action discriminant. New entries default to
   `auth_deny_all`.
4. Generated UI and server guards keep activation-owned assembling or suspended
   entrypoints dark. Emergency policy may disable, never enable.
5. HTTP, CLI, API, MCP, session, and internal callers adapt verified identities
   into one principal union. Caller tenant data is only a target assertion.
6. The canonical CLI invokes the real authenticated HTTP transport
   asynchronously; credentials never enter argv.
7. Expected Pickles and steps come from the pinned Gherkin compiler. Runtime IDs
   are followed only inside one Messages stream and are never persisted as
   stable identity.
8. Every expected Pickle, Outline row, Pickle step, scenario hook, and run hook
   executes exactly once at attempt zero and passes.
9. A trusted driver records Action and Outcome observations only after a real
   product interaction or actor-visible assertion succeeds.
10. Web, CLI, backend, source, artifact, and merge-candidate identities agree
    through independently observed values.
11. A zero admitted inventory is an explicit static result; it cannot be called
    product completion and does not create synthetic Messages.
12. Old journey and fake-proof machinery is deleted only after the replacement
    reference fixture and every mutation are green.

## Quality Targets

- Product scenarios assert actor-visible behavior through accessible roles,
  labels, and text; CSS selectors, component props, handlers, and fixture state
  are not outcome oracles.
- Static checks enforce objective Gherkin structure only. Human product review
  owns domain language, concrete examples, one primary action, observable
  outcomes, useful Backgrounds, and unresolved business questions; no LLM or
  prose score enters the execution verdict.
- Loading and mutation progress remain visible and non-destructive; empty state
  does not imply success; ready/read and ready/edit are distinguishable; denied
  and failed mutations preserve prior durable state.
- Every authority-bearing control has keyboard/focus behavior inherited from the
  existing UI kit, an unambiguous accessible name, and a server guard behind its
  UI darkness guard.
- Build Pack review shows exact draft bytes/digest, edit state, awaiting-review,
  stale approval, approval success/failure, export retry, and exported
  provenance without a second contract copy.
- Reference and Brain scenarios cover UI mutation success/failure, CLI
  success/failure, cross-surface read-after-write, signed-out, read-only, and
  foreign-tenant states with synthetic data.
- Diagnostics redact credentials and customer content while retaining the
  smallest actionable file/line, step, surface, identity, or sandbox finding.

## Test Plan

| Surface                | Required behavior states                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Static contract check  | malformed, assembling unresolved, admitted resolved, suspended, lifecycle downgrade, zero admitted                                               |
| UI registration/action | hidden while assembling/suspended, visible admitted, emergency-disabled, mutation success, mutation failure                                      |
| Authenticated backend  | session/API-key success, missing credential, insufficient role/scope, foreign tenant, caller-tenant mismatch                                     |
| Built CLI              | local help/schema, external success, 401, 403, validation error, backend unavailable, redacted output                                            |
| Build Pack review      | loading, no draft, draft read, draft edit, awaiting review, stale CAS, approve success/failure, export success/retry                             |
| Acceptance runtime     | startup, readiness, zero inventory, complete run, failed step/hook, signal cleanup, resource limit, evidence tamper                              |
| Release                | staging-proof absent/present, component mismatch, production re-observation, compatible rollback, incompatible rollback, emergency deny retained |

Each task names the smallest focused test that first turns red. The full
generated-app fixture and mutation gauntlet are integration evidence, not
substitutes for those focused checks.

## Canonical Interfaces

These signatures are shared across tasks. Change them only in a dedicated
control-plane pull request with matching tests and plan amendment.

```ts
export type ContractLifecycle = "assembling" | "admitted" | "suspended";
export type ContractTransport = "ui" | "cli" | "api" | "mcp" | "webhook";
export type StablePickleKey = `pickle_sha256:${string}`;
export type StableStepKey = `step_sha256:${string}`;

export type PublicSurface = {
  readonly id: string;
  readonly transport: ContractTransport;
  readonly coverageTag: `@covers_${string}`;
  readonly activationJourneyId?: `journey_${string}`;
  readonly authPolicyId: `auth_${string}`;
  readonly authority: {
    readonly kind:
      | "route"
      | "ui-action"
      | "convex-function"
      | "http-route"
      | "command"
      | "trigger"
      | "webhook";
    readonly registrationLocator: string;
    readonly actionDiscriminant?: string;
  };
};

export type ContractSource = {
  readonly path: string;
  readonly uri: string;
  readonly bytes: string;
  readonly sha256: `sha256:${string}`;
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
};

export type ExpectedStep = {
  readonly key: StableStepKey;
  readonly index: number;
  readonly keywordType: string;
  readonly text: string;
  readonly argumentDigest?: `sha256:${string}`;
  readonly astLocation: { readonly line: number; readonly column: number };
};

export type ExpectedPickle = {
  readonly key: StablePickleKey;
  readonly sourceSha256: `sha256:${string}`;
  readonly uri: string;
  readonly scenarioLocation: { readonly line: number; readonly column: number };
  readonly examplesRowLocation?: {
    readonly line: number;
    readonly column: number;
  };
  readonly tags: readonly string[];
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
  readonly transports: readonly ContractTransport[];
  readonly coverageTags: readonly `@covers_${string}`[];
  readonly steps: readonly ExpectedStep[];
};

export type SelectionManifest = {
  readonly schemaVersion: 1;
  readonly mode: "authoritative" | "focused";
  readonly featurePaths: readonly string[];
  readonly pickleKeys: readonly StablePickleKey[];
  readonly focusedJourneyId?: `journey_${string}`;
};

export type RuntimeManifest = {
  readonly schemaVersion: 1;
  readonly checkoutSha: string;
  readonly webArtifactDigest: `sha256:${string}`;
  readonly cliArtifactDigest: `sha256:${string}`;
  readonly backendInputDigest: `sha256:${string}`;
  readonly backendDeploymentId: string;
  readonly backendStartNonce: string;
};
```

The canonical public-authority key is the stable serialization of
`(authority.kind, authority.registrationLocator, authority.actionDiscriminant, transport, authPolicyId)`.

## Dependency And Pull-Request Graph

```text
PR C1 pinned Cucumber/config
  -> C2 public/auth authority
  -> C3 exhaustive registrations/provenance
  -> C4 lifecycle compiler + darkness
  -> C5 principal/auth repair
  -> C6 external CLI HTTP
  -> C7 exact contract inventory
  -> C8 strict Messages verifier
  -> C9 trusted observations/runtime identity
  -> C10 isolated controller/runtime
  -> C11 generated reference product
  -> C12 mutation gauntlet
       -> F1 create/contracts-add
       -> F2 generator cleanup/provenance
       -> B1 Build Pack human review
       -> U1 existing-app audit upgrade
       -> R1 immutable release manifests
       -> W1 protected Woodpecker cutover
       -> P1 immutable Brain pilot release
       -> M0 Maestro contracts-audit install
       -> M1 Maestro Brain assembling slices
       -> M2 Brain admission-only PR
       -> D1 old machinery deletion
       -> D2 alpha.3 seal
```

`C1` through `C12` are control-plane changes and land one at a time. `F1`, `F2`,
`B1`, `U1`, and `R1` may be prepared in parallel only after `C12`, but they
still merge against current main and rerun all admitted contracts. `W1` is the
only external authority cutover. `P1` seals a non-default immutable pilot
release; `M0` installs its manifest-declared audit closure into Maestro. `M1` is
a bottom-up sequence of ordinary GitHub branches with the new journey
assembling; `M2` is rebased onto current protected main and contains only the
lifecycle flip. Any repair becomes another assembling slice before a fresh M2.

## Per-Task Completion Protocol

For every task:

1. Add the named behavioral test and run it red for the stated reason.
2. Implement only the named interface using existing authorities.
3. Run the focused command green.
4. Run the task's integration command green.
5. Commit only that task's files and record the immutable commit SHA.
6. Open a normal GitHub pull request with its dependency as base only when the
   dependency is not yet on main; merge bottom-up.
7. After merge, rerun the next task from current `origin/main`.

---

### Task 1: Pin Official Cucumber And Freeze Its Configuration

**Class:** `template-gap`  
**PR:** `C1`  
**Depends on:** protected main only

**Files:**

- Create: `cucumber.cjs`
- Create: `tooling/acceptance/check-contracts.mts`
- Create: `tooling/acceptance/check-contracts.test.mts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/template-core/package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

```ts
export type CheckedCucumberConfiguration = {
  readonly requireModule: readonly ["tsx/cjs"];
  readonly require: readonly [
    "features/support/**/*.ts",
    "features/step_definitions/**/*.ts",
  ];
  readonly retry: 0;
  readonly parallel: 0;
};

export function validateCucumberConfigurationSource(
  source: string,
):
  | { readonly ok: true; readonly value: CheckedCucumberConfiguration }
  | { readonly ok: false; readonly findings: readonly string[] };
```

- [ ] **Step 1: Write the failing configuration tests.** In
      `check-contracts.test.mts`, prove the exact four-key object and two exact
      support globs pass. Prove `features/**/*.ts`, any `*.test.ts` below
      `features/`, `paths`, `tags`, `name`, `format`, `retry: 1`, `parallel: 1`,
      an altered TS loader, and every unknown key fail with the offending
      key/value.

```ts
expect(validateCucumberConfigurationSource(validSource)).toEqual({
  ok: true,
  value: validConfig,
});
expect(
  validateCucumberConfigurationSource(sourceWithTagsSelector),
).toMatchObject({ ok: false, findings: [expect.stringMatching(/tags/)] });
```

- [ ] **Step 2: Run the focused test red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/check-contracts.test.mts`

  Expected: FAIL because `check-contracts.mts` does not exist.

- [ ] **Step 3: Add the four-key CommonJS profile and validator.** Export only
      `default` from `cucumber.cjs`:

```js
module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};
```

The validator never imports candidate JavaScript. It reads the file as text and
requires exact equality with the protected canonical source above, so extra
executable code, inherited keys, comments, selectors, or value changes fail
before Cucumber starts. It separately parses root `package.json` as JSON and
checks exact package versions. Install the three Cucumber packages at exact
versions; declare Gherkin/Messages in `template-core` for its pure compiler
subpath and keep the Cucumber runner at the repository root. Do not add another
Gherkin parser or reporter. The protected runner passes the protected-main
config path explicitly; it never relies on cwd auto-discovery of a candidate
config.

- [ ] **Step 4: Add the initial command surface.** Add
      `acceptance:check = "tsx tooling/acceptance/check-contracts.mts"` and a
      `check-contracts` Just recipe. Register it in the gate-definition
      authority, but do not add `pnpm acceptance` until the real runtime exists.

- [ ] **Step 5: Run focused and manifest checks green.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/check-contracts.test.mts`

  Run: `rtk pnpm acceptance:check`

  Expected: both PASS and print the pinned versions plus the exact accepted
  configuration keys.

- [ ] **Step 6: Commit.**

  ```bash
  rtk git add cucumber.cjs tooling/acceptance/check-contracts.mts tooling/acceptance/check-contracts.test.mts package.json pnpm-lock.yaml packages/template-core/package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "build: pin cucumber contract runtime"
  ```

**Unlock:** Cucumber APIs are stable enough for every expected/runtime model; no
contract is admitted by this task.

---

### Task 2: Define One Public-Surface And Auth-Policy Authority

**Class:** `pattern-instance`  
**PR:** `C2`  
**Depends on:** `C1`

**Files:**

- Create: `packages/template-core/src/publicSurface.ts`
- Create: `packages/convex/confect/capabilities/_kit/authPolicies.ts`
- Create: `packages/convex/test/public-surface-authority.test.ts`
- Modify: `packages/template-core/package.json`
- Modify: `packages/template-core/src/index.ts`
- Modify: `tooling/confect-manifest/src/index.ts`
- Modify: `tooling/confect-manifest/src/index.test.ts`
- Modify: `packages/convex/confect/access/roles.ts`
- Modify: `packages/convex/confect/headless/auth.ts`

**Interfaces:**

```ts
export type AuthPolicy = {
  readonly id: `auth_${string}`;
  readonly credential:
    | "public"
    | "session"
    | "api-key"
    | "owner-token"
    | "webhook-signature"
    | "deny-all";
  readonly principalKind: "anonymous" | "user" | "apiKey" | "system";
  readonly tenantAuthority: "none" | "membership" | "principal-workspace";
  readonly minimumRole?: Role;
  readonly requiredScopes: readonly ApiKeyScope[];
};

export const authPolicies: Readonly<Record<AuthPolicy["id"], AuthPolicy>>;
export const authDenyAll: AuthPolicy;
export function compareAuthPolicyStrength(
  base: AuthPolicy,
  candidate: AuthPolicy,
): "same" | "stronger" | "weaker" | "incomparable";
```

- [ ] **Step 1: Write authority tests red.** Cover `PublicSurface` decoding,
      duplicate IDs, duplicate canonical authority keys, unknown policies,
      invalid role/scope literals, and auth changes that remove tenant
      authority, lower a role, remove a scope, or switch from a credential to
      public access.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/public-surface-authority.test.ts`

  Expected: FAIL because the public surface and policy modules do not exist.

- [ ] **Step 3: Add the shared technical type and actual policy registry.**
      Re-export existing `Role` and `ApiKeyScope` types; do not introduce string
      copies. Define policy entries next to the validators they describe,
      including `auth_deny_all`, current WorkOS/session membership, API-key
      scope, owner-token, Dodo/Postmark webhook, and signed unsubscribe
      mechanisms. A surface with no explicit policy receives `auth_deny_all`
      during generation.

- [ ] **Step 4: Extend Confect manifest entries without changing behavior.** Add
      stable surface registration metadata to `ContractFunctionManifest` while
      retaining its existing operation/schema fields. One operation reachable by
      UI session and API-key CLI emits two `PublicSurface` records because the
      transport/auth keys differ.

- [ ] **Step 5: Prove closed strength comparison.** The comparator handles only
      the finite canonical role/scope/credential sets. `incomparable` is treated
      as security review, never as safe. Add property tests for reflexivity and
      for scope/role removal never returning `same` or `stronger`.

- [ ] **Step 6: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/public-surface-authority.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/confect-manifest test`

  ```bash
  rtk git add packages/template-core/package.json packages/template-core/src/publicSurface.ts packages/template-core/src/index.ts packages/convex/confect/capabilities/_kit/authPolicies.ts packages/convex/confect/access/roles.ts packages/convex/confect/headless/auth.ts packages/convex/test/public-surface-authority.test.ts tooling/confect-manifest/src/index.ts tooling/confect-manifest/src/index.test.ts
  rtk git commit -m "feat: define public surface authority"
  ```

**Unlock:** Every generated exposure can name one real auth policy. No route or
operation is considered exhaustively inventoried yet.

---

### Task 3: Generate An Exhaustive Public-Entrypoint Inventory

**Class:** `template-gap`  
**PR:** `C3`  
**Depends on:** `C2`

**Files:**

- Create: `tooling/confect-manifest/src/publicSurfaceGeneration.ts`
- Create: `tooling/confect-manifest/src/publicSurfaceGeneration.test.ts`
- Generate:
  `packages/template-core/src/generated/public-surfaces.generated.json`
- Generate: `packages/template-core/src/generated/publicSurfaces.ts`
- Generate:
  `packages/template-core/src/generated/template-contracts-legacy-baseline.json`
- Modify: `packages/template-core/src/publicSurface.ts`
- Modify: `tooling/confect-manifest/src/generate.ts`
- Modify: `tooling/confect-manifest/src/check.ts`
- Modify: `tooling/confect-manifest/src/index.ts`
- Modify: `packages/template-core/package.json`
- Modify: `packages/convex/confect/http.ts`
- Modify: `apps/web/src/navigation/reference-app-routes.ts`
- Modify generated: `apps/web/src/routeTree.gen.ts`
- Modify generated: `packages/convex/convex/_generated/api.d.ts`
- Modify: `tooling/quality/check-system-topology.mts`
- Modify: `tooling/quality/check-system-topology.test.mts`
- Modify: `tooling/quality/check-headless-surface-contract.mts`
- Modify: `tooling/quality/check-headless-surface-contract.test.mts`

**Interfaces:**

```ts
export type DiscoveredPublicAuthority = PublicSurface["authority"] & {
  readonly transport: PublicSurface["transport"];
};

export function discoverPublicAuthorities(
  root: string,
): readonly DiscoveredPublicAuthority[];
export function generatePublicSurfaceInventory(input: {
  readonly discovered: readonly DiscoveredPublicAuthority[];
  readonly registered: readonly PublicSurface[];
}): { readonly surfaces: readonly PublicSurface[] };

export type ContractsLegacyBaseline = {
  readonly schemaVersion: 1;
  readonly capturedFromInventoryDigest: `sha256:${string}`;
  readonly surfaces: readonly {
    readonly id: string;
    readonly authorityKey: string;
  }[];
};
```

- [ ] **Step 1: Add failing discovery fixtures.** The test fixture contains a
      generated TanStack route, registered UI action, generated Confect
      operation, raw public Convex function, `httpRouter` route, command action
      discriminant, workflow/job trigger, webhook, CLI, API, and MCP exposure.
      For each mechanism, prove unregistered, duplicate, and one-way-only
      mappings fail.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/confect-manifest exec vitest run src/publicSurfaceGeneration.test.ts`

  Expected: FAIL because discovery/generation is absent.

- [ ] **Step 3: Replace manual Confect imports with deterministic discovery.**
      Recursively discover production `*.spec.ts` manifests, import them in
      sorted repository-relative order under `tsx`, merge their schema
      registries, and derive generated Convex ref locators. Delete the four
      hardcoded spec imports and `generatedRefModules` map from `generate.ts`.
      Duplicate operation IDs or missing refs remain fatal.

- [ ] **Step 4: Generate the bijection.** Parse the already generated route tree
      and Convex API declarations, import registered
      route/action/command/trigger metadata, and enumerate `httpRouter`
      registrations. Normalize each into the canonical authority key, compare
      both directions with registered `PublicSurface` records, sort by surface
      ID, then emit JSON and a typed TS projection from the same in-memory
      value. Normalize the existing Confect surface name `web` to the behavioral
      transport `ui` in this single generator; every other public transport
      keeps its canonical spelling. Confect `workflow`/`internal` are not public
      transports by themselves; only an externally registered trigger becomes a
      public entrypoint with its real transport and auth policy.

- [ ] **Step 5: Make raw bypasses red.** Extend system-topology and headless
      checks so a public Convex export, HTTP route, action discriminant, UI
      mutation adapter, command, trigger, webhook, API, CLI, or MCP registration
      missing from the generated inventory fails with its locator. Forbid
      customer UI mutation imports except through the registered action adapter;
      navigation remains a route surface.

- [ ] **Step 6: Freeze the template's one-time adoption baseline.** Before
      enforcing coverage over the already-shipping template, write its sorted,
      content-addressed current surface set to
      `template-contracts-legacy-baseline.json`. The gate compares every
      candidate with this frozen file and rejects growth or authority-key
      changes. Existing entries stay available and explicitly unadmitted; every
      surface introduced after this commit needs contract/auth provenance and
      darkness immediately. Task 14 either covers or removes every baseline
      entry, deletes the file, and enables full enforcement. Do not copy this
      migration baseline into a newly created customer app.

- [ ] **Step 7: Run generation and drift checks.**

  Run: `rtk pnpm confect:manifest`

  Run: `rtk pnpm check:confect-manifest`

  Run: `rtk pnpm check:system-topology`

  Run: `rtk pnpm check:headless-surface-contract`

  Expected: PASS; deleting any discovered registration from the generated
  inventory makes at least one check red.

- [ ] **Step 8: Commit generated and source authority together.**

  ```bash
  rtk git add tooling/confect-manifest packages/template-core/src/publicSurface.ts packages/template-core/src/generated packages/template-core/package.json packages/convex/confect/http.ts packages/convex/convex/_generated/api.d.ts apps/web/src/navigation/reference-app-routes.ts apps/web/src/routeTree.gen.ts tooling/quality/check-system-topology.mts tooling/quality/check-system-topology.test.mts tooling/quality/check-headless-surface-contract.mts tooling/quality/check-headless-surface-contract.test.mts
  rtk git commit -m "feat: generate exhaustive public surface inventory"
  ```

**Unlock:** Static checks know every public authority boundary. New actions
cannot hide inside a registered shared route.

---

### Task 4: Compile Lifecycle, Coverage, And Darkness

**Class:** `template-gap`  
**PR:** `C4`  
**Depends on:** `C3`

**Files:**

- Create: `tooling/acceptance/contract-inventory.ts`
- Create: `tooling/acceptance/contract-inventory.test.ts`
- Create: `packages/template-core/src/productContract.ts`
- Create: `packages/template-core/src/productContract.test.ts`
- Modify: `packages/template-core/package.json`
- Generate: `packages/template-core/src/generated/admittedJourneys.ts`
- Modify: `tooling/acceptance/check-contracts.mts`
- Modify: `tooling/acceptance/check-contracts.test.mts`
- Modify: `packages/convex/confect/capabilities/_kit/surfaces.ts`
- Create: `packages/convex/confect/capabilities/_kit/admissionGuard.ts`
- Create: `packages/convex/test/admission-guard.test.ts`
- Create: `apps/web/src/navigation/admitted-action.ts`
- Create: `apps/web/src/navigation/admitted-action.test.ts`
- Modify: `packages/convex/confect/ops/flags.impl.ts`
- Modify: `tooling/quality/check-auth-demo-bypass.mts`
- Modify: `tooling/quality/check-auth-demo-bypass.test.mts`

**Interfaces:**

```ts
export type ContractInventory = {
  readonly schemaVersion: 1;
  readonly sources: readonly ContractSource[];
  readonly pickles: readonly ExpectedPickle[];
  readonly admittedPickleKeys: readonly StablePickleKey[];
  readonly journeys: Readonly<Record<string, ContractLifecycle>>;
};

export function compileContractInventory(input: {
  readonly root: string;
  readonly protectedBaseSha: string;
  readonly mode: "authoritative" | "focused" | "static";
}): ContractInventory;

export function requireAdmittedSurface(
  surfaceId: string,
  emergencyDenied: boolean,
): void;
```

- [ ] **Step 1: Write lifecycle/tag/coverage tests red.** Cover one Feature per
      file; exact Feature-level journey/lifecycle tags; reserved-tag placement;
      transport and coverage inheritance; Outline rows; at least one Action and
      one Outcome per Pickle using the official AST `StepKeywordType` (so `And`
      inherits its semantic type); path traversal/collision; duplicate journeys;
      unresolved assembling coverage intent; resolved admitted coverage;
      cross-surface rules; per-entrypoint
      positive/authentication/authorization/tenant denial; and the closed
      transition matrix against an immutable protected-base fixture.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/check-contracts.test.mts`

  Expected: FAIL because inventory/lifecycle compilation is missing.

- [ ] **Step 3: Compile with official Gherkin.** Use
      `generateMessages(bytes, uri, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, { includeSource: true, includeGherkinDocument: true, includePickles: true, newId: IdGenerator.incrementing() })`.
      Stable keys use raw source digest, normalized URI, Scenario/Outline
      location, and Examples-row location; never store the generated IDs. Put
      every ordered Pickle and step projection in `ContractInventory.pickles`;
      no verifier reconstructs an expected projection from keys alone. Put the
      byte-to-AST/Pickle pure compiler in the
      `@maestro-template/template-core/product-contract` subpath; repository
      file discovery, protected-base Git reads, surface policy, and projection
      writes remain in `tooling/acceptance/contract-inventory.ts`. Acceptance,
      Agent Pack, and factory CLI reuse that compiler rather than importing one
      another.

- [ ] **Step 4: Compare only with protected base.** Authoritative mode receives
      the base SHA from the protected controller, reads Features with `git show
  <base>:<path>`, and implements the exact closed transition matrix. Reject a
  candidate-provided SHA, `HEAD^`, absent-to-admitted, admitted deletion or
  demotion, suspended deletion, and admitted ID reuse. A focused run cannot
  produce an authoritative verdict. An assembling Feature with no admitted
  history may be deleted. Retirement removes every activation-owned surface
  only after suspension, while retaining the suspended Feature's journey ID and
  behavioral prose as its permanent tombstone. A suspended-to-admitted change
  joins the full authoritative selection and cannot reuse historical evidence.

- [ ] **Step 5: Generate and enforce darkness.** Emit a sorted const map to
      `admittedJourneys.ts`. UI route/action registration omits activation-owned
      entries unless the map is true. The server wrapper authenticates first,
      then calls `requireAdmittedSurface` before tenant authorization or
      business logic. Existing `featureFlagPolicies` is evaluated after
      generated admission and can only turn true to false.

- [ ] **Step 6: Prove bypass and zero-inventory behavior.** Direct raw Convex or
      HTTP invocation of an assembling operation fails before its handler. An
      inventory with zero admitted Pickles returns `no-admitted-contracts` only
      after every activation-owned non-admitted surface is proven dark; it does
      not invoke Cucumber or create an empty Messages file.

- [ ] **Step 7: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/check-contracts.test.mts packages/convex/test/admission-guard.test.ts apps/web/src/navigation/admitted-action.test.ts`

  Run: `rtk pnpm acceptance:check`

  Run: `rtk pnpm check:auth-demo-bypass`

  ```bash
  rtk git add tooling/acceptance packages/template-core/src/productContract.ts packages/template-core/src/productContract.test.ts packages/template-core/src/generated/admittedJourneys.ts packages/template-core/package.json packages/convex/confect/capabilities/_kit/surfaces.ts packages/convex/confect/capabilities/_kit/admissionGuard.ts packages/convex/confect/ops/flags.impl.ts packages/convex/test/admission-guard.test.ts apps/web/src/navigation/admitted-action.ts apps/web/src/navigation/admitted-action.test.ts tooling/quality/check-auth-demo-bypass.mts tooling/quality/check-auth-demo-bypass.test.mts
  rtk git commit -m "feat: enforce contract lifecycle darkness"
  ```

**Unlock:** Assembling slices can merge safely. Admission still has no runtime
verdict and remains forbidden.

---

### Task 5: Unify Verified Principals And Repair Tenant Identity

**Class:** `pattern-instance`  
**PR:** `C5`  
**Depends on:** `C4`

**Files:**

- Modify: `packages/convex/confect/capabilities/_kit/principal.ts`
- Modify: `packages/convex/confect/capabilities/_kit/workspaceAccess.ts`
- Modify: `packages/convex/confect/access/tenancySchemas.ts`
- Modify: `packages/convex/confect/access/provisioning.ts`
- Modify: `packages/convex/confect/access/provisioning.impl.ts`
- Modify: `packages/convex/confect/access/handlerContext.ts`
- Modify: `packages/convex/confect/editor/sync.ts`
- Modify: `packages/convex/confect/tables/users.ts`
- Modify: `packages/convex/confect/headless/auth.ts`
- Modify: `packages/convex/confect/tables/apiKeys.ts`
- Modify generated: `packages/convex/confect/_generated/**`
- Modify generated: `packages/convex/convex/_generated/**`
- Modify: `packages/convex/confect/manifest/executor.ts`
- Modify: `packages/convex/confect/httpRequest.ts`
- Modify: `packages/convex/confect/http.ts`
- Create: `packages/convex/confect/capabilities/_kit/authorizedDispatch.ts`
- Create: `packages/convex/test/authorized-dispatch.test.ts`
- Modify: `packages/convex/test/headless-auth.test.ts`
- Modify: `packages/convex/test/headless-executor.test.ts`
- Modify: `packages/convex/test/http-docs.test.ts`
- Create:
  `docs/template/migrations/2026-08-03-token-identifier-and-api-principal.md`

**Interfaces:**

```ts
export type AnonymousPrincipal = {
  readonly kind: "anonymous";
  readonly surface: "web" | "api";
};

export type AuthorizedOperationRequest = {
  readonly surfaceId: string;
  readonly operationId: string;
  readonly principal: Principal;
  readonly input: Record<string, JsonValue>;
  readonly idempotencyKey?: string;
  readonly correlationNonce?: string;
};

export async function executeAuthorizedOperation(
  ctx: AuthorizedDispatchContext,
  request: AuthorizedOperationRequest,
): Promise<HeadlessExecutorResult>;

export async function authenticateApiKey(input: {
  readonly authorization: string | undefined;
  readonly policy: AuthPolicy;
  readonly nowMs: number;
  readonly loadByHash: (hash: string) => Promise<ApiKeyRow | null>;
}): Promise<ApiKeyPrincipal>;

export function principalSurfaceFor(
  transport: ContractTransport,
): "web" | "api" | "cli" | "mcp" | "webhook";
```

- [ ] **Step 1: Write red identity and dispatch tests.** Prove two issuers with
      the same subject resolve different users; bare-subject lookup is
      impossible; missing, unknown, revoked, expired, and under-scoped keys
      fail; inactive workspaces/memberships fail; caller workspace mismatch
      fails; and a valid session principal and API-key principal reach the same
      internal operation implementation.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/authorized-dispatch.test.ts test/headless-auth.test.ts test/headless-executor.test.ts`

  Expected: FAIL because dispatch is session-dependent and users are indexed by
  bare subject.

- [ ] **Step 3: Move user identity to issuer-bound authority.** Add required
      `tokenIdentifier` to new user rows and index `by_token_identifier`;
      document and test the deterministic backfill from trusted
      `(issuer, subject)` data. Update every `by_subject` consumer in
      provisioning, handler context, workspace access, and editor sync. Remove
      `by_subject` only after all callers and migration fixtures use the new
      index; authorization also rechecks active organization, workspace,
      membership, and API-key status.

- [ ] **Step 4: Complete API-key principal rows.** Persist principal kind/ID,
      workspace authority, scopes, expiry, status, and creator audit fields.
      Keep `by_key_hash`, hash the presented key once, compare without exposing
      the secret, and derive the entire principal from the row. Do not merge
      `workspaceSlug`, `workspaceId`, actor, or role from request JSON into it.

  Extend the existing `Principal` union with the small anonymous variant for
  genuinely public policies; protected operations reject it through their policy
  before tenant/business logic. Do not represent missing credentials as a fake
  user or system principal.

- [ ] **Step 5: Add one internal dispatch boundary.** Session public functions,
      HTTP, CLI, API, and MCP adapt verified identity into the existing
      `Principal` union and call `executeAuthorizedOperation`. The dispatcher
      resolves the generated surface/auth policy, authenticates, applies
      admission/emergency deny, derives tenant authority, checks role/scope,
      then invokes the existing query/mutation/action adapter. Session users
      derive workspace authority from active membership; API keys derive it from
      the key row. Public Confect refs that reread session auth are not used
      from API-key transports.

  Keep one explicit naming adapter: behavioral/public transport `ui` maps to the
  existing principal surface `web`; API/CLI/MCP map identically; add `webhook`
  only to the system-principal branch. Do not add another principal union or let
  a webhook become a user/API-key principal.

- [ ] **Step 6: Delete the demo tenant oracle.** Remove
      `demoWorkspaceIdsBySlug`, `workspaceSlugToId`, and the
      `acme-demo -> workspace_123` mapping from `httpRequest.ts`. A caller
      workspace field may be checked against the verified principal, never used
      to select authority.

- [ ] **Step 7: Run green and schema checks.**

  Run on a connected codegen worker: `rtk pnpm confect:codegen`

  Run on a connected codegen worker: `rtk pnpm convex:codegen`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/authorized-dispatch.test.ts test/headless-auth.test.ts test/headless-executor.test.ts test/http-docs.test.ts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:schema-migration-notes`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:generators`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:convex`

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add packages/convex/confect/capabilities/_kit/principal.ts packages/convex/confect/capabilities/_kit/workspaceAccess.ts packages/convex/confect/capabilities/_kit/authorizedDispatch.ts packages/convex/confect/access packages/convex/confect/editor/sync.ts packages/convex/confect/tables/users.ts packages/convex/confect/tables/apiKeys.ts packages/convex/confect/headless/auth.ts packages/convex/confect/manifest/executor.ts packages/convex/confect/httpRequest.ts packages/convex/confect/http.ts packages/convex/confect/_generated packages/convex/convex/_generated packages/convex/test docs/template/migrations/2026-08-03-token-identifier-and-api-principal.md
  rtk git commit -m "fix: authenticate every headless principal"
  ```

**Unlock:** Local issuer identities and real CLI API keys can be safe. The built
CLI still uses its old in-process capability path until `C6`.

---

### Task 6: Make Canonical CLI Capabilities Use Authenticated HTTP

**Class:** `fixture-to-real`  
**PR:** `C6`  
**Depends on:** `C5`

**Files:**

- Create: `apps/cli/src/httpCapabilityClient.ts`
- Create: `apps/cli/src/httpCapabilityClient.test.ts`
- Modify: `apps/cli/src/types.ts`
- Modify: `apps/cli/src/runtimeConfig.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/router.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `packages/convex/confect/http.ts`
- Modify: `packages/convex/test/http-docs.test.ts`

**Interfaces:**

```ts
export type CliRuntimeConfig = {
  readonly providerEnv: Record<string, string | undefined>;
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
};

export type CliCapabilityRunner = (
  capabilityId: string,
  request: CliCapabilityRequest,
) => Promise<CliResult>;

export function createHttpCapabilityRunner(input: {
  readonly config: CliRuntimeConfig;
  readonly fetch: typeof globalThis.fetch;
}): CliCapabilityRunner;

export async function dispatchCliCommandAsync(
  handlers: readonly CliCommandHandler[],
  argv: readonly string[],
  config: CliRuntimeConfig,
): Promise<CliResult>;
```

- [ ] **Step 1: Write red transport tests.** Prove a capability command performs
      a POST to the generated CLI operation route, sends a Bearer key only in
      the Authorization header, preserves input/idempotency/correlation data,
      maps structured 401/403/404/422 responses to stable nonzero CLI results,
      redacts credentials, and never calls `runTemplateApiOperation`.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/httpCapabilityClient.test.ts src/index.test.ts`

  Expected: FAIL because `runStaticCliCapability` imports the in-process
  workflow tool.

- [ ] **Step 3: Add the real generated CLI HTTP route.** For every inventory
      surface whose transport is `cli`, expose its generated route and resolve
      its exact surface ID before authentication. Route identity, not a caller
      header, selects the CLI policy. Feed the verified API-key principal into
      the internal dispatcher from Task 5.

- [ ] **Step 4: Make only execution async.** Keep schema/list/help/catalog
      projections local. Change capability execution and the top-level dispatch
      to promises, make `runCliAsync` canonical, and retain `runCli` temporarily
      only for pure local compatibility tests. Delete the workflow-tooling
      import and `runStaticCliCapability` from `index.ts`.

- [ ] **Step 5: Decode credentials from environment only.** Read
      `MAESTRO_API_BASE_URL` and `MAESTRO_API_KEY` in `decodeCliRuntimeConfig`.
      Neither flag is accepted by `parseNamedArgs`; help and errors never print
      the key. The acceptance driver supplies an exact sanitized child
      environment.

- [ ] **Step 6: Run green.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/httpCapabilityClient.test.ts src/index.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/http-docs.test.ts test/authorized-dispatch.test.ts`

- [ ] **Step 7: Commit.**

  ```bash
  rtk git add apps/cli/src/httpCapabilityClient.ts apps/cli/src/httpCapabilityClient.test.ts apps/cli/src/types.ts apps/cli/src/runtimeConfig.ts apps/cli/src/commands.ts apps/cli/src/router.ts apps/cli/src/index.ts apps/cli/src/index.test.ts packages/convex/confect/http.ts packages/convex/test/http-docs.test.ts
  rtk git commit -m "feat: execute cli capabilities over http"
  ```

**Unlock:** A CLI scenario can reach the same backend as the browser. The
in-process compatibility function is gone from capability execution, while the
pure local dispatcher remains until end-to-end proof is green.

---

### Task 7: Compile Exact Sources, Pickles, Rows, And Steps

**Class:** `template-gap`  
**PR:** `C7`  
**Depends on:** `C6`

**Files:**

- Modify: `tooling/acceptance/contract-inventory.ts`
- Modify: `tooling/acceptance/contract-inventory.test.ts`
- Modify: `packages/template-core/src/productContract.ts`
- Modify: `packages/template-core/src/productContract.test.ts`
- Modify: `tooling/acceptance/check-contracts.mts`
- Modify: `tooling/acceptance/check-contracts.test.mts`
- Create: `tooling/acceptance/selection-manifest.ts`
- Create: `tooling/acceptance/selection-manifest.test.ts`

**Interfaces:**

```ts
export function selectContracts(input: {
  readonly inventory: ContractInventory;
  readonly mode: "authoritative" | "focused";
  readonly journeyId?: `journey_${string}`;
}): SelectionManifest;
```

- [ ] **Step 1: Add red compiler cases.** Include Scenario, Rule, Background,
      Scenario Outline with two Examples blocks and multiple rows,
      interpolation, DataTable, DocString/media type, Unicode, and tag
      inheritance. Assert exact ordered step projections and distinct stable
      keys for every example row.

- [ ] **Step 2: Add red selection cases.** Authoritative mode must equal the
      complete admitted Pickle set. Focused mode must equal the named nonempty
      journey set. Reject unknown focus, empty focus, duplicate normalized path,
      source BOM, CRLF, traversal, and any supplied selector not derived from
      the inventory.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/selection-manifest.test.ts`

  Expected: FAIL because step projections and exact selection do not exist.

- [ ] **Step 4: Compile with the pinned APIs.** Use official generated
      Source/GherkinDocument/Pickle envelopes. Follow AST IDs only during the
      one compile, resolve Scenario versus Outline plus Examples row,
      interpolate step text, digest DataTable/DocString content, then discard
      generated IDs. Stable Pickle identity is source digest + normalized URI +
      Scenario/Outline location
  - optional Examples-row location. Encode that tuple as canonical JSON and hash
    its UTF-8 bytes into `pickle_sha256:<hex>`; do not concatenate ambiguous raw
    strings. Stable step identity hashes canonical JSON containing the Pickle
    key, ordered index, and complete projection into `step_sha256:<hex>`.

- [ ] **Step 5: Produce an exact manifest, not a tag query.** Sort Feature paths
      and stable Pickle keys. The protected launcher supplies those complete
      paths plus `--tags @admitted`; the verifier proves the resulting
      stable-key set equals the manifest. Shared config cannot add
      paths/tags/name/shard/order.

- [ ] **Step 6: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/selection-manifest.test.ts tooling/acceptance/check-contracts.test.mts`

  Run: `rtk pnpm acceptance:check`

  ```bash
  rtk git add packages/template-core/src/productContract.ts packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/check-contracts.mts tooling/acceptance/check-contracts.test.mts tooling/acceptance/selection-manifest.ts tooling/acceptance/selection-manifest.test.ts
  rtk git commit -m "feat: compile exact cucumber contract inventory"
  ```

**Unlock:** The controller can know exactly what must execute before invoking
Cucumber.

---

### Task 8: Verify Strict Cucumber Messages Linkage

**Class:** `template-gap`  
**PR:** `C8`  
**Depends on:** `C7`

**Files:**

- Create: `tooling/acceptance/verify-messages.mts`
- Create: `tooling/acceptance/verify-messages.test.mts`
- Create: `tooling/acceptance/fixtures/messages/passing.feature`
- Create: `tooling/acceptance/fixtures/messages/passing.ndjson`
- Modify: `package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

```ts
export type MessagesVerificationInput = {
  readonly expected: ContractInventory;
  readonly selection: SelectionManifest;
  readonly runtime: RuntimeManifest;
  readonly requiredHookKinds: readonly (
    "before-all" | "before" | "after" | "after-all"
  )[];
  readonly ciTuple?: {
    readonly repository: string;
    readonly baseRef: string;
    readonly baseOid: string;
    readonly headOid: string;
    readonly mergeGroupOid: string;
  };
  readonly ndjson: string;
};

export type MessagesVerdict =
  | {
      readonly ok: true;
      readonly executedPickleKeys: readonly StablePickleKey[];
    }
  | { readonly ok: false; readonly findings: readonly string[] };

export function verifyMessages(
  input: MessagesVerificationInput,
): MessagesVerdict;
```

- [ ] **Step 1: Check in one genuine passing stream.** Generate `passing.ndjson`
      once with pinned `cucumber-js` from `passing.feature`, review it, and keep
      it as protocol compatibility input. Its Source bytes must exactly equal
      the committed Feature.

- [ ] **Step 2: Write table-driven red mutations.** Starting from the passing
      stream, independently test `{}`, unknown payload, two payloads, invalid
      JSON, blank-only stream, truncated final line, duplicate/missing meta,
      incompatible protocol, missing/duplicate/cross-document AST IDs, wrong
      Outline row, missing/substituted/duplicate PickleStep, invalid TestCase
      linkage, zero/multiple/unresolved StepDefinition links, unresolved Hook
      links, missing/duplicate emitted Before/After/BeforeAll/AfterAll hooks,
      missing/duplicate BeforeStep or AfterStep attachment markers, orphan
      started/finished events, attempt > 0, `willBeRetried`, every non-PASSED
      status, failed run hook, unsuccessful/missing run finish, duplicate
      Pickle, wrong Source bytes/URI, and zero/wrong selection.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts`

  Expected: FAIL because the verifier does not exist.

- [ ] **Step 4: Parse strictly before using `parseEnvelope`.** For each nonblank
      line, parse raw JSON, require an object with exactly one known Envelope
      payload key and no unknown own key, then call official `parseEnvelope`.
      Index Sources, GherkinDocuments, Pickles, PickleSteps, StepDefinitions,
      Hooks, TestCases, TestCaseStarted, step events, run-hook events,
      attachments, and run boundaries by their runtime IDs. Reject duplicates
      and unresolved links at index time.

- [ ] **Step 5: Re-derive stable identity from runtime AST.** Follow Source ->
      GherkinDocument -> Pickle -> Scenario/Outline and Examples row, compare
      exact source bytes and normalized URI, re-create every stable Pickle and
      step key, then require set equality with `SelectionManifest`. Require one
      TestCase and one attempt-zero TestCaseStarted per Pickle, one test step
      per PickleStep, exactly one unique StepDefinition plus aligned match
      arguments for every Pickle-backed test step, and exactly one Hook for each
      hook-backed test step. Compare emitted scenario/run hooks with the
      protected required inventory and require one start/finish with PASSED
      status for each.

- [ ] **Step 6: Validate the closed observation envelope.** Require exactly one
      attachment with the declared schema version, stable Pickle key, checkout
      and artifact identities, backend identity, scenario nonce, Action/Outcome
      step keys, exact BeforeStep/AfterStep markers for every expected step, and
      observed surface/transport pairs. The committed protocol fixture carries
      reviewed synthetic values matching its `RuntimeManifest`; `C9` replaces
      the fixture producer with trusted real drivers. Do not accept empty or
      extra fields.

- [ ] **Step 7: Add the command and run green protocol tests.** Add
      `acceptance:verify-messages` as a direct verifier command used by the
      protected runner, not as a separate status badge.

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts`

  Run: `rtk pnpm acceptance:verify-messages -- --help`

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add tooling/acceptance/verify-messages.mts tooling/acceptance/verify-messages.test.mts tooling/acceptance/fixtures/messages package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "feat: verify exact cucumber messages"
  ```

**Unlock:** Cucumber execution can be proven complete at the protocol level;
real action/outcome and runtime identity observations remain required.

---

### Task 9: Add Trusted Driver Observations And Runtime Identity

**Class:** `template-gap`  
**PR:** `C9`  
**Depends on:** `C8`

**Files:**

- Create: `features/support/observations.ts`
- Create: `tooling/acceptance/observations.test.ts`
- Create: `features/support/world.ts`
- Create: `features/support/hooks.ts`
- Create: `features/support/browser-driver.ts`
- Create: `features/support/cli-driver.ts`
- Create: `features/support/runtime-identity.ts`
- Create: `tooling/acceptance/runtime-identity.test.ts`
- Create: `apps/web/src/adapters/build-identity.ts`
- Create: `apps/web/src/adapters/build-identity.test.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/cli/src/commands.ts`
- Create: `apps/cli/src/commands.test.ts`
- Create: `packages/convex/confect/runtime/identity.ts`
- Create: `packages/convex/confect/runtime/identity.spec.ts`
- Create: `packages/convex/confect/runtime/identity.impl.ts`
- Modify generated: `packages/convex/confect/_generated/**`
- Modify generated: `packages/convex/convex/_generated/**`
- Modify: `packages/convex/confect/http.ts`
- Create: `packages/convex/test/runtime-identity.test.ts`
- Modify: `tooling/acceptance/verify-messages.mts`
- Modify: `tooling/acceptance/verify-messages.test.mts`

**Interfaces:**

```ts
export type DriverObservation = {
  readonly stepKey: StableStepKey;
  readonly kind: "action" | "outcome";
  readonly surfaceId?: string;
  readonly transport?: ContractTransport;
};

export type RuntimeObservationAttachment = {
  readonly schemaVersion: 1;
  readonly pickleKey: StablePickleKey;
  readonly checkoutSha: string;
  readonly webArtifactDigest: `sha256:${string}`;
  readonly cliArtifactDigest: `sha256:${string}`;
  readonly webBuildSourceSha: string;
  readonly cliBuildSourceSha: string;
  readonly backendDeploymentId: string;
  readonly backendInputDigest: `sha256:${string}`;
  readonly backendStartNonce: string;
  readonly scenarioNonce: string;
  readonly observations: readonly DriverObservation[];
  readonly hooks: {
    readonly before: 1;
    readonly beforeStepKeys: readonly StableStepKey[];
    readonly afterStepKeys: readonly StableStepKey[];
    readonly after: 1;
  };
};

export const requiredEmittedHooks = [
  "before-all",
  "before",
  "after",
  "after-all",
] as const;

export class ContractWorld extends World<ContractWorldParameters> {
  readonly observations: ScenarioObservations;
  currentStepKey: string | undefined;
}
```

- [ ] **Step 1: Write red observation tests.** Prove no public `markCovered`
      function exists; a driver cannot record before performing its injected
      action/assertion; observations are bound to the current stable step key;
      passing Action/Outcome steps without the matching kind fail in
      `AfterStep`; observations cannot be attributed to a previous step; and
      each scenario emits exactly one redacted attachment. Omitting or
      duplicating any required emitted hook or any per-step BeforeStep/AfterStep
      marker fails.

- [ ] **Step 2: Write red identity tests.** Prove the web and CLI expose their
      compile-time source SHA, the backend generates its own per-start nonce and
      reports deployment/input identity, and no identity endpoint accepts an
      expected SHA, deployment ID, nonce, digest, or timestamp from the caller.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/observations.test.ts tooling/acceptance/runtime-identity.test.ts apps/web/src/adapters/build-identity.test.ts packages/convex/test/runtime-identity.test.ts`

  Expected: FAIL because trusted drivers and identity surfaces are absent.

- [ ] **Step 4: Implement one scenario observation set.** Browser methods use
      Playwright accessible roles/labels/text and record only after the
      interaction or actor-visible assertion resolves. CLI methods spawn the
      built executable with `child_process`, an exact environment, no shell, and
      credentials outside argv; they record only after exit/output assertions
      resolve. Surface methods add the exact `(surfaceId, transport)`. There is
      no page-object hierarchy or generic step DSL.

- [ ] **Step 5: Bind hooks to expected steps.** `Before` allocates scenario
      adapters/nonce; `BeforeStep` resolves the current runtime PickleStep to
      the precompiled stable step key; `AfterStep` requires the Action/Outcome
      observation after a passing step and clears the binding; `After` revokes
      scenario handles, closes its browser context, and attaches one JSON
      envelope. The attachment records exact BeforeStep/AfterStep key lists;
      these hooks have no separate Messages events in Cucumber 13. Global hooks
      perform checks only and never own long-lived processes. Export the closed
      emitted-hook inventory from the same protected module that registers it.

- [ ] **Step 6: Add server-owned identity.** Vite compiles source/component
      identity into the web build; the CLI `identity` command prints its
      compiled identity and authenticated backend identity; the backend creates
      its start nonce inside the runtime and returns deployment/input identity.
      Controller artifact hashes remain independently computed and are not
      self-reported.

- [ ] **Step 7: Close verifier observation equality.** Require every expected
      Action and Outcome step key, every declared surface/transport pair, no
      unknown or non-admitted incidental surface, distinct web/CLI artifact
      hashes, equal source SHA, one backend identity, and exact equality with
      `RuntimeManifest`. Reject cookie, token, key, private-key, Authorization,
      or raw-customer fields.

- [ ] **Step 8: Run green and commit.**

  Run on a connected codegen worker: `rtk pnpm confect:codegen`

  Run on a connected codegen worker: `rtk pnpm convex:codegen`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/observations.test.ts tooling/acceptance/runtime-identity.test.ts apps/web/src/adapters/build-identity.test.ts apps/cli/src/commands.test.ts packages/convex/test/runtime-identity.test.ts tooling/acceptance/verify-messages.test.mts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:convex`

  ```bash
  rtk git add features/support tooling/acceptance/observations.test.ts tooling/acceptance/runtime-identity.test.ts apps/web/src/adapters/build-identity.ts apps/web/src/adapters/build-identity.test.ts apps/web/vite.config.ts apps/cli/src/commands.ts apps/cli/src/commands.test.ts packages/convex/confect/runtime packages/convex/confect/http.ts packages/convex/confect/_generated packages/convex/convex/_generated packages/convex/test/runtime-identity.test.ts tooling/acceptance/verify-messages.mts tooling/acceptance/verify-messages.test.mts
  rtk git commit -m "feat: observe real contract interactions"
  ```

**Unlock:** Approved steps can prove they crossed real driver boundaries and
agree on runtime identity. Process and trust isolation is still absent.

---

### Task 10: Build The Secretless Protected Acceptance Controller

**Class:** `template-gap`  
**PR:** `C10`  
**Depends on:** `C9`

**Files:**

- Create: `tooling/acceptance/run-acceptance.mts`
- Create: `tooling/acceptance/run-acceptance.test.mts`
- Create: `tooling/acceptance/sandbox.ts`
- Create: `tooling/acceptance/sandbox.test.ts`
- Create: `features/support/local-auth.ts`
- Create: `tooling/acceptance/local-auth.test.ts`
- Create: `tooling/acceptance/controller.Dockerfile`
- Modify: `tooling/agent-pack/src/processSupervisor.ts`
- Modify: `tooling/agent-pack/src/processSupervisor.test.ts`
- Create: `apps/web/src/providers/auth-runtime.tsx`
- Create: `apps/web/src/providers/auth-runtime.acceptance.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/vite.config.ts`
- Create: `packages/convex/convex/auth.acceptance.config.ts`
- Modify: `tooling/quality/check-auth-demo-bypass.mts`
- Modify: `tooling/quality/check-auth-demo-bypass.test.mts`
- Modify: `tooling/quality/check-env-boundary.mts`
- Modify: `tooling/quality/check-env-boundary.test.mts`
- Modify: `package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

```ts
export type ProcessEnvironmentProjection = {
  readonly base: "inherit" | "empty";
  readonly remove: readonly string[];
  readonly set: Readonly<Record<string, string>>;
};

export type AcceptanceRunRequest = {
  readonly mode: "authoritative" | "focused";
  readonly repositoryRoot: string;
  readonly protectedBaseSha?: string;
  readonly ciTuple?: MessagesVerificationInput["ciTuple"];
  readonly focusedJourneyId?: `journey_${string}`;
};

export type AcceptanceRunResult =
  | { readonly ok: true; readonly kind: "verified" | "no-admitted-contracts" }
  | { readonly ok: false; readonly findings: readonly string[] };

export async function runAcceptance(
  request: AcceptanceRunRequest,
): Promise<AcceptanceRunResult>;
```

- [ ] **Step 1: Write red supervisor/environment tests.** Add an empty-base
      projection test that asserts exact key equality, not a denylist. Prove
      process groups, readiness, first-child failure, SIGINT/SIGTERM forwarding,
      timeout, and idempotent cleanup still work. Preserve `base: "inherit"` as
      the default for existing callers; acceptance always selects `empty`.

- [ ] **Step 2: Write red sandbox canaries.** In a disposable fixture, prove a
      candidate cannot read representative GitHub/BWS/provider canaries, host
      home, SSH agent, Docker/control sockets, cloud metadata, controller
      Messages/run manifest, or writable trusted tools; cannot shadow PATH;
      cannot write source or launched artifacts; cannot signal/ptrace controller
      processes; and cannot open an outbound runtime socket. Prove loopback
      between approved runtime peers remains available and
      CPU/memory/storage/PID/wall limits terminate the candidate.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/agent-pack/src/processSupervisor.test.ts tooling/acceptance/sandbox.test.ts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/local-auth.test.ts`

  Expected: FAIL because exact empty environment, isolation, and controller are
  absent.

- [ ] **Step 4: Extend existing supervision and add the minimal sandbox.** Use
      the existing spawner/readiness/signal/cleanup code. On Linux, the pinned
      controller image invokes Bubblewrap with separate user/PID/mount/network
      namespaces, read-only candidate source, bounded writable temp locations,
      and no controller mount. Dependency fetch is trusted and uses
      `pnpm fetch --frozen-lockfile --ignore-scripts`; candidate install/build
      is offline inside the build sandbox. Copy only regular files from declared
      web, CLI, and backend outputs, reject symlinks/devices, hash them, make
      the runtime copy read-only, then launch all candidate runtime peers in one
      fresh private network namespace with only loopback. A controller-owned
      fixed-port proxy joins only that network namespace (not its mount/PID
      namespaces) and exposes approved web/backend ports through controller-only
      Unix sockets; Cucumber and Playwright use that proxy. The candidate cannot
      see the proxy control socket or gain an outbound route.

- [ ] **Step 5: Add the local issuer and private fixture control.** Use Node
      `crypto` to create an RSA key pair and Node `http` to serve loopback JWKS.
      Mint short-lived issuer/audience/signature/expiry-validated tokens for
      synthetic actors. The private key and internal Convex bootstrap stay in
      the controller. Create users, workspaces, memberships, legitimate Given
      records, and expiring API keys only through local admin/internal
      invocation; expose no public bootstrap route.

- [ ] **Step 6: Keep acceptance auth out of production.** The controller
      overlays the protected `auth.acceptance.config.ts` only into the hashed
      local backend input. Vite aliases the production and acceptance auth
      adapters by explicit build mode. Extend build-graph and bundle-marker
      gates to prove production entrypoints cannot import/select the loopback
      issuer, synthetic token adapter, or bootstrap code. The normal root uses
      the production AuthKit-to- `ConvexProviderWithAuth` path, not
      `fakeInitialAuth`.

- [ ] **Step 7: Orchestrate the authoritative sequence.** Verify checkout SHA
      equals `mergeGroupOid`; compile inventory/selection; handle the explicit
      zero case; fetch; sandbox install/build; copy/hash; start one local
      Convex, built web preview, and built CLI; await
      web/CLI/Confect/backend/identity probes; start Cucumber in the controller
      with `--config` pointing at the protected canonical config, protected-base
      step/support adapters, the exact candidate Feature paths,
      `--tags @admitted`, and `--format message:<controller path>`; terminate
      all candidate processes; require Cucumber to exit normally with code zero
      after formatter cleanup; then verify Messages and runtime manifest. A
      valid passing Messages stream paired with exit 1 or a signal is failure. A
      proposed control-plane delta runs only in a separately labeled observation
      pass. Never use a candidate-owned command string to post status. Supply
      `requiredEmittedHooks` from the same protected support module; candidate
      source cannot choose or shrink that inventory.

- [ ] **Step 8: Add the three public developer commands.** Add
      `acceptance:focus`, `acceptance`, and the existing `acceptance:check` to
      root scripts/Justfile/gate definitions. `acceptance:focus --journey <id>`
      records a non-authoritative local checkout and must select a nonempty
      journey. Root `verify` invokes authoritative acceptance through the
      protected launcher in CI and the local alias outside CI; no new completion
      badge is created.

- [ ] **Step 9: Run green unit and observation-mode canaries.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/agent-pack/src/processSupervisor.test.ts tooling/acceptance/sandbox.test.ts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/local-auth.test.ts tooling/quality/check-auth-demo-bypass.test.mts tooling/quality/check-env-boundary.test.mts`

  The controller tests include passing NDJSON with Cucumber exit `1`, signal
  termination, formatter-stream failure, and verifier failure; all four must
  return a red `AcceptanceRunResult`.

  Run inside the actual Woodpecker agent in non-required observation mode:
  `rtk pnpm acceptance -- --sandbox-canary`

  Expected: unit tests PASS. The canary must prove every boundary; if the agent
  kernel rejects user/mount/network namespace enforcement, keep acceptance
  non-authoritative and block `W1` until the protected agent/image is corrected.

- [ ] **Step 10: Commit without cutting over CI authority.**

  ```bash
  rtk git add tooling/acceptance features/support/local-auth.ts tooling/agent-pack/src/processSupervisor.ts tooling/agent-pack/src/processSupervisor.test.ts apps/web/src/providers apps/web/src/routes/__root.tsx apps/web/vite.config.ts packages/convex/convex/auth.acceptance.config.ts tooling/quality/check-auth-demo-bypass.mts tooling/quality/check-auth-demo-bypass.test.mts tooling/quality/check-env-boundary.mts tooling/quality/check-env-boundary.test.mts package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "feat: isolate secretless contract acceptance"
  ```

**Unlock:** The candidate cannot forge Messages/runtime evidence or reach
secrets/status state. Required-status cutover still waits for the real product
fixture and mutations.

---

### Task 11: Prove A Generated Reference Product Through UI And CLI

**Class:** `fixture-to-real`  
**PR:** `C11`  
**Depends on:** `C10`

**Files:**

- Create:
  `tooling/acceptance/fixtures/reference-app/features/template_records.feature`
- Create:
  `tooling/acceptance/fixtures/reference-app/features/step_definitions/template_records.steps.ts`
- Create: `features/platform_access.feature`
- Create: `features/step_definitions/platform_access.steps.ts`
- Create: `tooling/acceptance/reference-app.ts`
- Create: `tooling/acceptance/reference-app.test.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify:
  `examples/saas-application/seed/source/packages/convex/confect/records.spec.ts`
- Modify:
  `examples/saas-application/seed/source/packages/convex/confect/records.impl.ts`
- Modify:
  `examples/saas-application/seed/source/apps/web/src/features/records/records-surface.tsx`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`

**Contract:** The fixture Feature uses `@journey_template_records @admitted` and
contains these observable scenarios:

- authorized UI create/read;
- authorized external CLI create/list;
- UI create followed by CLI read in one cross-surface scenario;
- signed-out UI denial;
- read-only UI denial without mutation;
- missing CLI key denial;
- read-only CLI scope denial;
- foreign-workspace CLI denial with no foreign data;
- matching web/CLI/backend runtime identity.

The standard generated app also includes one admitted `@journey_platform_access`
Feature for behavior genuinely present in every output: the public shell loads,
the local CLI describes the same template, the built UI/CLI identity agrees with
one backend, and signed-out access to a protected platform route is denied. Its
coverage tags name only those generic platform surfaces; it contains no records
or customer-domain prose.

- [ ] **Step 1: Write the admitted Feature and undefined steps first.** Keep
      prose actor/outcome-focused and use generated surface tags. Overlay the
      Feature and its steps only into the disposable factory acceptance target;
      do not add this fake domain journey to normal customer output. The first
      step-definition file contains only `export {};`, so every Feature step is
      intentionally undefined for the red run.

- [ ] **Step 2: Run dry-run red.**

  Run:
  `rtk pnpm exec cucumber-js tooling/acceptance/fixtures/reference-app/features/template_records.feature --dry-run --require tooling/acceptance/fixtures/reference-app/features/step_definitions/template_records.steps.ts --tags @journey_template_records`

  Expected: exit `1`; every Feature step is `UNDEFINED`, with no ambiguous or
  loaded-support error.

- [ ] **Step 3: Add the failing generated-app integration test.** Generate a
      fresh app through the real release adapter, overlay the CODEOWNED fixture,
      configure real local Convex, and invoke `runAcceptance` on that target.
      Assert a failing UI Save path and failing external CLI path before product
      repairs.

- [ ] **Step 4: Run the integration red after committing its test.**

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts`

  Expected: FAIL because the existing fake adapter/no-op path does not persist
  one shared backend record.

- [ ] **Step 5: Repair only the existing records product.** Use its Confect
      spec/impl and real Convex persistence when Convex is configured; wire the
      UI Save control through the registered action adapter; expose the same
      operations through authenticated CLI HTTP; remove fixture state as an
      outcome oracle. Given setup may create tenants/memberships/API keys and
      explicitly named starting records, but never the record promised by When.

- [ ] **Step 6: Implement thin domain steps.** Reuse the trusted browser, CLI,
      local-auth, and fixture-control drivers. Do not import React components,
      handlers, `runCliAsync`, operation implementations, or database readers
      for a Then assertion. Cross-surface state must be observed through the
      second real surface.

- [ ] **Step 7: Run the complete fixture green and verify cleanup.**

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts`

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm --dir apps/cli test:customer-cli-runtime`

  Expected: every Pickle passes exactly once, the strict verifier passes, all
  keys/fixture data/browser contexts/process groups are removed, and the normal
  generated app contains no `journey_template_records` Feature.

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add features/platform_access.feature features/step_definitions/platform_access.steps.ts tooling/acceptance/fixtures/reference-app tooling/acceptance/reference-app.ts tooling/acceptance/reference-app.test.ts tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.test.ts examples/saas-application/seed/source/packages/convex/confect/records.spec.ts examples/saas-application/seed/source/packages/convex/confect/records.impl.ts examples/saas-application/seed/source/apps/web/src/features/records/records-surface.tsx apps/cli/src/factory/candidateComposition.test.ts apps/cli/src/factory/customerCliRuntime.test.ts
  rtk git commit -m "test: prove generated ui and cli product contract"
  ```

**Unlock:** The harness has one real generated-app success path. It cannot
become required authority until every listed false-green mutation turns red.

---

### Task 12: Close Every Harness False-Green Mutation

**Class:** `fixture-to-real`  
**PR:** `C12`  
**Depends on:** `C11`

**Files:**

- Create: `tooling/acceptance/mutation-gauntlet.mts`
- Create: `tooling/acceptance/mutation-gauntlet.test.mts`
- Modify: `tooling/ci/mutation.sh`
- Modify: `package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interface:**

```ts
export type ContractMutation = {
  readonly id: string;
  readonly apply: (fixtureRoot: string) => Promise<void>;
  readonly expectedFinding: RegExp;
};

export const contractMutations: readonly ContractMutation[];
export async function runContractMutationGauntlet(input: {
  readonly pristineFixtureRoot: string;
  readonly run: (mutatedRoot: string) => Promise<AcceptanceRunResult>;
}): Promise<void>;
```

- [ ] **Step 1: Write a red completeness test.** Assert the mutation registry
      has exactly 25 unique core cases, one for every row below, and that each
      case operates on a fresh copy of the last known-green generated fixture.
      Tasks 17 and 18 append the three CI/release cases once those authorities
      exist; Tasks 19 and 21 require the complete 28-case registry before
      sealing either release.

| Mutation                                          | Required red authority         |
| ------------------------------------------------- | ------------------------------ |
| Disconnect Save handler                           | UI Pickle                      |
| Replace Action or Outcome UI step with no-op      | driver observation             |
| Replace Action or Outcome CLI step with no-op     | driver observation             |
| Add action discriminant inside shared route       | public inventory               |
| Generate surface without journey/auth provenance  | generator/provenance           |
| Restore in-process `FeatureDisabled` CLI path     | CLI Pickle                     |
| Dispatch API key through session-only public ref  | positive CLI auth              |
| Point CLI at a second backend                     | cross-surface/runtime identity |
| Trust caller workspace                            | tenant-isolation Pickle        |
| Call assembling operation through raw public path | server admission guard         |
| Select no expected Pickles                        | selection equality             |
| Omit one Outline row                              | Pickle equality                |
| Link Outline to wrong row/document                | AST integrity                  |
| Omit/substitute PickleStep or TestCase mapping    | step linkage                   |
| Supply empty/multi-payload/truncated Envelope     | strict protocol                |
| Fail `AfterAll` or run success                    | run boundary                   |
| Echo caller expected SHA from backend             | server identity                |
| Add Cucumber selector/key or retry/parallel       | config validator               |
| Compare lifecycle against `HEAD^`                 | protected-base transition      |
| Add admitted Feature absent from base             | closed transition              |
| Weaken tenant/role/scope metadata                 | auth strength comparison       |
| Inject representative secret canary               | exact environment              |
| Shadow trusted tool                               | sandbox mount/PATH             |
| Open outbound runtime socket                      | network namespace              |
| Candidate overwrites Messages/run manifest        | namespace ownership            |

- [ ] **Step 2: Run the registry test red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/mutation-gauntlet.test.mts`

  Expected: FAIL until all mutation IDs and expected findings exist.

- [ ] **Step 3: Implement deterministic mutations without a framework.** Use
      bounded exact text/JSON transformations against the disposable fixture and
      assert each preimage exists exactly once before changing it. Run one
      mutation per clean copy, require a nonzero acceptance result, and require
      its specific finding. A crash, unrelated compilation error, timeout, or
      different gate is not credit for the intended oracle.

- [ ] **Step 4: Wire the existing release mutation lane.** Extend
      `tooling/ci/mutation.sh` and root `test:mutation`; do not add a second
      mutation service. Ordinary product pull requests run admitted contracts,
      not this synthetic gauntlet. Changes to acceptance control paths and
      release sealing run all mutations.

- [ ] **Step 5: Run every mutation green-as-a-test.**

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm test:mutation`

  Expected: the pristine fixture passes; each mutation independently produces
  its required red finding; the gauntlet command exits zero only after all
  intended failures are observed.

- [ ] **Step 6: Commit.**

  ```bash
  rtk git add tooling/acceptance/mutation-gauntlet.mts tooling/acceptance/mutation-gauntlet.test.mts tooling/ci/mutation.sh package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "test: close contract false-green mutations"
  ```

**Unlock:** The replacement oracle is credible. Factory UX, Build Packs,
upgrades, CI authority, and deletion may now depend on it.

---

### Task 13: Make `maestro create` And `contracts add` Contract-First

**Class:** `pattern-instance`  
**PR:** `F1`  
**Depends on:** `C12`

**Files:**

- Create: `tooling/agent-pack/src/productContracts.ts`
- Create: `tooling/agent-pack/src/productContracts.test.ts`
- Modify: `tooling/agent-pack/src/create.ts`
- Modify: `tooling/agent-pack/src/create.test.ts`
- Modify: `tooling/agent-pack/src/index.ts`
- Create: `apps/cli/src/factory/contracts.ts`
- Create: `apps/cli/src/factory/contracts.test.ts`
- Modify: `apps/cli/src/factory/create.ts`
- Modify: `apps/cli/src/factory/create.test.ts`
- Modify: `apps/cli/src/factory/createComposition.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `apps/cli/src/factory/composition.test.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `docs/template/quickstart.md`
- Modify: `docs/template/blueprints/saas-application.md`

**Interfaces:**

```ts
export type ReviewedContract = {
  readonly sourcePath: string;
  readonly targetPath: `features/${string}.feature`;
  readonly bytes: string;
  readonly sha256: `sha256:${string}`;
  readonly journeyId: `journey_${string}`;
  readonly title: string;
  readonly primary: boolean;
};

export type CustomerCreateInput = {
  readonly target: string;
  readonly name: string;
  readonly contracts: readonly ReviewedContract[];
  readonly demoOnly: boolean;
  readonly write: boolean;
  readonly privacyReviewed: boolean;
};

export function readReviewedContracts(input: {
  readonly cwd: string;
  readonly specPaths: readonly string[];
  readonly primaryJourneyId?: string;
  readonly maxBytes: number;
}): readonly ReviewedContract[];
```

- [ ] **Step 1: Write parser/contract tests red.** Prove repeatable `--spec`,
      one-Feature auto-primary, multi-Feature required `--primary-journey`,
      exact primary match, assembling-only customer contracts, duplicate
      journey/path, traversal, destination collision, malformed Gherkin,
      BOM/CRLF, oversize read, and changed-on-read bytes all fail. Prove
      `--outcome` returns an explicit migration error naming `--spec`.

- [ ] **Step 2: Write transaction tests red.** For create and contracts-add,
      assert preview is default, reviewed write requires the existing privacy
      and preflight/plan fingerprints, preimages are rechecked, collision or
      dirty target leaves all files unchanged, and successful output preserves
      exact Feature bytes.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/productContracts.test.ts src/create.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/contracts.test.ts src/factory/create.test.ts`

  Expected: FAIL because create still requires scalar `outcome` and no contracts
  command exists.

- [ ] **Step 4: Read and validate exact contract bytes at the CLI boundary.**
      Resolve bounded regular files without symlink/path escape, compile through
      the shared `@maestro-template/template-core/product-contract` compiler,
      require assembling lifecycle, and pass immutable `ReviewedContract` values
      into Agent Pack. `personalization.firstOutcome` becomes the primary
      Feature title; no prose is converted to a gate and Agent Pack does not
      import acceptance controller code.

- [ ] **Step 5: Extend the existing reviewed materialization.** Add exact
      Feature writes and the disabled admitted-journey projection to the
      existing blueprint/release plan, so preview checksums and collision
      semantics cover them. Unresolved well-formed `@covers_*` intents are
      reported as the implementation queue and do not cause create to invent
      surfaces or code.

- [ ] **Step 6: Add `maestro contracts add`.** Route the two-token command in
      existing factory composition. It accepts one reviewed assembling `--spec`,
      previews exact file/projection changes through the existing transaction,
      reports journey/rule/scenario/resolved/unresolved coverage, and invokes
      Cucumber dry-run only to print undefined snippets. It emits no UI,
      operation, fixture, or completion claim.

- [ ] **Step 7: Update factory tests and docs to the new command.** Replace all
      create fixtures that use `--outcome` with checked-in temporary Feature
      bytes; retain one negative migration test. Keep sealed alpha.2 bytes
      unchanged.

- [ ] **Step 8: Run focused and real create integration green.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/productContracts.test.ts src/create.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/contracts.test.ts src/factory/create.test.ts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm --dir apps/cli test:create-root-integration`

- [ ] **Step 9: Commit.**

  ```bash
  rtk git add tooling/agent-pack/src/productContracts.ts tooling/agent-pack/src/productContracts.test.ts tooling/agent-pack/src/create.ts tooling/agent-pack/src/create.test.ts tooling/agent-pack/src/index.ts apps/cli/src/factory/contracts.ts apps/cli/src/factory/contracts.test.ts apps/cli/src/factory/create.ts apps/cli/src/factory/create.test.ts apps/cli/src/factory/createComposition.ts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/composition.ts apps/cli/src/factory/composition.test.ts apps/cli/src/commands.ts tooling/generators/src/blueprints/saasApplication.ts tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.test.ts docs/template/app-factory-guide.md docs/template/quickstart.md docs/template/blueprints/saas-application.md
  rtk git commit -m "feat: make factory creation contract first"
  ```

**Unlock:** Every new app begins with reviewed natural-language contracts in
assembling state and no false completion claim.

---

### Task 14: Require Generator Provenance And Delete Fake Completion Output

**Class:** `fixture-to-real`  
**PR:** `F2`  
**Depends on:** `F1`

**Files:**

- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `tooling/generators/src/customer-runtime.ts`
- Modify: `tooling/generators/src/customer-runtime.test.ts`
- Modify: `tooling/generators/src/customer-dispatcher.ts`
- Modify: `tooling/generators/src/cli.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Delete: `tooling/generators/src/crud-proof.ts`
- Delete: `tooling/generators/src/crud-proof.test.ts`
- Delete:
  `examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts`
- Delete:
  `packages/template-core/src/generated/template-contracts-legacy-baseline.json`
- Modify: `packages/template-core/src/recipes/schema.ts`
- Modify: `docs/template/recipes/crud-business-entity.json`
- Modify: `docs/template/recipes/validated-file-import.json`
- Modify: `package.json`
- Modify: `tooling/quality/check-generators.mts`
- Modify: `tooling/quality/check-generators.test.mts`
- Modify: `tooling/quality/check-promotion-boundary.mts`
- Modify: `tooling/quality/check-promotion-boundary.test.mts`

**Interfaces:**

```ts
export type PublicEntrypointProvenance = {
  readonly surfaceId: string;
  readonly journeyId: `journey_${string}`;
  readonly authPolicyId: `auth_${string}`;
  readonly authorityLocator: string;
  readonly actionDiscriminant?: string;
};

export type PublicGeneratorOptions = {
  readonly publicEntrypoint?: PublicEntrypointProvenance;
};
```

- [ ] **Step 1: Write red generator tests.** For every reviewed generator that
      can create a route, UI action, Confect/Convex public function, HTTP route,
      command, trigger, webhook, CLI, API, or MCP surface, require all
      provenance fields together. Prove partial/unknown journey/policy/surface,
      duplicate locator/discriminant, and generated surface absent from
      provenance fail.

- [ ] **Step 2: Write red anti-fake tests.** Assert standard customer output has
      no presenter-only fake-ready state, no no-op authority-bearing control, no
      records fake adapter, no standalone CRUD proof, no unrelated admitted
      domain Feature, and no generic `template:add-feature` command. The
      factory-only reference overlay must still pass Task 11.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/index.test.ts src/customer-runtime.test.ts src/blueprints/saasApplication.test.ts`

  Expected: FAIL on current fake-ready/add-feature/CRUD output.

- [ ] **Step 4: Put provenance into the existing generator receipt.** Extend the
      current generated provenance JSON; do not create another ledger. Internal
      outputs may omit public provenance. Any public output requires a stable
      surface ID, activation journey, auth policy, and canonical locator plus
      action discriminant when applicable. The inventory generator consumes this
      same receipt and defaults an incomplete entry to deny-all/failure, never
      enabled.

- [ ] **Step 5: Remove the broad fake feature generator.** Delete its
      dispatcher, parser/help/script, projection closure, and recipe references.
      Keep narrow table/capability/workflow/agent generators as implementation
      tools. Recipes reference stable journey/scenario IDs and engineering
      prerequisites; remove `doneState` from the recipe schema and every recipe
      instead of translating it into shell gates.

- [ ] **Step 6: Remove fake proof from normal customer output.** Delete
      `crud-proof` and the non-Convex records adapter. Omit the neutral records
      domain route/action from standard create output unless a supplied
      assembling contract and explicit generator provenance owns it. Keep the
      real records implementation only in the factory acceptance overlay used by
      Task 11. Narrow standard public registration to surfaces covered by
      `journey_platform_access` plus surfaces explicitly introduced by supplied
      contract provenance; unused product modules may remain internal but cannot
      be publicly registered. Prove every frozen template-baseline entry is
      therefore covered or absent, delete the baseline, and enable full
      active-surface coverage enforcement in the same commit.

- [ ] **Step 7: Run generator, acceptance, and factory checks green.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/index.test.ts src/customer-runtime.test.ts src/blueprints/saasApplication.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-generators.test.mts tooling/quality/check-promotion-boundary.test.mts tooling/acceptance/reference-app.test.ts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:generators`

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add tooling/generators packages/template-core/src/recipes/schema.ts packages/template-core/src/generated/template-contracts-legacy-baseline.json docs/template/recipes package.json tooling/quality/check-generators.mts tooling/quality/check-generators.test.mts tooling/quality/check-promotion-boundary.mts tooling/quality/check-promotion-boundary.test.mts examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts
  rtk git commit -m "refactor: remove fake feature completion"
  ```

**Unlock:** Generators cannot create a reachable behavior without contract/auth
provenance, and structural fake output no longer masquerades as product proof.

---

### Task 15: Add Human Build Pack Contract Review And Exact Export

**Class:** `pattern-instance`  
**PR:** `B1`  
**Depends on:** `C12`; rebase after `F1` before merge

**Files:**

- Modify: `packages/app-idea-evaluator/src/buildPack.ts`
- Modify: `packages/app-idea-evaluator/src/buildPack.test.ts`
- Modify: `packages/app-idea-evaluator/src/premiumPipeline.ts`
- Modify: `packages/app-idea-evaluator/src/premiumPipeline.test.ts`
- Modify: `packages/app-idea-evaluator/src/maestroMapping.ts`
- Modify: `packages/app-idea-evaluator/src/maestroMapping.test.ts`
- Modify: `packages/convex/confect/buildPacks/packs.spec.ts`
- Modify: `packages/convex/confect/buildPacks/packs.impl.ts`
- Modify: `packages/convex/confect/buildPacks/maestro.impl.ts`
- Modify: `packages/convex/confect/tables/buildPacks.ts`
- Modify: `packages/convex/confect/tables/buildPackStages.ts`
- Modify generated: `packages/convex/confect/_generated/**`
- Modify generated: `packages/convex/convex/_generated/**`
- Modify: `packages/convex/test/build-pack-pipeline.test.ts`
- Modify: `apps/web/src/features/public-funnel/build-pack/build-pack-storage.ts`
- Modify:
  `apps/web/src/features/public-funnel/build-pack/build-pack-storage.test.ts`
- Modify: `apps/web/src/features/public-funnel/build-pack/build-pack-view.tsx`
- Modify:
  `apps/web/src/features/public-funnel/build-pack/build-pack-view.test.tsx`

**Interfaces:**

```ts
export type BuildPackContractDraft = {
  readonly path: `features/${string}.feature`;
  readonly draftGherkin: string;
  readonly journeyId: `journey_${string}`;
  readonly primary: boolean;
  readonly draftDigest: `sha256:${string}`;
};

export type ExportedBuildPackContract = {
  readonly path: `features/${string}.feature`;
  readonly journeyId: `journey_${string}`;
  readonly primary: boolean;
  readonly approvedDigest: `sha256:${string}`;
  readonly repository: string;
  readonly commitSha: string;
};

export type ApproveBuildPackContractInput = {
  readonly packId: string;
  readonly expectedDraftDigest: `sha256:${string}`;
  readonly approvedGherkin: string;
};
```

- [ ] **Step 1: Write red state-machine tests.** V1 packs remain readable and
      display-only. V2 `specify` produces draft Gherkin, then the run pauses in
      `awaiting-review`; automatic model execution cannot advance it. Stale
      digest, non-owner/non-`build_pack:approve`, edit-after-approval, duplicate
      resume, and export of unapproved bytes fail.

- [ ] **Step 2: Write red exact-export tests.** Successful CAS approval records
      server-derived actor/time and exact digest, compile exports exactly those
      bytes, map-to-Maestro passes paths plus primary journey to `create --spec`
      or `contracts add --spec`, failed export retains approved bytes for
      idempotent retry, and successful checked-in export replaces the byte copy
      with provenance.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator exec vitest run src/buildPack.test.ts src/premiumPipeline.test.ts src/maestroMapping.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/build-pack-pipeline.test.ts`

  Expected: FAIL because the current automatic `review` stage advances and
  mapping concatenates acceptance prose into `gates`.

- [ ] **Step 4: Version the existing model, do not add a contract store.** Add
      V2 decoding and `awaiting-review` to the current Build Pack/run/stage
      rows. `specify` creates drafts; authenticated CAS approval stores exact
      bytes only until export. V1 `userJourneys`/`acceptanceCriteria` remain
      readable but can never authorize admission.

- [ ] **Step 5: Make review a human mutation.** Reuse workspace authorization
      and the canonical `build_pack:approve` policy. Derive actor and timestamp
      on the server, compare the expected digest atomically, revalidate the
      approved Feature, and resume `compile` idempotently. An edit creates a new
      digest and returns to awaiting review.

- [ ] **Step 6: Delete prose gates from mapping.** `maestroMapping.ts` emits
      exact contract file content/path/primary journey and work-package
      references to stable journey/scenario IDs. Derive legacy display
      journeys/outcomes from the current draft before export and from checked-in
      Features after export.

- [ ] **Step 7: Add the smallest review UI.** Reuse existing Build Pack view and
      form components to show exact Gherkin, edit, approve, stale-draft error,
      and export state. No contract dashboard or receipt browser.

- [ ] **Step 8: Run green and commit.**

  Run on a connected codegen worker: `rtk pnpm confect:codegen`

  Run on a connected codegen worker: `rtk pnpm convex:codegen`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator exec vitest run src/buildPack.test.ts src/premiumPipeline.test.ts src/maestroMapping.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/build-pack-pipeline.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run src/features/public-funnel/build-pack/build-pack-storage.test.ts src/features/public-funnel/build-pack/build-pack-view.test.tsx`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:convex`

  ```bash
  rtk git add packages/app-idea-evaluator/src packages/convex/confect/buildPacks packages/convex/confect/tables/buildPacks.ts packages/convex/confect/tables/buildPackStages.ts packages/convex/confect/_generated packages/convex/convex/_generated packages/convex/test/build-pack-pipeline.test.ts apps/web/src/features/public-funnel/build-pack
  rtk git commit -m "feat: require human gherkin approval"
  ```

**Unlock:** AI may draft behavior but cannot approve bytes or mint a verdict.

---

### Task 16: Add Atomic Existing-App Contracts Audit

**Class:** `pattern-instance`  
**PR:** `U1`  
**Depends on:** `C12`; rebase after `F1` and `F2` before merge

**Files:**

- Modify: `tooling/release/src/upgrade/contract.ts`
- Create: `tooling/release/src/upgrade/contract.test.ts`
- Modify: `tooling/release/src/upgrade/plan.ts`
- Modify: `tooling/release/src/upgrade/plan.test.ts`
- Modify: `tooling/release/src/upgrade/applyCollisionFree.ts`
- Modify: `tooling/release/src/upgrade/applyCollisionFree.test.ts`
- Modify: `tooling/release/src/upgrade/repository.ts`
- Modify: `tooling/release/src/upgrade/repository.test.ts`
- Modify: `tooling/release/src/customerTarget/manifest.ts`
- Modify: `tooling/release/src/customerTarget/manifest.test.ts`
- Modify: `tooling/release/src/customerTarget/createAdapter.ts`
- Modify: `tooling/release/src/customerTarget/createAdapter.test.ts`
- Modify: `schemas/maestro-customer-release-manifest.schema.json`
- Modify: `tooling/release-seal.mts`
- Modify: `tooling/release-seal.test.mts`
- Modify: `apps/cli/src/factory/contracts.ts`
- Modify: `apps/cli/src/factory/contracts.test.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Generate in the disposable audit target, never stage in this factory PR:
  `.maestro/contracts-legacy-baseline.json`
- Create: `docs/template/contracts-upgrade.md`

**Interfaces:**

```ts
import type { ContractsLegacyBaseline } from "@maestro-template/template-core/publicSurface";

export type ContractsAuditReleaseClosure = {
  readonly paths: readonly {
    readonly path: string;
    readonly sha256: `sha256:${string}`;
  }[];
  readonly digest: `sha256:${string}`;
};

export type ContractsAuditUpgrade = {
  readonly mode: "contracts-audit";
  readonly source: {
    readonly releaseVersion: string;
    readonly releaseRootCommit: string;
    readonly releaseManifestDigest: `sha256:${string}`;
  };
  readonly target: {
    readonly kind: "template-instance" | "unmanaged-existing-repository";
    readonly preAuditCommit: string;
  };
  readonly baseline: ContractsLegacyBaseline;
  readonly stagedInventoryDigest: `sha256:${string}`;
  readonly stagedPaths: readonly {
    readonly path: string;
    readonly sha256: `sha256:${string}`;
  }[];
  readonly enforcement: false;
};
```

- [ ] **Step 1: Write red audit-plan tests.** Capture all pre-guard public
      surfaces exactly once; keep them enabled and label them
      `legacy behavior unadmitted`; require contracts/darkness for every new
      surface; reject baseline growth, changed authority key under an old ID,
      removal without admitted coverage, hand-edited digest, and enforcement
      while nonempty. Make the sealed customer-release manifest carry one exact
      sorted `contractsAudit` path/digest closure derived from its existing
      path-ownership graph; unknown, missing, duplicate, factory-only, or
      digest-mismatched entries fail sealing.

- [ ] **Step 2: Write red atomic-apply tests.** Simulate collision, stale
      preimage, generator failure, static verification failure, process
      interruption, unavailable target, an unmanaged repository with no
      `template-instance.json`, and a command run from the wrong repository.
      Each failure leaves original files byte identical. Success stages exactly
      the manifest closure plus baseline, proves every old entrypoint remains
      available, then swaps as one transaction. Unmanaged audit does not invent
      a template-instance provenance claim.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/upgrade/contract.test.ts src/upgrade/plan.test.ts src/upgrade/applyCollisionFree.test.ts src/upgrade/repository.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/contracts.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts`

  Expected: FAIL because no exact contracts-audit release closure or unmanaged
  adoption command exists.

- [ ] **Step 4: Extend the staged transaction behind one explicit command.** Add
      `maestro-template contracts audit --release-root <absolute-clean-root> --to <exact-version> --target-root <absolute-clean-root> --write`
      to the existing `contracts` handler. The executable must come from the
      same immutable release root it verifies. For a recognized template
      instance, reuse its upgrade authority; for an unmanaged existing
      repository, stage only the sealed `contractsAudit` closure and baseline.
      Generate the content-addressed baseline from the pre-guard exhaustive
      inventory, run static checks in the staged root, and atomically apply only
      when legacy reachability is unchanged. The result records the release
      manifest digest, release-root commit, target pre-audit commit, and every
      staged path/digest. Persist that closed `ContractsAuditUpgrade` envelope
      at `.maestro/contracts-legacy-baseline.json`; do not maintain a second
      installation receipt.

- [ ] **Step 5: Make reduction monotonic.** Subsequent upgrades may remove a
      baseline surface only when generated admitted coverage owns it. When the
      set reaches empty, the same staged transaction deletes the file and flips
      full enforcement. Emergency deny remains independent and is never cleared.

- [ ] **Step 6: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/upgrade/contract.test.ts src/upgrade/plan.test.ts src/upgrade/applyCollisionFree.test.ts src/upgrade/repository.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/contracts.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts`

  ```bash
  rtk git add tooling/release/src/upgrade tooling/release/src/customerTarget/manifest.ts tooling/release/src/customerTarget/manifest.test.ts tooling/release/src/customerTarget/createAdapter.ts tooling/release/src/customerTarget/createAdapter.test.ts schemas/maestro-customer-release-manifest.schema.json tooling/release-seal.mts tooling/release-seal.test.mts apps/cli/src/factory/contracts.ts apps/cli/src/factory/contracts.test.ts apps/cli/src/factory/composition.ts docs/template/contracts-upgrade.md
  rtk git commit -m "feat: add atomic contracts audit adoption"
  ```

**Unlock:** Working existing apps can adopt the harness without an outage or a
false retroactive admission claim.

---

### Task 17: Bind Promotion To One Immutable Multi-Component Manifest

**Class:** `pattern-instance`  
**PR:** `R1`  
**Depends on:** `C12`; rebase after `F1`, `F2`, and `U1` before merge

**Files:**

- Create: `tooling/release/src/deploy/releaseManifest.ts`
- Create: `tooling/release/src/deploy/releaseManifest.test.ts`
- Modify: `tooling/release/src/deploy/contract.ts`
- Modify: `tooling/release/src/deploy/authority.ts`
- Modify: `tooling/release/src/deploy/trustedAuthority.ts`
- Modify: `tooling/release/src/deploy/requirements.ts`
- Modify: `tooling/release/src/deploy/decision.ts`
- Modify: `tooling/release/src/deploy/verdict.ts`
- Modify: `tooling/release/src/deploy/verify.ts`
- Modify: `tooling/release/src/deploy/audit.ts`
- Modify: `tooling/release/src/deploy/census.ts`
- Modify: `tooling/release/src/deploy/censusEndpoint.ts`
- Modify: `tooling/release/src/deploy/checkpoint.ts`
- Modify: `tooling/release/src/deploy/closure.test.ts`
- Modify: `tooling/release/src/deploy/consumption.ts`
- Modify: `tooling/release/src/deploy/durableAuthority.ts`
- Modify: `tooling/release/src/deploy/guardedDeploy.ts`
- Modify: `tooling/release/src/deploy/audit.test.ts`
- Modify: `tooling/release/src/deploy/authority.test.ts`
- Modify: `tooling/release/src/deploy/census.test.ts`
- Modify: `tooling/release/src/deploy/censusEndpoint.test.ts`
- Modify: `tooling/release/src/deploy/checkpoint.test.ts`
- Modify: `tooling/release/src/deploy/decision.test.ts`
- Modify: `tooling/release/src/deploy/durableAuthority.test.ts`
- Modify: `tooling/release/src/deploy/fullChain.test.ts`
- Modify: `tooling/release/src/deploy/requirements.test.ts`
- Modify: `tooling/release/src/deploy/verdict.test.ts`
- Modify: `.woodpecker/deploy.yml`
- Modify: `tooling/acceptance/selection-manifest.ts`
- Modify: `tooling/acceptance/selection-manifest.test.ts`
- Modify: `tooling/acceptance/mutation-gauntlet.mts`
- Modify: `tooling/acceptance/mutation-gauntlet.test.mts`

**Interfaces:**

```ts
export type ComponentIdentity = {
  readonly digest: `sha256:${string}`;
  readonly deploymentId?: string;
};

export type ReleaseManifestV2 = {
  readonly schemaVersion: 2;
  readonly sourceSha: string;
  readonly components: {
    readonly web: ComponentIdentity;
    readonly cli: ComponentIdentity;
    readonly backend: Required<ComponentIdentity>;
    readonly schemaMigration: ComponentIdentity;
    readonly runtimeConfig: ComponentIdentity;
    readonly admissionPolicy: ComponentIdentity;
  };
  readonly rollbackCompatibleManifestDigests: readonly `sha256:${string}`[];
};

export function digestReleaseManifest(
  manifest: ReleaseManifestV2,
): `sha256:${string}`;
```

- [ ] **Step 1: Write red canonical-manifest tests.** Prove stable sorted JSON
      hashing, all six required components, lowercase SHA-256 format, backend
      deployment identity, source SHA, duplicate/malformed fields, and byte
      changes in each component. V1 singular-artifact records remain readable
      for audit but cannot authorize a V2 promotion.

- [ ] **Step 2: Write red authority-chain tests.** Readiness, approval,
      authorization, verdict, receipt, audit, census, checkpoint, and closure
      must all bind the same `releaseManifestDigest`; a singular `artifactHash`
      cannot substitute. Platform observations for web/CLI/backend must match
      the manifest, and staging/prod observations cannot be copied from
      application self-report.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/deploy/releaseManifest.test.ts src/deploy/fullChain.test.ts src/deploy/requirements.test.ts src/deploy/checkpoint.test.ts`

  Expected: FAIL because the existing authority centers on one artifact hash.

- [ ] **Step 4: Extend the authority in place.** Add V2 decoding and propagate
      only the manifest digest through existing decisions/receipts. Build each
      component once in the trusted post-merge job, hash web, canonical built
      CLI, backend input/deployment, generated schema/migration, normalized
      runtime config, and generated admission policy, then persist one immutable
      manifest. Do not create a parallel deploy service.

- [ ] **Step 5: Add exact staging-proof selection.** Define a
      `StagingSelectionManifest` containing exactly every admitted Pickle
      carrying `@staging-proof`. It reuses the same expected inventory and
      Messages verifier, cannot mint the PR required context, rejects zero when
      staging-proof Pickles exist, and never enables local issuer/bootstrap.
      This separate promotion selection avoids weakening authoritative PR
      selection, which remains the full admitted inventory.

- [ ] **Step 6: Promote and rollback manifests, never loose artifacts.** Deploy
      the exact digest to isolated staging, run strict staging-proof contracts
      with restricted identities, query platform APIs for component/deployment
      IDs, promote that digest, then query production again. Rollback selects a
      recorded digest that the trusted schema/migration compatibility check
      placed in the list; candidate input cannot declare compatibility. It never
      clears emergency deny.

- [ ] **Step 7: Append the release drift mutation.** Add
      `release-component-outside-manifest` to the shared mutation registry.
      Change one staged component after manifest creation and require
      platform-observed digest mismatch. The registry now contains 26 cases.

- [ ] **Step 8: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/deploy`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/selection-manifest.test.ts tooling/acceptance/mutation-gauntlet.test.mts`

  ```bash
  rtk git add tooling/release/src/deploy .woodpecker/deploy.yml tooling/acceptance/selection-manifest.ts tooling/acceptance/selection-manifest.test.ts tooling/acceptance/mutation-gauntlet.mts tooling/acceptance/mutation-gauntlet.test.mts
  rtk git commit -m "feat: bind promotion to release manifest"
  ```

**Unlock:** Staging, promotion, production verification, and rollback name the
same immutable multi-component product.

---

### Task 18: Cut Over The Protected Woodpecker Merge-Candidate Authority

**Class:** `pattern-instance`  
**PR:** `W1`  
**Depends on:** `R1` and a green Task 10 canary on the actual Woodpecker agent

**Files:**

- Create: `tooling/ci/mergeCandidate.mts`
- Create: `tooling/ci/mergeCandidate.test.mts`
- Modify: `tooling/ci/ci-self-protection.sh`
- Create: `tooling/ci/ci-self-protection.test.mts`
- Modify: `tooling/ci/phase1.sh`
- Modify: `.woodpecker/verify.yml`
- Modify: `tooling/quality/woodpecker-template-pipeline.test.mts`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `.github/CODEOWNERS`
- Modify: `package.json`
- Delete: `tooling/stack/submit.mts`
- Delete: `tooling/stack/submit.test.mts`
- Delete: `tooling/stack/merge.mts`
- Delete: `tooling/stack/merge.test.mts`
- Delete: `tooling/stack/sync.mts`
- Delete: `tooling/stack/sync.test.mts`
- Delete: `tooling/stack/merge-preflight.mts`
- Delete: `tooling/stack/merge-preflight.test.mts`
- Modify: `tooling/stack/exec.mts`
- Modify: `tooling/stack/exec.test.mts`
- Modify: `tooling/acceptance/mutation-gauntlet.mts`
- Modify: `tooling/acceptance/mutation-gauntlet.test.mts`
- Create: `docs/template/product-contract-ci-operations.md`

**Interfaces:**

```ts
export type ProtectedMergeCandidate = {
  readonly repository: string;
  readonly baseRef: string;
  readonly baseOid: string;
  readonly headOid: string;
  readonly mergeGroupOid: string;
};

export type CandidateDeltaClass =
  "ordinary" | "admission" | "control-plane" | "invalid-mixed";

export function classifyCandidateDelta(input: {
  readonly basePaths: ReadonlyMap<string, Uint8Array>;
  readonly mergeGroupPaths: ReadonlyMap<string, Uint8Array>;
}): CandidateDeltaClass;
```

- [ ] **Step 1: Write red tuple/classifier tests.** Reject absent/wrong repo,
      base ref/OID, head OID, merge-group OID, checkout not equal to merge
      group, admitted lifecycle absent from protected base, admission plus any
      protected control path, and control changes hidden in another batched pull
      request. A semantic lifecycle-only edit of an already-assembling Feature
      is the admission delta itself, not a control-plane edit; changing that
      Feature's prose, scenarios, tags other than lifecycle, or step/support
      code in the same candidate is `invalid-mixed`. Base movement reruns the
      tuple check; unchanged PR head retains its approval; changed PR head
      requires fresh approval.

- [ ] **Step 2: Write red pipeline trust tests.** Prove candidate verify has no
      `GITHUB_TOKEN`, BWS/Cloudflare/provider/staging/production secret, Docker
      socket, or host environment. Prove a PR-modified pipeline cannot choose or
      post `ci/woodpecker/pr/verify`; required control is loaded from protected
      target/server state. Qlty failure/timeout cannot fail the required
      context.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/mergeCandidate.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts`

  Expected: FAIL because current candidate verify receives `GITHUB_TOKEN` and
  its pipeline root is candidate-readable authority.

- [ ] **Step 4: Land protected control code before authority changes.** Publish
      the reviewed `controller.Dockerfile` image from protected main and record
      its immutable digest in the Woodpecker repository/server configuration.
      Configure the required pipeline root from protected target SHA or
      server-side state; keep the PR-head `.woodpecker/verify.yml` advisory
      until observation proves the protected root. The required run loads
      launcher, config, compiler, verifier, drivers, and step/support adapters
      from protected base while reading candidate Feature bytes and launching
      the merge-group product artifacts. A dedicated control-plane PR runs its
      proposed adapters in a separate non-authoritative observation pass; they
      become required authority only after merge to protected main. The
      protected controller alone queries GitHub approvals, branch protection,
      merge queue, app/context binding, and posts status.

- [ ] **Step 5: Make candidate execution secretless.** Remove `GITHUB_TOKEN`
      from the candidate step, run sandboxed deterministic gates and
      `pnpm acceptance`, and return evidence to controller-owned storage. Move
      PR-health, unresolved-thread, branch-protection, and tuple queries outside
      the candidate namespace. Run Qlty in a separate advisory step with a hard
      30-second cap and remove `check:qlty` from root blocking `verify`.

- [ ] **Step 6: Protect every contract authority.** Add CODEOWNER coverage for
      `features/**`, `cucumber.cjs`, `tooling/acceptance/**`, public
      registration and generator provenance, auth policies/principals, generated
      inventory and projection sources, `package.json`, `pnpm-lock.yaml`,
      `Justfile`, Woodpecker config, CI self-protection, and CODEOWNERS.
      External preflight requires a non-author code-owner approval for exact
      `headOid`, stale-approval dismissal, administrator/bypass enforcement,
      exact `{context, app_id}`, and batch size one for admission/control
      changes.

- [ ] **Step 7: Remove Graphite mutations, keep read-only planning.** Delete
      submit/merge/sync/preflight paths and their package scripts. Retain stack
      plan validation and read-only GitHub status reporting. Operators use
      normal GitHub pull requests, explicit base only for real code dependency,
      auto-merge/merge queue, and bottom-up order.

- [ ] **Step 8: Append the two CI mutations.** Add
      `candidate-pipeline-success-noop` and `mixed-admission-control-delta`;
      require that the first cannot post the app-bound context and the second is
      rejected by the protected classifier. The registry now contains all 28
      cases.

- [ ] **Step 9: Run green and commit source before the external cutover.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/mergeCandidate.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts tooling/acceptance/mutation-gauntlet.test.mts`

  ```bash
  rtk git add tooling/ci .woodpecker/verify.yml tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.mts tooling/quality/check-config-drift.test.mts .github/CODEOWNERS package.json tooling/stack tooling/acceptance/mutation-gauntlet.mts tooling/acceptance/mutation-gauntlet.test.mts docs/template/product-contract-ci-operations.md
  rtk git commit -m "ci: protect merge candidate contract verdict"
  ```

- [ ] **Step 10: Merge source, then run the complete gauntlet and observation.**
      Merge `W1` while the existing required rule remains active. From its
      committed protected-main SHA, run on the remote worker:
      `rtk maestro-remote-test -- pnpm test:mutation`.

  Run the protected observation pipeline on a test pull request, then mutate its
  PR-head pipeline to a no-op and rerun. Expected: all 28 intended faults are
  caught; only the protected controller posts the observed context; the
  candidate no-op cannot do so.

- [ ] **Step 11: Atomically change branch protection.** Confirm the exact
      Woodpecker App ID/context from observation, enable the protected pipeline,
      require exact `{context: "ci/woodpecker/pr/verify", app_id}`, enable
      current merge-candidate verification and code-owner/stale/admin rules,
      then remove any retired required context in the same operator window. If
      any live query differs from the preflight, stop without removing the old
      required rule.

**Unlock:** The sole required status now proves the exact protected merge
candidate with approved control code and no candidate secrets.

---

### Task 19: Seal The Immutable Brain Pilot Release Candidate

**Class:** `fixture-to-real`

**PR:** `P1`

**Depends on:** `F1`, `F2`, `B1`, `U1`, `R1`, and `W1` merged on protected main,
plus the green 28-case gauntlet

**Repository:** `maestro-template-saas-ui`

**Files:**

- Generate and add: `releases/v0.2.0-alpha.3-pilot.1/**`

**Interface:**

```ts
export type PilotReleaseBinding = {
  readonly version: "0.2.0-alpha.3-pilot.1";
  readonly tag: "maestro-template-v0.2.0-alpha.3-pilot.1";
  readonly sourceCommit: string;
  readonly releaseCommit: string;
  readonly manifestDigest: `sha256:${string}`;
  readonly contractsAuditPathDigest: `sha256:${string}`;
};
```

- [ ] **Step 1: Freeze the source candidate.** Start from a clean protected-main
      worktree after every dependency has merged. Record its 40-character HEAD;
      the release candidate may contain both new Cucumber authority and the old
      journey machinery, because Task 21 deletes the old machinery only after
      the real pilot passes.

- [ ] **Step 2: Seal the non-default pilot version.** Run
      `rtk pnpm release:seal -- --version 0.2.0-alpha.3-pilot.1 --source-commit <recorded-40-character-source-sha>`.
      It must generate a materializable release with the exact contracts-audit
      path/digest closure from Task 16. Do not change create composition or the
      alpha.2 default.

- [ ] **Step 3: Verify the candidate before committing.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts tooling/release/src/customerTarget/manifest.test.ts tooling/release/src/upgrade/repository.test.ts`

  Expected: the release source, complete path hashes, contract-audit closure,
  CLI compatibility, and source ancestry all match; a byte change is red.

- [ ] **Step 4: Commit and bind the immutable tag.**

  ```bash
  rtk git add releases/v0.2.0-alpha.3-pilot.1
  rtk git commit -m "release: seal cucumber contracts brain pilot"
  ```

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm release:seal -- --check --version 0.2.0-alpha.3-pilot.1 --source-commit <recorded-40-character-source-sha>`

  Run P1 through the protected merge queue. After the release bytes are on
  protected main, rerun the check against that commit, then bind it with
  `rtk git tag maestro-template-v0.2.0-alpha.3-pilot.1 <verified-protected-main-release-commit>`.
  Verify the tag resolves to that release commit and the manifest records the
  earlier source commit; never move or reuse it. Record the complete
  `PilotReleaseBinding` in the Brain `M0` pull-request description.

**Unlock:** Brain can adopt one exact release with one exact CLI and manifest;
the pilot no longer depends on the final alpha.3 seal.

---

### Task 20: Pilot One Real Maestro Brain Journey

**Class:** `fixture-to-real`

**PRs:** audit installation `M0`, `M1a` through `M1d`, then admission-only `M2`

**Depends on:** immutable pilot release `P1`. The pilot validates that exact
manifest before Task 21 seals the public alpha.3 release; production adoption
uses the resulting public release, not the pilot tag.

**Repository:** `/Users/headless/maestro`, from a clean isolated worktree based
on its then-current protected `origin/main`. Do not use the existing dirty
checkout.

**Files:**

- Generate in `M0`: every exact path/digest in the immutable P1 manifest's
  `contractsAudit` closure, and no path outside it
- Create in `M0`: `.maestro/contracts-legacy-baseline.json`
- Create: `features/brain_grounded_content.feature`
- Create: `features/step_definitions/brain_grounded_content.steps.ts`
- Create: `features/support/brain-fixtures.ts`
- Modify: `packages/convex/convex/registry/headlessSurfaces.ts`
- Modify: `packages/convex/convex/registry/headlessSurfaces.test.ts`
- Modify: `packages/convex/convex/capabilities/brain/claimCandidateReview.ts`
- Modify:
  `packages/convex/convex/capabilities/brain/claimCandidateReview.test.ts`
- Modify: `packages/convex/convex/capabilities/brain/contextPacksPublic.ts`
- Modify: `packages/convex/convex/capabilities/brain/contextPacks.test.ts`
- Modify: `packages/convex/convex/capabilities/content/postGenerations.ts`
- Modify: `packages/convex/convex/capabilities/content/postGenerations.test.ts`
- Modify: `apps/web/src/features/brain/brain-learning-review-adapter.ts`
- Modify: `apps/web/src/features/brain/brain-learning-review-adapter.test.ts`
- Modify: `apps/web/src/features/brain/brain-accepted-sources.tsx`
- Modify: `apps/web/src/features/brain/brain-accepted-sources.test.tsx`
- Modify: `apps/web/src/features/posts/posts-generation-controls.commands.ts`
- Modify: `apps/web/src/features/posts/posts-generation-start-request.test.ts`
- Modify: `tooling/maestro-cli/src/maestro.ts`
- Modify generated: `tooling/maestro-cli/generated/headless-contract.json`

**Feature outcome:** An authorized member reviews call-backed client context,
resolves a real conflict, activates the supported context, and produces a
durable grounded content draft with resolvable citations. An authorized agent
can inspect or initiate the same outcome through the built CLI. Read-only,
unauthenticated, and foreign-tenant actors are denied through their distinct
transports.

- [ ] **Step 0: Satisfy Maestro's plan-first intake rule.** Bind this pilot to a
      concrete Brain Linear story, generate/review its required approved-plan
      bundle with the repository's normal `story-to-spec` and `plan` commands,
      and cite that immutable bundle in `M1a` through `M2`. If no suitable story
      exists, the operator creates one before implementation; no product file
      changes begin without the approved bundle.

- [ ] **Step 1 (`M0`): Install the exact pilot contract closure.** Create the
      clean target worktree at
      `/Users/headless/.worktrees/maestro-brain-grounded-content` from Maestro's
      then-current protected main and a clean detached P1 worktree at
      `/Users/headless/.worktrees/maestro-template-alpha3-pilot1`. Verify its
      tag and manifest against the recorded `PilotReleaseBinding`, install its
      exact locked toolchain without lifecycle scripts, confirm the checkout
      remains clean, then run:

  ```bash
  rtk pnpm --dir /Users/headless/.worktrees/maestro-template-alpha3-pilot1 install --frozen-lockfile --ignore-scripts
  rtk git -C /Users/headless/.worktrees/maestro-template-alpha3-pilot1 status --short
  rtk pnpm --dir /Users/headless/.worktrees/maestro-template-alpha3-pilot1 exec tsx apps/cli/src/index.ts contracts audit --release-root /Users/headless/.worktrees/maestro-template-alpha3-pilot1 --to 0.2.0-alpha.3-pilot.1 --target-root /Users/headless/.worktrees/maestro-brain-grounded-content --write
  ```

  Expected before the audit command: the status output is empty.

  Review the generated path/digest list against the immutable manifest. The
  transaction must recognize Maestro as `unmanaged-existing-repository`, avoid
  creating `template-instance.json`, keep every legacy surface enabled and
  unadmitted, and install `acceptance:check`. Commit the exact generated closure
  as `build: install cucumber contracts audit` and merge M0 before product
  slices.

- [ ] **Step 2 (`M1a`): Add only an assembling contract.** Review the frozen
      legacy baseline, then add `@journey_brain_grounded_content @assembling`
      with UI, CLI, cross-surface, authentication, authorization, and
      tenant-isolation scenarios. Given may seed synthetic
      client/source/call/candidate/conflict state, but not activation, resolved
      conflict, generated draft, or citations.

  Run: `rtk pnpm acceptance:check`

  Expected: PASS with unresolved assembling coverage/undefined steps reported as
  work; all legacy behavior remains enabled and unadmitted.

  Commit: `test: assemble brain grounded content contract`

- [ ] **Step 3 (`M1b`): Register and implement UI authority while dark.** Add
      stable surface/auth/activation metadata to the existing claim-review,
      accepted-source, and post-generation controls. Reuse current capabilities
      and durable citation substrate; do not add Brain tables. Wire real
      accessible UI actions/outcomes and keep all newly activation-owned
      controls absent while the journey is assembling.

  Run focused UI/capability tests, `rtk pnpm acceptance:check`, and all
  previously admitted journeys. Expected: PASS; direct raw invocation remains
  denied.

  Commit: `feat: wire assembling brain ui journey`

- [ ] **Step 4 (`M1c`): Register and implement CLI authority while dark.** Add
      generated headless surfaces for context inspection and generation
      initiation, with API-key scopes, server-derived tenant, and the same
      internal capability implementations as UI. Regenerate the installable CLI
      contract; do not create a second Brain workflow.

  Run focused registry/CLI/auth tests and `rtk pnpm acceptance:check`. Expected:
  PASS; missing/read-only/foreign keys receive the declared denial classes.

  Commit: `feat: wire assembling brain cli journey`

- [ ] **Step 5 (`M1d`): Implement trusted steps and make a local temporary flip
      green.** Steps use Playwright/external CLI only; deterministic fake model
      provider stays behind the real server provider boundary and returns the
      same typed durable draft/citations. Temporarily flip the local dirty
      Feature to admitted, regenerate projection, run
      `rtk pnpm acceptance:focus --journey journey_brain_grounded_content`, then
      restore assembling and verify the worktree diff before commit.

  Expected: every positive/negative/cross-surface Pickle passes, and no
  When/Then outcome was seeded.

  Commit: `test: execute assembling brain product contract`

- [ ] **Step 6: Merge `M1a` through `M1d` bottom-up through GitHub.** Each pull
      request retains assembling, runs existing admitted regressions and
      darkness, and receives code/product-owner review for its implementation
      paths. Do not batch any slice with a control-plane change.

- [ ] **Step 7 (`M2`): Create the current-main admission-only pull request.**
      From protected main after all four slices merge, change only
      `@assembling -> @admitted`. If complete current-main execution exposes any
      repair, close M2, land that repair in a new assembling `M1e` slice, rerun
      the temporary local flip, and create a fresh lifecycle-only M2. The
      Feature must already exist assembling on the immutable protected base. Use
      merge-queue batch size one.

  Expected required evidence: full admitted inventory selected; Brain UI, built
  CLI, cross-surface, auth, tenant, runtime identity, exact Messages, and every
  older admitted journey pass for the exact merge-group tuple.

  Commit: `test: admit brain grounded content journey`

**Unlock:** The first real product—not the fixture—has a deterministic
natural-language completion contract across human UI and agent CLI.

---

### Task 21: Delete Superseded Machinery And Seal `v0.2.0-alpha.3`

**Class:** `fixture-to-real`

**PRs:** deletion `D1`, then public release `D2`

**Depends on:** immutable `P1`, the green 28-case mutation gauntlet, and merged
Brain admission `M2`. Do not perform any deletion on a weaker evidence set.

**Files:**

- Delete: `packages/product-journey/**`
- Delete: `tooling/quality/check-product-journeys.mts`
- Delete: `tooling/quality/check-product-journeys.test.mts`
- Delete:
  `docs/superpowers/specs/2026-08-01-product-journey-admission-design.md`
- Delete:
  `docs/superpowers/plans/2026-08-01-product-journey-admission-and-brain-completion.md`
- Modify: `package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/types.ts`
- Modify: `apps/cli/src/router.ts`
- Modify: `apps/cli/src/commands.ts`
- Generate and add: `releases/v0.2.0-alpha.3/**`
- Modify: `apps/cli/src/factory/createComposition.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `docs/template/customer-target-contract.md`

- [ ] **Step 1: Write deletion guards red.** Assert no import/script/Just
      recipe, gate definition, generated projection, docs index, package
      reference, or release source references `product-journey`,
      `check:product-journeys`, recipe `doneState`, generated CRUD proof,
      generic add-feature, Graphite mutation, or in-process capability
      execution.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-ci-completeness.test.mts tooling/quality/check-generators.test.mts apps/cli/src/index.test.ts`

  Expected: FAIL while superseded journey/package/CLI compatibility references
  remain.

- [ ] **Step 3: Delete only the proven duplicates.** Remove the custom journey
      package/gate and active August 1 design/plan; Git history preserves them.
      Remove their scripts, gate definitions, and customer projection closure.
      Delete the synchronous `runCli`/sync capability handler now that reference
      and Brain CLI acceptance prove `runCliAsync` over HTTP; retain local
      catalog/help behavior through the async dispatcher.

- [ ] **Step 4 (`D1`): Commit only the proven deletion.** The release sealer
      requires a clean source commit, so do not generate alpha.3 or update the
      default composition in this pull request.

  ```bash
  rtk git add -A packages/product-journey tooling/quality/check-product-journeys.mts tooling/quality/check-product-journeys.test.mts docs/superpowers/specs/2026-08-01-product-journey-admission-design.md docs/superpowers/plans/2026-08-01-product-journey-admission-and-brain-completion.md package.json Justfile tooling/quality/src/check-definitions.mts tooling/generators/src/blueprints/saasRegistrationProjections.ts apps/cli/src/index.ts apps/cli/src/index.test.ts apps/cli/src/types.ts apps/cli/src/router.ts apps/cli/src/commands.ts docs/template/app-factory-guide.md docs/template/customer-target-contract.md
  rtk git commit -m "refactor: remove superseded journey machinery"
  ```

- [ ] **Step 5: Verify and merge D1 before sealing.**

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts`

  Run on the remote worker: `rtk maestro-remote-test -- pnpm test:mutation`

  Run on the remote worker: `rtk maestro-remote-test -- pnpm verify`

  Run D1 through the protected Woodpecker merge queue. Expected: the pristine
  product passes, all 28 mutations are red for their named reason, and
  `ci/woodpecker/pr/verify` is green for the exact candidate. Qlty is advisory;
  no Buildkite/Fabro/Graphite authority is invoked.

- [ ] **Step 6 (`D2`): Seal from clean protected main.** After D1 merges, create
      a new clean current-main worktree, record its 40-character source SHA, and
      run
      `rtk pnpm release:seal -- --version 0.2.0-alpha.3 --source-commit <recorded-40-character-source-sha>`.
      Verify the generated manifest contains Cucumber/config/auth/controller,
      public-surface, contracts-audit, upgrade, and release assets and contains
      no custom journey/fake-proof machinery. Update create composition to the
      new immutable version/tag/checksums; never modify alpha.2 or the pilot
      release.

  Generate a fresh app with one and multiple assembling Features, verify exact
  byte copies/primary journey/darkness/zero-admitted behavior, run contracts-add
  preview/write, run the factory-only reference acceptance overlay, and run both
  template-instance and unmanaged contracts-audit fixtures.

- [ ] **Step 7: Commit, verify, merge, and tag D2.**

  ```bash
  rtk git add releases/v0.2.0-alpha.3 apps/cli/src/factory/createComposition.ts apps/cli/src/factory/createRootIntegration.test.ts docs/template/app-factory-guide.md docs/template/customer-target-contract.md
  rtk git commit -m "release: seal cucumber product contracts alpha.3"
  ```

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm release:seal -- --check --version 0.2.0-alpha.3 --source-commit <recorded-40-character-source-sha>`

  Run D2 through the protected merge queue. Only after the verified release
  commit is on protected main, run
  `rtk git tag maestro-template-v0.2.0-alpha.3 <verified-protected-main-release-commit>`
  and verify the tag, manifest source, and source checksum. Never move the tag.

**Final evidence:** Net duplicate journey/fake-proof code is deleted; one
official Cucumber execution chain proves behavior; new factory contracts begin
assembling; existing apps migrate without darkness; Brain passes UI and built
CLI; and only the app-bound Woodpecker merge-candidate verdict can authorize
admission.

## Spec-To-Task Traceability

| Approved success criterion                               | Proof task(s)      |
| -------------------------------------------------------- | ------------------ |
| Feature is sole behavioral contract                      | 1, 7, 13, 15, 21   |
| Create/contracts-add preserve assembling bytes           | 13                 |
| Shared route actions cannot hide                         | 2, 3, 12           |
| Exhaustive public inventory/raw bypass                   | 3, 4, 12           |
| UI/server darkness                                       | 4, 11, 12          |
| Stacked slices; final current-main admission             | 4, 18, 20          |
| Every Pickle/row/step executes once                      | 7, 8               |
| Exact Source/AST equality                                | 7, 8               |
| UI and built CLI share backend/identity                  | 6, 9, 11           |
| Per-transport auth denial                                | 2, 5, 11, 20       |
| Caller tenant cannot authorize                           | 5, 11, 12          |
| Wrong/zero/retry/hook/protocol/runtime drift fails       | 8, 9, 12           |
| Existing-app adoption has no outage/false admission      | 16, 19, 20         |
| Candidate is secretless and cannot forge evidence/status | 10, 12, 18         |
| App-bound exact merge-group tuple/approval               | 18                 |
| Staging tests/promotes one release manifest              | 17                 |
| Build Pack human exact-byte provenance                   | 15                 |
| Complete mutation gauntlet                               | 12, 17, 18, 19, 21 |
| Custom/fake machinery deleted after proof                | 14, 21             |
| Real Brain UI/CLI journey                                | 20                 |

## Final Program Verification

Run from committed current protected-main candidates, not a dirty design
worktree:

```bash
rtk maestro-remote-test -- pnpm acceptance:check
rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance
rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts
rtk maestro-remote-test -- pnpm test:mutation
rtk maestro-remote-test -- pnpm verify
```

Then verify external state from the protected controller:

- exact required context is `ci/woodpecker/pr/verify` bound to the observed
  Woodpecker App ID;
- merge queue/current-candidate enforcement and batch-one classification are
  active;
- code-owner approval is bound to the current PR head and stale approvals are
  dismissed;
- administrator/bypass actors are governed;
- candidate jobs have no secrets and the sandbox canary passes;
- the latest release manifest digest equals platform-observed web, CLI, backend,
  schema/migration, runtime-config, and admission-policy identities.

Do not declare the program complete from a branch-head test, a focused run, an
LLM review, an empty admitted inventory, or individually green slice pull
requests.
