# Starter Business Slice

Status: pinned Starter frontend authority, fake-safe locally.

Use the literal TanStack Start route and provider tree as the first pattern for
client work:

```text
apps/web/src/provider.tsx
-> apps/web/src/routes/_app.tsx
-> apps/web/src/routes/_app/$workspace.tsx
-> apps/web/src/routes/_app/$workspace/_dashboard.tsx
-> apps/web/src/routes/_app/$workspace/_dashboard/index.tsx
-> feature component
-> typed backend adapter
```

Reusable primitives live in `packages/ui` (`@workspace/ui`). The installed Saas
UI compositions remain under `apps/web/src/components`, while contacts, inbox,
search, settings, auth, and billing behavior stays in the matching
`apps/web/src/features` directory.

Add product routes inside the existing `_app` hierarchy and keep route modules
thin. Do not restore `_workspace`, `features/golden`, a business-shell wrapper,
or custom navigation authority. Verify route structure with:

```bash
pnpm smoke:starter-route-parity
```
