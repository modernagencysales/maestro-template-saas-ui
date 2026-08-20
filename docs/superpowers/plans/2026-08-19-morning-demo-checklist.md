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
- [x] Social canonical preset and structural shell compile at exact verified
      candidate `393dd5cb7ee6`.
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

- [x] `/dashboard` uses the canonical dashboard composition.
- [x] `/creators` uses the canonical DataGrid composition.
- [x] `/opportunities` uses the canonical list/detail composition.
- [x] `/proposals` uses the canonical Kanban composition.
- [x] `/reports` uses the canonical reports composition.
- [x] Existing backend reads and mutations are preserved behind typed adapters;
      deployment reused the three existing authorized Convex workspaces and did
      not mutate durable public data.
- [x] Important screens contain deterministic, useful demo data. Stable proof
      covers the priority queue, hosted creator row, three opportunities,
      populated negotiating/accepted Kanban columns, and revenue/customer
      metrics.
- [x] Focused Social checks and web build pass. Exact clean, remote-equal
      replacement `393dd5cb7ee626a9a830c8e7a8571e432c345df9` passed its single
      second-cycle exact-head `pnpm verify` at `2026-08-20T00:13:21-04:00`. The
      sealed log SHA-256 is
      `8442a226b5982c4b5e5c4a66f80d3cc9bde0d3069e91f7e683d799e755fc2490`;
      receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/social-393dd5cb7ee6-verify-pass.md`.
      No fourth Cucumber cycle or duplicate completed check ran.
- [ ] Canonical Railway managed-Node deployment is proven at an exact merged
      commit. One exact-main deployment `882b7d71...` was created from merged
      `1fa00df0...` during a stale pending-check acceleration race, but required
      Woodpecker `345` later failed shards B and C. The running Railway image is
      therefore explicitly not deployment-accepted. The live Worker
      compatibility version remains diagnostic fallback only.
- [ ] All five routes pass HTTP and real-auth browser smoke on the immutable
      Railway revision. Partial stale-race checks proved health, alias
      redirects, and typed unauthenticated Node routing. Exactly one later
      controller-approved protected-credential run reached WorkOS, which
      returned `redirect-uri-invalid` before login; callback/session were false,
      routes were `0/5`, and fresh auth state was deleted. No mutation or retry
      ran. Terminal receipts:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/social-b1341cdc-woodpecker-345-terminal-failure.md`
      and
      `/data/projects/morning-demo-20260819/evidence/deploy-review/social-1fa00df-railway-hosted-readonly-failure.md`.
      Later clean pushed diagnostic successor `eb918d044a34` exposed shard B's
      terminal `Claim token is missing` result and retains a statically green
      shard-C readiness repair, but neither is runtime-accepted and no third
      scenario cycle, PR, CI, deployment, or auth mutation ran. Receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/social-eb918d044a34-two-cycle-terminal-receipt.md`.

## Phase 4: Owned Funnel

- [x] Public Astro source remains untouched by pushed management candidate
      `465b8e2b450b92df925e6a34792c1d25d0c7bc81`; the exact commit has no diff
      under `apps/funnel`, and the checkout is clean.
- [x] Private management overview route exists in `apps/web` and is available at
      the stable review/demo URL with explicit deterministic-fallback notice.
- [ ] Contacts route uses canonical DataGrid and real management reads.
- [ ] Submissions route uses canonical DataGrid and real management reads.
- [ ] Runs list and run-detail routes use real backend reads.
- [ ] Effects route uses real backend reads.
- [ ] Lifecycle actions reuse the existing typed backend mutation path.
- [x] Deterministic Demo workspace is populated across all six review routes.
- [x] `apps/web` has a focused Worker deployment contract; successor
      `15d665ba4daa` removed only the invalid Worker output redirect and
      `458496d3c467` pins nested layout/index route ownership.
- [x] Focused Owned Funnel checks and web build pass. The prior `3630bcf55acd`
      cycle exposed the missing `dist/server/server.js` prerender entry. Exact
      clean, remote-equal successor `f4e3262af86d` passed exactly one serialized
      Node `22.23.2` `apps/web build:worker` with exit `0` after Brain and
      Social recovery released their slots. Receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/owned-funnel-f4e3262af86d-worker-pass.md`.
- [x] Stable management Worker is deployed from exact clean, pushed,
      remote-equal commit `458496d3c4674f328b36dfbc0e7ce9191de2a40a` as version
      `3e6b68f9-0194-4f61-8db6-5661e1426e62` at 100%. All six route-specific
      HTTP/browser checks pass with zero console/page/failed-HTTP errors;
      rollback `a1224d8f-97e8-42db-9c18-2a9e7a8f0238` is retained. Receipt:
      `/data/projects/morning-demo-20260819/evidence/deploy-review/owned-funnel-458496d3-review-demo-accepted.md`.
      Historical exact `f4e3262af86d` reached its sole post-release upload
      attempt from sealed artifact `be657eec...`, but Cloudflare rejected
      `_redirects` line 1 as an infinite loop (code `100324`) before creating a
      Worker/version. No rebuild or retry ran on that SHA. Receipt:
      `/data/projects/morning-demo-20260819/evidence/deploy-review/owned-funnel-f4e3262-review-demo-deploy-rejected.md`.
- [x] Public Astro regression smoke passes independently: canonical routes
      return `200`, the full marketing page renders through the footer, and the
      browser has no console/page errors after the accepted management deploy;
      `apps/funnel` remains absent from the candidate diff. Receipt:
      `/data/projects/morning-demo-20260819/evidence/deploy-review/owned-funnel-458496d3-review-demo-accepted.md`.
- [ ] At least one real backend read and lifecycle mutation are proven. The
      accepted review/demo deployment intentionally carries no backend/auth
      binding; all four lifecycle controls are visibly disabled. No live read or
      mutation is claimed. The dedicated-binding and backend-complete blocker
      remains authoritative:
      `/data/projects/morning-demo-20260819/evidence/deploy-review/owned-funnel-f4e3262-deploy-blocker.md`.

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
- [x] Candidate was deployed to staging from an exact commit. Woodpecker `795`
      for exact protected-main head `e9337f50f2c4` passed the repaired Knip
      boundary and later failed `@maestro/web#typecheck` on two unchanged source
      props. No staging deploy occurred; receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-e9337f50f2c4-woodpecker-795-failure.md`.
      Replacement `2f6e167cc05f` is clean, remote-equal on the candidate branch,
      and passes frozen install, exact-head typecheck, focused regressions,
      Knip, and production build. It advanced to protected `main`, and the
      single guarded exact-head Woodpecker pipeline `796` passed. Staging
      deployment pipeline `797` succeeded for exact protected-main
      `2f6e167cc05f`, after which authenticated smoke rejected the runtime and
      restored rollback Worker `30f8f677-e999-423f-9654-0488ef2ee151` at 100%.
      Receipts:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-2f6e167cc05f-woodpecker-796-pass.md`.
- [x] Public auth redirect smoke passes with the expected `307` to
      `/sign-in?returnPathname=%2Fbrain` on the candidate and after rollback.
- [x] Authenticated Brain load/edit/save and export runtime proof is clean; the
      automation verdict is non-green solely from stale button copy. Fresh
      authenticated first-use hit the application error boundary because
      `SuiSidebarNavItem` context was absent; no edit/save was attempted.
      Deploy, runtime, artifact, and rollback receipt:
      `/data/projects/morning-demo-20260819/evidence/deploy-review/brain-2f6e167cc05f-deploy-runtime-rollback.md`.
      Successor `0913c92a2093` fixed that context and passed verify `799` plus
      deploy `800`, but one fresh authenticated smoke failed before page
      creation on `ClientScopeFocusProvider is missing`; no edit/save mutation
      ran and rollback `30f8f677...` was restored at 100%. Terminal receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-0913c92a-terminal-runtime-receipt.md`.
      Exact successor `094819975d9f` then passed verify `803` and deploy `804`.
      Its one explicitly authorized corrected client-scoped `@seeded-behavior`
      smoke used non-excluded `Staging fixture 02ceeed320ec90e9dbc2`; page
      creation succeeded, but the destination failed with
      `useSidebar must be     used within a SidebarProvider` before title/body
      edit/save. The smoke was not rerun, fresh auth state was deleted, and safe
      rollback `30f8f677...` is again at 100%. Terminal receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-094819975d9f-seeded-runtime-failure-rollback.md`.
      Exact provider-boundary successor `21d9971856fc` passed focused proof,
      verify `805`, and deploy `806`. Its one fresh exact-client smoke then
      passed create, title/body save, navigation, reload persistence, and
      persisted internal linking. The overall smoke remains unchecked because
      opening `More` mounted the markdown-export query, which ran multiple
      paginated queries in one Convex function and entered the workspace error
      boundary. The test was not rerun, auth state was deleted, and safe
      rollback `30f8f677...` was restored at 100%. Terminal receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-21d9971856fc-terminal-runtime-receipt.md`.
      Pagination-free canonical-resolver successor `0ecfcd19f10f` then passed
      sole verify `810` and deploy `811`; Worker `20ee5e88...` remains at 100%
      and public `/brain` returns the exact 307 redirect. Its sole fresh-auth
      Playwright invocation stopped before test discovery because the command
      omitted separately required `BRAIN_PROOF_STAGING_WORKSPACE_ID`; zero
      product assertions or mutations ran. State was deleted with no rerun or
      regeneration. Authenticated persistence/export acceptance therefore
      remains unchecked pending new controller admission. Receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-0ecfcd19f10f-terminal-controller-ambiguity.md`.
      Fresh owner re-admission then authorized exactly one replacement state and
      corrected run. It proved create/edit/save, navigation/reload persistence,
      persisted linking, and export readiness: `Copy markdown` became enabled
      after its preparing state. Trace audit found zero console, page, HTTP
      4xx/5xx, Convex, or error-boundary failures. The command exited `1` only
      because the stale smoke expects `Export markdown`; it was not rerun and
      state was deleted. Worker `20ee5e88...` remains at 100%. Terminal receipt:
      `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-0ecfcd19f10f-terminal-runtime-clean.md`.

## Phase 6: Review and delivery

- [ ] Template, Social, Owned Funnel, and Brain share a consistent shell review.
- [ ] DataGrid alignment is visually approved wherever present.
- [ ] Kanban alignment is visually approved wherever present.
- [ ] Browser consoles show no unhandled errors on primary routes.
- [ ] Worker/runtime logs show no candidate-specific unhandled errors.
- [x] Review URL matrix includes exact commit, build/CI evidence, deployment or
      non-deployment admission, stable URL, HTTP/browser/runtime result, and
      rollback/non-creation coordinate for Social, Owned Funnel, and Brain.
- [ ] Candidate PRs are open or updated only after review readiness.
- [ ] One final required CI cycle is recorded per delivery candidate.
- [x] Exact blockers and deferred formal cleanup are recorded in the URL matrix,
      terminal receipts, and controller status ledger.
- [x] Owner receives the current-state URL matrix and non-executed PR attachment
      command through the completion-audit handoff:
      `/data/projects/morning-demo-20260819/evidence/deploy-review/program-completion-audit-20260820T0822.md`.

## Deadline gates

- [x] T+0:30 infrastructure gate (passed early at `2026-08-19T22:39-04:00`;
      worker defaults are Node `22.23.2` and pnpm `10.12.1`, fake preflight
      passed, and headless preservation was proved).
- [x] T+2:00 foundation compile gate (completed late; exact Social verify, Owned
      Worker build, and Brain verify receipts are sealed).
- [x] T+3:30 Brain gate (completed late at exact `0ecfcd19...`; verify `810`,
      deploy `811`, and authenticated runtime-clean proof are sealed).
- [ ] T+5:00 Social gate. The earlier Worker acceptance was superseded by the
      Railway hosting-authority correction. Successor `b1341cdc` is merged as
      `1fa00df0`, but Woodpecker `345` failed B/C and the stale-race Railway
      deployment is not accepted.
- [x] T+7:00 Owned Funnel gate (completed late for the explicitly accepted
      deterministic review/demo boundary at exact `458496d3...`).
- [ ] T+9:00 visual review gate
- [ ] T+10:30 repair freeze gate
- [ ] T+11:30 final verification gate
- [x] T+12:00 completion audit (current URL matrix delivered and remaining
      Template, Social, and Owned backend blockers recorded exactly).
