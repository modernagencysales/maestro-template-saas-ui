# Bootstrap And Projection Hygiene Implementation Plan

> **For the lane owner:** Treat this as one continuous subsystem goal. Make
> coherent commits, run focused checks while authoring, and keep moving until
> the complete lane outcome is ready for review.

**Goal:** Give factory and generated-app agents one accurate engineering-rules
index, one compatible toolchain, and clean first-run projections without
removing useful pattern material.

**Architecture:** The repository keeps committed first-contact agent guidance
derived from named canonical sources. CI reuses a compatible preinstalled Node
and installs only missing or mismatched pnpm. Empty placeholder workspaces are
removed rather than advertised as implemented patterns.

**Tech Stack:** Node.js, pnpm 10.12.1, TypeScript, Vitest, Woodpecker, Qlty,
Maestro generators.

## Global Constraints

- Preserve reference implementations, Effect/Confect sources, Cucumber, and
  first-run agent guidance.
- At lane startup, compare unmerged commits `326a2761a` through `76c24a137`
  once, record reusable content/tests and rejected policies in the brief, and do
  not merge that branch wholesale or touch its dirty worktree.
- `docs/template/enforced-engineering-rules.md` is the canonical agent-readable
  trigger index; executable configuration remains authoritative.
- Qlty thresholds remain: identical code 12 lines, similar code 15 lines,
  function complexity 10, file complexity 50, returns 5, boolean logic 4,
  parameters 5, nested control flow 4.
- Woodpecker is blocking; Qlty and AI review are advisory.
- No worktree may symlink another checkout's `node_modules`.
- Keep `concurrently`: pnpm native parallel execution does not provide an
  equivalent proven sibling-shutdown contract for `dev:backend`.
- Do not alter historical release payloads or deployment authority.
- Run repository-pinned Qlty on the lane diff with the host's 30-second cap for
  visibility; it is not admission authority.
- This core lane publishes coherent commits to the shared composition owner; it
  does not open its own PR or run a duplicate full gate.
- Dependency removals update lockfile/artifact allowlists and run license,
  vulnerability, frozen offline install, Knip, and advisory OSV/Qlty evidence;
  CI installs keep lifecycle scripts ignored.
- Focused checks while authoring; Woodpecker owns the sole blocking full
  verification on the current PR head.

## Delivery Batch

- Batch role: core lane contribution to the composed PR.
- Branch: `codex/lean-bootstrap-projection-hygiene`.
- Base: current `origin/main` at lane start; no lane PR target.
- Tasks: 1-4.
- Whole-batch review: independent review of `origin/main...HEAD` against this
  plan and the design.
- Required verification: focused lane checks plus handoff to the composed
  delivery branch; that branch owns the single PR and Woodpecker result.

---

### Task 1: Publish one lean enforced-engineering-rules index

> The bootstrap core worker owns the source documents and AGENTS guidance. The
> shared composition owner applies the listed blueprint projection/test edits.

**Files:**

- Create: `docs/template/enforced-engineering-rules.md`
- Modify: `docs/template/coding-standards.md`
- Modify: `docs/rule-coverage.md`
- Modify: `AGENTS.md`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`

**Interfaces:**

- The new index maps changed areas to focused package commands and distinguishes
  deterministic blockers, local authoring checks, conditional checks, and
  advisory review.
- It states actual scope: ESLint deterministically enforces changed-code
  complexity `10`, nesting `4`, and parameters `5`; Qlty advisories report all
  eight thresholds but exclude `tooling/**` and retain monitor-scoped debt;
  blocking type coverage is `99.7%` alongside dependency, secret, architecture,
  and Effect diagnostics.
- Generated customers receive the index and their applicable Qlty configuration
  but not factory-only Woodpecker commands.

- [ ] **Step 1: Write failing projection tests**

  Require a current generated target to contain
  `docs/template/enforced-engineering-rules.md`, the eight exact Qlty
  thresholds, focused-per-task/full-per-batch language, Cucumber
  customer-journey limits, and the Woodpecker/Qlty posture. Assert it does not
  tell a customer to execute absent factory CI paths. For every named blocking
  security rule in the generated index, assert its command owner is
  materialized; factory-only rules remain in the factory index but are labeled
  reference-only or omitted from customer executable instructions.

- [ ] **Step 2: Adapt the existing document to the lean authority**

  Use the unmerged branch's document as source material. Remove
  exact-fingerprint, repository-cleanliness, mandatory surface tags, broad
  pre-push, and per-task full-verification rules. Keep security, lifecycle,
  headless parity, denial tests, dependencies, generated ownership, exact Qlty
  thresholds, and focused trigger commands. Do not describe advisory Qlty
  thresholds as Woodpecker blockers or hide its exclusions/monitor scope. Keep
  the useful rationale, examples, and domain exceptions in
  `coding-standards.md`; link it to this index and remove only duplicated
  executable gate ownership.

- [ ] **Step 3: Project and verify the document**

  ```sh
  rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/blueprints/saasApplication.test.ts
  rtk pnpm check:docs-freshness
  rtk pnpm check:agent-pack
  ```

- [ ] **Step 4: Commit**

  ```sh
  rtk git add docs/template/enforced-engineering-rules.md docs/template/coding-standards.md docs/rule-coverage.md AGENTS.md tooling/generators
  rtk git commit -m "docs: publish lean engineering rule index"
  ```

### Task 2: Align the preferred Node runtime and simplify CI bootstrap

**Files:**

- Modify: `.nvmrc`
- Modify: `package.json`
- Modify: `.woodpecker/firewall.yml`
- Modify: `.woodpecker/epoch.yml`
- Modify: `.woodpecker/deploy.yml`
- Modify: `.woodpecker/verify.yml`
- Modify: `tooling/ci/controller.Dockerfile`
- Modify: `tooling/ci/setup.sh`
- Modify: `tooling/ci/verify-chassis.test.mts`
- Create: `tooling/ci/setup.test.mts`
- Modify: `tooling/quality/check-deploy-authority.mts`
- Modify: `tooling/quality/check-deploy-authority.test.mts`
- Modify: `tooling/agent-pack/src/preflight.test.ts`

**Interfaces:**

- pnpm version: `10.12.1`.
- Preferred Node: `22.23.2`; compatible engines:
  `^22.23.2 || ^24.0.0 || >=26.0.0`.
- CI image:
  `node:22.23.2-bookworm@sha256:0557ac14e0d45d02ed563067b82856ca5e7aa3437fa28d98d4350ea9c3d9494a`.
- A compatible preinstalled Node is used directly; fnm remains only the checked
  fallback for a bare non-container runner.

- [ ] **Step 1: Add bootstrap behavior tests**

  Assert setup does not call `fnm install` when the preinstalled
  `node --version` satisfies the declared engine range, installs pnpm `10.12.1`
  only when absent or mismatched, and retains the checksum-verified fnm fallback
  for a genuinely incompatible bare runner. `setup.test.mts` runs the shell
  boundary with a temporary `PATH` containing fake `node`, `pnpm`, `fnm`,
  `curl`, and `uname` executables. Cover compatible Node with missing pnpm,
  mismatched pnpm, missing Node, incompatible Node, and checksum failure without
  making a network request.

- [ ] **Step 2: Simplify setup**

  Validate preinstalled Node first, install pinned pnpm only when absent or the
  wrong version, and enter the existing fnm fallback only when Node itself is
  absent or incompatible. Update `.nvmrc`, active CI images/digest,
  deploy-authority pins, and preflight expectations together; do not touch
  vendored Effect/Confect lockfiles.

- [ ] **Step 3: Prove both bootstrap paths**

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/setup.test.mts tooling/ci/verify-chassis.test.mts tooling/quality/check-deploy-authority.test.mts tooling/agent-pack/src/preflight.test.ts
  ```

  Expected: compatible-image tests never invoke fnm; the isolated fallback test
  still verifies the pinned archive checksum before use.

- [ ] **Step 4: Commit**

  ```sh
  rtk git add .nvmrc package.json .woodpecker tooling/ci tooling/quality/check-deploy-authority.mts tooling/quality/check-deploy-authority.test.mts tooling/agent-pack/src/preflight.test.ts
  rtk git commit -m "chore: align compatible CI runtimes"
  ```

### Task 3: Remove one redundant skill projection safely

**Files:**

- Modify: `tooling/agent-pack/src/syncSkills.ts`
- Modify: `tooling/agent-pack/src/syncSkills.test.ts`
- Modify: `tooling/agent-pack/src/nodeAdapters.ts`
- Modify: `tooling/agent-pack/src/nodeAdapters.test.ts`
- Modify: `tooling/quality/check-agent-pack.test.mts`
- Modify: host-install tests referencing the generated Codex copy.
- Delete: `agent-pack/generated/codex/.agents/skills/maestro/**`
- Modify: active setup documentation.

**Interfaces:**

- Canonical Maestro skill source: `agent-pack/skills/maestro`.
- Claude plugin projection: `agent-pack/plugins/maestro/skills/maestro`.
- First-run Codex projection: committed `.agents/skills/maestro`, synchronized
  directly from the canonical source.

- [ ] **Step 1: Write failing canonical-source tests**

  Require `checkRootSkillProjections` and the Codex installer to compare/copy
  directly from `agent-pack/skills/maestro`. Assert no runtime path references
  `agent-pack/generated/codex/.agents/skills/maestro`.

- [ ] **Step 2: Point consumers at the canonical source and delete the copy**

  Keep `.agents/skills/maestro` committed for immediate repository discovery.
  Update synchronization and installers to use `agent-pack/skills/maestro`
  directly, then delete only the now-unreferenced intermediate generated copy.
  Keep official Convex and host-specific plugin patterns intact.

- [ ] **Step 3: Verify first-run projections**

  ```sh
  rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/syncSkills.test.ts src/nodeAdapters.test.ts src/codexInstall.native.test.ts
  rtk pnpm check:agent-pack
  rtk pnpm check:convex-ai-files
  ```

- [ ] **Step 4: Commit**

  ```sh
  rtk git status --short
  rtk git add -A agent-pack tooling/agent-pack .agents docs/template
  rtk git commit -m "refactor: remove redundant skill projection"
  ```

### Task 4: Delete misleading empty workspaces

> The bootstrap core worker owns classification and workspace removal. The
> shared composition owner removes corresponding current blueprint metadata.

**Files:**

- Delete: `apps/voice-relay/**`
- Delete: `tooling/pr-backlog/**`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `AGENTS.md`
- Modify: `docs/template/repo-map.md`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/release/src/customerTarget/ownership.ts`

**Interfaces:**

- PR backlog is handled by GitHub/host tooling, not a no-op workspace.
- Historical release manifests remain unchanged.

- [ ] **Step 1: Classify both workspaces before deletion**

  Scan contents, imports, package scripts, docs, active generated projections,
  and release ownership. Current inspection shows only package metadata/an empty
  package-name export; confirm that remains true. If either contains a unique
  useful pattern or evidence, consolidate only that value into its canonical
  owner and update this plan before deletion.

- [ ] **Step 2: Add current-tree absence tests after classification**

  Require current blueprints, workspaces, project references, package scripts,
  and active repo maps to omit both packages. Preserve assertions that immutable
  historical releases can still mention them.

- [ ] **Step 3: Remove packages and current authorities**

  Delete the no-op packages and remove current manifest, TypeScript reference,
  generated-customer surgery, ownership, `test:pr-backlog`, and active-doc
  entries. Do not edit immutable `releases/**` or historical plans.

- [ ] **Step 4: Verify workspace integrity**

  ```sh
  rtk pnpm install --lockfile-only
  rtk pnpm --dir tooling/generators typecheck
  rtk pnpm --dir tooling/release typecheck
  rtk pnpm --dir tooling/generators test
  rtk pnpm --dir tooling/release test:unit
  ```

- [ ] **Step 5: Commit**

  ```sh
  rtk git status --short
  rtk git add -A
  rtk git commit -m "chore: remove empty placeholder workspaces"
  ```

  Use `git add -A` only after the status review confirms every changed/deleted
  path belongs to this task; otherwise stage explicit paths.

## Delivery Review

- [ ] Run `rtk git diff --check origin/main...HEAD` and confirm no immutable
      release or deploy authority changed.
- [ ] Run
      `rtk rg -n 'agent-pack/generated/codex|apps/voice-relay|tooling/pr-backlog' tooling apps AGENTS.md docs/template`;
      only explicitly historical references may remain.
- [ ] Generate one current customer target and prove it contains the lean
      engineering-rules index, exact Qlty thresholds, and working first-run
      agent skill projection.
- [ ] Push the lane branch and hand its commit list, focused evidence, and
      shared-seam requirements to the composition owner; do not open a separate
      PR.
