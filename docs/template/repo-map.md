# Repo Map

## Top Level

- `apps/`: runnable applications.
- `packages/`: reusable framework packages.
- `tooling/`: gates, generators, release helpers, evals, and workflow tooling.
- `examples/`: reviewer-safe synthetic example apps and seed data.
- `docs/`: architecture, operations, and playbooks.
- `docs/template/reviewer-guide.md`: first-stop customer-target review guide.
- `docs/template/frontend-architecture.md`: frontend layer law, TanStack Start
  direction, Saas UI shell rules, data-loading rules, and deploy acceptance
  criteria.
- `docs/template/saas-ui-frontend-authority.md`: the single pinned upstream
  frontend source and adaptation boundary.
- `docs/template/saas-ui-golden-review.md`: pinned Starter route-parity review.
- `docs/template/knowledge-model.md`: source-backed Brain concepts, claims,
  citations, context packs, markdown codecs, and OKF export.
- `docs/template/frontend-architecture.md`: shipped map from frontend primitives
  into template destinations.
- `docs/template/quickstart.md`: shortest path from private template to seeded
  B2B AI/GTM app fork.
- `docs/template/preflight.md`: read-only host, repository, provider, and
  workflow readiness plus the mutation-safety fingerprint.
- `docs/template/blueprint-catalog.md`: blueprint families for common
  AI/GTM/client implementation apps.
- `docs/template/system-catalog.json`: machine-checked canonical system,
  responsibility, entrypoint, and schema-table ownership.
- `docs/template/system-catalog.md`: agent/human reuse, extension, and system
  introduction workflow.
- `docs/template/product-topology.json`: machine-checked ownership for
  production capabilities, workflows, agents, jobs, routes, headless gateways,
  and provider seams.
- `docs/template/data-resources.json`: machine-checked tenant, sensitivity, PII,
  export/delete/retention, lifecycle, and write-authority posture for every
  durable table.
- `docs/template/promotion-boundary.md`: experiment/private-package isolation
  and production promotion workflow.
- `docs/template/client-intake-questionnaire.md`: discovery questions before a
  client-specific fork.
- `docs/template/implementation-brief-template.md`: discovery and handoff
  structure for client-specific builds.
- `docs/template/demo-seed-contract.md`: deterministic fake-mode seed shape.
- `docs/template/generator-output-contract.md`: required files, tests, and
  metadata for generator output.
- `docs/template/client-handoff-packet.md`: handoff status labels, provider
  posture, verification, and known seams.
- `docs/template/template-release-process.md`: release, upgrade, and rollback
  path for private client forks.
- `docs/template/agent-worker-playbook.md`: operating guide for future AI
  workers.
- `agent-patterns/`: future local references for Effect, Confect, and workflow
  graph idioms.
- `experiments/`: low-friction, fake-safe prototypes that production code may
  not import. Use `template:prototype`; promote by re-scaffolding.
- `private-packages/`: reviewed package-import staging area that remains outside
  the production dependency graph until contracts are promoted.
- `repos/`: future vendored read-only source references for Effect and Confect.
- `vendor/`: private package artifacts required by the internal template. This
  fork currently does not require private UI tarballs.

## Apps

- `apps/web`: the hostable TanStack Start reference workspace app, preserving
  the Maestro frontend direction with Convex/Confect data access, WorkOS-ready
  auth, PostHog-ready analytics, Saas UI shell primitives, and React Flow
  workflow inspection.
- `apps/cli`: typed CLI projection over generated Confect manifest metadata and
  generated refs.

## Packages

- `packages/convex`: Confect specs/impls, Convex components, schema, and tests.
- `apps/web/src/components`: installed Saas UI Pro registry components and the
  small compatibility seams required by the manifest compositions.
- `packages/workflow-ui`: React Flow graph editor primitive and future command
  reducers.
- `packages/template-core`: shared template registry and pure canonical-system
  catalog parser for sample/reviewer data, generated Confect manifest output,
  workflow/capability/agent types, co-editing domain constructors, policies, and
  reviewer-safe fixtures.
- `packages/integrations`: Effect service interfaces and provider adapters.
- `packages/notifications`: notification provider boundary plus fake-safe in-app
  center model, read-state planner, and channel preferences. Durable
  notification records/preferences live in
  `packages/convex/confect/ops/notifications.*` and the generated
  `ops.notifications` refs.
- `packages/storage`: asset storage provider boundary.
- `packages/observability`: event contracts, logs, SLOs, and telemetry helpers.
- `packages/search`: optional search/vector provider boundary.

### Editor Packages

- `packages/editor-core`: framework-agnostic editor document ids, codecs, and
  empty document helpers shared by backend and frontend editor surfaces.
- `packages/editor-react`: server-safe root helper re-exports at
  `@maestro-template/editor-react`, plus the browser-only `./client` subpath for
  future BlockNote React and ProseMirror sync UI.
- `packages/convex/confect/editor`: future backend editor sync boundary for
  document access checks, snapshot hooks, and transform-schema derivation from
  the guarded headless BlockNote schema.

## Tooling

- `tooling/quality`: deterministic gates and AI gate wrappers.
- `tooling/workflow`: headless operation projection from the generated Confect
  manifest, CLI/MCP/API metadata, OpenAPI generation, and workflow helpers.
- `tooling/generators`: template init, quickstart, prototype, durable table,
  seed-demo, handoff, other add-* generators, doctor, private-package import,
  and upgrade.
- `tooling/evals`: prompt and source-grounding evaluation fixtures.
- `tooling/release`: deploy, smoke, rollback, and backup/restore helpers.

## Generated Directories

- `packages/convex/confect/_generated`: Confect generated refs, schemas, and
  services. Never edit directly.
- `packages/convex/convex/_generated`: Convex generated API files. Never edit
  directly.
- `packages/template-core/src/generated/confectManifest.ts`: generated Confect
  contract manifest and JSON schemas for API/CLI/MCP/OpenAPI projection. Never
  edit directly.
- `apps/web/src/routeTree.gen.ts`: generated route tree once TanStack routes
  land. Never edit directly.

## Frontend Routes

The literal Starter hierarchy under `apps/web/src/routes/_app/` is the route
authority. It owns workspace dashboard, contacts, inbox, search, getting started
(`getting-started`), and settings routes. Auth routes live under
`routes/_auth/`, and API handlers under `routes/api/`. Product additions extend
this tree; they do not restore the legacy `_workspace` or a second business
shell/navigation system.
