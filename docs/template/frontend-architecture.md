# Frontend Architecture

The frontend is an opinionated app-factory shell for custom AI Brain, workflow,
agent, and go-to-market implementation software. It should feel like a working
product surface with a plain Saas UI business-app shell as the default visible
experience.

## Layer Law

Use this dependency direction:

```text
web routes -> screens -> features -> adapters -> Confect/Convex refs
features -> blocks -> Saas UI/shared primitives
workflow feature surfaces -> packages/workflow-ui -> React Flow
```

Rules:

- Routes are thin. They bind paths, loaders, auth posture, and screen
  composition.
- Screens compose feature surfaces and shell blocks.
- Features adapt backend data into view models.
- Blocks render generic UI. Blocks must not import Convex, Confect refs,
  provider SDKs, WorkOS, PostHog, billing SDKs, or workflow persistence code.
- Durable workflow graph schemas, validation, persistence, and execution never
  import React Flow.
- React Flow stays inside `packages/workflow-ui` and workflow feature surfaces.

## Runtime Direction

TanStack Start is the committed runtime direction for the template.

The checked-in router/provider authority is:

- `apps/web/src/provider.tsx` for provider composition.
- `apps/web/src/routes/__root.tsx` for the root document.
- `apps/web/src/routes/_app.tsx` and its nested `$workspace/_dashboard` tree for
  authenticated application routes.
- generated `routeTree` at `apps/web/src/routeTree.gen.ts`.
- `defaultPreload: "intent"` and `setupRouterSsrQueryIntegration` from the
  pinned Starter router.

Deployment decision:

- Keep TanStack Start as the committed runtime and prove any hosting change with
  local static smoke, hosted HTTP smoke, hosted browser smoke, and hosted visual
  smoke.
- Prefer TanStack Start static output on Cloudflare Pages first.
- Use Cloudflare Workers SSR only after explicit env mapping, rollback command,
  and smoke tests are documented.

## Provider Tree

`apps/web/src/provider.tsx` is the provider authority. Extend its existing
composition instead of introducing a parallel root provider.

Provider rules:

- WorkOS owns identity. Tenant/workspace identity used by backend calls must be
  server-derived or re-verified.
- Convex/Confect own durable business operations.
- PostHog receives redacted, contract-named events only.
- Provider SDK clients are constructed in adapters/providers, not feature
  components.
- Fake/local provider mode remains the default for template quickstarts.

## Saas UI And Blocks

The web shell should use Saas UI primitives where possible:

- `SuiProvider` with the Saas UI Pro default system for the web app provider.
- Saas UI layout, card, page, table, badge, button, input, and stack primitives
  for business-app surfaces.
- Installed Saas UI Pro components under `apps/web/src/components`; reuse the
  manifest compositions and registry paths before adding a local seam.
- lucide icons for commands and navigation affordances.

### Screen-first selection

Do not begin a new screen by arranging primitives. Start with the generated
catalogue at `docs/template/saas-ui-screen-catalog.json`, which indexes the
complete pinned Pro demo, every Pro story file, every TanStack Starter route,
and every Starter story file. The exact read-only sources live under
`repos/saas-ui-pro` and `repos/tanstack-start-starter-kit-pro` in the factory.
Generated targets retain the catalogue and its repository URLs/pins while
omitting the large read-only snapshots.

Selection order is mandatory:

1. A complete `saas-ui-pro/apps/demo` screen.
2. An assembled Pro Storybook block or template, including Writer, Kanban,
   DataGrid, filters, split layouts, sidebar layouts, and stacked navigation.
3. A complete TanStack Starter screen.
4. Loose primitives only when no assembled source applies.

Copy the chosen composition mechanically and record its catalogue `id` in the
implementation plan or pull request. Route syntax, authentication, backend
queries, and mutations may change through thin adapters. JSX structure, spacing,
component choice, responsive behavior, and interaction composition do not change
during the transplant. The vendored applications are reference authorities, not
runtime dependencies or an alternate application shell.

Useful commands:

```bash
pnpm saas-ui:catalog
pnpm check:saas-ui-screen-catalog
jq '.demoRoutes[] | {name, route, source, composition}' \
  docs/template/saas-ui-screen-catalog.json
jq '.stories[] | select(.title | test("Writer|Kanban|Sidebar|DataGrid"; "i"))' \
  docs/template/saas-ui-screen-catalog.json
```

CSS rules:

- Use `apps/web/src/index.css` for semantic tokens, font stack, density, focus,
  motion, and workflow categorical colors.
- Do not copy Maestro-specific product color names or route names into template
  tokens.

Block rules:

- `apps/web/src/components` contains the installed Pro registry components;
  reusable primitives live in `packages/ui` as `@workspace/ui`.
- Feature code composes manifest compositions and installed Pro blocks; it
  should not invent route-local layout systems.

Saas UI package note: the app pins Saas UI, Saas UI Pro, Chakra, and Emotion as
an aligned set. Do not loosen those pins independently; update them together
after a focused compatibility check against TanStack Start, React, and Confect.

## Platform Primitives

Reusable frontend platform primitives live in the installed Saas UI Pro paths
under `apps/web/src/components` and the manifest compositions.

- Command palette: route/action commands only. It must not import Convex,
  Confect refs, provider SDKs, or backend adapters.
- Notification center: renders empty, fake, test, and live-ready delivery states
  from provider-neutral view models.
- Onboarding checklist: works in fake mode and names missing live provider setup
  without printing secret values.
- Legal route: ships as a plain client-specific legal review draft. Replace
  privacy, terms, data handling, AI output review, and provider disclosure
  language for each client before launch.
- PWA manifest: declares install metadata only. Do not claim offline support
  until service worker caching and offline states are implemented and tested.

## Visualization Primitives

Reusable B2B visualization components live in the installed Pro registry paths
under `apps/web/src/components`. They consume plain view models and are
intentionally generic enough for GTM, Brain, workflow, billing, operations, and
support surfaces.

- Data grid, Kanban, calendar, funnel, metric tiles, health board, lineage, and
  diff views render loading, empty, ready, and error states.
- Feature adapters transform Confect/Convex data into view models before these
  components render.
- Visualization components must not import Convex, Confect refs, TanStack route
  modules, WorkOS, PostHog, provider SDKs, or persistence code.
- Keep visual layouts dense, readable, centered where appropriate, and built
  from Saas UI/shared primitives rather than route-local UI systems.

## Data Loading Rules

- Web data access goes through generated Confect refs via `@confect/react`, with
  Convex React Query where useful for router/cache integration.
- The shared Confect state adapter normalizes query/mutation state into
  `skipped`, `loading`, `empty`, `ready`, `typed_failure`, `parse_failure`,
  `transport_failure`, and `defect`.
- Route loaders preload only safe route data and auth state.
- Feature adapters convert backend contract data into view models.
- UI code must not read raw environment variables or construct provider SDKs.

## Frontend Data States

Feature components normalize Confect and Convex query/mutation results through
`apps/web/src/adapters/confect-state.ts`. The canonical statuses are `skipped`,
`loading`, `empty`, `ready`, `typed_failure`, `parse_failure`,
`transport_failure`, and `defect`. Components should render these states
directly or through feature presenters; they should not branch on raw Confect,
Convex, TanStack Query, or Effect internals.

## Effect State Policy

The detailed frontend Effect policy lives in
`docs/template/frontend-effect-state.md`. In short: TanStack Router/Start is the
current routing shell, Convex/Confect hooks are the default server-state model,
TanStack Query remains only for current router/Convex integration and legacy
cache surfaces, and Effect Atom is an opt-in adapter for complex local client
state rather than the template default.

## Navigation Model

The template workspace registry should include generic routes:

- Home
- Brain
- Workflows
- Capabilities
- Agents
- Runs
- Documents
- Sources
- Integrations
- API
- Onboarding
- Data Map
- Notifications
- Settings
- Legal
- Billing
- Analytics
- Health
- Admin

Grouped sections should expand for active children, active route selection
should come from the route registry, and the sidebar must remain mounted while
navigating.

## Quickstart Frontend Contract

The first app experience must support the default factory loop without making a
reviewer understand the whole codebase. The app should expose one clear route
for each step: Brain sources and context pack, workflow graph/run, capability
catalog, agent/tool grants, Trust Receipt, provider posture, and handoff or API
docs. Keep the visible route surfaces operational and business-app shaped.

Generated or client-specific UI should start with feature adapters and block
composition. It should not fork the shell, introduce a second sidebar, or
construct provider clients inside route components.

The concrete copyable implementation lives in
[golden-path-business-slice.md](./golden-path-business-slice.md). The dashboard
shows the read path with `demo.showcase.overview`; `/data-lifecycle` shows the
fake-safe query/mutation path.

## Workflow UI Rules

- Durable graph data is the source of truth.
- React Flow nodes and edges are derived UI state.
- Do not persist React Flow selection, hover, measured dimensions, viewport, or
  generic `data` bags.
- Validation hints are overlays derived from graph validation results.
- Reduced-motion mode disables nonessential canvas animation.

## Workflow Canvas State

`packages/workflow-ui/src/workflowCanvasState.ts` is the reusable workflow
canvas primitive. It converts durable workflow graph data into loading, empty,
and ready canvas states and overlays latest stage attempts onto nodes. It has no
React, Convex, Confect, Effect runtime, or generated-ref imports.

`packages/workflow-ui/src/index.tsx` renders the pure model with React Flow.
`apps/web/src/features/workflows/workflowCanvasAdapter.ts` is the app boundary
that combines a graph source with live stage rows. React Flow interactions must
emit workflow graph commands; React Flow node/edge objects are not persisted as
the source of truth.

## Migration Acceptance Criteria

Before frontend migration work is considered complete:

- `pnpm --dir apps/web test` passes.
- `pnpm check:route-tree` passes.
- `pnpm smoke:web-static` passes.
- Hosted browser and visual smoke pass for desktop and mobile.
- The Saas UI business shell remains readable on desktop and mobile.
- The route tree is generated at `apps/web/src/routeTree.gen.ts` and checked for
  freshness.
- The deployment guide documents Cloudflare Pages static output or Workers SSR
  with rollback.

## Optional Rich Editor Modules

BlockNote and ProseMirror are optional template extensions, not baseline app
factory requirements. Add them only for forks that need rich collaborative
document editing, and keep editor persistence behind explicit Confect/Convex
contracts.
