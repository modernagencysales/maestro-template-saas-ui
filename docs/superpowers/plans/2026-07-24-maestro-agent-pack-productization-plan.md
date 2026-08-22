# Maestro Agent Pack Productization Implementation Plan

- Status: approved direction, reviewed implementation plan
- Date: 2026-07-24
- Canonical repository: `maestro-template-saas-ui`
- Planning base: `origin/main` at `cdd5e8c01c65963cf3f813a750bced9d3a43f601`
- Current dependency baseline: Convex `1.42.1`, `@convex-dev/workflow` `0.4.4`,
  and `@convex-dev/workpool` `0.4.7`

## Outcome

The Maestro workflow doctrine is sound, but its current implementation is
missing native Convex Workflow semantics.

Maestro should keep its opinionated architecture:

```text
Maestro graph and policies
        -> compile to
Convex durable workflow steps
        -> dispatch through
typed capabilities
        -> delegate to
domain services and provider adapters
```

This is a useful architecture layer over Convex, not a replacement for Convex
Workflows. It gives a novice builder tenancy, typed errors, provider isolation,
policy snapshots, auditability, and web/API/CLI/MCP parity without asking them
to invent those boundaries.

The implementation must now carry through or explicitly govern the upstream
semantics it currently drops or leaves implicit: kickoff profiles, action
retries, parallel steps, nested workflows, inline transaction posture, lifecycle
controls, immutable workflow/capability bindings, payload budgets, principal
propagation, typed events, scheduling, cleanup, and execution-ledger
reconciliation.

The product outcome is:

> A person who does not know application architecture or Convex can use their
> existing coding agent to turn an idea or prototype into a visible Maestro app,
> understand the consequential decisions, follow a supported path, and receive
> deterministic proof that the resulting architecture is intact.

## Product Decisions

1. `maestro-template-saas-ui` is the canonical template and productization
   repository and factory source. It is not copied wholesale into customer
   projects. A tagged immutable template release produces a separately
   materialized customer target through an explicit ownership/exclusion
   manifest. `maestro-template` becomes prior art; its untracked agent-pack
   specification is copied, never deleted or overwritten, and receives a
   canonical-source pointer rather than a second release path.
2. The host coding agent supplies reasoning and judgment. Maestro supplies
   concise context, canonical patterns, deterministic operations, and strict
   outcome gates.
3. Guidance is loose and progressively disclosed. Gates are strict where an
   invariant is mechanically provable. Maestro will not intercept grep, block
   normal tools, regex-steer prompts, or place an AI supervisor over another AI.
4. Claude Code and Codex are first-class hosts. The same core skill and CLI
   contract must pass both host fixtures.
5. Official Convex AI files and agent skills are installed through the pinned
   Convex CLI. Maestro adds only its missing architectural context and a safe
   local Convex MCP configuration.
6. The existing `agents -> workflows -> capabilities -> domain/adapters` law
   remains non-negotiable. Official Convex features are expressed through that
   law rather than bypassing it.
7. ADRs are consequential-decision records, not paperwork for every feature.
   Structural linkage and declared-risk coverage are enforced; prose quality
   remains a review concern.
8. A deterministic Maestro App Map is the default codebase graph for customers.
   Graphify and code-review-graph are optional maintainer adapters, with no
   search hooks or automatic background rebuilds.
9. `taste` and `contract-review` remain advisory judgments. Type, contract,
   tenancy, topology, generated-file, migration, secret, and behavioral gates
   remain strict.
10. V1 succeeds when a fresh human-plus-agent pair can get a real visible app
    running, implement one useful vertical slice, and understand what remains
    fake, local, preview, staging, or production.
11. No workflow semantic may be accepted and silently ignored. Every supported
    field has one typed authoring path, one compiler mapping, and an executable
    conformance fixture; unsupported or intentionally restricted behavior fails
    at scaffold/preflight with a named alternative.
12. Product learning happens before platform completion. A walking-skeleton
    alpha must prove `create -> start -> add -> check` on a personalized,
    workflow-optional application before the full workflow, map, adoption,
    upgrade, and promotion backlog becomes release-blocking.
13. Novices see four verbs and plain-language states. Detailed preflight,
    semantics, map, ADR, receipt, and promotion commands remain available to
    agents and advanced operators, but are not prerequisites for understanding
    the first screen.

## ICP And Product Posture

The primary user wants to build an application but does not already understand
multi-tenant architecture, Convex, Confect, Effect, durable workflows, provider
boundaries, or release evidence. The product therefore has to make the correct
path the easiest path without hiding the architecture.

The host agent should be able to answer, from small authoritative references:

- What are we building and what is the first useful user outcome?
- Which Maestro system owns it?
- Is this a capability, workflow, agent, table, route, provider adapter, or a
  combination?
- Which generator starts the work?
- Which decisions need the user?
- Which provider setup is required now, and which can stay fake?
- What could this change affect?
- Which gates prove it is correct?
- What evidence supports local, preview, staging, or production claims?

The product should explain the reasons behind consequential choices in plain
language. It should not turn every implementation detail into a questionnaire.

## Principles

- **Flexible input, prescribed architecture, verified output.** Existing apps
  are prior art; the target architecture is opinionated.
- **One source per fact.** Skills route to canonical repo docs and registries;
  they do not duplicate them.
- **CLI first, MCP second.** The versioned CLI owns deterministic behavior. MCP
  is a thin transport over the same contracts.
- **Fake first, truth always.** The app starts without provider accounts, but
  every surface labels fake, seam, test, live, and unavailable states honestly.
- **Visible progress.** `pnpm maestro -- start` produces a URL and an
  understandable setup/readiness surface, not just generated files.
- **A real customer target.** `pnpm maestro -- create` materializes a slim
  target from a tagged template release; the canonical factory checkout,
  prior-art source, and writable customer target are never conflated.
- **Repair, do not weaken.** Gate failures include the owning rule, canonical
  reference, affected paths, repair hints, and exact rerun command.
- **Stable durable execution.** Published workflow graphs, runners, events,
  completion bindings, and workflow-callable capability versions are never
  silently rewritten beneath active or restartable runs.
- **Correct by construction before lint.** Discriminated builders and generated
  registries make invalid retry, transaction, event, principal, and lifecycle
  combinations unrepresentable; lint covers only syntax and import boundaries.
- **No accepted-but-dropped options.** A field cannot enter the graph contract
  without a semantic rule ID, upstream mapping, fixture, and support status.
- **Safe adoption and upgrades.** Dry run, collision detection, explicit
  migrations, commit-bound verification, and rollback are product features.
- **Local and private by default.** No source, prompt, secret, file path, or
  provider payload telemetry leaves the machine in V1.
- **Minimum necessary primitive.** Use a table/route for ordinary CRUD, a
  capability for a governed operation, a workflow for durable multi-step,
  waiting, retry, approval, or scheduling, and an agent only for
  nondeterministic judgment.

## Non-Goals

- A new foundation model, planner, chat UI, project-state AI, or installed/
  required supervisory agent hierarchy. Maestro neither provisions nor depends
  on a second AI control plane; a host may still use its native delegation when
  the user or host workflow chooses it.
- A universal codebase understanding or framework conversion engine.
- Automatic conversion of arbitrary Next.js, Supabase, or other applications.
- Grep interception, graph-first tool blocking, or shell command rewriting.
- Encoding every architectural judgment as a regex or lint rule.
- Claiming that an AST lint or source-shape check proves runtime, replay,
  idempotency, payload, tenant, or release behavior.
- Background Graphify/CRG daemons in customer projects.
- Automatic production deployment, credential changes, destructive migration,
  merge, or provider spend.
- Making every routine feature produce an ADR.
- Replacing Convex's execution journal with a competing Maestro workflow engine.
- Requiring every application or first vertical slice to contain a workflow.
- Shipping the canonical maintainer/factory checkout unchanged as the customer
  application artifact.

## Canonical Inputs And Preservation Rules

Implementation starts from `origin/main` at the base revision above, not the
currently checked-out `77954d8` branch head. Before each phase, create a clean
worktree or branch from the then-current `origin/main`, re-audit overlapping
changes, and write a stack-plan manifest for no more than four slices.

Preserve these inputs:

- `/Users/lappy/maestro-template/docs/superpowers/specs/2026-07-10-maestro-agent-pack-design.md`
  is copied into this canonical repository. The untracked source file remains
  untouched.
- `/Users/lappy/maestro/tooling/workflow/mcp-server.mts` and its companion MCP
  executor/context files are prior art for transport and server-injected auth;
  they are not copied blindly.
- `AGENTS.md`, `docs/template/app-factory-guide.md`, the `how-to-add-*`
  playbooks, `system-catalog.json`, `product-topology.json`,
  `data-resources.json`, generated Confect manifests, and Just recipes remain
  the canonical architecture and gate sources.
- Generated Confect and Convex artifacts are regenerated, never hand edited.

The product has three explicit repository roles:

| Role                       | Authority and default posture                                               |
| -------------------------- | --------------------------------------------------------------------------- |
| Canonical factory source   | Maintainer-owned generators, gates, references, fixtures, and release logic |
| Immutable template release | Tagged, checksummed input to customer materialization and upgrades          |
| Customer target            | Writable application containing only declared template/customer surfaces    |

The release ownership manifest classifies every shipped path as
`template-owned`, `customer-extension`, `generated`, `local-only`, or
`factory-only`. Customer materialization excludes internal backlogs, design
plans, vendored reference repositories, maintainer eval artifacts, and optional
demo applications unless a blueprint explicitly selects them.

Baseline inventory at the planning revision:

| Surface                                |                                 Baseline |
| -------------------------------------- | ---------------------------------------: |
| Canonical systems                      |                                       11 |
| Product-topology resources             |                                       41 |
| Data resources                         |                                       42 |
| Root `CLAUDE.md`                       |                                   absent |
| Official Convex AI files               |                            not installed |
| Customer-safe factory CLI              |                 partial runtime CLI only |
| Customer target materializer           |                                   absent |
| Durable workflow graph                 | implemented, incomplete native semantics |
| Workflow semantic enforcement          | absent; current graph gate is shape-only |
| Generic non-GTM blueprint              |                                   absent |
| Real upgrade application engine        |                      absent; report only |
| Deterministic App Map / impact command |                                   absent |

## Official Convex Compatibility Verdict

Official sources used for this decision:

- [Convex Workflow component](https://www.convex.dev/components/workflow)
- [`@convex-dev/workflow` 0.4.4 README](https://github.com/get-convex/workflow)
- [`@convex-dev/workflow` versioning issue #35](https://github.com/get-convex/workflow/issues/35)
- The pinned package's `src/client/*`, component limits/lifecycle source, and
  official `@convex-dev/workflow/test` registration helper
- [Convex agent skills](https://github.com/get-convex/agent-skills)
- The pinned Convex CLI's `convex ai-files` and `convex mcp start` help output

Versions observed on 2026-07-24 were Convex `1.42.3`, Workflow `0.4.4`, and
Workpool `0.4.8`. These are audit facts, not an instruction to float versions.
The repo stays pinned to a tested compatibility set. Workpool `0.4.8` is a
candidate because it reduces generation-mismatch/noisy-kick behavior, but it is
adopted only after the compatibility matrix passes.

| Topic                | Official behavior                                                                                                                                                                                                                   | Maestro decision                                                                                                                                    | Current gap                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Workflow boundary    | `defineWorkflow` handlers journal `step.*` calls                                                                                                                                                                                    | Keep Maestro graphs compiled into Convex steps                                                                                                      | None in doctrine                                                                      |
| Validation           | Workflow/function validators are supported, but raw workflow returns and event values can be left unvalidated                                                                                                                       | Require generated args/returns/event validators and explicit handler return types                                                                   | Generated runner currently uses `returns: v.any()`                                    |
| Determinism          | Handler replay restricts ambient I/O/env/crypto; `Date` and `Math.random` are patched                                                                                                                                               | Keep pure orchestration and capability steps; lint only actual restrictions                                                                         | Existing lint has wrong claims and misses the generated runner path                   |
| Kickoff mode         | `startAsync: false` runs an eager first poll in the create transaction; caught handler/validation failures can still commit a terminal failed workflow and return its ID. `startAsync: true` queues the first poll through Workpool | Generate named eager-first-poll and queued profiles; public payloads cannot pass the raw flag                                                       | Not modeled, and current proposed fail-fast language is incorrect                     |
| Capability boundary  | Steps may call public or internal Convex functions                                                                                                                                                                                  | Bind generated internal workflow-capability refs; public transports remain separate projections                                                     | Stronger, intentional policy                                                          |
| Action retry         | Opt-in/default exponential backoff and jitter; `maxAttempts` includes the initial attempt and `NonRetryableError` stops retry                                                                                                       | Retry only actions with a typed provider-native or durable-ledger-and-reconcile idempotency strategy                                                | Graph retry is validated then discarded                                               |
| Mutation semantics   | Mutations are transactional/exactly-once aside from conflict retries                                                                                                                                                                | Preserve mutation semantics; never model them as action retry                                                                                       | Node metadata does not distinguish effect/retry posture strongly enough               |
| Query/mutation retry | Convex transactions already retry safely                                                                                                                                                                                            | Do not apply action retry semantics                                                                                                                 | Must document and validate by kind                                                    |
| Parallelism          | `Promise.all` starts steps in parallel; component results commit independently and Workpool bounds execution                                                                                                                        | Compile deterministic ready waves, await the observation barrier, and expose settled outcomes in stable order                                       | Current queue is serial and proposed atomic-commit wording is too strong              |
| Backpressure         | One component Workpool applies `maxParallelism`; large fan-out should batch                                                                                                                                                         | Centralize explicit per-environment concurrency and bounded fan-out                                                                                 | No canonical config or backlog-health contract                                        |
| Nested workflow      | `step.runWorkflow` is durable, but pinned 0.4.4 drops `runAt`/`runAfter` when creating a child even though the client accepts them                                                                                                  | Add typed unscheduled subworkflows; mark scheduled children unsupported until an upstream fix/version passes                                        | Missing, with an upstream accepted-but-dropped option in 0.4.4                        |
| Inline transaction   | Queries/mutations may use `{ inline: true, transactionLimits }`                                                                                                                                                                     | Default independent; opt in only for small atomic steps                                                                                             | Missing                                                                               |
| Timers/scheduling    | `sleep`, `runAfter`, and `runAt` are durable and advisory; Workpool clamps unsupported distant/past horizons, and recorded enqueue time is not actual execution start                                                               | Reject unsupported horizons, treat schedules as not-before requests, instrument actual start inside the capability, and recheck deadlines/authority | Delay exists, but scheduling options and true lateness are not represented end to end |
| Dynamic control flow | Branches, loops, `try/catch`, and step errors replay through regular code                                                                                                                                                           | Support graph branches plus bounded batch/error policies or fail explicitly                                                                         | Cycles, batches, and compensation posture are currently implicit                      |
| Lifecycle            | start, status, cancel, restart, list, list-by-name, list-steps, cleanup, `onComplete`; callback failures are recorded                                                                                                               | Project typed, tenant-safe controls and projection-only completion through Confect                                                                  | Generated contract has start/status/approve only                                      |
| Cancellation         | Stops future work; a running action may continue                                                                                                                                                                                    | Product copy and state must state this explicitly                                                                                                   | Current lifecycle does not expose it                                                  |
| Restart addressing   | Restart by a repeated name/function selects the last matching step and truncates later journal entries                                                                                                                              | Require unique deterministic restart addresses and a destructive-effect preflight                                                                   | Current step names are not proven unique                                              |
| Cleanup              | Completed storage is not automatic; cleanup continues in batches/nested jobs, while never-awaited event records and `onCompleteFailures` are not fully exposed to cleanup in pinned 0.4.4                                           | Track Maestro-owned cleanup and known component residuals separately; never claim complete deletion without upstream evidence                       | Missing, and full component deletion is not currently provable                        |
| Version stability    | Handler shape/order/name and the deployed transitive implementation must remain compatible; a future step uses code deployed when first encountered                                                                                 | Bind each release to immutable graph, runner, runtime/interpreter closure, capability, event, and completion versions                               | Runner imports latest graph and mutable shared runtime/capability code                |
| Payloads             | Pinned 0.4.4 caps a step result at 800 KiB and the journal at 8 MiB; Workpool separately permits roughly 1,000,000-byte args/context and may include a raw preview in an oversize error                                             | Redact and size-check inside the capability before returning to Workpool; pass immutable artifact IDs for large values                              | Current after-step accounting is too late to protect the component boundary           |
| Auth context         | Async steps do not promise the original ambient request identity                                                                                                                                                                    | Snapshot a typed workflow principal and reauthorize consequential effects                                                                           | Generated kickoff auth is not enough                                                  |
| Policy/config        | Replay uses journaled args/results and restricts ambient environment reads                                                                                                                                                          | Pin versioned decision policy and check current authorization separately                                                                            | Generator passes an untyped empty snapshot                                            |
| Events               | Shared `defineEvent` contracts and stable/dynamic names; a raw EventId lookup does not itself prove ownership by the current workflow                                                                                               | Generate typed events plus workflow/generation-owned opaque approval records and validate ownership before await/send                               | Derived strings plus `null` payload                                                   |
| Execution truth      | Convex journal owns durable execution                                                                                                                                                                                               | Maestro ledger is tenant-safe product/evidence projection                                                                                           | Ownership/reconciliation is incomplete                                                |
| `Date`/`Math.random` | Upstream patches core `Date`, `Date.now()`, and seeded random, but locale/timezone-sensitive Date/Intl behavior is not fully deterministic                                                                                          | Allow the proven core subset and intentionally restrict locale/timezone-sensitive operations                                                        | Current lint explanation is both too strict and too broad                             |
| `unstableArgs`       | Advanced escape hatch for changing arguments                                                                                                                                                                                        | Disabled by default; ADR and compatibility fixture required                                                                                         | No explicit policy                                                                    |

The highest-risk repairs are transitive workflow/runtime versioning, explicit
eager/queued kickoff, principal propagation, retry/idempotency alignment,
pre-component payload/redaction budgets, and honest lifecycle cleanup. Parallel
waves, subworkflows, inline transactions, and typed events remain the long-term
supported model, but a customer alpha may ship with any unimplemented primitive
marked `intentionally-restricted` and rejected with a tested alternative.
Nothing may be accepted and dropped merely to accelerate alpha.

## Convex Semantic Enforcement Architecture

The target is not "more workflow lint." The target is a repository in which the
generated path is correct by construction, fast local checks catch structural
drift, behavioral tests prove the compiled Convex calls, runtime guards cover
data-dependent limits, and promotion checks protect active durable runs.

### Ground-Truth Corrections To Make First

- Keep `check:workflow-graph-boundary` explicitly shape-only. It proves that
  durable graphs do not depend on React Flow; it does not prove any Convex
  execution semantic. Semantic work moves to a separate
  `check:workflow-semantics` gate.
- The current workflow ESLint rules scan `packages/convex/confect/workflows/**`,
  while generated `defineWorkflow` handlers are written under
  `packages/convex/convex/workflowRunners/**`. Correct the scope and use exact
  kit/generated exemptions; do not claim fixture coverage protects a path the
  rule never sees.
- Correct `workflow-handler-determinism`: upstream intentionally patches `Date`
  and seeds `Math.random`, but does not fully normalize
  locale/timezone-sensitive Date/Intl behavior. Allow only the proven
  deterministic subset. Continue to forbid ambient fetch, environment, crypto,
  database, scheduler, and other I/O inside replay handlers. Do not create false
  confidence with an alias-sensitive regex rule; the normal path imports no raw
  workflow primitives at all.
- Replace the generated runner's `returns: v.any()` with generated args/return
  validators and an explicit handler return type. Typed Confect contracts do not
  compensate for an unvalidated component journal boundary.
- Model `startAsync` through versioned, named kickoff profiles. A generated
  authenticated mutation owns the idempotency reservation and start; a public
  payload never toggles raw eager-first-poll/queued semantics. A caught eager
  handler/validation failure stays bound to its committed terminal workflow ID;
  only a transaction that creates no workflow releases the reservation.
  Interactive and bulk profiles may target the same immutable runner without
  duplicating it.
- Protect more than the graph file. Completed step results are journaled, but a
  future step still invokes its deployed function. Published workflows must bind
  versioned workflow-callable capability, completion, and runtime/interpreter
  refs, with a fingerprinted transitive source/deployed-bundle closure and
  preserved old bindings for active and restartable runs.
- Replace the flat node schema, where every node carries retry fields, with a
  discriminated union. An action retry, inline transaction, event validator,
  child workflow version, or schedule option should only exist on the node kind
  that can execute it.
- Replace `assertJsonSafe` at durable boundaries with generated Convex-value
  validators plus `getConvexSize`. A generated capability return wrapper must
  redact thrown failures and reject/persist oversized values before Workpool or
  Workflow receives them; an after-step guard is accounting, not the first safe
  boundary. JSON conversion belongs at CLI/MCP/export projections. A JSON-only
  workflow subset, if desired, is an explicit compatibility restriction and ADR
  rather than an accidental helper policy.
- Require unique deterministic restart addresses. Repeated/batched logical
  instances derive a stable instance suffix from validated input identity or
  ordinal, never from attempt, wall-clock time, or ambient randomness.
- Mark scheduled subworkflows unsupported on pinned Workflow 0.4.4. The client
  accepts scheduling options that the component drops. A named sleep followed by
  an unscheduled child is an available but explicitly non-equivalent repair;
  native support requires a tested upstream fix/version.
- Treat component cleanup evidence honestly. Track known Maestro-owned cleanup,
  component continuation/nested cleanup, and unexposed component residuals as
  separate states. Never claim physical deletion of never-awaited events or
  `onCompleteFailures` on 0.4.4.
- Validate EventId ownership by workflow, generation, workspace, and approval
  instance before await/send. A raw component EventId is never sufficient
  authority.
- Reject unsupported scheduling horizons instead of inheriting Workpool's silent
  clamping. Record actual start/lateness inside the capability wrapper, not from
  journal/enqueue timestamps.

### The No-Silent-Downgrade Contract

Add one machine-readable TypeScript contract at
`packages/template-core/src/workflow-semantics/contract.ts`. Generate the human
reference from it; do not maintain a second prose list. Every official primitive
and every Maestro graph field records:

- a stable semantic rule ID and pinned upstream version/source;
- support status: `supported`, `intentionally-restricted`, or `unsupported`;
- the authoring constructor and allowed node/capability kinds;
- the exact Convex call/option it compiles to;
- its static gate and behavioral fixture IDs;
- any runtime assertion or promotion check;
- the user-facing repair/alternative when restricted or unsupported.

`check:workflow-semantics` fails when a graph/schema field has no contract
entry, a supported entry has no compiler mapping or conformance fixture, a
generated workflow bypasses the builder/registry, or an unsupported field
reaches output. This is the permanent regression test for the current
accepted-but-discarded retry bug.

### Enforcement Layers

| Layer                         | What it should prove                                                                                           | What it must not claim                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Pinned compatibility contract | The exact Convex/Workflow/Workpool versions and supported option shapes                                        | That a future dependency version behaves the same                  |
| Typed builders and generators | Invalid combinations are unrepresentable and the happy path is complete                                        | External idempotency or runtime payload size                       |
| ESLint and import boundaries  | No raw workflow/component escape, forbidden replay I/O, or direct adapter step                                 | Replay behavior, tenant authorization, or publication immutability |
| Static/base-aware CI gates    | Registry completeness, hashes, versions, validators, ownership, migrations, and unchanged published artifacts  | Live active-run state or external provider behavior                |
| Behavioral conformance tests  | Exact `step.*` calls/options, replay, faults, concurrency, cancellation, and cross-tenant outcomes             | Production deployment health                                       |
| Runtime guards                | Pre-component redaction/size, principal reauthorization, idempotency reservation, EventId ownership, retention | Source/release history                                             |
| Promotion checks              | Active-run census, dependency compatibility, migrations, deployment/provider evidence                          | Code quality already covered below                                 |

### What Lint Must Not Do

- Do not infer that an action is idempotent from its name, comments, or the
  presence of an `idempotencyKey` field. Require typed metadata plus a
  duplicate-delivery fixture.
- Do not infer whether two business steps should be parallel from adjacent
  `await` syntax. Graph dependencies define readiness and the compiler enforces
  waves.
- Do not estimate Convex payload limits with regex, AST literals, or JSON
  length. Generated validators and runtime `getConvexSize` own that proof.
- Do not infer tenant/principal correctness from parameter names. Compare
  generated public/internal schemas and run adversarial cross-tenant behavior.
- Do not declare a workflow version immutable because a file has a `v1` path.
  Compare canonical semantic fingerprints against a trusted base/release.
- Do not parse arbitrary prose to decide whether an ADR, compensation, or
  provider policy is good. Gates validate declared structure and evidence;
  human/agent review owns judgment.

### Rule-By-Rule Enforcement

| Concern                         | Correct-by-construction path                                                                                                                         | Deterministic proof                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Args, returns, and replay       | Generated Convex-value validators, explicit handler return types, pure graph compiler                                                                | Typecheck plus generated-runner conformance; lint only actual ambient I/O/env/crypto                                            |
| Immutable versions and names    | `v<N>` graph/runner/runtime/event/completion bundle, versioned workflow-capability bindings, and unique restart addresses                            | Trusted publication-manifest comparison rejects transitive closure drift; active-run fixtures keep resolving old refs           |
| Principal propagation           | Reserved server-injected `WorkflowPrincipal`; child workflows inherit or narrow it                                                                   | Public/internal schema diff, cross-tenant fixtures, and runtime reauthorization before consequential effects                    |
| Policy snapshot                 | Workflow declares `none` or a generated versioned policy schema/resolver; kickoff pins ID/hash                                                       | Mid-run policy-change/restart fixtures plus gate forbidding latest-policy reads in replay                                       |
| Retry and idempotency           | Only actions with a typed provider-native or durable-ledger-and-reconcile strategy expose retry; provider calls receive a branded logical-effect key | Exact options, duplicate/ambiguous-failure fixture, terminal-error mapping, and dedupe-window proof; global retry remains off   |
| Mutation semantics              | Mutation nodes never expose action retry and retain Convex transaction guarantees                                                                    | Node-union/type rejection plus exact `runMutation` fixture                                                                      |
| Payload budgets                 | Immutable/content-addressed artifact references for large values; generated pre-return plus per-step/cumulative budgets                              | Capability-boundary size/redaction fixtures, then accounting fixtures against Workflow and Workpool ceilings                    |
| Parallel steps                  | Graph dependencies compile every ready wave together; Workpool is the only execution limiter                                                         | Deferred-promise conformance proves concurrent start and stable next-wave observation without claiming atomic component commits |
| Backpressure and batching       | One component config, bounded fan-out, and workspace-scoped start admission without a second scheduler                                               | Config uniqueness, noisy-neighbor/admission fixtures, max-item bounds, and live backlog evidence                                |
| Subworkflows                    | Typed registry key plus exact child/runtime version, stable name, principal, payload, and cancellation policy; scheduling restricted on 0.4.4        | Parent/child success, typed return, failure, cancel, restart, cleanup, and scheduled-child rejection fixtures                   |
| Inline transactions             | Only query/mutation builders expose inline; explicit transaction limits are required; no schedule options                                            | Type-negative tests and exact `inline`/`transactionLimits` invocation fixture                                                   |
| Timers and scheduling           | Named delay plus typed `runAfter`/`runAt` not-before posture with bounded horizons; never fabricate unsupported `sleepUntil`                         | Exact options, clamp-boundary rejection, and actual capability-start/deadline/lateness evidence                                 |
| Typed events                    | Shared generated `defineEvent` or product-owned opaque approval ID mapped internally to an EventId, validator, correlation key, and sender wrapper   | Wrong-workflow/generation/tenant rejection plus pre-send/concurrent-event isolation; no raw public EventIds                     |
| Lifecycle and cleanup           | Generator emits typed start/status/cancel/quiesce/restart/list/listSteps/completion plus Maestro-owned and component-residual cleanup states         | State-machine/property fixtures, in-flight generation census, retention refusal, and explicit unprovable-residual status        |
| Error and compensation          | Typed expected errors; explicit fail/error-edge/compensation policy; compensations are idempotent capabilities                                       | Fault matrix proves replay and order; never claim external side effects roll back automatically                                 |
| Kickoff and start deduplication | Named eager-first-poll/queued profiles and workspace-scoped reservation inside an authenticated mutation                                             | Exact per-profile `startAsync` assertion; committed terminal failures retain one canonical workflow/reservation                 |
| Execution truth                 | Convex journal owns execution; Maestro run/evidence tables are idempotent projections                                                                | Reconciliation repairs projections without replaying completion callbacks or provider effects                                   |
| Escape hatches                  | `unstableArgs` and raw workflow primitives are unavailable by default                                                                                | ADR reference, compatibility fixture, exact allowlist entry, and release review are all required                                |

### Developer And Agent Fast Path

1. `template:add-workflow` emits the versioned bundle, validators, lifecycle,
   principal plumbing, registry entry, semantic rule coverage, and focused test.
2. The editor runs TypeScript and ESLint. Most invalid authoring combinations
   fail before save because the builder does not expose them.
3. A changed-workflow Lefthook command runs `pnpm check:workflow:fast` before
   commit. It covers lint, type/schema construction, generated drift, and the
   semantic contract without starting a backend.
4. Pre-push and CI run `pnpm check:workflow-semantics`, the base-aware workflow
   immutability check, generated workflow conformance, compatibility, migration,
   and normal repository gates.
5. Promotion runs the live active-run/version census and environment/provider
   proof. CI never impersonates this live check.
6. Every finding prints its semantic rule ID, offending workflow/node, canonical
   reference, why the rule exists, the generator or file to change, and the
   exact focused rerun command.

No agent hook blocks tools or rewrites prompts. Humans and agents can still edit
normal code; the generated API makes the safe form easiest, and deterministic
gates reject an invalid artifact at the same boundaries used by CI and release.

The workflow ledger does not replace baseline Convex application rules. Phase 0
also inventories existing Confect/quality coverage for: concrete args/returns,
public versus internal exposure, authenticated tenant derivation, action versus
query/mutation runtime boundaries, Node-only imports and `"use node"`, internal
scheduler refs, indexed/bounded query access, pagination, and component API
isolation. Add only missing high-confidence structural gates; dynamic query
cost, authorization, and production behavior remain behavioral/runtime/promotion
evidence rather than AST claims.

## Adjacent Application Structure To Keep Strict

Workflow enforcement is only useful if a generated step can still bypass the
rest of the application architecture. Keep these existing repository laws in the
same diagnostic/gate system; do not rebuild them inside the agent pack.

| Invariant               | Correct path                                                                                                                                                                | Blocking proof                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Layer ownership         | Routes -> screens -> features -> blocks; workflows -> capabilities -> domain/services -> adapters                                                                           | `check:layer-boundaries`, frontend Effect boundary, and exact import fixtures                      |
| Tenant and identity     | Public args omit reserved identity; authenticated wrappers derive workspace/principal; every durable read/write scopes through the owning contract                          | Generated public/internal schema comparison, access/audit gate, and cross-tenant tests             |
| Typed contracts/errors  | Confect specs define args, returns, expected tagged errors, and generated refs; implementations keep all declared failures reachable                                        | Confect contract/version gates, typecheck, and contract behavior tests                             |
| Durable data ownership  | Every table/resource has one canonical system, tenant scope, indexes, sensitivity, retention/export/delete, migration, and rollback posture                                 | Table generator, system/data-resource/topology gates, migration notes, and lifecycle tests         |
| Consequential effects   | Capability metadata declares effect class, approval, retry strategy/dedupe horizon, quota/rate, spend/kill-switch, and redaction posture or explicit not-applicable reasons | Manifest/contract gates plus duplicate, denial, ambiguity, and provider-fault behavior tests       |
| Provider isolation      | Capabilities call Effect services; live SDKs, tokens, and provider payloads stay in adapters                                                                                | Provider/env/secret/logging boundaries plus fake/doctor behavior tests                             |
| Inbound provider events | Adapter verifies authenticity before parsing or tenant routing, deduplicates provider event IDs, and maps into typed capabilities/workflows                                 | Signature, replay, cross-tenant, out-of-order, payload-reference, and secret-canary fixtures       |
| Web and headless parity | Web, API, CLI, and MCP project the same generated capability/workflow refs and authorization                                                                                | Headless registry/manifest gate and transport parity fixtures                                      |
| Generated ownership     | Generated Confect/Convex/workflow files carry provenance and change through generators/version bumps                                                                        | Generated-file drift, generator smoke, semantic coverage, and upgrade collision gates              |
| Release truth           | Fake, local, dev, preview, staging, and production are separate provider/evidence postures                                                                                  | Build Readiness, commit/environment receipts, provider doctors, hosted smoke, and promotion checks |

For all of these, the same proof rule applies: types/lint cover structure,
behavioral tests cover outcomes, runtime checks cover dynamic authority/data,
and promotion receipts cover live external state. No single gate is relabeled as
proof of all four.

## Target Product Architecture

```text
Claude Code / Codex / another capable host agent
                    |
          small Maestro core skill
                    |
      conditional recipe/provider references
                    |
              Maestro CLI
     preflight / scaffold / verify / map / impact / adr / start
                    |
          thin MCP transport (optional)
                    |
  existing generators, registries, gates, and release tooling
                    |
       canonical Maestro application architecture
                    |
       Convex + Confect + Effect + provider adapters
```

Strict gates sit below the agent and inspect outputs. Skills provide context
above the agent. There is no second reasoning layer between the user and their
coding agent.

## Delivery Shape And Stack Discipline

Each phase below gets its own stack-plan manifest under
`docs/superpowers/plans/manifests/`. Each manifest has at most four slices and
is checked with:

```bash
pnpm stack:check docs/superpowers/plans/manifests/<phase>.json
```

Every work package is labeled `fixture-to-real`, `pattern-instance`, or
`template-gap`. `template-gap` packages add a durable `AP-*` entry to
`docs/template/porting-backlog.md` before implementation and name the promotion
path. Generator-backed packages dry-run before `--write` and follow the matching
`docs/template/how-to-add-*` playbook. Each completed slice runs focused gates;
each phase ends with `just verify`.

## Phase 0: Doctrine Correction And Compatibility Fixtures

Goal: establish one canonical product contract and make the upstream Convex
semantics executable before expanding distribution surfaces.

### WP-0.1 Canonicalize the approved product specification

- **Kind:** `template-gap`
- **Backlog:** `AP-001 agent-pack canonical product contract`
- **Dependencies:** none

**Files**

- Copy the prior spec to
  `docs/superpowers/specs/2026-07-10-maestro-agent-pack-design.md`.
- Amend the canonical copy with the factory-source/template-release/customer-
  target contract, the `create -> start -> add -> check` alpha promise, and the
  minimum-necessary-primitive ladder. Preserve the source prior-art file
  unchanged.
- Add `AP-001` through `AP-014` headings to `docs/template/porting-backlog.md`
  for the productization gaps in this plan.
- Update `docs/template/porting-roadmap.md` with the phase ordering and the rule
  that workflow correctness precedes public pack distribution.
- Keep this plan as the execution index; do not duplicate its detail into the
  copied product specification.

**Resolution path:** promote the approved prior-art spec into the canonical repo
and link it from the roadmap.

**Focused gates**

```bash
pnpm exec prettier --check docs/superpowers/specs/2026-07-10-maestro-agent-pack-design.md docs/template/porting-backlog.md docs/template/porting-roadmap.md
git diff --check
```

**Acceptance**

- The canonical repo contains the complete approved product contract.
- The contract distinguishes the canonical factory from the shipped customer
  target and names the single customer creation front door.
- The source spec under `/Users/lappy/maestro-template` is unchanged.
- All later template gaps have stable backlog references.

**Migration / rollback:** documentation-only. Revert the canonical copy and
roadmap entries; never remove the source prior art.

### WP-0.2 Record the Maestro-over-Convex workflow decision

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-0.1

**Files**

- Add `docs/template/adr/0002-maestro-graph-over-convex-workflow.md`.
- Add `docs/template/convex-workflow-compatibility.md` containing the pinned
  compatibility matrix, upstream links, supported primitives, and deliberate
  stricter policies.
- Update `docs/template/workflow-authoring-guide.md` and
  `docs/template/how-to-add-workflow.md` to link to that document.
- Correct the scope and claims in
  `tooling/eslint-plugin-template/rules/workflow-handler-determinism.mjs` and
  its RuleTester fixtures. Do not claim upstream cannot deterministically
  support core `Date` or `Math.random`; intentionally restrict locale/timezone
  Date/Intl operations that pinned source does not normalize.
- Correct the compatibility reference for eager-first-poll versus queued start,
  scheduled-child option loss in 0.4.4, pre-component payload redaction,
  incomplete component cleanup, Workpool schedule clamping/actual-start truth,
  EventId ownership, terminal retry errors, and mutable transitive runtime
  closures.

**Resolution path:** promote the compatibility decision into a consequential ADR
and one canonical workflow reference.

**Focused gates**

```bash
pnpm --dir tooling/eslint-plugin-template test
pnpm check:workflow-graph-boundary
pnpm check:docs-freshness
```

**Acceptance**

- Docs clearly distinguish Maestro doctrine from current implementation gaps.
- Hard rules cover real forbidden effects such as ambient I/O, database,
  scheduler, and environment access in replay handlers.
- Deterministic upstream `Date`/random behavior is either allowed or documented
  as an intentional Maestro restriction, never misrepresented as an upstream
  limitation.
- No document calls `startAsync: false` fail-fast, claims scheduled children are
  supported on 0.4.4, or claims full component deletion can be proven.

**Migration / rollback:** preserve ADR history. If the decision changes, mark
ADR 0002 superseded rather than rewriting its accepted record.

### WP-0.3 Add a pinned Convex compatibility matrix

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-0.2

**Files**

- Add `tooling/convex-compat/package.json`, `tsconfig.json`, and
  `src/matrix.test.ts`.
- Add fixtures under `tooling/convex-compat/__fixtures__/` for the current and
  candidate version sets.
- Replace caret ranges for Workflow/Workpool in `packages/convex/package.json`
  with the exact tested set; keep `tooling/effectified-api-proof/package.json`,
  `convex-test`, Convex, and the lockfile synchronized through the
  compatibility/config-drift gate.
- Add `docs/template/convex-compatibility.json` as the machine-readable tested
  set for Convex, Workflow, Workpool, `convex-test`, `@convex-dev/migrations`,
  Confect, Effect, the official agent-skills commit, and the exact skills
  installer version.
- Extend `tooling/quality/check-confect-compat.mts` and its tests to read the
  compatibility file instead of maintaining a parallel version assertion.
- Add `test:convex-compat` and `check:convex-compat` scripts to `package.json`
  and the corresponding Just recipe.
- Snapshot the pinned public option/tool inventory and the source-level
  regression facts relied on by Maestro: scheduled-child option propagation,
  start failure behavior, payload preview behavior, cleanup residuals, EventId
  lookup ownership, Workpool schedule clamps, `NonRetryableError`, and known
  0.4.7 duplicate-completion/cancel cases.

**Resolution path:** promote ad hoc dependency knowledge into an executable
matrix. Test Workpool `0.4.8`; do not upgrade merely because it is newer.

**Focused gates**

```bash
pnpm --dir tooling/convex-compat test
pnpm check:confect-compat
pnpm check:config-drift
```

**Acceptance**

- The current pinned set passes.
- The candidate set reports pass/fail without modifying the working lockfile.
- A version bump is impossible without updating the compatibility record and
  passing its fixtures.
- Workpool 0.4.7 cannot be marked production-supported unless fixtures prove
  Maestro avoids its duplicate-completion/cancel regressions; otherwise the
  tested fixed candidate is required.
- A fresh frozen install resolves the exact declared engine set. Dependency
  automation may open a candidate change but cannot merge or float it around the
  matrix/semantic fixtures.

**Migration / rollback:** the current versions remain the fallback. A candidate
upgrade is a separate commit after both matrix and full verification pass.

### WP-0.4 Build behavioral workflow conformance fixtures

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-0.3

**Files**

- Add `packages/convex/test/workflow-conformance.test.ts`.
- Add focused pure-runner fixtures under
  `packages/convex/test/fixtures/workflows/`.
- Add component-backed fixtures using `convex-test` and the pinned
  `@convex-dev/workflow/test` `register()` helper. Mock steps assert exact
  compiler calls; the registered component proves journal/lifecycle behavior.
- Extend `tooling/generators/src/workflow-output-smoke.ts` and
  `tooling/generators/src/index.test.ts` so generated workflows must prove the
  supported semantic contract.
- Add a reusable test helper under
  `packages/convex/test/helpers/workflowHarness.ts` only if the first fixture
  demonstrates repeated setup.

**Resolution path:** promote workflow correctness from source-shape assumptions
to generated and behavioral conformance.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm --dir tooling/generators test
pnpm template:workflow-output-smoke
```

**Acceptance**

- The test suite stays green. Known implementation gaps are represented by
  passing characterization tests and `unsupported`/`intentionally-restricted`
  ledger assertions, never by red tests committed in anticipation of Phase 1.
- Adversarial fixtures assert rejection or a named finding for dropped retry
  settings, serial-only execution, unversioned step names, invalid/unvalidated
  Convex values, and missing principal context.
- Actual-component fixtures cover eager-first-poll and queued kickoff,
  event-before-wait, parallel dispatch, subworkflow cancellation, duplicate-name
  restart selection, restart journal truncation, `onComplete` failure, list
  pagination, batched cleanup, and asynchronously continued nested cleanup.
  Mocks alone cannot satisfy those rules. The kickoff fixture uses
  eager-first-poll terminology and proves that a caught initial failure can
  commit a terminal workflow ID.
- Passing characterization/support fixtures become the executable definition for
  Phase 1. Flipping a rule to `supported` requires its positive compiler and
  behavior fixture in the same change.

**Migration / rollback:** fixtures are additive. If an upstream version changes
behavior, update the compatibility ADR and matrix before changing expected
results.

### WP-0.5 Install the executable workflow-semantics enforcement spine

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-0.4

**Files**

- Add `packages/template-core/src/workflow-semantics/contract.ts`, schema/tests,
  and a generated Markdown projection under `docs/template/generated/`.
- Add `tooling/quality/check-workflow-semantics.mts`, adversarial fixtures, and
  tests; register `check:workflow-semantics` and `check:workflow:fast` through
  `package.json`, the Justfile, the canonical gate registry, and CI
  completeness.
- Correct `workflow-handler-determinism.mjs`,
  `workflow-steps-are-capabilities.mjs`, and `workflow-policy-snapshot.mjs` to
  cover the real generated runner path and exact interpreter seams, recognizing
  both the generated `defineMaestroWorkflow(...).handler` form and raw upstream
  form used only in compatibility fixtures.
- Add `no-raw-workflow-primitives.mjs` so application code cannot instantiate a
  second `WorkflowManager`, import lifecycle/event helpers directly, or
  hand-roll `defineWorkflow` outside the generated runtime boundary.
- Enable the corrected rules in `eslint.config.mjs` for generated runners,
  workflow kit code, and application call sites with explicit file-scoped
  exemptions for compatibility proofs/tests only.
- Update `lefthook.yml`, `.buildkite/scripts/phase1.sh`, and pipeline command
  inventory/self-protection fixtures with the fast/local and full/CI gates.
- Update `AGENTS.md` outside any Convex-managed marker plus
  `docs/template/how-to-add-workflow.md` with the one authoring door, fast gate,
  semantic rule diagnostics, and raw-primitive escape policy. Link to generated
  semantics docs instead of copying the matrix.
- Extend generator smoke output with a semantic coverage manifest keyed by rule
  ID rather than string-only source assertions.
- Add a Confect-supported plain-function generation extension for component
  workflow runners. Runner source lives in the Confect spec/impl tree and
  Confect codegen owns the projection under `convex/workflowRunners/**`; no
  workflow generator writes an orphan file that a later Confect sync deletes.
- Add a destructive-sequence fixture that runs workflow generation, Confect
  codegen, Convex codegen, typecheck, and runner existence/fingerprint checks in
  that order.
- Inventory existing baseline Convex/Confect gates for function validators and
  returns, public/internal exposure, tenant derivation, action/query/mutation
  boundaries, Node runtime imports, scheduler refs, indexed/bounded queries,
  pagination, and component isolation. Register only missing high-confidence
  rules through the same diagnostic/gate registry.

**Enforcement contract**

- Every node field and official primitive is `supported`,
  `intentionally-restricted`, or `unsupported` with a repair alternative.
- Every supported field names its typed constructor, compiler mapping, fixture,
  runtime guard if any, and canonical documentation.
- The raw Convex Workflow import allowlist is exact, path-based, and tested. It
  has no per-project wildcard or inline suppression path.
- `check:workflow-graph-boundary` remains shape-only and is never used as a
  semantic acceptance gate.
- A dependency upgrade cannot change limits/options until the pinned
  compatibility and semantic contract fixtures pass together.

**Resolution path:** promote the audited upstream semantics into one executable
support ledger and dedicated gate, then make generators and runtime builders
consume that ledger instead of maintaining parallel assumptions.

**Focused gates**

```bash
pnpm --dir tooling/eslint-plugin-template test
pnpm --dir packages/template-core test workflow-semantics
pnpm check:workflow-semantics
pnpm check:workflow:fast
pnpm check:ci-completeness
```

**Acceptance**

- Adding a graph field without a semantic rule/mapping/fixture fails.
- A real generated runner containing forbidden ambient I/O or a raw non-kit
  workflow import fails; the same rule is not merely proven in RuleTester text.
- Confect and Convex codegen preserve/reproduce every registered generated
  runner, and deleting the registration or output fails the sequence fixture.
- `Date` and seeded `Math.random` are not falsely described as unsupported.
- Removing the semantic gate from local, root verify, or CI inventories fails
  self-protection.
- Diagnostics identify the rule, reason, repair path, and focused rerun.

**Migration / rollback:** add the contract and gate before changing graph V2.
Rollback may disable an unshipped rule while preserving its support record; do
not remove the registry or silently reclassify a failing semantic as supported.

## Phase 1: Convex Workflow Runtime Correctness

Goal: make the opinionated graph compiler a faithful, safe user of native Convex
Workflow primitives. This phase blocks advertising or generating each workflow
primitive as supported. A workflow-optional CRUD walking-skeleton alpha may run
earlier only when the ledger rejects every unimplemented workflow primitive and
the alpha makes no workflow-compatibility claim.

### WP-1.1 Introduce a backward-compatible durable graph schema v2

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** Phase 0

**Files**

- Update `packages/convex/confect/workflows/graphNodeSchema.ts`,
  `graphSchema.ts`, `graph.ts`, `graphValidation.ts`, and tagged validation
  errors.
- Add `packages/convex/confect/workflows/graphMigration.ts` with an explicit v1
  to v2 decoder/migrator.
- Add typed constructors under
  `packages/convex/confect/workflows/_kit/workflowBuilder.ts` and negative type
  fixtures that prove invalid per-kind options are unavailable.
- Add `packages/convex/confect/workflows/_kit/defineMaestroWorkflow.ts` as the
  sole application-facing wrapper around the raw component definition. It
  requires validators, semantic coverage, version metadata, principal policy,
  and centralized Workpool configuration.
- Add the versioned `WorkflowPrincipal` and policy-posture schemas plus
  public/internal reserved-field projections under
  `packages/convex/confect/workflows/_kit/principal.ts` and `policySnapshot.ts`.
  WP-1.9 completes persistence and reauthorization; child workflow typing must
  not depend on a future, undefined principal contract.
- Add the Confect-owned plain-runner registration source/template. Confect
  codegen, not a parallel generator, projects the actual
  `convex/workflowRunners/**` file.
- Extend generator graph output in `tooling/generators/src/index.ts` and its
  snapshot/behavior tests, including generated args/return validators and an
  explicit runner return type.

**Contract**

- Preserve legacy `{ maxAttempts, backoffMs }` only in the v1 decoder.
- Replace the flat node struct with a discriminated union. Retry exists only on
  action capability nodes; inline/transaction limits only on query/mutation
  nodes; event validators only on event nodes; child version only on subworkflow
  nodes; scheduling only on eligible non-inline nodes.
- V2 action retry uses `{ maxAttempts, initialBackoffMs, base }` and is absent
  by default.
- Add explicit transaction posture for query/mutation nodes: `independent` or
  `inline` with optional `transactionLimits`.
- Add `subworkflow` as a first-class node kind. On pinned 0.4.4, the builder
  refuses scheduling options on a child and points to a named sleep followed by
  an unscheduled child as an explicitly non-equivalent alternative.
- Add generated, versioned `kickoffProfiles`: a default interactive
  eager-first-poll profile and optional explicitly named queued profiles for
  bulk/system starts. Each profile owns a generated start mutation; caller
  payloads cannot override its mode. Also add stable `stepName`, typed event
  identity, and payload policy fields.
- Require each restartable step address to be unique within the compiled
  execution. Bounded repeated work derives deterministic instance suffixes from
  validated item identity or ordinal.
- Require an explicit policy posture: generated versioned snapshot
  schema/resolver or `none` with a reason. Remove the untyped
  `policySnapshot: {}` generator placeholder.
- Require named args and return validators for every generated workflow; remove
  `returns: v.any()` from the generated runner and require an explicit handler
  return annotation.
- Type step envelopes/results as validated Convex values. JSON-safe envelopes
  are produced only when crossing the CLI/MCP/export boundary.
- Generated runners import `defineMaestroWorkflow`, not `@convex-dev/workflow`
  directly. Raw component imports remain limited to the exact kit, compatibility
  proof, and tests.
- Capability nodes bind only generated internal workflow-exposure refs from the
  versioned registry, never a public API/CLI/MCP function, arbitrary function
  handle, or string. Public wrappers may share the same Confect/domain contract,
  but they are not the durable step boundary.
- Treat `unstableArgs` as false/absent unless an approved ADR reference is
  present in the graph metadata.
- Attach a semantic rule ID to every nontrivial option so coverage can be
  checked without parsing prose.
- Require exactly one source and terminal output for the default contract, all
  executable nodes reachable, no outgoing output edge, no dangling branch, and
  every success path converging before output. Alternate terminal/error outcomes
  must be explicit typed terminals, not detached work.
- Restrict `any` joins to a typed mutually-exclusive branch construct or an
  explicit reviewed loser policy. They are not a generic `Promise.race` over
  already-started external effects.

**Resolution path:** promote the V2 graph schema, migrator, and generator
contract together; retain the V1 decoder as the compatibility adapter until its
tagged support window closes.

**Focused gates**

```bash
pnpm --dir packages/convex test workflows
pnpm check:workflow-semantics
pnpm check:workflow-graph-boundary
pnpm --dir tooling/generators test
```

**Acceptance**

- Existing v1 graphs decode without changing behavior.
- Invalid kind/retry/inline/event combinations and public/arbitrary step refs
  fail before workflow start.
- Type-negative fixtures cannot construct invalid combinations.
- Duplicate/unstable restart addresses and a caller-supplied kickoff mode fail
  before workflow start.
- Generator output uses V2, unique stable names, runtime validators, and no
  `v.any()` workflow result boundary.
- Generated source survives the complete workflow -> Confect -> Convex codegen
  sequence and produces one owned runner path.

**Migration / rollback:** retain the v1 decoder for at least one tagged template
compatibility window. Rollback uses the prior runtime while v2 data remains
unpublished; never downgrade a graph after a v2 run starts.

### WP-1.2 Carry retries through an explicit idempotency contract

- **Kind:** `fixture-to-real`
- **Target:** retry fields in the durable graph runner are currently validated
  but discarded
- **Dependencies:** WP-1.1

**Files**

- Update `packages/convex/confect/workflows/_kit/graphRunner.ts`,
  `graphRunnerNodes.ts`, and `graphValidation.ts`.
- Extend generated capability registry entries in
  `tooling/generators/src/index.ts` with function kind, effect class, retry
  strategy, idempotency-key mapper, dedupe-retention horizon, approval posture,
  quota/rate and spend/kill-switch posture (or typed not-applicable reasons),
  redaction policy, and evidence/test references.
- Generate the workspace-scoped `workflowEffectReservations` data resource and
  Confect table/capabilities through the table generator. It records logical
  effect identity, strategy, reservation/submission/confirmation/ambiguous/
  terminal state, provider correlation, reconciliation state, and expiry without
  storing a raw provider payload.
- Add retry/idempotency cases to
  `packages/convex/test/workflow-conformance.test.ts`, including duplicate and
  ambiguous-failure injection.

**Implementation**

- Every external-effect action declares exactly one strategy: `provider-native`,
  `durable-ledger-and-reconcile`, or `non-retriable`. A boolean
  `idempotent: true` is not an accepted contract.
- `provider-native` requires proof that the generated key reaches the provider,
  duplicate-delivery fixtures, and a provider dedupe-retention window at least
  as long as Maestro's maximum retry plus restart window.
- `durable-ledger-and-reconcile` reserves the logical effect transactionally
  before dispatch, records provider correlation, and treats an ambiguous
  response as reconciliation work rather than permission to call again. A retry
  proceeds only when the ledger/provider check proves that re-dispatch is safe
  or reuses the same provider-native key.
- `non-retriable` permits one attempt. Ambiguous completion becomes a typed
  manual/reconciliation outcome or a new business intent; it is never retried by
  changing the attempt number.
- Keep `retryActionsByDefault: false` in the one generated WorkflowManager/
  Workpool configuration. A per-step explicit policy is the only retry path.
- Map V2 retry to Convex `{ retry: { maxAttempts, initialBackoffMs, base } }`.
  Record that `maxAttempts` includes the initial attempt.
- Give every step a stable generated `name`.
- Queries and mutations use Convex transactional behavior and reject action
  retry configuration.
- External-effect actions receive a branded, workspace-scoped idempotency key
  and must declare where deduplication occurs, how concurrent generations are
  serialized or deduplicated, and when the reservation expires. A declaration is
  structural evidence, not proof; duplicate-delivery and ambiguous-failure
  fixtures are required before retry is enabled.
- Approval, current authorization, rate/quota, spend, and kill-switch checks
  execute inside the capability boundary before the provider call. Retry reuses
  the logical effect/spend reservation and cannot bypass or double-charge those
  guards.
- Derive the effect key from workflow run/version, stable step name, and logical
  instance/correlation key, never from attempt number. Replay and restart of the
  same logical step reuse it; a genuinely new effect requires a new business
  intent/workflow key.
- `retry: false` means no automatic action retry. It must never be described as
  exactly-once external execution.
- Map expected business failures to typed capability results. Map safe terminal
  infrastructure/provider failures to the pinned Workpool `NonRetryableError`,
  after redaction, so known-terminal failures do not burn remaining attempts.
  Unknown/ambiguous failures follow the declared strategy; they are not guessed
  retryable from an exception name.
- Replace the product stage's hard-coded `attemptNumber: 1` claim. Distinguish a
  logical step invocation from Workpool/provider attempts; project the real
  count when the pinned API exposes it and otherwise record `unknown`, never a
  fabricated number.
- Surface a repair-oriented validation error naming the node, capability, and
  missing idempotency declaration.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm check:workflow-semantics
pnpm check:confect-contracts
pnpm check:workflow-graph-boundary
```

**Acceptance**

- Tests inspect the exact options passed to `step.runAction`.
- `non-retriable` actions and strategies whose dedupe window is shorter than the
  restart window cannot be retried or declared restart-safe.
- Query/mutation behavior is not conflated with action retry.
- Concurrent duplicate starts/effects resolve to one reservation or one
  provider-side idempotent outcome in the fixture.
- Ambiguous-before-send, ambiguous-after-provider-acceptance, terminal-error,
  expired-dedupe-window, and concurrent duplicate-generation fixtures exercise
  all three strategies without a duplicate external effect.
- Fault injection proves a retry cannot bypass approval, rate/spend denial, or
  the provider idempotency reservation.
- Receipts do not claim an action attempt count the component cannot prove.

**Migration / rollback:** legacy nodes remain one-attempt. Roll back by
disabling retry in registry metadata; never reduce attempts on an
already-started version. The effect-reservation resource is additive and remains
readable/reconcilable through its declared dedupe/restart retention window even
if new retries are disabled.

### WP-1.3 Compile deterministic parallel ready waves

- **Kind:** `fixture-to-real`
- **Target:** `graphRunnerExecution.ts` serial queue
- **Dependencies:** WP-1.2

**Files**

- Update `packages/convex/confect/workflows/_kit/graphRunnerExecution.ts` and
  `graphRunnerTraversal.ts`.
- Update observed-stage ordering in `observedStage.ts` and
  `observedStagePayload.ts` without using completion timing as semantic order.
- Add one generated Workpool configuration boundary and environment posture
  under `packages/convex/confect/workflows/_kit/workpoolConfig.ts`; workflows
  consume it rather than constructing managers with divergent limits.
- Add fork/join, condition, failure, and replay fixtures.

**Implementation**

- Compute the complete ready wave from the same immutable traversal snapshot.
- Sort by declared graph order and stable node ID before dispatch.
- Dispatch a success-only wave with `Promise.all`. This is a handler observation
  barrier, not an atomic commit: component step results commit independently.
  The runner exposes the completed outcomes to graph traversal in stable order
  only after the whole observation barrier resolves.
- Compile error-edge and compensation-aware waves through typed settled
  outcomes/`Promise.allSettled`, then transition in stable graph order. The
  component journal may contain successful sibling results when another step
  fails; replay reuses them rather than pretending the wave rolled back.
- Preserve explicit all/any join semantics. A later Maestro graph wave does not
  advance from partial outcomes even though the component journal can already
  contain individually committed results.
- Concurrent active branches normally require `all`. An `any` join cannot let
  losing in-flight actions become invisible; unsupported races fail validation
  instead of pretending cancellation stopped them.
- Output is eligible only after all required active branches converge; the
  compiler cannot return while a sibling durable step is outstanding.
- Let Workpool bound actual step concurrency; do not create a second scheduler.
- Set an explicit tested `maxParallelism` per environment instead of relying on
  the component default. Enforce one value per component instance and account
  for other Workpools in the environment budget.
- Treat `maxParallelism` and log level as receipted operational posture, not
  workflow replay identity. The fixed no-global-action-retry posture and each
  explicit step retry remain semantic/versioned.
- V1 rejects more than one inline mutation in a ready wave. Authors combine the
  atomic writes behind one typed capability or make them independent; Maestro
  does not imply a cross-step transaction or rely on unspecified inline
  ordering.
- Large dynamic fan-out uses the bounded batch/subworkflow contract from
  WP-1.11; a graph cannot materialize an unbounded ready wave.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm --dir packages/convex test graphRunner
pnpm check:workflow-semantics
pnpm check:workflow-graph-boundary
```

**Acceptance**

- Independent branches start before either branch resolves.
- Join nodes wait for their declared sources.
- A terminal output never resolves while another required branch is running;
  detached durable work and non-converging success paths fail graph validation.
- Replay and ledger order are stable even when completion order changes.
- A partial-success/failure fixture proves committed sibling results are reused,
  settled error edges are deterministic, and no receipt calls the wave atomic.
- Multiple inline mutations in one ready wave fail with the single-capability
  repair path.
- Conflicting Workpool configurations and unbounded fan-out fail before deploy;
  backlog/health evidence is named in the promotion plan.

**Migration / rollback:** publish as a new workflow runtime/graph version.
Active serial runs finish on their original runner.

### WP-1.4 Add native subworkflows and typed events

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-1.1 principal foundations, WP-1.3

**Files**

- Extend `graphRunner.ts` with typed `runWorkflow` and event contracts.
- Update `graphRunnerNodes.ts` with a subworkflow registry and executor.
- Add `packages/convex/confect/workflows/_kit/events.ts`.
- Extend `workflowRunLinks` and ownership helpers with parent/child version,
  principal, cancellation, and cleanup projections.
- Update workflow generator output in `tooling/generators/src/index.ts` so each
  workflow owns shared `defineEvent` definitions.
- Update generated workflow contract docs and tests.

**Implementation**

- A subworkflow node references a generated registry key, not an arbitrary
  function string, and resolves an exact immutable child version.
- `step.runWorkflow` receives a stable name, size-checked mapped args, inherited
  or explicitly narrowed principal, and declared cancel/cleanup behavior.
- On Workflow 0.4.4, subworkflow nodes reject `runAt` and `runAfter` because the
  component drops those options while creating the child. The diagnostic offers
  a named sleep followed by an unscheduled child as a deliberately
  non-equivalent alternative, or a tested compatible upgrade; it never claims
  the schedule was honored.
- Validate parent/child cycles, maximum nesting depth, and bounded child fan-out
  before start. Upstream cancellation propagation is projected honestly; a
  running child action may still finish.
- Approval events use one shared typed definition. Concurrent approvals include
  an explicit approval instance key so events cannot cross-deliver.
- Dynamic waits use an authenticated creator capability and a branded `EventId`;
  the component ID is hidden behind an opaque product approval/event ID and is
  persisted with owning workspace/tenant, workflow ID, generation, event
  definition, and instance key. Before both await and send, an internal
  capability compares every ownership field; the component's EventId lookup is
  not treated as an authorization check. Senders use either that owned ID or a
  generated event definition, never an arbitrary raw name.
- Approval waits always bind the typed definition to a fresh persisted instance
  ID. Restart truncates the journal through the event-allocation step, marks the
  old generation's instance invalid, and journals a new ID so a stale/pre-sent
  approval cannot satisfy the restarted step.
- Cover event-sent-before-wait, duplicate send/consumption, typed value,
  explicit error, cancellation, and restart behavior.
- Public control mutations authenticate and translate to the internal typed
  event contract; callers never supply workspace/principal fields directly.

**Resolution path:** promote subworkflow and typed-event primitives into the
shared workflow kit and generator so every later workflow inherits the native
Convex semantics.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm template:workflow-output-smoke
pnpm check:workflow-semantics
pnpm check:confect-contracts
```

**Acceptance**

- Parent result and child failure/cancellation behavior are covered.
- A type fixture proves generated `runWorkflow` returns the child handler's
  validated result type rather than the raw workflow mutation's `WorkflowId`
  return type.
- Parent/child ownership, principal, version, and cleanup links reconcile
  idempotently.
- Two concurrent approvals for one graph cannot satisfy each other.
- Wrong-workflow, prior-generation, and cross-tenant EventIds fail opaquely
  before the component await/send call.
- Scheduled-child options fail on 0.4.4 and can become supported only with a
  passing compatibility/compiler fixture on a pinned replacement.
- Invalid event payloads fail at the generated boundary.

**Migration / rollback:** new node/event types require a new immutable workflow
version. Existing string event names remain accepted only by their old runners.

### WP-1.5 Expose intentional inline transaction posture

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-1.1, WP-1.4

**Files**

- Update transaction validation and invocation in `graphValidation.ts`,
  `graphRunner.ts`, and `graphRunnerNodes.ts`.
- Update `docs/template/workflow-authoring-guide.md` with decision criteria and
  examples linked from the graph schema.
- Add inline/independent conformance cases, including transaction limits.

**Implementation**

- Independent Workpool transactions remain the generator default.
- Inline is available only for query/mutation capability nodes whose contract
  declares a small atomic transaction posture.
- Maestro requires explicit `transactionLimits` when `inline: true`, even though
  upstream makes them optional. The compatibility contract pins the
  Convex >=1.41 requirement and exact supported fields.
- The authoring API exposes named conservative presets such as `tiny` and
  `small-atomic`, whose exact counters live in the pinned compatibility file.
  Novice recipes choose a preset; a reviewed advanced contract may declare
  explicit counters, but the UI/skill does not ask a novice to tune raw limits.
- Actions can never be inline.
- Inline nodes cannot also declare `runAt` or `runAfter`; the discriminated
  builder makes that combination unrepresentable.
- `transactionLimits` pass through only when `inline: true` and the tested
  Convex version supports them.

**Resolution path:** promote the inline/independent transaction posture into the
graph schema, validator, runner, and authoring guide after the pinned Convex
compatibility fixture proves the exact options.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm check:confect-compat
pnpm check:workflow-semantics
pnpm check:workflow-graph-boundary
```

**Acceptance**

- Tests inspect exact `step.runQuery`/`runMutation` options.
- Default generated workflows remain independent.
- Type-negative fixtures reject action-inline, scheduled-inline, and
  transaction-limits-without-inline forms.
- Unsupported version/option combinations fail preflight.

**Migration / rollback:** inline posture is introduced only in a new workflow
version. Revert the new version before promotion; do not mutate published step
posture.

### WP-1.6 Complete the tenant-safe workflow lifecycle

- **Kind:** `fixture-to-real`
- **Target:** generated workflow contracts expose start/status/approve but not
  the full component lifecycle
- **Dependencies:** WP-1.4, WP-1.5

**Files**

- Add lifecycle helpers under
  `packages/convex/confect/workflows/_kit/lifecycle.ts`.
- Add a pure lifecycle state machine and property fixtures under
  `packages/convex/confect/workflows/_kit/lifecycleState.ts`.
- Update `packages/convex/confect/workflows/_kit/ownership.ts`, `status.ts`, and
  `packages/convex/confect/tables/workflowRuns.ts`.
- Update the workflow contract and runner templates in
  `tooling/generators/src/index.ts`.
- Extend `packages/convex/test/workflow-conformance.test.ts` and generator
  output tests.
- Update `docs/template/how-to-add-workflow.md` and
  `docs/template/workflow-authoring-guide.md`.

**Generated contract**

- Each named start profile is an authenticated Confect mutation that first
  reserves the workspace-scoped idempotency key, then maps its generated
  `eager-first-poll`/`queued` posture to `startAsync: false`/`true`. The default
  `start` is interactive/eager-first-poll; bulk/system recipes call a separately
  named queued profile. Public args cannot select the raw mode, and both
  profiles may target the same runner version. A caught initial handler or
  validation failure may commit a terminal failed workflow and still return its
  ID; that ID and reservation remain canonical. Only a transaction that rolls
  back before creating a workflow leaves no committed reservation.
- `status` and typed event/approval controls.
- `cancel` with product copy stating that an already-running action may finish.
- `restart` from the beginning or a unique stable named step instance, with an
  audit reason.
- Restart and cleanup require prior-generation quiescence. A terminal/canceled
  workflow status alone is insufficient while Workpool still reports an
  in-progress step. The only exception is a capability strategy with an explicit
  overlapping-generation concurrency model, a dedupe reservation retained
  through the entire restart window, and a passing adversarial fixture.
- Restart preflight lists every downstream step/effect that will be discarded
  and replayed. It refuses a path containing an external action not declared and
  proven `restartSafe`; the repair is a compensating/new-intent workflow, not a
  force flag. A stable effect key without a sufficient dedupe-retention horizon
  is not restart-safe.
- tenant-filtered `list`, `listByName`, and paginated `listSteps` projections.
- `cleanup` with retention checks and explicit operator/system authority.
- A generated, runtime-validated, size-bounded `onComplete` context containing
  only stable ownership/run/version IDs. The callback is projection-only and
  records final status even for failure or cancellation; it never calls a
  provider.
- A bounded retention sweep that calls component cleanup only after product
  evidence retention has elapsed; immediate cleanup from the workflow body is
  not the default.
- Parent cleanup waits for the longest required child/evidence retention window.
  This is mandatory because the pinned component cascades nested workflow
  cleanup with force after deleting parent step links.
- Product cleanup states distinguish requested, in-progress, and confirmed
  product cleanup. The pinned component may continue root steps in scheduled
  batches and enqueue nested cleanup after its public call returns; parent/child
  links and a census prove completion of exposed work before the product reports
  `product-cleaned`.
- Pinned 0.4.4 cannot prove deletion of never-awaited event records or
  `onCompleteFailures`. Lifecycle state therefore separately records
  `component-cleanup-requested`, `component-known-work-complete`, and
  `component-residuals-unverifiable`. Those component-facing records may contain
  only non-sensitive IDs and redacted errors. No API, receipt, or UI calls this
  full data deletion.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm template:workflow-output-smoke
pnpm check:workflow-semantics
pnpm check:confect-contracts
pnpm check:access-audit-events
```

**Acceptance**

- Every control rechecks workspace access and ownership.
- Eager-first-poll and queued fixtures assert the exact `startAsync` option,
  atomic reservation behavior, and one canonical workflow ID under concurrency.
- A caught initial validation/handler failure retains its terminal component ID
  and reservation; a true transaction rollback creates neither.
- Cancellation, restart, and cleanup append redacted audit events.
- Cleanup refuses active workflows and completed workflows inside retention.
- Restart/cleanup refuse a canceled-but-still-running prior generation unless
  the explicit overlapping-generation contract and dedupe horizon pass.
- Parent cleanup refuses while any linked child/evidence retention is still
  open.
- Cleanup does not report `product-cleaned` while continuation or nested cleanup
  remains outstanding, and never equates that state with deletion of unexposed
  component residuals.
- Public APIs never expose force cleanup, raw component IDs from another
  workspace, unredacted step args/results, or restart-by-unstable function name.
- Restart fixtures prove stable logical idempotency keys are reused and that a
  non-restart-safe downstream action blocks before journal deletion.
- Cancel and parent/child fixtures state that an already-running action may
  finish; compensation is separate and explicit.
- Completion fixtures reject oversized/untyped context. Projection repair and
  residual cleanup evidence are owned by WP-1.10, not this lifecycle package.
- Create/send-before-wait then cancel/cleanup, failed `onComplete` then cleanup,
  and cancel-during-action fixtures preserve the honest residual state.
- Generated docs describe action-cancellation limitations honestly.

**Migration / rollback:** add nullable lifecycle fields, backfill status from
the component where possible, and keep old start/status wrappers through one
release window. Roll back wrappers before removing any new table fields.

### WP-1.7 Publish immutable workflow and capability bindings

- **Kind:** `template-gap`
- **Backlog:** `AP-003 immutable workflow releases`
- **Dependencies:** WP-1.6

**Files**

- Change generator output to:
  `packages/convex/confect/workflows/<name>/v<N>.graph.ts` and
  `packages/convex/convex/workflowRunners/<name>/v<N>.ts`.
- Add immutable workflow-callable capability releases under
  `packages/convex/confect/capabilities/_versions/<name>/v<N>.*` and generate a
  registry mapping logical key/version to the exact Confect function ref,
  contract/effect manifest, and reviewed dependency manifest.
- Generate `packages/convex/confect/workflows/_generated/workflowRegistry.ts`
  mapping workflow ID/version to graph hash, runner ref, event definitions,
  completion ref, kickoff profiles, exact capability/subworkflow bindings,
  immutable `runtimeVersion`/interpreter module, and lifecycle status.
- Add `template:bump-workflow`, `template:bump-capability`,
  `template:publish-workflow`, and `template:publish-capability` to
  `tooling/generators/src/index.ts`, `tooling/generators/src/index.test.ts`, and
  root `package.json`.
- Add `tooling/quality/check-workflow-version-immutability.mts` and fixtures;
  compare the working tree to the actual PR comparison base and to a trusted,
  checksummed publication manifest. A caller-supplied base cannot redefine what
  was already published.
- Add a deterministic deployed-module/source-closure builder for every runner,
  runtime interpreter, completion callback, workflow-callable capability, and
  declared transitive domain/provider facade. Fingerprint file content and
  resolved imports, not only unchanged dependency path names.
- Update `ownership.ts` so start resolves an exact registry entry rather than a
  latest graph import.
- Add `docs/template/workflow-versioning.md` and link it from the authoring and
  client-upgrade guides.

**Generator commands**

```bash
pnpm template:add-workflow -- --name <name> --system <canonical-id> --disposition reuse --write
pnpm template:bump-workflow -- --name <name> --from <N> --to <N+1>
pnpm template:bump-workflow -- --name <name> --from <N> --to <N+1> --write
pnpm template:bump-capability -- --name <name> --from <N> --to <N+1>
pnpm template:bump-capability -- --name <name> --from <N> --to <N+1> --write
pnpm template:publish-capability -- --name <name> --version <N>
pnpm template:publish-workflow -- --name <name> --version <N>
```

Each bump command copies a published version into a new editable version and
never edits the source version. Workflow bumps keep stable node/step names by
default and report step additions, removals, and reordering.

Registry entries have an explicit lifecycle:

- `draft`: editable, fixture/dev-test only, and unavailable to normal starts;
- `published`: content-addressed, present in the trusted publication manifest,
  and immutable while any active or restartable run may reference it;
- `retired`: rejects new starts but preserves the full published closure.

The publish command verifies that the graph, runner, runtime interpreter,
completion callback, child workflows, and workflow-callable capabilities are
already publishable and records their complete closure. No application workflow
is published during Phase 1 until the Phase 1 semantic contract and terminal
gate are stable; WP-1.7 first proves publication against isolated fixtures and
keeps application entries in `draft`.

A published workflow never resolves a logical `latest` capability or completion
callback. Its workflow-capability binding is immutable and may import only a
versioned domain/provider operation facade or a shared infrastructure contract
explicitly declared backward compatible. The generated dependency manifest is
the review boundary; this plan does not pretend a source hash can freeze current
data, current authorization, or an external provider. A semantic change in a
referenced domain/provider operation requires a new capability release and
workflow version. Shared security checks may become more restrictive because
consequential effects always reauthorize current access.

The published fingerprint covers graph topology/order, node IDs, stable step
names, runner ref, `runtimeVersion`, versioned interpreter modules, args/return
validators, kickoff profiles, capability/subworkflow/completion refs and
versions, their declared dependency manifests and resolved source/deployed
bundle closure, retry/inline/schedule options, events, payload policy, principal
schema, policy posture, and semantic retry defaults. Environment throughput/log
settings are checked through config drift and receipts rather than the replay
fingerprint. Formatting and generated comments are excluded through canonical
serialization, not broad file ignores. This freezes deployed Maestro behavior,
not current authorization, mutable business data, or an external provider.

**Resolution path:** promote the immutable workflow layout, generated registry,
and bump command as the only supported publication path for new workflow
versions.

**Focused gates**

```bash
pnpm --dir tooling/generators test
pnpm template:workflow-output-smoke
pnpm check:workflow-semantics
pnpm check:workflow-version-immutability -- --comparison-base <actual-pr-merge-base> --publication-manifest docs/template/generated/workflow-publications.json
pnpm check:generated-files
pnpm --dir packages/convex test workflow-conformance
```

**Acceptance**

- A run started on v1 continues to import the v1 graph, handler, completion ref,
  runtime interpreter, and workflow-capability bindings after v2 is published.
- A not-yet-executed v1 step still resolves its v1 capability binding after the
  capability and workflow publish v2.
- Graph hash, workflow version, runner ref, kickoff profiles, capability refs,
  completion ref, runtime version/source closure, and unique stable step names
  agree.
- Generator tests fail on an attempted published-version overwrite.
- Base-aware fixtures fail on published edit, delete, move, validator drift,
  event drift, option drift, capability/completion binding drift, dependency
  manifest/source-closure/interpreter drift, or step rename; an additive V2
  draft passes. A misleading comparison base cannot bless a manifest mismatch.
- Publish refuses an incomplete semantic contract or a draft dependency; retire
  rejects new starts without deleting active/restartable code.
- Retirement blocks new starts but does not delete an active runner.

**Migration / rollback:** wrap existing generated workflows as v1 without
changing their graph hash. Keep both old and versioned refs during a
compatibility release. Rollback selects the old start resolver; never delete a
runner, completion ref, or capability binding until no active or restartable run
references it. An urgent security defect retires new starts and follows an
incident/ADR active-run disposition; it is not a silent in-place semantic edit.

### WP-1.8 Enforce payload budgets and artifact references

- **Kind:** `pattern-instance`
- **Target:** `workflowArtifacts` durable resource
- **Dependencies:** WP-1.7

**Generator command**

```bash
pnpm template:add-table -- --name workflowArtifacts --system workflow-runtime --disposition extend --tenant-scope workspace --sensitivity confidential --pii none --export-mode redacted-json --delete-mode delete --retention "workflow retention window" --description "Large workflow inputs and outputs referenced by ID." --write
```

**Files**

- Generated table/decision/data-resource files from the command above.
- Add `packages/convex/confect/workflows/_kit/payloadBudget.ts` and focused
  tests.
- Add a generated workflow-capability boundary wrapper that maps thrown errors
  to typed redacted envelopes and checks `getConvexSize` before any result is
  returned to Workpool/the Workflow component.
- Update `graphRunnerExecution.ts`, `graphRunnerNodes.ts`,
  `observedStagePayload.ts`, and the generated workflow templates.
- Update `docs/template/data-lifecycle.md` and workflow authoring guidance.

**Implementation**

- Measure actual Convex values with `getConvexSize` before durable dispatch,
  inside the generated query/mutation/action wrapper before returning to
  Workpool, after each awaited result for accounting, before event/onComplete
  context send, and before product-ledger projection. JSON string length is not
  an accepted proxy. The post-await guard is accounting/defense in depth, not
  the first redaction boundary.
- Pin the upstream 0.4.4 800 KiB step-return and 8 MiB journal ceilings in the
  compatibility contract, plus Workpool's 1,000,000-byte function-args and
  completion-context ceilings. Use smaller Maestro soft/hard budgets that
  reserve graph, journal, event, error, and observability overhead.
- Track per-step and cumulative predicted/observed usage. Static estimates are
  advisory; the pre-return runtime guard is authoritative. Each capability
  declares a fixed maximum result reservation or an artifact-return shape so
  cumulative admission cannot assume an unbounded result.
- Persist large customer values in `workflowArtifacts` or the owning domain
  table and pass typed IDs through steps.
- Workflow artifacts are immutable and content-addressed. They carry owning
  tenant/run/version, sensitivity, content hash, size, and retention metadata;
  overwrites are impossible and retention lasts at least through the maximum
  restart/dedupe/evidence window for every referencing run.
- Treat component journal entries, status/list output, and debug logs as durable
  sensitive surfaces. Never place secrets, provider tokens, raw webhook bodies,
  or unnecessary PII in workflow args/results; centralize a conservative
  environment log level.
- Treat thrown error messages/stacks as journal payload too. The generated
  wrapper catches and redacts before Workpool observes the error; provider
  adapters map raw SDK/network failures to typed redacted code, safe message,
  and correlation ID before the workflow step boundary. An approved
  provider-owned diagnostic reference may retain raw detail under its own
  access/lifecycle contract, never in the component journal.
- Store redacted summaries/hashes in stage observability rather than duplicating
  raw large values.
- Return diagnostics with measured bytes, threshold, owning node, and the
  artifact-reference repair path.

**Focused gates**

```bash
pnpm confect:codegen
pnpm confect:manifest
pnpm --dir packages/convex test workflow
pnpm check:workflow-semantics
pnpm check:data-resources
pnpm check:schema-migration-notes
pnpm check:secret-canaries
```

**Acceptance**

- Boundary-size fixtures pass below the soft limit and fail before dispatch at
  the hard limit.
- A canary in a thrown provider error or oversized success preview is redacted
  before Workpool/the Workflow component can persist it.
- Cumulative journal, event value, nested-workflow args, return, and onComplete
  context fixtures exercise Maestro headroom, the Workflow limits, and both
  Workpool 1,000,000-byte boundaries.
- Large values are retrieved only through tenant-safe artifact capabilities.
- Artifact mutation fails; restart remains valid for the full retained window,
  and cleanup cannot delete a still-referenceable artifact.
- Stage/event rows never contain the full oversized payload.
- Secret/payload canaries do not appear in component-facing args, success or
  failure results/stacks, returned list projections, product logs, or
  verification receipts.

**Migration / rollback:** the table is additive. Existing small payload runs do
not migrate. Retain artifacts through the declared workflow retention window;
roll back new callers before dropping the table.

### WP-1.9 Complete typed principal propagation and pinned policy snapshots

- **Kind:** `fixture-to-real`
- **Target:** `startWorkflowAndRecordOwnership` authenticates kickoff but
  durable steps rely on ambient access helpers
- **Dependencies:** WP-1.1 principal foundations, WP-1.7, WP-1.8

**Files**

- Add `packages/convex/confect/workflows/_kit/principal.ts` and
  `policySnapshot.ts`.
- Update `ownership.ts`, `graphRunner.ts`, generated runner args, and generated
  capability `buildArgs` mappings.
- Update the `workflowRuns` table with a versioned, minimal principal snapshot
  or principal reference.
- Add tests under `packages/convex/test/workflow-principal.test.ts`.
- Add `tooling/quality/check-workflow-principal-propagation.mts` and fixtures
  comparing generated public, internal runner, capability, and child-workflow
  contracts.
- Add `tooling/quality/check-workflow-policy-snapshots.mts` and fixtures for
  declared-none, pinned resolution, mid-run policy change, restart, and illegal
  latest-policy reads.
- Update workflow/capability authoring guides and security threat model.

**Contract**

- User-started workflows snapshot workspace, actor, role/grants, auth epoch,
  kickoff time, and provenance needed for deterministic policy evaluation.
- Workflows with policy-dependent decisions resolve a validated policy version
  ID/hash at kickoff and carry the minimal snapshot/reference used for replay. A
  declared `none` posture is explicit and testable, not `{}` by default.
- Public start schemas omit reserved identity fields. The authenticated start
  wrapper constructs a branded, versioned principal that callers cannot forge.
- Scheduled/system workflows use a distinct typed system principal with a
  declared reason and narrow grants.
- Principal snapshots contain no session token, provider credential, raw auth
  payload, or secret. Long waits do not freeze authorization forever.
- Steps never assume the original request identity survives asynchronous
  execution.
- Capabilities validate the workflow principal and tenant. Consequential effects
  recheck current membership/revocation/policy immediately before the effect,
  including after sleep, event wait, restart, or child workflow return.
- Deterministic business decisions use the pinned policy snapshot; current
  authorization checks cannot silently change prior workflow decisions. Restart
  of the same run preserves the snapshot; adopting new policy starts a new
  versioned business intent.
- Child workflows inherit the same principal or an explicitly narrower grant;
  widening is not an authoring option.
- Caller-controlled args cannot override actor, workspace, role, or grants.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-principal
pnpm check:workflow-principal-propagation
pnpm check:workflow-policy-snapshots
pnpm check:workflow-semantics
pnpm check:access-audit-events
pnpm check:confect-contracts
pnpm check:secret-canaries
```

**Acceptance**

- Async steps pass with no ambient user identity and the correct principal.
- Public-contract fixtures cannot submit workspace, actor, role, grant, or
  system-principal fields.
- A policy change during sleep/replay does not change pinned decisions, while a
  current revocation still blocks the next consequential effect.
- Latest-active policy reads and an undeclared empty snapshot fail the generated
  gate.
- Cross-workspace and privilege-escalation fixtures fail opaquely.
- System principals cannot acquire user-only capabilities.
- Revoked consequential effects stop at the capability boundary.

**Migration / rollback:** existing active runs use a legacy-principal adapter
that only permits non-consequential completion and cannot start new external
effects without reauthorization. New starts require V2 principals. Remove the
adapter after the active-run window closes.

### WP-1.10 Reconcile Convex execution truth with Maestro product evidence

- **Kind:** `pattern-instance`
- **Target:** tenant-safe workflow completion reconciliation capability
- **Dependencies:** WP-1.6, WP-1.9

**Generator command**

```bash
pnpm template:add-capability -- --name reconcileWorkflowCompletion --system workflow-runtime --disposition extend --description "Projects Convex workflow completion into the tenant-safe run and evidence ledger." --exposure workflow --write
```

**Files**

- Generated capability contract/domain/test files.
- Add the component-required plain Convex `onComplete` function through the
  Confect spec/impl registration path.
- Update `observedStage.ts`, `observedStagePayload.ts`, `status.ts`,
  `ownership.ts`, and workflow-run event projection.
- Add a scheduled cleanup/reconciliation entrypoint under the workflow-runtime
  system, with no raw scheduler call outside the approved adapter.
- Add fixtures for concurrent duplicate starts, repeated completion delivery,
  component `onComplete` projection failure, missing stage projection, and
  cleanup after reconciliation, including never-awaited event and
  `onCompleteFailures` residual cases from the pinned compatibility set.

**Ownership rule**

- Convex's workflow journal is execution truth.
- Maestro `workflowRuns`, stage rows, events, and Trust Receipts are the
  tenant-safe product/evidence projection.
- Reconciliation may repair a missing projection from component status; it may
  never fabricate a successful component result.
- This package owns recovery from `onComplete` projection failure. Recovery
  projects terminal truth idempotently from component status and never replays
  the callback, workflow steps, or provider effects.
- Reconciliation also owns the product evidence for cleanup. It can confirm
  exposed root/child work is quiescent and product records are retained/deleted
  according to policy, but on pinned 0.4.4 it records never-awaited event rows
  and `onCompleteFailures` as `component-residuals-unverifiable`; it cannot
  fabricate proof that unexposed component tables were deleted.
- Start reservation is workspace-scoped and atomic. One idempotency key maps to
  one component workflow/version; a mismatched retry fails rather than aliasing
  a different request.
- The global Workpool limit is not tenant fairness. Before reservation/start,
  generated kickoff enforces a workspace-scoped active/queued-run budget (and a
  separate narrow system budget), returning a typed capacity error with safe
  retry guidance. This is admission control, not a second execution queue or
  scheduler.
- Public kickoff is an authenticated Confect mutation, so the reservation and
  component create/queue operation share one transactional boundary. A
  preprocessing action records a typed intent and calls that mutation; it does
  not invoke the component directly.
- Reservation state distinguishes reserved, started, terminal, and
  rolled-back-before-create. An eager-first-poll validation/handler error that
  the component catches keeps the canonical component workflow ID and terminal
  reservation; only an enclosing transaction rollback with no workflow creation
  leaves no committed reservation. A queued start records the canonical ID
  before returning. Concurrent duplicates observe that same outcome.
- Product projection writes are idempotent by component workflow ID plus
  generation/result identity. Repair reads component status and never reruns a
  capability or provider effect.

**Focused gates**

```bash
pnpm confect:codegen
pnpm confect:manifest
pnpm --dir packages/convex test workflows
pnpm check:workflow-semantics
pnpm check:access-audit-events
pnpm check:confect-contracts
```

**Acceptance**

- Success, failure, and cancellation project exactly once under retries.
- Concurrent duplicate kickoff creates one component run and one ownership
  record; mismatched same-key args fail with a redacted conflict.
- A noisy-workspace fixture reaches its admission budget without preventing a
  second workspace's allowed start; system principals cannot borrow the user
  budget silently.
- Eager-first-poll terminal-failure and queued-start fault fixtures retain or
  release reservations according to whether a component workflow ID committed,
  and never create a second component workflow.
- A failed observability write does not change workflow execution outcome and is
  later repairable.
- Repeated reconciliation is a no-op and never re-executes a workflow step.
- Cleanup preserves the minimal audit/receipt record required by retention and
  reports exposed cleanup completion separately from unexposed component
  residuals.

**Migration / rollback:** backfill terminal projections in bounded pages. Keep
the reconciler idempotent. Roll back scheduling first, then the new projection;
never delete the component journal as part of rollback.

### WP-1.11 Add durable scheduling, bounded iteration, and failure policy

- **Kind:** `template-gap`
- **Backlog:** `AP-002 Convex workflow semantic compatibility`
- **Dependencies:** WP-1.9

**Files**

- Extend the V2 discriminated graph schema and builder with named delay,
  scheduled eligible capability, bounded batch, and explicit failure-policy
  nodes/options. Scheduled subworkflows remain unsupported on Workflow 0.4.4.
- Add scheduling/control-flow compilation to `graphRunnerExecution.ts` and
  `graphRunnerNodes.ts` without introducing a second scheduler.
- Add `packages/convex/confect/workflows/_kit/failurePolicy.ts` and
  `boundedBatch.ts` with pure validation helpers.
- Extend generator output, the semantic support contract, recipe guidance, and
  `workflow-conformance.test.ts` with timer, scheduling, batch,
  catch/error-edge, compensation, replay, and deadline cases.

**Supported posture**

- A named delay compiles to `step.sleep`. A scheduled eligible capability step
  compiles to exactly one `runAfter` or `runAt` option. The pinned API does not
  expose `sleepUntil`; docs and builders must not invent it. A child with
  scheduling options fails on Workflow 0.4.4 because that component version
  drops them; support requires a pinned replacement plus exact propagation
  fixtures.
- `runAfter`/`runAt` are not exact-time or no-later guarantees. Maestro treats
  them as not-before requests. The builder rejects past/too-distant horizons
  that Workpool would silently clamp (older than one year to now or farther than
  four years to one year under the pinned implementation), records requested
  scheduling separately, and records actual execution start/lateness inside the
  generated capability wrapper rather than using journal/enqueue `startedAt`.
  Business expiry, current authorization, provider window, and spend posture are
  rechecked there when execution actually begins.
- Inline query/mutation nodes cannot be scheduled. Negative delays, invalid
  timestamps, both scheduling fields, and schedule-plus-inline fail at build
  time and runtime decode.
- The user-authored Maestro graph remains acyclic for V1. Dynamic repeated work
  uses a bounded batch/subworkflow node with explicit `maxItems`, `batchSize`,
  and fan-out budget. Arbitrary cycles are marked intentionally restricted with
  a scaffolded alternative, never accepted and ignored.
- Step failure policy is explicit: `fail`, route a typed failure to a declared
  error edge, or invoke named compensating capabilities. Compensation runs in
  reverse declared order, is idempotent, and is never described as transaction
  rollback for external side effects.
- Expected domain failures remain typed capability results. Unexpected/system
  failures preserve Convex failure/restart semantics and redacted diagnostics.
- Deadline policy stops future dispatch and records/cancels through lifecycle;
  it cannot stop an already-running action and says so.
- A deadline is not implemented as `Promise.race` between a durable event and
  timer, which would leave a losing step outstanding. The generated kickoff
  schedules one idempotent lifecycle-control mutation through the approved
  scheduler boundary, keyed by workflow ID and generation. It no-ops after
  terminal completion or generation change and only cancels/records lifecycle;
  it is not a second business-step scheduler.

**Resolution path:** promote the remaining common native control-flow semantics
into constrained graph primitives and explicitly reject unbounded/raw forms
until they have a typed compiler and conformance proof.

**Focused gates**

```bash
pnpm --dir packages/convex test workflow-conformance
pnpm --dir tooling/generators test workflow
pnpm check:workflow-semantics
pnpm check:confect-compat
pnpm check:workflow-graph-boundary
```

**Acceptance**

- Exact invocation fixtures prove `sleep`, `runAfter`, and `runAt` options and
  stable names across replay/restart.
- Scheduled-child and Workpool-clamped-horizon fixtures fail before dispatch
  with the supported alternative and compatibility rule ID.
- A deliberately late scheduled-step fixture records lateness and refuses an
  expired effect from inside the capability rather than claiming enqueue time
  was actual start or that the scheduler met a deadline.
- Unbounded cycles/fan-out and invalid schedule combinations fail with a recipe
  for a bounded batch or versioned subworkflow.
- Parallel failure, typed error edge, partial completion, compensation failure,
  restart, and cancellation outcomes are deterministic and documented.
- A never-arriving event deadline cancels the matching generation; a stale
  deadline from before restart is a no-op, and no losing durable branch remains.
- No compensation or deadline fixture claims an in-flight external action was
  rolled back or forcibly stopped.

**Migration / rollback:** new scheduling/control-flow forms publish only in a
new immutable workflow version. Existing delay nodes migrate to named V2 delay
nodes without changing elapsed behavior. Rollback retires the new version and
leaves active runs on its preserved runner.

### Phase 1 terminal gate

Do not start public pack distribution until all of these pass on the tested
version set. All Phase 1 application workflow entries remain `draft` while the
gate is red; only after it passes may the reviewed publish command materialize
their immutable publication manifests:

```bash
pnpm --dir packages/convex test workflows
pnpm --dir tooling/generators test
pnpm template:workflow-output-smoke
pnpm check:confect-compat
pnpm check:confect-contracts
pnpm check:workflow-semantics
pnpm check:workflow-principal-propagation
pnpm check:workflow-policy-snapshots
pnpm check:workflow-version-immutability -- --comparison-base <actual-pr-merge-base> --publication-manifest docs/template/generated/workflow-publications.json
pnpm check:workflow-graph-boundary
pnpm check:schema-migration-notes
just verify
```

## Phase 2: Canonical Repository And Host Bootstrap

Goal: make a clone immediately understandable to Claude Code and Codex, with
official Convex context installed in the correct host-native locations. Repo
instructions and skills work before any MCP is enabled; optional MCP profiles
arrive only after the local CLI owns their launch policy in Phase 3.

### WP-2.1 Install official Convex AI files at the repository root

- **Kind:** `template-gap`
- **Backlog:** `AP-004 official Convex agent context`
- **Dependencies:** WP-0.3, WP-0.5; full Phase 1 is not required for the
  workflow-optional walking skeleton

**Files**

- Add root `convex.json` pointing `functions` to `packages/convex/convex` and
  configuring AI skill agents as `claude-code` and `codex`.
- Add the exact tested Convex CLI version to root `devDependencies`, matching
  `packages/convex/package.json`.
- Add root scripts `convex:ai-files:install`, `convex:ai-files:status`, and
  `check:convex-ai-files`.
- Normalize `convex:dev`, Convex codegen/deploy, Confect-to-Convex codegen, and
  MCP/AI wrappers so they resolve the root config/CLI and use `--project-dir .`
  where the Convex command accepts it. Package-local aliases may delegate for
  one compatibility window; a second `convex.json` or divergent project
  directory fails config drift.
- Run the maintainer-only pinned `pnpm convex:ai-files:install` refresh and
  review/commit the managed outputs: guidelines, managed AGENTS/CLAUDE sections,
  Claude skills, Codex skills, state, and `skills-lock.json`.
- Add `tooling/quality/check-convex-ai-files.mts` and tests for offline drift
  checks.
- Create root `CLAUDE.md` with `@AGENTS.md` outside Convex-managed markers.
- Record the exact `get-convex/agent-skills` resolved commit, skills-installer
  version, lock format, and per-file checksums in
  `docs/template/convex-compatibility.json`. Run refresh in a controlled
  temporary checkout and fail if the installer resolves anything other than the
  reviewed commit.

**Resolution path:** import official Convex-managed guidance and host-native
skills through the pinned CLI, preserve Maestro instructions outside managed
markers, and make offline drift detection the repository gate.

**Official command**

```bash
pnpm exec convex ai-files install
pnpm exec convex ai-files status
```

The current CLI installs/refreshes
`packages/convex/convex/_generated/ai/guidelines.md`, managed sections in root
`AGENTS.md` and `CLAUDE.md`, and native copies of `get-convex/agent-skills` for
both Claude Code and Codex. Pinning the Convex CLI alone does not pin the remote
skills repository or the installer it invokes. Normal customer onboarding uses
the committed, checksummed outputs and never refreshes from the network; refresh
is an explicit dependency-update change with review evidence.

**Focused gates**

```bash
pnpm check:convex-ai-files
pnpm check:config-drift
pnpm check:generated-files
```

**Acceptance**

- A root Claude Code session reads `AGENTS.md` through `CLAUDE.md`.
- Claude Code discovers official Convex skills in `.claude/skills`.
- Codex-compatible hosts discover them in `.agents/skills`.
- The repo can check committed output offline; network freshness is a separate
  refresh signal, not a flaky CI dependency.
- Changing installer version, resolved skills commit, lock data, or managed-file
  checksum fails until the compatibility record and dependency-review fixtures
  are updated together.
- Dev, codegen, AI-files, and MCP command fixtures resolve the same root
  project; no package-local config can target a different deployment/functions
  tree.

**Migration / rollback:** Convex-managed markers preserve all hand-written
instructions. Rollback uses the committed managed-file/state manifest to remove
only exact checksummed outputs and restore the root include. Use
`convex ai-files remove` only if the pinned offline fixture proves it does not
need mutable remote metadata; never make rollback depend on the current network
repository state.

### WP-2.2 Add skill-only `maestro-convex` integration and safe MCP profiles

- **Kind:** `template-gap`
- **Backlog:** `AP-004 official Convex agent context`
- **Dependencies:** WP-2.1

**Files**

- Add the initial `tooling/agent-pack/package.json`, `tsconfig.json`, and
  minimal `src/pluginContract.ts` module used by plugin-schema and launch-policy
  tests.
- Add `agent-pack/plugins/maestro-convex/.claude-plugin/plugin.json`.
- Add a short `agent-pack/plugins/maestro-convex/skills/maestro-convex/SKILL.md`
  that routes agents to official Convex guidance and Maestro's workflow
  compatibility doc.
- Add `docs/template/convex-mcp-profiles.json` with the audited pinned tool
  inventory, exact inspect allowlist, dev-power additions, always-disabled
  environment-value tools, and fake/dev/production launch policy.
- Add plugin-schema, tool-inventory, and launch-policy tests under
  `tooling/agent-pack/src/convexPlugin.test.ts`.
- Do not add `.mcp.json` or a Codex MCP entry in Phase 2. The skill explains the
  opt-in boundary; WP-3.5 generates host-local config only after the CLI and its
  safety checks exist.

**Future MCP command contract**

```bash
pnpm exec convex mcp start --project-dir . --deployment dev --disable-tools <computed-deny-list>
```

The repository root is the one Convex project root: root `convex.json` points to
`packages/convex/convex`, and every dev/codegen/AI/MCP command runs from or uses
`--project-dir .`. No command points at a second package-local project root.

Fake mode does not configure or launch Convex MCP. The first opt-in profile is
`inspect`: it uses the project-pinned CLI and a personal dev deployment, and
computes the disabled tools as the complement of an exact audited read-only
allowlist. At minimum it disables `data`, `envGet`, `envList`, `envRemove`,
`envSet`, `logs`, `run`, and `runOneoffQuery`. An upstream-added tool fails the
inventory gate and launch rather than becoming enabled implicitly.

`dev-power` is a separate explicit host-local profile that may add audited dev
data/log/function tools after displaying their read/write and privacy effects.
It is never committed or installed automatically. Every profile disables
`envGet`, `envList`, `envRemove`, and `envSet`; omits all production flags; and
never enables `--dangerously-enable-production-deployments` or
`--cautiously-allow-production-pii`. Production Convex MCP is unsupported.

It contains no hooks, telemetry, subagents, scaffold logic, remote workers, or
background monitors. Production MCP access, if ever required, is a separate
future ADR and not part of the template.

**Resolution path:** package the skill plus an audited, fail-closed MCP profile
contract while delegating Convex framework guidance to the official installed
skills and Maestro policy to the compatibility reference. WP-3.5 owns actual
host-local MCP configuration.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test convexPlugin
pnpm exec convex mcp start --help
pnpm check:secret-canaries
```

**Acceptance**

- Phase 2 installs context only and launches no server in fake mode.
- Tool-inventory fixtures prove inspect-only defaults, always-disabled env-value
  tools, dev-power separation, unknown-tool fail-closed behavior, and one root
  Convex project.
- It coexists with official Convex skills without duplicating their content.

**Migration / rollback:** remove/disable the host plugin; no project data or
generated code depends on it.

### WP-2.3 Package and validate the Claude Code installation

- **Kind:** `template-gap`
- **Backlog:** `AP-005 Claude and Codex distribution`
- **Dependencies:** WP-2.2

**Files**

- Add `.claude-plugin/marketplace.json` with local plugin sources for `maestro`
  and `maestro-convex`.
- Add `agent-pack/plugins/maestro/.claude-plugin/plugin.json`, the core skill,
  and conditional references. It is skill-only until WP-3.5 builds the Maestro
  MCP server.
- Add `.claude/settings.json` containing repo-safe permissions/configuration and
  no hooks.
- Add `docs/template/claude-code-setup.md` with explicit marketplace add,
  install, trust, restart, status, and removal steps.
- Add a temporary-home installation fixture under
  `tooling/agent-pack/src/claudeInstall.test.ts`.

**Install experience**

1. Materialize the target through the supported creation path.
2. Use committed `CLAUDE.md`, `AGENTS.md`, and official Convex skills
   immediately; this is the primary path.
3. Optionally add the repository marketplace, inspect/trust, and install the
   `maestro` and `maestro-convex` skill-only plugins.
4. Run `pnpm exec convex ai-files status` and
   `pnpm maestro -- preflight --human`.

The exact slash/CLI commands are pinned in the setup doc only after the current
Claude Code version passes the installation fixture. The broad standalone
`get-convex/real-time-backend-skill` plugin is optional, not automatically
bundled: official `convex ai-files install` supplies the current focused Convex
skills, and an all-or-nothing third-party plugin instruction set can overlap
Maestro doctrine. There are no plugin hooks to selectively disable in the
default path because the default path installs none.

**Resolution path:** project the canonical pack into a Claude-native local
marketplace, validate install/remove in a temporary home, and retain committed
repo instructions as the no-plugin fallback.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test claudeInstall
pnpm check:agent-pack
pnpm check:secret-canaries
```

**Acceptance**

- A clean temporary Claude home installs both plugins without editing global
  files behind the user's back.
- `CLAUDE.md -> AGENTS.md` and skill routing load correctly.
- No plugin installation starts MCP, authenticates Convex, or mutates a host
  config in Phase 2.
- Uninstall removes host integration but leaves customer code untouched.

**Migration / rollback:** plugin state is local and reversible. Keep repo-native
skills/commands working when a user declines plugin installation.

### WP-2.4 Package and validate the Codex installation

- **Kind:** `template-gap`
- **Backlog:** `AP-005 Claude and Codex distribution`
- **Dependencies:** WP-2.2

**Files**

- Add the Maestro skill under `.agents/skills/maestro/` as a generated
  projection of the canonical agent-pack source.
- Add `agent-pack/skills/maestro/agents/openai.yaml`.
- Add `docs/template/codex-setup.md` and
  `tooling/agent-pack/src/codexInstall.test.ts`.
- Add `tooling/agent-pack/src/syncSkills.ts` so Claude/Codex projections are
  generated from one canonical skill source; `check:agent-pack` fails on drift.

**Resolution path:** project the same canonical skill into Codex-native
locations, with generated parity checks instead of a second hand-maintained
instruction set. MCP projection waits for WP-3.5.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test codexInstall
pnpm check:agent-pack
pnpm check:config-drift
```

**Acceptance**

- Codex parses the committed instruction and skill manifests and discovers the
  Maestro and official Convex skills without requiring an MCP entry.
- Phase 2 host fixtures prove no MCP process is configured or launched in fake
  mode.
- The repo-native skill remains the supported fallback where desktop/CLI plugin
  distribution differs.

**Migration / rollback:** remove local skill/plugin registration; repo
instructions, CLI, and generated app remain usable.

## Phase 3: Versioned Maestro CLI And Thin MCP

Goal: give any shell-capable agent one safe deterministic interface while
preserving the existing app-runtime CLI and generator implementations.

### WP-3.1 Establish the agent-pack command contract

- **Kind:** `template-gap`
- **Backlog:** `AP-006 safe factory CLI and MCP`
- **Dependencies:** Phase 2

**Files**

- Extend `tooling/agent-pack` from WP-2.2 with `src/contracts.ts`,
  `src/exitCodes.ts`, `src/repoContext.ts`, and tests.
- Extend `apps/cli/package.json` with a `maestro` binary while preserving the
  existing `maestro-template` alias for one compatibility window.
- Add factory command routing under `apps/cli/src/factory/` and leave existing
  runtime `describe`, `workflow`, `capability`, `api`, and `integrations`
  handlers intact.
- Add a root `maestro` script that executes `apps/cli/src/index.ts` through the
  repo-pinned runtime, plus `check:agent-pack` scripts and Just recipes.

**One invocation contract**

```bash
pnpm maestro -- <command> [args]
```

This root script is the canonical invocation in factory and materialized
customer targets. Every skill, plugin, setup document, fixture, and MCP launcher
uses it so the checked-in package/lockfile selects the CLI version. Bare
`maestro` and `pnpm exec maestro` are optional packaged conveniences only after
their installation fixture passes; no plan step assumes they resolve.

The novice surface reserves four verbs:

```bash
pnpm maestro -- create <target>
pnpm maestro -- start
pnpm maestro -- add <outcome-or-recipe>
pnpm maestro -- check
```

`preflight`, `plan-check`, `scaffold`, `verify`, `map`, `impact`, `adr`,
`receipt`, `mcp`, and `promote` remain agent/operator commands. The four novice
verbs project those lower-level contracts rather than implementing alternate
behavior.

**Contract**

- Every command returns a versioned JSON envelope and an optional concise human
  rendering from the same result object.
- Stable exit classes distinguish success, findings, invalid invocation, blocked
  mutation, unavailable dependency, and internal defect.
- Secret values, provider payloads, raw auth context, and unredacted logs never
  enter result envelopes.
- All path-bearing operations resolve and report source/template/target roots.
- Mutations are dry-run by default, require `--write`, list exact paths, detect
  collisions, and refuse ambiguous or dirty overlapping targets.
- Every error has a stable code, `safeToContinue` state, one recommended next
  action, and a copyable exact rerun. Human output remains short; `--details`
  and `--json` expose architecture/version evidence for agents and operators.

**Resolution path:** promote the bootstrap plugin-contract package into the
versioned agent-pack command library, while routing all mutations through
existing generators and runtime contracts.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test
pnpm --dir apps/cli test
pnpm check:agent-pack
pnpm check:secret-canaries
```

**Acceptance**

- JSON snapshots are stable and versioned.
- Human output is a projection, not a second behavior path.
- Legacy runtime CLI fixtures still pass.

**Migration / rollback:** retain both binary names and legacy routing for one
tagged release. Roll back the new factory router without changing application
runtime contracts.

### WP-3.2 Implement `pnpm maestro -- preflight`

- **Kind:** `fixture-to-real`
- **Target:** generator `template:doctor` and scattered readiness reports are
  composed into one safe orientation command
- **Dependencies:** WP-3.1

**Files**

- Add `tooling/agent-pack/src/preflight.ts` and fixtures.
- Add `apps/cli/src/factory/preflight.ts`.
- Reuse exported, side-effect-free readers from `tooling/generators` and
  `tooling/release`; extract them only where current CLI-only wrappers prevent
  reuse.
- Add `docs/template/preflight.md` and link it from quickstart and host setup.

**Output**

- Supported OS/architecture, Node range/current version, root
  `packageManager`/pnpm/Corepack state, Git version/worktree support, dependency
  install state, disk/port prerequisites where relevant, and offline status.
- Source, immutable template, and writable target roots.
- Pack, CLI, template, Convex, Workflow, Workpool, Confect, and Effect versions.
- Compatibility status and canonical base/tag.
- Workflow semantic support status, accepted/restricted/unsupported primitives,
  published-version drift, and the exact fast semantic rerun.
- Worktree state, generated drift, collisions, and safe mutation verdict.
- Selected blueprint, enabled modules, and per-provider environment posture.
- Canonical system, generator, recipe, and documentation indexes.
- Allowed claim levels: fake, local, dev, preview, staging, production.
- Exact next command for each actionable finding.

Default human rendering contains only: **what works now**, **what is
demo-only**, and **the next action**. It says "sample data," "saved locally,"
"connected test account," and "live" before internal terms such as
fake/seam/evidence class. Version matrices, semantic primitives, roots,
registries, and raw posture remain in `--details`/`--json`.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test preflight
pnpm --dir apps/cli test preflight
pnpm check:workflow:fast
pnpm maestro -- preflight --json
```

**Acceptance**

- Greenfield, canonical clone, existing-app source/target, dirty overlap,
  incompatible version, and missing provider fixtures are covered.
- Unsupported Node/pnpm/Git/OS, missing install, offline operation, stale host
  integration, auth cancellation, and safe-to-continue recovery fixtures are
  covered with stable error codes and one exact rerun.
- Read-only preflight never creates files, logs secrets, or authenticates to a
  production deployment.
- Mutation is blocked on ambiguous repo roles or incompatible versions.

**Migration / rollback:** additive read-only command. Roll back its router
entry; existing doctor commands remain available.

### WP-3.3 Implement `pnpm maestro -- plan-check` and `scaffold`

- **Kind:** `fixture-to-real`
- **Target:** existing `tooling/stack/plan.mts` and `template:*` generators
  become safe agent-pack operations
- **Dependencies:** WP-3.2

**Files**

- Add `tooling/agent-pack/src/planCheck.ts`, `scaffold.ts`, and tests.
- Add CLI adapters under `apps/cli/src/factory/`.
- Export stable callable APIs from `tooling/stack/plan.mts` and
  `tooling/generators/src/index.ts`; keep their current CLIs as projections.
- Add `docs/template/agent-pack-scaffolding.md` linking to the existing app
  factory and `how-to-add-*` playbooks.

**Behavior**

- `plan-check` validates deterministic schema, work-package completeness,
  dependency/layer order, declared contract risks, and declared ADR references.
  It does not grade business judgment.
- `scaffold` accepts a supported generator ID plus typed args, invokes the
  existing generator API, and returns generated paths, provenance, collisions,
  semantic coverage rule IDs, manual follow-up, codegen, and focused gates.
- Preview is default. `--write` requires a passing preflight and unchanged
  preflight fingerprint.
- Unsupported requests return the nearest recipes/generators and a
  `template-gap` work-package skeleton; they do not improvise source files.
- Workflow scaffold refuses a primitive marked unsupported/restricted unless the
  declared alternative or ADR-gated escape-hatch path is selected.

**Focused gates**

```bash
pnpm --dir tooling/stack test
pnpm --dir tooling/generators test
pnpm --dir tooling/agent-pack test planCheck scaffold
pnpm check:generators
pnpm check:workflow-semantics
```

**Acceptance**

- CLI output matches direct generator output byte-for-byte for previewed files.
- Collision and dirty-worktree fixtures refuse writes.
- No generator rules or playbook prose are copied into the skill or CLI.

**Migration / rollback:** preserve all `pnpm template:*` entrypoints. The
agent-pack adapter can be removed without changing generated output contracts.

### WP-3.4 Implement `pnpm maestro -- verify` and `check`

- **Kind:** `fixture-to-real`
- **Target:** Just recipes and quality gates currently emit heterogeneous output
- **Dependencies:** WP-3.1

**Files**

- Add `tooling/agent-pack/src/verify.ts`, `receipt.ts`, `diagnostics.ts`, and
  focused tests.
- Add `apps/cli/src/factory/verify.ts`.
- Add `tooling/quality/src/diagnosticRegistry.mts` as the machine-readable owner
  for gate ID, evidence class, canonical doc, safe repair hints, and rerun
  command.
- Project existing gate definitions into the registry from
  `tooling/quality/src/check-definitions.mts`; do not create a second gate list.
- Add `schemas/maestro-verification-receipt.schema.json` and examples under
  `docs/template/examples/receipts/`.

**Behavior**

- `--scope focused --changed <paths>` selects only declared focused commands;
  `--scope full` invokes `just verify`.
- `pnpm maestro -- check` is the novice projection: it runs preflight plus the
  smallest truthful focused verification for the current target, then renders
  "works now / demo-only / next action." `verify` retains the complete
  agent/operator controls and evidence output.
- Results bind command/version, subject commit, dirty state, environment,
  provider posture, evidence class, pass/fail/skipped/unavailable state, and
  staleness conditions.
- Failures name the invariant and show canonical docs and safe repair
  directions. They never auto-edit code or weaken a gate.
- Workflow findings preserve the semantic rule ID and distinguish static,
  behavioral, runtime, and live-promotion proof; a shape lint cannot satisfy a
  stronger evidence class.
- `taste` and `contract-review` are reported as advisory evidence. Deterministic
  required gates remain blocking.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test verify diagnostics receipt
pnpm --dir tooling/quality test
pnpm check:gates
pnpm check:workflow-semantics
pnpm check:ci-completeness
```

**Acceptance**

- Pass, deterministic fail, advisory fail, unavailable provider, stale commit,
  and partial-scope fixtures produce honest receipts.
- A receipt becomes stale after any later commit or relevant environment change.
- No failure path offers editing the gate as a repair.

**Migration / rollback:** keep raw gate commands authoritative. The structured
projection can be removed without weakening CI.

### WP-3.5 Implement the thin Maestro MCP transport

- **Kind:** `fixture-to-real`
- **Target:** port the safe protocol/dispatch patterns from
  `/Users/lappy/maestro/tooling/workflow/mcp-server.mts` onto the new CLI
  contracts
- **Dependencies:** WP-3.2 through WP-3.4

**Files**

- Add `tooling/agent-pack/src/mcp/server.ts`, `protocol.ts`, `projection.ts`,
  and tests.
- Add `tooling/agent-pack/src/mcp/convexProfiles.ts` and host-local
  configuration tests that consume the audited profile contract from WP-2.2.
- Add `apps/cli/src/factory/mcp.ts` and the `maestro mcp` stdio entrypoint.
- Only now add the Maestro MCP declaration to the Claude plugin and the
  repo-native Codex projection. Both invoke `pnpm maestro -- mcp` from the
  resolved target root. Phase 2 plugin tags remain skill-only.
- Add an advanced `pnpm maestro -- mcp configure` flow that previews and, only
  with explicit local write approval, installs a host-native Convex profile.
  Generated local Convex MCP config is ignored and removable; no customer
  template commits an auto-starting Convex server.

**Initial tools**

- `maestro_preflight`
- `maestro_plan_check`
- `maestro_scaffold_preview`
- `maestro_verify`
- Later phases add `maestro_map`, `maestro_impact`, and `maestro_adr_status` by
  projecting their CLI schemas.

**Security and scope**

- The server injects repo root and execution context; callers cannot supply
  identity, workspace, token, function ref, or arbitrary command fields.
- MCP calls typed library functions directly; no shell-string concatenation.
- No planning, coaching, repair generation, chat state, or telemetry lives in
  the server.
- Mutating scaffold remains unavailable over MCP in V1; the host executes the
  explicit reviewed CLI `--write` command.
- Maestro MCP is read-oriented and contains no Convex admin credential.
- Convex MCP is absent in fake mode. Its default opt-in profile is `inspect`;
  `dev-power` is a separately previewed local choice. Both run from the one root
  Convex project, always disable environment-value tools, fail closed on an
  unknown upstream tool, and refuse production flags/deployments.
- Install/remove fixtures use the actual current Claude Code and Codex
  configuration mechanisms rather than assuming a shared config filename.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test mcp
pnpm --dir apps/cli test mcp
pnpm check:headless-surface-contract
pnpm check:secret-canaries
```

**Acceptance**

- MCP and CLI return the same structured payloads for the same read-only call.
- Invalid protocol/tool/argument and forbidden-field fixtures fail safely.
- Stdout contains protocol frames only; diagnostics go to redacted stderr.
- Fake-mode host fixtures launch no Convex MCP. Inspect/dev-power fixtures show
  the exact enabled/disabled inventory, keep env tools disabled, and remove
  local configuration without changing customer code.

**Migration / rollback:** disable the plugin MCP server. Direct CLI operation
remains fully supported.

## Phase 4: Customer Target, Walking Skeleton, And Outcome Recipes

Goal: make the first ten minutes valuable to a novice instead of making them
learn the repository before seeing an app.

### WP-4.0 Implement `pnpm maestro -- create` and the customer release manifest

- **Kind:** `template-gap`
- **Backlog:** `AP-007 first-run visible app`
- **Dependencies:** WP-3.1, WP-3.2

**Files**

- Add `schemas/maestro-customer-release-manifest.schema.json` and a generated
  manifest for each tagged template release under `releases/<version>/`.
- Add `tooling/release/src/customerTarget/manifest.ts`, `materialize.ts`,
  `ownership.ts`, path-safety/collision helpers, and fixtures.
- Add `tooling/agent-pack/src/create.ts` and `apps/cli/src/factory/create.ts`.
- Add `docs/template/customer-target-contract.md` and update the quickstart and
  template release process.

**Manifest contract**

- Every factory path is classified as `template-owned`, `customer-extension`,
  `generated`, `local-only`, or `factory-only`, with copy/generate/omit and
  upgrade posture.
- Customer targets include the runtime application, required generators,
  canonical architecture registries/gates, concise operating docs, and selected
  blueprint assets. They exclude internal backlogs/plans, vendored source
  references, maintainer eval runs, factory release internals, optional demo
  apps, and graph artifacts unless explicitly selected.
- The manifest names the exact immutable template tag, source checksum, pack/CLI
  compatibility, expected file hashes, and customer-owned extension seams.
  Release self-protection fails if any shipped factory path is unclassified.

**Create experience**

```bash
pnpm maestro -- create <target> --name "My App" --outcome "Track client requests"
pnpm maestro -- create <target> --name "My App" --outcome "Track client requests" --demo-only --write
```

- Ask or accept only app name, first user outcome, and whether to remain
  demo-only. Architecture nouns, providers, workflows, and deployment are not
  first-run questions.
- Preview is default. It resolves a reviewed tagged release rather than copying
  the dirty factory checkout; shows exact paths, omissions, collisions, install
  size, and next command; and writes only with `--write`.
- Materialize a separate empty/safely approved target, personalize visible app
  metadata and the first-outcome seed, and write `template-instance.json` with
  the release/ownership facts. Reject `/`, the home directory, the factory
  source, same-root source/target, non-empty ambiguous targets, and unresolved
  symlink/path escapes.
- Dependency installation and Git initialization are previewed, separately
  approved actions. Create never authenticates Convex, launches MCP, chooses a
  production deployment, or imports prior-app files automatically.

**Resolution path:** promote the tagged-release ownership manifest and
materializer as the single factory-to-customer boundary, then route the four-
verb CLI and later upgrades through that same contract.

**Focused gates**

```bash
pnpm --dir tooling/release test customerTarget
pnpm --dir tooling/agent-pack test create
pnpm --dir apps/cli test create
pnpm check:generated-files
pnpm check:secret-canaries
```

**Acceptance**

- Golden tagged-release, preview, empty target, collision, dirty factory,
  factory-only exclusion, path escape, interrupted write, and rollback fixtures
  pass.
- A customer target contains every required runtime/gate asset and none of the
  declared factory-only/backlog/vendor/eval surfaces.
- Create output gives one next command and can be removed before first commit;
  it never overwrites prior work silently.

**Migration / rollback:** before the target's first commit, rollback removes
only the exact files recorded in the create journal after confirming their
hashes. After commit, normal Git history owns rollback. The immutable source
release is never modified.

### WP-4.1 Implement `pnpm maestro -- start`

- **Kind:** `template-gap`
- **Backlog:** `AP-007 first-run visible app`
- **Dependencies:** WP-4.0, WP-3.4

**Files**

- Add `tooling/agent-pack/src/start.ts`, `processSupervisor.ts`, `ports.ts`, and
  tests.
- Add `apps/cli/src/factory/start.ts`.
- Add `docs/template/start-modes.md` and update `docs/template/quickstart.md`.

**Modes**

- Default `fake`: validate/install state, then start the web app without a
  Convex account and print/open its URL.
- `local`: start an explicitly supported local Convex backend, Confect watch,
  and web process.
- `dev`: require an authenticated personal Convex dev deployment and start the
  backend/web watchers.
- Preview/staging/production are not long-running local start modes; they use
  the promotion ladder in Phase 7.

**Behavior**

- Run preflight first and show blocking findings before spawning.
- Use argument arrays, deterministic cwd, port collision detection, grouped
  redacted logs, signal forwarding, and reliable child cleanup.
- Print the actual selected URL and readiness route.
- Never fall through from fake/local to a production deployment.
- Show the personalized app name/first outcome from the target instance rather
  than presenting the canonical factory reference app as the user's app.

**Resolution path:** promote first-run process orchestration into a
deterministic agent-pack command that composes the existing web and backend
entrypoints and leaves those lower-level commands available as fallbacks.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test start processSupervisor ports
pnpm --dir apps/cli test start
pnpm smoke:web-static
```

**Acceptance**

- A clean clone reaches a visible fake-mode URL with one command after install.
- Ctrl-C leaves no child processes.
- Port and missing-auth failures explain the repair and do not partially start.

**Migration / rollback:** the existing `pnpm --dir apps/web dev` and
`dev:backend` scripts remain supported fallbacks.

### WP-4.2 Add a workflow-optional generic SaaS application blueprint

- **Kind:** `template-gap`
- **Backlog:** `AP-008 generic application blueprint`
- **Dependencies:** WP-4.0, WP-4.1; only an optional automation variant depends
  on the supported Phase 1 subset

**Files**

- Add `tooling/generators/src/blueprints/saasApplication.ts` and register it in
  the canonical blueprint catalog.
- Add `docs/template/blueprints/saas-application.md`.
- Add deterministic seed/source files under `examples/saas-application/seed/`.
- Add generated blueprint fixtures to `tooling/generators/src/index.test.ts`.
- Add visible reference-app data and E2E coverage only through the existing Saas
  UI/business-shell, feature, adapter, Confect, and Convex layers.

**Generator command**

```bash
pnpm template:quickstart -- --blueprint saas-application --name "My App"
pnpm template:quickstart -- --blueprint saas-application --name "My App" --write
```

**Blueprint contract**

- Workspace tenancy and member-safe data access.
- One neutral, renameable business entity vertical slice with list/detail/create
  behavior and all required UI states.
- The default slice uses the minimum necessary primitive: table/route for CRUD
  and a capability only where a governed operation is needed. It contains no
  mandatory workflow and makes no claim about unsupported workflow semantics.
- An optional approval/background variant is available only when the semantic
  ledger marks its exact primitives supported. That variant demonstrates stable
  versioning, principal reauthorization, bounded payloads, lifecycle/cleanup,
  and a Trust Receipt without making the base blueprint depend on it.
- Web and headless parity through generated contracts.
- Fake-safe providers with clear seams, not placeholder success.
- No GTM, Maestro agency, or customer-specific business logic.

**Resolution path:** promote the proven golden-path patterns into one neutral,
implemented default blueprint rather than pretending the optional GTM blueprint
fits every app.

**Focused gates**

```bash
pnpm --dir tooling/generators test
pnpm check:generators
pnpm template:workflow-output-smoke
pnpm check:workflow-semantics
pnpm --dir apps/web test
pnpm smoke:web-static
```

**Acceptance**

- The dry run enumerates every target and collision.
- `pnpm maestro -- create`, then `start`, produces a personalized useful CRUD
  slice; a first record can be created and read in fake/local mode before any
  workflow or provider setup.
- Handoff and readiness projections label every fake/seam surface.

**Migration / rollback:** the existing `source-grounded-gtm-brain` and
`gtm-implementation` IDs remain available. Roll back by removing the new catalog
entry before deleting its fixtures.

### WP-4.3 Add an outcome-oriented feature recipe library

- **Kind:** `template-gap`
- **Backlog:** `AP-009 outcome recipe library`
- **Dependencies:** WP-3.3, WP-4.2

**Files**

- Add schema and loader under `packages/template-core/src/recipes/`.
- Add machine-readable recipes under `docs/template/recipes/` with a generated
  index; do not maintain parallel hand-written index facts.
- Add `pnpm maestro -- add <outcome-or-recipe>`, advanced `recipes list/show`,
  and recipe projection through the core skill.
- Add recipe validation to `tooling/quality/check-generators.mts` or a dedicated
  `check:recipes` registered through the canonical gate registry.

**Initial recipes**

1. Add a CRUD business entity.
2. Import a file/data set with validation and rollback.
3. Add one approval/background automation, available only for the supported
   workflow subset.

The other candidate outcomes remain research/backlog entries until observed
design-partner demand justifies a maintained recipe.

Each recipe names user outcome, consequential questions, canonical systems,
work-package classifications, exact generator previews, likely provider
references, migration risks, focused gates, and observable done state. It does
not generate an implementation plan or prescribe client business semantics. It
also names the minimum primitive, when not to use the recipe, and concrete
escalation triggers from table/route -> capability -> workflow -> agent.

**Resolution path:** promote recurring founder outcomes into a validated recipe
schema whose commands and owners resolve against live registries; keep product
judgment with the host agent and user.

**Focused gates**

```bash
pnpm --dir packages/template-core test recipes
pnpm --dir tooling/agent-pack test recipes
pnpm check:recipes
pnpm check:docs-freshness
```

**Acceptance**

- A host agent can map common non-architectural user language to the right
  Maestro pattern without loading every repo document.
- Every command and canonical owner in a recipe is validated against live
  registries.
- `pnpm maestro -- add` previews the exact recipe/generator work and asks only
  consequential product questions; it does not expose fourteen architecture
  choices to the novice.
- An unknown outcome yields adjacent recipes and a `template-gap`, not invented
  architecture.

**Migration / rollback:** recipes are advisory context. Remove a recipe from the
index only after marking it deprecated and naming its replacement.

### WP-4.4 Build provider coaching references and doctors

- **Kind:** `fixture-to-real`
- **Target:** generated provider checklist and `template:doctor` become
  task-specific coaching inputs
- **Dependencies:** WP-3.2, WP-4.3

**Files**

- Start with one Convex reference under `agent-pack/references/` plus only the
  provider references required by an accepted initial recipe. WorkOS,
  Cloudflare, PostHog, LLM, email, storage, billing, and deployment references
  are added on observed demand rather than prewritten as an unvalidated library.
- Add provider-specific doctor adapters under
  `tooling/agent-pack/src/providers/` that reuse integration/env reports.
- Add `pnpm maestro -- doctor <provider> --environment <name>`.
- Link each reference to the canonical env manifest and provider docs rather
  than copying secret lists.

**Convex coaching must cover**

- Official `convex ai-files install` for Claude Code and Codex.
- Safe opt-in `convex mcp start --project-dir . --deployment dev` profiles, with
  no MCP in fake mode and environment-value tools always disabled.
- Project creation/authentication, local versus personal dev deployment, and
  generated URL/env wiring.
- Confect and Convex codegen order.
- Workflow/Workpool compatibility and when a version change requires the matrix.
- Common auth, codegen, deployment selection, and component failures.
- The explicit step from dev proof to preview/staging; no automatic production
  flags.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test providers
pnpm template:doctor -- --mode fake
pnpm check:env-boundary
pnpm check:provider-boundary
pnpm check:secret-canaries
```

**Acceptance**

- The host asks only consequential provider questions.
- Doctors report missing/invalid secret names without values.
- A user can stop after fake mode and still have an honest working app.

**Migration / rollback:** references and doctors are additive. Provider SDK
boundaries remain owned by `packages/integrations`.

### WP-4.5 Add a local/operator-only Build Readiness surface

- **Kind:** `template-gap`
- **Backlog:** `AP-007 first-run visible app`
- **Dependencies:** WP-4.1 through WP-4.4

**Files**

- Add a localhost-only readiness presenter/server under
  `tooling/agent-pack/src/readiness/`, opened by `pnpm maestro -- start`.
- If a hosted operator projection is later required, place it behind existing
  authenticated operator capabilities and an explicit non-production/default-
  excluded release-manifest entry; do not add a public customer route.
- Pure presenters for preflight, provider posture, recipe selection, and latest
  receipt.
- Adapter reads only from generated/canonical machine-readable artifacts; it
  never invokes a coding agent or executes mutation commands from the browser.
- Local E2E/visual coverage and a production-build exclusion fixture.

**UI content**

- Plain-language "what works now," "what is demo-only," and "next action," with
  internal real/fake/seam/unverified terms available under details.
- Current blueprint and first useful outcome; say "automation" only when one is
  actually selected.
- A simple Screens / Data / Automations / Connections summary; technical App Map
  nodes and affected systems remain under details after Phase 5.
- Provider setup progress with safe copyable doctor commands.
- Last verification subject and staleness.
- The next one to three human/agent actions, derived deterministically from
  preflight findings.

**Resolution path:** promote existing preflight/provider/receipt facts into a
localhost presenter owned by the agent pack, with production exclusion proven by
the customer release manifest rather than a public application route.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test readiness
pnpm --dir tooling/agent-pack test readiness-visual
pnpm check:secret-canaries
pnpm --dir tooling/release test customer-production-exclusions
```

**Acceptance**

- `pnpm maestro -- start` prints and can open the localhost readiness URL.
- The page is useful in fake mode and cannot expose secret values.
- It is a status/readiness UI, not a second chat or agent control plane.
- The default production customer artifact has no public readiness route or
  architecture/provider metadata endpoint.

**Migration / rollback:** the local surface is additive and removable without
changing customer application runtime behavior.

### WP-4.6 Run the early Claude/Codex walking-skeleton evaluation

- **Kind:** `template-gap`
- **Backlog:** `AP-005 Claude and Codex distribution`
- **Dependencies:** WP-4.0 through WP-4.5; full Phase 1 is not required for the
  CRUD path

**Files**

- Add one host-independent alpha scenario and deterministic assertions under
  `tooling/agent-pack/evals/walking-skeleton/`.
- Add current Claude Code and Codex adapters that start with only the committed
  repo instructions/skills; plugins are a separately measured optional variant.
- Record synthetic/redacted run artifacts, timing boundaries, interventions,
  error codes, and final local receipt with a short retention policy.

**Required scenario**

```text
clean clone -> prerequisites/install -> create personalized target
            -> start visible fake app -> add CRUD outcome
            -> create/read first record -> check -> explain what is demo-only
```

Measure clean-clone-to-URL, clean-clone-to-personalized interaction, and first
persisted-record time separately; do not hide dependency installation from the
headline metric. Include offline/missing prerequisite, browser-open failure, and
stale plugin recovery. A second optional scenario connects a personal dev Convex
project through the inspect profile without enabling production or env value
tools.

**Resolution path:** promote the smallest cross-host founder journey into an
early executable investment gate, then feed observed failures back into the
customer manifest, CLI, blueprint, recipes, and setup references before broader
product work continues.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test walking-skeleton
pnpm evals:agent-pack -- --suite walking-skeleton --host claude
pnpm evals:agent-pack -- --suite walking-skeleton --host codex
```

**Acceptance**

- The scenario passes twice on each host with human intervention limited to
  dependency/auth approval and product naming, not architecture rescue.
- Both hosts produce the same customer manifest, vertical-slice contracts, and
  gate result through `pnpm maestro -- ...`.
- A user can state what works, what is sample/demo-only, and the one next
  action.
- Do not fund the broad map/upgrade/promotion backlog as a release train until
  failures from this evaluation are repaired and rerun.

**Migration / rollback:** eval artifacts are synthetic and disposable; the
scenario owns no customer or provider state.

## Phase 5: App Map, Impact, ADRs, And Optional Deep Graphs

Goal: make architecture legible to both humans and agents and enforce only the
relationships that the repo can prove deterministically.

### WP-5.1 Implement the deterministic Maestro App Map

- **Kind:** `template-gap`
- **Backlog:** `AP-010 architecture map and decision lifecycle`
- **Dependencies:** Phase 3, WP-4.2

**Files**

- Add `tooling/app-map/package.json`, `tsconfig.json`, `src/schema.ts`,
  `src/build.ts`, `src/validate.ts`, and fixtures.
- Add `apps/cli/src/factory/map.ts` and `pnpm maestro -- map`.
- Add `docs/template/app-map.md` and the Build Readiness projection.
- Register `test:app-map` and `check:app-map` through root scripts, Just, and
  the gate registry.

**Canonical inputs**

- `docs/template/system-catalog.json`
- `docs/template/product-topology.json`
- `docs/template/data-resources.json`
- generated Confect contract/JSON-schema manifests
- generated workflow registry and graphs
- workflow semantic support contract and per-version coverage manifests
- generated route tree
- headless operation registry
- package/workspace dependency metadata
- generator provenance and `template-instance.json`

**Output**

- Versioned nodes for systems, resources, tables, routes, capabilities,
  workflows/versions/semantic rules, agents, providers, packages, and headless
  operations.
- Typed edges such as owns, persists, invokes, projects, exposes, depends-on,
  generated-by, governed-by, and verified-by.
- Provenance back to the canonical input for every node/edge.
- Default human output groups facts as **Screens**, **Data**, **Automations**,
  and **Connections**, with ownership gaps and one next action. Full graph JSON
  is explicit `--json`; Markdown/DOT remain optional exports.

The map is rebuilt on demand from canonical sources. It is not a second mutable
database and does not require a daemon.

**Resolution path:** promote existing canonical registries into one generated,
provenance-bearing projection and gate; never make the App Map a competing
architecture authority.

**Focused gates**

```bash
pnpm --dir tooling/app-map test
pnpm check:app-map
pnpm check:system-catalog
pnpm check:system-topology
pnpm check:data-resources
pnpm check:workflow-semantics
pnpm check:headless-surface-contract
```

**Acceptance**

- Every map fact has canonical provenance.
- Unowned resources, dangling refs, parallel authorities, and stale generated
  projections fail with repair-oriented diagnostics.
- The same commit produces byte-stable JSON.

**Migration / rollback:** map output is a generated projection. Remove the
projection/gate without modifying its canonical registries.

### WP-5.2 Implement `pnpm maestro -- impact --base`

- **Kind:** `template-gap`
- **Backlog:** `AP-010 architecture map and decision lifecycle`
- **Dependencies:** WP-5.1

**Files**

- Add `tooling/app-map/src/impact.ts`, `gitDiff.ts`, risk classification, and
  fixtures.
- Add `apps/cli/src/factory/impact.ts` and MCP projection.
- Add impact usage to planning and verification references.

**Behavior**

```bash
pnpm maestro -- impact --base <actual-pr-comparison-base>
pnpm maestro -- impact --base <sha> --json
```

- Resolve changed paths from Git, then traverse only deterministic ownership and
  dependency edges.
- Resolve the actual PR comparison base from trusted CI/PR metadata or an
  explicit caller value. If local context is ambiguous, stop and request
  `--base`; never silently substitute `origin/main` for the branch's real base.
- Report affected systems, durable data, workflow versions, providers, public
  contracts, routes, headless surfaces, semantic rule IDs, ADRs, and focused
  gates.
- Distinguish direct, generated, and transitive impact.
- State unknown/unmapped paths explicitly; never claim a complete blast radius
  from partial mapping.

**Resolution path:** promote deterministic Git-diff-to-App-Map traversal into a
read-only CLI and MCP projection, preserving explicit unknowns instead of
guessing through embeddings.

**Focused gates**

```bash
pnpm --dir tooling/app-map test impact
pnpm --dir apps/cli test impact
pnpm check:app-map
```

**Acceptance**

- Golden diffs for schema, workflow, capability, route, provider, docs-only, and
  unknown files produce correct affected sets.
- The command never writes or invokes an external graph service.

**Migration / rollback:** additive read-only command.

### WP-5.3 Add a consequential-only ADR lifecycle

- **Kind:** `template-gap`
- **Backlog:** `AP-010 architecture map and decision lifecycle`
- **Dependencies:** WP-5.1, WP-3.3

**Files**

- Keep `docs/template/adr/` as the canonical cross-cutting ADR directory.
- Add `docs/template/adr/README.md` and a concise template with stable ID,
  status, context, decision, consequences, supersedes/superseded-by, owner,
  affected systems/resources, migration, and rollback.
- Add `tooling/agent-pack/src/adr.ts` and advanced CLI commands
  `pnpm maestro -- adr create|status|check`.
- Add `tooling/quality/check-architecture-decisions.mts` and tests, registered
  as `check:architecture-decisions`.
- Extend system/schema decision schemas and stack-plan declared risks with
  optional/required `decisionRefs` where the risk class is consequential.
- Add ADR edges to the App Map.
- Add structured diff classifiers for the machine-owned system catalog,
  product-topology, data-resource, workflow-publication, provider, host-support,
  and template-compatibility registries.

**When an ADR is required**

- Introduce/split/merge a canonical system or authority.
- Change tenant, identity, trust, or security boundaries.
- Change durable data ownership, retention, export, delete, or migration posture
  beyond the specialized generated schema decision.
- Replace a canonical provider or cross-provider abstraction.
- Change published workflow determinism/version/retry/principal semantics.
- Enable `unstableArgs` or another upstream compatibility escape hatch.
- Change template/pack compatibility or supported host contract.

Routine features, bug fixes, generated pattern instances, styling, and
implementation choices inside an accepted boundary do not require an ADR.

**Enforcement**

- Parse structured frontmatter/schema; do not regex-grade prose.
- Validate unique IDs, status transitions, existing links, supersession, known
  system/resource IDs, and required migration/rollback fields.
- Compare structured canonical registries against the actual PR comparison base.
  A machine-known consequential transition (for example, authority/system
  ownership, tenant/trust boundary, retention/delete posture, provider
  authority, published workflow semantics, or support-range change) requires a
  linked ADR even when the work package forgot to declare the risk.
- `plan-check` declarations can add a consequential risk/ADR requirement but
  cannot suppress one derived from canonical-registry diffs. An unclassified
  registry change fails with the field/classification repair; the gate still
  does not guess semantic intent from arbitrary source text.
- Human/AI review judges whether the decision is good; the gate judges whether
  the declared contract is complete and linked.
- The novice sees a short decision card (choice, consequence, reversibility);
  the host invokes/checks the advanced ADR commands without requiring the user
  to learn ADR mechanics.

**Resolution path:** promote the consequential decision schema, lifecycle, and
link checker into the template, importing accepted ADR history and using
supersession rather than rewriting it.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test adr
pnpm check:architecture-decisions
pnpm check:system-catalog
pnpm check:schema-migration-notes
pnpm check:app-map
```

**Acceptance**

- Valid create/status/supersede flows are deterministic and dry-run by default.
- Adversarial missing/broken/duplicate links fail with exact repair guidance.
- A machine-known consequential registry diff fails without an ADR even when the
  plan declares no risk; a declared risk can only make the requirement stricter.
- A routine generated feature passes without ceremonial ADR creation.

**Migration / rollback:** import ADR 0001 and 0002 unchanged except for additive
metadata where necessary. Never erase accepted history; supersede it.

### Deferred evaluation: Graphify and code-review-graph adapters

This is not a V1 work package and does not block any release. Keep the decision
record below as maintainer guidance; create an implementation package only after
the deterministic App Map is adopted and a measured use case shows incremental
value.

- A future `docs/template/optional-code-graphs.md` may document evaluated use
  cases, isolated installation, privacy/storage, freshness, resource, and
  removal guidance.
- Add an App Map exporter only after verifying a real import format and redacted
  fixture. Do not install packages, databases, embeddings, or hooks during
  normal create/start/add/check.

**Decision**

- Customer default: `pnpm maestro -- map` and `pnpm maestro -- impact`.
- Maintainer option: CRG for AST/semantic/blast-radius exploration; Graphify for
  community and visual exploration.
- No grep interception, PreToolUse denial, session injection, post-edit hooks,
  git hooks, automatic embeddings, global vault, or committed graph databases.
- Agents may query an installed graph as useful context and fall back to normal
  repository tools.

Any later experiment must prove a clean customer install still has zero graph
dependency/background work, the export contains no secrets or ignored vendor
content, and removal leaves Maestro unchanged. The deterministic App Map remains
canonical.

## Phase 6: Existing-App Adoption And Real Upgrade Engine

Goal: preserve valuable prototypes, move them into Maestro boundaries safely,
and make tagged template upgrades a real operation instead of a checklist-only
report.

### WP-6.1 Implement the existing-application adoption workflow

- **Kind:** `template-gap`
- **Backlog:** `AP-011 existing-app adoption`
- **Dependencies:** WP-3.2, WP-3.3, WP-5.1, WP-5.3

**Files**

- Add `agent-pack/references/existing-apps.md` from the approved safety
  contract, kept one hop from the core skill.
- Add `tooling/agent-pack/src/adopt.ts` and `apps/cli/src/factory/adopt.ts`.
- Add `schemas/maestro-adoption-work-package.schema.json` and fixtures under
  `tooling/agent-pack/__fixtures__/adoption/`.
- Add `docs/template/existing-app-adoption.md` with source/template/target and
  cutover examples.

**Behavior**

```bash
pnpm maestro -- adopt preflight --source <path> --target <path>
pnpm maestro -- adopt work-package --source <path> --target <path> --out <path>
```

- Source is read-only prior art by default; target is a separate clean Maestro
  app.
- The command records roots, worktree state, baseline evidence locations,
  editable boundaries, identity/tenant/data mappings, compatibility needs,
  cutover, deletion timing, approval, and rollback fields.
- Preserve/port/replace/delete decisions are supplied by the host agent and
  user. The CLI validates shape and authority; it does not infer them from a
  universal analyzer.
- In-place adoption requires explicit rationale, clean rollback, and a declared
  editable boundary.

**Resolution path:** promote the approved existing-app safety contract into a
validated adoption work-package schema and dry-run CLI while leaving
preserve/port/replace/delete judgment with the host agent and user.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test adopt
pnpm --dir apps/cli test adopt
pnpm check:agent-pack
pnpm check:secret-canaries
```

**Acceptance**

- Separate-target, approved in-place, dirty overlap, same-root, missing
  rollback, and destructive deletion fixtures behave correctly.
- The tool never copies source files automatically.
- A host agent can use normal repo/browser tools to populate a valid work
  package without learning a new project-management system.

**Migration / rollback:** generated work packages are planning artifacts. Delete
an unapproved draft; once work starts, preserve it with the implementation
history.

### WP-6.2 Centralize pack/template/version compatibility

- **Kind:** `fixture-to-real`
- **Target:** `template-instance.json` and release tooling hold partial,
  report-only compatibility facts
- **Dependencies:** WP-0.3, WP-3.2

**Files**

- Move the canonical `template-instance` schema into
  `packages/template-core/src/templateInstance/` and make generators/release
  tooling consume it.
- Add pack, CLI, template, workflow-schema, and compatibility-set versions.
- Add supported current/previous pack-template-host ranges, deprecation date,
  support state, and the exact behavior shown for older-than-supported or
  newer-than-tool targets. V1 supports the current tag and an upgrade from
  exactly one prior tagged release; broader ranges require later evidence.
- Add generated migrations for current instance files in
  `tooling/generators/src/templateInstanceMigration.ts`.
- Update `docs/template/client-fork-upgrade-guide.md` and release tests.

**Focused gates**

```bash
pnpm --dir packages/template-core test templateInstance
pnpm --dir tooling/generators test templateInstance
pnpm --dir tooling/release test
pnpm check:config-drift
```

**Acceptance**

- Preflight can distinguish compatible, migratable, unsupported, and newer-than
  tool states.
- A user outside the support window sees a stable error code, whether it is safe
  to continue read-only, the last supported tool/tag, and one recovery path.
- Old instance files migrate deterministically without losing unknown
  customer-owned extension fields.
- Version claims come from one schema, not docs and generator-local types.

**Migration / rollback:** migrations are pure and versioned. Preserve the
pre-migration file in Git/dry-run output; downgrade only through an explicit
reverse migration supported by the release.

### WP-6.3 Add one-prior-tag collision-free upgrade planning and apply

- **Kind:** `fixture-to-real`
- **Target:** `template:upgrade` currently emits a generic report; V1 needs a
  narrow evidenced delta, not a generalized merge/rollback platform
- **Dependencies:** WP-6.2, WP-5.2

**Files**

- Add release manifests under `releases/<version>/manifest.json` with JSON
  schema under `schemas/`.
- Add reviewed migration notes/modules under `releases/<version>/migrations/`
  only for the single supported prior-tag -> current-tag path.
- Add `tooling/release/src/upgrade/plan.ts`, `applyCollisionFree.ts`,
  `collisions.ts`, and `verify.ts` with tests.
- Route `template:upgrade` and advanced
  `pnpm maestro -- upgrade plan|apply-safe|verify` to the same engine.
- Add upgrade impact to App Map and receipts.

**Release manifest contract**

- From/to versions and compatible pack/CLI ranges.
- Expected before hashes for template-owned files.
- Add/modify/move/delete operations with ownership and collision policy.
- Generator regeneration and contract-diff requirements.
- Environment changes by name only.
- Schema/data migrations, preconditions, compatibility window, and rollback.
- Focused and full verification commands.
- Manual review items for customer extension seams.

**Behavior**

- Plan/dry-run is default and produces exact diffs.
- V1 plans only from the immediately prior supported tag to the current tag.
  Older/skipped/newer states return an unsupported-resolution packet rather than
  composing unproved deltas.
- Safe apply requires a clean committed target, explicit `--write`, a matching
  plan fingerprint, exact before hashes, and only collision-free operations over
  template-owned/generated paths. It may add, regenerate, or replace/remove an
  unchanged template-owned path exactly as the reviewed manifest specifies.
- Any customer extension overlap, unexpected hash, ambiguous move, semantic
  conflict, data migration, provider/environment mutation, or manual review item
  stops before writes and emits an agent/human resolution packet. There is no
  broad merge strategy.
- Minimize future collision surface first: stable customer-extension packages,
  versioned core packages, generated provenance, and narrow codemods are
  preferred over teaching the upgrade engine to merge arbitrary source.
- V1 does not build a custom resumable arbitrary-operation or Git rollback
  system. Apply writes in a bounded staged directory and atomically promotes
  only after hashes revalidate; a pre-upgrade Git commit is the code rollback.
- Verification binds the upgraded commit/worktree to the release manifest.

**Focused gates**

```bash
pnpm --dir tooling/release test upgrade
pnpm --dir tooling/generators test upgrade
pnpm --dir tooling/app-map test impact
pnpm check:generated-files
pnpm check:schema-migration-notes
```

**Acceptance**

- Clean, customer-extension, template-core collision, interrupted, failed
  staging, stale plan, unexpected hash, and unsupported older-tag fixtures pass.
- A report-only success can never be mistaken for an applied upgrade.
- Only the immediately prior tag and collision-free manifest operations can
  reach `apply-safe`; all other cases produce a useful resolution packet without
  touching the target.
- The existing client-upgrade guide points to executable commands.

**Migration / rollback:** require a pre-upgrade commit and record its SHA. Code
rollback restores through reviewed Git operations. Provider credentials and live
data have separate named plans and are never changed as a side effect of file
upgrade. Generalized multi-tag application, conflict resolution, resumable
state, and custom rollback remain deferred until design-partner evidence reveals
repeatable collision classes.

### WP-6.4 Prove one-prior-tag compatibility and migration handoff

- **Kind:** `template-gap`
- **Backlog:** `AP-012 release migrations and rollback proof`
- **Dependencies:** WP-6.3, Phase 1 schema changes

**Files**

- Add representative upgrade fixtures under
  `tooling/release/__fixtures__/upgrade/`, including workflow graph v1 to v2,
  template-instance migration, and provider posture migration.
- Add a local/preview migration harness using the existing
  `@convex-dev/migrations` dependency through the approved Confect/plain-Convex
  interop boundary.
- Keep live/data-changing execution outside `upgrade apply-safe`. The harness
  emits preconditions, preview counts, compatibility window, explicit operator
  command, evidence requirement, and rollback/roll-forward disposition for the
  one supported release transition.
- Update schema decision and release process docs with expand/migrate/contract
  sequencing.

**Resolution path:** promote representative migrations and the
expand/migrate/contract sequence into the release harness through the existing
approved Convex migration boundary.

**Focused gates**

```bash
pnpm --dir tooling/release test migration
pnpm --dir packages/convex test migration
pnpm check:schema-migration-notes
pnpm check:data-resources
```

**Acceptance**

- Expand and backward-compatible code deploy before data migration; contract
  waits until the compatibility window closes.
- Dry-run and preview counts are captured without production data exposure.
- Each fixture proves forward migration, old/new compatibility, and rollback or
  explicit roll-forward-only recovery.
- A file upgrade that requires a data migration remains blocked at verification
  until the separately authorized migration receipt is present.

**Migration / rollback:** defined per release manifest. Any irreversible data
step requires explicit approval, backup/export evidence, and a roll-forward
recovery plan before execution.

## Phase 7: Provider Promotion Ladder And Proof Receipts

Goal: make the difference between a demo and a production-capable app obvious,
safe, and mechanically verifiable.

### WP-7.1 Replace global provider mode with per-environment posture

- **Kind:** `fixture-to-real`
- **Target:** `template-instance.json` currently centers a single
  `fake | test | live` provider mode
- **Dependencies:** WP-6.2, WP-4.4

**Files**

- Extend the canonical template-instance schema with environments `fake`,
  `local`, `dev`, `preview`, `staging`, and `production`.
- Record each provider as `fake`, `seam`, `configured`, `verified`, `disabled`,
  or `unavailable` per environment, plus evidence references and expiry.
- Update generator doctor/handoff outputs, integration reports, Build Readiness,
  and migration fixtures.
- Update `docs/template/env-manifest.json` projections without duplicating
  secret ownership.

**Focused gates**

```bash
pnpm --dir packages/template-core test templateInstance
pnpm --dir tooling/generators test doctor handoff
pnpm check:env-boundary
pnpm check:provider-boundary
pnpm check:config-drift
```

**Acceptance**

- One provider can be verified in dev while another remains fake, without a
  misleading global live claim.
- Production posture cannot be inherited from dev/staging evidence.
- Secret names may appear; values never do.

**Migration / rollback:** migrate the old global mode into conservative
per-provider entries and mark them unverified until doctor evidence exists.

### WP-7.2 Implement promotion plans without implicit deployment

- **Kind:** `fixture-to-real`
- **Target:** release/deploy tooling already emits plans but is not unified with
  agent-pack evidence
- **Dependencies:** WP-7.1, WP-3.4, Phase 1 publication/census contracts

**Files**

- Add `tooling/agent-pack/src/promotion.ts` and CLI
  `pnpm maestro -- promote plan --from <env> --to <env>`.
- Compose existing `tooling/release` deploy doctor/plan functions rather than
  reimplementing deployment.
- Add provider/environment evidence requirements to the diagnostic registry and
  receipt schema.
- Add a trusted, short-lived promotion-verdict artifact and verifier under
  `tooling/release/src/deploy/`; bind environment, exact commit/artifact,
  compatibility set, evidence inputs, active/restartable workflow census,
  approver class, expiry, and nonce/hash.
- Update every staging/production deploy entrypoint and Buildkite deploy job to
  verify that verdict immediately before deployment. Scope staging/production
  credentials to the gated deploy job so a parallel ungated command cannot
  inherit them.
- Extend pipeline/deploy self-protection fixtures so removing, bypassing, or
  reordering the verdict check fails CI. Bootstrap the authenticated
  operator-only active/restartable-run census endpoint and its no-workflows
  result before making census evidence mandatory.
- Update hosting, operations, and provider coaching docs.

**Behavior**

- Fake -> local: visible app and local deterministic gates.
- Local -> dev: authenticated personal Convex deployment and provider doctors.
- Dev -> preview: immutable commit artifact and preview smoke.
- Preview -> staging: environment-owned secrets, migrations, E2E, and operator
  receipt, plus an authorized active/restartable workflow-version census.
- Staging -> production: exact staged commit, current evidence, rollback,
  explicit human approval, preserved runner/capability/completion bindings for
  every referenced version, and the existing production deployment path.
- A dependency, semantic contract, Workpool limit, runner/capability/completion
  retirement, or cleanup-retention change requires the matching compatibility
  and live census evidence. Ordinary additive workflow versions do not need
  production reads in CI.
- `promote plan` is read-only. Actual deploy commands remain separate, explicit,
  and authority-scoped, but they refuse to run without a current trusted verdict
  for the exact artifact/environment. Green checks alone never trigger a deploy.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test promotion
pnpm --dir tooling/release test deploy
pnpm check:ci-completeness
pnpm check:deploy-authority
pnpm check:config-drift
pnpm check:secret-canaries
```

**Acceptance**

- Missing provider, stale receipt, wrong commit, pending migration, and absent
  rollback fixtures block the plan with exact remediation.
- Missing active-run census, deleted referenced runner/capability/completion
  binding, or incompatible Workflow/Workpool set blocks staging/production
  promotion.
- Direct/alternate deploy entrypoints, stale/wrong-environment verdicts, changed
  artifacts after verdict, missing human production approval, and credential
  access outside the gated job all fail in self-protection fixtures.
- No command silently promotes because all checks are green.

**Migration / rollback:** promotion planning is additive. Deployment rollback
continues to use the prior artifact and release runbook.

### WP-7.3 Complete the commit/environment-bound verification receipt

- **Kind:** `fixture-to-real`
- **Target:** existing sample workflow receipt and release reports are evidence
  inputs, not one product verification contract
- **Dependencies:** WP-3.4, WP-7.1, WP-7.2

**Files**

- Finalize the verification receipt schema and signing/hash strategy.
- Add projections from focused/full gates, workflow Trust Receipts, provider
  doctors, preview/staging smokes, semantic compatibility set, published
  workflow fingerprints, active-run census, and deploy artifacts.
- Add `pnpm maestro -- verify receipt show|check` and MCP read projection.
- Update delivery receipt and handoff docs to generate views from this artifact.

**Evidence classes**

- Presence
- Mechanical/static
- Behavioral/local
- Advisory AI review
- Provider/dev
- Hosted preview/staging
- Production deployment

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test receipt
pnpm --dir tooling/release test
pnpm check:generated-files
pnpm check:secret-canaries
```

**Acceptance**

- A receipt names exactly what it proves and what remains unsupported.
- Commit, dirty state, environment, deployment ID, provider posture, command
  versions, semantic contract version, referenced workflow versions, timestamps,
  and expiry are tamper-evident.
- Presence and advisory evidence cannot satisfy behavioral/hosted requirements.

**Migration / rollback:** old handoff/release reports remain readable but are
marked legacy/non-canonical. New reports derive from the receipt.

### WP-7.4 Prove one real Convex reference application end to end

- **Kind:** `pattern-instance`
- **Target:** `saas-application` reference instance
- **Dependencies:** WP-4.2, Phase 1, WP-7.3

**Generator commands**

```bash
pnpm maestro -- create <disposable-target> --name "Reference App" --outcome "Review reference records" --write
pnpm maestro -- add crud-business-entity --name referenceRecord --write
pnpm maestro -- add approval-background-automation --name reviewReferenceRecord --write
```

**Files**

- Materialize the reference in a disposable fixture or dedicated example, not by
  polluting template core with client logic.
- Drive the public proof through the four-verb CLI and tagged customer release;
  compare its generated contracts to the underlying generator fixtures rather
  than bypassing the product path in the acceptance run.
- Configure a personal/dev Convex deployment using the coaching flow.
- Prove authenticated create/read, durable workflow run, approval/control, Trust
  Receipt, CLI/MCP read parity, and Build Readiness.
- Capture current receipts without committing credentials or customer data.

**Focused gates**

```bash
pnpm confect:codegen
pnpm confect:manifest
pnpm --dir packages/convex test workflows
pnpm check:workflow-semantics
pnpm check:workflow-principal-propagation
pnpm check:workflow-version-immutability -- --comparison-base <actual-pr-merge-base> --publication-manifest docs/template/generated/workflow-publications.json
pnpm smoke:hosted:browser
pnpm smoke:hosted:visual
just verify
```

**Acceptance**

- The same documented path works for a fresh reviewer.
- Fake mode remains operational after live/dev setup.
- Dev evidence is never labeled staging or production.

**Migration / rollback:** delete the disposable deployment/example through its
documented provider process after preserving redacted receipts. Template core
does not depend on the deployment.

### WP-7.5 Set the telemetry and privacy posture

- **Kind:** `template-gap`
- **Backlog:** `AP-013 privacy-safe product feedback`
- **Dependencies:** WP-3.4

**Decision**

- V1 ships with no outbound Maestro product telemetry.
- Local receipts may record command names, versions, durations, and results for
  the user, but they do not leave the repository automatically.
- Never collect source text, prompts, file contents, raw paths, secrets,
  provider payloads, identities, or application data.
- First-run privacy disclosure distinguishes Maestro telemetry (none by default)
  from data that the selected Claude/Codex host, a Convex MCP/dev deployment,
  and explicitly configured providers may receive. "Dev" is not described as
  offline or data-private merely because production flags are off.
- Add a previewable, user-exported support bundle containing only allowlisted
  versions, stable error codes, durations, redacted posture, and receipt IDs. It
  excludes source/prompts/raw paths/data and is never uploaded automatically.
- A later opt-in telemetry proposal requires an ADR, public schema, retention,
  deletion, disable path, and a user-visible preview of the exact event.

**Files**

- Add `docs/template/agent-pack-privacy.md`.
- Add a no-network conformance fixture around all factory CLI commands.
- Add secret/payload canaries to MCP/receipt/provider fixtures.
- Add support-bundle schema, preview/export fixtures, and host/provider
  data-flow disclosures linked from create and MCP opt-in.

**Resolution path:** promote the no-telemetry decision into a public privacy
contract plus executable no-network and redaction fixtures before distributing
the pack.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test privacy
pnpm check:secret-canaries
pnpm check:logging-boundary
```

**Acceptance**

- Factory commands pass with network denied except explicitly selected provider
  and freshness operations.
- All external calls are visible, purpose-specific, and user initiated.

**Migration / rollback:** no telemetry state to migrate.

## Phase 8: Cross-Host Conformance And Release

Goal: prove the product with fresh hosts and users, then release it in
reversible stages.

### WP-8.1 Build Claude Code and Codex conformance fixtures

- **Kind:** `template-gap`
- **Backlog:** `AP-005 Claude and Codex distribution`
- **Dependencies:** Phases 2 through 7

**Files**

- Add host-independent scenarios under `tooling/agent-pack/evals/scenarios/`.
- Add Claude and Codex runners/adapters under `tooling/agent-pack/evals/hosts/`.
- Add deterministic assertions under `tooling/agent-pack/evals/assertions/`.
- Register `pnpm evals:agent-pack` and a non-flaky offline structural subset for
  required CI.

**Scenarios**

- Greenfield generic app to visible fake-mode vertical slice.
- Tagged factory release to a separately materialized customer target with
  factory-only exclusions and ownership evidence.
- Existing prototype to an approved preserve/port/replace work package.
- Convex dev setup with official skills and safe MCP.
- New capability/workflow generated through canonical patterns.
- Architecture violation repaired without weakening a gate.
- Workflow version bump with an active v1 run.
- Non-idempotent action retry, caller-supplied principal, scheduled-inline step,
  and oversized payload rejected with the canonical typed repair.
- Scheduled child workflow rejected on 0.4.4, Workpool-clamped schedule horizon
  rejected, wrong-generation EventId rejected, and a terminal retry failure
  mapped without spending the remaining attempts.
- Large payload converted to an artifact reference and a bounded batch workflow
  generated without raw Convex component calls.
- Provider promotion refused on stale/insufficient evidence.
- Upgrade with a customer-owned collision.

**Adversarial assertions**

- No unauthorized write, provider mutation, production flag, destructive
  migration, secret exposure, gate edit, source overwrite, or generated-file
  hand edit.
- No raw workflow import, `v.any()` workflow result, accepted-but-unmapped
  option, mutable published version, or semantic claim backed only by shape
  lint.
- No grep interception, tool denial, Maestro-installed/required supervisory AI,
  or invented template command. Host-native delegation remains allowed when the
  user or host workflow chooses it.
- Only task-relevant skill references are loaded.

**Resolution path:** promote host-independent scenarios, host adapters, and
deterministic assertions into the release conformance gate for both Claude Code
and Codex.

**Focused gates**

```bash
pnpm --dir tooling/agent-pack test evals
pnpm evals:agent-pack -- --host claude --structural
pnpm evals:agent-pack -- --host codex --structural
```

**Acceptance**

- Both hosts produce the same canonical artifacts and deterministic command
  results within a documented intervention budget.
- Host-specific ergonomics may differ; architecture and proof may not.

**Migration / rollback:** eval harness is additive and contains no customer
state.

### WP-8.2 Run fresh-agent forward tests

- **Kind:** `fixture-to-real`
- **Target:** the approved agent-pack spec's forward-test acceptance suite
- **Dependencies:** WP-8.1

**Files**

- Add the forward-suite orchestrator and graders under
  `tooling/agent-pack/evals/`.
- Store synthetic, redacted run artifacts under `tooling/agent-pack/evals/runs/`
  with an explicit retention policy.
- Add a human-intervention classification fixture that distinguishes required
  product/provider approval from architecture coaching or agent recovery.

For each test, record host/model/tool version, initial context, user prompt,
allowed intervention, artifacts, commands, timing, forbidden-action assertions,
and final receipt. Run with no access to the conversation that designed the
pack.

Required passes:

1. Non-technical founder materializes and reaches the visible personalized app
   and can explain the first useful outcome, what is sample/demo-only, and the
   provider posture without being required to add a workflow.
2. Founder requests a common feature in product language; the agent selects a
   recipe, generates the correct pattern, and proves it.
3. Existing prototype preserves named behavior and data while moving one slice
   into Maestro boundaries.
4. Claude Code installs official Convex skills plus safe MCP and completes a dev
   workflow without production access.
5. Codex completes the same architecture outcome through repo-native skills.
6. Red gates lead to repairs, not suppressions or gate edits.
7. Upgrade collision blocks safely and produces a useful manual resolution
   packet.
8. A workflow request exercises the supported parallel, typed approval,
   scheduling, subworkflow, and cleanup set; scheduled-child behavior remains a
   typed rejection on 0.4.4. Injected retry/principal/payload/EventId violations
   are repaired through the typed path without raw component escape or gate
   edits.

**Focused gates**

```bash
pnpm evals:agent-pack -- --suite forward
pnpm check:agent-pack
just verify
```

**Acceptance**

- All required outcomes pass twice on each first-class host or have a documented
  deterministic product defect with a completed repair cycle.
- Human intervention is limited to consequential product/provider approvals and
  external authentication.

**Migration / rollback:** test artifacts contain synthetic data and are removed
or redacted after scoring.

### WP-8.3 Package, tag, and release in stages

- **Kind:** `template-gap`
- **Backlog:** `AP-014 agent-pack release`
- **Dependencies:** WP-8.2

**Files**

- Add pack build/manifest code under `tooling/agent-pack/src/release/`.
- Add checksums and compatibility metadata to the tagged template release.
- Update `docs/template/template-release-process.md`, quickstart, host setup,
  privacy, security, upgrade, and handoff docs by linking to canonical sources.
- Add release readiness to `tooling/release` and its presence/behavior
  distinction.

**Resolution path:** promote only a forward-tested pack into the versioned
manifest and staged tag pipeline, retaining the previous compatible tag as the
tested rollback target.

**Release sequence**

1. **Walking-skeleton internal alpha (after WP-4.6):** template maintainers;
   fake/local only, before the broad map/adoption/promotion backlog.
2. **Design-partner alpha:** two supervised customer targets, personal Convex
   dev only; findings reshape later work packages.
3. **Private beta:** Claude Code and Codex installers, upgrade from exactly one
   prior tag, preview/staging evidence.
4. **V1:** compatibility set frozen, one real reference app, forward tests,
   documented rollback, and no critical workflow-runtime gaps.

**Focused gates**

```bash
pnpm review:readiness
pnpm review:completion
pnpm check:agent-pack
pnpm check:workflow-semantics
pnpm check:workflow-version-immutability -- --comparison-base <actual-release-comparison-base> --publication-manifest docs/template/generated/workflow-publications.json
pnpm evals:agent-pack -- --suite forward
just verify
```

**Acceptance**

- Pack, CLI, template, dependency, workflow semantic contract, skill, plugin,
  and release manifest versions agree.
- Install, update, uninstall, and rollback are tested from a clean temporary
  home and target.
- Release notes name migrations, compatibility, known limits, and exact
  evidence.

**Migration / rollback:** restore the prior template/pack tag and prior deployed
artifact. Keep compatibility shims for one release. Provider credentials remain
outside Git and are rolled back only through provider-specific runbooks.

## Dependency And Critical Path

| Order/track | Blocking outcome                                      | Why it blocks                                                                 |
| ----------: | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
|           1 | Phase 0 doctrine, compatibility, and support ledger   | Prevents both tracks from productizing incorrect or silently dropped behavior |
|          2A | Phase 2 repo-native context + Phase 3 core CLI/check  | Gives both hosts one pinned, inspectable path without MCP dependency          |
|          3A | Phase 4 create/start/CRUD/add/check walking skeleton  | Produces personalized ICP value without requiring a workflow                  |
|          4A | WP-4.6 early fresh-host evaluation                    | Repairs onboarding/product defects before broader platform investment         |
|          2B | Phase 1 workflow runtime correctness (parallel track) | Blocks only workflow recipes/claims, published workflows, beta, and V1        |
|           5 | Phase 5 map/impact/ADR after alpha evidence           | Makes proven architecture legible and consequential changes governable        |
|           6 | Phase 6 adoption + one-prior-tag safe upgrade         | Adds maintenance scope only after the customer target works                   |
|           7 | Phase 7 promotion/evidence/deploy authority           | Separates demo success from deployment truth and prevents gate bypass         |
|           8 | Phase 8 full conformance/release                      | Proves supported host/runtime/upgrade/promotion outcomes                      |

After Phase 0, the workflow-optional alpha track (2A-4A) and Phase 1 runtime
track (2B) may proceed independently. The alpha must reject every unsupported
workflow primitive and make no workflow-compatibility claim. Full Phase 1 must
pass before the automation recipe, published application workflows, real
workflow reference proof, private beta, or V1. Phase 5+ remains an investment
decision after WP-4.6, not an excuse to delay product learning. Do not
parallelize published workflow schema/runner changes across overlapping files.

## Initial Four-Slice Stack

The first executable stack should stay deliberately narrow:

1. Copy the approved spec and add AP backlog/roadmap entries.
2. Add ADR 0002 plus the Convex compatibility doc and correct lint claims.
3. Add the pinned compatibility JSON/matrix harness.
4. Add green behavioral characterization/support fixtures that assert current
   unsupported behavior and typed rejection.

After this stack merges, land WP-0.5 as a second, single-slice Phase 0 stack and
make its semantic gate required. Only then should Phase 1 repairs or the
workflow-optional alpha stack begin. The first alpha stack is: official
committed host context, the canonical local CLI/preflight/check contract,
customer release manifest/create, then start plus the workflow-free CRUD
blueprint. This keeps both execution tracks grounded in executable definitions
rather than this plan alone.

## Global Verification Rules

Every implementation slice must:

- start from current `origin/main` and preserve unrelated dirty work;
- classify work in its stack manifest;
- dry-run any applicable `pnpm template:*` generator;
- name and run the exact focused gates from the matching playbook;
- regenerate Confect/Convex artifacts rather than editing them;
- update system/data/topology/real-fake-seam status in the same commit when it
  changes;
- record migrations and rollback before a durable schema or provider change;
- classify every official workflow primitive and every graph field in the
  semantic support contract; never merge an accepted-but-unmapped option;
- use the typed workflow builder/generator instead of importing raw component
  primitives or hand-editing a generated published runner;
- bind published workflows only to versioned workflow-callable capabilities and
  completion refs plus a versioned runtime interpreter/source closure; never
  resolve a logical `latest` binding at run time;
- declare the approval/retry-strategy/dedupe-horizon/quota/spend/redaction
  posture for every consequential capability and verify inbound provider
  authenticity/replay at the adapter boundary;
- derive customer targets only from a tagged release/ownership manifest and keep
  factory-only paths out;
- use the actual PR comparison base plus the trusted workflow publication
  manifest for impact/immutability checks;
- require the trusted promotion verdict in every staging/production deploy
  authority path;
- produce passing command output before claiming completion;
- end its phase with `just verify`.

The following remain mandatory release backstops where applicable:

```bash
pnpm check:format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:tooling
pnpm check:generators
pnpm check:confect-compat
pnpm check:confect-contracts
pnpm check:workflow-semantics
pnpm check:workflow-principal-propagation
pnpm check:workflow-policy-snapshots
pnpm check:workflow-version-immutability -- --comparison-base <actual-pr-merge-base> --publication-manifest docs/template/generated/workflow-publications.json
pnpm check:workflow-graph-boundary
pnpm check:system-catalog
pnpm check:system-topology
pnpm check:data-resources
pnpm check:schema-migration-notes
pnpm check:provider-boundary
pnpm check:env-boundary
pnpm check:secret-canaries
pnpm build
just verify
```

## Risks And Mitigations

| Risk                                        | Mitigation                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Product becomes another AI layer            | Keep one short skill, conditional references, deterministic CLI, and thin MCP; conformance forbids agent supervisors   |
| Maestro doctrine drifts from Convex         | Pinned compatibility matrix, official AI files, ADR 0002, behavioral workflow fixtures                                 |
| A schema field is accepted but ignored      | Machine semantic ledger requires a compiler mapping and fixture for every supported field                              |
| Lint gives false semantic confidence        | Narrow lint to syntax/imports; require generated, behavioral, runtime, and promotion proof at the proper layer         |
| Active workflows break on deploy            | Immutable graph/runner/runtime/source-closure/capability/completion bindings, unique names, retirement windows, census |
| A future step silently changes behavior     | Versioned refs/runtime plus resolved source/deployed-bundle closure fingerprints; no logical `latest` binding          |
| Retries duplicate external effects          | Strategy union, durable reservations/reconciliation, provider proof, dedupe horizon, terminal-error mapping            |
| Retry bypasses approval or spend controls   | Consequential guards live inside the capability and reuse the logical effect/spend reservation                         |
| Parallelism is mistaken for atomicity       | Ready-wave observation barrier, honest per-step commits, stable outcome exposure, settled-error fixtures               |
| Fan-out starves the deployment              | Central Workpool budget, bounded batch primitives, backlog health evidence, no unbounded graph cycles                  |
| One tenant pressures the shared Workpool    | Admission budgets reduce pressure but do not prove fairness; bound waves/batches and gate live global backlog          |
| Scheduled work is mistaken for an SLA       | Not-before semantics, requested/actual timestamps, lateness evidence, execution-time deadline/authority checks         |
| Principal loses tenancy/auth truth          | Typed user/system principal, server-injected fields, current-policy recheck for consequential effects                  |
| Policy changes alter an active run          | Versioned kickoff snapshot for deterministic decisions plus current authorization at consequential effects             |
| Journal or payload limit failures           | Static/runtime budgets, artifact IDs, redacted observability summaries                                                 |
| Compensation is mistaken for rollback       | Explicit idempotent compensation policy and copy/tests stating running external actions cannot be undone               |
| Two ledgers disagree                        | Convex journal is execution truth; idempotent Maestro reconciliation is projection only                                |
| Cleanup reports or overclaims deletion      | Quiescence, product-cleaned state, exposed-work census, and explicit 0.4.4 residuals-unverifiable state                |
| Convex MCP exposes dev secrets or mutations | No fake-mode launch; inspect allowlist; env tools always off; explicit local dev-power; unknown tools fail closed      |
| Official skills drift remotely              | Committed outputs, pinned installer/resolved commit/checksums, refresh-only dependency change                          |
| Novice is overwhelmed                       | Four verbs, personalized customer target, three recipes, short human status, technical details on demand               |
| Gates constrain implementation style        | Enforce observable contracts and declared structure; keep prose/taste advisory; avoid regex prompt/tool steering       |
| ADR ceremony expands                        | Consequential risk list only; plan declares risk; structural link checks do not grade prose                            |
| App Map becomes stale authority             | Rebuild from canonical registries; every fact has provenance; generated projection only                                |
| Optional code graph consumes resources/data | Maintainer-only, manual, no hooks/daemons/embeddings by default, removable storage                                     |
| Upgrade overwrites customer work            | One prior tag, exact hashes, ownership, dry run, collision stop, bounded staged apply, Git rollback                    |
| Demo evidence is mistaken for production    | Per-provider/environment posture and evidence-class receipt                                                            |
| Promotion checks are bypassed               | Short-lived artifact-bound verdict in every deploy entrypoint, credential scoping, CI self-protection                  |
| Factory internals leak into customer target | Release ownership/exclusion manifest, full classification gate, target-content fixtures                                |
| CLI leaks secrets through diagnostics       | Allowlisted fields, canary fixtures, logging/secret gates, no raw provider payloads                                    |

## Product Metrics

Measure locally during forward tests and design-partner sessions; do not add
outbound telemetry in V1.

- Time from clean clone through prerequisite detection/dependency install to a
  personalized visible app URL; record download/install time separately.
- Time to first personalized interaction and first created/read record.
- Time from plain-language feature request to valid work package.
- Generator/pattern-fit rate versus template gaps.
- Focused-gate first-pass rate and CI first-pass rate.
- Number of human questions, separated into consequential and avoidable.
- Number of unsafe actions correctly refused.
- Time to understand a gate failure and reach a passing rerun.
- Existing behavior preserved in adoption fixtures.
- Upgrade collision detection and rollback success.
- Claude/Codex artifact parity.
- Customer target size and number of factory-only paths correctly excluded.
- Evidence accuracy: no claim above its receipt class.
- Semantic coverage: supported graph fields with builder, compiler, fixture, and
  repair documentation.
- Time from a workflow rule violation to the focused passing rerun.

Targets for V1 acceptance:

- Personalized fake-mode app in ten minutes or less from a clean clone on the
  documented supported machine, including prerequisite detection/install; report
  network download time separately rather than excluding it.
- First record created/read and `pnpm maestro -- check` passing in one guided
  session without requiring a workflow, provider account, plugin, or MCP.
- First useful generated/implemented vertical slice in one guided session.
- Zero silent overwrites, secret leaks, unauthorized provider mutations, or
  production MCP flags in conformance fixtures.
- 100% of published workflows bound to immutable versioned runners, completion
  refs, and workflow-callable capability refs.
- 100% of retried actions use a declared strategy with duplicate/ambiguous
  fixtures and a dedupe horizon covering the retry/restart window.
- 100% of supported workflow semantic fields mapped and behaviorally covered;
  zero accepted-but-dropped options.
- 100% of generated workflows have concrete args/return validators, explicit
  return types, generated named kickoff profiles, unique stable restart names,
  principal plumbing, declared policy/effect posture, and lifecycle projection.
- 100% of receipts bound to commit and environment.

## Terminal Conditions

The plan is complete only when all of the following are true:

1. The canonical spec and workflow compatibility ADR are merged in
   `maestro-template-saas-ui`.
2. The current and candidate Convex compatibility sets are executable and the
   chosen set is pinned, including migrations, the skills installer, resolved
   official agent-skills commit, and managed-file checksums.
3. The semantic support ledger classifies every official primitive and V2 graph
   field; every supported entry has a builder, compiler mapping, behavioral
   fixture, and repair path.
4. Kickoff, retry, parallelism/backpressure, subworkflow, transaction,
   scheduling/lateness, bounded iteration, failure/compensation, lifecycle,
   transitive versioning, payload, principal, policy snapshot, event,
   reconciliation, and cleanup conformance tests pass.
5. No generated workflow uses `v.any()` for its result, bypasses the typed
   builder, accepts caller identity fields, or imports raw workflow primitives
   outside the exact runtime allowlist.
6. No active or restartable run executes a mutable latest graph, runner, runtime
   interpreter/source closure, completion callback, or workflow- capability
   binding; scheduled children remain rejected on 0.4.4.
7. Official Convex AI files install into both Claude Code and Codex native repo
   paths from committed checksummed outputs, root `CLAUDE.md` includes
   `AGENTS.md`, and neither host requires a plugin or MCP for the base path.
8. Root `convex.json` is the one project root. Fake mode launches no Convex MCP;
   opt-in inspect/dev-power profiles use the pinned CLI against dev, always
   disable environment-value tools, fail closed on unknown tools, and never
   enable production.
9. A tagged release and fully classified ownership/exclusion manifest
   materialize a separate customer target through `pnpm maestro -- create`;
   factory-only paths never ship.
10. The canonical repo-local invocation supports the four novice verbs `create`,
    `start`, `add`, and `check`; advanced preflight/plan/scaffold/
    verify/map/impact/ADR commands meet their structured safety contracts.
11. The generic SaaS blueprint produces a personalized visible, useful,
    fake-safe CRUD app without requiring a workflow, provider account, plugin,
    or MCP.
12. Three initial outcome recipes and Convex-first coaching let a novice ask in
    product language, apply the minimum-primitive ladder, and avoid learning
    Maestro nouns first.
13. Build Readiness is localhost or authenticated operator-only, uses plain
    language by default, and is excluded from the production customer artifact.
14. The early `create -> start -> add -> check` Claude Code and Codex evaluation
    passes twice per host before later platform work is treated as a release
    train.
15. App Map/impact use canonical provenance and the actual PR comparison base;
    machine-known consequential registry diffs require ADR linkage even when a
    plan omits the risk.
16. Existing-app adoption preserves source prior art, and V1 upgrades exactly
    one prior tag using collision-free exact-hash operations; complex cases stop
    with a resolution packet rather than invoking a general merge engine.
17. Per-provider environment posture and commit/environment receipts prevent
    demo/dev/preview/staging/production claims from collapsing together, and
    every staging/production deploy authority verifies a fresh trusted verdict.
18. Maestro MCP is a thin read-oriented projection of the same CLI contracts;
    mutating scaffold and Convex dev-power access remain explicit CLI/local
    choices.
19. Claude Code and Codex full forward tests pass with no access to the design
    conversation and without a Maestro-installed supervisory AI.
20. Full `just verify`, release readiness, deploy-authority self-protection, and
    host install/uninstall fixtures pass on the exact release commit.

### 2026-07-25 implementation closure audit

This audit separates repository closure from release authority. `repo-proven`
means the implementation and focused deterministic evidence exist on this
branch. It does not mean the canonical tag, hosted service, credentials, or
human approval exists. `external` means no further repository implementation can
honestly manufacture the missing proof. `runner` means the remaining failure is
in the verification host rather than a failing product assertion.

The candidate release is sealed at `186d9d895cb5d8d81aed9322372fe2c8db21e7e6`
from exact clean source `c057e00fe2f894957fe50d7ae560942944e2f523`. The
canonical immutable tag must still be created by release authority; it was not
created during implementation.

|   # | Status          | Closure evidence or remaining authority                                                                                                                                                                                                                                                                              |
| --: | :-------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | external        | The spec and compatibility ADR are implemented here; canonical merge into `maestro-template-saas-ui` remains release-owner work.                                                                                                                                                                                     |
|   2 | repo-proven     | Compatibility manifests, migrations, pinned official skills, resolved source authority, and managed-file checksums are executable and sealed.                                                                                                                                                                        |
|   3 | repo-proven     | `check:workflow-semantics` passes 107 rules and 82 graph fields; builder/compiler/fixture/repair linkage is gate-checked.                                                                                                                                                                                            |
|   4 | repo-proven     | The workflow conformance suites cover kickoff, retry, policy, principal, scheduling, bounded work, lifecycle, versioning, payload, events, reconciliation, and cleanup.                                                                                                                                              |
|   5 | repo-proven     | Generated validators, typed-builder boundaries, identity injection, and raw primitive allowlists are enforced by static and behavioral gates.                                                                                                                                                                        |
|   6 | repo-proven     | Published graph, runner, runtime/source closure, completion, and capability bindings are immutable; scheduled children remain rejected for the pinned runtime.                                                                                                                                                       |
|   7 | repo-proven     | Claude Code and Codex projections, root instruction inclusion, checksummed offline Convex AI files, and plugin-free base use are implemented. Twice-per-host native proof remains under conditions 14 and 19.                                                                                                        |
|   8 | repo-proven     | Root ownership, fake-mode MCP refusal, dev-only inspect profiles, environment-tool denial, unknown-tool failure, and production refusal are covered.                                                                                                                                                                 |
|   9 | external        | Disposable customer materialization passes 2/2 and factory exclusions are sealed. Literal tagged-release proof awaits the canonical immutable `maestro-template-v0.2.0-alpha.1` tag.                                                                                                                                 |
|  10 | repo-proven     | Customer CLI projection exposes the novice verbs and advanced safe contracts; the resealed CLI suite passes 21 files and 130 tests.                                                                                                                                                                                  |
|  11 | repo-proven     | The generic SaaS blueprint and customer-only composition produce the fake-safe CRUD target; generator tests pass 11 files and 111 tests.                                                                                                                                                                             |
|  12 | repo-proven     | Three outcome recipes, minimum-primitive guidance, Convex coaching, and product-language presentation are covered by Agent Pack recipe/context tests.                                                                                                                                                                |
|  13 | repo-proven     | Build Readiness is a non-customer operator surface with plain-language presentation and production exclusion checks.                                                                                                                                                                                                 |
|  14 | external        | Two real clean runs for each of Claude Code and Codex require the first-class host binaries, fresh homes, and release-owner scheduling. Synthetic aggregate acceptance is not substituted for this proof.                                                                                                            |
|  15 | repo-proven     | App Map provenance, comparison-base handling, impact, consequential diff, and ADR linkage are deterministic gated contracts.                                                                                                                                                                                         |
|  16 | repo-proven     | Adoption preserves prior art and the one-prior-tag exact-hash upgrade/rollback boundary is tested; the release-tooling suite passes 32 files and 285 tests.                                                                                                                                                          |
|  17 | mixed           | Evidence classes and deploy self-protection are implemented. A trusted migration issuer/key root, durable replay-consumption service, real Convex auth/deployment, and live environment verdicts remain external.                                                                                                    |
|  18 | repo-proven     | MCP is a thin read-oriented CLI projection; mutation and Convex dev-power remain explicit local choices. Root projection and MCP posture checks pass.                                                                                                                                                                |
|  19 | external        | The forward verifier and anti-forgery aggregate pass structurally, but full blind Claude Code and Codex runs twice per host remain required.                                                                                                                                                                         |
|  20 | runner/external | `review:readiness` and `review:completion` pass on `186d9d89`; focused release, CLI, generator, workflow, secret, install, and seal gates pass. `just verify` still terminates inside Turbo native typecheck with host signal 139 after format/lint, and the canonical tag/live authority proofs remain outstanding. |

The implementation branch is therefore ready for release-authority and
first-class-host closure, but it is not a canonical release and must not be
described as one. Presence audits are supporting inventory only; the focused
behavioral results above are the repository evidence.

### 2026-07-27 post-merge terminal audit

This section supersedes candidate pointers in the earlier audit without
rewriting their historical truth. PR #5 was integrated into
`maestro-template-saas-ui` by squash commit
`0da23625eb366cea3a7f7bfb16b4f33d967de190`. The squash exposed repository-wide
test contention that the feature-branch ancestry had hidden. The repair now runs
Agent Pack, customer CLI, and Convex compatibility suites outside Turbo's
parallel package batch, retains the canonical serial proofs, uses full GitHub
checkout history, and keeps the CI-completeness gate bound to that exact chain.

Release `0.2.0-alpha.1` is resealed at candidate
`cd5a4714d78b39aca178d420bdd9f5974105d3e8` from exact clean source
`20ea56a983b25f37505e7f1681499e5fc005e8bb`. This reseal reflects executable CI
source changes; it is not an attempt to bind old receipts to new content.

The pinned repository toolchain is pnpm `10.12.1`. With that toolchain, the
terminal evidence is:

```text
pnpm release:seal --version 0.2.0-alpha.1 \
  --source-commit 20ea56a983b25f37505e7f1681499e5fc005e8bb --check
verified 0.2.0-alpha.1 from 20ea56a983b25f37505e7f1681499e5fc005e8bb

just verify
Test Files 273 passed (273)
Tests 1904 passed (1904)
coverage ratchet — lines 77.75%, functions 85.38%, branches 80.7%, statements 77.75% (baseline held)
(171059 / 171393) 99.80%
type-coverage success.
check:workflow-semantics passed (107 rules, 82 graph fields)
no dependency violations found (4452 modules, 16063 dependencies cruised)
no leaks found
exit 0
```

Two preserved blind Codex receipts remain valid evidence for their original
candidate `df5925e1`, and only that candidate:

```text
/data/projects/maestro-agent-pack-forward-20260726-release-df5925e1/release-df5925-codex-2/receipt.json
sha256 4b3877c9c111546015672a00421d98f631a68f51680f56dcbad92b6fb3115edc

/data/projects/maestro-agent-pack-forward-20260726-release-df5925e1/release-df5925-codex-4/receipt.json
sha256 a38c8727aa61c270377a084046e2165593a8b5bfa208ee157628a0bddb97ca03
```

They do not prove `cd5a4714`, do not establish a four-host aggregate, and do not
substitute for Claude Code UAT. Claude Code testing remains user UAT and is
outside this implementation closure. `review:readiness` and `review:completion`
remain presence audits rather than behavioral release authority.

Repository implementation and deterministic local gates are therefore green,
subject to the required GitHub `quality` verdict on the post-merge repair PR.
The canonical release tag is still absent. Trusted migration issuer/key-root
operation, durable replay consumption, real Convex authentication/deployment,
and live environment verdicts remain external release or operations authority;
this audit makes no production-deployment claim.

## Final Product Principle

> Let the coding agent think. Give it the smallest amount of Maestro and Convex
> context needed to make good decisions. Make the supported path visible and
> easy. Then use deterministic generators, contracts, migrations, and gates to
> prove that the application still has the architecture the customer came to
> Maestro to get.
