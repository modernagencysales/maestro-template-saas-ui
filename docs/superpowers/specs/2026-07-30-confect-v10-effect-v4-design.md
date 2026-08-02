# Confect v10 and Effect v4 Migration Design

## Context

The template hardening work landed on `main` as commit
`aa24b49f83a510da999c73597bb6ee4b7e444314`. This migration starts from that
exact merged head and upgrades the factory from Confect 9.1.5 and Effect 3.21.4
to the newer, mutually tested prerelease pair requested for the product launch:

- every `@confect/*` package at `10.0.0-next.9`;
- `effect`, `@effect/platform-node`, and `@effect/vitest` at `4.0.0-beta.102`.

`@confect/cli` itself depends on `@effect/platform-node`, so platform-node is
part of the resolved compatibility cohort even though Maestro application code
does not currently import its APIs. The published beta.102 platform-node
metadata also declares `ioredis@^5.7.0` as a non-optional peer; the migration
must satisfy that peer explicitly instead of accepting a hidden install warning.

Confect next.9 declares Effect beta.102 as its peer line. The exact upstream
tagged sources are Effect commit `de2a9a69099993087e57c64df58537c765ac0224`
(`effect@4.0.0-beta.102`) and Confect commit
`ba0fb82222d487bdf62fde2c429e92628f8a0585` (`@confect/*@10.0.0-next.9`). The
current `repos/effect` and `repos/confect` research trees predate those APIs, so
leaving them untouched would teach humans and agents the wrong migration
patterns.

This is a coordinated compatibility migration, not a package-only update. Effect
v4 consolidates former `@effect/platform` and `@effect/cluster` modules into
`effect` and changes core APIs including `Either`/`Result`, Schema, test
imports, services, error handling, and some Layer combinators. The factory has
51 source files importing `effect/Either`, 192 importing `effect/Schema`, and 64
files with immediately identifiable tagged-error or multi-literal Schema forms.
It also has 35 authored `Schema.decodeUnknownEither` calls, 26 Context tag uses,
and a manifest tool built around the removed `JSONSchema.make` API. Confect
codegen, generated artifacts, factory generators, customer seed sources, quality
gates, and operating documentation all encode the v3/v9 contract and must move
together.

## Goals

- Pin one exact, peer-compatible Confect v10 / Effect v4 package set throughout
  the workspace.
- Remove v3-only companion packages and migrate their module responsibilities to
  Effect v4's package layout.
- Translate application, test, generator, and proof code to the v4 APIs without
  weakening typed errors, schemas, service boundaries, or runtime behavior.
- Regenerate Confect and Convex artifacts only through their canonical tools.
- Refresh the vendored read-only upstream references to the exact tags used by
  the application.
- Preserve Maestro's intentional Confect codegen exceptions for Convex component
  roots and compatibility modules with an explicit, tested patch.
- Keep factory checks, customer materialization, docs, and release metadata
  truthful about the new compatibility line.
- Demonstrate that a newly materialized, untouched customer target works with
  the upgraded toolchain.
- Carry the validated factory into the next immutable prerelease,
  `v0.2.0-alpha.3` (`maestro-template-v0.2.0-alpha.3`), so the user-facing
  `maestro create` path actually selects v10/v4 rather than the currently pinned
  alpha.2 artifact.

## Non-goals

- Adopt unrelated Effect v4 unstable modules merely because they are now
  available.
- Redesign the workflow engine, error model, provider integrations, or web
  product behavior.
- Import runtime code from `repos/effect` or `repos/confect`.
- Manually repair files owned by Confect codegen, Convex codegen, or Maestro
  generators.
- Rewrite the already sealed `v0.2.0-alpha.2` release snapshot. It remains
  immutable evidence of the v9/v3 release. Alpha.3, rather than an in-place
  reseal, carries this migration after exact-head validation.
- Publish or move a Git tag from an unmerged branch. Tag publication and the
  final materializable checksum happen only from the exact merged release head.
- Start a broad local `just verify`, `pnpm verify`, full Vitest run, or another
  full host-test-slot command while release-critical Blueprint and Convex gates
  have priority.

## Scope Guard

The migration may change package manifests and the lockfile; Effect/Confect
application code and tests; Confect's package patch; generated backend output;
factory generators and seed sources; compatibility checks, proofs, and gate
names; vendored upstream research subtrees; and directly related documentation.
It may not refactor unrelated product surfaces, change customer-visible feature
semantics, cancel active host or Fabro work, or take ownership of another
session's test slot.

## Approaches Considered

### 1. Coordinated atomic migration — selected

Upgrade the exact package family together, translate the workspace in focused
compiler- and behavior-tested slices, then regenerate and validate the factory
and a fresh customer target. This is the only approach that keeps pnpm peer
resolution, generated contracts, application types, and documentation aligned.
It produces a larger PR, but every intermediate commit can still be a coherent
review slice.

### 2. Dual v3/v4 compatibility bridge

Keep Effect v3 for application code while running Confect v10 against Effect v4,
or add local wrappers that imitate v3 APIs. This would install two incompatible
Effect runtimes across shared schemas and services, undermine Confect's peer
contract, and create values that look structurally similar but are not runtime
compatible. It is rejected.

### 3. Backend-only upgrade

Upgrade `packages/convex` first and leave the CLI, web app, shared packages,
generators, and proofs on v3/v9. Shared schema types and generated refs cross
those boundaries, so this would either fail peer/type checks or require a
temporary compatibility layer with no durable value. It is rejected.

The user approved the coordinated approach and the exact newer Confect/Effect
pair.

## Target Compatibility Matrix

| Package family                                          | Target           | Decision                                                                                                                                                                    |
| ------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@confect/core`, `server`, `test`, `cli`, `react`, `js` | `10.0.0-next.9`  | Exact-pin the whole family; mixed Confect versions fail the compatibility gate.                                                                                             |
| `effect`                                                | `4.0.0-beta.102` | Exact-pin everywhere; do not allow a second Effect runtime.                                                                                                                 |
| `@effect/platform-node`                                 | `4.0.0-beta.102` | Keep one explicit exact pin in the Convex tooling/backend importer to constrain `@confect/cli` and satisfy the optional server peer; remove the unused direct app-CLI pin.  |
| `@effect/vitest`                                        | `4.0.0-beta.102` | Match the Effect runtime exactly.                                                                                                                                           |
| `@effect/platform`                                      | removed          | No beta.102 package exists; stable `0.x` releases require Effect v3. Its functionality now lives in `effect` and `effect/unstable/*`.                                       |
| `@effect/cluster`                                       | removed          | No beta.102 package exists; cluster modules now live under `effect/unstable/cluster`. The repository has no direct cluster imports, so no replacement dependency is needed. |
| `@effect/language-service`                              | `0.87.1`         | Exact-pin the latest observed plugin instead of the current `^0.86.3`, then verify diagnostics under the repository TypeScript version. It has no Effect peer dependency.   |
| `ioredis`                                               | `5.11.1`         | Add at the `@confect/cli` tooling/backend importer to satisfy platform-node beta.102's non-optional `^5.7.0` peer. Maestro does not adopt Redis runtime behavior.           |

The lockfile must contain no Effect 3 runtime introduced by an application
workspace package. If an unrelated third-party tool retains an internal v3
dependency, the dependency gate must identify and review it rather than hide it
with pnpm overrides.

The existing companions already fit next.9's published peers and are not
upgraded merely for this migration: `convex@1.42.1` satisfies `^1.32.0`,
`convex-test@0.0.54` satisfies `>=0.0.50 <0.1.0`, React 19.1 satisfies the
Confect React peer, and Vitest 3 satisfies `@effect/vitest`'s `^3.0.0 || ^4.0.0`
peer. `@confect/cli@10.0.0-next.9` requires Node 22 or newer, which matches the
repository's supported Node 22 line.

## Repository Impact Map

The implementation plan must account for these current-source surfaces and keep
historical release snapshots separate:

| Surface                         | Current locations and responsibility                                                                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package and lock metadata       | Root `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `knip.json`, `packages/convex`, `apps/cli`, `apps/web`, `packages/editor-core`, `packages/integrations`, `packages/template-core`, `tooling/confect-manifest`, and `tooling/effectified-api-proof`. |
| Effect domain and Schema code   | Shared packages plus `packages/convex/confect`, `packages/convex/test`, generated-source templates, and example seed source. Domain Either→Result and parser Either→Exit are reviewed separately.                                                                 |
| Confect source and output       | User-authored tables/specs/impls, `@confect/test` support, Confect `_generated`, generated Convex function modules, the CLI patch, and the component-root preservation test.                                                                                      |
| Quality and proofs              | `check-confect-v9.*`, `check-confect-compat`, check definitions, Effect diagnostics, Confect contracts/manifest, the `confect-v9-proof` entrypoint, package scripts, Just recipes, and generator-projected gate lists.                                            |
| Factory and customer projection | `tooling/generators`, `examples/saas-application/seed/source`, release ownership/integrity fixtures, factory create/runtime integration tests, and active customer documentation.                                                                                 |
| Local upstream authority        | `repos/effect`, `repos/confect`, the Effect/Confect working guide, and agent pattern notes. These remain factory-only and read-only outside intentional subtree updates.                                                                                          |
| Immutable release history       | `releases/v0.2.0-alpha.2` and historical plans/findings retain their v9/v3 facts. New rollout artifacts are created as a new release rather than rewritten in place.                                                                                              |

Renames must follow imports and registrations, not just filenames. For example,
the v9 proof filename, root script, quality definition, generated gate lists,
rule-coverage text, and customer-runtime allowlist must all move to the same
version-neutral compatibility name.

## Upstream Reference Sources

Update the two squashed, read-only subtrees using their exact tagged refs, not
the moving `main` branches:

- `repos/effect` from `https://github.com/Effect-TS/effect.git` at
  `effect@4.0.0-beta.102`, peeled commit
  `de2a9a69099993087e57c64df58537c765ac0224`;
- `repos/confect` from `https://github.com/rjdellecese/confect.git` at
  `@confect/core@10.0.0-next.9`, peeled commit
  `ba0fb82222d487bdf62fde2c429e92628f8a0585` (the next.9 package tags share this
  source commit).

Record the refs in the working guide and compatibility data. Preserve the
existing rules: these directories are factory-only reference material, excluded
from workspace discovery and generated customer targets, and never imported by
application code. Update the subtree before translating APIs so all migration
work can cite the exact local source, migration guide, tests, and Confect
changelogs that match the installed packages.

## Migration Architecture

### Dependency and compatibility boundary

One compatibility gate replaces the v9-specific package check. It owns the exact
Confect family pin, the Effect beta pin, the matching platform-node and vitest
pins, the ioredis peer, removal of v3-only platform/cluster packages,
direct-import rules, and the absence of mixed runtime versions. Any resolved
Effect v4 cohort package such as `@effect/platform-node-shared` must also be
beta.102; the language service is a separately versioned compiler plugin. Rename
`check:confect-v9` and its implementation/tests to a version-neutral name such
as `check:confect-effect-compat`; do not leave a v10 implementation behind a v9
command label.

Update package metadata in every current dependency location, including the
Convex backend, CLI, web app, shared packages, proof tools, workspace patch
mapping, compatibility JSON, quality definitions, agent-pack fixtures, and
customer projection assertions. Remove obsolete platform/cluster entries from
`knip.json` and dependency allowlists. Historical design plans and sealed
release fixtures may remain historical; active guides, checks, manifests,
generated instructions, and machine-readable compatibility data must describe
v10/v4.

### Effect core translation

Follow Effect's beta.102 migration map and exact tagged source rather than
performing blind text substitution:

- Domain-level `effect/Either` becomes `effect/Result`; `right`/`left` become
  `succeed`/`fail`, guards become `isSuccess`/`isFailure`, and narrowed payload
  fields become `.success`/`.failure` while preserving existing domain behavior.
  This rule does not apply to Schema parser APIs.
- Schema parsing uses `Exit`, not `Result`: `Schema.decodeUnknownEither` becomes
  `Schema.decodeUnknownExit`, and the corresponding decode/encode APIs become
  `decodeExit`/`encodeUnknownExit`/`encodeExit`. Translate their call sites and
  error formatting against v4 `SchemaError`/`SchemaIssue` rather than wrapping
  parser exits as domain Results.
- `effect/TestClock` moves to `effect/testing/TestClock`. The v3
  `effect/TestContext` aggregate has no v4 export; the existing clock test must
  provide `TestClock.layer()` directly. Other test helpers follow the exact
  beta.102 export map.
- `effect/JSONSchema` becomes `effect/JsonSchema`, but the old
  `JSONSchema.make(schema, { target })` API does not survive as a rename. The
  contract-manifest tool must use `Schema.toJsonSchemaDocument` and the v4
  `JsonSchema` document conversion APIs, with golden tests proving that its
  OpenAPI 3.1 and JSON Schema 2020-12 public output shapes remain stable.
- multi-member `Schema.Literal(...)` becomes `Schema.Literals([...])`;
  `Schema.Union(a, b)` becomes `Schema.Union([a, b])`; `Schema.TaggedError`
  becomes `Schema.TaggedErrorClass`; exact optional keys, filters/checks, URL
  codecs, Option codecs, and transforms adopt their v4 equivalents.
- `Context.Tag`/`GenericTag` services migrate to `Context.Service`; renamed
  catches, forks, Layers, flattened Cause structures, and other compiler
  failures follow the upstream focused migration guides. Existing service
  boundaries remain intact rather than being flattened to make types pass.
- schemas crossing Convex or JSON boundaries must have a serializable encoded
  form. In particular, use `Schema.OptionFromNullOr(...)` rather than v4
  `Schema.Option` when an Option is part of a Confect contract.
- client decode failures and Confect React mutation/action handles use v4
  `SchemaError` and `Result` semantics. UI behavior must continue to distinguish
  loading, empty, success, and typed failure states.

Translate reusable shared schemas and workflow semantic primitives before their
backend consumers. Compile and run focused behavior tests after each bounded
area so a mechanical rename cannot invert success/failure meaning or alter an
encoded contract unnoticed.

### Confect authoring and codegen boundary

Confect next.9 retains the v9 filesystem-driven table/spec/impl authoring model
already used by the repository, but consumes Effect v4 schemas and Results.
Migrate user-authored files under `packages/convex/confect`, including table
schemas, function specs, implementations, services, and test support, before
running Confect codegen. Keep lazy schema thunks, lazy table construction,
`databaseSchema` injection, per-group registries, and `GroupImpl.finalize`.

Run canonical Confect codegen only after the authored graph can load under v4.
Then run canonical Convex codegen when a live deployment connection is available
through the established gate. Generated output is reviewed as output, never as
the place to implement fixes. A codegen failure is repaired in the authored
source, generator, dependency set, or patch and then regenerated.

### Maestro generator and customer boundary

The factory has TypeScript generators that emit Effect/Confect source plus an
example customer seed. Update generator templates and their assertions before
refreshing their outputs. The migration must cover:

- factory-owned backend, CLI, shared-package, and web sources;
- generator source strings and workflow-file templates;
- `examples/saas-application/seed/source`;
- blueprint registration projections and quality/gate descriptors;
- package manifests and compatibility docs included in a generated target.

Materialize a new customer workspace into an isolated temporary directory from
the candidate factory composition. Do not copy fixes into that target by hand.
The untouched target must install the same exact pair, contain no unresolved v3
packages or current v9 gate names, pass its focused offline checks, and produce
stable Confect output. Live Convex generation is performed only through the
canonical connected gate when the release-critical host lane permits it.

The existing public `maestro create` composition is intentionally pinned to the
sealed `v0.2.0-alpha.2` manifest, so it cannot prove this candidate before a new
release exists. Candidate acceptance must exercise the same composition and
materialization implementation with an injected candidate manifest/source root;
it must not pretend the alpha.2-backed command emitted v10/v4.

### Release and rollout boundary

Canonical source migration and customer rollout are two exact-head phases of one
delivery:

1. The migration PR validates canonical source and an untouched candidate
   materialization without changing alpha.2.
2. After the migration merges and exact-head gates pass, the established release
   process seals `v0.2.0-alpha.3` from that merged source, records its
   tag/archive checksums, and makes its customer manifest materializable.
3. The release-owned factory composition, quickstart, and default create path
   advance from alpha.2 to that new immutable manifest through reviewed release
   changes.
4. A final `maestro create` acceptance run from the published tag proves the
   user-facing path emits v10/v4 without post-generation edits.

The migration is code-complete at the first phase but is not customer-rollout
complete until the tagged create-path acceptance passes. If publishing is
deliberately deferred, the handoff must say that `maestro create` still selects
alpha.2 rather than claiming customers already receive the upgrade.

### Confect CLI patch

The current `@confect/cli@9.1.5` patch intentionally does three things:

1. excludes `workflows/subworkflowLinksCurrent.spec.ts` from Confect leaf
   discovery;
2. preserves Maestro/Convex-owned component and compatibility modules when
   Confect removes extinct generated groups;
3. wraps long generated registration declarations to satisfy repository
   formatting.

Those concerns remain present in the exact next.9 source: leaf discovery still
loads every discovered `*.spec.ts`, filesystem reconciliation still treats
non-reserved `convex/**/*.ts` files as managed group modules, and the generated
registration declaration is still emitted on one line. Remove the 9.1.5 patch
mapping and file, generate a new patch against `@confect/cli@10.0.0-next.9`, and
port each behavior onto the new source positions. The patch is accepted only
with focused tests that prove component roots and compatibility modules survive
codegen, excluded specs are not registered twice, and generated files format
cleanly. If implementation can remove an exception by eliminating the underlying
legacy module without changing runtime or compatibility behavior, that smaller
result is preferred, but no exception is dropped solely because the old patch no
longer applies.

## Data Flow

1. Exact package metadata and vendored tags establish one local API authority.
2. Compatibility tests fail on the old dependency and gate vocabulary.
3. Shared Effect schemas, Results, services, and tests migrate in focused
   slices.
4. Confect-authored tables/specs/impls migrate against those shared contracts.
5. The refreshed CLI patch protects Maestro-owned modules while Confect codegen
   regenerates its owned tree.
6. Convex codegen refreshes its owned API artifacts through the live connected
   path when available.
7. Factory generators reproduce the same v4/v10 sources in an untouched customer
   target.
8. Compatibility, behavior, generator-drift, and customer-integrity checks
   validate the result before broad PR CI.
9. The exact merged source is sealed as `v0.2.0-alpha.3`, and the published-tag
   create path repeats untouched-customer acceptance.

## Implementation Order

1. Add failing compatibility tests for the exact package set, removed packages,
   renamed gate, and current docs/metadata.
2. Refresh the vendored upstream subtrees and working-guide tag records.
3. Update manifests, the language service, ioredis peer, patch mapping, and
   lockfile using the supported Node 22 line; on this host use 22.23.2 rather
   than the default Node 26. Inspect pnpm peer output before source translation.
4. Migrate shared non-Convex packages and Effect proof tooling in small
   compiler/behavior slices.
5. Migrate workflow domain primitives from Either to Result, Schema parsers to
   Exit, and Schema forms to their v4 equivalents, preserving encoded values and
   domain failure semantics.
6. Migrate Confect tables, specs, impls, React/JS consumers, and Confect test
   harnesses.
7. Rebase the CLI patch and prove its preservation and formatting behavior.
8. Run Confect codegen, review generated changes, and repair only their sources.
9. Update generator sources, seed sources, compatibility gates, quality
   definitions, active docs, and customer projections; regenerate owned outputs.
10. Materialize and test an untouched candidate customer target through an
    injected candidate composition.
11. Run connected Convex generation and broader exact-head PR gates only when
    their established CI/host lane is available.
12. After merge, use the established release process to seal `v0.2.0-alpha.3`,
    advance the default factory composition, and repeat untouched customer
    acceptance from the published tag.

This order deliberately makes generation a consequence of valid authored code,
not a source of hand-edited migration changes.

## Error Handling and Rollback

- Treat pnpm peer conflicts, duplicate Effect runtimes, missing beta packages,
  and codegen load failures as migration blockers with their exact package or
  file reported. Do not suppress them with broad overrides or casts, and do not
  rely on the repository's existing `skipLibCheck` setting to excuse application
  or generated declaration errors.
- Keep exact prerelease pins. A newer beta discovered during implementation does
  not replace beta.102 without a new compatibility decision and peer check.
- When a Result translation changes a branch shape, add or update a focused
  behavior test before changing the implementation. Never infer that
  `left/right` and `failure/success` fields are interchangeable.
- When encoded schema output changes, either preserve the prior wire shape or
  document and test an intentional migration. Existing persisted Convex data
  must remain decodable.
- If Confect codegen deletes a Maestro-owned file, stop, restore it from git,
  correct the patch or source ownership rule, and rerun codegen. Do not
  hand-copy it back as the final fix.
- Use bounded commits for dependency/source references, core API slices,
  Confect/codegen, generators/customer output, and docs/gates. A failed slice
  can be reverted without discarding the already merged hardening work.
- Provider 402/429 failures and unavailable live Convex connections are external
  blockers. Record the exact deferred connected gate and continue with safe
  focused offline work; do not relaunch identical broad runs.

## Generated-File Policy

Files under Confect `_generated`, Convex `_generated`, generated `convex/`
registries, route trees, release projections, and materialized customer targets
are owned by their canonical generators. Implementation changes their authored
inputs or generator source, invokes the repository command under the supported
Node 22 line, and commits the deterministic output. Manual edits to make
generated files compile are prohibited. Generator drift checks must end clean
for factory sources and the untouched customer fixture.

The sealed `releases/v0.2.0-alpha.2` directory remains historical. Acceptance
materializes a candidate target in a temporary directory rather than silently
mutating an already published artifact. The alpha.3 release directory, manifest,
archive, and composition binding are produced only by the established release
tooling after merge; they are not hand-authored migration output.

## Test Plan

All local commands use the supported Node 22 line. The repository's CI reads
`.nvmrc` (`22.12.0`), while this host may use its compatible 22.23.2 install;
the host default Node 26 is not used. No broad/full local command is started as
part of the migration while the Blueprint/Convex launch lane has priority.
Focused commands acquire `host-test-slot --class focused`; dependency metadata,
read-only searches, formatting of named files, and other non-test inspection do
not claim the full slot.

- Compatibility unit tests reject mixed Confect versions, any Effect runtime
  other than beta.102, v3-only `@effect/platform`/`@effect/cluster`, mismatched
  platform-node/platform-node-shared/vitest, an unsatisfied ioredis peer, stale
  current patch mappings, and current v9 gate names. Historical plans and sealed
  release fixtures are explicitly outside that vocabulary scan.
- Package-focused TypeScript checks cover editor-core, template-core,
  integrations, CLI, web, manifest/proof tools, and Convex in migration order.
- Result tests cover domain success and failure branches, narrowing, thrown
  conversion points, persisted workflow decisions, retries, deadlines, and graph
  validation. Separate parser tests cover Exit success/failure and Schema error
  formatting so domain Result and parser Exit cannot be conflated.
- Schema tests cover literal unions, general unions, tagged errors, optional
  keys, checks, URL and Option codecs, transformations, JSON Schema generation,
  and decoding of representative existing persisted values. Golden manifest
  fixtures compare the v3 and v4 OpenAPI 3.1 / JSON Schema 2020-12 output shape.
- Effect service tests cover fake/live Layer substitution, Config defaults and
  empty-string behavior, clocks, Cause/Exit inspection, and Node runtime wiring.
- Confect contract tests cover query, mutation, action, typed error, React/JS
  reference, and `@confect/test` behavior under v4.
- CLI patch tests run codegen fixtures with Convex components,
  `deadlinesCurrent`, and `subworkflowLinksCurrent`; they assert preservation,
  no duplicate registration, and formatted generated declarations.
- Generator tests compare factory templates, seed sources, package metadata,
  compatibility data, and projected gate lists, then assert no newly generated
  drift.
- Candidate customer acceptance materializes a clean target without
  post-generation edits through the injected candidate composition, installs
  from its lockfile, runs focused offline compatibility and contract checks, and
  confirms no application import resolves through `repos/*`.
- Release acceptance repeats creation through the public `maestro create` path
  from the published next-prerelease tag and asserts the resulting instance and
  lockfile identify that release and the exact v10/v4 cohort.
- Broad repository verification, connected Convex codegen, build, and launch
  gates run through exact-head PR CI or the release-critical controlled lane;
  they are not duplicated locally with `just verify`. In particular,
  `check:generators` includes live `convex codegen`; it is not used as an
  offline focused substitute or placed in a generic Fabro preflight.

## Quality Targets and Acceptance

- Every application workspace resolves the exact Confect next.9 / Effect
  beta.102 pair with no peer warning attributable to the migration, including
  platform-node's ioredis peer.
- `@effect/platform` and `@effect/cluster` are absent from active application
  manifests and the lockfile unless a reviewed third-party transitive requires
  them; no application code imports them.
- All direct Effect imports resolve through beta.102's published export map.
- Persisted schemas and public function contracts retain their encoded wire
  shapes unless a separately documented migration test proves an intentional
  change.
- Confect and Convex generated trees are deterministic and contain no manual
  repair.
- Maestro-owned Convex component and compatibility modules survive repeated
  Confect codegen runs.
- Factory generators emit v10/v4 code and metadata; untouched candidate and
  published-tag customer targets pass their focused acceptance suites.
- Active docs, compatibility JSON, quality definitions, agent-pack fixtures, and
  command names contain no claim that v9/v3 is the current contract.
- Vendored research trees match the exact installed upstream tags and remain
  read-only, factory-only references.
- Exact-head PR gates pass before merge, with no redundant broad local host-slot
  command competing with release-critical work.
- The sealed alpha.2 remains byte-stable, and after rollout the default
  `maestro create` composition names the new immutable prerelease rather than
  silently continuing to emit alpha.2/v9/v3.

## Documentation Updates

Update `docs/template/confect-effect-guide.md`, compatibility data, workflow
compatibility, effectification status, rule coverage, the vendored-source
working guide, repository maps, active agent guidance, and generated customer
instructions. Describe Effect v4's stable versus `unstable/*` import boundary,
Result terminology, Schema examples, the matching prerelease matrix, offline
Confect codegen versus connected Convex codegen, and the fact that customer
targets omit `repos/*`.

Before alpha.3 is published, active factory docs label v10/v4 as the candidate
source contract and state that the default create path still resolves alpha.2.
The release change advances the quickstart, compatibility statement, and create
composition together; documentation must never claim alpha.3 is available before
its exact tag and materializable checksum exist.

Historical plans and review findings remain historical evidence and need not be
rewritten to pretend they were authored against v4. Any active check or guide
that links to their v3 examples must instead point at a current v4 pattern or
the exact vendored beta.102 source.
