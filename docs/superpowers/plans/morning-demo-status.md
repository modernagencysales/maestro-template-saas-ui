# Morning Demo Status Ledger

Last controller update: 2026-08-19T22:36:00-04:00

| Lane          | State  | Current evidence                                                                                                                                     | Next gate                            | Blocker                                                                                                                                                        |
| ------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller    | active | Clean control head `a7a9af3`; eight live `morning-demo` windows; baseline URL sweep returned HTTP 200                                                | T+0:30 infrastructure gate at 22:55  | headless SSH re-snapshot failed: `Permission denied (publickey,password,keyboard-interactive)`; local preflight failed because `node_modules`/`tsx` are absent |
| Template      | active | Clean canonical head `13a33eee`; persistent goal confirmed; pinned dependency install started                                                        | Source inventory and focused gates   | initial preflight failed because `node_modules`/`tsx` were absent                                                                                              |
| Social        | active | Clean assigned branch at `65c4962`; persistent goal confirmed                                                                                        | Foundation sync                      | seed work remains in a separate dirty headless worktree                                                                                                        |
| Owned Funnel  | active | Clean assigned branch at `36396b0`; persistent goal confirmed; `modernagencysales/owned-funnel-review` remote exists                                 | Private Pro routes                   | management URL does not exist                                                                                                                                  |
| Brain         | active | Clean assigned branch at rollback baseline `6e3727da`; persistent goal confirmed                                                                     | Safe canonical shell delta           | canonical shell hashes differ                                                                                                                                  |
| Focused tests | active | Persistent goal confirmed; existing broad `pnpm verify` for `4df6286958b6` observed in `/home/maestro/test-runs/20260820T023102Z-4df6286958b6-78718` | Establish serialized candidate queue | control checkout preflight lacks dependencies; no competing broad job authorized                                                                               |
| Deploy/review | active | Persistent goal confirmed; baseline Template, UI Lab, Storybook, Social, public Owned Funnel, Brain auth redirect, and Dmitry URLs returned HTTP 200 | Candidate receipts                   | Owned management URL does not exist                                                                                                                            |

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
