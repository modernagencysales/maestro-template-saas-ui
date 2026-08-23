# App Factory Guide

The app factory turns a reviewed template release into a separate,
client-specific application. It combines an opinionated starter with explicit
customization seams and deterministic architecture controls.

## Factory and customer are different modes

The factory checkout owns release composition, blueprints, ownership rules, and
the `create` boundary. A generated target owns the customer product. You can
identify them mechanically:

- Factory: `releases/` and `apps/cli/src/factory/createComposition.ts` exist.
- Customer: `template-instance.json` exists.

Never implement client business logic in the factory and never copy current
factory files into a customer target. Create from an immutable release; upgrade
through reviewed release operations.

## The supported method

```text
orient -> choose outcome -> find owner -> preview -> approve
       -> atomic write -> focused proof -> run
```

### 1. Orient

Run fake-mode preflight and inspect the generated instance:

```bash
pnpm maestro -- preflight --mode fake
```

Preflight reports repository, release, host, dependency, workflow, provider, and
app posture. Resolve blocking findings before mutation; do not suppress them.

### 2. Choose an outcome

```bash
pnpm maestro -- recipes list
pnpm maestro -- recipes show crud-business-entity
```

Recipes are versioned product outcomes, not free-form code prompts. Each recipe
states its consequential questions, minimum primitive, generated operations,
focused gates, done state, and escalation triggers. If no recipe fits, use the
closest lower-level generator or record a template gap rather than pretending a
near match is exact.

### 3. Find the canonical owner

Read `docs/template/system-catalog.md`, `product-topology.md`, and
`data-lifecycle.md`, then query the catalog:

```bash
pnpm template:systems -- --query <responsibility-or-table>
```

Record `reuse` or `extend` for normal work. Introducing, replacing, or retiring
a system requires a reviewed decision. A new durable table is incomplete until
the system catalog, data-resource catalog, topology, migration decision, and
runtime lifecycle projection agree.

### 4. Preview and approve

All `maestro add` and `template:*` generators preview by default. Preview should
name exact files, collisions, ownership, provenance, and follow-up gates.

Review the preview, then rerun the same command with `--write`. The write
recomputes the plan from the current filesystem and refuses new collisions or
drift before changing files. Preview output exposes secret names only and
remains classified `review-required`.

### 5. Prove the affected contract

Use the focused gates emitted by the recipe or matching
`docs/template/how-to-add-*` playbook. Typical proof includes typecheck, focused
tests, system ownership, topology, data lifecycle, schema migration notes,
Confect contracts, and route generation. Regenerate Confect/Convex outputs;
never edit them by hand.

### 6. Run fake first

```bash
pnpm maestro -- start --mode fake
```

Fake mode is the default because it proves the UI and contract shape without
external credentials. Local and dev modes are separate reviewed transitions;
live provider SDKs stay behind provider adapters and are never imported into web
code.

## Choosing the smallest primitive

Use a table and route for ordinary tenant-owned CRUD. Escalate only when the
behavior requires it:

- Capability: policy, approval, audit, entitlement, or cross-resource
  validation.
- Workflow: pause, retry, wait, schedule, resume, or durable multi-step work.
- Agent: nondeterministic selection among explicit reviewed tools.

This keeps web, API, CLI, MCP, and agent surfaces as projections of the same
authority instead of separate implementations.

## Customization seams

The starter is meant to look and behave like a real business app while staying
adaptable:

- Keep the shared Saas UI shell; customize blocks, tokens, feature adapters,
  generated routes, and view models.
- Keep durable behavior in Confect specs/implementations and canonical domain
  services; do not duplicate it in a route or CLI handler.
- Keep provider-specific code inside adapters.
- Keep customer wording and composition in customer extension or generated paths
  recorded by the release manifest.
- Use `template:prototype` for uncertain behavior. Promote what you learn by
  re-scaffolding with the matching production generator, not by importing the
  experiment.

## Direct generators

Use an outcome recipe when it fits. Use lower-level generators for narrower
work:

```bash
pnpm template:add-client-domain -- --name launchLanguage --system record-management --disposition extend
pnpm template:add-table -- --name milestone --system record-management --disposition extend ...
pnpm template:add-feature -- --name milestone --system record-management --disposition extend --screen-catalog-id '<exact-id-from-docs/template/saas-ui-screen-catalog.json>'
pnpm template:add-capability -- --name approveMilestone --system record-management --disposition extend
pnpm template:add-workflow -- --name milestoneReview --system record-management --disposition extend
pnpm template:add-agent -- --name launchCoordinator --system record-management --disposition extend
```

Direct commands preview their compatible output and point to the matching
reviewed-scaffold route. Review that route's plan, then rerun it with `--write`.
Backend generators require a canonical `--system` and
`--disposition reuse|extend` and write provenance for both. Frontend feature
generation additionally requires an exact assembled Starter screen ID. It
transplants that route composition and records its complete upstream closure;
there is no generic hand-built page fallback.

Factory maintainers can use `template:quickstart` to preview the broader
blueprints recorded in [Blueprint Catalog](./blueprint-catalog.md).
`template:init` is the lower-level manifest-only factory primitive; customer
targets already have `template-instance.json` from `maestro create` and should
not initialize a second instance. Every maintained generator must satisfy the
[Generator Output Contract](./generator-output-contract.md).

## Handoff standard

A generated app is ready to share when:

- fake preflight passes from a clean baseline;
- the first user outcome works through the UI;
- ownership, topology, data lifecycle, and migration gates pass;
- Confect refs and wrappers regenerate without drift;
- focused tests, typecheck, lint, format, and build pass;
- fake start reports a healthy URL;
- remaining fake, seam, unavailable, and live surfaces are labeled honestly;
- recipe receipts and generator provenance are committed with the change.

Use [Template Quickstart](./quickstart.md) for the copy/paste tester path,
[Executable Outcome Recipes](./executable-recipes.md) for transactional adds,
and [Customer Target Contract](./customer-target-contract.md) for the release
and filesystem safety boundary.
