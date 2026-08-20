# Morning Demo 12-Hour Execution Plan

Status: approved for execution

Start authority: owner-directed on 2026-08-19

Canonical frontend source:

- Repository: `modernagencysales/maestro-template-saas-ui`
- Commit: `13a33eee35256f2d22b255750be746418b4189cb`
- Branch: `codex/active-pro-demo-foundation`
- PR: <https://github.com/modernagencysales/maestro-template-saas-ui/pull/57>
- Template: <https://maestro-template-saas-ui.tim-bb0.workers.dev>
- UI Lab: <https://maestro-template-saas-ui.tim-bb0.workers.dev/ui-lab>
- Storybook: <https://saas-ui-pro-storybook-review.tim-bb0.workers.dev>

## Objective

Within one 12-hour execution window, deliver reviewable HTTP versions of the
canonical Pro template, Social, Owned Funnel management, and Brain. Preserve
public Astro funnel pages, existing backends, existing dirty worktrees, current
headless Codex sessions, OrbStack, and `codex-lb`. Use the exact assembled Pro
screens and shell from the canonical source; do not creatively recompose UI.

## Required outcomes

1. The canonical template commit is durable and remains the only frontend
   authority.
2. Social uses the canonical Pro shell/screens for its primary demo routes,
   reads its existing backend through typed adapters, and has useful demo data.
3. Owned Funnel public pages remain Astro and unchanged. Its private management
   app uses TanStack Start plus the canonical Pro UI and the existing
   Convex/Confect backend.
4. Brain uses the canonical Pro application shell while retaining the existing
   Notion-style editor internals and behavior.
5. Each product has a stable HTTP review URL, exact commit receipt, focused test
   evidence, runtime smoke evidence, and an explicit remaining-blocker record.

## Computer ownership

### `headless`

- Human-facing controller and existing session preservation.
- Cloudflare deployment and authenticated staging proof when secrets are needed.
- No new dev watchers, monorepo builds, or broad verification.
- Never stop OrbStack, `codex-lb`, or the shared tmux server.

### `maestro-worker`

- New clean product checkouts and implementation sessions.
- Installs, focused tests, builds, screenshots, and candidate verification.
- At most two focused jobs concurrently and one broad build/verification at a
  time.
- GitHub pushes are authorized. Node defaults to 22.23.1; repository-pinned
  package managers remain authoritative through Corepack.

### `lappy`

- Visual review and top-level supervision only.
- No persistent product dev servers.

## Durable worker layout

```text
/data/projects/morning-demo-20260819/
  control/
  template/
  social/
  owned-funnel/
  brain/
```

The `morning-demo` tmux session on `maestro-worker` owns these windows:

```text
00-controller
10-template
20-social
30-owned-funnel
40-brain
50-focused-tests
60-deploy-review
```

Every Codex window must create a persistent goal from its committed lane goal,
work only in its assigned checkout, commit bounded checkpoints, and update its
lane status. The controller monitors without repeatedly interrupting productive
sessions.

## Delivery sequence and time gates

| Elapsed time | Required evidence |
| --- | --- |
| T+0:30 | Control commit pushed; clean checkouts, branches, tmux, and goals exist |
| T+2:00 | Canonical foundation compiles in Social, Owned Funnel, and Brain |
| T+3:30 | Brain candidate deployed and authenticated smoke complete |
| T+5:00 | Social primary routes populated and on a stable Worker |
| T+7:00 | Owned Funnel management candidate on a stable Worker |
| T+9:00 | Visual and functional review pass complete for all review URLs |
| T+10:30 | Focused repair pass complete and candidate commits frozen |
| T+11:30 | Final candidate builds/checks and deployment receipts complete |
| T+12:00 | Completion audit and URL matrix delivered; blockers are exact |

## Lane plans

### Template

1. Create a durable clean checkout at the canonical commit.
2. Verify the committed source manifest, UI Lab, Pro preset, Kanban, DataGrid,
   showcase, dashboard, reports, settings, inbox, updates, and workflows.
3. Do not expand product behavior or wait for PR #57 CI before downstream work.
4. Provide exact file/source guidance to product lanes.

### Social

1. Branch from `feature/project-canonical-saas-ui` without touching its existing
   worktree.
2. Synchronize the canonical preset, structural shell, layout rules, DataGrid,
   Kanban, dashboard, reports, and states. Preserve product navigation and data
   behavior behind adapters.
3. Cover `/dashboard`, `/creators`, `/opportunities`, `/proposals`, and
   `/reports`.
4. Reuse or safely import the separate presentation seed checkpoint when it is
   committed. If it is unavailable by T+3, use explicit deterministic frontend
   demo fixtures rather than blocking the review URL.
5. Run changed-package checks and the web build, deploy the candidate, and smoke
   every route.

### Owned Funnel

1. Publish the clean `owned-funnel-review` checkout to a canonical private
   GitHub repository and branch from its current `main`.
2. Leave `/Users/headless/owned-funnel-builder` and public Astro pages untouched.
3. Keep the existing Astro `/manage` as the mutation fallback until the new app
   is proven.
4. Add the canonical Pro shell and private management routes to `apps/web`:
   overview, contacts, submissions, runs, run detail, effects, and lifecycle
   actions.
5. Reuse the existing Owned Funnel management client and typed
   Convex/Confect/HTTP contracts. Do not duplicate backend business logic.
6. Add a Worker configuration for `apps/web`, a deterministic demo workspace,
   and a stable management review URL.
7. Prove public Astro regression safety plus at least one real management read
   and one real lifecycle mutation.

### Brain

1. Branch from current Maestro `main` in a clean worker checkout.
2. Align the outer preset, structural shell, gutters, header, navigation,
   drawers, dialogs, and notifications with the canonical Pro source.
3. Preserve the Brain editor component tree, document interactions, persistence,
   and backend contracts.
4. Update the architecture contract to state `Pro shell + Notion-style editor`.
5. Run focused Brain/UI checks, deploy to staging, and repeat authenticated smoke.

## CI and validation policy

- Do not open a PR merely to checkpoint work. Push named branches without PRs
  while iterating.
- Run only affected format, lint, typecheck, test, and app-build commands after
  each bounded change.
- Do not rerun broad validation on unchanged code or to investigate inherited
  repository baselines.
- Run one full required verification per immutable delivery candidate when its
  repository contract requires it.
- A review Worker from a focused-tested commit is not blocked by unrelated CI;
  merge/release cleanup follows visual approval.
- Never weaken a real gate. Record inherited failures separately with their
  exact command, commit, and scope.

## Fallbacks

- Social seed blocked at T+3: deploy explicit deterministic demo fixtures.
- Owned Funnel mutations blocked at T+6: deploy real backend reads in the new
  Pro UI and keep existing Astro management actions as the mutation path.
- Brain shell regression: preserve the proven staging revision and ship only the
  safe canonical preset delta.
- CI latency at T+11: preserve tested review deployments and finish formal merge
  hardening after the owner review.
- Template PR #57 remains red: continue pinned to exact commit `13a33eee`.

## Completion evidence

Completion requires all of the following, not merely green source checks:

- Stable HTTP URLs return expected status and visible application content.
- Live revision is tied to an exact Git commit.
- Canonical shell parity is visually checked at a common viewport.
- DataGrid and Kanban alignment are reviewed where used.
- Important loading, empty, populated, and error states are intentional.
- One important real product action is exercised per product when supported.
- Browser console and Worker/runtime logs show no unhandled errors.
- Dirty pre-existing worktrees and unrelated sessions remain preserved.
- The central checklist and URL matrix reflect the final evidence.
