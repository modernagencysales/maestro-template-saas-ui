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
   assembled compositions mechanically and keep product behavior behind adapters.
4. Cover `/dashboard`, `/creators`, `/opportunities`, `/proposals`, and `/reports`.
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
