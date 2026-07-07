# Template Quickstart

This private template is an opinionated app factory for B2B AI/GTM software,
custom Brain builds, and implementation consulting prototypes. It starts in fake
mode so a reviewer can see the architecture, seeded Brain, first workflow, and
Trust Receipt without live provider setup.

## 10-Minute Local Fake Mode

Copy-paste path:

```bash
pnpm install
pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Client Brain" --write
pnpm template:intake -- --name "Client Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write
pnpm template:add-client-domain -- --name customerContext --write
pnpm template:handoff -- --mode fake --write
pnpm --dir apps/web dev
```

This is the fastest reviewer path: install, generate the client fork packet,
create the intake brief, prove fake-mode readiness, seed the source-backed
Brain, generate the handoff packet, and open the TanStack Start reference app.

The first command must run with `--write`. `template:quickstart -- --write`
creates `template-instance.json`; `template:doctor -- --mode fake` expects
`template-instance.json` and will fail if you only previewed quickstart output.
Commands without `--write` are dry-run previews.

1. Install dependencies with `pnpm install`.
2. Review `.env.example` and [env-manifest.md](./env-manifest.md). Keep the fake
   defaults unless this is a test/live provider setup. Leave `VITE_CONVEX_URL`
   blank for fake-safe local web mode.
3. Generate the default client fork scaffold:
   `pnpm template:quickstart -- --name "Client Brain" --write`.
4. Generate the first discovery brief with
   `pnpm template:intake -- --name "Client Brain" --write`.
5. Check fake-mode readiness with `pnpm template:doctor -- --mode fake`.
6. Seed deterministic demo context with
   `pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write`.
7. Change the first client noun with
   `pnpm template:add-client-domain -- --name customerContext --write`.
8. Start the app with `pnpm --dir apps/web dev`.
9. Review the generated implementation brief at
   `docs/template/generated/implementation-brief.md`.
10. Preview the handoff packet with
    `pnpm template:handoff -- --mode fake --write`.

Expected first screen: the Saas UI dashboard at `/`, with priority-account
cards, a live workflow-runs card, and a golden-path architecture card. With
`VITE_CONVEX_URL` blank, the workflow-runs card must say Convex is not
configured rather than attempting a fake network call. The `/data-lifecycle`
route is the first copyable mutation slice: `Plan export` and `Plan delete`
update local fake-safe state until a real Convex URL and workspace are
configured.

Expected local URL: `http://127.0.0.1:5173/` unless Vite selects another free
port. Expected generated files:

- `template-instance.json`
- `docs/template/generated/implementation-brief.md`
- `docs/template/generated/client-intake.md`
- `generated/app-factory/day-0-loop.json`
- `examples/demo-seed/source-grounded-gtm-brain/demo-seed.json`
- `docs/template/generated/handoff-packet.md`

`template-instance.json` is the Day-0 manifest. It records the app name, package
scope, blueprint, enabled modules, local/preview/production environments,
deployment targets, required secret names, redaction posture, source/demo-data
posture, and fake/test/live provider mode. `template:doctor -- --mode live` may
list missing secret names from this posture, but it must never print secret
values.

The default blueprint is `source-grounded-gtm-brain`. It creates a source-backed
Brain using markdown, links, and notes; a first capability named
`summarizeSource`; a first workflow named `sourceGroundedPlan`; and a first
agent named `gtmBrainPlanner`.

The 10-minute path is successful only when a reviewer can see the whole loop:
seeded sources, generated context, the first workflow, a Trust Receipt, and the
next commands for turning the fork into a client-specific app. If any part of
that loop is fake, the generated handoff packet must say so.

## Day-0 Factory Loop

Use this when the goal is speed from client idea to useful prototype:

1. Pick the closest blueprint.
2. Run `template:quickstart` and `template:seed-demo`.
3. Run `template:intake` to capture the first discovery map.
4. Change one client noun with `template:add-client-domain`.
5. Add or rename one capability.
6. Add or rename one workflow.
7. Run the fake doctor and focused generator checks.
8. Open the app and inspect Brain, workflow, and receipt pages.
9. Generate the handoff packet and implementation brief.

This loop is the app-factory contract. New template features should make one of
these steps faster, safer, or more legible.

## 30-Minute Client Discovery Mode

Use the generated implementation brief as the discovery map:

- Confirm client nouns: workspace, sources, context packs, capabilities,
  workflows, agents, and Trust Receipts.
- Inventory source types: markdown, links, notes, documents, CRM exports,
  meetings, and approved internal systems.
- Decide provider posture: fake, test, or live-ready for WorkOS, PostHog, Dodo,
  MailerSend, OpenRouter-compatible LLMs, storage, and search.
- Identify the first useful workflow that connects client context to an
  auditable output.
- Keep client-specific prompts, integrations, and business logic in generated
  modules or private packages until reviewed.

## One-Day Prototype Mode

1. Generate the quickstart files.
2. Add a client-specific capability with
   `pnpm template:add-capability -- --name "<capability>" --write`.
3. Add a workflow with
   `pnpm template:add-workflow -- --name "<workflow>" --write`.
4. Regenerate Convex refs, typecheck the Convex package, and keep
   `template:promote-workflow` only for older reviewed or private-package
   workflow artifacts. `template:add-workflow -- --write` already writes the
   production-target workflow paths.
5. Wire the generated refs into the Saas UI business surfaces, API, CLI, and MCP
   surfaces.
6. Add focused tests for the capability, workflow graph, provider posture, and
   Trust Receipt.
7. Run `pnpm review:readiness` before handoff.

The first files a worker should inspect are `AGENTS.md`,
`docs/template/blueprint-catalog.md`,
`docs/template/generator-output-contract.md`, `template-instance.json`, and the
generated implementation brief.

## Design Commitments

- TanStack Start is the frontend direction; Convex, Confect, and Effect own
  durable backend contracts.
- Saas UI and the template block layer own UI primitives.
- React Flow is only the workflow interaction layer; durable workflow graphs
  stay outside React Flow node and edge arrays.
- The Brain is source-backed by default. RAG is an optional extension, not the
  default truth model.
- Fake providers are the default until a client setup explicitly configures live
  adapters.
- Provider setup is centralized in [env-manifest.md](./env-manifest.md);
  generated docs list secret names, never secret values.
