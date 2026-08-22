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

## Required paired evidence

Record both rendered applications for every review:

- `UPSTREAM_REFERENCE_URL`: the pinned Starter reference URL.
- `GOLDEN_GENERATED_URL`: the generated target URL under review.

Capture matching desktop/mobile and light/dark screenshots from both URLs. The
accessibility pass must include keyboard-only navigation and a 320 px viewport,
with results attached beside the paired screenshots.

Owner approval phrase: **Approved: pinned reference and generated target
preserve the Starter authority and receipt.**
