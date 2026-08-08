# Agent Instructions

This repository is both the Maestro app factory and, after `maestro create`, the
base of a generated customer app. Treat it as product infrastructure: preserve
the generic framework, avoid project-specific business logic in the factory,
and leave the repository easier for the next person or agent to inspect.

## Identify The Repository Mode

- A factory checkout contains `releases/` and
  `apps/cli/src/factory/createComposition.ts`. Use it to preview and create a
  separate target. Never build a customer product directly in the factory.
- A generated customer target contains `template-instance.json`. Build the
  product there and preserve the immutable release facts in that file.
- If neither marker exists, stop and report that the repository mode is
  ambiguous before writing files.

In either mode, begin with `pnpm maestro -- preflight --mode fake`. In a
customer target, then run `pnpm maestro -- recipes list` and
`pnpm template:systems -- --query <responsibility-or-table>` before choosing a
generator. Preview is the default. Consequential generation uses the reviewed
scaffold route, its `review-required`/secret-names-only privacy posture, and
the returned structured `confirmation.argv`. Run the focused gates named in the
preview.

The supported customer loop is:

```text
preflight -> recipes/system lookup -> preview -> reviewed write
          -> focused verification -> commit reviewed change
          -> start --mode fake
```

## Product Contracts

The natural-language contract under `features/` is the acceptance authority.
For each promised journey:

1. Run `pnpm maestro -- contracts add <journey>` or edit its Feature first.
2. Run `pnpm maestro -- contracts check` while defining its step bindings.
3. Implement the observable behavior through the real UI and CLI surfaces.
4. Run `pnpm maestro -- contracts test <journey>` until the Feature passes.
5. Change `@wip` to `@required` only when the promise is accepted, then run
   `pnpm maestro -- contracts test --required` before delivery.

Do not replace a Feature with a parallel journey manifest, evidence store, or
source-code wording checker. Cucumber execution is the completion evidence.

After the focused gates pass, review `git status --short` and commit the recipe
transaction, including its receipt and generated provenance.

Do not bypass this loop by copying factory files, hand-editing generated files,
inventing a parallel system, or weakening a red gate. Read
`docs/template/quickstart.md`, `docs/template/app-factory-guide.md`, and
`docs/template/customer-target-contract.md` when onboarding or changing the
factory/customer boundary. Use
`docs/template/enforced-engineering-rules.md` to select focused checks; reserve
full verification for an integrated batch or delivery candidate.

## Layer Law

```text
web routes -> screens -> features -> blocks -> Saas UI/shared primitives
client hooks -> @confect/react refs -> Confect specs -> Convex functions
agents -> workflows -> capabilities -> domain/checks -> schema
API/CLI/MCP -> headless registry -> same capabilities/workflows as web
storage/notifications/observability -> Effect services -> provider adapters
admin/support/privacy -> audited capabilities -> narrow operator surfaces
```

Do not skip layers for convenience. If a change feels easier by importing across
layers, add the missing boundary instead.

## Confect And Effect Rules

- Before non-trivial Effect or Confect work, read
  `agent-patterns/effect-confect.md`.
- Durable Convex tables live under `packages/convex/confect/tables/*` and use
  Effect schemas.
- Public, internal, and HTTP functions use Confect specs/impls with typed args,
  returns, and expected errors.
- Plain Convex functions required by Convex components are registered in the
  Confect spec/impl tree.
- Specs import plain Convex functions with `import type`; impls import runtime
  function values.
- Use generated Confect refs and generated services. Do not duplicate business
  logic in web, API, CLI, or MCP surfaces.
- Pin `@confect/*`, `effect`, and companion `@effect/*` packages as a tested
  compatibility set.
- Do not edit generated Confect or Convex files by hand.

## Frontend Rules

- Keep reusable UI in blocks and package UI primitives.
- Use Saas UI primitives for the visible business-app shell when they cover the
  need.
- Feature components may use feature adapters; blocks may not import Convex,
  Confect refs, route modules, provider SDKs, or workspace auth internals.
- React Flow belongs in workflow UI and workflow feature surfaces only.
- Durable workflow graph validation and execution must not import React Flow.

## Workflow, Capability, And Agent Rules

- Capabilities authenticate, validate, delegate to domain/repo/services, and
  return typed results.
- Workflows compose capabilities and do not call provider adapters directly.
- Agents are nondeterministic actors with explicit tool grants. Agents start
  workflows or call capabilities; they do not call repos or adapters directly.
- Runtime-authored capabilities are data, not arbitrary code. Promotion to
  generated Confect source is the compile-time safety path.
- Author workflows only through `pnpm template:add-workflow`; its Confect-owned
  runner source is the single raw Convex Workflow boundary. Do not import
  `@convex-dev/workflow`, instantiate `WorkflowManager`, or call lifecycle/event
  helpers from application code. Exact compatibility fixtures are the only
  non-generated exception; there is no inline suppression or project allowlist.
- Run `pnpm check:workflow:fast` while authoring. Semantic diagnostics include a
  stable rule id, reason, repair, and rerun command. The generated support
  ledger is
  [workflow-semantics.md](docs/template/generated/workflow-semantics.md).

## Reference Fixture Implementations

Two kinds of Confect impls live in `packages/convex/confect/`, and codegen must
treat them differently:

**Database-backed (real persistence — extend, don't replace):** `access/*`,
`auth/workspaces`, `brain/pages`, `demo/showcase`.

**Contract fixtures (deterministic bodies behind real specs — replace the body
per fork, keep the spec):** `ops/actions`, `ops/billing`, `ops/coediting`,
`ops/health`, `ops/knowledge`, `ops/transforms`, `ops/versioning`,
`agents/assistant`, `capabilities/catalog`, `capabilities/sourceGroundedBrief`,
`jobs/workpool`.

Rules when replacing a fixture body:

- The `.spec.ts` (args, returns, typed errors) is the contract — keep it, or
  change it deliberately with its tests.
- Fixture bodies use `Effect.succeed` with canned data and a fixed `now`
  constant; a real implementation swaps in `DatabaseReader`/ `DatabaseWriter`
  access and keeps every declared typed failure reachable.
- Existing tests pin the contract shape, not the fixture values — they should
  keep passing after the swap, plus new tests for the persistence behavior.

## Working Loop

- Before planning a subsystem, schema table, capability, workflow, agent, job,
  provider, or route, read `docs/template/system-catalog.md`,
  `docs/template/product-topology.md`, and `docs/template/data-lifecycle.md`,
  then run `pnpm template:systems -- --query <responsibility-or-table>`. Record
  `reuse`, `extend`, or a reviewed `introduce` decision. Do not create a
  parallel system under a new name.
- Planning starts from work-packages. Each plan/subplan slice must classify work
  as `fixture-to-real`, `pattern-instance`, or `template-gap`.
- `fixture-to-real` names the existing contract fixture, the real
  persistence/provider boundary, and the focused gates that prove the swap.
- `pattern-instance` names the `pnpm template:*` command, generated target, and
  follow-up gates from the matching `docs/template/how-to-add-*` playbook.
- `template-gap` names the missing pattern, a template backlog reference, and
  the proposed promotion/import path. A gap is a template finding, not a waiver.
- Use `docs/template/app-factory-guide.md` for the generator flow and the
  focused package scripts named by the selected work package.

- Scaffold first: when a `pnpm template:*` generator covers the module kind,
  preview its reviewed scaffold equivalent and use the exact confirmation argv
  instead of hand-writing registrations or directly authorizing a consequential
  write. Backend generators require the
  canonical `--system` ID plus `--disposition reuse|extend` and record both in
  provenance. Generated output compiles and passes gates; fill in the TODOs
  where judgment is required.
- Freedom boundary: uncertain behavior starts with `template:prototype` under
  `experiments/<system>/<name>`. Experiment and private-package code is never a
  production dependency and cannot register tables, routes, headless operations,
  jobs, or providers. Promote learned behavior by re-scaffolding with
  `template:add-feature` or the matching `template:add-*` generator; never
  import or move the sandbox implementation into runtime paths.
- Production feature path: use `template:add-feature` for user-facing vertical
  slices. It emits capability → contract/presenter → feature → screen → thin
  route, fake-safe fixtures, state tests, ownership, tenancy, audit,
  observability, rollout, entitlement, lifecycle posture, and provenance.
- Durable data: read `docs/template/data-resources.json` before adding state.
  New tables must use `template:add-table`; update lifecycle metadata and the
  migration decision in the same change. Do not invent a parallel table family
  because its existing owner has a different noun.
- Gate discipline: run the focused gates for what you changed before every
  commit. Package scripts are the canonical gate contract shared by local dev,
  CI, and agent SOPs.
- Verification before completion: never claim done, fixed, or passing without
  pasting the passing command output. A red gate is a finding, not a blocker to
  route around — never edit a gate file to make red turn green.
- Commits: one intention per commit, imperative subject under ~60 chars
  (`feat:`/`fix:`/`test:`/`docs:`/`chore:`), commit after every completed task,
  keep PRs phase-scoped.
- Suppressions (`eslint-disable`, `ts-expect-error`) are debt: do not add them
  without a comment explaining the constraint and a backlog note.
- When a subsystem changes status (real/fake/seam/planned), update its doc in
  the same commit. When durable schema changes, update
  `docs/template/system-catalog.json` and run `pnpm check:system-catalog` in the
  same commit.

## Delivery-Batch CI

Tasks are implementation checkpoints, not release units. Commit per task and run
the task's focused affected tests, narrow typecheck, and owned static gates. Do
not run broad verification or create a PR merely because a task completed.

A delivery batch is an independently mergeable product outcome. Run full
required verification once on its immutable final head. A changed head
invalidates prior evidence. Woodpecker verification for the current PR head is
the only blocking full-verification authority; never copy or manufacture status
across commits.

## Testing Doctrine

- New behavior needs tests before implementation.
- Use focused tests for adapters, reducers, schemas, and gates.
- Use generated Confect refs in Confect tests.
- Broad local test gates are for an integrated batch or delivery candidate:

```bash
pnpm test
pnpm verify
```

`pnpm verify` is the delivery-batch gate. Run it once after all tasks in the
batch are integrated and reviewed, not after each task commit. Woodpecker is the
blocking verdict authority.

## Provider And Secret Boundary

- Fake/local providers are the default.
- Live provider SDK imports stay inside adapter packages.
- Do not expose server secrets to web code.
- Do not log raw provider payloads, webhook bodies, tokens, API keys, or support
  artifacts.
- Provider docs name required secret names, never secret values.

## CI Verdict Retrieval

Use Woodpecker, GitHub, and local scripts as the source of truth. If an AI gate
or CI context is unavailable, report the missing context explicitly instead of
assuming success.

## Repo Navigation

- `apps/web`: reference app.
- `apps/cli`: headless CLI.
- `apps/voice-relay`: optional voice/capture relay.
- `packages/convex`: Confect/Convex backend.
- `packages/ui`: UI primitives and blocks.
- `packages/workflow-ui`: React Flow workflow builder.
- `packages/template-core`: shared template contracts.
- `packages/integrations`: provider interfaces and adapters.
- `tooling/quality`: gates and CI helpers.
- `tooling/generators`: app-factory generators.
- `docs/template`: operating docs and playbooks.
- Factory-only upstream research trees are omitted from generated customer
  targets. In a customer target, use `docs/template/confect-effect-guide.md` and
  the shipped typed contracts instead.

## Vendored Repositories

This project vendors external repositories under `repos/`.

- Use vendored repositories as read-only reference material when working with
  related libraries.
- Factory checkouts may include read-only upstream research trees; application
  code never imports from them. Generated customer targets omit those trees.
- In customer targets, use `docs/template/confect-effect-guide.md`, shipped
  typed contracts, and local focused tests for Effect and Confect guidance.

## Playbook Index

- [Blueprint catalog](docs/template/blueprint-catalog.md)
- [Canonical system catalog](docs/template/system-catalog.md)
- [Product topology](docs/template/product-topology.md)
- [Data resource catalog](docs/template/data-lifecycle.md)
- [Sandbox and promotion boundary](docs/template/promotion-boundary.md)
- [Generator output contract](docs/template/generator-output-contract.md)
- [Client intake questionnaire](docs/template/client-intake-questionnaire.md)
- [Client handoff packet](docs/template/client-handoff-packet.md)
- [Template release process](docs/template/template-release-process.md)
- [Agent worker playbook](docs/template/agent-worker-playbook.md)
- [Add a workflow](docs/template/how-to-add-workflow.md)
- [Add a capability](docs/template/how-to-add-capability.md)
- [Add an agent](docs/template/how-to-add-agent.md)
- [Add a Brain schema](docs/template/how-to-add-brain-schema.md)
- [Add a source type](docs/template/how-to-add-source-type.md)
- [Add a notification](docs/template/how-to-add-notification.md)
- [Add an admin surface](docs/template/how-to-add-admin-surface.md)
- [Add a data lifecycle resource](docs/template/how-to-add-data-lifecycle-resource.md)
- [Add a frontend route](docs/template/how-to-add-frontend-route.md)
- [Add a private package](docs/template/how-to-add-private-package.md)

## Rule Ambiguity

When rules conflict, prefer tenant safety, generated contracts, typed errors,
redaction, and small focused changes. If still ambiguous, write the assumption
in the PR description or implementation note and ask for rule review.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`packages/convex/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
