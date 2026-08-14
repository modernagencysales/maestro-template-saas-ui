# Saas UI Paved Path Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make purchased Saas UI compositions the obvious and enforced frontend
path in the template, then project that path into B2B Creator OS and prove it in
the hosted product.

**Architecture:** Keep one checked-in composition shelf, one generator path, and
one small ESLint rule. Delete competing foundational UI, adapt real product
state into purchased compositions, and verify representative routes through
focused tests plus hosted Cucumber. Do not add a registry service, visual policy
engine, hashes, provenance machinery, or another control plane.

**Tech Stack:** TanStack Start/Router, React 19, Chakra UI, Saas UI Pro,
Confect/Convex/Effect, Vitest, ESLint, Playwright/Cucumber, Cloudflare Workers.

## Global Constraints

- Use only semantic design tokens; do not hard-code colors or a global color
  palette.
- Preserve WorkOS, Convex/Confect, Tinybird, Effect, CLI/MCP, and Cucumber
  boundaries.
- Shipped UI must use live provider state; no runtime fixtures or fake adapters.
- Cloudflare Workers is the deployment target; never Cloudflare Pages.
- Woodpecker `ci/woodpecker/pr/verify` is the required merge authority; Qlty is
  advisory.
- Add no new UI control plane. Prefer deletion, checked-in examples, generator
  output, lint, and behavioral tests.
- Run broad local gates through `host-test-slot`; use focused checks during
  implementation.

## Delivery Batches

### Batch A: Template paved path

- Tasks: 1-3
- Branch/head: `feature/saas-ui-template-foundation` at the final frozen head
- Base and PR target: `main`, PR #49
- Focused checks: ESLint rule tests, generator contract test, upstream fidelity
  tests, web/package typechecks
- Required verification: Woodpecker `ci/woodpecker/pr/verify` on the frozen head

### Batch B: B2B Creator OS projection and hosted proof

- Tasks: 4-6
- Branch/head: `feature/product-live-composition` at the final frozen head
- Base and PR target: `main`, PR #27
- Focused checks: owned route tests, primitive lint, hosted support tests,
  Cucumber scenarios
- Required verification: Woodpecker `ci/woodpecker/pr/verify` plus hosted
  Cucumber on the deployed frozen head

---

### Task 1: Close template lint escape hatches

**Files:**

- Modify: `tooling/eslint-plugin-template/rules/prefer-saas-ui-primitives.mjs`
- Modify: `tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs`
- Modify: `eslint.config.mjs`

**Interfaces:**

- Consumes: installed Chakra/Saas UI packages and
  `apps/web/src/saas-ui/patterns`.
- Produces: one rule that checks imported symbol names before aliases and
  accepts only exact approved sources.

- [ ] Add failing RuleTester cases for `Button as PrimaryButton`, a fake path
      containing `saas-ui/patterns`, and raw controls in shipped UI scope.
- [ ] Run
      `pnpm --dir tooling/eslint-plugin-template test -- prefer-saas-ui-primitives`
      and confirm the new cases fail for the intended bypass.
- [ ] Change the existing rule only: inspect both imported and local names,
      replace substring source admission with exact package/shelf path
      admission, and cover shipped `packages/ui` source after Task 2 removes
      intentional conflicts.
- [ ] Re-run the focused rule suite and focused lint for changed files.
- [ ] Commit the rule and tests.

### Task 2: Remove competing template UI authorities

**Files:**

- Modify/delete only conflicting exports and implementations under
  `packages/ui/src/`
- Modify call sites under `apps/web/src/` that still consume those exports
- Modify focused package and shell contract tests

**Interfaces:**

- Consumes: installed Saas UI toaster, dialogs, controls, shell, settings, and
  Kanban.
- Produces: no alternate foundational `Button`, shell, dialog, settings panel,
  Kanban, or toast path for product code to copy.

- [ ] Write or update focused tests so imports of the obsolete foundational
      exports fail the contract while approved non-foundational
      document/coediting utilities remain available.
- [ ] Confirm the focused tests fail against the current exports.
- [ ] Delete unused competing shell/dialog/settings/Kanban code and exports.
      Replace live toast and notification call sites with the installed Saas
      UI/Chakra equivalents; preserve behavior and accessibility.
- [ ] Convert shipped public-funnel raw controls to installed primitives; keep
      native checkbox/file inputs only where the existing lint rule explicitly
      permits them.
- [ ] Run package UI tests, affected web tests, lint, and the two affected
      typechecks.
- [ ] Commit the deletion/migration.

### Task 3: Prove generated feature fidelity and repair template CI

**Files:**

- Modify: `tooling/generators/src/index.test.ts`
- Modify only the existing dependency-protection authority used by
  `tooling/ci/ci-self-protection.sh`
- Modify: `docs/template/saas-ui-pattern-catalog.md` only for the three verified
  useful Pro variants

**Interfaces:**

- Consumes: `template:add-feature`, the checked-in pattern shelf, and the
  protected lockfile dependency mechanism.
- Produces: a materialized generated feature that lints and typechecks, plus
  admitted direct runtimes already imported by checked-in source.

- [ ] Add a failing generator test that writes one feature to a temporary
      generated tree and runs the existing lint/typecheck seam against its
      route, screen, feature, and adapter.
- [ ] Confirm failure before adding the minimum missing smoke helper or fixture
      wiring.
- [ ] Make the existing generator test materialize and verify the emitted
      feature without adding a second generator framework.
- [ ] Admit `@chakra-ui/charts` and the other already-imported direct runtimes
      through the existing dependency-protection mechanism; do not weaken the
      firewall.
- [ ] Record metric-with-button, metric-with-icon, and task-with-properties as
      ready/reference source without installing new code until used.
- [ ] Run generator, upstream-fidelity, dependency-protection, lint, and
      typecheck checks; commit.

### Task 4: Remove product drift and legacy authorities

**Files:**

- Modify product equivalents under `packages/ui/src/`,
  `apps/web/src/routes/__root.tsx`, `apps/web/src/adapters/confect-state.ts`,
  and affected features
- Modify: `apps/web/src/features/attribution/public-landing.tsx`
- Modify: `apps/web/src/saas-ui/system.ts`
- Modify focused foundation/shell tests

**Interfaces:**

- Consumes: the finished template shelf and installed toaster/control
  primitives.
- Produces: token-only product theme and no competing foundational product
  authority.

- [ ] Add failing focused assertions for the raw attribution button, hard-coded
      global palette, and obsolete foundational exports.
- [ ] Replace the raw control, remove the global palette, migrate live toast
      use, and delete unused competing UI/CSS/tests.
- [ ] Run semantic-asset scan, primitive lint, shell/foundation tests, and
      affected typechecks.
- [ ] Commit.

### Task 5: Finish high-value product route compositions

**Files:**

- Modify: `apps/web/src/features/today/today-surface.tsx`
- Modify: `apps/web/src/features/campaignAnalytics/campaign-analytics-view.tsx`
- Modify: `apps/web/src/features/creator-self/creator-profile-*.tsx`
- Modify:
  `apps/web/src/features/creator-opportunities/creator-opportunities-feature.tsx`
- Modify: creator access and creator analytics owned surfaces
- Modify focused route/component tests

**Interfaces:**

- Consumes: `KpiCard`, `TaskCard`, report/chart, collection/detail,
  form-section/settings, DataGrid, and account API compositions.
- Produces: primary agency and creator routes whose top-level hierarchy is
  purchased-source-derived while retaining live product state.

- [ ] For each owned surface, add or update a focused test that asserts loading,
      empty, ready/read, ready/edit, and mutation failure/success states when
      applicable, plus the selected purchased composition.
- [ ] Confirm each changed test fails before migrating its surface.
- [ ] Replace arbitrary top-level Card/Stack layouts with the smallest matching
      checked-in composition. Reuse agency opportunity/access/profile structures
      for creator equivalents instead of duplicating them.
- [ ] Run each focused test immediately after its surface, then run primitive
      lint and affected web typecheck once for the task.
- [ ] Commit the route migration.

### Task 6: Replace stale acceptance, deploy, and verify

**Files:**

- Modify: `features/support/hosted-environment.ts`
- Modify: `features/support/hosted-product.ts`
- Modify: `features/support/hosted-product.test.ts`
- Modify hosted feature/scenario files for primary agency and creator journeys
- Modify: `playwright.config.ts`
- Modify: `docs/template/hosting.md`

**Interfaces:**

- Consumes: real WorkOS credentials, live Convex, live Tinybird, Workers
  deployment, CLI/MCP key lifecycle.
- Produces: authenticated desktop/mobile Light/Dark evidence for representative
  dashboard, collection, detail, form, split, settings, and report journeys.

- [ ] Keep the existing failing hosted scenarios as RED evidence; remove only
      the unused JWT/token contract and stale Pages defaults.
- [ ] Finish real WorkOS browser login, create/revoke an ephemeral agency key,
      import a real smoke creator, and use its returned ID.
- [ ] Cover the six primary agency routes and six creator routes, including one
      collection, detail, form, error state, mobile reflow, keyboard traversal,
      and Light/Dark appearance.
- [ ] Run support tests and hosted Cucumber against the Workers deployment;
      capture fresh representative screenshots and inspect console/network
      failures.
- [ ] Fix only observed defects with focused regressions, deploy the frozen
      product head, rerun hosted Cucumber once, and commit acceptance/docs
      changes.
- [ ] Push both frozen batch heads, read exact-head Woodpecker once, and fix
      only concrete required-gate failures.

## Self-review

- Scope is limited to the purchased frontend paved path and its B2B projection.
- Every new behavior begins with a focused failing test.
- No task introduces hashes, orchestration services, fixture registries, or
  speculative providers.
- The two repositories remain separate independently mergeable batches.
