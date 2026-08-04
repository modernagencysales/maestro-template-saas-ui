# Task 4 (C3) implementation report

Implemented exhaustive public-entrypoint discovery and checked-in inventory
generation.

## Delivered

- Deterministic AST/source discovery for generated routes, UI mutation/action
  calls, Confect surfaces, raw Convex exports, HTTP routes/webhooks, CLI
  commands, MCP tools, and workflow publications.
- Exact discovered/registered bijection checks with duplicate authority and
  surface-ID rejection.
- One-time deterministic `auth_deny_all` legacy adoption plus a
  content-addressed, non-growing baseline.
- Generated JSON inventory and typed TypeScript projection from the same value.
- Dynamic, sorted Confect spec loading; the four manual spec imports were
  removed while the existing runtime manifest remained byte-identical.
- System-topology and headless-surface gates now reject inventory bypasses with
  the missing registration locator.

The current inventory contains 258 legacy authorities. The generated TanStack
route tree is the route authority, so no duplicate manual route array was added
to `reference-app-routes.ts`.

## Verification

- `pnpm check:confect-manifest`: 4 files / 21 tests passed, typecheck passed,
  generated runtime and inventory outputs fresh.
- `pnpm check:system-topology`: passed (65 resources / 7 kinds).
- `pnpm check:headless-surface-contract`: passed.
- `pnpm check:route-tree`: passed (`pin-only`).
- `pnpm check:convex`: generated files up to date; no generated drift.
- Focused quality tests: 2 files / 27 tests passed.

The existing runtime `confectManifest.ts`, Confect inventory sidecar, and its
digest did not change. No external services were used.

## Review remediation

- Added AST coverage for all `FunctionSpec.public*` and
  `FunctionSpec.convexPublic*` registrations; the inventory now includes the 16
  previously omitted Convex-public authorities.
- Direct `useMutation`/`useAction` (and Confect aliases) in customer UI code are
  discovered; only the registered adapter implementation is exempt.
- Publication registry release identifiers are not public triggers without an
  external trigger registration.
- Added an independent baseline digest trust anchor and regression coverage so a
  self-consistent candidate inventory/baseline pair is rejected.
