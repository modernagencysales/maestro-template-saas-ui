# Social persistent goal

## Objective

Deliver a stable HTTP Social demo whose dashboard, creators, opportunities,
proposals/Kanban, and reports routes use the exact canonical Pro visual system
from template commit `13a33eee`, while preserving the existing Social backend
through typed adapters and showing useful deterministic data.

## Plan

1. Create this objective as the session's persistent goal.
2. Read repository instructions and the committed control plan.
3. Compare the assigned branch to canonical structural source; transplant
   assembled compositions mechanically and keep product behavior behind
   adapters.
4. Cover `/dashboard`, `/creators`, `/opportunities`, `/proposals`, and
   `/reports`.
5. Reuse the presentation seed checkpoint if available; otherwise use explicit
   demo fixtures by the T+3 fallback gate.
6. Run changed-package checks and web build only during iteration.
7. Commit and push bounded checkpoints, then hand the exact candidate commit to
   deploy/review.

## Constraints

- Work only in `/data/projects/morning-demo-20260819/social` on
  `codex/morning-demo-social-pro`.
- Do not touch existing headless Social worktrees or sessions.
- Do not open/update a PR until the candidate is reviewable.
- Prefix every shell command with `rtk`.

## Terminal readiness diagnosis — eb918d044a34

- Merged and live `main` remains `1fa00df0605d7a2beea238caba31a263c3197977`;
  Woodpecker `345` remains red and is not deployment-accepted.
- Clean pushed branch `codex/social-ci-readiness-1fa00df` is exact
  `eb918d044a34b754ce29396d866302cc039aaab8`. It retains a deterministic shard-C
  readiness wait and a bounded shard-B alert diagnostic; focused contracts,
  changed-file lint/format, diff check, and the repository pre-push policy hook
  passed.
- Narrow reproduction exposed shard B's terminal product/harness result:
  `Claim token is missing.` The one-time claim token is lost before the
  canonical claim surface accepts it. No speculative fix remains.
- Shard C's readiness repair is not runtime-accepted because the controller's
  two-cycle boundary prohibited another scenario run.
- No PR, CI, deployment, WorkOS/callback mutation, hosted smoke, or runtime
  promotion followed. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/social-eb918d044a34-two-cycle-terminal-receipt.md`.
