# Morning Demo Execution Checklist

Controller authority: this file is the central completion ledger. Only the
controller checks boxes after inspecting the named evidence.

## Phase 0: Preserve and prepare

- [x] Canonical Pro source is pinned at
      `13a33eee35256f2d22b255750be746418b4189cb`.
- [x] Maestro-worker GitHub authentication has actual push/delete proof.
- [x] Maestro-worker Node/Corepack toolchain is coherent.
- [x] OrbStack and `codex-lb` remain healthy on headless.
- [x] Control plan and checklist commits are pushed (`2c48d37`, `e291061`).
- [ ] Existing headless tmux sessions and dirty worktrees are re-snapshotted.
- [x] Worker `morning-demo` tmux session exists with all named windows (eight
      live windows observed at `2026-08-19T22:32-04:00`).
- [x] Every Codex window has created its committed persistent goal (controller
      plus Template, Social, Owned Funnel, Brain, Focused Tests, and
      Deploy/Review confirmed active by `2026-08-19T22:36-04:00`).
- [x] No product lane owns or edits another lane's checkout (pane working
      directories and clean starting heads inspected at
      `2026-08-19T22:36-04:00`).

## Phase 1: Durable checkouts

- [x] `control` checkout exists and tracks
      `codex/morning-demo-execution-control` at
      `a7a9af3a5675ad85ab019ebe0f011a6815b8e0e1`.
- [x] `template` checkout is clean and pinned to
      `13a33eee35256f2d22b255750be746418b4189cb`.
- [x] `social` checkout is clean on `codex/morning-demo-social-pro` at
      `65c49626854bab8f0726cdaa0473c409c759d50c`.
- [x] Owned Funnel review repository exists as
      `modernagencysales/owned-funnel-review`.
- [x] `owned-funnel` checkout is clean on `codex/morning-demo-owned-pro` at
      `36396b0e7fe99a345d0204da78ad296c45672d82`.
- [x] `brain` checkout is clean on `codex/morning-demo-brain-pro` at
      `6e3727da5fedd7fdc75da1c22f2d1c418a0db415`.
- [x] Package-manager versions are recorded: `pnpm@10.12.1` for control,
      template, Social, and Owned Funnel; `pnpm@9.15.4` for Brain.

## Phase 2: Canonical foundation

- [ ] Template source manifest and assembled-screen inventory are verified.
- [ ] Social canonical preset and structural shell compile.
- [ ] Owned Funnel canonical preset and structural shell compile.
- [ ] Brain canonical preset and structural shell compile.
- [ ] Product-specific deviations are confined to routes, adapters, labels, and
      mutations.

## Phase 3: Social

- [ ] `/dashboard` uses the canonical dashboard composition.
- [ ] `/creators` uses the canonical DataGrid composition.
- [ ] `/opportunities` uses the canonical list/detail composition.
- [ ] `/proposals` uses the canonical Kanban composition.
- [ ] `/reports` uses the canonical reports composition.
- [ ] Existing backend reads and mutations are preserved behind typed adapters.
- [ ] Important screens contain deterministic, useful demo data.
- [ ] Focused Social checks and web build pass.
- [ ] Stable Social Worker is deployed from an exact commit.
- [ ] All five routes pass HTTP and browser smoke.

## Phase 4: Owned Funnel

- [ ] Public Astro checkout and known dirty files remain untouched.
- [ ] Private management overview route exists in `apps/web`.
- [ ] Contacts route uses canonical DataGrid and real management reads.
- [ ] Submissions route uses canonical DataGrid and real management reads.
- [ ] Runs list and run-detail routes use real backend reads.
- [ ] Effects route uses real backend reads.
- [ ] Lifecycle actions reuse the existing typed backend mutation path.
- [ ] Deterministic demo workspace is populated.
- [ ] `apps/web` has a focused Worker deployment contract.
- [ ] Focused Owned Funnel checks and web build pass.
- [ ] Stable management Worker is deployed from an exact commit.
- [ ] Public Astro regression smoke passes.
- [ ] At least one real backend read and lifecycle mutation are proven.

## Phase 5: Brain

- [ ] Outer Brain shell uses the canonical Pro preset and structure.
- [ ] Notion-style editor internals remain intact.
- [ ] Architecture contract says `Pro shell + Notion-style editor`.
- [ ] Focused Brain/UI checks and web build pass.
- [ ] Candidate is deployed to staging from an exact commit.
- [ ] Public auth redirect smoke passes.
- [ ] Authenticated Brain load/edit/save smoke passes.

## Phase 6: Review and delivery

- [ ] Template, Social, Owned Funnel, and Brain share a consistent shell review.
- [ ] DataGrid alignment is visually approved wherever present.
- [ ] Kanban alignment is visually approved wherever present.
- [ ] Browser consoles show no unhandled errors on primary routes.
- [ ] Worker/runtime logs show no candidate-specific unhandled errors.
- [ ] Review URL matrix includes commit and deployment receipts.
- [ ] Candidate PRs are open or updated only after review readiness.
- [ ] One final required CI cycle is recorded per delivery candidate.
- [ ] Exact blockers and deferred formal cleanup are recorded.
- [ ] Owner receives the complete URL matrix and attach command.

## Deadline gates

- [ ] T+0:30 infrastructure gate
- [ ] T+2:00 foundation compile gate
- [ ] T+3:30 Brain gate
- [ ] T+5:00 Social gate
- [ ] T+7:00 Owned Funnel gate
- [ ] T+9:00 visual review gate
- [ ] T+10:30 repair freeze gate
- [ ] T+11:30 final verification gate
- [ ] T+12:00 completion audit
