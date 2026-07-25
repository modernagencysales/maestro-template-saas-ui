# Maestro Agent Pack Product Specification

Status: draft for product approval  
Date: 2026-07-10  
Scope: agent skill, safe CLI, thin MCP adapter, guided coaching, and
template-readiness contract  
Implementation planning: deferred until this specification is approved

## Decision Summary

Maestro is an installable pack for people who want a capable coding agent to
build or improve an application using the Maestro architecture.

The customer already has a high-powered LLM with repository, filesystem, shell,
Git, and browser tools. Maestro must not recreate that intelligence. It provides
the non-obvious knowledge and deterministic operations the agent cannot safely
infer:

- architecture and repository rules;
- generator-backed patterns;
- planning and approval discipline;
- provider setup guidance;
- verification gates;
- release and handoff evidence.

> The agent supplies intelligence and judgment. Maestro supplies architectural
> authority, reusable patterns, deterministic execution, and proof.

The product is flexible about where the customer starts and opinionated about
the target:

> Flexible input. Prescribed architecture. Verified output.

## V1 Promise

Given a business idea or supported existing prototype, a capable agent can use
the Maestro pack to:

1. produce an approved Maestro implementation plan;
2. implement one useful vertical slice;
3. coach the required provider setup;
4. run focused and full verification;
5. produce an honest, commit-bound evidence receipt and handoff when requested.

V1 does not promise to convert an arbitrary application automatically or finish
an entire product in one invocation.

## Intended User And Host

The V1 user is a technical founder, agency operator, or implementation lead who:

- works through a capable coding agent;
- can grant access to repositories and a development environment;
- accepts the Maestro architecture and provider boundaries;
- can approve product, data, provider, and deployment decisions.

The host agent is expected to interview users, inspect arbitrary code, edit
files, use Git, implement bespoke logic, and interpret failures. Maestro should
not replace those capabilities with deterministic analyzers.

V1 supports:

- the versioned Maestro CLI directly for shell-capable agents;
- a thin MCP adapter for an MCP-capable GPT host.

Other host wrappers may reuse the same skill and CLI contracts but are not
supported until they pass the same conformance fixtures.

## Responsibility Boundary

### The host agent owns judgment

The agent:

- understands the business and current codebase;
- identifies useful prior art;
- asks follow-up questions;
- proposes architecture and migration decisions;
- writes client-specific code;
- chooses repairs after deterministic failures;
- adapts provider coaching to the customer's environment;
- summarizes risks, evidence, and remaining work.

### Maestro owns authority and deterministic operations

The pack provides:

- instruction precedence and architecture rules;
- task-to-reference routing;
- the canonical repository map;
- generator commands and output contracts;
- work-package validation;
- provider setup references and doctor commands;
- focused and full verification commands;
- evidence classifications and receipt format;
- production-readiness and cleanup rules.

Deterministic tools report facts and declared gaps. The host agent assesses
risk, selects repairs, and decides what conclusions the evidence supports.

## Workspace Topology

The agent must identify three roles before changing code:

| Role                     | Default authority                              |
| ------------------------ | ---------------------------------------------- |
| Source application       | Read-only prior art and baseline evidence      |
| Maestro template release | Immutable architecture and generator reference |
| Target application       | Writable customer application                  |

### Greenfield default

Materialize a target application from a compatible Maestro template release. Do
not add client business logic to the template release checkout.

### Existing-application default

Keep the source application read-only and create a clean Maestro target beside
it. Port approved behavior, design, data, and business rules into the target.

In-place adoption is allowed only when the approved plan identifies editable
boundaries, rollback, and why a separate target is impractical.

The agent must record source, template, and target roots in the work package.
`maestro preflight` validates the topology before writes.

## Instruction Precedence

Use this order:

1. System and user instructions define authority and scope.
2. The Maestro skill defines the guided workflow and architecture contract.
3. The target repo's root `AGENTS.md` defines repository mechanics.
4. Nested repository instructions govern their subtree.
5. `template-instance.json` records the selected template version, blueprint,
   modules, and provider posture.
6. Generated provenance identifies the generator and expected outputs.

For migrations, source-repo instructions govern safe inspection of the source;
Maestro and target-repo instructions govern the target.

Conflicting instructions, incompatible pack/template versions, or ambiguous repo
roles stop mutation and produce a preflight finding.

## Pack Architecture

Use progressive disclosure. Keep always-loaded context short and route the agent
to canonical repo documents rather than copying them.

```text
maestro-agent-pack/
  SKILL.md
  agents/
    openai.yaml
  references/
    existing-apps.md
    provider-workos.md
    provider-convex.md
    provider-cloudflare.md
    provider-buildkite.md
    provider-posthog.md
    provider-llm.md
    provider-storage.md
    verification.md
  bin/
    maestro
  adapters/
    mcp
```

Provider references stay one hop from `SKILL.md` so the agent can load one
provider without traversing nested indexes.

### Core skill

`SKILL.md` should be approximately 100-150 lines and must remain below 250. It
contains only:

- trigger coverage;
- instruction precedence;
- the task router;
- the four workflow stages;
- approval and safety rules;
- commands and completion requirements;
- direct links to conditional references and canonical repo docs.

The skill must not duplicate the layer law, provider matrices, generator
contracts, or gate definitions already owned by the compatible template release.

### References

Pack references contain only Maestro-specific knowledge missing from the repo.
Detailed architecture, generator, and package documentation remains repo-owned.
Provider coaching and existing-app safety guidance are conditional references.

### CLI and MCP

The Maestro CLI is the sole implementation of deterministic pack behavior. The
MCP server is a thin typed adapter over the CLI contracts. It must not contain a
second planner, scaffold engine, verification engine, or policy source.

MCP is transport for agent hosts that need it, not the reasoning engine.

## Guided Workflow

The internal stages are:

```text
orient -> propose -> implement -> prove
```

Mira, Archie, Dex, and Vera may remain customer-facing names for those stages,
but do not create separate services, agents, state machines, or authority
boundaries.

### Orient

- Run `maestro preflight`.
- Determine whether the request is reconnaissance, planning, implementation, or
  release follow-through.
- Inspect the real source and target repositories.
- Load only the references required for the task.
- Confirm the user's outcome and unresolved consequential decisions.

### Propose

- Select an implemented blueprint when relevant.
- Map prior art to Maestro patterns.
- Classify work as `fixture-to-real`, `pattern-instance`, or `template-gap`.
- Name generator commands, targets, dependencies, manual decisions, and focused
  gates.
- Run `maestro plan-check` when a plan manifest applies.
- Obtain mutation approval before implementation unless the user's request
  already clearly authorizes the scoped change.

### Implement

- Run generator dry runs before writes.
- Preserve useful product behavior and design where the approved plan requires
  it.
- Implement bespoke logic in Maestro boundaries.
- Add tests with behavior.
- Run focused checks before completing each slice.
- Keep commits intention-scoped.
- Repair red gates rather than weakening them.
- Update real/fake/seam/planned posture when it changes.

### Prove

- Run the focused acceptance checks.
- Run full verification before claiming completion.
- Retrieve CI or hosted evidence when the requested outcome includes it.
- Distinguish presence, mechanical, behavioral, AI-review, provider, and hosted
  evidence.
- Produce the verification receipt.
- Generate a handoff view only when the user requests handoff or release.

Stages may be skipped when the user already supplied equivalent approved work. A
focused repair does not require a new discovery brief.

## Authority Rules

| Action                                      | Authority                                                 |
| ------------------------------------------- | --------------------------------------------------------- |
| Read-only inspection and local diagnostics  | Allowed within the user's scoped repos                    |
| Scaffold or code writes                     | Requires an approved plan or direct scoped change request |
| Commit or PR creation                       | Allowed when included in the approved delivery scope      |
| Paid provider actions or account changes    | Requires explicit approval                                |
| Live data migration or destructive deletion | Requires explicit approval and rollback                   |
| Merge, staging deploy, or production deploy | Requires explicit outcome authority                       |
| Production promotion                        | Requires a separate human approval after current evidence |

Renew approval when scope, architecture, data handling, external side effects,
cost, provider posture, or deployment outcome changes materially.

Record consequential approval in the work package, PR review, or another durable
artifact. Do not rely solely on remembered chat context.

## Existing-Application Safety Contract

The host agent inspects existing applications using normal tools. The pack does
not need a universal framework analyzer.

When migration risk is material, load `references/existing-apps.md` and require
the work package to name:

- source and target roots;
- editable boundaries;
- prior-art preserve/port/replace/delete decisions;
- behavior, visual, or data baseline;
- identity and tenant mapping when applicable;
- schema and data mapping when applicable;
- compatibility requirements;
- cutover point;
- rollback path;
- deletion timing;
- owner and approval for destructive or live operations.

Use temporary compatibility wrappers only when the plan names their risks,
tests, owner, and removal criteria.

Framework-specific examples may be added later as references. They guide agent
judgment and do not promise deterministic conversion.

## Canonical Artifacts

Keep durable state minimal:

1. `template-instance.json` for template version, blueprint, modules, and
   provider posture.
2. One repo-native work package containing outcome, decisions, plan, topology,
   authority, and approval.
3. One machine-readable verification receipt bound to the commit and
   environment.

Git commits, PRs, and CI provide execution history. Generate provider checklists
only when configuring that provider. Generate a human handoff report from the
canonical artifacts only when an external handoff is requested.

One machine-readable registry must own real/fake/seam/planned subsystem status.
Docs, setup views, and handoff reports are generated projections of that
registry.

## Maestro CLI Contract

All commands emit versioned structured JSON and a concise human summary. They
use stable exit codes and never print secret values.

Mutating commands must:

- default to dry run;
- identify every target path;
- report existing-file collisions and diffs;
- refuse silent overwrite of user changes;
- refuse ambiguous or dirty overlapping worktrees;
- be idempotent where the operation supports it;
- avoid commit, push, provider mutation, merge, or deploy side effects unless
  the command explicitly represents that approved action.

### `maestro preflight`

Report:

- source, template, and target roots;
- pack, CLI, and template versions;
- compatibility status;
- worktree and generated-output status;
- selected blueprint and provider posture;
- supported generators and canonical docs;
- template-readiness status;
- whether fake, test, staging, or production claims are permitted.

Block mutation on ambiguous topology, incompatible versions, unsafe collisions,
or failed required readiness checks.

### `maestro plan-check`

Reuse `tooling/stack/plan.mts`. Report only deterministic schema, completeness,
layer, dependency, and declared-risk violations. The agent remains responsible
for judging the plan's business and migration quality.

### `maestro scaffold`

Delegate to existing `template:*` generators. Dry run by default. Return
generated paths, provenance, collisions, manual follow-up, codegen, and focused
gates. Writes require explicit `--write` and prior mutation authority.

### `maestro verify`

Run the authorized focused or full gate scope. Return:

- commands and versions;
- subject commit and environment;
- pass, fail, skipped, or unavailable status;
- evidence class;
- failed rule and canonical reference;
- rerun command;
- evidence expiry or staleness conditions.

The tool reports declared evidence gaps. The agent decides what claims remain
unsupported and explains them to the user.

## Provider Coaching

Coaching is a provider reference plus agent conversation.

Each provider reference contains:

- why Maestro uses the provider;
- decisions and responsible owner;
- prerequisites;
- secret names without values;
- setup steps;
- doctor and smoke commands;
- common failures and recovery;
- evidence required before live use.

The agent loads only the selected provider reference, explains the steps, and
waits while the user completes external account work. Deterministic doctor and
smoke commands confirm the result.

Never ask the user to paste secrets into chat. Verify configuration through
approved local or deployment secret stores without printing values.

## Template-Readiness Gate

Template cleanup is a prerequisite program, not runtime pack behavior.

`maestro preflight --require pack-v1` blocks a production-capable pack release
until the compatible template proves:

1. TanStack Start is the canonical tested and deployed frontend path.
2. Live and test provider modes fail closed without real transports.
3. Canned compatibility registries are absent from production execution paths.
4. One machine-readable source owns real/fake/seam/planned status.
5. Generators report collisions and do not silently overwrite user work.
6. Generated registration, codegen, manifest, and focused gates are accurate.
7. Production-residue checks reject template identity, demo deployment values,
   placeholder runtime behavior, fake auth, and unowned temporary bridges.
8. Presence-only audits are labeled and cannot satisfy behavioral claims.
9. Pack, CLI, and template versions have a checked compatibility contract.
10. One real reference application has been completed through the same pack
    workflow and evidence contract.

Internal investor evidence, historical plans, sample documents, and demo
branding remain in the template development repo only when clearly excluded from
customer output.

Application-runtime MCP is separate. Either ship a real runtime MCP server or
stop marketing the existing MCP-shaped CLI projection as one; it does not block
the factory pack unless the selected blueprint promises runtime MCP.

Keep fake provider profiles, synthetic fixtures, labeled contract fixtures, and
vendored Effect/Confect reference sources.

## V1 Contents

V1 ships:

- one 100-150 line core skill;
- flat conditional references;
- one safe versioned Maestro CLI;
- one thin MCP adapter over the CLI;
- compatibility preflight;
- existing template generators and gates after the readiness gate passes;
- the existing-application safety contract;
- one verification receipt schema.

V1 does not ship:

- a Build Room;
- a Project Brain service;
- a universal codebase analyzer;
- a framework conversion engine;
- a digital twin;
- a project state machine;
- remote build workers;
- continuous fleet monitoring;
- a pack marketplace;
- automatic reuse of customer code or prompts;
- silent merge or deployment.

Distribution, licensing, pricing, and managed-service tiers are separate product
decisions and must not complicate local pack operation.

## Forward-Test Acceptance

The pack is accepted only after a fresh agent succeeds without access to the
conversation that created it.

For every fixture, define the supported host/model/tool baseline, allowed
initial context, expected artifacts, forbidden actions, retry/intervention
budget, and scoring rubric. A correct explicit block is a valid outcome when
authority or external setup is unavailable.

### Positive fixtures

1. Greenfield brief using the default implemented blueprint.
2. Existing prototype requiring preserve/port/replace decisions and one vertical
   slice.
3. Required provider setup with missing configuration and successful doctor
   recovery.
4. Failing architecture gate that must be repaired without weakening the gate.

### Adversarial fixtures

1. Dirty target worktree with overlapping user edits.
2. Existing generated-file collision.
3. Incompatible pack and template versions.
4. Planned blueprint requested as if implemented.
5. Missing live provider transport returning placeholder-like behavior.
6. Presence audit offered as behavioral proof.
7. Destructive migration without approval or rollback.
8. Merge or deployment request outside granted authority.
9. Stale verification receipt after a later commit.

### Required outcomes

- Load only task-relevant references.
- Identify source, template, and target correctly.
- Preserve repo instructions and user changes.
- Produce a valid work package before consequential mutation.
- Prefer generators where supported.
- Refuse unsafe overwrite and unauthorized actions.
- Repair deterministic failures rather than weakening rules.
- Bind verification evidence to the exact commit and environment.
- Produce an honest completion or blocked summary.

## Non-Goals

- Encoding business or repository understanding in deterministic tools.
- Supporting arbitrary target architectures.
- Automatically converting whole applications.
- Requiring a new document for every conversation stage.
- Duplicating canonical template docs inside the skill.
- Treating MCP as a second implementation of the CLI.
- Claiming production readiness from fake, stale, or presence-only evidence.
- Replacing human product, data, provider, legal, or launch ownership.

## Final Product Principle

> Give a capable agent the minimum Maestro-specific context and deterministic
> tools it needs to orient safely, propose the right work, implement within the
> architecture, coach the customer, and prove the result. Do not encode
> intelligence the agent already has.

## Canonical Productization Amendment

This canonical copy preserves the approved prior-art specification above and
adds the product boundary adopted by the canonical factory repository.

`maestro-template-saas-ui` is the factory source. A tagged, immutable factory
release materializes a separate customer target through the single customer
creation front door, `pnpm maestro -- create`. Factory-only plans, fixtures,
review packets, and internal tooling do not ship unless an explicit ownership
manifest classifies them for the customer target. Existing applications remain
read-only prior art unless an approved adoption plan grants narrower authority.

The first customer promise is deliberately small and workflow-optional:

```text
create -> start -> add -> check
```

It must produce a personalized, visible, fake-safe application without a
provider account, plugin, MCP server, or durable workflow. The supported path
uses the minimum necessary primitive and escalates only when behavior requires
it:

```text
table + route -> capability -> workflow -> agent
```

- Use a table and route for ordinary tenant-scoped CRUD.
- Add a capability for reusable authenticated business behavior.
- Add a workflow only for durable, restartable, multi-step orchestration.
- Add an agent only when nondeterministic judgment is required, with explicit
  capability or workflow grants.

The productization execution index is
[`2026-07-24-maestro-agent-pack-productization-plan.md`](../plans/2026-07-24-maestro-agent-pack-productization-plan.md).
It sequences implementation without replacing this product contract.
