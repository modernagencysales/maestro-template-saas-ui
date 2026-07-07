# Investor Reviewer Packet

This private repo is an internal AI app factory for custom Brain, workflow, and
agent applications. It is not a public starter kit. It is intended to show that
custom client builds can start from a typed, tested, hosted platform substrate
instead of a blank app.

## Reviewer Entry Points

- Hosted reference app: `https://maestro-template.pages.dev`
- GitHub remote: `modernagencysales/maestro-template`
- Current reviewed commit: run `pnpm review:readiness`
- Local reviewer guide: [reviewer-guide.md](./reviewer-guide.md)
- Architecture map: [repo-map.md](./repo-map.md)
- Frontend architecture: [frontend-architecture.md](./frontend-architecture.md)
- Confect/Effect guide: [confect-effect-guide.md](./confect-effect-guide.md)
- Hosting guide: [hosting.md](./hosting.md)

## What This Proves Today

The current template proves these reusable primitives:

- A hosted static reference app with Brain, workflow, capability, agent,
  integration, API/CLI/MCP, receipt, and safety surfaces.
- A React Flow workflow primitive through `packages/workflow-ui`.
- A canonical typed generated manifest and metadata model in
  `packages/template-core`.
- Headless projections for API, CLI, MCP, OpenAPI, and Scalar from generated
  Confect manifest/exposure metadata plus explicit generated ref mappings.
- A deterministic workflow run receipt and Trust Receipt path.
- Confect/Effect backend slices with Effect schemas, typed errors, generated
  refs, and plain Convex Workpool interop.
- A backend HTTP docs route at `packages/convex/confect/http.ts` for
  `/api/openapi.json`, `/api/docs`, and executable reviewer-safe generated API
  operations.
- Provider adapter contracts and tested Effect fake/test/live-ready adapter
  harnesses for WorkOS/AuthKit, PostHog, Dodo, MailerSend, OpenRouter-compatible
  LLMs, storage, and search.
- App factory commands for `template:quickstart`, `template:intake`,
  `template:seed-demo`, `template:handoff`, `template:init`, `template:doctor`,
  `template:add-capability`, `template:add-workflow`,
  `template:workflow-output-smoke`, `template:promote-capability`,
  legacy/private-package `template:promote-workflow`, `template:upgrade`, and
  private-package dry-run/import with source-module scaffolds for imported
  capabilities and workflows.
- Cloudflare Pages deployment wiring and static hosted smoke checks.
- A documented TanStack Start migration decision that preserves the current Vite
  static hosted app until Start has equivalent smoke coverage.

## Thirty-Minute Technical Review

Run these from the repo root:

```bash
pnpm install
pnpm review:readiness
pnpm review:completion
pnpm check:format
pnpm lint
pnpm typecheck
host-test-slot --class full pnpm test
pnpm build
pnpm smoke:web-static
pnpm smoke:hosted
pnpm smoke:hosted:browser
pnpm smoke:hosted:a11y
pnpm smoke:hosted:visual
```

`review:readiness` and `review:completion` are presence/evidence audits. They
check required files and listed evidence paths; run the rest of the commands for
behavioral proof. `host-test-slot` is optional internal host tooling that
serializes expensive tests; on a fresh external clone, run the command after it
directly, for example `pnpm test`.

Inspect the live app:

```text
https://maestro-template.pages.dev
```

Inspect the shared headless contracts:

```bash
pnpm exec tsx apps/cli/src/index.ts describe
pnpm exec tsx apps/cli/src/index.ts workflow run
pnpm exec tsx apps/cli/src/index.ts api openapi
pnpm exec tsx apps/cli/src/index.ts mcp call template.workflow.run
pnpm exec tsx apps/cli/src/index.ts integrations report fake
pnpm --dir packages/integrations test
```

Inspect the executable API handler:

```bash
pnpm --dir packages/convex test http-docs
```

Inspect the app factory:

```bash
pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Reviewer Brain" --write
pnpm template:intake -- --name "Reviewer Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write
pnpm template:add-capability -- --name summarizeSource
pnpm template:add-workflow -- --name sourceGroundedPlan
pnpm template:promote-capability -- --name summarizeSource
pnpm template:workflow-output-smoke
pnpm template:handoff -- --mode fake --write
pnpm template:upgrade -- --from client-v1.0.0 --to template-v1.1.0
pnpm template:private-package:dry-run -- --fixture examples/generic-ai-ops
pnpm template:private-package:import -- --fixture examples/generic-ai-ops --write
```

## Architecture Trace

The intended layer law is:

```text
web routes -> Saas UI shell -> features -> blocks -> local primitives
client hooks -> @confect/react refs -> Confect specs -> Convex functions
agents -> workflows -> capabilities -> domain/checks -> schema
API/CLI/MCP/OpenAPI/Scalar -> generated Confect manifest/exposure metadata
  plus explicit generated ref mappings -> same capabilities/workflows as web
storage/notifications/observability -> Effect services -> provider adapters
admin/support/privacy -> audited capabilities -> narrow operator surfaces
```

Concrete files to inspect:

- `apps/web/src/routes/index.tsx`: hosted Saas UI dashboard route.
- `apps/web/src/saas-ui/business-shell.tsx`: Saas UI business shell and section
  pages.
- `docs/design-intake/2026-07-01-template-frontend-stack-source.md`: frontend
  source audit from Maestro into the template.
- `docs/template/frontend-architecture.md`: frontend layer law, provider tree,
  Saas UI boundary, and TanStack Start acceptance criteria.
- `tests/e2e/hosted-reference-app.spec.ts`: hosted desktop/mobile browser smoke.
- `tests/e2e/hosted-reference-app.accessibility.spec.ts`: hosted desktop/mobile
  landmark, route-announcement, and axe WCAG smoke.
- `tests/e2e/hosted-reference-app.visual.spec.ts`: hosted desktop/mobile
  screenshot-diff visual smoke.
- `packages/template-core/src/index.ts`: canonical sample registry.
- `packages/workflow-ui/src/index.tsx`: React Flow workflow canvas primitive.
- `tooling/workflow/src/index.ts`: API/CLI/MCP/OpenAPI projection.
- `packages/convex/confect/capabilities/catalog.spec.ts`: Confect spec shape.
- `packages/convex/confect/jobs/workpool.spec.ts`: plain Convex component
  interop through Confect.
- `packages/convex/confect/http.ts`: OpenAPI and Scalar docs route.
- `packages/convex/test/confect-contracts.test.ts`: generated refs, Effect
  schemas, typed errors, and plain Convex contract shape.
- `tooling/generators/src/index.ts`: app factory commands.
- `docs/rule-coverage.md`: rule-to-gate coverage map.
- `pnpm review:completion`: objective-to-evidence completion audit.
- `.buildkite/pipeline.yml`: deterministic, AI, deploy, and promotion gates.

## Confect/Effect Completion Boundary

This template treats Confect and Effect as the contract default for new backend
work. The template proves the migration direction with pinned compatible
versions, Effect schemas, typed public errors, generated refs, Scalar/OpenAPI
docs, plain Convex Workpool interop, React/JS client package pins, static
contract gates, and lightweight runtime contract tests that do not require a
provisioned Convex deployment.

Client forks become fully production-provisioned when they add generated Convex
deployment code, replace deterministic template runners with Confect runner
services, and run provisioned `@confect/test` coverage for auth identity,
storage, scheduling, Node actions, HTTP handlers, and live plain-Convex
component interop. Until then, deterministic runners are intentional reviewer
scaffolding so the private template remains runnable without client secrets or
customer infrastructure.

## Current Limits

This repo is already useful as an internal template and diligence artifact, but
it is not claiming every final production subsystem is fully implemented.

Remaining client-specific work before calling a fork production-complete:

- Wire promoted capability/workflow Confect groups into codegen automatically
  after client review.
- Replace deterministic live-ready provider receipts with SDK-backed WorkOS,
  Dodo, MailerSend, PostHog, and LLM provider calls in client apps.
- Replace the deterministic reviewer-safe API operation runner with production
  Confect runner services in client apps.
- Add provisioned `@confect/test` coverage for storage, scheduling, Node
  actions, identity, and live HTTP handler paths once client apps have Convex
  `_generated` deployment code.
- Extend private-package source-module importers with richer transforms as new
  client package formats appear.
- Add visual baselines for additional client-specific pages as those pages are
  generated.

## Diligence Summary

The important signal is that the template has a real product surface, a typed
backend direction, a reusable headless contract model, app-factory commands,
deployment wiring, and operational docs. It is structured so future custom AI
Brain builds can reuse the same platform primitives while swapping domain logic,
providers, and workflow/capability catalogs.
