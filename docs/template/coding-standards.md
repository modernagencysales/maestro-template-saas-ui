# Coding Standards

## TypeScript

- No `any`.
- No `as unknown as`.
- No non-null assertions.
- No `@ts-ignore`.
- Prefer narrow interfaces and explicit return types at public boundaries.
- Use Effect schemas for durable data, public args, returns, and typed errors.

### Multi-table Convex writes

confect types `writer.table(name).insert(value)` against a **concrete** table
literal, so the object literal is checked field-by-field against that table's
schema — our first defense against drift between planner rows and the Convex
schema. A helper generic over `<T extends TableNames>` cannot preserve that
check: TypeScript can't prove the value matches `DocumentByName<…, T>` for an
abstract `T`, so it only compiles behind an `as` assertion.

Rule: when a DRY abstraction across two Convex tables would require a cast or
`any`, keep the per-table writes inline. The parallel structure is the price of
the concrete insert check and is worth more than removing the duplication. This
is a deliberate, blessed exception to the duplication gate — not tech debt.
`ensureProvisioned` (`packages/convex/confect/access/provisioning.impl.ts`) is
the canonical example. Transaction scripts like it are also exempt from
step-wise single-responsibility splitting: their one responsibility is the
atomic transaction.

## Tenancy And Auth

- Never trust caller-supplied tenant identity.
- Derive workspace scope from authenticated identity and membership.
- Support and admin actions must be narrow, audited capabilities.

## Providers

- No raw provider imports outside adapter packages or explicit runtime boundary
  files.
- No bare `process.env`, `import.meta.env`, or `Deno.env` in product code
  outside the approved config boundary files.
- No product runtime `console.*`; route operator-visible output through CLI
  output seams and product telemetry through typed redacted observability seams.
- Use typed config decoders.
- Redact secrets, tokens, webhook bodies, raw provider payloads, and stack
  traces before crossing public boundaries.

## Tests

- Source-text-only tests are not behavior proof.
- New behavior gets focused tests before implementation.
- Capability tests cover auth first, role denial, cross-workspace denial,
  invalid input, typed error, idempotency, and side-effect ordering.
- Frontend adapter tests cover loading, empty, ready, mutation success, typed
  failure, skipped query, and transport failure states.

## UI

- Do not handroll primitives covered by Saas UI or the template UI package.
- Blocks are reusable and provider-free.
- Feature components adapt data; blocks render data.

## Capabilities, Workflows, Agents

- Capabilities authenticate, validate, delegate, and return.
- Workflows compose capabilities and do not call adapters directly.
- Agents call capabilities or workflow kickoffs through explicit tool grants.

## Versioning

- Never mutate historical version rows.
- Restore creates a new version with `causation: "restore"` and a
  `restoredFromVersionKey`.
- Freshness belongs in mutable freshness records, not immutable version history.
- Reconcile is idempotent by workspace, entity key, external version, and
  idempotency key.

## Generated Files

Generated files are never edited directly. Regenerate through the package
script, verify the diff, and commit generated output only when the task requires
it.
