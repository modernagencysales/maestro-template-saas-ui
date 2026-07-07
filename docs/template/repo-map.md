# Repo Map

## Top Level

- `apps/`: runnable applications.
- `packages/`: reusable framework packages.
- `tooling/`: gates, generators, release helpers, evals, and workflow tooling.
- `examples/`: reviewer-safe synthetic example apps and seed data.
- `docs/`: architecture, operations, and playbooks.
- `docs/template/investor-reviewer-packet.md`: first-stop technical diligence
  packet for investors and review agents.
- `docs/template/frontend-architecture.md`: frontend layer law, TanStack Start
  direction, Saas UI shell rules, data-loading rules, and deploy acceptance
  criteria.
- `docs/template/knowledge-model.md`: source-backed Brain concepts, claims,
  citations, context packs, markdown codecs, and OKF export.
- `docs/design-intake/2026-07-01-template-frontend-stack-source.md`: source map
  from Maestro frontend primitives into template destinations.
- `docs/template/quickstart.md`: shortest path from private template to seeded
  B2B AI/GTM app fork.
- `docs/template/blueprint-catalog.md`: blueprint families for common
  AI/GTM/client implementation apps.
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
- `apps/voice-relay`: optional capture/voice relay app.

## Packages

- `packages/convex`: Confect specs/impls, Convex components, schema, and tests.
- `packages/ui`: shared app shell, blocks, layout primitives, and settings-ready
  controls, including the optional co-editing document shell.
- `packages/workflow-ui`: React Flow graph editor primitive and future command
  reducers.
- `packages/template-core`: shared template registry for sample/reviewer data,
  generated Confect manifest output, workflow/capability/agent types, co-editing
  domain constructors, policies, and reviewer-safe fixtures.
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
- `tooling/generators`: template init, quickstart, seed-demo, handoff, add-*
  generators, doctor, private-package import, and upgrade.
- `tooling/evals`: prompt and source-grounding evaluation fixtures.
- `tooling/release`: deploy, smoke, rollback, and backup/restore helpers.
- `tooling/pr-backlog`: PR sweep and backlog tooling.

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

## Planned Routes

- `/`: Home.
- `/brain`: Brain pages, sources, context packs, evidence, and trust receipts.
- `/workflows`: workflow builder, run kickoff, and run inspection.
- `/capabilities`: capability catalog and runtime-authored definitions.
- `/agents`: agent seats, tool grants, approvals, and conversations.
- `/runs`: workflow and agent run history.
- `/documents`: generated and reviewed documents.
- `/documents/:documentId`: optional co-editing review surface for source-backed
  markdown, version history, annotations, and agent suggestions.
- `/sources`: source intake and upload state.
- `/integrations`: provider health and configuration.
- `/api`: API docs and key management.
- `/onboarding`: first-run setup.
- `/data-map`: retention, export, delete, and processor inventory.
- `/data-lifecycle`: dry-run DSAR request review and retention posture backed by
  the generated `ops.dataLifecycle` Confect surface when Convex is configured.
- `/notifications`: fake-safe notification center, read-state reference UI, and
  channel preferences backed by the generated `ops.notifications` Confect
  surface when a fork wires live data into the route.
- `/settings`: workspace, users, auth, and Notion settings.
- `/billing`: package, entitlement, credits, checkout, and portal.
- `/analytics`: product and workflow analytics.
- `/health`: fake-safe operator health board with runtime checks and provider
  readiness.
- `/admin`: support, audit, data lifecycle, and operator tools.

Every path listed in workspace navigation has a route file under
`apps/web/src/routes`. Workspace routes render the Saas UI business shell or a
Saas UI section page, with Confect-backed business behavior kept behind feature
and adapter boundaries.
