# How To Add A Production Feature And Route

Search before scaffolding, then use the golden vertical-slice generator:

```bash
pnpm template:systems -- --query "<responsibility>"
pnpm template:add-feature -- --name accountSignals --system <canonical-id> --disposition reuse|extend --screen-catalog-id '<exact-id-from-catalog>' --description "Present grounded account signals" --write
```

Choose the ID from `docs/template/saas-ui-screen-catalog.json` before running
the generator. The selection is pinned to its upstream entry file, complete
local import closure, source receipt, and the full `app-shell`. Missing or
unknown IDs fail closed.

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
- A mechanically transplanted Starter route composition with only its route
  binding changed for the new TanStack file route.
- Frontend provenance naming the exact catalog ID, closure hash, source and
  destination hashes, allowed adapter categories, shell, and visual states.
- Generated docs and topology-compatible ownership provenance.

The generator refuses to overwrite any existing target. An overlap is a signal
to reuse/extend the existing slice or choose a deliberately reviewed name.

## Follow-Up

1. Specialize the capability args/returns and pure domain seam. Keep every
   declared typed error reachable.
2. Run `pnpm confect:codegen` and connect the generated ref through the selected
   composition's thin data/mutation adapters. Do not rewrite its JSX or import
   Convex internals into the screen.
3. Replace synthetic fixtures only through that adapter; retain fixtures for
   deterministic tests and Storybook-style state review.
4. Add navigation after the flag, entitlement, auth, and audit posture is
   approved.
5. If durable state is required, run `template:add-table` with the complete
   tenant, sensitivity, PII, export, delete, and retention posture.

## Tests And Gates

- `pnpm exec vitest run apps/web/src/features/<feature>/model.test.ts`
- `pnpm exec vitest run packages/convex/confect/capabilities/<feature>.test.ts`
- `pnpm confect:codegen`
- `pnpm build`
- `pnpm check:route-tree`
- `pnpm check:system-topology`
- `pnpm check:data-resources`
- `pnpm check:promotion-boundary`
- `pnpm check:layer-boundaries`

Run these focused gates for the route task. Defer `pnpm verify` to the delivery
batch: run it once on the immutable final head, with Woodpecker as the blocking
verification authority.
