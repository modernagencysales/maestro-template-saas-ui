# Brain persistent goal

## Objective

Align the Brain application's outer shell exactly with canonical Pro commit
`13a33eee` while retaining the existing Notion-style editor internals, backend
behavior, authentication, and persistence; deliver authenticated staging proof.

## Plan

1. Create this objective as the session's persistent goal.
2. Read repository instructions, the committed control plan, and current Brain
   architecture contracts.
3. Synchronize the canonical preset, structural shell, gutters, header,
   navigation, drawers, dialogs, and notifications.
4. Do not modify editor internals unless a focused regression proves an adapter
   change is required.
5. Update the architecture contract to state `Pro shell + Notion-style editor`.
6. Run focused Brain/UI checks and web build, commit and push a bounded candidate,
   then hand it to deploy/review for staging and authenticated smoke.

## Constraints

- Work only in `/data/projects/morning-demo-20260819/brain` on
  `codex/morning-demo-brain-pro`.
- Do not touch existing headless Brain worktrees or sessions.
- Preserve deployed merge `6e3727da` as the rollback baseline.
- Prefix every shell command with `rtk`.
