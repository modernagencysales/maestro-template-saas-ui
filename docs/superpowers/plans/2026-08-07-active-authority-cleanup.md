# Active Authority Cleanup Implementation Plan

> **For the lane owner:** Treat this as one continuous subsystem goal. Make
> coherent commits, run focused checks while authoring, and keep moving until
> the complete lane outcome is ready for review.

**Goal:** Remove frozen AI-review orchestration, obsolete Graphite/Just
authorities, broad local admission, and source-text duplicates while preserving
the real deterministic quality and security gates.

**Architecture:** Package scripts and Woodpecker remain the executable
authorities. AI judges become ordinary advisory commands, Lefthook stays fast,
and diagnostic metadata points at real scripts without copying their bodies.

**Tech Stack:** TypeScript, Node.js, pnpm, Vitest, Lefthook, Woodpecker, Qlty.

## Global Constraints

- Preserve every security, tenant-isolation, secret, dependency, type,
  architecture, behavior, and Cucumber gate.
- Woodpecker is the only blocking CI authority; Qlty and AI review are advisory.
- Package scripts are the executable command authority.
- Historical plans remain historical evidence and are not mass-rewritten.
- Do not change deployment, migration, promotion, rollback, or release archive
  authority.
- Focused checks run while authoring; Woodpecker owns the sole blocking full
  verification on the current PR head.
- Use repository-pinned tools through pnpm.
- Run repository-pinned Qlty on the lane diff with the host's 30-second cap for
  visibility; its findings or provider/runtime failure do not block.
- This core lane publishes coherent commits to the shared composition owner; it
  does not open its own PR or run a duplicate full gate.
- Do not add a replacement registry, review controller, stack manager, or
  dependency.
- Preserve the authoring thresholds exactly: Qlty identical `12`, similar `15`,
  function complexity `10`, file complexity `50`, returns `5`, boolean logic
  `4`, parameters `5`, nesting `4`; Qlty remains advisory and excludes
  `tooling/**`. Preserve strict TypeScript, `99.7%` type coverage, Effect
  diagnostics, dependency-cruiser/Knip, Gitleaks, and tenant/security gates.
- Dependency removals update lockfile/artifact allowlists and run license,
  vulnerability, frozen offline install, Knip, and advisory OSV/Qlty evidence;
  CI installs keep lifecycle scripts ignored.

## Delivery Batch

- Batch role: core lane contribution to the composed PR.
- Branch: `codex/lean-active-authority-cleanup`.
- Base: current `origin/main` at lane start; no lane PR target.
- Tasks: 1-4.
- Focused checks: commands named in each task.
- Whole-batch review: independent review of `origin/main...HEAD` against this
  plan and the design.
- Required verification: focused lane checks plus handoff to the composed
  delivery branch; that branch owns the single PR and Woodpecker result.

---

### Task 1: Remove the frozen AI review controller

**Files:**

- Modify: `tooling/quality/taste-review.mts`
- Modify: `tooling/quality/contract-review.mts`
- Delete: `tooling/quality/ai-review-cycle.mts`
- Delete: `tooling/quality/ai-review-cycle.test.mts`
- Modify: `.woodpecker/firewall.yml`
- Modify: `package.json`
- Modify: `tooling/quality/woodpecker-template-pipeline.test.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`

**Interfaces:**

- Removes `review:bounded`, frozen finding sets, repair rounds, PR-comment
  state, and the `bounded-ai-review` Woodpecker step.
- Keeps the existing ordinary taste and contract review entrypoints and their
  verdict schemas; no replacement review state or helper layer is introduced.

- [ ] **Step 1: Write failing tests for advisory-only review**

  Update the Woodpecker tests to assert that the firewall contains only
  `trusted-ci-policy` and `firewall`, contains no AI provider secret, and never
  invokes `ai-review-cycle.mts`. Keep the existing ordinary reviewer tests.

- [ ] **Step 2: Remove the controller without replacing it**

  Remove frozen-verification modes and their imports from `taste-review.mts` and
  `contract-review.mts`, then delete the controller and its tests. Remove the
  `review:bounded` script and the already-nonblocking Woodpecker step. Do not
  alter the ordinary reviewers' advisory verdict schemas.

- [ ] **Step 3: Run focused review-tool tests**

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/taste-review.test.mts tooling/quality/contract-review.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts
  rtk pnpm --dir tooling/quality typecheck
  ```

  Expected: all pass; no active source references `review:bounded` or
  `ai-review-cycle.mts`.

- [ ] **Step 4: Commit**

  ```sh
  rtk git add tooling/quality .woodpecker/firewall.yml package.json
  rtk git commit -m "chore: remove frozen AI review controller"
  ```

### Task 2: Replace pin-only command copies with diagnostic metadata

**Files:**

- Modify: `tooling/quality/src/gate.mts`
- Modify: `tooling/quality/src/gate.test.mts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/src/diagnosticRegistry.mts`
- Modify: `tooling/quality/src/diagnosticRegistry.test.mts`
- Modify: `tooling/agent-pack/src/verificationRunner.ts`
- Modify: `tooling/agent-pack/src/verificationRunner.test.ts`
- Modify: `tooling/agent-pack/src/diagnostics.ts`

**Interfaces:**

- Diagnostic descriptors keep `gateId`, posture, evidence class, docs, repair
  hint, argv/rerun, focused prefixes, prerequisites, and semantic rule IDs.
- `canonicalScriptBody` is removed; package.json is the command-body authority.
- Verification attribution uses descriptor argv as command identity and resolves
  current package scripts at execution time; it no longer compares copied
  command bodies.
- Static `includes`/`absent` requirements remain only where exact bytes are an
  external compatibility contract.

- [ ] **Step 1: Write failing registry tests**

  Reject `canonicalScriptBody` and assert that the registry does not copy
  package-script or YAML bodies. Validate root-script descriptors against
  `package.json`; validate direct executables and `pnpm --dir` descriptors by
  their existing command-kind behavior tests rather than interpreting every
  second argv item as a root script:

  ```ts
  expect(descriptor).not.toHaveProperty("canonicalScriptBody");
  ```

- [ ] **Step 2: Remove duplicated command bodies and brittle claims**

  Remove `canonicalScriptBodies` and `canonicalScriptBody`. Delete requirements
  that are exact known consumers of `canonicalScriptBody`. Preserve every other
  static requirement in this task; classifying unrelated `check-*.mts` commands
  is separate reviewed work. The Acceptance lane exclusively owns the headless
  runtime-success and idempotency rewrite; do not duplicate it here. Update
  verification runner and diagnostics types so argv identifies the command and
  any package-script body is read from current `package.json` when needed. Do
  not roam across unrelated checker implementations.

- [ ] **Step 3: Run focused quality tests**

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/src/gate.test.mts tooling/quality/src/diagnosticRegistry.test.mts tooling/agent-pack/src/verificationRunner.test.ts
  rtk pnpm check:headless-surface-contract
  rtk pnpm check:ci-completeness
  ```

  Expected: all pass and successful check output no longer says `pin-only`.

- [ ] **Step 4: Commit**

  ```sh
  rtk git add tooling/quality tooling/agent-pack/src/verificationRunner.ts tooling/agent-pack/src/verificationRunner.test.ts tooling/agent-pack/src/diagnostics.ts
  rtk git commit -m "refactor: keep one quality command authority"
  ```

### Task 3: Make local hooks fast and delivery-batch scoped

> The active-authority worker owns Qlty, firewall, Lefthook, and global
> instructions. The shared composition owner applies generated blueprint
> compatibility from this task's tested Qlty contract.

**Files:**

- Modify: `lefthook.yml`
- Modify: `tooling/quality/check-qlty.mts`
- Modify: `tooling/quality/check-qlty.test.mts`
- Modify: `tooling/ci/firewall.sh`
- Modify: `tooling/ci/epoch.sh`
- Modify: `tooling/ci/phase1.sh`
- Modify: `package.json`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Delete: `scripts/pre-push-rubric.sh`
- Modify: `AGENTS.md`
- Modify: `docs/template/agent-worker-playbook.md`
- Modify: `docs/template/coding-standards.md`
- Modify: hook/CI tests that own these contracts.

**Interfaces:**

- Pre-commit: staged Prettier and staged ESLint debt ratchet. Qlty may report
  findings but cannot fail the hook or firewall.
- Pre-push: no broad repository admission; at most changed-file hygiene that
  completes quickly.
- Full verification: the current PR head's Woodpecker run.

- [ ] **Step 1: Write failing hook and instruction tests**

  Assert Lefthook contains no broad `typecheck`, `test`, workflow, system, data,
  promotion, or Cucumber command and that active agent instructions say focused
  checks per commit plus one batch verification.

- [ ] **Step 2: Narrow hooks and instructions**

  Keep staged format/lint behavior. Port the narrow Qlty-advisory behavior from
  commits `365cde5a8` and `326a2761a` for both factory and generated-customer
  wrappers. Findings, a missing binary, timeout, provider/runtime failure, and
  Qlty nonzero status must remain visible but exit successfully; deterministic
  Gitleaks remains independently blocking. Remove rubric injection and broad
  pre-push commands. Replace active per-task broad gates with focused affected
  checks. Do not rewrite dated historical plans.

  Consume Acceptance's script handoff: remove factory-root Cucumber no-ops; make
  root `test` the single owner of workspace/component suites and root `verify`
  the single deterministic sequence; remove nested acceptance and post-verify
  reruns from firewall/epoch/phase1. Use Turbo's native
  `turbo run test --dry=json` output for ownership review, not a custom parser
  or suite registry.

- [ ] **Step 3: Verify hook configuration**

  ```sh
  rtk pnpm exec lefthook validate
  rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-qlty.test.mts tooling/generators/src/blueprints/saasApplication.test.ts
  rtk pnpm check:config-drift
  rtk pnpm check:ci-completeness
  ```

- [ ] **Step 4: Commit**

  ```sh
  rtk git add lefthook.yml scripts/pre-push-rubric.sh AGENTS.md docs/template tooling/quality/check-qlty.mts tooling/quality/check-qlty.test.mts tooling/ci/firewall.sh tooling/generators/src/blueprints/saasApplication.ts tooling/generators/src/blueprints/saasApplication.test.ts
  rtk git commit -m "chore: move broad admission to Woodpecker"
  ```

### Task 4: Remove Graphite and Just as active authorities

**Files:**

- Delete: `tooling/stack/**`
- Delete if unreferenced, otherwise reduce: `Justfile`
- Modify: `package.json`
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `apps/cli/src/factory/composition.test.ts`
- Delete: `apps/cli/src/factory/planCheck.ts`
- Delete: `apps/cli/src/factory/planCheck.test.ts`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `tooling/agent-pack/src/verificationRunner.ts`
- Modify: `tooling/agent-pack/src/verificationRunner.test.ts`
- Delete: `tooling/agent-pack/src/planCheck.ts`
- Delete: `tooling/agent-pack/src/planCheck.test.ts`
- Modify: `tooling/agent-pack/src/mcp/projection.ts`
- Modify: `tooling/agent-pack/src/mcp/projection.test.ts`
- Modify: `tooling/agent-pack/src/privacy/networkPolicy.ts`
- Modify: `tooling/agent-pack/src/privacy/privacy.canaries.test.ts`
- Modify: `tooling/agent-pack/src/privacy/privacy.noNetwork.test.ts`
- Modify: `tooling/quality/check-agent-pack-factory-wiring.mts`
- Modify: `tooling/quality/check-agent-pack.test.mts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/release/src/customerTarget/ownership.ts`
- Modify: active docs and rule coverage that advertise Graphite or Just.

**Interfaces:**

- Full verification command: `pnpm verify`.
- Branch/PR workflow: plain GitHub branches and PRs.
- No package script or generated customer file references `stack:*` or `just`.
- The public `plan-check` command is removed with its stack validator rather
  than rehomed as a new registry. Unique workspace/auth/type-escape/prompt/model
  contract-risk guidance is preserved in
  `docs/template/enforced-engineering-rules.md`.

- [ ] **Step 1: Write failing absence tests**

  First scan imports, package manifests, scripts, CLI/MCP projections, and docs.
  Update tests to require `pnpm verify`, omit `tooling/stack`, omit the public
  `plan-check` command, and contain no Graphite executable contract. Copy only
  the unique security guidance from `contract-risk-registry.mts` into the
  canonical engineering-rules document before deleting the package.

- [ ] **Step 2: Delete obsolete authorities and repair callers**

  Remove stack scripts/package, `@maestro-template/stack-tooling` from
  `apps/cli/package.json`, the plan-check CLI/Agent Pack/MCP/network-policy
  surfaces, and Justfile generation surgery. Change the verification runner's
  full descriptor and diagnostics from `just verify` to `pnpm verify`. Remove
  workspace, coverage, release ownership, lockfile, and active-doc references.
  Preserve historical plan text. Scan for real external Just consumers first:
  delete `Justfile` if none exists; otherwise retain only a forwarding `verify`
  recipe and no other Just authority.

- [ ] **Step 3: Run focused ownership and generation checks**

  ```sh
  rtk host-test-slot --class focused pnpm exec vitest run tooling/generators/src/blueprints/saasApplication.test.ts tooling/agent-pack/src/verificationRunner.test.ts tooling/quality/check-agent-pack.test.mts
  rtk pnpm --dir tooling/agent-pack typecheck
  rtk pnpm --dir tooling/generators typecheck
  ```

- [ ] **Step 4: Commit**

  ```sh
  rtk git status --short
  rtk git add -A
  rtk git commit -m "chore: remove obsolete stack authorities"
  ```

  Stage all only after the status review confirms every changed/deleted path is
  named by this task; otherwise stage explicit paths.

## Delivery Review

- [ ] Review `rtk git diff --check origin/main...HEAD` and confirm the diff does
      not change deployment authority or remove deterministic security gates.
- [ ] Run
      `rtk rg -n 'review:bounded|ai-review-cycle|stack:|tooling/stack|just verify' package.json AGENTS.md lefthook.yml .woodpecker tooling apps docs/template`;
      only explicitly historical prose may remain.
- [ ] Push the lane branch and hand its commit list, focused evidence, and
      shared-seam requirements to the composition owner. Qlty and AI findings
      remain visible and advisory; do not open a separate PR.
