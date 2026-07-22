# Task 3 report: route integration findings to owners

## Status

Complete on `codex/repair-first-owner-routing`.

- Base: `bed8b7dcc75cb9db66160ac421491ddb646a9c61`
- Head: `f62e908d3dabe20ae1258ae676571a46c74bd48a`
- Commit range: `bed8b7dc..f62e908d`
- Worktree: `/private/tmp/maestro-repair-first-owner-routing`
- Worktree state before this report: clean

## Commits

1. `b0dff3bb` `feat: classify Brain finding owners`
2. `a7dc082e` `fix: preserve owner rework terminals`
3. `01ff353b` `fix: exit Brain product rework early`
4. `f62e908d` `fix: route Brain rework without blocking`

Each implementation checkpoint stays below the repository's 300-line source
slice limit; tests are not counted as source.

## Implemented

- Added deterministic `task` versus `integration` finding ownership with exact
  candidate/evidence validation and fail-closed mixed/unknown ownership.
- Added the read-only owner-rework gate. It validates the immutable selection,
  result bytes, candidate head, selected lane locks, and integration-owned
  generated paths. It writes no lane result and certifies no integration pass.
- Changed the wave graph so task-owned product findings exit immediately for
  owner routing; only integration-owned findings enter exact-head repair.
- Added normal tooling that supersedes once, creates finding-bound requests via
  existing failed-integration validation, and invokes existing reopen tooling
  once per sorted owner with `--launch`.
- Represented a successful Fabro owner-rework exit as the explicit immutable
  `owner_rework` run-attempt state. Ordinary succeeded attempts remain
  non-supersedable. The explicit state is accepted only when the exact
  task-owned result validates and is SHA-bound into supersession evidence.
- Added controller `owner_rework` state and `route_owner_rework` action, with
  exact result/selection hashes in action identity and reconciliation.
- Continued unrelated task dispatch in the same controller plan while owner
  routing is the first action.
- Added the necessary bounded observer seam so real terminal Fabro results can
  enter `owner_rework`; this file was omitted from the brief's file inventory
  but is required for executable controller behavior.

## Verification

- RED observed for missing classification, state/action, workflow routing, and
  explicit succeeded-owner-rework terminal support before implementation.
- `rtk host-test-slot --class focused pnpm --dir tooling/brain-factory test integration-finding failed-integration-rework factory-state controller workflow-prompt-contract`
  - PASS: 6 files, 121 tests.
- `rtk host-test-slot --class focused pnpm --dir tooling/brain-factory test integration-wave failed-integration-rework integration-finding factory-state controller workflow-prompt-contract`
  - PASS: 7 files, including the explicit owner-rework terminal contract.
- `rtk pnpm --dir tooling/brain-factory typecheck`
  - PASS.
- `rtk pnpm lint`
  - PASS.
- `rtk pnpm exec prettier --check --ignore-unknown tooling/brain-factory/src tooling/brain-factory/test .fabro/workflows/brain-integrate-wave/workflow.fabro package.json`
  - PASS.
- `rtk fabro validate .fabro/workflows/brain-integrate-wave/workflow.fabro`
  - PASS: 12 nodes, 18 edges.
- `rtk pnpm brain:factory:check`
  - PASS: 57 tasks, ready width 9, 47 gaps, 8 patterns, 2 fixtures.

The brief's literal Prettier command without `--ignore-unknown` was also run.
Prettier returned exit 2 solely because it has no parser for `.fabro` files. All
TypeScript/JSON paths pass Prettier, and the `.fabro` file passes Fabro's
authoritative graph validator.

## External effects and concerns

- No Fabro run launched.
- No product, MAE-394, deployment, migration, production, or shared state was
  touched.
- No remaining functional concern is known. Normal supersession/reopen now has
  focused proof for the actual succeeded Fabro owner-rework exit.
