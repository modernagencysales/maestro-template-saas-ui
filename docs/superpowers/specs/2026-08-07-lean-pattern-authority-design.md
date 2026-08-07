# Lean Pattern Authority Design

**Status:** Self-reviewed and approved for planning

## Purpose

Make Maestro easier for coding agents to understand and change by separating
useful reference patterns from active product authority. The factory may retain
examples, source references, and reusable implementation patterns, but a
generated customer application receives only the capabilities selected for that
product.

The change removes ceremony and duplicated enforcement that makes agents obey
the control plane instead of building the product. It does not weaken tenant
isolation, privacy, secret handling, path safety, collision detection, or
destructive-operation controls.

## Decision Rule

Every candidate file or subsystem is classified before it changes:

1. **Active authority** affects generation, mutation, admission, deployment, or
   runtime behavior. It must have one canonical owner and behavioral evidence.
2. **Selectable pattern** is useful implementation material. Keep one clear,
   discoverable canonical copy and project it only when the product selects it.
3. **Reference-only material** helps an agent reason but is not executable
   authority. Keep it outside generated runtime and gate inputs, clearly labeled
   as reference.
4. **Conflicting or misleading material** duplicates a canonical approach,
   appears active when it is not, or teaches an obsolete workflow. Remove it or
   consolidate its unique value into the canonical pattern.

Size alone is never a deletion reason. `repos/effect`, `repos/confect`, useful
historical plans, examples, and Cucumber patterns remain available to agents.

## Invariants

- The factory and generated customer application remain distinct products.
- Generated targets keep Cucumber and can test real customer journeys through
  their UI and CLI.
- `@required` selects blocking customer promises. `@wip` and untagged Features
  are drafts. Scenario steps express the surface being exercised; custom
  surface-tag metadata is not required.
- Cucumber parsing, dry-run, and execution are the acceptance authority. A
  second parser, journey manifest, receipt, frozen finding set, or evidence
  database is not introduced.
- Focused checks run while authoring. Woodpecker owns the sole blocking full
  verification on the current PR head.
- Woodpecker is the only blocking CI authority. Qlty and AI review remain
  advisory.
- Ordinary reversible generator writes use preview-by-default plus explicit
  `--write`. Path containment, protected roots, collisions, secret/privacy
  boundaries, and destructive-operation protections remain enforced.
- Deployment, migration, rollback, and other destructive actions retain their
  existing confirmation and trust boundaries in this effort.
- Package scripts are the executable command authority.
- Repository-pinned formatter, linter, typechecker, test runner, and scanners
  supply evidence; a host-global tool result is not accepted in their place.
- No standing integrator or deterministic agent manager is added. Each lane owns
  a coherent outcome; workers rebase their own branches when an earlier lane
  changes a shared API or projection seam.

## Existing Work Boundary

The unmerged `codex/template-enforced-engineering-rules` branch already contains
valuable work, including `docs/template/enforced-engineering-rules.md`, Qlty
projection, and narrower generated-customer admission. It is not merged
wholesale: parts of its generator and Cucumber guidance encode the fingerprint,
clean-tree, surface-tag, and broad pre-push rules this design removes.

Before implementing overlapping work, each lane compares its target files with
commits `326a2761a` through `76c24a137`. It reuses coherent tests and content,
updates them to this design, and leaves that branch and its current dirty change
untouched. No second engineering-rules document is invented.

## Lane 1: Lean Customer Projection

### Outcome

A neutral generated application contains the product chassis and selected
systems, not every factory workflow, deployment tool, or example.

### Design

The SaaS application blueprint defines a small mandatory chassis and explicit
selectable pattern groups using the existing composition inputs. This effort
does not add a generalized plugin or feature-selection framework. Factory source
remains available to generators, but files in a pattern group enter the target
only when the matching capability is selected. The generated contract and
handoff must agree with the filesystem.

The generic records implementation remains a canonical factory example and an
explicit `records-example` selectable pattern. Its complete backend/UI/CLI/test
vertical is absent from a neutral target and it is not the required acceptance
authority for every customer. The personalized first-outcome Feature remains
`@wip`; generated CI cannot pass by executing only the records demo while the
customer's promise is unfinished.

Deployment authority remains in the chassis in this effort. Making its trust
boundary optional would itself change deployment security and belongs to the
deferred security-equivalence design.

The neutral `add-agent` path emits the smallest useful agent declaration. UI
seat, thread lifecycle, workflow, MCP, and headless surfaces are added only by
their selected patterns.

### Evidence

- A neutral generated target omits unselected records and workflow product files
  while retaining deployment trust authority.
- Selecting a pattern projects its complete documented file set.
- Generated package scripts, workspace entries, lockfile, docs, and handoff
  describe only materialized systems.
- `contracts test --required` cannot succeed solely because the records example
  exists.
- Factory reference patterns remain discoverable and tested in their canonical
  location.

## Lane 2: Acceptance And Verification

### Outcome

Cucumber proves customer journeys once, while deterministic checks run once at
the narrowest useful level.

### Design

Delete the custom Gherkin lifecycle/surface compiler after replacing its only
useful behavior with native Cucumber commands:

- `acceptance:syntax` loads all sources through Cucumber and reports malformed
  Gherkin, including drafts;
- `acceptance:check` dry-runs only `@required` pickles and reports undefined or
  ambiguous blocking steps while allowing zero required drafts during authoring;
- `contracts test --required` selects `@required` Features with Cucumber's tag
  expression;
- drafts remain excluded without a second lifecycle state machine.

A thin selection guard uses Cucumber's own loaded pickle API to fail when
`--required` matches zero Scenarios. It does not parse Gherkin, prescribe
surface tags, or create another contract representation.

Remove nested calls where `acceptance:check`, firewall scripts, Lefthook, and
quality pins rerun the same acceptance command. Likewise, define `pnpm verify`
as a non-overlapping sequence: component suites execute through one owner, not
again through `test:tooling`, `test:workflow`, `test:pr-backlog`, and `evals`.

Generated-target integration tests reuse one installed immutable target fixture
within a suite. `maestro start` owns readiness and reports the exact failed
startup stage. One supervised product process serves a contract invocation;
Cucumber may reuse a browser where safe and always creates a fresh browser
context/page per Scenario.

Product Features stay focused on meaningful customer journeys. Parser, option,
filesystem, validation, and edge-case matrices remain focused Vitest or Node
tests rather than expanding Gherkin step libraries; no scenario-count gate is
added.

Quality checks keep real tools and behavior tests. File-content pins are kept
only when exact text is itself a compatibility contract. Runtime claims such as
idempotency and response validity are proved by invoking behavior, not by
matching prose or source fragments.

### Evidence

- Invalid Gherkin and undefined steps fail through Cucumber.
- A required end-to-end UI/CLI customer journey still gates a generated target.
- The records example remains runnable as an explicit example but is not an
  unrelated customer's required contract.
- Instrumented verification shows each owned suite runs once.
- One fixture owns installation/codegen and one process owns readiness.
- Readiness uses bounded observable polling and retains child output plus the
  last readiness response; fixed sleeps are not health checks.
- Factory generated-target integration still executes the tenant-isolation and
  missing-key denial journeys explicitly, without projecting them as an
  unrelated customer's required promise. Cross-workspace denial verifies both
  the typed error and absence of side effects through an authorized observer of
  the target workspace; all child output is redacted.

## Lane 3: Reversible Factory Commands

### Outcome

Agents can safely preview and perform ordinary local generation without copying
several fingerprints between commands.

### Design

For reversible filesystem generation, preview is the default and `--write` is
the sole mutation acknowledgement. The write recomputes and validates the plan
against the current filesystem immediately before mutation. It refuses paths
outside the target, protected-root writes, collisions, malformed input, and
secret-bearing payloads.

An unrelated dirty worktree does not block a reversible write. The command
checks the paths it owns and refuses an owned-path collision or changed
precondition instead of demanding repository-wide cleanliness.

Remove plan, preflight, and preview fingerprint ceremony from ordinary create,
add/recipe, scaffold, MCP configuration, support-bundle, and private-package
writes where the action is local and recoverable. Ordinary non-secret writes
need only `--write`. MCP configuration retains one explicit `--privacy-reviewed`
acknowledgement because it grants an agent host access to local tooling. A
command that becomes destructive or externally consequential stays outside this
rule.

Generator-core consolidation remains useful but is deferred until the
preview/write contracts settle; it is not bundled into this lane.

### Evidence

- Preview performs no writes and prints the exact proposed paths and privacy
  posture.
- Preflight failures occur before the first write; existing recipe writes retain
  journal rollback. Scaffold/private-package exclusive writers report any newly
  created paths if a mid-write filesystem failure requires cleanup and do not
  pretend to be journal-atomic.
- Path escape, protected-root, collision, malformed-input, and secret-canary
  tests remain red when their safeguards are intentionally removed.

## Lane 4: Active Authority Cleanup

### Outcome

Local and CI admission use a small set of real authorities instead of frozen AI
state, duplicated command registries, and obsolete branch orchestration.

### Design

Remove the already-nonblocking frozen AI review cycle because its repair-round
state machine adds no useful admission evidence. Independent agent review may
still run and report findings.

Shrink `tooling/quality/src/check-definitions.mts` to metadata that is consumed
for focused diagnostics. Delete pin-only requirements that merely repeat package
scripts, YAML, docs, or exact wording. Keep ESLint, TypeScript, Knip,
dependency-cruiser, Gitleaks, coverage, mutation, schema, tenant, and behavioral
checks.

Lefthook keeps fast staged format/lint checks. Broad typecheck, test,
generation, workflow, system, data, promotion, and acceptance admission moves to
Woodpecker.

Delete `tooling/stack` and its Graphite scripts. Plain GitHub branches and PRs
are the repository workflow. Replace `just` references with package scripts;
retain only a tiny compatibility Justfile if a verified external consumer still
requires recipe names.

### Evidence

- Woodpecker's required verification still executes every retained security,
  type, dependency, behavior, and product-contract authority.
- Local pre-commit/pre-push work completes without broad repository execution.
- No active command or documentation instructs agents to use Graphite.
- No task-level instruction requires repository-wide verification.
- Qlty findings remain visible and advisory.

## Lane 5: Bootstrap And Projection Hygiene

### Outcome

Factory and generated targets bootstrap once from compatible versions and expose
one canonical copy of agent guidance.

### Design

Align the preferred runtime on Node `22.23.2` because current dependencies
require at least the Node 22.13 line, while declaring tested compatible majors
as `^22.23.2 || ^24.0.0 || >=26.0.0`. CI uses the pinned Node 22 image, reuses a
compatible preinstalled Node, installs pnpm `10.12.1` only when absent or
mismatched, and uses the checksum-verified fnm fallback only for a genuinely
incompatible bare runner.

Keep one canonical source for each projected skill or agent instruction. Host
projections such as `.agents` and `.claude` are produced during bootstrap or
install only if a fresh generated target can make them available before its
first agent task. If that first-run proof fails, retain the committed projection
and record why rather than deleting useful guidance.

Promote the existing `docs/template/enforced-engineering-rules.md` into the
canonical agent-readable trigger index. Update it to match this lean design,
project it into generated customers, and keep exact Qlty thresholds, security
rules, denial-test expectations, dependency rules, focused-check triggers, and
Woodpecker/Qlty posture explicit. `docs/template/coding-standards.md` keeps its
useful rationale, examples, and domain exceptions, links to the trigger index,
and stops duplicating executable gate ownership.

The index distinguishes actual enforcement scope: ESLint deterministically
enforces changed-code complexity, nesting, and parameter limits; Qlty reports
all eight advisory thresholds while excluding `tooling/**` and retaining
monitor-scoped debt; type coverage `99.7%`, dependency, secret, architecture,
and Effect diagnostics remain deterministic authorities.

Verify `apps/voice-relay` and `tooling/pr-backlog` against imports, scripts,
documentation, and release contents. Delete a workspace only when it is empty,
unreferenced, and not intentionally retained as a labeled pattern. Replace the
single `concurrently` dependency only if pnpm's native parallel execution
preserves shutdown and exit semantics.

### Evidence

- A fresh checkout and fresh generated target install under the repository's
  declared Node compatibility and pnpm version.
- CI setup does not reinstall an already compatible Node runtime.
- Every worktree performs its own dependency hydration from the shared pnpm
  store; no worktree symlinks another checkout's `node_modules`.
- A first-run agent can find every required skill and instruction.
- Generated agents receive the enforced-engineering-rules trigger index and its
  exact Qlty thresholds without inheriting factory-only CI commands.
- Generated projections match their canonical source without checked-in drift.
- Empty-workspace and dependency removals are backed by reference scans and
  focused bootstrap tests.

## Delivery And Coordination

This effort is one delivery batch built from parallel lane branches. Workers
publish coherent commits directly and do not wait for full CI. A bounded
composition closure owns the shared blueprint/package/CI seams once; it starts
as lane commits publish, integrates them into one delivery branch, and runs the
single blocking Woodpecker gate. This is a temporary merge activity, not a
standing integrator or deterministic manager.

Every worktree names its explicit base ref, handles the repository trust prompt
as part of launch readiness, and hydrates dependencies locally from the shared
store. A committed reversible checkpoint may use remote testing; workers do not
hold coherent changes uncommitted while waiting for a local full-test slot.

Each lane runs focused affected tests while authoring. The composed batch
receives one independent whole-diff review. Merge authority is the green
`ci/woodpecker/pr/verify` result attached to the current PR head; no separate
SHA receipt or duplicate local full gate is created.

Shared-seam authority is explicit:

- Acceptance owns native Cucumber adapters, runtime/fixture security, CLI
  contract routing, and headless behavior evidence; it does not edit shared
  blueprint or global CI ownership files.
- Reversible Commands owns ordinary mutation implementations and focused tests;
  it does not edit shared blueprint compatibility files.
- Active Authority Cleanup owns root package-suite composition, hooks, firewall,
  Qlty advisory behavior, diagnostic argv semantics, Graphite, and Just.
- Bootstrap Hygiene owns source rules/docs, setup behavior, skill-copy cleanup,
  and classified empty-workspace deletion.
- Customer Projection/Composition owns all current blueprint projection hot
  files, generated package/lockfile metadata, and final compatibility smokes for
  the other four lanes.

Core lane work proceeds concurrently. The composition owner applies published
commits and adapts only the named shared seams, so no core worker repeatedly
rebases a large mixed diff and Woodpecker runs once on the combined result.

## Explicitly Deferred

Custom deployment authority, census, checkpoints, promotion, rollback, and old
release archive storage are not changed here. Replacing them with Woodpecker,
Cloudflare, Convex, or provider-native authority requires a separate security
equivalence design and explicit owner approval.

Fabro remains paused. This effort does not create a replacement factory control
plane, project ledger, deterministic agent scheduler, or SHA choreography.
