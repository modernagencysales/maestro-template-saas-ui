# App Factory Guide

The app factory flow creates a client-specific app from this private template
without copying project-specific business logic into the core framework.

## Factory Principles

- Start from a documented blueprint in
  [blueprint-catalog.md](./blueprint-catalog.md).
- Treat `source-grounded-gtm-brain` as the implemented baseline until the other
  blueprint packs have generator support, deterministic seed data, tests, and
  handoff docs.
- Use `gtm-implementation` when the first client app should be account-centric
  GTM software with CRM, Drive, Notion, and generated reporting seams.
- Start from fake providers and synthetic demo data.
- Use [env-manifest.md](./env-manifest.md) as the provider setup source of
  truth.
- Query [system-catalog.md](./system-catalog.md) before adding nouns or durable
  resources; reuse or extend an existing canonical owner by default.
- Add client domain nouns through generators.
- Keep Confect specs, generated manifest/headless metadata, generated ref
  mappings, frontend adapters, docs, and tests together.
- Promote runtime-authored capabilities to generated source when compile-time
  guarantees matter.
- Keep private client packages separate from the template core.

## Default Flow

Fastest usable factory command sequence:

```bash
pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Client Brain" --write
pnpm template:intake -- --name "Client Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write
pnpm template:handoff -- --mode fake --write
```

This sequence should stay cheap, deterministic, fake-provider safe, and suitable
for investor diligence or a first client discovery call.

For a GTM-specific fork, swap the first command to:

```bash
pnpm template:quickstart -- --blueprint gtm-implementation --name "GTM Brain" --write
```

That adds optional provider seam metadata for CRM, Drive, and Notion plus
reporting surface seams. These are generated/private-package starting points,
not template-core assumptions.

1. Run
   `pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Client Brain" --write`.
2. Generate and review the intake brief with
   `pnpm template:intake -- --name "Client Brain" --write`.
3. Review `template-instance.json`,
   `docs/template/generated/implementation-brief.md`, and
   `docs/template/generated/handoff-packet.md`.
4. Seed reviewer-safe fake data with
   `pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write`.
5. Run `pnpm template:doctor -- --mode fake`.
6. Add a first capability with
   `pnpm template:add-capability -- --name summarizeSource --system knowledge-brain --disposition extend --write`.
7. Add a first workflow with
   `pnpm template:add-workflow -- --name sourceGroundedPlan --system knowledge-brain --disposition extend --write`.
8. Regenerate generated contracts before wiring generated wrappers:
   `pnpm confect:codegen`, `pnpm confect:manifest`, then the relevant focused
   tests and gates for the changed surface. Run Convex codegen only when the
   generated slice also changes Convex deployment refs. In the template repo,
   use `pnpm template:workflow-output-smoke` to repeat workflow output checks in
   an isolated temp copy.
9. Use `template:promote-workflow` only when migrating older reviewed workflow
   artifacts or private-package workflow modules into production-target paths.
   New `template:add-workflow -- --write` output is already production-target.
10. Import reviewed private packages with
    `pnpm template:private-package:import -- --fixture <fixture> --write`; keep
    generated source modules under `private-packages/<package>/` until review.
11. Add domain modules with
    `template:add-client-domain -- --system <id> --disposition reuse|extend`.
12. Add capabilities, workflows, agents, Brain schemas, API surfaces, source
    types, notifications, admin surfaces, and data lifecycle resources through
    the matching generators.
13. Run focused verification for each generated change.
14. Run `pnpm template:handoff -- --mode fake --write` and full verification
    before a client handoff.

See `docs/template/quickstart.md` for the 10-minute fake-mode path, 30-minute
client discovery path, and one-day prototype path.

Use [client-intake-wizard.md](./client-intake-wizard.md) and
[client-intake-questionnaire.md](./client-intake-questionnaire.md) before
customizing a fork. Generated and promoted slices must follow
[generator-output-contract.md](./generator-output-contract.md). Handoffs should
follow [client-handoff-packet.md](./client-handoff-packet.md). Template releases
and client upgrades should follow
[template-release-process.md](./template-release-process.md).

`template:init` remains available for low-level manifest-only initialization.
Use it when you need just `template-instance.json`; use `template:quickstart`
when you want the instance, implementation brief, demo seed, and handoff packet
together.

## Quickstart Value Loop

The factory is working when a new fork can move through this loop without live
secrets:

1. Generate an instance from the implemented blueprint.
2. Generate an intake brief that maps the client’s business outcome, sources,
   first workflow, provider posture, and handoff risks.
3. Seed a synthetic Brain with markdown, links, and notes.
4. Run or inspect the first source-grounded workflow.
5. Inspect the Trust Receipt and provider posture.
6. Change one client noun, capability, or workflow through a generator.
7. Re-run fake doctor checks and generate a handoff packet.

Any new blueprint, provider, frontend route, or backend primitive should either
participate in this loop or clearly explain why it is optional.

## Client Forks

Client forks should consume template releases, not copy random files from the
template main branch. Use
`pnpm template:upgrade -- --from <client-version> --to <template-version>` to
compare a client fork against a template release and list migrations, env
changes, contract diffs, and manual review items.

Before a fork is handed to a client or investor reviewer, run
`pnpm --dir tooling/release exec tsx src/index.ts client-release <template-version> <client-version>`.
This confirms the generated intake brief, implementation brief, provider
checklist, handoff packet, env manifest, and `template-instance.json` are
present for review.

## Instance Doctor

`template:doctor` verifies the generated instance file has core modules,
provider posture, and fake-mode readiness. Fake mode must not require live
secrets. Live mode reports provider warnings until WorkOS, Convex, PostHog,
Dodo, email, LLM, and storage providers are configured. Provider requirements
come from `docs/template/env-manifest.json`, so doctor output stays aligned with
`.env.example`, deploy config, and provider descriptors.

## Handoff Acceptance

A client fork is ready for a technical handoff when `template:doctor`, focused
generator tests, Confect contract checks, workflow graph boundary checks, secret
canaries, hosted smoke tests, and `pnpm review:readiness` all pass. The handoff
packet should identify any deterministic template runners that still need to be
replaced with SDK-backed provider calls or production Confect runner services.
