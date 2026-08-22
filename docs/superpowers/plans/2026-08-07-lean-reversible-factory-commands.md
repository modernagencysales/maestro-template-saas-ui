# Lean Reversible Factory Commands Implementation Plan

> **For the lane owner:** Treat this as one continuous subsystem goal. Make
> coherent commits, run focused checks while authoring, and keep moving until
> the complete lane outcome is ready for review.

**Goal:** Make ordinary local factory mutations preview by default and writable
with one explicit `--write`, while retaining the one justified privacy
acknowledgement and all path, collision, protected-root, secret, and
atomic-write safeguards.

**Architecture:** CLI adapters remain thin argument translators over Agent Pack
commands. Every write invocation rebuilds its plan from the current filesystem
immediately before mutation; current owned-path preconditions and internal
digests may remain implementation evidence, but users no longer copy plan,
preflight, or preview fingerprints between commands. Generator-core
consolidation is deferred until these command contracts settle.

**Tech Stack:** TypeScript, Effect-based Agent Pack command contracts, Vitest,
Node filesystem APIs, pnpm workspaces, Maestro CLI.

## Global Constraints

- Base the lane branch explicitly on current `origin/main`.
- At lane startup, compare commits `326a2761a` through `76c24a137` once and
  record reusable tests/rejected policies in the brief; do not repeat per-file
  archaeology, merge that branch wholesale, or modify its dirty worktree.
- Preview is the default. An ordinary local mutation requires exactly one
  mutation acknowledgement: `--write`.
- Keep the MCP host/provider disclosure acknowledgement as `--privacy-reviewed`;
  it is the one real privacy boundary in this lane because applying the profile
  grants an agent host access to local Convex tooling. Reject it without
  `--write` and do not add it to unrelated commands.
- Private-package import must display its bounded privacy posture but is a
  local, collision-refusing code copy; use `--write` without a copied
  fingerprint or an additional privacy flag.
- Recompute the complete plan and owned-path preconditions on the write
  invocation immediately before mutation. Internal hashes, transaction journals,
  and receipts may remain; they must not become user-supplied write authority.
- Preserve target containment, symlink/ancestor-swap defenses, protected roots,
  `wx`/no-overwrite behavior, before-content checks, existing atomic recipe
  recovery, malformed-input rejection, secret canaries, names-only environment
  reporting, and no-network support export. Do not claim scaffold or private
  package writes are journal-atomic when their current writer is not.
- An unrelated dirty worktree is not a blocker. Refuse an owned-path collision
  or changed owned-path precondition instead.
- Preflight still blocks unsupported/incompatible runtime, ambiguous or wrong
  repository root/role, owned-path overlap or generated drift, insufficient
  disk/write feasibility, unsupported generator/workflow semantics, missing
  provider facts required by the selected generator, and unavailable transaction
  support. Remove only unrelated dirty-tree and user-copied fingerprint denials.
- Do not modify upgrade, adopt/cutover, deployment, migration, release sealing,
  rollback, promotion authority, or their fingerprints and receipts.
- Keep package scripts as command authority. Run focused tests while authoring;
  Woodpecker owns full verification on the current PR head.
- Run repository-pinned Qlty on the lane diff with the host's 30-second cap for
  visibility; it is not admission authority.
- This core lane publishes coherent commits to the shared composition owner; it
  does not open its own PR or run a duplicate full gate.
- Do not add Gherkin for parser or flag matrices. This lane changes factory
  mechanics, so its behavior belongs in focused command tests and the existing
  generated-customer CLI integration; customer-journey Gherkin remains owned by
  generated products.
- Qlty authoring thresholds are identical `12`, similar `15`, function
  complexity `10`, file complexity `50`, returns `5`, boolean logic `4`,
  parameters `5`, and nesting `4`; Qlty is advisory and excludes `tooling/**`.
  Preserve strict TypeScript, `99.7%` type coverage, Effect diagnostics,
  dependency-cruiser/Knip, Gitleaks, and tenant/security gates.

## File Structure

- `apps/cli/src/factory/*.ts` remains transport-only parsing/help for create,
  add, scaffold, support bundle, and MCP configure.
- `tooling/agent-pack/src/create.ts`, `recipes.ts`, `scaffold.ts`, and
  `privacy/supportBundleCommand.ts` own preview/write command semantics.
- `tooling/agent-pack/src/mcp/configure.ts` owns the single retained privacy
  acknowledgement.
- `tooling/agent-pack/src/recipeTransaction.ts` retains atomicity/recovery and
  consumes internally recomputed preconditions, never a copied CLI token.
- Existing generator owners remain intact in this lane; consolidation is a
  separate later cleanup after preview/write APIs stabilize.
- `tooling/generators/src/private-package.ts` owns private-package preview,
  containment, collision checks, and exclusive writes.

## Lane Contribution

### Batch 1: Lean reversible factory commands

- **Core tasks:** 1-4. Task 5 is the composition-owner handoff.
- **Branch:** `codex/lean-reversible-factory-commands`.
- **Base:** current `origin/main` at execution start.
- **PR target:** none from this lane; the composed branch targets `main`.
- **Why composed:** CLI and Agent Pack contracts land with their generated
  compatibility in one final batch, without making the core worker edit shared
  blueprint hot files.
- **Focused task checks:** the exact Vitest/typecheck commands listed in each
  task.
- **Whole-batch review:** independent reviewer inspects
  `git diff origin/main...HEAD` for accidental changes to
  upgrade/deploy/destructive authority and verifies every removed
  acknowledgement has a current-filesystem guard.
- **Required verification:** focused lane checks plus handoff to the composed
  delivery branch; that branch owns the single PR and Woodpecker result.

---

### Task 1: Make create and support-bundle writes single-step

**Files:**

- Modify: `apps/cli/src/factory/create.ts`
- Modify: `apps/cli/src/factory/create.test.ts`
- Modify: `apps/cli/src/factory/supportBundle.ts`
- Modify: `apps/cli/src/factory/supportBundle.test.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `tooling/agent-pack/src/create.ts`
- Modify: `tooling/agent-pack/src/create.test.ts`
- Modify: `tooling/agent-pack/src/privacy/supportBundleCommand.ts`
- Modify: `tooling/agent-pack/src/privacy/privacy.supportBundle.test.ts`
- Modify: `tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts`

**Interfaces:**

- Consumes: existing `release.prepare()`/`release.materialize()` create boundary
  and `SupportBundleExporter.export()` path/symlink safety.
- Produces: create input `{ target, name, outcome, demoOnly, write }`; support
  input `{ output, write }`; both preview by default and accept only `--write`
  for mutation.

- [ ] **Step 1: Rewrite transport tests to specify the lean argv**

  In `apps/cli/src/factory/create.test.ts`, replace the reviewed-write case with
  an assertion that `--write` alone reaches the command and that
  `--privacy-reviewed` is rejected as an unknown argument. In
  `supportBundle.test.ts`, assert `--write` alone reaches the exporter and
  `--preview-fingerprint` is rejected. Keep the default-preview and `--details`
  inventory tests.

  ```ts
  expect(command.execute).toHaveBeenCalledWith(
    expect.objectContaining({ write: true }),
    expect.anything(),
  );
  expect(result.exitCode).toBe(0);

  const obsolete = await runCli([
    "support-bundle",
    "--write",
    "--preview-fingerprint",
    "old",
  ]);
  expect(obsolete.exitCode).toBe(2);
  ```

- [ ] **Step 2: Rewrite Agent Pack tests around current-state recomputation**

  In `tooling/agent-pack/src/create.test.ts`, retain collision, unsafe-target,
  stale prepared-release, and no-follow-up-action cases, but write with
  `{ write: true }`. Delete only the test whose sole claim is privacy
  acknowledgement. In `privacy.supportBundle.test.ts`, replace “requires exact
  preview” with these claims:

  ```ts
  const result = await execute(command, {
    output: ".maestro/support/report.json",
    write: true,
  });
  expect(result.exitClass).toBe("success");
  expect(exporter.export).toHaveBeenCalledOnce();

  // Mutate an owned ancestor to a symlink between source projection and export.
  expect(swapped.exitClass).not.toBe("success");
  expect(existsSync(outsidePath)).toBe(false);
  ```

  Preserve the traversal, oversized facts, allowlist, secret exclusion,
  ancestor-swap, support-directory-swap, and no-network tests verbatim except
  for removing the fingerprint argument.

- [ ] **Step 3: Implement lean create and support inputs**

  Change the public types and decoders to exactly:

  ```ts
  export type CustomerCreateInput = {
    readonly target: string;
    readonly name: string;
    readonly outcome: string;
    readonly demoOnly: boolean;
    readonly write: boolean;
  };

  export type SupportBundleCommandInput = {
    readonly output: string;
    readonly write: boolean;
  };
  ```

  Remove `privacyReviewed` and `previewFingerprint` from allowed keys, help,
  rerun commands, and invalid-argument messages. Keep create’s privacy
  disclosure in preview/output as information, not mutation authority. On
  support write, rebuild
  `createSupportBundlePreview(await load(repo), { output })` and immediately
  pass those newly serialized bytes to the existing exporter. Do not relax
  `isValidSupportBundleOutput`, exporter containment, exclusive creation, or
  symlink checks.

- [ ] **Step 4: Run focused tests and typechecks**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/create.test.ts src/privacy/privacy.supportBundle.test.ts src/privacy/privacy.noNetwork.test.ts --maxWorkers=1 --no-file-parallelism`

  Expected: PASS.

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/create.test.ts src/factory/supportBundle.test.ts`

  Expected: PASS.

  Run:
  `rtk pnpm --dir tooling/agent-pack typecheck && rtk pnpm --dir apps/cli typecheck`

  Expected: both commands PASS.

- [ ] **Step 5: Commit the focused outcome**

  ```bash
  rtk git add apps/cli/src/factory/create.ts apps/cli/src/factory/create.test.ts apps/cli/src/factory/supportBundle.ts apps/cli/src/factory/supportBundle.test.ts apps/cli/src/commands.ts tooling/agent-pack/src/create.ts tooling/agent-pack/src/create.test.ts tooling/agent-pack/src/privacy/supportBundleCommand.ts tooling/agent-pack/src/privacy/privacy.supportBundle.test.ts tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts
  rtk git commit -m "refactor(factory): simplify create and support writes"
  ```

### Task 2: Recompute recipe plans and transact without copied authority

**Files:**

- Modify: `apps/cli/src/factory/recipes.ts`
- Modify: `apps/cli/src/factory/recipes.test.ts`
- Modify: `apps/cli/src/factory/customerRecipes.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `tooling/agent-pack/src/recipes.ts`
- Modify: `tooling/agent-pack/src/recipes.test.ts`
- Modify: `tooling/agent-pack/src/recipeTransaction.ts`
- Modify: `tooling/agent-pack/src/recipeTransaction.test.ts`
- Modify: `tooling/agent-pack/src/preflight.ts`
- Modify: `tooling/agent-pack/src/preflight.test.ts`

**Interfaces:**

- Consumes: each generator preview’s `files[].beforeSha256`, `safeRelativePath`,
  collision set, and journaled `createNodeRecipeTransaction()`.
- Produces: add input `{ query, answers, write }`; the existing transaction
  keeps any internal precondition hash it needs, but no user supplies it.

- [ ] **Step 1: Specify dirty-worktree-tolerant recipe writes**

  Update `recipes.test.ts` in both packages to preview first, then call the same
  command with `{ query, answers, write: true }`. Assert that a preflight
  fixture with `cleanWorktree: false` still succeeds when all owned
  `beforeSha256` values match, and that changing one owned file between planning
  and `transaction.apply()` refuses the operation before any write.

  ```ts
  const result = await execute(add, {
    query: "add capability",
    answers,
    write: true,
  });
  expect(result.exitClass).toBe("success");
  expect(transaction.apply).toHaveBeenCalledOnce();
  ```

  Keep unsafe relative path, protected target, collision, atomic rollback,
  interrupted-journal recovery, symlink, replay, backup tamper, and
  before-content drift tests.

- [ ] **Step 2: Remove user-supplied recipe authority while preserving internal
      evidence**

  Change `AddRecipeInput` to:

  ```ts
  type AddRecipeInput = {
    readonly query: string;
    readonly answers: Readonly<Record<string, string | boolean>>;
    readonly write: boolean;
  };
  ```

  On every invocation call `buildPlan(...)` against the current repo. Keep
  `plan.fingerprint` as diagnostic/receipt evidence if useful, but make
  `confirmationCommand` equal to the same add argv plus `--write`. Do not test
  `privacyReviewed`, a supplied fingerprint, `preflight.cleanWorktree`, or
  repository-wide cleanliness. Continue blocking `plan.collisions`, unsafe
  paths, unavailable transaction support, and unsafe mutation facts that concern
  an owned path.

  Replace the single broad `safeToMutate` decision with the explicit retained
  blocker set in Global Constraints; test every current unavailable/blocked
  preflight code and document whether it remains or is the one removed
  unrelated-dirty/fingerprint condition. Do not silently discard a denial.

  Do not rename or redesign internal transaction evidence merely because the CLI
  no longer carries it. The transaction must recheck every `beforeSha256`,
  containment boundary, regular-file condition, journal path, and backup before
  its first mutation. Preserve its existing atomic rollback and recovery
  validation.

- [ ] **Step 3: Simplify CLI parsing and adapters**

  Change `ADD_HELP` to
  `maestro add <outcome-or-recipe> [--answer <question>=<value>] [--write] ...`.
  Remove the three obsolete flags from `parseAdd`, `addRerun`,
  `apps/cli/src/commands.ts`, and adapter construction. `customerRecipes.ts` and
  `composition.ts` must continue adding current `beforeSha256` for every
  generated file and rejecting `isUnsafeReviewedGeneratorPath`; remove only the
  unrelated dirty-tree dependency and copied digest plumbing.

- [ ] **Step 4: Run focused recipe, transaction, CLI, and privacy tests**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/recipes.test.ts src/recipeTransaction.test.ts src/privacy/privacy.canaries.test.ts`

  Expected: PASS, including dirty unrelated changes and owned-file drift cases.

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/recipes.test.ts`

  Expected: PASS.

  Run:
  `rtk pnpm --dir tooling/agent-pack typecheck && rtk pnpm --dir apps/cli typecheck`

  Expected: PASS.

- [ ] **Step 5: Commit the focused outcome**

  ```bash
  rtk git add apps/cli/src/factory/recipes.ts apps/cli/src/factory/recipes.test.ts apps/cli/src/factory/customerRecipes.ts apps/cli/src/factory/composition.ts tooling/agent-pack/src/recipes.ts tooling/agent-pack/src/recipes.test.ts tooling/agent-pack/src/recipeTransaction.ts tooling/agent-pack/src/recipeTransaction.test.ts tooling/agent-pack/src/preflight.ts tooling/agent-pack/src/preflight.test.ts
  rtk git commit -m "refactor(factory): recompute recipe write plans"
  ```

### Task 3: Make scaffold preview plus write the complete authority

**Files:**

- Modify: `apps/cli/src/factory/scaffold.ts`
- Modify: `apps/cli/src/factory/scaffold.test.ts`
- Modify: `tooling/agent-pack/src/scaffold.ts`
- Modify: `tooling/agent-pack/src/scaffold.test.ts`

**Interfaces:**

- Consumes: `ScaffoldDependencies.generators.run({ write: false })` canonical
  preview and its collision/path checks.
- Produces: `ScaffoldInput` without preflight/preview fingerprints; generator is
  run in preview mode and then write mode during the same invocation.

- [ ] **Step 1: Replace fingerprint tests with current-filesystem tests**

  Update both scaffold test files so
  `{ generatorId, args, write: true, workflowRuleIds: [], workflowResolutions: [] }`
  succeeds despite `cleanWorktree: false`. Add a generator stub that returns no
  collision on preview but an owned-path collision on its write-time
  recomputation; assert the adapter refuses before starting the writer. Preserve
  restricted workflow, reviewed ADR, malformed JSON, unsupported generator,
  unsafe path, and initial collision cases.

- [ ] **Step 2: Simplify the command contract**

  Define the input without fingerprint fields:

  ```ts
  export type ScaffoldInput = {
    readonly generatorId: string;
    readonly args: ScaffoldArguments;
    readonly write: boolean;
    readonly workflowRuleIds: readonly string[];
    readonly workflowResolutions: readonly WorkflowResolution[];
  };
  ```

  Always run the generator once with `write: false` to validate arguments,
  retained preflight blockers, restrictions, paths, secrets, and collisions. If
  `write` is true, immediately call the same generator with `write: true`; that
  adapter must rebuild the files and refuse collisions before writing. Delete
  `fingerprintScaffoldPreview`, copied fingerprint confirmation text, and only
  unrelated clean-tree blocking. Keep workflow restriction resolution and
  reviewed ADR checks unchanged.

- [ ] **Step 3: Simplify CLI help and parsing**

  Advertise
  `maestro scaffold --generator <id> --args <json-object> [--write] ...`. Remove
  both fingerprint branches and fields from `parseScaffoldCli`. Continue
  rejecting duplicate `--write`, malformed JSON/non-JSON values, duplicate
  render modes, unknown flags, and invalid workflow-resolution pairs.

- [ ] **Step 4: Run focused tests and typechecks**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/scaffold.test.ts`

  Expected: PASS.

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/scaffold.test.ts`

  Expected: PASS.

  Run:
  `rtk pnpm --dir tooling/agent-pack typecheck && rtk pnpm --dir apps/cli typecheck`

  Expected: PASS.

- [ ] **Step 5: Commit the focused outcome**

  ```bash
  rtk git add apps/cli/src/factory/scaffold.ts apps/cli/src/factory/scaffold.test.ts tooling/agent-pack/src/scaffold.ts tooling/agent-pack/src/scaffold.test.ts
  rtk git commit -m "refactor(factory): simplify scaffold writes"
  ```

### Task 4: Retain MCP privacy review and simplify private-package import

**Files:**

- Modify: `apps/cli/src/factory/mcpConfigure.ts`
- Modify: `apps/cli/src/factory/mcpConfigure.test.ts`
- Modify: `tooling/agent-pack/src/mcp/configure.ts`
- Modify: `tooling/agent-pack/src/mcp/configure.test.ts`
- Modify: `tooling/generators/src/private-package.ts`
- Modify: `tooling/generators/src/private-package.test.ts`
- Modify: `tooling/generators/src/customer-dispatcher.ts`
- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `tooling/generators/src/help.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `docs/template/private-package-guide.md`

**Interfaces:**

- Consumes: MCP receipt ownership/refusal and private package `checks`,
  `privacy`, `collisions`, and `{ flag: "wx" }` writes.
- Produces: MCP apply still requires `--write --privacy-reviewed`;
  private-package import requires `--write` only and recomputes its plan before
  exclusive writes.

- [ ] **Step 1: Pin the one privacy acknowledgement with positive and negative
      tests**

  Keep and strengthen MCP tests: preview performs no store mutation; `--write`
  without `--privacy-reviewed` is invalid; `--privacy-reviewed` without
  `--write` is invalid; the pair applies; `--remove` removes only a
  receipt-owned registration and cannot be combined with profile/write/privacy
  flags.

  ```ts
  expect(
    await run(["mcp", "configure", "--host", "codex", "--write"]),
  ).toMatchObject({ exitCode: 2 });
  expect(
    await run([
      "mcp",
      "configure",
      "--host",
      "codex",
      "--write",
      "--privacy-reviewed",
    ]),
  ).toMatchObject({ exitCode: 0 });
  ```

- [ ] **Step 2: Rewrite private-package tests for preview plus write**

  Preview must still report manifest-only reads, exclusions, exact files,
  collisions, and privacy posture. Write with `{ mode: "import", write: true }`
  and no fingerprint. Add/retain cases for malformed manifest, traversal in
  fixture declarations, collision, symlinked target ancestor, and a
  secret-canary payload; all preflight failures must refuse before the first
  write.

- [ ] **Step 3: Simplify private-package execution without weakening its
      boundary**

  Remove `preflightFingerprint` from `executePrivatePackagePlan`, parsing, help,
  confirmation commands, customer dispatcher, and root generator dispatcher.
  Make confirmation exactly the preview command plus `--write`. On write, call
  `buildPrivatePackagePlan(options)` in that invocation, require
  `mode === "import"`, require every check non-failing, reject every collision,
  verify every resolved destination is contained by `targetRoot` and not under a
  protected root, then retain the existing exclusive `wx` writer. Do not import
  the recipe transaction: its API and receipts are recipe-specific, and a new
  generic transaction abstraction is outside this command simplification.

  ```ts
  export const executePrivatePackagePlan = (options: {
    readonly fixturePath: string;
    readonly fixtureArgument?: string;
    readonly targetRoot: string;
    readonly system: string;
    readonly disposition: PrivatePackageDisposition;
    readonly mode: "dry-run" | "import";
    readonly write: boolean;
  }): PrivatePackagePlan => {
    const plan = buildPrivatePackagePlan(options);
    if (!options.write) return plan;
    if (options.mode !== "import" || !plan.ok)
      throw new Error("Private-package import is not safe to write.");
    if (plan.collisions.length > 0)
      throw new Error(
        `Refusing private-package collisions: ${plan.collisions.join(", ")}`,
      );
    writePrivatePackageFiles(plan);
    return plan;
  };
  ```

  State the real boundary in help/tests: preflight validation and exclusive
  creation prevent overwrite, but a mid-write filesystem failure may require
  deleting only the paths reported as newly created and rerunning. Add that
  focused failure/reporting test; do not manufacture recipe metadata or claim a
  journal that does not exist.

  Do not add `--privacy-reviewed`: the preview remains explicit about private
  source handling, reads only the manifest-declared bounded material, and
  performs no external transmission.

- [ ] **Step 4: Update active help/docs and customer runtime assertions**

  Replace every active private import example in the listed files with
  `template:private-package:import ... --write`. Preserve fingerprint language
  in upgrade/deploy documents. Update `customerCliRuntime.test.ts` to preview
  and import using the new command, while retaining the committed-customer,
  immutable-tag denial, collision, and privacy/no-network assertions.

- [ ] **Step 5: Run focused safety and integration tests**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/private-package.test.ts src/index.test.ts src/customer-runtime.test.ts --maxWorkers=1 --no-file-parallelism`

  Expected: PASS.

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/mcp/configure.test.ts src/privacy/privacy.canaries.test.ts src/privacy/privacy.noNetwork.test.ts --maxWorkers=1 --no-file-parallelism`

  Expected: PASS.

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/mcpConfigure.test.ts src/factory/customerCliRuntime.test.ts --maxWorkers=1 --no-file-parallelism`

  Expected: PASS.

- [ ] **Step 6: Commit the focused outcome**

  ```bash
  rtk git add apps/cli/src/factory/mcpConfigure.ts apps/cli/src/factory/mcpConfigure.test.ts tooling/agent-pack/src/mcp/configure.ts tooling/agent-pack/src/mcp/configure.test.ts tooling/generators/src/private-package.ts tooling/generators/src/private-package.test.ts tooling/generators/src/customer-dispatcher.ts tooling/generators/src/index.ts tooling/generators/src/index.test.ts tooling/generators/src/help.ts apps/cli/src/factory/customerCliRuntime.test.ts docs/template/private-package-guide.md
  rtk git commit -m "refactor(factory): simplify private package imports"
  ```

### Task 5: Composition-owner compatibility closure

> This task is not executed by the reversible-command core worker. The shared
> composition owner applies it after consuming Tasks 1-4, so blueprint hot files
> have one writer.

**Files:**

- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/release/src/customerTarget/finalFilesystem.test.ts`
- Modify: `tooling/release/src/index.ts`
- Modify: `tooling/release/src/index.test.ts`
- Modify: `tooling/agent-pack/src/create.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`

**Interfaces:**

- Consumes: lean command contracts from Tasks 1-4 and existing generator
  exports.
- Produces: fresh generated targets whose help, docs, package scripts, runtime
  commands, and tests all use preview plus `--write`, with MCP as the sole
  `--privacy-reviewed` exception.

- [ ] **Step 1: Add generated-target command behavior tests**

  In `customerCliRuntime.test.ts`, execute generated help, preview, write, and
  obsolete-argument paths. Assert ordinary commands preview without mutation,
  accept `--write`, reject their old fingerprint flags as unknown arguments, and
  MCP alone requires `--write --privacy-reviewed`.

  Keep a small projection presence assertion for the command entrypoints, but do
  not concatenate source/help/docs and treat substring absence as behavioral
  evidence. Explicitly exclude upgrade, deploy, migration, rollback, release,
  and immutable-publication commands from this lane.

- [ ] **Step 2: Update projected command text and fixtures**

  Update the listed blueprint, registration, release, and integration fixtures
  to use:

  ```text
  maestro create ... --write
  maestro add ... --write
  maestro scaffold ... --write
  maestro support-bundle ... --write
  template:private-package:import ... --write
  maestro mcp configure ... --write --privacy-reviewed
  ```

  Do not change destructive command examples. Keep preview-first prose and
  privacy disclosure output, but remove instructions to copy digests or clean
  unrelated worktree changes.

- [ ] **Step 3: Scan only active ordinary-write surfaces for stale flags**

  Run:

  ```bash
  rtk rg -n "plan-fingerprint|preflight-fingerprint|preview-fingerprint" apps/cli/src/factory tooling/agent-pack/src tooling/generators/src docs/template tooling/release/src
  ```

  Expected: matches remain only in explicitly deferred
  upgrade/deploy/migration/rollback/release authority and their focused tests.
  Any match in create, add/recipe, scaffold, support bundle, MCP, private
  package, customer dispatcher, or ordinary generator help must be removed or
  corrected.

  Run:

  ```bash
  rtk rg -n "privacy-reviewed" apps/cli/src tooling/agent-pack/src tooling/generators/src docs/template tooling/release/src
  ```

  Expected: active command requirements remain only for MCP configure;
  historical/deferred references must be clearly scoped and generated
  create/add/private-package help must not require it.

- [ ] **Step 4: Run generated-customer integration and release filesystem
      checks**

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/createRootIntegration.test.ts src/factory/customerCliRuntime.test.ts --maxWorkers=1 --no-file-parallelism`

  Expected: PASS; preview writes nothing, lean write materializes, collisions
  fail, support export remains no-network, and private-package import remains
  bounded.

  Run: `rtk pnpm --dir tooling/release test:final-filesystem`

  Expected: PASS with the generated target containing only customer-safe
  generator authority.

- [ ] **Step 5: Commit the delivery batch**

  ```bash
  rtk git add tooling/generators/src/blueprints/saasApplication.ts tooling/generators/src/blueprints/saasApplication.test.ts tooling/generators/src/blueprints/saasRegistrationProjections.ts tooling/release/src/customerTarget/finalFilesystem.test.ts tooling/release/src/index.ts tooling/release/src/index.test.ts tooling/agent-pack/src/create.test.ts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/customerCliRuntime.test.ts
  rtk git commit -m "test(factory): close lean write compatibility"
  rtk git status --short
  ```

  Expected: clean status.

- [ ] **Step 6: Return compatibility evidence to the composed batch**

  Ask a fresh reviewer to compare `origin/main...HEAD`, specifically checking:

  - no destructive/deployment authority changed;
  - MCP is the only ordinary command retaining privacy acknowledgement;
  - every write recomputes current paths and refuses collision/drift before
    mutation;
  - dirty unrelated files do not block;
  - internal hashes are evidence, not copied CLI authority;
  - generated customers do not import factory-only generator code.

  Commit the shared-seam closure on the composition branch. The composition plan
  owns whole-diff review, the one PR, and the single Woodpecker result. Do not
  treat Qlty as blocking.

## Self-Review Findings

- **Spec coverage:** Tasks 1-4 cover every ordinary command named by this lane;
  Task 5 proves generated-customer compatibility and excludes destructive
  authorities. Generator-core consolidation is explicitly deferred.
- **Safety:** The plan removes user-copied authority but retains
  current-filesystem recomputation, collision refusal, owned before-content
  hashes, protected-root checks, symlink defenses, secret exclusions, no-network
  tests, and recipe transaction recovery.
- **Privacy:** MCP configure is the sole retained `--privacy-reviewed` boundary.
  Create still displays its first-run privacy disclosure; support bundles remain
  allowlisted/local; private-package previews state their bounded reads.
- **Cucumber:** No new Feature is warranted for transport flags or generator
  internals. Existing generated-product Cucumber remains untouched, and
  generated-customer CLI integration proves this lane’s public behavior.
- **Deferred boundary:** Upgrade, deployment, migration, rollback, promotion,
  release sealing, and archive authority are explicitly out of scope even when
  they use similarly named fingerprints.
