# Owned Funnel persistent goal

## Objective

Deliver a stable HTTP private Owned Funnel management app in TanStack Start
using the exact canonical Pro shell/screens, connected to the existing
Convex/Confect management backend, while leaving all public Astro funnel pages
and the legacy Astro management fallback untouched.

## Plan

1. Create this objective as the session's persistent goal.
2. Read repository instructions, frontend authority, existing Astro management
   client, and the committed control plan.
3. Add canonical private routes for overview, contacts, submissions, runs, run
   detail, effects, and lifecycle actions to `apps/web`.
4. Reuse typed backend reads/mutations; do not duplicate business logic.
5. Add deterministic demo data and a focused Cloudflare Worker contract for
   `apps/web`.
6. Prove focused checks, web build, public Astro regression safety, one real
   backend read, and one lifecycle mutation.
7. Commit and push bounded checkpoints, then hand the exact candidate commit to
   deploy/review.

## Constraints

- Work only in `/data/projects/morning-demo-20260819/owned-funnel` on
  `codex/morning-demo-owned-pro`.
- Never edit `/Users/headless/owned-funnel-builder` or public Astro product code.
- Keep the legacy Astro `/manage` available until the new app is proven.
- Prefix every shell command with `rtk`.
