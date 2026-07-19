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

## Promotion Rules

- Runtime-authored capabilities and workflows are data until promoted.
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

- `pnpm confect:codegen`
- `pnpm confect:manifest`
- `pnpm check:generators`
- `pnpm check:confect-contracts`
- `pnpm check:workflow-graph-boundary`
- `pnpm check:schema-migration-notes` when durable data changes
- `pnpm check:system-catalog`
- `pnpm check:secret-canaries`
- focused package tests for the generated slice
