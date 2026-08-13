# How To Add A Production Feature And Route

Search before scaffolding, then use the golden vertical-slice generator:

```bash
pnpm template:systems -- --query "<responsibility>"
pnpm template:add-feature -- --name accountSignals --system <canonical-id> --disposition reuse|extend --description "Present grounded account signals" --write
```

If the responsibility or interaction is still uncertain, start with
`template:prototype` under `experiments/` and promote by running
`template:add-feature` only after the experiment is understood.

## Files Created

- A real Confect capability spec, impl, pure domain seam, contract test, and
  web-only exposure metadata.
- A feature contract declaring canonical ownership, workspace auth/tenancy,
  typed errors, audit events, observability/redaction, feature flag,
  entitlement, and data lifecycle posture.
- A frontend presenter/view model with loading, empty, ready, edit, skipped,
  typed-error, transport-error, and success states.
- Fake-safe fixtures and presenter behavior tests.
- A Saas UI feature component.
- A screen that composes the feature.
- A thin TanStack route that composes only the screen.
- Generated docs and topology-compatible ownership provenance.

The generator refuses to overwrite any existing target. An overlap is a signal
to reuse/extend the existing slice or choose a deliberately reviewed name.

## Follow-Up

1. Specialize the capability args/returns and pure domain seam. Keep every
   declared typed error reachable.
2. Run `pnpm confect:codegen` and use the generated ref from a thin frontend
   adapter. Do not import Convex internals into the feature.
3. Replace synthetic fixtures only through that adapter; retain fixtures for
   deterministic tests and Storybook-style state review.
4. Add navigation after the flag, entitlement, auth, and audit posture is
   approved.
5. If durable state is required, run `template:add-table` with the complete
   tenant, sensitivity, PII, export, delete, and retention posture.
6. Keep workspace routes beneath the existing pathless `_workspace` boundary.
   Start feature and screen UI from the checked-in purchased composition shelf.
   Native controls and local foundational substitutes are lint errors. Add a
   custom visual composition only when no checked-in, public, or Pro primitive
   covers the need; do not add a second shell or speculative route.

## Tests And Gates

- `pnpm exec vitest run apps/web/src/features/<feature>/model.test.ts`
- `pnpm exec vitest run packages/convex/confect/capabilities/<feature>.test.ts`
- `pnpm confect:codegen`
- `pnpm build`
- `pnpm check:route-tree`
- `pnpm check:semantic-colors`
- `pnpm --dir apps/web test -- frontend-foundation.test.ts`
- `pnpm check:system-topology`
- `pnpm check:data-resources`
- `pnpm check:promotion-boundary`
- `pnpm check:layer-boundaries`

Run these focused gates for the route task. Defer `pnpm verify` to the delivery
batch: run it once on the immutable final head, with Woodpecker as the blocking
verification authority.
