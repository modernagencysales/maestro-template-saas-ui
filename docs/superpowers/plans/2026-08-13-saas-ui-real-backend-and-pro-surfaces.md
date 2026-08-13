# Saas UI Real Backend and Pro Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the pinned TanStack Start Pro frontend literal while replacing
its demo session/workspace seam with Maestro's WorkOS and Convex backend, then
expose the missing Saas UI Pro application surfaces through the same purchased
shell.

**Architecture:** The existing Starter JSX remains authoritative. AuthKit owns
the web session and supplies Convex access tokens; Confect owns authenticated
user, workspace, and member projections; a thin compatibility adapter supplies
those real values to the Starter's existing query call sites while neutral data
remains only for product domains that do not yet have a backend contract.
Installed Pro blocks are imported directly by two routes, without new wrapper
components or another shell.

**Tech Stack:** TanStack Start/Router, WorkOS AuthKit `0.9.1`, Convex/Confect,
React Query, Saas UI 3, Saas UI Pro, Vitest, Playwright.

## Global Constraints

- Do not change purchased JSX structure, component choice, style props, theme,
  spacing, density, responsive behavior, or interaction composition.
- WorkOS and Convex changes live behind route/provider/data adapters; they do
  not own visible layout.
- Remove `localStorage` authentication and fixture-backed user/workspace/member
  authority from the default runtime.
- Keep neutral adapters only for contacts, inbox, billing, and search until
  matching Maestro backend contracts exist; name them as neutral/demo data,
  never as real persistence.
- Import installed Pro blocks and `@saas-ui-pro/kanban` directly; do not create
  a board, page, modal, card, shell, or registry wrapper.
- Update generated refs and route trees through their existing generators.
- Project every new runtime file into a fresh generated target.
- Do not modify Maestro Brain or B2B Creator OS in this batch.

## Delivery Batch

- **Batch:** real backend seam plus complete reviewable Pro surface.
- **Tasks:** 1-5.
- **Branch/head:** `feature/saas-ui-upstream-transplant-design`, continuing from
  `3fc166ce906763a6b0e98d93e65ef593c709aa3e`.
- **Base/PR target:** `origin/main` / `main`.
- **Focused checks:** each task's named test command.
- **Whole-batch review:** `rtk git diff --check origin/main...HEAD`,
  source-receipt checks, generated-target build, and requesting-code-review.
- **Required verification:** one `rtk maestro-remote-test -- pnpm verify` on the
  frozen final head, followed by exact-head Woodpecker verification.

---

### Task 1: Authenticated Convex frontend projections

**Files:**

- Modify: `packages/convex/confect/auth/workspaces.spec.ts`
- Modify: `packages/convex/confect/auth/workspaces.impl.ts`
- Modify: `packages/convex/confect/access/members.spec.ts`
- Modify: `packages/convex/confect/access/members.impl.ts`
- Create: `packages/convex/test/frontend-session-projections.test.ts`
- Regenerate: `packages/convex/confect/_generated/**`
- Regenerate: `packages/convex/convex/_generated/api.d.ts`

**Interfaces:**

- Produces `refs.public.auth.workspaces.me({})`, returning
  `{ id, email, name, image: null, workspaces: Array<{ id, slug, name }> }` for
  the authenticated provisioned user.
- Produces `refs.public.auth.workspaces.bySlug({ slug })`, returning a workspace
  only when the caller has a live membership.
- Changes `refs.public.auth.workspaces.list({})` to return only live caller
  workspaces.
- Produces `refs.public.access.members.list({ workspaceId })`, returning active
  members joined to users as
  `{ id, email, name, avatar: null, roles: Role[], status: "active" }` after
  caller membership authorization.

- [ ] **Step 1: Write failing integration tests**

Use `TestConfect` with `seedTenancy` to assert that a member sees only their
workspace, an outsider receives `Unauthorized` or `MemberNotInWorkspace`,
`bySlug` cannot reveal another workspace, and member rows are joined to user
email/display name.

- [ ] **Step 2: Verify RED**

Run:
`rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/frontend-session-projections.test.ts`

Expected: FAIL because `me`, `bySlug`, and `members.list` do not exist and
`workspaces.list` is unscoped.

- [ ] **Step 3: Implement the minimum Confect functions**

Reuse `loadCurrentUser`, `by_workspace_user`, `by_workspace_status`, and
existing table indexes. Cap indexed membership reads at 200 rows, reject
non-live memberships, and never scan the complete workspace table.

- [ ] **Step 4: Regenerate refs and verify GREEN**

Run:
`rtk pnpm check:confect-generation && rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/frontend-session-projections.test.ts test/workspace-access.contract.test.ts`

Expected: PASS with authenticated, membership-scoped projections.

- [ ] **Step 5: Commit**

Commit message: `feat: expose authenticated frontend workspace projections`.

### Task 2: WorkOS AuthKit and Convex web provider seam

**Files:**

- Create: `apps/web/src/start.ts`
- Create: `apps/web/src/lib/auth/workos-auth.ts`
- Create: `apps/web/src/lib/auth/workos-auth-loader.ts`
- Create: `apps/web/src/lib/auth/route-auth.ts`
- Create: `apps/web/src/routes/api/auth/callback.tsx`
- Create: `apps/web/src/routes/api/auth/sign-in.tsx`
- Create: `apps/web/src/routes/api/auth/sign-up.tsx`
- Modify: `apps/web/src/features/auth/auth-provider.tsx`
- Modify: `apps/web/src/provider.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/src/routes/_app.tsx`
- Modify: `apps/web/src/router.tsx`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `apps/web/src/lib/auth/workos-auth.test.ts`
- Test: `apps/web/src/lib/auth/route-auth.test.ts`

**Interfaces:**

- `useAuthFromAuthKit()` returns
  `{ isLoading, isAuthenticated, fetchAccessToken }` for
  `ConvexProviderWithAuth`.
- `loadInitialAuth()` returns client-safe AuthKit state with `accessToken`
  removed.
- `requireAuthenticatedRoute()` preserves the existing `_app` redirect contract.
- `AuthProvider` keeps the Starter's `@saas-ui/auth-provider` interface;
  login/signup redirect to the AuthKit entry routes and logout calls AuthKit.

- [ ] **Step 1: Add failing adapter tests**

Assert that missing users are unauthenticated, tokens are fetched/refreshed for
Convex, initial auth strips access tokens, and unsafe return paths are reduced
to `/`.

- [ ] **Step 2: Verify RED**

Run:
`rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run src/lib/auth/workos-auth.test.ts src/lib/auth/route-auth.test.ts`

Expected: FAIL because the AuthKit adapters do not exist.

- [ ] **Step 3: Add the official providers and middleware**

Use `authkitMiddleware`, `createStart`, `createCsrfMiddleware`,
`AuthKitProvider`, `useAuth`, `useAccessToken`, `ConvexReactClient`, and
`ConvexProviderWithAuth`. Reuse the already-proven adapter behavior from
`/Users/headless/maestro-brain-auth-fix/apps/web/src/adapters/` but omit Maestro
Brain UI, local-auth fallback, and its provider-error framework.

- [ ] **Step 4: Preserve Starter auth presentation**

Keep the purchased login/signup JSX. Its submit callbacks redirect to
`/api/auth/sign-in` and `/api/auth/sign-up`; callback handling returns to a
sanitized same-origin path.

- [ ] **Step 5: Verify GREEN**

Run:
`rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run src/lib/auth/workos-auth.test.ts src/lib/auth/route-auth.test.ts && rtk pnpm --dir apps/web typecheck && rtk pnpm --dir apps/web build`

Expected: PASS without `localStorage` session authority.

- [ ] **Step 6: Commit**

Commit message: `feat: connect starter shell to workos and convex`.

### Task 3: Replace the fake session query paths with real Convex data

**Files:**

- Modify: `apps/web/src/lib/trpc/react.tsx`
- Delete when unused: `apps/web/src/lib/backend-fixtures.ts`
- Modify: `apps/web/src/routes/_app/index.tsx`
- Modify: `apps/web/src/routes/_app/$workspace.tsx`
- Modify: `apps/web/src/features/common/hooks/use-current-user.ts`
- Modify: `apps/web/src/features/common/hooks/use-workspaces.ts`
- Modify: `apps/web/src/features/settings/members/members-page.tsx` only if its
  query input needs `workspaceId`; do not change JSX.
- Test: `apps/web/src/lib/trpc/convex-compat.test.tsx`

**Interfaces:**

- `trpc.auth.me.ensureData()` calls
  `templateConfectRefs.public.auth.workspaces.me`.
- `trpc.workspaces.bySlug.ensureData({ slug })` calls the scoped Convex query.
- `api.workspaceMembers.list.useQuery({ workspaceId })` calls the authenticated
  member list.
- Contacts, inbox, billing, and search retain explicit neutral adapters until
  real domain contracts exist.

- [ ] **Step 1: Write failing compatibility tests**

Assert that auth/workspace/member paths invoke the exact generated refs, that
unknown real-authority paths throw instead of silently returning `undefined`,
and that neutral paths remain deterministic.

- [ ] **Step 2: Verify RED**

Run:
`rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run src/lib/trpc/convex-compat.test.tsx`

Expected: FAIL because the current Proxy returns fixtures.

- [ ] **Step 3: Implement the thin compatibility adapter**

Reuse one shared `ConvexReactClient`. Implement only the Starter call shapes
already consumed; do not introduce a new generic query framework. Provision the
authenticated user once before selecting their first workspace.

- [ ] **Step 4: Remove obsolete fixture authority and verify GREEN**

Run: `rtk rg -n "backend-fixtures|maestro-starter-demo-session" apps/web/src`
(expected: no matches), then
`rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run src/lib/trpc/convex-compat.test.tsx && rtk pnpm --dir apps/web typecheck`.

- [ ] **Step 5: Commit**

Commit message: `feat: project convex data into starter queries`.

### Task 4: Expose direct Pro application surfaces

**Files:**

- Create: `apps/web/src/routes/_app/$workspace/_dashboard/kanban.tsx`
- Create: `apps/web/src/routes/_app/$workspace/_dashboard/showcase.tsx`
- Modify: `apps/web/src/features/common/components/app-sidebar.tsx`
- Regenerate: `apps/web/src/routeTree.gen.ts`
- Test: `tests/e2e/saas-ui-pro-surfaces.spec.ts`

**Interfaces:**

- `/$workspace/kanban` imports `@saas-ui-pro/kanban`, `sortable-task-list`,
  `task-card-with-labels`, and `task-card-with-properties` directly.
- `/$workspace/showcase` imports the installed communication, file, drawer, and
  modal blocks directly.
- Existing `getting-started` remains the onboarding route.

- [ ] **Step 1: Write failing route/navigation tests**

Assert that authenticated users reach Kanban and Showcase through the existing
sidebar, that drag reorders a task, and that drawer/modal triggers open and
restore focus.

- [ ] **Step 2: Verify RED**

Run:
`rtk env TEMPLATE_HOSTED_URL=http://127.0.0.1:4181 pnpm exec playwright test tests/e2e/saas-ui-pro-surfaces.spec.ts --project=desktop-chromium`

Expected: FAIL because the routes and navigation links do not exist.

- [ ] **Step 3: Add the two direct routes**

Use the installed block source without wrappers. Supply only typed neutral
records and event handlers in each route module; do not add route-per-block or
alternate shell routes.

- [ ] **Step 4: Regenerate and verify GREEN**

Run:
`rtk pnpm check:route-tree && rtk pnpm --dir apps/web typecheck && rtk env TEMPLATE_HOSTED_URL=http://127.0.0.1:4181 pnpm exec playwright test tests/e2e/saas-ui-pro-surfaces.spec.ts --project=desktop-chromium`.

- [ ] **Step 5: Commit**

Commit message: `feat: expose saas ui pro application surfaces`.

### Task 5: Project and prove the finished template

**Files:**

- Modify as required:
  `tooling/generators/src/blueprints/saasFrontendFoundation.ts`
- Modify as required: `tooling/release/src/customerTarget/ownership.ts`
- Modify:
  `tooling/generators/src/blueprints/saasFrontendGeneratedTarget.test.ts`
- Create evidence outside git:
  `/Users/headless/.codex-artifacts/maestro-template-saas-ui-final/`

- [ ] **Step 1: Add every new runtime file to the mandatory foundation closure**

Run the existing projection test and make it fail for any omitted auth, route,
or adapter file.

- [ ] **Step 2: Generate a fresh current target**

Use `buildSaasApplicationTargetPlan`; install with the frozen lockfile,
typecheck, build, and start the generated app without referencing the factory
worktree.

- [ ] **Step 3: Run real-auth and neutral-review evidence**

With BWS-backed WorkOS/Convex environment, prove sign-in callback, provisioning,
scoped workspace selection, member list, logout, and unauthenticated redirect.
Separately capture desktop/mobile and light/dark shell, Kanban, Showcase,
onboarding, settings, and failure/empty states using non-secret review data.

- [ ] **Step 4: Review one immutable batch head**

Run focused foundation, artifact safety, Confect, route, build, browser, and
screenshot checks once, then request whole-batch code review. Fix findings
before freezing the head.

- [ ] **Step 5: Run required verification and stop for owner approval**

Run `rtk maestro-remote-test -- pnpm verify` on the frozen head, open/update the
draft PR, wait for `ci/woodpecker/pr/verify`, and present the Tailscale URL plus
evidence. Do not begin downstream product migration without explicit owner
approval.

## Self-Review

- Spec coverage: Tasks 1-3 replace the fake auth/workspace/member authority with
  WorkOS and Convex; Task 4 exposes Kanban, onboarding, and the installed
  interaction/content blocks; Task 5 proves projection and rendered behavior in
  a fresh target.
- Scope: contacts, inbox, billing, and search persistence remain neutral because
  no Maestro backend contract exists for them; this is explicit and does not
  masquerade as completed persistence.
- No competing UI authority is added; the only new visible modules are direct
  route compositions of installed Pro blocks.
- No placeholders or deferred implementation markers remain.
