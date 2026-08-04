# Task 5 / C4 Implementation Report

## Result

Implemented the static product-contract authority and darkness boundary on top
of approved C3 (`44b2488ae`):

- official `@cucumber/gherkin` byte-to-Pickle compilation with stable canonical
  source, Pickle, Outline-row, step, DataTable, and DocString projections;
- exact Feature-level journey/lifecycle validation, reserved-tag placement,
  inherited official `PickleStep.type`, UTF-8/LF/path checks, and deterministic
  collision detection;
- repository inventory compilation against an immutable Git SHA, the closed
  lifecycle matrix, suspended tombstone prose retention, admitted coverage,
  exhaustive transport/cross-surface checks, per-entrypoint negative coverage,
  and auth-policy weakening/incomparability deltas;
- controller-only observation of dedicated current-head security CODEOWNER
  approval; candidate input cannot supply approval state;
- byte-exact generated `admittedJourneys.ts`, drift checking, and explicit
  `no-admitted-contracts` static status;
- UI action omission, authenticate-then-server-admission execution, emergency
  deny, and feature-flag-after-admission monotonicity;
- a security gate that forbids reading the generated admission projection
  outside the two reviewed adapters.

No external service, pull request, or protected-state mutation was performed.
Runtime Cucumber verdicts remain intentionally locked until the later runtime
tasks.

## TDD Evidence

The compiler/inventory suites first failed because their modules did not exist;
the UI/server suites first failed because their adapters did not exist; the
projection and controller-approval tests first failed because their functions
did not exist; and the admission-reader mutation first passed unexpectedly
before the security gate was implemented.

Fresh final verification:

- focused Vitest gate: 7 files, 111 tests passed;
- follow-up contract-inventory/admission-authority gate: 2 files, 21 tests
  passed, including unchanged-ID auth-policy weakening, zero-owned journey
  rejection, and generated API locator admission;
- `pnpm exec tsx tooling/acceptance/check-contracts.mts --write`: passed;
- `pnpm acceptance:check`: passed with byte-exact projection and
  `no-admitted-contracts`;
- `pnpm typecheck`: no errors;
- `pnpm check:auth-demo-bypass`: passed;
- focused ESLint and Prettier checks: passed.

## Preserved Worktree State

The pre-existing `.superpowers/sdd/task-2-report.md` modification and the three
unrelated nested Confect fixture deletions were neither edited nor staged.
