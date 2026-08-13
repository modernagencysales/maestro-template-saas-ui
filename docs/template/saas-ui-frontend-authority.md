# Saas UI Frontend Authority

The pinned TanStack Starter Kit Pro and Saas UI Pro registry are the frontend
source authority. Before adding visible UI, choose the closest composition in
`docs/template/saas-ui-upstream.json` or an installed Pro block.

- Keep the upstream JSX, component choice, style props, theme behavior, spacing,
  density, responsive behavior, keyboard behavior, and focus behavior.
- Change only route definitions, WorkOS/Convex/service adapters, neutral
  fixtures, semantic product roles, and the smallest compatibility seam.
- Keep `docs/template/saas-ui-deviations.json` as the exact empty array. Adapt
  product behavior behind the Starter components rather than forking them.
- Do not create a second generic wrapper, shell, page, table, dialog, drawer,
  empty-state, or visualization authority.

The current frontend closure is mandatory in every current generated blueprint;
it is not a selectable application pattern. Paid source remains private and must
retain its notices under `docs/licenses/saas-ui/`.

The active route authority is `apps/web/src/routes/_app/`, rooted by
`apps/web/src/routes/_app.tsx`; `apps/web/src/provider.tsx` owns the provider
composition. Legacy `_workspace`, golden feature, business-shell, and custom
navigation trees are not projection inputs.
