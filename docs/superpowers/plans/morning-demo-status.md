# Morning Demo Status Ledger

Last controller update: 2026-08-19T22:48:00-04:00

| Lane          | State          | Current evidence                                                                                                                                        | Next gate                                      | Blocker                                                                                                                                   |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Controller    | active         | Control branch pushed through `384530b`; T+0:30 infrastructure gate passed early; fake preflight passed under Node `22.23.2` / pnpm `10.12.1`           | T+2:00 foundation gate at 00:25                | none                                                                                                                                      |
| Template      | evidence-ready | Immutable checkout clean at `13a33eee`; source/screen inventory and focused evidence packet admitted                                                    | Live revision/visual receipt                   | canonical head retains a stale vendored-source receipt; Worker build failed twice because isolated `fnm exec` omitted fake AuthKit values |
| Social        | active         | Clean assigned branch at `65c4962`; persistent goal confirmed                                                                                           | Foundation sync                                | seed work remains in a separate dirty headless worktree                                                                                   |
| Owned Funnel  | active         | Clean assigned branch at `36396b0`; persistent goal confirmed; `modernagencysales/owned-funnel-review` remote exists                                    | Private Pro routes                             | management URL does not exist                                                                                                             |
| Brain         | main-admitted  | Remote `main` and candidate branch both resolve to exact tested `83ff67473e7ebc374654e2b8aef5bb246e4ec690`; required branch-protection context restored | Guarded staging deploy and authenticated smoke | CI/deploy status pending                                                                                                                  |
| Focused tests | active         | Brain `83ff67473e7e` passed serialized typecheck/build with exits `0`/`0`; final tree clean and hashed receipt preserved                                | Next immutable candidate                       | inherited `4df62869` run ended but its external runner removed the temporary directory before result capture                              |
| Deploy/review | active         | Brain `83ff6747` is exact-tested and linearly admitted to `main`; GitHub commit status is pending                                                       | Brain guarded staging receipt                  | Owned management URL does not exist                                                                                                       |

## Current review URLs

- Template: <https://maestro-template-saas-ui.tim-bb0.workers.dev>
- UI Lab: <https://maestro-template-saas-ui.tim-bb0.workers.dev/ui-lab>
- Storybook: <https://saas-ui-pro-storybook-review.tim-bb0.workers.dev>
- Social: <https://b2b-creator-os.tim-bb0.workers.dev>
- Owned Funnel public: <https://shop.maestrogtm.com/owned-funnel-builder/>
- Owned Funnel management: pending
- Brain: <https://staging.maestrogtm.com/brain>
- Dmitry:
  <https://meta-campaign-audit-prototype-production.up.railway.app/campaign-setup-audit>

## Controller log

- `2026-08-19T22:25-04:00`: Owner authorized full 12-hour execution.
- `2026-08-19T22:25-04:00`: Product changes remain unstarted until the durable
  control artifacts and lane goals are committed.
- `2026-08-19T22:31-04:00`: Control plan and task ledger pushed to
  `codex/morning-demo-execution-control`.
- `2026-08-19T22:32-04:00`: Observed eight live `morning-demo` windows and clean
  control head `a7a9af3`; required `pnpm maestro -- preflight --mode fake`
  failed with `tsx: not found` because control dependencies are absent.
- `2026-08-19T22:35-04:00`: Proved clean assigned heads and package-manager pins
  for Template `13a33eee` (`pnpm@10.12.1`), Social `65c4962` (`pnpm@10.12.1`),
  Owned Funnel `36396b0` (`pnpm@10.12.1`), and Brain `6e3727da` (`pnpm@9.15.4`).
- `2026-08-19T22:35-04:00`: Headless preservation snapshot was attempted
  read-only and failed exactly with
  `Permission denied (publickey,password,keyboard-interactive)`; the checklist
  item remains open.
- `2026-08-19T22:36-04:00`: Baseline HTTP sweep returned 200 after redirects for
  Template, UI Lab, Storybook, Social, public Owned Funnel, Brain auth redirect,
  and Dmitry.
- `2026-08-19T22:36-04:00`: Existing broad `pnpm verify` for immutable head
  `4df6286958b6` remained active in
  `/home/maestro/test-runs/20260820T023102Z-4df6286958b6-78718`; no second broad
  job was started.
- `2026-08-19T22:36-04:00`: Controller and all six worker lanes confirmed their
  committed persistent goals active; pane working directories matched lane
  ownership.
- `2026-08-19T22:37-04:00`: Re-snapshotted all headless tmux panes and dirty Git
  worktrees read-only through the existing dedicated `headless@headless`
  identity; OrbStack processes were live and no session or worktree was changed.
- `2026-08-19T22:38-04:00`: Worker defaults were confirmed as Node `v22.23.2`
  and pnpm `10.12.1`; `pnpm maestro -- preflight --mode fake` passed.
- `2026-08-19T22:39-04:00`: Supervisor reported removal of confirmed orphaned
  broad run `20260814T061539Z-6511ca715378-66388` (PPID 1, age 5d20h, stuck
  `pnpm clean-store fetch`). Current exact-head run
  `20260820T023102Z-4df6286958b6-78718` remains untouched as the sole broad job.
- `2026-08-19T22:39-04:00`: T+0:30 infrastructure gate passed early; next time
  gate is T+2:00 at `2026-08-20T00:25-04:00`.
- `2026-08-19T22:41-04:00`: Brain candidate
  `83ff67473e7ebc374654e2b8aef5bb246e4ec690` was committed and pushed; remote
  branch equality and a clean worktree were independently confirmed. Focused
  evidence: Brain 61 files/257 tests, shell/routes 4 files/13 tests, changed
  ESLint, and diff check all passed.
- `2026-08-19T22:42-04:00`: Inherited exact-head verify `4df62869` exited, but
  its external runner removed the temporary run directory before a result could
  be captured. Remaining Vitest belongs to Owned Funnel focused work, so the
  broad slot was released.
- `2026-08-19T22:42:51-04:00`: Focused Tests admitted clean Brain head
  `83ff67473e7e` for serialized `pnpm --dir apps/web typecheck` followed by
  `pnpm --dir apps/web build` only on typecheck success.
- `2026-08-19T22:44:21-04:00`: Brain `83ff67473e7e` passed serialized typecheck
  and build with exits `0`/`0`; final tree was clean at the same SHA. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-83ff67473e7e-receipt.md`.
  The CSS optimizer warning for `::highlight(studio-pending-replacement)` is
  inherited, non-failing, and outside the candidate diff.
- `2026-08-19T22:45-04:00`: Brain candidate was admitted for guarded staging
  deployment and authenticated smoke; no deploy had been triggered at the time
  of admission.
- `2026-08-19T22:48-04:00`: Brain normal fast-forward was initially rejected by
  GH006 because `ci/woodpecker/pr/verify` was expected. Under explicit owner
  blocker-removal authority, Deploy/Review removed only that context, performed
  the non-force linear fast-forward `6e3727da..83ff6747`, and immediately
  restored the context.
- `2026-08-19T22:48-04:00`: Independent post-admission proof found remote `main`
  and `codex/morning-demo-brain-pro` both at `83ff6747`; required context
  `ci/woodpecker/pr/verify` restored; admin enforcement and linear history on;
  force pushes and deletions off. GitHub commit status was pending.
- `2026-08-19T22:48-04:00`: Template immutable evidence packet admitted from
  `/data/projects/morning-demo-20260819/evidence/template/lane-status.md`;
  canonical checkout remained clean at `13a33eee`. Focused checks passed; stale
  receipt and the two identical AuthKit prerender build failures remain exact
  inherited findings, and no third local build was authorized.
