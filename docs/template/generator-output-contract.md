# Generator Output Contract

Every `template:add-*` and `template:promote-*` command should produce a
reviewable slice, not a loose file. Generated work must preserve the layer law,
fake-first provider posture, Confect/Effect backend contracts, and headless
surface discipline.

## Required Output

For backend or headless behavior, emit or update:

- `template-instance.json` metadata when the command changes app identity,
  intake status, provider posture, release state, upgrade compatibility, or
  private-package posture.
- Confect spec/impl.
- Effect schema.
- shared typed errors imported from the owning Confect errors module.
- behavior tests.
- reviewer-safe fixtures.
- README or generated docs.
- generated manifest/headless metadata and explicit generated ref mappings when
  exposed.
- API, CLI, MCP, and OpenAPI/Scalar metadata when exposed.
- audit metadata.
- data-map metadata.
- env manifest entries when a provider or secret name is introduced.
- migration notes for durable table or index changes.
- canonical system ID and `reuse`/`extend` ownership decision in generated
  provenance.
- reviewer commands.

`template:add-capability` emits flat Confect files under
`packages/convex/confect/capabilities/<name>.*`, including spec, impl, domain,
tests, and optional headless metadata. It does not create a nested
`capabilities/<name>/` source tree.

`template:add-workflow` emits durable graph JSON data, Confect
`start`/`status`/`control` spec, impl, tests, docs, and a plain Convex
`defineWorkflow` durable replay handler. The Confect contract owns public
start/status/control access; the plain Convex handler owns replay.

`template:add-agent` emits the agent spec, impl, tool grants, tests, and docs.
Generated agents default to web-only exposure. API, CLI, or MCP exposure
requires a separate reviewed headless contract change.

For app-factory setup commands such as `template:quickstart` and
`template:intake`, also emit or update:

- generated implementation or intake briefs.
- provider posture notes with fake/test/live labels.
- first workflow, source inventory, approval, and Trust Receipt questions.
- handoff risks and next commands.

For user-facing behavior, also emit or update:

- frontend adapter or view model.
- loading, empty, ready/read, ready/edit, skipped, typed error, transport error,
  and mutation success/failure states where applicable.
- route or navigation metadata.
- screenshots or visual smoke notes when the rendered surface changes.

`template:add-feature` is the production golden path. It requires an exact
`--screen-catalog-id`, emits the Confect capability plus contract and presenter,
then mechanically transplants the selected assembled Starter route. Its
provenance binds the complete upstream import closure, source receipt, shell,
allowed adapter categories, and six required visual states. It has no generic
JSX page fallback and refuses to overwrite existing targets.

## Promotion Rules

- Runtime-authored capabilities and workflows are data until promoted.
- Experiment and private-package code is never a runtime dependency. Promotion
  re-scaffolds through `template:add-*`; production code never imports it.
- Promotion to generated Confect source is the compile-time safety path.
- Capability generators emit flat Confect files:
  `packages/convex/confect/capabilities/<name>.spec.ts`,
  `packages/convex/confect/capabilities/<name>.impl.ts`,
  `packages/convex/confect/capabilities/<name>.domain.ts`,
  `packages/convex/confect/capabilities/<name>.test.ts`, and
  `packages/convex/confect/capabilities/<name>.headless.json`.
- Generated capability docs are emitted at
  `docs/template/generated/capabilities/<name>.md`.
- Flat generated capability specs import shared errors with
  `import { Forbidden, Unauthorized, ValidationFailed } from "../errors";` and
  declare
  `error: () => Schema.Union(Unauthorized, ValidationFailed, Forbidden)`.
- Generated source must never import from `repos/*`.
- Backend/client-domain generators accept an existing canonical `--system` ID
  and require `--disposition reuse|extend`; creating a new owner requires a
  reviewed catalog decision before generation.
- Generated client-specific logic stays under generated modules or
  `private-packages/<name>/` until reviewed.
- Provider SDKs stay behind Effect services and adapters.
- React Flow output is derived UI state only; durable workflow graphs use the
  workflow schema.
- After writing any generated Confect slice, run `pnpm confect:codegen`,
  `pnpm confect:manifest`, and focused tests for the generated package or
  surface before wiring generated refs into web/API/CLI/MCP callers.

## Minimum Review Commands

Consequential generation uses the reviewed scaffold boundary. Run
`node maestro-template.mjs scaffold --generator <id> --args '<json>'` first. The
preview labels its privacy posture as `review-required` and exposes secret names
only. Review its generated paths and bytes, provenance, collisions, semantic
rules, follow-up work, codegen, and focused gates. Then rerun the same command
with `--write`; the generator recomputes that plan from the current filesystem
and refuses drift before changing files.

Direct `template:*` commands remain available for narrow interactive work, but
their preview points to the reviewed scaffold equivalent for consequential
writes.

- `pnpm confect:codegen`
- `pnpm confect:manifest`
- `pnpm check:generators`
- `pnpm check:confect-contracts`
- `pnpm check:workflow-graph-boundary`
- `pnpm check:schema-migration-notes` when durable data changes
- `pnpm check:system-catalog`
- `pnpm check:system-topology`
- `pnpm check:data-resources`
- `pnpm check:promotion-boundary`
- `pnpm check:secret-canaries`
- focused package tests for the generated slice
