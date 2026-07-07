# Golden Path Business Slice

Status: template-default example, fake-safe locally, live-ready when Convex is
configured.

The visible starter app should prove one complete frontend path before a client
fork adds domain-specific screens:

```text
TanStack Start route
-> Saas UI business shell
-> feature component
-> apps/web/src/adapters/confect-state.ts
-> generated @confect/react ref
-> Confect spec/impl
-> Convex table or fixture
```

## Copy This First

Use these files as the first pattern when adding a client-specific entity:

| Purpose                  | File                                                              |
| ------------------------ | ----------------------------------------------------------------- |
| Business shell           | `apps/web/src/saas-ui/business-shell.tsx`                         |
| Live query card          | `apps/web/src/features/workflows/live-runs-panel.tsx`             |
| Pure query presenter     | `apps/web/src/features/workflows/live-runs-presenter.ts`          |
| Query and mutation route | `apps/web/src/features/data-lifecycle/data-lifecycle-surface.tsx` |
| Frontend state adapter   | `apps/web/src/adapters/confect-state.ts`                          |
| Effect boundary adapter  | `apps/web/src/adapters/effectBoundary.ts`                         |
| Example read contract    | `packages/convex/confect/demo/showcase.spec.ts`                   |
| Example write contract   | `packages/convex/confect/ops/dataLifecycle.spec.ts`               |

## Labels

- **Saas UI shell:** owns the visible business-app layout, nav, cards, tables,
  buttons, badges, and responsive route pages.
- **Confect hooks:** default data path for Convex-backed server state.
- **Convex React Query:** router/cache integration only; do not wrap arbitrary
  Effect programs in TanStack Query.
- **Effect runtime:** adapter-only on the frontend. Runtime execution APIs stay
  in `apps/web/src/adapters/effectBoundary.ts`.
- **Effect Atom:** candidate only. Add it later only for complex local-first or
  worker-backed state with bundle-size evidence.

## Required States

Every new visible data slice should render these states deliberately:

- skipped or unconfigured local mode;
- loading;
- empty;
- ready;
- typed failure;
- transport or parse failure;
- defect fallback.

Keep state mapping in a pure presenter whenever the view logic is more than a
couple of branches. Keep the React component focused on Saas UI rendering.

## Mutation Rule

The first mutation route is `/data-lifecycle`. It demonstrates the required
behavior:

- fake-safe local state when Convex is not configured;
- generated Confect mutation refs when Convex and workspace identity are ready;
- typed mutation result normalization through `classifyConfectMutationResult`;
- toast notification through `notifyTemplateMutation`;
- no direct provider SDKs, raw Convex calls, or Effect runtime calls in the UI.

Client forks should copy this pattern before adding optimistic updates or richer
local state.
