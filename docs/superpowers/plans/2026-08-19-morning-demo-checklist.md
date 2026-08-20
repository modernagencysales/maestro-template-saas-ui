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
- [x] Existing headless tmux sessions and dirty worktrees were re-snapshotted
      read-only at `2026-08-19T22:37:14-04:00` via the established dedicated
      `headless@headless` SSH identity; no session or worktree was changed.
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

- [x] Template source manifest and assembled-screen inventory are verified at
      immutable `13a33eee35256f2d22b255750be746418b4189cb`; evidence packet:
      `/data/projects/morning-demo-20260819/evidence/template/lane-status.md`.
- [ ] Social canonical preset and structural shell compile.
- [x] Owned Funnel canonical preset and structural shell compile at pushed
      candidate `465b8e2b450b92df925e6a34792c1d25d0c7bc81`; the Node `22.23.2`
      canonical web build, client bundle budget, and shell-copy checks exited
      `0`. The separate Worker build remains red and is not covered by this
      item.
- [x] Brain canonical preset and structural shell compile at exact candidate
      `83ff67473e7ebc374654e2b8aef5bb246e4ec690` (serialized typecheck/build
      exits `0`/`0`).
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
- [ ] Focused Social checks and web build pass. Parent `32dc26e6c3b6` passed the
      route scenario and web build, but the current clean pushed delivery head
      `4495a4f3d63da1cb9041c69c448dcc44fe81c437` failed exact-head `pnpm verify`
      after all tests and the production build passed: `check:env-boundary`
      rejected a candidate-introduced direct `import.meta.env` read. The owning
      lane committed and pushed bounded repair `393dd5cb7ee6`; local and remote
      are exact and its immutable replacement admission is queued.
- [ ] Stable Social Worker is deployed from an exact commit.
- [ ] All five routes pass HTTP and browser smoke.

## Phase 4: Owned Funnel

- [x] Public Astro source remains untouched by pushed management candidate
      `465b8e2b450b92df925e6a34792c1d25d0c7bc81`; the exact commit has no diff
      under `apps/funnel`, and the checkout is clean.
- [ ] Private management overview route exists in `apps/web`.
- [ ] Contacts route uses canonical DataGrid and real management reads.
- [ ] Submissions route uses canonical DataGrid and real management reads.
- [ ] Runs list and run-detail routes use real backend reads.
- [ ] Effects route uses real backend reads.
- [ ] Lifecycle actions reuse the existing typed backend mutation path.
- [ ] Deterministic demo workspace is populated.
- [ ] `apps/web` has a focused Worker deployment contract.
- [ ] Focused Owned Funnel checks and web build pass. Final owner-authorized
      Worker cycle `3630bcf55acd` cleared the earlier Rolldown option conflict
      and completed client/SSR bundles, but prerender failed because the preview
      plugin imported absent `dist/server/server.js` while the Worker emitted
      `dist/server/index.js`. No retry, full verify, or deploy is authorized on
      this candidate.
- [ ] Stable management Worker is deployed from an exact commit.
- [ ] Public Astro regression smoke passes.
- [ ] At least one real backend read and lifecycle mutation are proven.

## Phase 5: Brain

- [x] Outer Brain shell uses the canonical Pro preset and structure in pushed
      candidate `83ff67473e7ebc374654e2b8aef5bb246e4ec690`; focused shell/route
      evidence is 4 files and 13 tests passing.
- [x] Notion-style editor internals remain intact; the exact candidate diff is
      confined to common layouts, the theme preset, a shell test, and the Brain
      launch UX contract.
- [x] Architecture contract says `Pro shell + Notion-style editor` in
      `83ff67473e7ebc374654e2b8aef5bb246e4ec690`.
- [x] Focused Brain/UI checks and exact-head web build pass for
      `83ff67473e7ebc374654e2b8aef5bb246e4ec690`; serialized typecheck/build
      exits are `0`/`0`, with receipt at
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-83ff67473e7e-receipt.md`.
- [ ] Candidate is deployed to staging from an exact commit. Woodpecker `795`
      for exact protected-main head `e9337f50f2c4` passed the repaired Knip
      boundary and later failed `@maestro/web#typecheck` on two unchanged source
      props. No staging deploy occurred; receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-e9337f50f2c4-woodpecker-795-failure.md`.
      Replacement `2f6e167cc05f` is clean, remote-equal on the candidate branch,
      and passes frozen install, exact-head typecheck, focused regressions,
      Knip, and production build. Owner authorized one new guarded cycle after
      Social releases the broad slot; protected `main` remains `e9337f50` until
      then.
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

- [x] T+0:30 infrastructure gate (passed early at `2026-08-19T22:39-04:00`;
      worker defaults are Node `22.23.2` and pnpm `10.12.1`, fake preflight
      passed, and headless preservation was proved).
- [ ] T+2:00 foundation compile gate
- [ ] T+3:30 Brain gate
- [ ] T+5:00 Social gate
- [ ] T+7:00 Owned Funnel gate
- [ ] T+9:00 visual review gate
- [ ] T+10:30 repair freeze gate
- [ ] T+11:30 final verification gate
- [ ] T+12:00 completion audit
