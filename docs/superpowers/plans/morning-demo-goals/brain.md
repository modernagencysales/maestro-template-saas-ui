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
6. Run focused Brain/UI checks and web build, commit and push a bounded
   candidate, then hand it to deploy/review for staging and authenticated smoke.

## Constraints

- Work only in `/data/projects/morning-demo-20260819/brain` on
  `codex/morning-demo-brain-pro`.
- Do not touch existing headless Brain worktrees or sessions.
- Preserve deployed merge `6e3727da` as the rollback baseline.
- Prefix every shell command with `rtk`.

## Terminal staging disposition — 2026-08-20

- Exact successor `094819975d9f5eeeb551c08ced31cccaa0da08e8` passed Woodpecker
  verify `803` and staging deployment `804` as Worker
  `81ebe51c-3ff6-4b93-bca9-3fe908139417`.
- The one explicitly authorized corrected client-scoped `@seeded-behavior` smoke
  used existing `Staging fixture 02ceeed320ec90e9dbc2`. Page creation succeeded,
  then the new page route entered the application error boundary with
  `useSidebar must be used within a SidebarProvider` before title/body editing.
  The test was not rerun and edit/save proof is not admitted.
- The fresh WorkOS state was deleted without being printed. Candidate evidence
  was preserved, and safe version `30f8f677-e999-423f-9654-0488ef2ee151` was
  rolled back exactly once and is at `100%`.
- Terminal receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-094819975d9f-seeded-runtime-failure-rollback.md`.
- Read-only ownership diagnosis pins the bounded repair to a local Notion Kit
  provider inside `BrainWorkspaceContent`, with the matching test-only wrapper
  removed. This preserves the Saas UI Pro outer shell. No implementation or gate
  is authorized by the handoff:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-094819975d9f-sidebar-provider-fix-ready.md`.

## Successor terminal staging disposition — 21d9971856fc

- The bounded provider repair landed as exact protected-main successor
  `21d9971856fc40023494e73933c94e7133f27737`. Focused proof passed 2 files/8
  tests, changed-file lint/format, and web typecheck.
- The sole Woodpecker verify `805` and staging deploy `806` were terminal
  success. Candidate Worker `c7b8a439-c9b4-431b-b9c8-af81a832032e` served the
  exact expected public `/brain` 307 redirect.
- One fresh exact-client `@seeded-behavior` smoke on existing
  `Staging fixture 02ceeed320ec90e9dbc2` proved create, title/body save,
  navigation, reload persistence, and persisted internal linking. It was not
  rerun.
- The full scenario is not accepted: opening `More` mounted
  `capabilities/brain/exports:export_`, whose `exportMarkdownPagesImpl` performs
  multiple paginated queries in one Convex function. Convex rejected the query
  and the workspace entered its error boundary.
- The fresh auth state was deleted, evidence was sealed, and exactly one
  rollback restored safe Worker `30f8f677-e999-423f-9654-0488ef2ee151` at
  `100%`. No duplicate CI, deploy, smoke, rollback, or product edit followed.
- Terminal receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-21d9971856fc-terminal-runtime-receipt.md`.

## Serial-pagination successor terminal disposition — 744e0d0c2fb8

- Exact protected-main successor `744e0d0c2fb8c15cd893bc48b78a854cb923e5a6`
  replaced the page-export `Promise.all` with serial accumulation and added a
  concurrency regression. Focused markdown-export proof passed 5 files/20 tests
  with targeted lint, format, and package typecheck.
- Sole Woodpecker verify `807` and sole staging deploy `808` were terminal
  success. Candidate Worker `223d41cf-4f01-4792-98b6-678227ceea23` served the
  exact expected public `/brain` 307 redirect.
- One fresh exact-client `@seeded-behavior` smoke again proved create,
  title/body save, navigation, reload persistence, and persisted internal
  linking. It was not rerun.
- The candidate is runtime-rejected. Opening `More` mounted
  `capabilities/brain/exports:export_`; Convex rejected the serial second
  pagination call because a registered function may invoke pagination only once
  in total, not merely once concurrently. The app entered its workspace error
  boundary before exposing `Export markdown`.
- Fresh auth state was used once and deleted, evidence was sealed, and exactly
  one rollback restored safe Worker `30f8f677-e999-423f-9654-0488ef2ee151` at
  `100%`. No duplicate gate, deploy, smoke, auth generation, rollback, or
  further product edit followed.
- Terminal receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-744e0d0c2fb8-terminal-runtime-receipt.md`.

## Canonical resolver successor disposition — 0ecfcd19f10f

- Exact protected-main successor `0ecfcd19f10fa6e5155c689361788abee88a1733`
  passed sole Woodpecker verify `810` and sole staging deployment `811`.
- Convex `utmost-bear-718` and Worker `20ee5e88-f66b-4c71-95ac-3544dec776b9`
  deployed cleanly; the Worker remains at `100%`. Public `/brain` returned the
  exact signed-out `307` redirect.
- One fresh exact-client WorkOS state was captured, but the sole Playwright
  invocation stopped before test discovery because the command omitted the
  separately required `BRAIN_PROOF_STAGING_WORKSPACE_ID`. No product runtime,
  mutation, persistence, or export assertion ran.
- The auth state was deleted and was not regenerated. Per the no-rerun boundary,
  authenticated acceptance remains unproved pending new controller admission.
  This was not a product runtime failure, so no rollback occurred; safe Worker
  `30f8f677-e999-423f-9654-0488ef2ee151` remains the only authorized rollback
  coordinate.
- Terminal receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-0ecfcd19f10f-terminal-controller-ambiguity.md`.
