# Morning Demo Status Ledger

Last controller update: 2026-08-19T22:39:00-04:00

| Lane          | State  | Current evidence                                                                                                                                                                       | Next gate                       | Blocker                                                                                         |
| ------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Controller    | active | Control branch pushed through `384530b`; T+0:30 infrastructure gate passed early; fake preflight passed under Node `22.23.2` / pnpm `10.12.1`                                          | T+2:00 foundation gate at 00:25 | none                                                                                            |
| Template      | active | Clean canonical head `13a33eee`; focused route-tree and Pro/Worker tests passed                                                                                                        | Source inventory and web gates  | `pnpm check:saas-ui-foundation` reports a stale vendored-source receipt                         |
| Social        | active | Clean assigned branch at `65c4962`; persistent goal confirmed                                                                                                                          | Foundation sync                 | seed work remains in a separate dirty headless worktree                                         |
| Owned Funnel  | active | Clean assigned branch at `36396b0`; persistent goal confirmed; `modernagencysales/owned-funnel-review` remote exists                                                                   | Private Pro routes              | management URL does not exist                                                                   |
| Brain         | active | Clean assigned branch at rollback baseline `6e3727da`; persistent goal confirmed                                                                                                       | Safe canonical shell delta      | canonical shell hashes differ                                                                   |
| Focused tests | active | Existing broad `pnpm verify` for `4df6286958b6` remains the sole broad job; serialized queue is recorded under `/data/projects/morning-demo-20260819/evidence/focused-tests/queue.tsv` | Await immutable lane candidates | none; an unrelated Aug 14 orphan was removed by the supervisor without touching the current run |
| Deploy/review | active | Baseline URL matrix exists; established headless execution path is `ssh -i /home/maestro/.ssh/id_ed25519_headless_codex_lb headless@headless`                                          | Candidate receipts              | Owned management URL does not exist; no tested candidate handoff yet                            |

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
