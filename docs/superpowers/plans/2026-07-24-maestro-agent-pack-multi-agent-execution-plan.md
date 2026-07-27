# Maestro Agent Pack Multi-Agent Execution Plan

- Status: execution orchestration companion; implementation not started
- Date: 2026-07-24
- Canonical implementation plan:
  `docs/superpowers/plans/2026-07-24-maestro-agent-pack-productization-plan.md`
- Canonical plan checksum at orchestration time:
  `f9c10571a616ea9e5ba75532f44f2ef272a95c8337145006d41431c4aedd90cc`
- Work packages assigned: 47 of 47
- Primary workstream agents: 8
- Integration controller: the root agent in this thread
- Maximum live implementation workers in the current agent pool: 3, plus the
  root controller

## Outcome

This plan turns the 47-work-package product plan into a restart-safe, merge-safe
multi-agent program. It defines:

- which agent owns every work package;
- which work can proceed in parallel and which must remain serial;
- exclusive file and interface ownership;
- integration checkpoints and wave gates;
- exact prompts for the controller, eight primary agents, and their subagents;
- evidence, escalation, acceptance, and release criteria.

It does not create an AI control plane, project-management product, or new
runtime service. The coding agents use existing Git worktrees, stack manifests,
generators, gates, CI, and receipts. The root controller owns scheduling and
integration judgment.

## Why Eight Primary Agents

Three independent planning reviews proposed 8, 10, and 12 primary agents. Eight
is the best fit for this repository and the available concurrency.

| Option                                                   | Decision | Reason                                                                                                                                          |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 47 agents, one per WP                                    | Reject   | Shared runtime, generator, CLI, registry, and release files would create more conflict than delivery speed.                                     |
| 12 agents with four serial runtime owners                | Reject   | It refreshes context but adds handoffs across the same workflow kernel without adding parallel execution.                                       |
| 10 agents with separate customer and integration streams | Reject   | Customer subdomains are suitable for bounded subagents, while root already owns cross-cutting integration.                                      |
| 8 primary agents plus root                               | Adopt    | It preserves stable domain ownership, an independent evaluator, exact WP coverage, and maximum useful parallelism under the three-worker limit. |

The critical optimization is contract-first parallelism, not the largest number
of simultaneous writers. Phase 1 is intentionally one writing lane because the
schema, runner, generator projections, publication registry, and conformance
suite overlap heavily.

## Workstream Assignment

| Agent | Workstream                         | Assigned work packages                               | Count | Mission                                                                                                                           |
| ----- | ---------------------------------- | ---------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------- |
| A     | Architecture contracts             | WP-0.1 through WP-0.5; WP-5.1 through WP-5.3; WP-6.1 |     9 | Establish compatibility and semantic authority, then own deterministic architecture mapping, ADR governance, and adoption policy. |
| B     | Workflow runtime                   | WP-1.1 through WP-1.11                               |    11 | Own the complete Convex workflow kernel and Phase 1 terminal proof as one coherent implementation lane.                           |
| C     | Host bootstrap                     | WP-2.1 through WP-2.4                                |     4 | Install pinned official Convex context and validate skill-first Claude Code and Codex distribution.                               |
| D     | CLI and MCP platform               | WP-3.1 through WP-3.5                                |     5 | Own the stable local command ABI, preflight, scaffold, verification, receipt foundation, and thin MCP transport.                  |
| E     | Customer journey                   | WP-4.0 through WP-4.5                                |     6 | Deliver tagged customer materialization, start, workflow-free CRUD, three recipes, coaching, and local readiness.                 |
| F     | Independent evaluation and release | WP-4.6; WP-8.1 through WP-8.3                        |     4 | Independently evaluate the alpha and later own full host conformance, forward tests, packaging, and staged release proof.         |
| G     | Compatibility and upgrades         | WP-6.2 through WP-6.4                                |     3 | Own the canonical instance/version schema and exactly-one-prior-tag safe upgrade and migration handoff.                           |
| H     | Promotion and evidence             | WP-7.1 through WP-7.5                                |     5 | Own environment/provider posture, deployment authority, receipts, the real reference proof, and privacy.                          |

The assignments cover all 47 WPs exactly once. Optional Graphify and
code-review-graph evaluation is not a V1 work package and has no implementation
agent.

## Controller And Concurrency Model

The root controller remains active throughout execution. The current pool has
four total slots, so the hard concurrency limit is:

```text
root integration controller
  + at most three active primary/subagents
  = four live agents total
```

Eight agents are logical long-lived owners, not eight simultaneous processes. An
inactive owner is resumed with a follow-up task when its wave opens. A primary
agent may request a subagent only when a global slot is available. Spawning a
subagent never raises the global limit.

At most three branches may mutate concurrently. Read-only reviews also consume
slots and are scheduled only when they shorten a critical path or independently
verify a high-risk checkpoint.

## Mandatory Control Point Before Implementation

The current checkout is a dirty planning checkout and the canonical product plan
is untracked. No implementation agent may use it as a worktree.

Before Wave 1, the root controller must:

1. Preserve both plan files in a reviewed plan-only commit or otherwise freeze
   their exact checksums in a clean planning branch.
2. Fetch and inspect the then-current `origin/main` without overwriting user
   work.
3. Re-audit the product plan's assumptions against that current base.
4. Record `EXECUTION_BASE_SHA`, the two plan checksums, dependency versions, and
   any approved plan delta.
5. Create a clean integration worktree from `EXECUTION_BASE_SHA`.
6. Create each worker worktree only when its wave opens.
7. Refuse execution if the plan checksum or accepted dependency contract has
   changed without review.

The root uses safe, explicit worktree paths created under a task-specific
temporary directory. No worker shares a worktree or Git index with another
worker.

## Branch, Stack, And Commit Contract

Suggested branch prefixes are:

```text
codex/ap-integration
codex/ap-a-architecture-sNN
codex/ap-b-workflow-sNN
codex/ap-c-hosts-sNN
codex/ap-d-cli-sNN
codex/ap-e-customer-sNN
codex/ap-f-evals-sNN
codex/ap-g-upgrades-sNN
codex/ap-h-promotion-sNN
```

Rules:

- Every branch starts from a controller-published integration checkpoint SHA or
  an explicitly approved stacked parent.
- Every stack manifest has no more than four slices and passes
  `pnpm stack:check`.
- Each slice is one intention, follows layer order, carries the required
  work-package classification, and respects the repository source-line budget.
- A large WP may require several stacks. A workstream is never one giant PR.
- Workers commit completed slices on their own branches. They do not merge, tag,
  deploy, or restack other streams.
- Focused gates run before each commit. `just verify` runs before work-package
  handoff, after stack integration, and at phase/checkpoint boundaries.
- Rebase only at start, after a required dependency checkpoint merges, and
  immediately before handoff. Continuous rebasing while a shared contract is
  moving is prohibited.
- If Graphite is enabled, the root controller alone owns cross-stream tracking
  and restacking. Otherwise use ordinary GitHub PRs with the same small-commit
  boundaries.
- Generated-file conflicts are never resolved by hand. Resolve source ownership,
  rerun the canonical generator/codegen sequence, and verify the generated
  fingerprints.

## Shared Hotspots And Write Leases

The root controller owns the shared-hotspot lease table. Only one stream may
hold a lease at a time.

### Root integration hotspots

Feature agents normally submit an `INTEGRATION_REQUEST` instead of editing:

- root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `Justfile`;
- `lefthook.yml`, `eslint.config.mjs`, `.buildkite/pipeline.yml`, and shared
  Buildkite scripts;
- root `AGENTS.md`, `CLAUDE.md`, and managed marker regions;
- `tooling/quality/src/check-definitions.mts` and the central diagnostic/gate
  registries;
- `apps/cli/package.json`, the central CLI router/barrels, and command registry;
- `tooling/agent-pack/package.json`, `tsconfig.json`, and central export barrel;
- `tooling/generators/src/index.ts`, its central test, and workflow output
  smoke;
- `tooling/release/src/index.ts`, its central test, and package metadata;
- `packages/template-core/src/index.ts` and package metadata;
- generated canonical blueprint, recipe, workflow-publication, and release
  indexes;
- root system, product-topology, data-resource, and environment registries;
- cross-cutting quickstart, release-process, and handoff documents.

The root may grant a time-bounded lease when a workstream must test an atomic
change across a hotspot. No second stream may edit that file until the lease is
released and its checkpoint is published.

### Workflow runtime hotspots

Agent B alone writes these throughout Phase 1:

- `packages/convex/confect/workflows/**` shared graph/runtime files;
- generated workflow runner source definitions and publication registry;
- `packages/convex/test/workflow-conformance.test.ts`;
- workflow-specific sections of generator templates and smoke tests.

Agent A remains steward of semantic rule IDs and compatibility truth. Agent B
submits semantic-rule delta requests rather than racing Agent A's contract
files.

### Interface-first integration handshake

When a worker needs shared wiring:

1. The worker implements/tests leaf modules or produces the required generator
   dry run.
2. The worker sends an `INTEGRATION_REQUEST` with exact registrations,
   dependencies, commands, and expected generated output.
3. The root applies only mechanical/shared wiring in the integration worktree.
4. The root publishes a new checkpoint SHA.
5. The worker rebases, completes behavior, and reruns all acceptance commands.

The root does not invent feature semantics while integrating.

## Stable Cross-Stream Interfaces

These contracts must freeze before downstream streams consume them:

| Checkpoint                  | Owning agent | Contract                                                                                                         |
| --------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| CP-0 Plan freeze            | Root         | Execution base SHA, plan checksums, dependency inventory, worktree and lease registry.                           |
| CP-1 Semantic foundation    | A            | Compatibility JSON, semantic rule IDs/status, fixture IDs, gate names, generator/codegen survival contract.      |
| CP-2 Host profile           | C            | One Convex project root, managed AI-file layout/checksums, skill/plugin schemas, safe MCP-profile data contract. |
| CP-3 CLI ABI                | D            | `AgentPackCommand`, repo context, result envelope, exit classes, mutation posture, and human renderer.           |
| CP-4 Mutation/readiness ABI | D            | Preflight fingerprint, diagnostic descriptor, verification/receipt foundation, and safe local invocation.        |
| CP-5 Customer target        | E            | Customer release/ownership manifest, target instance facts, workflow-optional blueprint contract.                |
| CP-6 Alpha candidate        | E            | Integrated WP-4.0 through WP-4.5 candidate at one commit, with no self-certification.                            |
| CP-7 Alpha verdict          | F            | Independent two-host WP-4.6 evidence and repaired rerun.                                                         |
| CP-8 Workflow terminal      | B            | Complete Phase 1 gate, immutable publication/runtime closure, and supported automation subset.                   |
| CP-9 Map/version            | A and G      | App Map provenance schema plus canonical template-instance/support-range schema.                                 |
| CP-10 Upgrade/promotion     | G and H      | One-prior-tag upgrade proof, receipt contract, deploy verdict, and CI self-protection.                           |
| CP-11 Release candidate     | H            | Real reference application and Phase 7 evidence on an exact commit.                                              |
| CP-12 Release verdict       | F            | Full forward tests, install/update/remove/rollback, checksums, staged release evidence.                          |

Stable interface shapes include:

- `AgentPackCommand`: typed args, execution context, mutation posture, versioned
  result envelope, and human rendering;
- `GeneratorDescriptor`: stable ID, args schema, preview/write behavior,
  provenance, semantic rule IDs, and focused gates;
- `DiagnosticDescriptor`: stable code, evidence class, canonical document, safe
  repair, and exact rerun;
- `WorkflowSemanticEntry`: rule ID, support status, authoring constructor,
  compiler mapping, fixture, runtime guard, and repair;
- separate customer-target, upgrade, pack, migration, workflow-publication, and
  aggregate release artifacts with explicit hashes.

## Execution Waves

### Wave 0: Plan and integration setup

Active writers: root only.

- Freeze the plans and execution base.
- Create the integration worktree and lease table.
- Ask Agents A, B, and C for read-only ground-truth/preflight reports if slots
  are available.

Exit: CP-0.

### Wave 1: Semantic foundation

Active writer: Agent A.

- Land WP-0.1 through WP-0.4 as the initial four-slice stack.
- Land WP-0.5 as the next focused stack.
- Agents B and C may finish read-only preparation but may not write against an
  unfrozen semantic contract.

Exit: CP-1 and the Phase 0 gates.

### Wave 2: Two-track launch

Parallel writers: Agents B and C. Agent D may prepare read-only.

- B begins the serial Phase 1 workflow lane.
- C implements Phase 2; its Claude and Codex host fixtures may be delegated to
  disjoint subagents after the common profile contract freezes.

Exit: CP-2 while B continues toward CP-8.

### Wave 3: CLI and customer overlap

Parallel writers: B, D, and later E.

- D lands WP-3.1 and publishes CP-3.
- D implements WP-3.2 and WP-3.4, then publishes CP-4.
- D continues WP-3.3 and WP-3.5.
- After CP-4, E may stack WP-4.0 on the accepted CLI interface while B continues
  Phase 1.

Exit: complete Phase 3 and a branch-proven customer materializer.

### Wave 4: Alpha assembly

Parallel writers: B and E; D finishes only unresolved MCP/host integration.

- E completes WP-4.0 through WP-4.5.
- The automation recipe stays unavailable until B's semantic ledger marks its
  exact primitive set supported.
- Root integrates the customer candidate at one exact SHA.

Exit: CP-6.

### Wave 5: Independent alpha and workflow convergence

Parallel writers: B and F. The third slot is reserved for the owning repair
agent C, D, or E when F finds a defect.

- F runs WP-4.6 twice per host and never modifies product behavior to make the
  evaluation pass.
- Defects return to their owner, integrate, and rerun.
- B completes the Phase 1 terminal gate.

Exit: both CP-7 and CP-8. They are independent hard gates. No Phase 5 through 7
work is funded as a release train before CP-7; no workflow recipe/publication,
beta, or V1 proceeds before CP-8.

### Wave 6: Post-alpha breadth

Parallel writers: A, G, and H.

- A implements WP-5.1, then WP-5.2/WP-5.3 and later WP-6.1.
- G begins WP-6.2 and freezes the template-instance/support contract.
- H may implement WP-7.5 privacy/no-network/support-bundle work while waiting
  for version and promotion dependencies.

Exit: CP-9.

### Wave 7: Upgrade, promotion, and real proof

Parallel writers: A, G, and H, subject to dependency checkpoints.

- G implements WP-6.3 after WP-5.2 and WP-6.2, then WP-6.4 after CP-8.
- H implements WP-7.1 after WP-6.2, WP-7.2 after CP-8, then WP-7.3 and WP-7.4.
- A completes adoption after App Map/ADR contracts are stable.

Exit: CP-10 and CP-11 with full Phases 5 through 7 integration verification.

### Wave 8: Full conformance and staged release

Primary writer/evaluator: F. Other owners reactivate only to fix attributed
defects.

- F implements/runs WP-8.1 and WP-8.2.
- Defects route to A through H; F never lowers acceptance or edits unrelated
  feature code.
- F implements WP-8.3 packaging only after every prerequisite is accepted.
- Root reruns release gates and retains authority over push, tag, deploy, or
  external mutation.

Exit: CP-12 and all 20 terminal conditions from the canonical product plan.

## Acceptance State Model

Agents use these exact states:

- `planned`: assigned but no accepted base/interface yet;
- `ready`: clean worktree, base, dependencies, manifest, and lease confirmed;
- `active`: implementation or delegated verification in progress;
- `branch-proven`: focused gates pass on the worker branch;
- `review-ready`: rebased on the current integration tip, evidence packet
  complete, `git diff --check` clean, and required `just verify` run;
- `accepted`: root merged the work in dependency order and integration CI is
  green;
- `phase-complete`: root ran the phase terminal gate on the exact integration
  SHA;
- `release-proven`: live/install/deploy evidence refers to the exact released
  artifact;
- `waiting-dependency`: useful owned work is exhausted until a checkpoint;
- `needs-authority`: progress requires user/external authority;
- `finding`: a reproducible defect or contract conflict exists.

Workers may claim at most `review-ready`. Only the root may mark `accepted`,
`phase-complete`, or `release-proven`.

## Evidence Packet Required From Every Primary Agent

Prose summaries are insufficient. Every handoff includes:

```text
workstream:
work_packages:
base_sha:
head_sha:
branch_and_worktree:
dependency_checkpoint_shas:
plan_checksum:
stack_manifest:
write_lease:
expected_paths:
actual_paths:
classification:
commits:
generator_dry_runs:
generated_sequence:
migrations_and_rollback:
focused_gates:
  - command
  - exit_status
  - environment_and_tool_versions
  - redacted_output_or_artifact_reference
just_verify:
adversarial_fixtures:
external_state_changed:
acceptance_items_proven:
acceptance_items_not_proven:
known_findings:
rebase_status:
diff_stat:
git_diff_check:
git_status:
integration_requests:
```

Evidence is redacted and commit-bound. Root or an independent reviewer reruns
the highest-risk command after rebase; worker-provided logs alone are not final
authority.

## Integration Request Format

```text
INTEGRATION_REQUEST
workstream:
wp:
base_checkpoint_sha:
worker_commits:
owned_paths_changed:
requested_root_dependencies_or_scripts:
requested_cli_or_mcp_registrations:
requested_generator_registrations:
requested_gate_just_ci_registrations:
requested_canonical_registry_additions:
generator_dry_run_and_normalized_output:
codegen_required:
focused_gates_and_output:
migration_and_rollback:
semantic_decisions: none | exact references
```

Root rejects requests that ask it to invent behavior, silently resolve a
semantic conflict, edit generated output manually, or bypass a gate.

## Escalation And Stop Contract

Every primary/subagent stops and sends a structured escalation when:

- current upstream Convex behavior contradicts the pinned compatibility
  contract;
- an acceptance requirement requires changing the approved plan;
- an accepted dependency/interface is missing or has drifted;
- another stream holds the required hotspot lease;
- unexpected user changes appear in owned paths;
- the work requires production credentials, deployment, deletion, irreversible
  migration, provider spend, or other new authority;
- a focused gate fails on the clean execution base;
- a requested primitive remains `unsupported` or `intentionally-restricted`;
- generated artifacts cannot survive the prescribed generator -> Confect codegen
  -> Convex codegen -> typecheck sequence;
- completing the task would require weakening a gate, adding an unexplained
  suppression, or hand-editing generated output.

Escalation format:

```text
code:
observed_fact:
reproduction:
attempted_safe_paths:
smallest_decision_needed:
recommended_resolution:
affected_workstreams:
work_that_can_continue:
```

An inherited red gate may make a branch review-ready only when a base comparison
proves it unchanged and the evidence packet names it. The phase cannot complete
until the gate is green. Use `waiting-dependency` or `needs-authority` instead
of calling the whole program blocked while useful work remains.

## CI And External-Authority Boundaries

- Worker branches have no staging/production credentials and perform no deploy.
- Branch CI runs stack validation, focused gates, generated drift, relevant
  self-protection, secret canaries, and affected tests.
- Integration CI runs all accepted-slice focused gates plus `just verify`.
- Phase CI runs the exact terminal command set from the canonical product plan.
- Personal dev evidence is not staging evidence; staging is not production.
- Green CI never triggers a deployment.
- Staging/production remain unavailable until WP-7.2 installs the short-lived,
  artifact-bound verdict and credential-scoped deploy job.
- Pushes, PR merges, tags, deployments, credential changes, live migrations,
  provider spend, and destructive cleanup require the authority appropriate to
  that action. This execution plan does not broaden it.

## Universal Primary-Agent Prompt

The root prepends this contract to every stream-specific prompt below.

```text
You are the primary owner of {{AGENT_ID}} / {{WORKSTREAM}} for the Maestro Agent
Pack program.

Repository: /Users/lappy/maestro-template-saas-ui
Dedicated worktree: {{WORKTREE}}
Branch: {{BRANCH}}
Execution base: {{BASE_SHA}}
Accepted dependency checkpoints: {{DEPENDENCY_SHAS}}
Canonical plan checksum: {{PLAN_SHA256}}
Assigned work packages: {{WPS}}
Write lease: {{OWNED_PATHS_AND_HOTSPOTS}}
Explicitly excluded paths: {{EXCLUDED_PATHS}}

Before acting, read completely:
- /Users/lappy/.codex/RTK.md
- repository AGENTS.md
- docs/template/agent-worker-playbook.md
- the complete assigned sections of
  docs/superpowers/plans/2026-07-24-maestro-agent-pack-productization-plan.md
- this stream's section of
  docs/superpowers/plans/2026-07-24-maestro-agent-pack-multi-agent-execution-plan.md
- every relevant authoring/playbook file linked by those sources

Prefix every shell command with rtk.

Operating rules:
1. Confirm the exact base, clean worktree, plan checksum, dependencies, and
   lease before editing. Send READY with those facts.
2. Reconcile the assigned plan with current repo truth. If they conflict, stop
   and send a finding before implementation.
3. Submit and pass a stack manifest with at most four slices before each stack.
   A slice is one intention and respects the repository size/layer/risk gates.
4. Add behavior tests before implementation. Use the narrowest focused gate
   first.
5. Dry-run an applicable template generator before --write. Regenerate Confect,
   Convex, and other generated artifacts; never edit them by hand.
6. Keep real/fake/seam/planned status, migrations, lifecycle, data ownership,
   and rollback current in the same slice.
7. Do not weaken gates, broaden scope, add unexplained suppressions, rewrite
   acceptance, deploy, mutate credentials, touch production, or perform
   destructive external actions.
8. Do not edit root/shared hotspots without a controller lease. Send an
   INTEGRATION_REQUEST for shared wiring.
9. You may delegate only concrete bounded research, fixture, documentation, or
   disjoint leaf-module work. You remain responsible for reading the result,
   integrating it, and rerunning all acceptance commands.
10. Rebase only after an accepted dependency and immediately before handoff.
11. Return the complete evidence packet and claim no state above review-ready.

Stop and escalate on any authority, compatibility, dependency, plan,
shared-hotspot, generated-file, or destructive-action boundary.
```

## Agent A Prompt: Architecture Contracts

```text
Apply the Universal Primary-Agent Prompt.

You are Agent A, owner of Architecture Contracts.

Assigned work:
- First activation: WP-0.1 through WP-0.5.
- Second activation after the alpha/workflow gates: WP-5.1 through WP-5.3 and
  WP-6.1.

Mission:
Establish the executable Convex semantic authority before downstream writing,
then build deterministic App Map/impact/ADR/adoption governance from canonical
registries. Keep guidance concise and gates strict only where mechanically
provable.

Primary owned leaves:
- tooling/convex-compat/**
- packages/template-core/src/workflow-semantics/**
- workflow semantic and compatibility quality checks
- workflow ESLint rules and adversarial fixtures
- ADR 0002 and Convex compatibility documentation
- tooling/app-map/**
- architecture decision/adoption leaf modules, schemas, fixtures, and docs

You remain steward of semantic rule IDs and compatibility truth. Agent B sends
rule-delta requests; do not let two branches edit that authority concurrently.

Suggested subagents, budget up to two over the program:
1. Read-only upstream/package-source compatibility audit.
2. Disjoint adversarial gate/App Map/ADR fixture specialist.

Required checkpoints:
- CP-1 after Phase 0.
- CP-9 for the App Map half.

Acceptance:
- Every assigned WP's Files, Implementation, Focused Gates, Acceptance, and
  Migration/Rollback clauses pass.
- Phase 0 contains only green characterization/support tests; no future-red
  tests are committed.
- Every official primitive/graph field has one supported/restricted/unsupported
  status, mapping/fixture where supported, and repair path.
- Incorrect fail-fast, scheduled-child, atomic-wave, payload, cleanup, Date,
  EventId, scheduling, or immutable-runtime claims are absent.
- The semantic gate is self-protected in local/root/CI inventories and generated
  runners survive the full generation sequence.
- App Map output is byte-stable and provenance-complete; impact uses the actual
  PR base and states unknowns.
- Machine-known consequential registry diffs require ADR linkage even when a
  plan omits the risk; routine pattern instances do not create ADR ceremony.
- Adoption keeps source prior art read-only and rejects unsafe/destructive
  boundaries.
- Focused gates and `just verify` are green at each activation boundary.

Stop if official package source contradicts the plan, a semantic rule cannot be
made executable, or App Map/ADR work would require guessing from arbitrary
source text.
```

## Agent B Prompt: Workflow Runtime

```text
Apply the Universal Primary-Agent Prompt.

You are Agent B, sole owner of the Workflow Runtime lane.

Assigned work: WP-1.1 through WP-1.11, in canonical dependency order.

Mission:
Make Maestro's graph compiler a faithful, safe user of pinned Convex Workflow
semantics and pass the complete Phase 1 terminal gate. Preserve one writer for
the shared graph schema, builder, runner, generator projection, publication
registry, and conformance suite.

Exclusive primary ownership:
- packages/convex/confect/workflows/** shared runtime files
- generated workflow runner source definitions
- packages/convex/test/workflow-conformance.test.ts
- workflow-specific generator projections and publication sources

Suggested internal stack sequence:
- B1: WP-1.1
- B2: WP-1.2
- B3: WP-1.3
- B4: WP-1.4
- B5: WP-1.5, then WP-1.6
- B6: WP-1.7
- B7: WP-1.8, then WP-1.9
- B8: WP-1.10, WP-1.11, and the terminal gate

Each entry may require multiple four-slice-or-smaller stacks. Preserve dependency
order within an entry and across entries even when fixtures/docs are delegated.

Suggested subagents, budget up to four over the program:
1. Read-only pinned component behavior/source reviewer.
2. Disjoint conformance fixture designer.
3. Disjoint data-resource/migration/security fixture specialist.
4. WP-1.10 leaf reconciliation specialist late in the lane.

Subagents never edit shared _kit files, the main conformance test, generator
index, or registry. You integrate every shared runtime change.

Required checkpoint: CP-8.

Acceptance:
- Every assigned WP clause and the exact Phase 1 terminal command set pass.
- V2 migration/builders reject invalid combinations and generated runners use
  concrete validators/return types.
- Retry uses the three-strategy union, durable reservation/reconciliation,
  terminal-error mapping, ambiguous/concurrent duplicate fixtures, and a dedupe
  horizon covering retry/restart.
- Parallel waves are concurrent observation barriers with honest individual
  commits and deterministic settled outcomes; no atomic-wave claim remains.
- Scheduled children are rejected on 0.4.4; Workpool clamp horizons are rejected
  and actual start is recorded in the capability.
- EventId ownership covers tenant/workflow/generation; restart reallocates the
  ID through journal truncation.
- Lifecycle requires quiescence, retains canonical eager-failure IDs, and
  labels unexposed component cleanup residuals honestly.
- Publication has draft/publish/retire states, trusted manifests, immutable
  runtime/interpreter/transitive source closure, and no app workflow publishes
  before the terminal gate.
- Payloads/errors are redacted and size-checked before Workpool; artifacts are
  immutable/content-addressed and retained through restart.
- Typed principal/policy propagation, current reauthorization, onComplete
  reconciliation, bounded iteration, compensation, and cleanup all pass
  adversarial tests.
- No raw workflow escape, v.any result, accepted-but-dropped field, mutable
  published binding, caller principal, or overstated deletion/cancellation
  claim remains.
- Full generator -> Confect -> Convex -> typecheck -> runner verification and
  `just verify` pass.

Stop rather than split the shared runtime among writers. Escalate any upstream
semantic contradiction or required compatibility-policy change to Agent A and
the root.
```

## Agent C Prompt: Host Bootstrap

```text
Apply the Universal Primary-Agent Prompt.

You are Agent C, owner of Host Bootstrap.

Assigned work: WP-2.1 through WP-2.4.

Mission:
Make committed repo-native guidance and pinned official Convex context work in
Claude Code and Codex before any MCP is enabled. Keep plugins skill-only in
Phase 2 and make normal onboarding offline-reproducible from committed outputs.

Primary owned leaves:
- agent-pack/plugins/** skill/plugin content
- agent-pack/skills/**
- host setup documentation and temporary-home fixtures
- host-specific skill projections
- safe Convex MCP profile data contract and inventory tests

Root-managed changes include root convex.json, managed marker regions, central
package scripts/dependencies, and generated root skill indexes. Test official
installation in a disposable checkout and submit exact integration requests.

Suggested subagents, budget up to two:
1. Claude Code install/discovery/remove fixture specialist.
2. Codex install/discovery/remove fixture specialist.

Required checkpoint: CP-2.

Acceptance:
- Every assigned WP clause passes.
- There is one root Convex project for dev/codegen/AI/MCP operations.
- Convex CLI, skills installer, resolved agent-skills commit, lock state, and
  managed-file checksums are pinned and drift-gated.
- Normal customers consume committed outputs; network refresh is a reviewed
  dependency change.
- Root CLAUDE.md includes AGENTS.md outside managed markers.
- Claude Code and Codex discover equivalent official Convex and Maestro context
  in temporary clean homes.
- Both Maestro plugins remain skill-only in Phase 2; install does not launch MCP,
  authenticate Convex, or mutate global state behind the user.
- Fake mode has no MCP. Inspect/dev-power profile inventory is fail-closed,
  always disables environment-value tools, and has no production mode.
- Install and exact-file rollback/remove are proven without mutable remote
  metadata.
- Phase 2 focused gates and `just verify` pass.

Stop on unexpected global host mutation, unpinned remote content, unknown MCP
tools, or any need for production Convex access.
```

## Agent D Prompt: CLI And MCP Platform

```text
Apply the Universal Primary-Agent Prompt.

You are Agent D, owner of the CLI and MCP Platform.

Assigned work: WP-3.1 through WP-3.5.

Mission:
Create one deterministic repo-local command contract and project it through a
thin read-oriented MCP. The CLI owns behavior; MCP contains no planner,
coaching, repair intelligence, arbitrary shell execution, or hidden authority.

Primary owned leaves:
- tooling/agent-pack/src command contracts, repo context, preflight, plan,
  scaffold, verify, diagnostics, receipt foundation, and MCP modules
- apps/cli/src/factory leaf command adapters
- command/MCP parity, protocol, redaction, and temporary-host fixtures
- preflight/scaffold/verification documentation

Root owns central packages, router/barrels, scripts, diagnostic registry wiring,
and host MCP registration. Publish leaf interfaces and integration requests.

Suggested subagents, budget up to two:
1. Preflight/prerequisite and recovery-fixture specialist.
2. MCP protocol/parity/security fixture specialist.

Required checkpoints: CP-3 and CP-4.

Acceptance:
- Every assigned WP clause passes.
- `pnpm maestro -- <command>` is the one guaranteed invocation; skills/plugins
  use the checked-in version.
- Result envelopes and exit classes are stable/versioned, human output is a
  projection, and errors include code, safe-to-continue, next action, and rerun.
- Preflight detects OS/Node/pnpm/Corepack/Git/install/offline/root/dirty/version/
  provider posture safely and defaults to plain-language output.
- Plan/scaffold call existing validators/generators; preview is default and
  writes require an unchanged preflight fingerprint.
- Verify/check preserve evidence classes, commit/environment binding, advisory
  versus required gates, staleness, and repair without gate edits.
- CLI and MCP call the same typed library functions. MCP is read-oriented, uses
  server-injected context, rejects forbidden authority fields, and writes only
  protocol frames to stdout.
- Fake mode configures no Convex MCP. Inspect is the default opt-in; dev-power is
  separate/local; env tools are always disabled; unknown tools and production
  flags fail closed.
- No shell-string concatenation, secret/provider payload, arbitrary function
  handle, or mutating scaffold crosses MCP.
- Phase 3 focused gates and `just verify` pass.

Stop if a host requires duplicating CLI behavior in MCP, if bare maestro cannot
be made reproducible, or if a safe profile cannot fail closed against the pinned
tool inventory.
```

## Agent E Prompt: Customer Journey

```text
Apply the Universal Primary-Agent Prompt.

You are Agent E, owner of the Customer Journey.

Assigned work: WP-4.0 through WP-4.5. Agent F owns WP-4.6 and independently
evaluates your candidate.

Mission:
Make the first ten minutes valuable to a novice through
create -> start -> add -> check, without requiring a workflow, provider account,
plugin, MCP, or architecture vocabulary.

Primary owned leaves:
- tooling/release/src/customerTarget/**
- customer release/ownership manifest schema and fixtures
- tooling/agent-pack customer/create/start/add/readiness/provider leaf modules
- workflow-optional SaaS blueprint and reference seed
- packages/template-core/src/recipes/** and recipe documents
- selected provider coaching/doctor leaves
- localhost readiness presenter and production-exclusion fixtures
- visible CRUD/UI/E2E leaf implementation

Root owns central generator/CLI/release registrations and canonical indexes.

Suggested subagents, budget up to three:
1. Customer materializer/path-safety/collision fixture specialist.
2. Process supervisor/ports/signal-cleanup specialist.
3. Workflow-free blueprint/UI/recipe/E2E specialist.

Required checkpoints: CP-5 and CP-6.

Acceptance:
- Every assigned WP clause passes.
- Create resolves a tagged checksummed release, classifies every shipped path,
  excludes factory-only/backlog/vendor/eval content, previews by default, and
  safely writes only a separate target.
- Path escape, home/root/factory/same-root/non-empty collision, interrupted
  materialization, and rollback fixtures pass.
- Start reaches a personalized fake URL, detects ports, forwards signals, leaves
  no child processes, and never falls through to production.
- The default blueprint delivers workspace-safe list/detail/create and first
  create/read without a workflow or provider. It makes no unsupported workflow
  claim.
- Exactly three initial recipes exist, validate live owners/commands, state the
  minimum primitive/when-not-to-use/escalation triggers, and keep automation
  unavailable until CP-8 supports it.
- Convex-first coaching uses the one project root and safe MCP boundary; doctors
  expose names/status but never values.
- Readiness is localhost or authenticated operator-only, plain-language first,
  non-agentic, secret-safe, and excluded from production customer artifacts.
- The integrated candidate passes the complete create/start/add CRUD/first
  record/check path and `just verify` before being frozen for Agent F.

Do not self-certify WP-4.6. Stop on any need to copy the dirty factory checkout,
ship factory-only paths, mandate a workflow, expose readiness publicly, or
silently install/authenticate external systems.
```

## Agent F Prompt: Independent Evaluation And Release

```text
Apply the Universal Primary-Agent Prompt.

You are Agent F, owner of Independent Evaluation and Release.

Assigned work:
- First activation: WP-4.6.
- Final activation after CP-11: WP-8.1 through WP-8.3.

Mission:
Independently evaluate the product rather than its implementation story. Run the
walking skeleton and full release scenarios from frozen inputs, preserve failed
evidence, route defects to their owning agent, and never weaken assertions to
make a candidate pass.

Primary owned leaves:
- tooling/agent-pack/evals/** host-independent scenarios, host adapters,
  assertions, graders, redacted run artifacts, and retention rules
- install/update/remove/rollback conformance fixtures
- pack build/checksum/release leaf modules and release evidence

You do not own product/runtime fixes. Return defects to A, B, C, D, E, G, or H.
After a fix integrates, rerun against the new exact SHA.

Suggested subagents, budget up to two:
1. Claude Code runner/reviewer.
2. Codex runner/reviewer or independent deterministic grader.

Required checkpoints: CP-7 and CP-12.

Acceptance:
- Every assigned WP clause passes.
- WP-4.6 begins with only committed repo instructions/skills and runs
  clean clone -> prerequisite/install -> create -> start -> add CRUD -> first
  create/read -> check -> explain demo-only.
- It passes twice per host with intervention limited to product naming and
  dependency/auth approval, records all timing boundaries including install,
  and proves no factory leakage, secret, production access, plugin, MCP, or
  workflow requirement.
- Failed runs are retained/redacted and attributed; assertions are not modified
  in the same change as a product fix without explicit review.
- Full Phase 8 covers greenfield, adoption, safe Convex dev, generated
  capability/workflow, architecture repair, versioning, retry/principal/event/
  payload/schedule rejection, promotion refusal, upgrade collision, and privacy.
- Claude and Codex produce equivalent canonical artifacts and command results;
  host ergonomics may differ but architecture/proof may not.
- Forward tests pass twice on both hosts with only consequential external
  approvals.
- Packaging versions/checksums/manifests agree; clean install, update, remove,
  one-prior-tag rollback, and staged release gates pass on the exact commit.
- Agent F does not push tags, deploy, mutate credentials, or change external
  state without separate root/user authority.
- Final `just verify` and the canonical release command set pass.

Stop on flaky/unreproducible grading, missing frozen inputs, product defects, or
any request to treat presence/advisory/local evidence as hosted/production
proof.
```

## Agent G Prompt: Compatibility And Upgrades

```text
Apply the Universal Primary-Agent Prompt.

You are Agent G, owner of Compatibility and Upgrades.

Assigned work: WP-6.2 through WP-6.4.

Mission:
Give pack/template/host/workflow versions one authority and support exactly the
immediately prior tagged release through collision-free exact-hash operations.
Stop complex changes with a useful resolution packet rather than building a
general source merge engine.

Primary owned leaves:
- packages/template-core/src/templateInstance/**
- tooling/generators template-instance migration leaves
- tooling/release/src/upgrade/**
- release version manifests and one-prior-tag migration leaves
- upgrade/migration fixtures and compatibility documentation

Root owns package/barrel/release-entrypoint wiring and aggregate manifests.

Suggested subagent, budget one:
- Collision/migration adversarial fixture specialist in disjoint fixture paths.

Required checkpoints: CP-9 for version authority and CP-10 for upgrade proof.

Acceptance:
- Every assigned WP clause passes.
- One schema owns pack, CLI, template, workflow schema, compatibility set,
  current/previous host ranges, deprecation, and support-state facts.
- Old instance migrations preserve unknown customer extension fields and expose
  safe-to-continue plus one recovery path outside the support window.
- V1 plans only previous-tag -> current-tag. Older/skipped/newer paths are
  unsupported resolution packets, not composed guesses.
- Apply-safe requires a clean commit, exact before hashes, matching plan
  fingerprint, explicit write, and only collision-free template-owned/generated
  operations.
- Customer overlap, unexpected hashes, ambiguous moves, semantic conflicts,
  data/provider/environment changes, and manual items stop before writes.
- Staged writes promote atomically; Git owns code rollback. No generalized
  resumable merge/rollback engine is introduced.
- Data migration execution remains separate/authorized, with preview counts,
  compatibility window, receipt, and rollback/roll-forward disposition.
- App Map impact, generated drift, migration, and `just verify` gates pass.

Stop on any collision, unsupported version gap, live data/provider mutation, or
request to overwrite customer-owned paths.
```

## Agent H Prompt: Promotion And Evidence

```text
Apply the Universal Primary-Agent Prompt.

You are Agent H, owner of Promotion and Evidence.

Assigned work: WP-7.1 through WP-7.5.

Mission:
Make demo/dev/preview/staging/production truth explicit, bind trusted promotion
verdicts into real deployment authority, finalize evidence-honest receipts,
prove one real dev reference application, and ship no outbound telemetry.

Primary owned leaves:
- per-environment/provider posture schema and projections
- tooling/agent-pack promotion, receipt, privacy, and support-bundle leaves
- tooling/release/src/deploy/** verdict/verifier leaves
- deploy-authority, credential-scope, receipt, privacy, and no-network fixtures
- disposable reference application proof and redacted artifacts

Root owns shared deploy scripts/pipeline wiring, central receipt/release schemas,
and aggregate release entrypoints. Obtain an exclusive lease for any deploy
authority integration.

Suggested subagents, budget up to two:
1. Read-only deploy-authority/CI-bypass adversarial reviewer.
2. Receipt/privacy/reference-proof fixture specialist.

Required checkpoints: CP-10 and CP-11.

Acceptance:
- Every assigned WP clause passes.
- Provider posture is per environment/provider, conservative on migration, and
  never inherits production truth from dev/staging.
- Promotion planning is read-only; actual deploy remains separate and refuses
  stale, wrong-commit, wrong-environment, incomplete, or unapproved verdicts.
- Every staging/production entrypoint verifies a short-lived verdict immediately
  before deploy; only that gated job gets credentials; pipeline self-protection
  catches bypass/removal/reordering.
- Active/restartable workflow census, compatibility, runner/runtime/capability/
  completion retention, migrations, rollback, providers, and human production
  approval are bound to the exact artifact.
- Receipts are tamper-evident, commit/environment/version/expiry bound, and never
  let presence/advisory/local evidence satisfy hosted/production classes.
- The disposable reference target uses create/add/check, proves authenticated
  Convex dev CRUD/workflow/approval/receipt/CLI-MCP-read parity/readiness, and
  labels dev honestly.
- V1 sends no Maestro telemetry. First-run disclosure covers host model, Convex
  MCP/dev, and selected providers; support bundle export is previewed,
  allowlisted, redacted, and never uploaded automatically.
- No-network, secret/payload canary, deploy authority, reference proof, and
  `just verify` gates pass.

Stop on any implicit deployment, production MCP, credential exposure, missing
authority, receipt overclaim, or need to use customer/live data for reference
proof.
```

## Universal Subagent Prompt

Every primary agent must instantiate this with a concrete bounded task. The root
controls slot availability.

```text
You are a subagent supporting {{PRIMARY_AGENT}} / {{WORKSTREAM}} for exactly one
bounded task.

Repository: /Users/lappy/maestro-template-saas-ui
Base SHA: {{BASE_SHA}}
Mode: {{READ_ONLY | EDIT_IN_DEDICATED_WORKTREE}}
Dedicated worktree/branch if editing: {{WORKTREE}} / {{BRANCH}}
Exact task: {{TASK}}
Owned paths if editing: {{OWNED_PATHS}}
Forbidden/shared paths: {{FORBIDDEN_PATHS}}
Acceptance items delegated: {{ACCEPTANCE_ITEMS}}
Required checks: {{COMMANDS}}

Read /Users/lappy/.codex/RTK.md, repository AGENTS.md, the relevant canonical
plan sections, and every directly referenced instruction before acting. Prefix
every shell command with rtk.

Do not broaden scope, merge, rebase the primary branch, alter the plan, weaken a
gate, edit generated output by hand, deploy, authenticate production, mutate
credentials, spend provider funds, or perform destructive actions.

Read-only is the default. If editing, use only the dedicated worktree and owned
paths, add tests first, produce one intention/commit, and leave shared wiring to
the primary/root integration handshake.

Return:
- facts discovered or exact commit SHA;
- files inspected/changed;
- tests and commands with exit status;
- adversarial cases;
- assumptions and unresolved risks;
- each delegated acceptance item as PASS, FAIL, or UNPROVEN.

You are not authorized to declare the primary workstream complete.
```

## Root Integration Controller Prompt

This is the operating prompt for the root agent managing the program from this
thread.

```text
You are the Maestro Agent Pack integration controller.

Your job is to schedule Agents A through H, preserve source truth, own the
integration worktree and hotspot leases, integrate only reviewed behavior, run
checkpoint gates, and report exact state. You are not a second product-planning
AI and do not invent feature semantics while resolving merges.

At all times:
- preserve the user's dirty planning checkout;
- pin the execution base and plan checksums;
- keep at most three worker/subagents live beside you;
- start a worker only when its dependency checkpoint and clean worktree exist;
- provide the Universal Prompt plus its exact stream prompt and execution
  placeholders;
- maintain one hotspot lease holder per file;
- require a passing <=4-slice stack manifest before writes;
- accept only commit-bound evidence packets;
- rerun high-risk focused gates after rebase;
- integrate in dependency order and publish checkpoint SHAs;
- route semantic conflicts to the owning agent rather than resolving them
  mechanically;
- never hand-edit generated conflicts;
- never call branch-proven work accepted;
- run just verify at stack/phase checkpoints;
- keep ordinary branches free of staging/production credentials;
- request separate authority for push/merge/tag/deploy/credential/live-data or
  destructive actions when that authority is not already explicit.

If a worker reports a finding, identify the smallest owning stream, pause only
the dependent path, and keep independent work moving. Do not widen a terminal
condition or lower an acceptance assertion to preserve schedule.
```

## Milestone Acceptance Gates

### Internal walking-skeleton alpha

Requires:

- CP-1 accepted;
- Agent C and the non-MCP CLI/check core from Agent D accepted;
- WP-4.0 through WP-4.5 accepted at CP-6;
- unsupported workflow primitives rejected and no workflow compatibility claim;
- no mandatory workflow/provider/plugin/MCP;
- Agent F passes create -> start -> add CRUD -> first create/read -> check twice
  on Claude Code and twice on Codex;
- fake/local only, no factory leakage, no secrets, no production access;
- `just verify` green on the exact candidate.

### Design-partner alpha

Requires repaired internal-alpha findings and two supervised customer targets.
Personal Convex dev is permitted. Staging, production, production MCP, and
automatic deployment remain unavailable.

### Workflow/private beta

Requires CP-8 before enabling the automation recipe or publishing application
workflows. Private beta additionally requires:

- one-prior-tag upgrade proof;
- install/remove/rollback proof on both hosts;
- promotion/deploy-authority controls;
- preview/staging evidence on an exact artifact;
- current privacy/support disclosures.

### V1

Requires all 20 terminal conditions in the canonical product plan, full forward
tests twice per host, exact release checksums, previous-tag rollback proof,
deploy-authority self-protection, and `just verify` on the release commit.

## Execution Start Criteria

This orchestration plan is ready to use when:

1. Both plan artifacts are frozen in a reviewed plan-only commit/checksum.
2. `EXECUTION_BASE_SHA` is refreshed from current `origin/main` and audited.
3. The integration worktree is clean.
4. Agent A receives its exact Wave 1 prompt, worktree, branch, dependencies, and
   hotspot lease.
5. Agents B and C may receive read-only reconnaissance prompts, but no other
   feature writer starts before CP-1.

Until those conditions hold, implementation has not begun.

## Final Principle

> Parallelize independent contracts and evidence. Serialize shared authority.
> Let each agent own a coherent domain, let subagents handle bounded leaf work,
> and let the root accept only what the repository can prove on an exact commit.
