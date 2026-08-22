# AI App Factory Chassis Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the factory generate, run, verify, and seal a standalone customer
app with a complete workspace-safe CRUD golden path.

**Architecture:** Repair the existing fail-closed release composition first,
then fix the browser runtime at the repository-owned TanStack boundary, upgrade
the existing `add-feature` vertical-slice generator into real CRUD, and make
Woodpecker exercise the same customer path. Historical releases remain
immutable; alpha.3 becomes the first corrected public default after its
generated target passes acceptance.

**Tech Stack:** TypeScript 5.9, Node 22, pnpm 10.12.1, Vitest, Playwright,
TanStack Start/Router, React 19, Confect/Convex, Woodpecker CI.

## Global Constraints

- Woodpecker is the only CI authority; do not use Buildkite or Fabro.
- Run local focused tests through `host-test-slot --class focused`; use
  `maestro-remote-test` for committed broad verification.
- Preserve fail-closed customer ownership, atomic recipe transactions, receipts,
  backups, and witnesses.
- Keep historical alpha.1 and alpha.2 release artifacts immutable.
- Require Node 22 and repository-pinned pnpm 10.12.1 for generation and
  acceptance.
- Write every behavior fix test-first and observe the expected failure before
  production edits.
- Do not add a replacement generator framework or runtime supervisor retry.

---

### Task 1: Restore customer release composition

**Files:**

- Modify: `tooling/release/src/customerTarget/ownership.test.ts`
- Modify: `tooling/release/src/customerTarget/ownership.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Test: `apps/cli/src/factory/createRootIntegration.test.ts`

**Interfaces:**

- Consumes: `classifyCustomerSourcePath(path)` and `CUSTOMER_ROOT_SCRIPTS`.
- Produces: an exact template-owned classification for `.factory/project.yaml`
  and an emitted `acceptance:check` root script.

- [ ] **Step 1: Add failing ownership and root-script assertions**

```ts
expect(classifyCustomerSourcePath(".factory/project.yaml")).toMatchObject({
  ownership: "template-owned",
  action: "copy",
  upgrade: "replace",
});

expect(root.scripts["acceptance:check"]).toBe(
  "tsx tooling/acceptance/check-contracts.mts",
);
```

- [ ] **Step 2: Verify both failures are the known regressions**

Run:

```bash
rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/customerTarget/ownership.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: `.factory/project.yaml` is unclassified and `acceptance:check` is
`undefined`.

- [ ] **Step 3: Add only the two explicit projections**

```ts
const TEMPLATE_ROOT_FILES = new Set([
  ".factory/project.yaml",
  // existing exact template root files remain unchanged
]);

export const CUSTOMER_ROOT_SCRIPTS = [
  "maestro",
  "acceptance:check",
  // existing customer scripts remain unchanged
] as const;
```

- [ ] **Step 4: Verify release composition and create-root integration**

Run:

```bash
rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/customerTarget/ownership.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir tooling/generators test
rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/createRootIntegration.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism
```

Expected: all pass, with no afterAll cleanup timeout.

- [ ] **Step 5: Commit release-composition repair**

```bash
rtk git add tooling/release/src/customerTarget/ownership.ts tooling/release/src/customerTarget/ownership.test.ts tooling/generators/src/blueprints/saasRegistrationProjections.ts tooling/generators/src/blueprints/saasApplication.test.ts
rtk git commit -m "fix(factory): restore customer release composition"
```

### Task 2: Reproduce and repair browser runtime longevity

**Files:**

- Create: `apps/web/scripts/check-dev-runtime-longevity.mjs`
- Create: `apps/web/scripts/check-dev-runtime-longevity.test.mjs`
- Modify: `apps/web/package.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Conditional repair boundary: `apps/web/src/router.tsx` is changed only if the
  dependency-family update leaves the black-box regression red.

**Interfaces:**

- Consumes: fake-mode start URL and `/health`.
- Produces: `pnpm --dir apps/web test:runtime-longevity`, which fails if browser
  navigation kills or strands the dev server.

- [ ] **Step 1: Add a failing black-box browser lifecycle check**

The script must spawn `pnpm maestro -- start --mode fake` on reviewed free
ports, wait for `/health`, navigate Playwright to `/records`, close the browser,
wait 125 seconds, require a second successful `/health`, send SIGINT, and
require the CLI's `stopped cleanly` output. It must retain grouped stdout/stderr
on failure and kill the process group in `finally`.

```js
const result = await checkDevRuntimeLongevity({
  cwd: repositoryRoot,
  webPort: 15183,
  readinessPort: 14184,
  longevityMs: 125_000,
});
assert.equal(result.healthBefore, 200);
assert.equal(result.healthAfter, 200);
assert.equal(result.cleanShutdown, true);
```

- [ ] **Step 2: Run the check and observe the 120-second stream failure**

Run:

```bash
rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run scripts/check-dev-runtime-longevity.test.mjs --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL with `Stream lifetime exceeded` or an unavailable `/health` after
navigation.

- [ ] **Step 3: Test the single dependency-family hypothesis**

Update only the TanStack packages already installed by the web app to their
current compatible stable releases:

```json
{
  "@tanstack/react-router": "1.170.19",
  "@tanstack/react-router-ssr-query": "1.167.1",
  "@tanstack/react-start": "1.168.36"
}
```

Regenerate `pnpm-lock.yaml` with Node 22 and pnpm 10.12.1. The lockfile must
resolve `@tanstack/router-core` to `1.171.16` and `@tanstack/router-plugin` to
`1.168.24`. If the black-box test stays red, trace the unfinished stream to
`setupRouterSsrQueryIntegration` and make the smallest repository-owned
cancellation fix in `router.tsx`; do not add a supervisor restart.

- [ ] **Step 4: Verify longevity, runtime contracts, build, and typecheck**

Run:

```bash
rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run scripts/check-dev-runtime-longevity.test.mjs src/start-runtime.test.ts --maxWorkers=1 --no-file-parallelism
rtk host-test-slot --class focused pnpm --dir apps/web typecheck
rtk host-test-slot --class focused pnpm --dir apps/web build
```

Expected: health is 200 after 125 seconds, clean shutdown is observed, and all
checks pass.

- [ ] **Step 5: Commit runtime repair**

```bash
rtk git add apps/web/scripts/check-dev-runtime-longevity.mjs apps/web/scripts/check-dev-runtime-longevity.test.mjs apps/web/package.json apps/web/src/router.tsx package.json pnpm-lock.yaml
rtk git commit -m "fix(web): keep browser SSR runtime healthy"
```

### Task 3: Make `crud-business-entity` an honest complete generator

**Files:**

- Modify: `docs/template/recipes/crud-business-entity.json`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/customer-runtime.test.ts`
- Modify: `tooling/generators/src/customer-runtime.ts`
- Modify: `tooling/quality/check-recipes.test.mts`
- Regenerate: `docs/template/recipes/index.generated.json`

**Interfaces:**

- Consumes: `buildFeatureFiles({ name, system, disposition })` after the
  recipe's `add-table` step.
- Produces: entity model, typed fake adapter, workspace-safe capability
  contract/implementation, route surface, and tests with
  create/read/list/update/delete behavior.

- [ ] **Step 1: Replace scaffold-shape assertions with behavior-complete output
      assertions**

For a generated `Milestone`, require operations and emitted UI behavior:

```ts
expect(file("apps/web/src/features/milestone/contract.ts")).toContain(
  'export type MilestoneStatus = "planned" | "active" | "complete"',
);
expect(file("apps/web/src/features/milestone/adapter.ts")).toContain(
  "createMilestoneAdapter",
);
expect(file("apps/web/src/features/milestone/milestone-feature.tsx")).toContain(
  'aria-label="Milestone title"',
);
expect(file("apps/web/src/features/milestone/milestone-feature.tsx")).toContain(
  "Delete milestone",
);
expect(allGeneratedBytes).not.toContain("Synthetic fixture");
expect(allGeneratedBytes).not.toContain('status: "accepted"');
expect(allGeneratedBytes).not.toContain("Replace fake fixtures");
```

Add behavior tests to the generated output that exercise create, read, list,
update, delete, empty title rejection, and cross-workspace isolation.

- [ ] **Step 2: Run both generator implementations and observe scaffold
      failures**

Run:

```bash
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/index.test.ts src/customer-runtime.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because the current output contains fixture data, canned
capability success, and no update/delete behavior.

- [ ] **Step 3: Emit the smallest complete CRUD contract**

Generated domain shape:

```ts
export type MilestoneStatus = "planned" | "active" | "complete";
export type Milestone = {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly detail: string;
  readonly status: MilestoneStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
};
```

Generated adapter interface:

```ts
export interface MilestoneAdapter {
  list(workspaceId: string): Promise<readonly Milestone[]>;
  read(workspaceId: string, id: string): Promise<Milestone | null>;
  create(input: MilestoneWrite): Promise<Milestone>;
  update(
    workspaceId: string,
    id: string,
    input: MilestoneWrite,
  ): Promise<Milestone>;
  delete(workspaceId: string, id: string): Promise<boolean>;
}
```

The fake adapter stores records in a closure-scoped `Map`, trims and validates
title, always filters by `workspaceId`, and preserves created timestamps on
update. The screen owns loading, empty, list, detail, create, edit, success,
typed-error, and transport-error states. All buttons call real adapter methods.

The generated Confect capability must expose create/list/read/update/delete
operations with typed validation and authorization failures; it must not return
a canned success. The generated table registration must include title, detail,
status, workspace index, and timestamps.

- [ ] **Step 4: Update recipe truth and regenerate its checksum index**

Change outcome, minimum primitive, done state, and focused gates to name full
CRUD. Run the existing recipe-index generator command declared by
`check:recipes`, then verify the new checksum rather than editing it manually.

Run:

```bash
rtk host-test-slot --class focused pnpm check:recipes
rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/index.test.ts src/customer-runtime.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: generator tests and recipe integrity pass.

- [ ] **Step 5: Commit complete CRUD generation**

```bash
rtk git add docs/template/recipes tooling/generators/src/index.ts tooling/generators/src/index.test.ts tooling/generators/src/customer-runtime.ts tooling/generators/src/customer-runtime.test.ts tooling/quality/check-recipes.test.mts
rtk git commit -m "feat(factory): generate complete workspace CRUD"
```

### Task 4: Add deterministic Woodpecker verification

**Files:**

- Create: `.woodpecker/verify.yml`
- Create: `tooling/ci/verify-chassis.sh`
- Create: `tooling/ci/verify-chassis.test.mts`
- Modify: `.factory/project.yaml`
- Modify: `package.json`

**Interfaces:**

- Consumes: repository setup from `tooling/ci/setup.sh` and the focused closures
  from Tasks 1–3.
- Produces: required context `ci/woodpecker/pr/verify`.

- [ ] **Step 1: Add a failing workflow contract test**

Require one non-secret PR workflow with Node 22, `tooling/ci/setup.sh`, and the
decisive chassis script. Require `.factory/project.yaml` to name
`ci/woodpecker/pr/verify` as its required context.

```ts
expect(workflow).toContain("tooling/ci/verify-chassis.sh");
expect(workflow).toContain("node:22.12.0-bookworm@");
expect(project.ci.required_contexts).toContain("ci/woodpecker/pr/verify");
```

- [ ] **Step 2: Run and observe missing workflow failure**

Run:

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/verify-chassis.test.mts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because `.woodpecker/verify.yml` and the required context do not
exist.

- [ ] **Step 3: Add the narrow deterministic gate**

`tooling/ci/verify-chassis.sh` must source `tooling/ci/setup.sh` and run:

```bash
pnpm --dir tooling/agent-pack test:customer
pnpm --dir tooling/generators test
pnpm --dir tooling/release test
pnpm --dir apps/cli test:create-root-integration
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
pnpm --dir apps/web test:runtime-longevity
```

The workflow uses the existing pinned Node image, full Git tags, PR events, and
`failure: cancel`. Do not add the schema-invalid top-level `timeout` property.

- [ ] **Step 4: Verify workflow contract and shell syntax**

Run:

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/verify-chassis.test.mts --maxWorkers=1 --no-file-parallelism
rtk proxy bash -n tooling/ci/verify-chassis.sh
```

Expected: both pass.

- [ ] **Step 5: Commit Woodpecker admission**

```bash
rtk git add .woodpecker/verify.yml .factory/project.yaml tooling/ci/verify-chassis.sh tooling/ci/verify-chassis.test.mts package.json
rtk git commit -m "ci: verify generated customer chassis"
```

### Task 5: Seal and advance alpha.3

**Files:**

- Modify: `tooling/release-seal.test.mts`
- Modify: `tooling/release-seal.mts`
- Create: `releases/v0.2.0-alpha.3/**` through `release:seal`
- Modify: `apps/cli/src/factory/createComposition.ts`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: generator public-default tests that name alpha.2

**Interfaces:**

- Consumes: a clean committed chassis source SHA.
- Produces: immutable `maestro-template-v0.2.0-alpha.3` release authority and
  alpha.3 default customer composition.

- [ ] **Step 1: Change public-default tests to require alpha.3 and observe
      failure**

Require version `0.2.0-alpha.3`, tag `maestro-template-v0.2.0-alpha.3`, and
composition checksums read from the newly sealed manifest. Historical alpha.2
reproduction tests remain unchanged.

- [ ] **Step 2: Run focused release/default tests and observe alpha.2 mismatch**

Run:

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts apps/cli/src/factory/candidateComposition.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: FAIL because alpha.2 is still the public default and alpha.3 has not
been sealed.

- [ ] **Step 3: Commit the complete source tree and seal from that exact SHA**

```bash
rtk git add -A
rtk git commit -m "chore(factory): prepare alpha.3 release source"
rtk git rev-parse HEAD
rtk proxy zsh -lc 'rtk pnpm release:seal -- --version 0.2.0-alpha.3 --source-commit "$(rtk git rev-parse HEAD)"'
```

The nested command reads the exact clean committed HEAD and passes it unchanged
to the sealer; it does not resolve a branch name or mutable tag.

- [ ] **Step 4: Advance composition using generated manifest evidence**

Set `CURRENT_PUBLIC_DEFAULT_VERSION`, `BASE_MANIFEST_PATH`, `BASE_TAG`,
`BASE_COMMIT`, and the three alpha.3 checksums to the exact sealed values. Keep
`ALPHA_2_SOURCE` or equivalent historical test authority intact where alpha.2
immutability tests require it.

- [ ] **Step 5: Verify release seal and public default**

Run:

```bash
rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts apps/cli/src/factory/candidateComposition.test.ts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/customerCliRuntime.test.ts --maxWorkers=1 --no-file-parallelism
```

Expected: all pass with alpha.3 as the zero-argument composition.

- [ ] **Step 6: Commit sealed release and composition**

```bash
rtk git add releases/v0.2.0-alpha.3 tooling/release-seal.mts tooling/release-seal.test.mts apps/cli tooling/generators
rtk git commit -m "release: seal customer chassis alpha.3"
```

### Task 6: Prove a disposable customer app end to end

**Files:**

- No tracked source files expected.
- Disposable target:
  `/Users/headless/.codex-worktrees/maestro-template-saas-ui-chassis-acceptance-20260804`

**Interfaces:**

- Consumes: alpha.3 public default and `crud-business-entity`.
- Produces: install, preflight, recipe receipt, generated gates, browser
  behavior, longevity, and clean-shutdown evidence.

- [ ] **Step 1: Materialize an empty disposable target**

Preview, use the returned exact confirmation command, install with the frozen
lockfile under Node 22, and create the required baseline commit.

- [ ] **Step 2: Prove preflight with and without global Corepack**

Run preflight once with the Node 22/Corepack path and once with a PATH that
contains Node 22, Git, and npx but no `corepack` executable. Both must return
success and choose a supported pnpm command.

- [ ] **Step 3: Apply CRUD atomically**

Preview `crud-business-entity` for `Milestone`, execute its returned exact
fingerprinted confirmation command, inspect receipt/backups/witnesses, and run
every emitted gate.

- [ ] **Step 4: Exercise complete browser CRUD and runtime longevity**

Create, read, update, list, and delete a Milestone. Verify empty, validation
failure, and cross-workspace isolation. Keep the browser lifecycle running
beyond 120 seconds, require `/health` 200, then stop cleanly.

- [ ] **Step 5: Run committed broad verification remotely**

Run:

```bash
rtk maestro-remote-test -- pnpm verify
```

If the remote host is unavailable, use:

```bash
rtk host-test-slot --class full pnpm verify
```

Expected: all deterministic repository gates pass. `check-generators` remains
excluded only where the repository's documented live Convex requirement makes it
unsuitable for generic preflight; the dedicated generator suites above must
still pass.

- [ ] **Step 6: Review and cleanup**

Run `rtk git diff`, request code review for the full committed range, repair all
Critical and Important findings, rerun affected checks, stop all child
processes, confirm audit ports are free, and confirm `rtk git status --short` is
clean.
