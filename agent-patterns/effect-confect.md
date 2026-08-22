# Effect And Confect Agent Patterns

Factory checkouts may include read-only upstream research trees. Generated
customer targets instead ship canonical local guidance and typed contracts.

The current exact factory references are:

- Effect `effect@4.0.0-beta.102` at `de2a9a69099993087e57c64df58537c765ac0224`;
- Confect `@confect/core@10.0.0-next.9` at
  `ba0fb82222d487bdf62fde2c429e92628f8a0585`.

Factory maintainers keep the upstream provenance and refresh rules in the
factory-only vendored-source inventory. Generated customer targets rely on the
exact versions and commits recorded above without shipping those research trees.

## Read Order

When writing Effect or Confect code:

1. Read the local project rules in `AGENTS.md`.
2. Read `docs/template/confect-effect-guide.md`.
3. Inspect the shipped typed contracts and focused tests for the affected
   package.

Do not invent dependencies on factory-only research paths. Application code must
import from package dependencies, never from `repos/`.

## Confect Patterns To Prefer

- Tables live in `packages/convex/confect/tables/*` and use
  `Table.make(() => Schema.Struct(...))`.
- Function specs live beside implementations as `*.spec.ts`.
- Function impls live beside specs as `*.impl.ts`.
- Specs default-export a `GroupSpec`; impls default-export a finalized
  `GroupImpl`.
- Plain Convex functions needed by Convex components are included with
  `FunctionSpec.convex*` constructors and implemented by passing the Convex
  function value to `FunctionImpl.make`.
- Specs use type-only imports for plain Convex function values so server code is
  not pulled into client bundles.
- Run Confect codegen after spec, impl, or table changes.

Useful references:

- `repos/confect/apps/example/confect/tables/notes.ts`
- `repos/confect/apps/example/confect/notes_and_random/notes.spec.ts`
- `repos/confect/apps/example/confect/notes_and_random/notes.impl.ts`
- `repos/confect/apps/example/confect/workpool.spec.ts`
- `repos/confect/apps/example/confect/workpool.impl.ts`
- `repos/confect/packages/cli/src/CodegenError.ts`

## Effect Patterns To Prefer

- Use `Effect.gen` for multi-step effectful control flow.
- Use `Schema.TaggedErrorClass` for public typed errors that cross Confect
  boundaries.
- Use `Data.TaggedError` for internal domain errors when schema encoding is not
  required.
- Put provider SDKs behind Effect services or adapter boundaries.
- Keep side effects at the edge: domain/check helpers should stay pure.
- Prefer explicit `Layer` wiring for live/test/fake services.
- In tests, look for existing Effect test style before inventing a local one.

Useful references:

- `repos/effect/packages/effect/test/Effect/error.test.ts`
- `repos/effect/packages/effect/test/Schema/Class/TaggedError.test.ts`
- `repos/effect/packages/effect/test/Layer.test.ts`
- `repos/effect/packages/effect/test/Context.test.ts`
- `repos/effect/packages/effect/src/Schema.ts`

## Template-Specific Rule

Every Maestro-to-template backend port is a translation:

- Plain Convex validators become Effect schemas.
- Plain Convex functions become Confect specs and impls.
- Thrown `ConvexError`s become typed Effect/Confect errors.
- Provider calls move behind Effect services.
- Business-specific Maestro logic is dropped or renamed into generic template
  primitives.
