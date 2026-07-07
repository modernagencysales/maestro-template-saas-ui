# Effectification Status

This document tracks the migration from a partially Confect-shaped template to
an Effect/Confect-rooted template where schemas, typed errors, tenancy, headless
surfaces, generators, and optional editor sync are derived from the same
contract family.

## Current Verified Baseline

- Confect packages are pinned to `9.1.5`; Effect is pinned to `3.21.4`.
- Confect v9 is the required baseline because its per-group generated registries
  keep Convex cold-start module evaluation proportional to the invoked group,
  not to the whole project.
- Durable tables live under `packages/convex/confect/tables/*`.
- Confect specs and impls exist for access, Brain pages, capabilities, jobs,
  ops, agents, auth, demo, editor sync, workflow contracts, and manifest
  surfaces.
- Public Confect-provenance specs declare typed errors, and public error
  families use `Schema.TaggedError` classes.
- Workspace-sensitive public paths resolve a Principal and workspace access
  server-side instead of trusting caller-supplied workspace identity.
- Generated Confect refs, schema, Convex schema, and registered function files
  exist under `packages/convex/confect/_generated/*`.
- Runtime API, CLI, and MCP projection now derives from the generated Confect
  manifest and explicit generated ref mappings instead of the canned
  `templateRegistry`.
- OpenAPI and MCP schemas are generated from the spec-bound Effect schema
  registry with `effect/JSONSchema`.
- Generator output for capabilities, workflows, and agents emits
  production-shaped Confect slices with focused tests and docs.
- The optional BlockNote/Tiptap/ProseMirror substrate is exact-pinned and
  wrapped behind generic editor packages and backend sync seams.
- `check:confect-contracts` and `check:headless-surface-contract` include
  semantic checks for typed public errors, generated files, generated ref
  parity, idempotency proof, and canned-success regressions.

## Known Gaps Remaining

- The template is a verified starter baseline, not a finished generic SaaS
  product. The exhaustive porting backlog still tracks optional or
  client-specific primitives such as full billing lifecycle, notification
  center, provider-specific deploy hardening, production retention jobs, and
  every future product surface.
- Some Confect groups still predate the spec-bound capability/workflow builder
  helpers. They are valid Confect groups, but they do not all emit manifest
  metadata until migrated.
- PostHog failure capture currently covers selected mutation/action paths; query
  failure telemetry still needs a future durable event path.
- `brain/pages.createMarkdown` is the first Confect mutation wrapped with
  backend PostHog failure capture.
- Remaining Confect groups are still unwrapped pending rollout/factory support.
- Access lifecycle planners emit audit-event values, including invitation
  lifecycle events, and member/invitation lifecycle mutations now persist them
  to `accessAuditEvents` through `recordAccessLifecycleEvents`.
- Generated workflow graph data is emitted as JSON-safe TypeScript constants so
  it can be typechecked with the workflow schemas; consumers must still treat
  React Flow state as a projection, not durable source.
- Provisioned `@confect/test` coverage exists for selected contract paths. Full
  provisioned coverage for storage, scheduling, Node actions, and every public
  group remains a follow-up for forks with live Convex deployment codegen.
- Editor sync remains optional. Forks must keep `checkRead` and `checkWrite`
  tied to server-side workspace access before exposing collaborative editing in
  production.
- Editor sync wraps plain Convex ProseMirror component functions. Access denials
  are encoded as tagged `EditorSyncAccessDenied` `ConvexError` payloads, but
  Confect `convexPublic*` wrappers do not currently expose an `error` schema
  slot for those component functions.
- Frontend UX essentials now include route focus, hosted axe smoke, dialog focus
  trap, route announcements, live-region announcements, root route
  pending/error/not-found states, offline/degraded network retry affordances,
  runtime reduced-motion gating for workflow edge animation, starter SEO/public
  assets, fake-safe cookie consent and legal review drafts, toast primitives,
  onboarding continuation feedback through `TemplateToastProvider`, and the
  first TanStack Form-backed starter form primitive with validation, dirty-state
  guarding, fake-safe autosave, fake-safe feature flag definitions plus durable
  per-workspace `featureFlagPolicies` and `ops.flags` list/evaluate/upsert
  contracts for rollout and kill-switch readiness, and a fake-safe
  notification-center foundation with unread/read-state planning and preference
  rendering. Durable in-app notification records and preferences now live in
  Confect `notificationRecords` / `notificationPreferences` tables with
  workspace-member-scoped list, mark-read, preference upsert, and internal
  record mutations under `ops.notifications`; the `/notifications` route uses
  the generated `ops.notifications` refs when Convex is configured and falls
  back to the fake-safe starter inbox otherwise, with mark-read success/error
  feedback routed through `TemplateToastProvider`. Static Cloudflare Pages
  output now carries CSP, HSTS, frame, nosniff, referrer, and permissions-policy
  headers through `apps/web/public/_headers`. Data lifecycle planning now
  includes DSAR export manifests, delete-request confirmation, legal-hold
  blocking, audited dry-run DSAR request persistence through
  `ops.dataLifecycle`, and dry-run retention job plans. Observability now
  includes a provider-neutral ErrorReporter event contract with release
  metadata, fingerprints, recursive redaction, and best-effort delivery.
  Environment posture now includes a machine-readable `env-manifest.json`
  checked against `.env.example`, provider descriptors, generator secrets,
  Convex component env, setup UI readiness copy, and deploy-required secrets.
  `template:doctor` reads provider requirements from the manifest, and
  `deploy:doctor` consumes the same manifest to expand deploy groups into
  concrete missing env names without printing values. Release tooling now
  includes redacted alert plans for failed deploy doctor checks and refused
  production promotions, ready for client forks to route through
  `packages/notifications`. The `/data-lifecycle` route now renders the
  generated-ref backed DSAR request audit surface, uses
  `ops.dataLifecycle.listDsarRequests` / `createDsarRequest` when Convex is
  configured, and falls back to fake-safe dry-run request planning otherwise.
  Every advertised workspace navigation path now has a route file, so direct
  links to Brain, Workflows, Capabilities, Agents, Runs, Documents, Sources,
  Integrations, API, Data Map, Settings, Billing, Analytics, Health, and Admin
  render starter reference content instead of falling through to a not-found
  route. The `/health` route now renders a fake-safe operator health board that
  combines runtime health checks with provider readiness from
  `@maestro-template/integrations`, reports missing/invalid live env names
  without values, and uses the shared `TemplateHealthBoard` primitive. Remaining
  product-surface work is adoption: wire future modals/popovers into
  `TemplateDialog`, future forms into the starter form primitive, future live
  surfaces into the feature flag evaluator, destructive DSAR fulfillment
  execution mutations, live error-reporting providers/source-map upload, and
  future real mutation success/error paths into `TemplateToastProvider`.

## Starter Readiness Read

As of 2026-07-05, the current `main` branch is a good SaaS-starter baseline for
new client work: it has the Effect/Confect contract spine, typed error doctrine,
headless surface generation, guarded CI, app shell, Saas UI-based frontend,
generator scaffolds, and core UX/a11y primitives. It is not yet a complete
generic SaaS product. Treat the remaining backlog as selectable product
acceleration work, not as proof that the existing starter baseline is fake.

The remaining cross-cutting starter improvements are:

1. Adopt the shared dialog and toast primitives in each real product surface as
   those surfaces gain mutations, modals, popovers, and destructive flows.
2. Adopt the starter form primitive in each generated client form and replace
   fake-safe autosave with durable mutations in client forks.
3. Connect future live product surfaces to `ops.flags.evaluate` before enabling
   client-specific billing, notifications, or AI generation rollout.
4. Keep [template-defaults.md](./template-defaults.md) current when billing,
   notification center, retention jobs, or deploy promotion move between
   template defaults and client-fork extension paths.

## Generated Artifact Ownership

These generated artifacts exist today. Never edit them by hand:

- `packages/convex/confect/_generated/*` — generated by
  `rtk pnpm confect:codegen`.
- `packages/convex/convex/_generated/*` — generated by
  `rtk pnpm confect:codegen` and Convex codegen.
- `packages/convex/convex/schema.ts` — generated schema re-export; regenerated
  by Confect/Convex codegen.
- `packages/template-core/src/generated/confectManifest.ts` — generated by
  `rtk pnpm confect:manifest`; contains serialized manifest metadata and
  generated JSON schemas.
- `apps/web/src/routeTree.gen.ts` — generated by TanStack Router tooling.

Each implementation task that changes a generator input must run the generator,
inspect the generated diff, and prove no stale generated output remains.

## Phase Status

| Phase | Scope                                                             | Status   |
| ----- | ----------------------------------------------------------------- | -------- |
| 0     | Preflight API proofs and review-amendment guardrails              | complete |
| A     | Docs, baseline, executable Confect tests                          | complete |
| B     | Tenancy, typed errors, and Clock-backed persisted paths           | complete |
| C     | Capability builder, manifest, executor, and generated projections | complete |
| D     | Generators and semantic gates                                     | complete |
| E     | Effect services, frontend adapters, and runtime ergonomics        | complete |
| F     | Exact-pinned editor substrate                                     | complete |
| G     | Final docs, broad verification, and cleanup                       | complete |

## Verification Log

Add one row per completed phase or reconciliation gate.

| Date       | Phase       | Command                                                                                | Result                                                                                                                 |
| ---------- | ----------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-07-04 | B / Task 11 | `rtk rg -n "Date\\.now\\(" packages/convex/confect`                                    | Fixed wall-clock `Date.now()` usage was removed from persisted impl paths; demo fixtures still use relative durations. |
| 2026-07-04 | F / Task 31 | `rtk pnpm confect:manifest`                                                            | pass                                                                                                                   |
| 2026-07-04 | F / Task 31 | `rtk host-test-slot --class focused pnpm check:confect-manifest`                       | pass                                                                                                                   |
| 2026-07-04 | F / Task 31 | `rtk host-test-slot --class focused pnpm --dir packages/convex test http-docs.test.ts` | pass, 12 tests                                                                                                         |
| 2026-07-04 | F / Task 31 | `rtk host-test-slot --class focused pnpm --dir tooling/workflow test`                  | pass, 10 tests                                                                                                         |
| 2026-07-04 | F / Task 31 | `rtk host-test-slot --class focused pnpm typecheck`                                    | pass                                                                                                                   |
| 2026-07-04 | G / Task 32 | `rtk host-test-slot --class focused pnpm check:docs-freshness`                         | pass, pin-only                                                                                                         |
| 2026-07-04 | G / Task 32 | `rtk host-test-slot --class focused pnpm check:confect-contracts`                      | pass, pin-only and semantic                                                                                            |
| 2026-07-04 | G / Task 32 | `rtk host-test-slot --class focused pnpm check:headless-surface-contract`              | pass                                                                                                                   |
| 2026-07-04 | G / Task 32 | `rtk host-test-slot --class focused pnpm check:generators`                             | pass, pin-only                                                                                                         |
| 2026-07-04 | G / Task 34 | `rtk host-test-slot --class full pnpm verify`                                          | pass                                                                                                                   |
| 2026-07-04 | G / Task 35 | `rtk gh pr checks 6`                                                                   | pass, 9 hosted checks                                                                                                  |
| 2026-07-04 | G / Task 35 | `rtk headless-bws-env exec bk build view -p mas/maestro-template 88 --no-pager --text` | pass: phase-1 deterministic gates, taste, and contract review                                                          |
