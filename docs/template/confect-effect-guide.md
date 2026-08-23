# Confect And Effect Guide

The template uses Confect to integrate Effect schemas and services with Convex.
The goal is end-to-end typed contracts without losing Convex component support.

## Version Policy

- Pin all `@confect/*` packages to one released version.
- Pin `effect` and companion `@effect/*` packages to a tested compatible set.
- Do not install fallback placeholder versions. Resolve package metadata first,
  then record the exact compatibility pair in this guide.
- Treat beta/next cohorts as release candidates until focused local gates and
  exact-head CI both verify the pinned set.
- Record version changes in this guide and in the lockfile diff.

## Compatibility Matrix

| Surface        | Package(s)                                                                                   | Version                                         | Evidence                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confect server | `@confect/core`, `@confect/server`, `@confect/cli`, `@confect/test`                          | `10.0.0-next.9`                                 | Package metadata requires Effect `^4.0.0-beta.102`, Convex `^1.32.0`, and optional `@effect/platform-node` `^4.0.0-beta.102`.                             |
| Confect client | `@confect/react`, `@confect/js`                                                              | `10.0.0-next.9`                                 | Package metadata requires Effect `^4.0.0-beta.102`, Convex `^1.32.0`, and React `^18` or `^19` for React hooks.                                           |
| Effect runtime | `effect`, `@effect/platform-node`, `@effect/vitest`                                          | `4.0.0-beta.102`                                | All active Effect companions share the exact beta.102 pin; direct `@effect/platform` and `@effect/cluster` dependencies are absent.                       |
| Tooling        | `@effect/language-service`, `ioredis`                                                        | `0.87.1`, `5.11.1`                              | The language service is exact-pinned; `ioredis` satisfies the platform-node peer beside the backend CLI importer.                                         |
| Convex         | `convex`, `convex-test`                                                                      | `1.42.1`, `0.0.54`                              | Satisfies Confect peers and `@confect/test`'s `convex-test >=0.0.50 <0.1.0` peer.                                                                         |
| Agent runtime  | `@convex-dev/agent`, `ai`, `@ai-sdk/provider`, `@ai-sdk/openai-compatible`, `convex-helpers` | `0.7.1`, `7.0.77`, `4.0.7`, `3.0.35`, `0.1.120` | Component-owned durable threads and messages; fake/test use the packaged deterministic model and live mode fails closed without OpenRouter configuration. |

## Editor Substrate Pins

The editor substrate is exact-pinned to `@blocknote/core@0.51.4`,
`@blocknote/react@0.51.4`, `@convex-dev/prosemirror-sync@0.2.5`,
`@tiptap/core@3.27.1`, `@tiptap/pm@3.27.1`, and
`decode-named-character-reference@1.3.0`.

Before editing manifests for editor dependency bumps, recheck live npm metadata.
Pin the BlockNote and Tiptap families together so ProseMirror schema and
extension expectations move as one tested set. After any bump, run the
ProseMirror schema drift test. The backend transform schema must be derived from
a guarded headless `BlockNoteEditor.create().pmSchema` path rather than from
duplicated hand-written ProseMirror schema assumptions.

## File Model

- Tables: `packages/convex/confect/tables/*`
- Specs: `packages/convex/confect/**/<group>.spec.ts`
- Impls: `packages/convex/confect/**/<group>.impl.ts`
- Plain Convex interop: colocated `.ts`, `.spec.ts`, and `.impl.ts`
- Special entrypoints: `confect/auth.ts`, `confect/crons.ts`, `confect/http.ts`

`packages/convex/confect/http.ts` owns the current API surface. It serves the
generated OpenAPI document at `/api/openapi.json`, the Scalar shell at
`/api/docs`, and executable `POST /api/<operation>` handlers from the generated
Confect manifest. The generated refs are the client/server contract boundary:
web, API, CLI, and MCP surfaces may project metadata, but business execution
must dispatch through explicit generated ref mappings instead of duplicating
operation logic.

## Convex Component Interop

- Plain Convex functions required by Convex components must live beside their
  Confect spec and impl files.
- Specs must import plain Convex functions with `import type`; impls pass the
  real function values to `FunctionImpl.make`.
- Local template typechecks may use narrow component-reference shims when Convex
  deployment codegen has not been provisioned yet. Provisioned apps must run
  `convex dev` or `convex codegen` and prefer generated `components` refs.
- `check:confect-contracts` must fail if a spec runtime-imports plain Convex
  functions or if generated Confect wrappers are stale.

## Function Rules

- Args, returns, and expected errors use Effect schemas.
- No useful return means `Schema.Null`.
- Public expected failures are `Schema.TaggedErrorClass` values and flow through
  the Effect error channel.
- Unexpected defects may die; they must not serialize private data.
- Public-safe errors are separate from internal provider/config errors. Provider
  payloads, secret names, secret values, and stack traces are redacted before
  crossing public Confect boundaries.
- Queries are read-only and deterministic. Mutations perform transactional
  writes. Actions and scheduled functions own external provider side effects.
- Specs use type-only imports for plain Convex function values with
  `import type`.
- Impls end with `GroupImpl.finalize`.
- Confect schemas must have Convex-serializable encoded values and no schema
  context. Cover Dates, branded ids, unions, nullable fields, transforms, and
  arrays with compile-time and runtime schema tests.

## PostHog Failure Capture

Confect mutation and action implementations that own meaningful write or side
effect paths can add backend failure telemetry around their Effect program:

```ts
withMutationErrorCapture("brain/pages.createMarkdown", effect);
withActionErrorCapture("group/functionName", effect);
```

The first argument is the stable Confect function path. The wrapper reads the
Confect `MutationCtx` or `ActionCtx`, converts the Effect `Cause` into a
redacted event with `functionPath`, `kind`, public error tag, redacted message,
and cause hash, then attempts PostHog capture through the Convex component.
Capture is best-effort: if PostHog capture fails, the wrapper preserves and
re-fails the original cause.

There is no `withQueryErrorCapture` helper in this slice. Query contexts do not
expose the scheduler required by the PostHog Convex component, so query failure
telemetry needs a separate future durable event path.

## Client Rules

- Web uses `@confect/react` generated refs.
- CLI and MCP use `@confect/js` generated refs.
- HTTP APIs call generated Confect refs through the manifest executor rather
  than duplicating business logic.
- React adapters distinguish loading, empty, ready, skipped, typed failure,
  parse failure, transport failure, and defects.
- Feature surfaces use shared Confect React adapters rather than hand-rolled raw
  hook handling.
- Type assertions prove refs infer args, returns, typed failures, `QueryResult`,
  domain `Result`, parser `Exit`, and JS-client error channels.

## Testing

Use `@confect/test` for contract tests that exercise generated refs, auth
identity, typed errors, HTTP routes, scheduled functions, storage, Node actions,
and plain Convex interop in provisioned apps with Convex `_generated` codegen.
The private template also keeps lightweight contract tests under
`packages/convex/test` for generated ref metadata, Effect schema validation,
public-safe typed errors, HTTP routes, and plain Convex registration shape
without requiring a live Convex deployment.

Run `check:confect-effect-compat` after every Confect contract change for exact
cohort and authored-source checks. The separate matrix-backed
`check:confect-compat` covers codegen, generated-file diffs, `@confect/test`,
HTTP/Scalar fetch, React type fixtures, and JavaScript client type fixtures.

`pnpm check:convex` snapshots the two generated roots, runs offline Confect
codegen, and fails only when that invocation changes generated bytes. An
already-reviewed uncommitted generated diff is allowed when codegen leaves it
byte-identical. Use `pnpm check:generated-files` separately for the committed
baseline release check.

Live Convex deployment generation is a different operation and requires an
explicit reviewed environment. Do not run `convex dev` from fake mode.

## Generated Contract Manifest

For migrated/spec-bound operations, the generated Confect spec tree is the
source of truth for API, CLI, MCP, OpenAPI, Scalar, workflow, and web-facing
operation metadata. Current manifest coverage is seeded from operations that
have moved onto spec-bound builders, such as `brain/pages` and
`capabilities/sourceGroundedBrief`; not every Confect spec file emits manifest
metadata yet. Manifest metadata comes from spec-bound builder helpers such as
capability and workflow contract builders, is regenerated with
`pnpm confect:manifest`, and is parity-checked against generated refs by the
contract and headless-surface gates.

Target rules:

- Every public headless operation declares a typed public error schema.
- Every headless operation declares allowed surfaces explicitly.
- Public surfaces default to denied exposure: the builder default is an empty
  external surface set unless a spec opts in.
- Writes exposed over API, CLI, or MCP require an idempotency key argument.
- Tenant identity is server-derived through a Principal and workspace access
  resolver, never trusted from caller-supplied workspace slug alone.
- OpenAPI and MCP JSON schemas are generated from the spec-bound Effect schema
  registry with `effect/JsonSchema`; the generated manifest serializes schema
  names and JSON schema objects, not live Effect schema handles.
- Public error envelopes encode only the declared public `_tag` and redacted
  fields.

## Confect 10 Candidate Baseline

The canonical source uses the exact Confect 10 next.9 / Effect 4 beta.102
candidate cohort. It preserves per-group generated Convex modules so a function
imports only its own group registry at cold start instead of a project-wide
aggregate. Public defaults remain independently controlled by the release
process.

Required invariants:

- All `@confect/*` packages remain exactly `10.0.0-next.9`.
- API groups are filesystem-driven colocated `*.spec.ts` and `*.impl.ts` pairs.
- `GroupSpec.make()` and `GroupSpec.makeNode()` do not take a group-name
  argument; the file path names the group.
- Every table under `packages/convex/confect/tables/*` default-exports
  `Table.make(() => <Confect-compatible Effect schema>)`; the filename is the
  table name. The schema may be an imported constant as long as it is built
  lazily inside the callback.
- Specs import generated table wrappers from `confect/_generated/tables/*` for
  `Doc`, `Fields`, and `tableName`.
- Specs wrap `args`, `returns`, and `error` schemas in `() =>` thunks.
- Impls import `databaseSchema` from `confect/_generated/schema`, pass it to
  `FunctionImpl.make` and `GroupImpl.make`, default-import the sibling spec, and
  end with `GroupImpl.finalize`.
- Root aggregate `confect/spec.ts`, `confect/impl.ts`, `confect/nodeSpec.ts`,
  and `confect/nodeImpl.ts` must not exist.
- Confect source imports Effect submodules such as `effect/Effect`,
  `effect/Schema`, `effect/Layer`, `effect/Clock`, `effect/Result`, and
  `effect/Exit`; it does not import from the `effect` barrel inside
  `packages/convex/confect`.
- `@confect/test` uses generated `confect/_generated/schema` and generated
  `confect/_generated/convexSchema`.

The compatibility gate `pnpm check:confect-effect-compat` enforces the
mechanically checkable subset: exact v10/v4 package alignment, no root aggregate
Confect entrypoints, no `effect` barrel imports under `packages/convex/confect`,
lazy `args`/`returns`/`error` schema thunks in `FunctionSpec` object literals,
generated `databaseSchema` usage plus `GroupImpl.finalize` in impls, and lazy
table default exports without table-name arguments.

## Effectified-Full Primitives

Reusable primitives follow `docs/template/primitive-contract.md`. A primitive is
not considered template-ready when it only has a Confect function. It also needs
the pure domain boundary, typed errors, service boundaries, manifest metadata,
workflow-step eligibility when dispatchable, frontend state when visible, tests,
gates, and docs.
