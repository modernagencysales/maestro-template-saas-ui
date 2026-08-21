# Active Saas UI Pro Demo Transplant

**Goal:** Make the pinned Saas UI Pro demo, not the hand-composed Showcase, the
visible application foundation while retaining TanStack Start, WorkOS, Convex,
and Cloudflare Workers.

## Work package

- `kind`: `template-gap`
- `target`: active full Pro demo routes and assembled Storybook UI Lab
- `templateBacklogRef`: `porting-backlog:L-131a`
- `templateResolutionPath`: mechanically transplant the pinned Pro demo shell,
  screens, and assembled stories into the existing `_app` TanStack route tree;
  keep router, auth, and data changes behind adapters; project the resulting
  files into generated customer targets.
- `followUpGates`:
  `pnpm exec vitest run tooling/saas-ui/active-pro-foundation.test.ts`,
  `pnpm check:route-tree`, `pnpm check:saas-ui-foundation`,
  `pnpm --dir apps/web typecheck`, `pnpm --dir apps/web build`, hosted route
  smoke, and paired screenshots against the pinned reference deployments.

## Source authority

- Pro demo commit: `ac3a40c8dc05e403f9d501a87c092646891d3c40`
- Starter commit: `b76cb4514b9ab47f7db87901cb9b593b4adc3129`
- Catalogue: `docs/template/saas-ui-screen-catalog.json`

For each screen, retain upstream JSX structure, component choice, style props,
spacing, responsive composition, and interaction structure. TanStack routes,
WorkOS, Convex/Confect view models, deterministic review fixtures, and provider
SDKs remain adapters outside the visible composition.

## Delivery slices

1. Exact Pro shell/navigation plus Updates, Reports, Contacts, and Search.
2. Account/API/notifications, members, billing, plans, and onboarding.
3. Companies and Workflows canonical empty states.
4. `/ui-lab` routes for Writer, Kanban, DataGrid, filters, SplitPage, four
   sidebars, and both stacked navbars.
5. Fresh generated-target proof and Cloudflare Workers review deployment.
