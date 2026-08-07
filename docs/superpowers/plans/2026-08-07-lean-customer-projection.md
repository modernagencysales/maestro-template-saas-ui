# Lean Customer Projection Implementation Plan

> **For the lane owner:** Treat this as one continuous subsystem goal. Make
> coherent commits, run focused checks while authoring, and keep moving until
> the complete lane outcome is ready for review.

**Goal:** Generate a lean neutral SaaS customer target whose filesystem,
contracts, scripts, and handoff contain only the product chassis and explicitly
selected pattern groups, while retaining canonical factory patterns for later
use.

**Architecture:** Add a small typed selection input to the existing SaaS
blueprint composition and compose grouped `GeneratedFile[]` values: mandatory
chassis plus explicit records-example and workflow-automation groups. Shared
dependencies and deployment trust authority stay in the chassis; each optional
group contains only files it exclusively owns. The default selects no optional
product verticals, while canonical examples remain runnable in the factory.

**Tech Stack:** TypeScript, Node.js, pnpm workspaces, Vitest, Maestro
generator/release composition, Cucumber/Gherkin, Woodpecker CI.

## Global Constraints

- Base the delivery branch explicitly on current `origin/main`; do not edit the
  dirty `/Users/headless/maestro-template-saas-ui` checkout.
- Preserve useful factory patterns in their canonical source locations. Remove
  only their unselected projection into customer targets.
- Do not modify immutable historical release artifacts or the alpha.1/alpha.2
  reproduction paths.
- Do not add a generalized plugin framework or a new end-user CLI selector. Use
  a small typed option on the existing blueprint composition API.
- The factory and generated customer application remain distinct products.
- Generated targets retain Cucumber and the personalized
  `features/first-outcome.feature` as `@wip`.
- The records example remains runnable and tested in the factory and as an
  explicit `records-example` selection, but it is absent from a neutral target
  and cannot satisfy an unrelated customer's required contract.
- Keep workspace tenancy, path containment, protected-root, collision, privacy,
  secret-handling, and destructive-operation safeguards unchanged.
- Deployment authority is deferred and remains in the chassis unchanged. This
  lane does not make its files optional.
- Package scripts, workspace entries, lockfile importers, generated contracts,
  docs, and handoff must mention only materialized systems.
- Neutral blueprint identity, default outcome, domain nouns/entity, CRUD/route
  claims, governance, and seed metadata must not claim records. Those values
  move with `records-example`; immutable alpha builders retain their old values.
- Use repository-pinned tools. Run focused affected tests while authoring;
  Woodpecker owns full verification on the current PR head.
- Run repository-pinned Qlty on the lane diff with the host's 30-second cap for
  visibility; it is not admission authority.
- Woodpecker `ci/woodpecker/pr/verify` is the only blocking CI authority. Qlty
  remains visible and advisory.
- Qlty authoring thresholds are identical `12`, similar `15`, function
  complexity `10`, file complexity `50`, returns `5`, boolean logic `4`,
  parameters `5`, and nesting `4`; disclose its `tooling/**` exclusion and
  monitor debt. Preserve strict TypeScript, `99.7%` type coverage, Effect
  diagnostics, dependency-cruiser/Knip, Gitleaks, and tenant/security gates.
- If dependency metadata changes, demonstrate the need; update the lockfile and
  artifact allowlist; run license/vulnerability review, frozen offline install,
  Knip, and advisory OSV/Qlty evidence. CI installs with lifecycle scripts
  ignored.
- At lane startup, compare commits `326a2761a` through `76c24a137` once and
  record reusable records/current-composition hunks and rejected policies in the
  brief; do not repeat per-file archaeology.

## Scope Guard

This plan owns current customer projection, generated-customer metadata, records
acceptance classification, neutral `add-agent` output, and the bounded
shared-seam composition closure for the other four lane branches. It does not
reimplement their core behavior or change deployment security.

## Quality Targets

- `buildSaasApplicationTargetPlan()` with no selection omits records and
  workflow product paths while retaining deployment authority.
- A selected group contributes its exact complete, duplicate-free closure.
- No generated script, dependency, workspace importer, catalog entry, topology
  entry, or handoff sentence refers to an omitted group.
- The neutral plan is materially smaller, but no assertion uses file count or
  lines of code as the correctness criterion.
- Pattern groups are composed directly from their canonical `GeneratedFile[]`
  builders. Independent generated build/typecheck and representative behavior
  tests prove closure; a path list derived from the same group is not sole
  evidence.
- `buildAgentFiles` produces a declaration and provenance only; it does not
  invent threads, tools, UI seats, MCP, or headless runtime behavior.

## Delivery Batches

### Batch 1: Lean customer projection

- **Tasks:** 1–5.
- **Branch:** `codex/lean-customer-projection`.
- **Development base:** current `origin/main`; apply the published core-lane
  commits before closing shared projection/package/CI seams.
- **PR target:** `main`.
- **Focused task checks:** the exact Vitest commands named in Tasks 1–4 plus the
  generated-target integration command in Task 5.
- **Whole-batch review:** inspect `rtk git diff --check origin/main...HEAD`,
  `rtk git diff --stat origin/main...HEAD`, and
  `rtk git diff origin/main...HEAD`; ask one independent reviewer to verify
  pattern preservation, neutral omission, metadata closure, records acceptance,
  and agent output against the design.
- **Required verification:** push the branch, open one PR, and require a green
  `ci/woodpecker/pr/verify` for its current head.
- **Why one batch:** core lane commits and their generated compatibility jointly
  define one coherent template. One composed PR avoids repeated rebases and
  duplicate full CI while keeping shared hot files under one owner.

---

### Task 1: Define canonical selectable projection groups

**Files:**

- Create: `tooling/generators/src/blueprints/saasApplicationPatterns.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Test: `tooling/generators/src/blueprints/saasApplication.test.ts`

**Interfaces:**

- Consumes: existing `GeneratedFile`, projection builders, records vertical,
  workflow projections, chassis deployment authority, and replacement metadata.
- Produces: `SaasApplicationPatternId`, `SaasApplicationPatternSelection`,
  grouped file builders, and an optional `patterns` field on the existing
  target-plan/build-file options.

- [ ] **Step 1: Write failing selection-contract tests**

Add structural tests over the grouped files:

```ts
const pathSet = (plan: BlueprintTargetPlan) =>
  new Set(plan.entries.map(({ path }) => path));

it("omits optional pattern closures from the neutral target", () => {
  const neutral = pathSet(buildSaasApplicationTargetPlan());
  for (const file of buildOptionalSaasApplicationFiles({
    patterns: ["records-example", "workflow-automation"],
  }))
    expect(neutral.has(file.path), file.path).toBe(false);
});

it.each(
  Object.keys(SAAS_APPLICATION_PATTERN_GROUPS) as SaasApplicationPatternId[],
)("projects the complete %s closure when selected", (pattern) => {
  const selected = pathSet(
    buildSaasApplicationTargetPlan({
      name: "Selected App",
      patterns: [pattern],
    }),
  );
  expect(
    [...selected]
      .filter((path) =>
        buildOptionalSaasApplicationFiles({ patterns: [pattern] }).some(
          (file) => file.path === path,
        ),
      )
      .sort(),
  ).toEqual(
    buildOptionalSaasApplicationFiles({ patterns: [pattern] })
      .map(({ path }) => path)
      .sort(),
  );
});
```

Define exactly `records-example` and `workflow-automation` in this batch. Split
workflow projections into exclusively owned optional files and mandatory shared
chassis dependencies. Keep deployment authority in the chassis. Leave email,
headless access, readiness, support bundle, and other ambiguous shared files in
the chassis; moving those requires a later dependency-closure decision, not a
guess in this PR.

- [ ] **Step 2: Add the small typed selection boundary**

Create a data-only canonical registry shaped as follows. Move the workflow and
deployment path constants out of `saasRegistrationProjections.ts` into this file
so both the registry and projection builder import one owner and do not form a
circular dependency:

```ts
export type SaasApplicationPatternId =
  "records-example" | "workflow-automation";

export type SaasApplicationPatternSelection = Readonly<{
  patterns?: readonly SaasApplicationPatternId[];
}>;

export const buildOptionalSaasApplicationFiles = (
  selection: SaasApplicationPatternSelection,
): readonly GeneratedFile[] =>
  (selection.patterns ?? []).flatMap((id) => patternBuilders[id]());
```

Keep the map private and declarative. Reject duplicate paths across chassis and
optional groups in a focused test. Dependencies shared by more than one group
belong in the chassis; do not create hooks, manifests, receipts, plugin loading,
or dynamic discovery.

- [ ] **Step 3: Thread the selection through existing builders**

Extend, rather than replace, the existing options:

```ts
type BlueprintTargetPlanOptions = Readonly<{
  name: string;
  firstOutcome?: string;
  patterns?: readonly SaasApplicationPatternId[];
}>;

export const buildFactorySaasApplicationFiles = (
  options: BlueprintTargetPlanOptions,
): readonly GeneratedFile[] => {
  return [
    ...buildNeutralChassisFiles(options),
    ...buildOptionalSaasApplicationFiles(options),
  ];
};
```

Refactor the current monolithic arrays into named chassis and optional
`GeneratedFile[]` builders. Compose selected groups directly; do not build all
files and filter them through a path registry. Derive entries, registrations,
replacement metadata, and digest from the composed files.

- [ ] **Step 4: Preserve immutable historical builders and pass the focused
      test**

Keep `buildSaasApplicationAlpha1TargetPlan` and
`buildSaasApplicationAlpha2TargetPlan` byte-for-byte compatible with their
frozen authorities. Run the focused command from Step 2.

Expected: PASS; the neutral current plan omits optional closures, selected
current plans include complete closures, and immutable historical tests remain
green.

- [ ] **Step 5: Commit the canonical selection boundary**

```bash
rtk git add tooling/generators/src/blueprints/saasApplicationPatterns.ts tooling/generators/src/blueprints/saasRegistrationProjections.ts tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.ts tooling/generators/src/blueprints/saasApplication.test.ts
rtk git commit -m "refactor(generator): select customer pattern closures"
```

### Task 2: Make generated metadata follow materialized systems

**Files:**

- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `docs/template/blueprints/saas-application.md`
- Test: `tooling/generators/src/blueprints/saasApplication.test.ts`

**Interfaces:**

- Consumes: `SaasApplicationPatternSelection`, canonical group paths, selected
  generated files, factory `package.json`, `pnpm-workspace.yaml`, and
  `pnpm-lock.yaml`.
- Produces: derived customer scripts, dependency/workspace closure, lockfile
  importers, catalogs, application contract, readiness document, and handoff
  that agree with selected files.
- Produces neutral `saasApplicationBlueprint` and `canonicalTargetPlanOptions`
  identity/defaults; records-specific nouns, entity, CRUD/route promises,
  default outcome, seed metadata, and governance are contributed only by
  `records-example`.

- [ ] **Step 1: Write failing cross-artifact consistency tests**

For neutral and selected plans, assert behavior rather than exact total counts:

```ts
it("derives neutral metadata from materialized systems", () => {
  const entries = new Map(
    buildSaasApplicationTargetPlan().entries.map((entry) => [
      entry.path,
      entry,
    ]),
  );
  const root = JSON.parse(entries.get("package.json")?.content ?? "{}") as {
    scripts: Record<string, string>;
  };
  const contract = JSON.parse(
    entries.get(
      "generated/blueprints/saas-application/application-contract.json",
    )?.content ?? "{}",
  ) as { selectedPatterns: readonly string[] };

  expect(contract.selectedPatterns).toEqual([]);
  for (const absent of [
    "test:workflow",
    "check:workflow-semantics",
    "check:workflow-graph-boundary",
    "check:workflow-policy-snapshots",
    "check:workflow-principal-propagation",
  ])
    expect(root.scripts).not.toHaveProperty(absent);
  expect(entries.has("tooling/workflow/package.json")).toBe(false);
});
```

Add equivalent assertions that selecting `workflow-automation` restores its
scripts, package/importer, catalog/topology facts, and handoff description.
Assert deployment/security scripts remain in neutral targets. Parse the
generated YAML lockfile and assert no importer exists for an omitted workspace;
do not check by substring alone.

- [ ] **Step 2: Render each group's files and metadata together**

Change projection helpers to accept the selection. The same group builder
returns its files plus the small script/dependency/catalog metadata it owns; the
chassis builder does the same for mandatory systems. Compose those values
directly without a second path registry or arbitrary script/path validator.
Reuse the current concrete script, workspace, and catalog value types rather
than introducing a generalized projection interface.

Merge selected groups' metadata, prune absent workspace importers from the
generated lockfile, and preserve security or tenancy facts owned by the chassis.
Generated install/typecheck/command smoke, not a new ownership parser, proves
cross-artifact closure.

- [ ] **Step 3: Make contracts, readiness, docs, and handoff truthful**

Add explicit selection to generated JSON and render prose from it:

```ts
{
  schemaVersion: 1,
  blueprint: "saas-application",
  selectedPatterns: [...(options.patterns ?? [])].sort(),
  automation: options.patterns?.includes("workflow-automation")
    ? { status: "selected" }
    : saasApplicationBlueprint.automation,
}
```

Update `docs/template/blueprints/saas-application.md` to list the mandatory
chassis, the canonical optional groups, and the composition API that selects
them. State clearly that factory patterns remain under source control even when
absent from a customer target.

- [ ] **Step 4: Pass focused metadata tests and commit**

Run the Task 1 focused Vitest command.

Expected: PASS for neutral and selected metadata closure.

```bash
rtk git add tooling/generators/src/blueprints/saasRegistrationProjections.ts tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.ts tooling/generators/src/blueprints/saasApplication.test.ts docs/template/blueprints/saas-application.md
rtk git commit -m "fix(generator): align customer metadata with projection"
```

### Task 3: Make records an explicit runnable example pattern

**Files:**

- Modify: `examples/saas-application/seed/source/features/records.feature`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Test: `apps/cli/src/factory/createRootIntegration.test.ts`

**Interfaces:**

- Consumes: canonical records example, `currentContractFiles`, personalized
  first-outcome generation, and current create-root composition.
- Produces: a runnable non-required `records-example` selection, an unchanged
  personalized `@wip` first outcome, and neutral generated targets with zero
  required Scenarios until the product author admits one.

- [ ] **Step 1: Write failing acceptance-classification tests**

Add generator assertions:

```ts
it("keeps records out of neutral products and runnable when selected", () => {
  const entries = new Map(
    buildSaasApplicationTargetPlan().entries.map(({ path, content }) => [
      path,
      content,
    ]),
  );
  expect(entries.has("features/records.feature")).toBe(false);
  expect(entries.has("features/first-outcome.feature")).toBe(true);
  const selected = new Map(
    buildSaasApplicationTargetPlan({
      name: "Records Example",
      patterns: ["records-example"],
    }).entries.map(({ path, content }) => [path, content]),
  );
  expect(selected.get("features/records.feature")).toContain(
    "Feature: Manage workspace records",
  );
});
```

Materialize both Features and use Cucumber's loaded pickle/tag API to assert the
first outcome is `@wip` and the records example has no `@required` pickle. Do
not regex raw Gherkin.

In `createRootIntegration.test.ts`, generate the current target and assert that
`contracts test --required` exits non-zero with the native zero-selection
diagnostic. Do not make the integration test run the records journey as
required.

- [ ] **Step 2: Move the whole records vertical into its optional group**

Remove the lifecycle tag so the canonical example begins directly with:

```gherkin
Feature: Manage workspace records
```

Keep its scenarios, steps, schema, backend operations, UI route, docs, generated
refs, and provenance intact in the factory pattern and selected composition.
Remove all of them from the neutral chassis. Untagged Features are drafts under
the approved lifecycle. Do not add another lifecycle manifest or checker.

- [ ] **Step 3: Reuse coherent current-composition coverage from the
      engineering-rules branch**

Port only the branch's change that exercises the current local composition
rather than materializing an old tag and overlaying it. Preserve the
zero-required-scenario assertion introduced above. Do not port its removal of
required contracts from delivery admission; Lane 2 owns acceptance command
structure.

- [ ] **Step 4: Run focused tests and commit**

Run both commands from Step 2.

Expected: PASS; neutral targets contain no records product authority, selected
targets keep the complete runnable example, first outcome remains `@wip`, and
required selection cannot pass on an unrelated example.

```bash
rtk git add examples/saas-application/seed/source/features/records.feature tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.test.ts apps/cli/src/factory/createRootIntegration.test.ts
rtk git commit -m "test(contracts): keep records as a non-gating example"
```

### Task 4: Make plain agent generation neutral and preserve the web-seat pattern

**Files:**

- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/customer-runtime.ts`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `tooling/generators/src/customer-runtime.test.ts`
- Modify: `docs/template/how-to-add-agent.md`

**Interfaces:**

- Consumes: existing `AgentGeneratorOptions`, `AgentGeneratorResult`,
  `withGeneratorProvenance`, `add-agent`, and `add-agent-seat` alias dispatch.
- Produces: plain `add-agent` with `surfaces: []`, `headlessExposure: false`,
  and only declaration/docs/provenance; explicit `add-agent-seat` continues to
  own the existing complete web thread-seat implementation and tests.

- [ ] **Step 1: Replace web-seat expectations with a failing neutral contract**

In both factory and projected-runtime tests, require this shape:

```ts
expect(generated).toMatchObject({
  name: "workflowArchitect",
  surfaces: [],
  headlessExposure: false,
});
expect(generated.files.map(({ path }) => path)).toEqual([
  "packages/convex/confect/agents/workflowArchitect.ts",
  "docs/template/generated/agents/workflowArchitect.md",
  "docs/template/generated/provenance/add-agent/workflowArchitect.json",
]);
```

Keep tests for canonical system ownership, disposition, collision detection,
preview, and write. Replace the old alias expectation with a preservation test
that `add-agent-seat` still emits the existing spec, implementation, tools,
thread tests, and web surface contract.

- [ ] **Step 2: Emit a declaration without invented runtime behavior**

Keep the existing public result type but emit a declaration shaped like:

```ts
export const workflowArchitectAgent = {
  id: "workflowArchitect",
  displayName: "Workflow Architect",
  system: options.system,
  disposition: options.disposition,
  systemDisposition: "reuse",
  description: "...",
  surfaces: [],
  capabilities: [],
} as const;
```

Return `surfaces: []` and `headlessExposure: false`, and update
`AgentGeneratorResult.surfaces` to `readonly []` in both owners. Preserve
canonical system/disposition validation and provenance. Documentation must tell
the next agent to select a UI seat, thread lifecycle, tools, CLI/API/MCP, or
headless pattern only when the product needs it. Make the equivalent focused
edit in `customer-runtime.ts`; generator-core consolidation is deferred. Do not
delete or neutralize `buildAgentSeatFiles`; route only the explicit
`add-agent-seat` command to that preserved implementation.

- [ ] **Step 3: Update the add-agent guide and pass focused tests**

Revise `docs/template/how-to-add-agent.md` so its example and output list
describe the neutral declaration and optional follow-on patterns. Run the two
focused generator test files.

Expected: PASS for factory and generated-customer implementations.

- [ ] **Step 4: Commit the neutral agent declaration**

```bash
rtk git add tooling/generators/src/index.ts tooling/generators/src/customer-runtime.ts tooling/generators/src/index.test.ts tooling/generators/src/customer-runtime.test.ts docs/template/how-to-add-agent.md
rtk git commit -m "refactor(generator): emit neutral agent declarations"
```

### Task 5: Prove the lean generated target

**Files:**

- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `docs/template/blueprints/saas-application.md`

**Interfaces:**

- Consumes: default current customer composition, selected target-plan builder,
  generated files and metadata from Tasks 1–4.
- Consumes published core-lane contracts: native syntax/required Cucumber
  adapters and secure runtime support; lean preview/write command APIs; Qlty
  advisory/root-suite/stack cleanup; rules/skill/empty-workspace hygiene.
- Produces: end-to-end evidence that neutral create is lean, opt-in composition
  is complete, installation succeeds, records remain an example, and factory
  patterns remain discoverable.

- [ ] **Step 1: Add a generated-filesystem contract test**

Apply the published core-lane commits, then close each generated compatibility
handoff exactly once in the blueprint/package/lockfile/CI hot files owned here:

- project `source-check.mts`, `required-selection.mts`, secure records runtime,
  and the four generated acceptance scripts; run records explicitly while a
  neutral target remains red on zero required journeys;
- project the final preview/`--write` command help and keep MCP as the only
  privacy-review acknowledgement;
- project advisory Qlty, remove stack/plan-check/Just authority as classified,
  and preserve the single root suite ownership from Active Cleanup;
- project the engineering-rules source, direct skill source, and removal of
  classified empty workspaces.

Resolve shared seams here rather than asking every core lane to rebase.

Extend current-composition integration to verify actual disk state after
`create --write`:

```ts
for (const path of ["tooling/workflow", "packages/convex/confect/workflows"]) {
  expect(existsSync(join(targetRoot, path)), path).toBe(false);
}
expect(existsSync(join(targetRoot, "features/records.feature"))).toBe(false);
expect(existsSync(join(targetRoot, "apps/web/src/features/records"))).toBe(
  false,
);
expect(
  existsSync(join(targetRoot, "apps/web/src/screens/records-screen.tsx")),
).toBe(false);
expect(
  existsSync(join(targetRoot, "apps/web/src/routes/_workspace.records.tsx")),
).toBe(false);
expect(
  existsSync(join(targetRoot, "packages/convex/confect/deployAuthority")),
).toBe(true);
```

Keep detailed metadata assertions in the blueprint unit tests. Here prove
materialization/install, representative optional omission, and the intentional
delivery state: a fresh neutral target is bootstrappable but
`contracts test --required` remains red until its first real journey is
implemented and promoted. Also assert the canonical factory records source still
exists.

- [ ] **Step 2: Add an opt-in composition integration test without a new CLI
      flag**

Inject the existing public builder seam through
`loadCustomerCreateComposition(source, selectedBuilder)` so replacement
authority remains sealed:

```ts
const selectedBuilder = (options: {
  readonly name: string;
  readonly firstOutcome?: string;
}) =>
  buildSaasApplicationTargetPlan({
    ...options,
    patterns: ["workflow-automation"],
  });
```

Use separate builder instances and target roots for `records-example` and
`workflow-automation`, while reusing the existing installed fixture mechanism
where safe. Prove representative files exist, their scripts resolve, one
selected target typechecks, the records UI/CLI contract executes once, and one
representative workflow command resolves. Detailed closure remains a unit-test
concern.

Run the existing tenant/security/headless boundary checks against the neutral
materialization and one representative selected target. This catches retained
imports or registered functions that point into an omitted group without a new
closure manifest.

- [ ] **Step 3: Run focused integration tests**

Run:

```bash
rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/createRootIntegration.test.ts src/factory/candidateComposition.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: PASS for neutral and selected target materialization. If the test
performs install/codegen, reuse its existing immutable fixture and do not
introduce a second readiness owner.

- [ ] **Step 4: Run all focused lane checks once on the committed candidate**

Commit the integration proof, then use remote testing for the committed head:

```bash
rtk git add apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/candidateComposition.test.ts docs/template/blueprints/saas-application.md
rtk git commit -m "test(factory): prove lean customer composition"
rtk maestro-remote-test -- pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts src/index.test.ts src/customer-runtime.test.ts --maxWorkers=1 --no-file-parallelism
rtk maestro-remote-test -- pnpm --dir apps/cli exec vitest run src/factory/createRootIntegration.test.ts src/factory/candidateComposition.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: both remote commands PASS at the same committed SHA.

- [ ] **Step 5: Perform the whole-diff review and fix real findings**

```bash
rtk git diff --check origin/main...HEAD
rtk git diff --stat origin/main...HEAD
rtk git diff origin/main...HEAD
rtk git status --short
```

Expected: no whitespace errors, only scoped files changed, and a clean worktree.
Give an independent reviewer the design, this plan, and the full diff. Require
findings about incomplete closures, stale metadata, missing safety evidence,
immutable-release drift, and confusing pattern authority. Fix valid findings in
focused commits and rerun affected focused tests.

- [ ] **Step 6: Push and obtain the sole blocking CI result**

```bash
rtk git status --short
rtk git push -u origin codex/lean-customer-projection
rtk gh pr create --base main --head codex/lean-customer-projection --title "refactor: generate lean customer targets" --body "Generates only the neutral chassis and explicitly selected factory patterns."
```

Expected: the worktree is clean and `ci/woodpecker/pr/verify` passes for the
current PR head. Treat Qlty as advisory and do not wait on it as if required.

## Self-Review Record

- **Spec coverage:** Tasks 1–2 cover neutral omission, explicit selection,
  complete closure, and metadata/filesystem agreement. Task 3 covers records and
  personalized acceptance authority. Task 4 covers minimal neutral agents. Task
  5 covers actual current composition, preserved factory references, review, and
  exact-head Woodpecker evidence.
- **Preserved boundaries:** Immutable releases, factory reference code, Cucumber
  itself, security controls, reversible-write policy, deployment trust, and
  later-lane authority cleanup remain outside the patch.
- **Existing-branch reuse:** The plan explicitly reuses the correct records
  ownership/current-composition ideas from
  `codex/template-enforced-engineering-rules` while rejecting its conflicting
  broad-admission and lifecycle policy.
- **Main concern:** Current workflow, deployment, email, headless, readiness,
  and support-bundle paths are interleaved in large projection arrays. This
  batch classifies only workflow and deployment by actual dependency closure;
  ambiguous shared files stay in the chassis.
- **Placeholder scan:** Every implementation step names its concrete behavior,
  files, command, and expected result; no open-ended subsystem classification
  remains.
