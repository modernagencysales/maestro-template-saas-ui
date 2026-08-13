# Saas UI Starter Route-Parity Review

The pinned Starter tree is the reference. Verify the checked-in app through its
literal `_app` route hierarchy with:

```bash
pnpm smoke:starter-route-parity
```

The suite covers the authenticated dashboard and nested workspace routes in
`tests/e2e/saas-ui-starter-route-parity.spec.ts`. A generated target must retain
the same route files, provider composition, and receipt hashes. Do not approve a
target that projects `_workspace`, golden feature, business-shell, or custom
navigation alternatives.

Owner approval phrase: **Approved: generated routes preserve the pinned Starter
authority and receipt.**
