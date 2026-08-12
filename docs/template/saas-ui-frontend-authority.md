# Saas UI Frontend Authority

The pinned TanStack Starter Kit Pro and Saas UI Pro registry are the frontend
source authority. Before adding visible UI, choose the closest composition in
`docs/template/saas-ui-upstream.json` or an installed Pro block.

- Keep the upstream JSX, component choice, style props, theme behavior, spacing,
  density, responsive behavior, keyboard behavior, and focus behavior.
- Change only route definitions, WorkOS/Convex/service adapters, neutral
  fixtures, semantic product roles, and the smallest compatibility seam.
- Record every unavoidable structural or style change in
  `docs/template/saas-ui-deviations.json` with source, destination, changed
  property or structure, compatibility reason, and evidence.
- Do not create a second generic wrapper, shell, page, table, dialog, drawer,
  empty-state, or visualization authority.

The current frontend closure is mandatory in every current generated blueprint;
it is not a selectable application pattern. Paid source remains private and must
retain its notices under `docs/licenses/saas-ui/`.
