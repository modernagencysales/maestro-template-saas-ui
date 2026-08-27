# Effect Services And Layer Patterns

## Read Order

1. `repos/effect/packages/effect/test/Layer.test.ts`
2. `repos/effect/packages/effect/test/Context.test.ts`
3. Local provider seams in `packages/integrations/src/*`

## Local Template Rules

- Keep provider SDKs behind service/adaptor boundaries.
- Prefer fake/test/live-ready implementations over environment conditionals
  scattered through business logic.
- Make deterministic seams explicit: injected clock, nonce, fetch, telemetry,
  and storage clients.
- Keep pure domain helpers independent from Effect service construction.

## Good Examples

- `packages/integrations/src/llm.ts`
- `packages/integrations/src/rateLimit.ts`
- `packages/observability/src/index.ts`
- `packages/notifications/src/index.ts`

## Things To Avoid

- Constructing model/provider clients inside capabilities or workflows.
- Reading env vars outside the typed env boundary.
- Letting telemetry failures fail user-facing capability calls.

## Verification Commands

```bash
pnpm --dir packages/integrations test
pnpm --dir packages/observability test
pnpm --dir packages/notifications test
```
