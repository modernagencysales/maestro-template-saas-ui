# Template Quickstart

For the novice `add` journey and its copy/paste atomic confirmation command, see
[Executable Outcome Recipes](./executable-recipes.md).

This private template is an opinionated app factory for B2B AI/GTM software,
custom Brain builds, and implementation consulting prototypes. It starts in fake
mode so a reviewer can see the architecture, seeded Brain, first workflow, and
Trust Receipt without live provider setup.

## 10-Minute Local Fake Mode

From a fresh template or generated-customer checkout, validate the package
manager before invoking any workspace command:

```bash
node scripts/bootstrap-preflight.mjs
npx --yes pnpm@10.12.1 install --frozen-lockfile
```

This dependency-free preflight reads the exact version from `packageManager`,
rejects an ambient mismatch, and prints the same pinned `npx` recovery command.
Use that recovery when Corepack reports a signing-key error. Run generators only
after the frozen install succeeds. If the ambient pnpm remains mismatched, keep
the `npx --yes pnpm@10.12.1` prefix on every later pnpm command.

For a customer app, preview a reviewed release first:

```bash
pnpm maestro -- create ../my-app --name "My App" --outcome "Track client requests" --demo-only
pnpm maestro -- create ../my-app --name "My App" --outcome "Track client requests" --demo-only --write
```

Create asks only for the name, first outcome, and demo-only posture. The first
command writes nothing; the second materializes only after an exact external
tag, commit, and archive-checksum binding passes. Follow the single next command
printed by create. Install dependencies and initialize Git only after reviewing
their separate approval items. See the
[customer target contract](./customer-target-contract.md).

From the completed customer target, the shortest visible-app path is:

```bash
node scripts/bootstrap-preflight.mjs
npx --yes pnpm@10.12.1 install --frozen-lockfile
pnpm maestro -- start
```

The default fake mode starts only the web app, requires no Convex account, and
prints the personalized app name, first outcome, URL, and `/health` readiness
route only after that route responds successfully. Use `--mode local` only for
the reviewed local Convex stack and `--mode dev` only with an authenticated
personal dev deployment. See [local start modes](./start-modes.md).

Copy-paste path:

```bash
node scripts/bootstrap-preflight.mjs
npx --yes pnpm@10.12.1 install --frozen-lockfile
pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Client Brain" --write
pnpm template:intake -- --name "Client Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write
pnpm template:systems -- --query knowledge
pnpm template:add-client-domain -- --name customerContext --system knowledge-brain --disposition extend --write
pnpm template:handoff -- --mode fake --write
pnpm maestro -- start
```

This is the fastest reviewer path: install, generate the client fork packet,
create the intake brief, prove fake-mode readiness, seed the source-backed
Brain, generate the handoff packet, and open the TanStack Start reference app.

The first command must run with `--write`. `template:quickstart -- --write`
creates `template-instance.json`; `template:doctor -- --mode fake` expects
`template-instance.json` and will fail if you only previewed quickstart output.
Commands without `--write` are dry-run previews.

Before the first write, run `pnpm maestro -- preflight` and follow the
[preflight readiness guide](./preflight.md) if it reports a blocked target or
unsupported host posture.

1. Run `node scripts/bootstrap-preflight.mjs`, then install dependencies with
   the exact pinned command it prints.
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
   `pnpm template:add-client-domain -- --name customerContext --system knowledge-brain --disposition extend --write`.
8. Start the app with `pnpm maestro -- start`.
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

Expected local URL: `http://127.0.0.1:5173/`; start uses strict port binding and
reports a collision rather than selecting an unannounced port. The readiness
route is `http://127.0.0.1:5173/health`. Expected generated files:

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
4. Query the canonical system catalog and change one client noun with
   `template:add-client-domain -- --system <canonical-id> --disposition reuse|extend`.
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
2. Search the catalog, then explore uncertain behavior under the sandbox with
   `pnpm template:prototype -- --name "<feature>" --system <canonical-id> --disposition extend --hypothesis "<expected learning>" --write`.
3. Record the learning and promote the useful behavior as a complete slice with
   `pnpm template:add-feature -- --name "<feature>" --system <canonical-id> --disposition extend --write`.
4. Add a workflow with
   `pnpm template:add-workflow -- --name "<workflow>" --system <canonical-id> --disposition extend --write`.
5. Regenerate Convex refs, typecheck the Convex package, and keep
   `template:promote-workflow` only for older reviewed or private-package
   workflow artifacts. `template:add-workflow -- --write` already writes the
   production-target workflow paths.
6. Wire the generated refs into the Saas UI business surfaces, API, CLI, and MCP
   surfaces.
7. Add focused tests for the capability, workflow graph, provider posture, and
   Trust Receipt.
8. Run `pnpm review:readiness` before handoff.

The first files a worker should inspect are `AGENTS.md`,
`docs/template/blueprint-catalog.md`, `docs/template/system-catalog.md`,
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
