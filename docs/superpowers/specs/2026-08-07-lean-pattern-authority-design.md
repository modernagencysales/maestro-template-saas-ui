# Lean Pattern Authority Design

**Status:** Approved for planning

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
- Focused checks run for task commits. Full verification and Woodpecker run once
  on each immutable delivery-batch head.
- Woodpecker is the only blocking CI authority. Qlty and AI review remain
  advisory.
- Ordinary reversible generator writes use preview-by-default plus explicit
  `--write`. Path containment, protected roots, collisions, secret/privacy
  boundaries, and destructive-operation protections remain enforced.
- Deployment, migration, rollback, and other destructive actions retain their
  existing confirmation and trust boundaries in this effort.
- Package scripts are the executable command authority.
- No standing integrator or deterministic agent manager is added. Each lane is
  an independently mergeable PR based on current `origin/main`.

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

The generic records implementation remains a reference/example and a useful
smoke target. It is not the required acceptance authority for every customer.
The personalized first-outcome Feature remains `@wip`; generated CI cannot pass
by executing only the records demo while the customer's promise is unfinished.

The neutral `add-agent` path emits the smallest useful agent declaration. UI
seat, thread lifecycle, workflow, MCP, and headless surfaces are added only by
their selected patterns.

### Evidence

- A neutral generated target omits unselected workflow and deployment files.
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

- `acceptance:check` performs Cucumber dry-run and reports invalid or undefined
  Gherkin;
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
within a suite. `maestro start` owns readiness. Cucumber shares the supervised
process and browser per Feature, with a fresh browser context/page per Scenario.

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
- Factory generated-target integration still executes the tenant-isolation and
  missing-key denial journeys explicitly, without projecting them as an
  unrelated customer's required promise.

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

Remove plan, preflight, and preview fingerprint ceremony from ordinary create,
add/recipe, scaffold, MCP configuration, support-bundle, and private-package
writes where the action is local and recoverable. Ordinary non-secret writes
need only `--write`. MCP configuration, private-package import, or another
preview that identifies a real privacy/permission boundary may retain one
explicit `--privacy-reviewed` acknowledgement. A command that becomes
destructive or externally consequential stays outside this rule.

Consolidate `tooling/generators/src/index.ts` and `customer-runtime.ts` behind
one canonical generator implementation. Factory and generated CLI adapters may
format results differently, but they do not own duplicate generation logic.

### Evidence

- Preview performs no writes and prints the exact proposed paths and privacy
  posture.
- `--write` applies that plan or fails before partial mutation.
- Path escape, protected-root, collision, malformed-input, and secret-canary
  tests remain red when their safeguards are intentionally removed.
- Factory and customer-runtime entry points pass the same generator contract
  suite.

## Lane 4: Active Authority Cleanup

### Outcome

Local and CI admission use a small set of real authorities instead of frozen AI
state, duplicated command registries, and obsolete branch orchestration.

### Design

Remove the frozen AI review cycle from the blocking firewall. Independent agent
review may still run and report findings, but it does not persist a repair-round
state machine or block deterministic admission.

Shrink `tooling/quality/src/check-definitions.mts` to metadata that is consumed
for focused diagnostics. Delete pin-only requirements that merely repeat package
scripts, YAML, docs, or exact wording. Keep ESLint, TypeScript, Knip,
dependency-cruiser, Gitleaks, coverage, mutation, schema, tenant, and behavioral
checks.

Lefthook keeps fast staged format/lint checks. Broad typecheck, test,
generation, workflow, system, data, promotion, and acceptance admission moves to
the frozen Woodpecker head.

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

Align `.nvmrc`, CI images, and package-manager metadata to a Node 22 patch that
satisfies pnpm 10.12.1. CI running in a compatible Node image installs only
missing pnpm; it does not reinstall Node with fnm.

Keep one canonical source for each projected skill or agent instruction. Host
projections such as `.agents` and `.claude` are produced during bootstrap or
install only if a fresh generated target can make them available before its
first agent task. If that first-run proof fails, retain the committed projection
and record why rather than deleting useful guidance.

Verify `apps/voice-relay` and `tooling/pr-backlog` against imports, scripts,
documentation, and release contents. Delete a workspace only when it is empty,
unreferenced, and not intentionally retained as a labeled pattern. Replace the
single `concurrently` dependency only if pnpm's native parallel execution
preserves shutdown and exit semantics.

### Evidence

- A fresh checkout and fresh generated target install under the declared Node
  and pnpm versions.
- CI setup does not reinstall an already compatible Node runtime.
- A first-run agent can find every required skill and instruction.
- Generated projections match their canonical source without checked-in drift.
- Empty-workspace and dependency removals are backed by reference scans and
  focused bootstrap tests.

## Delivery And Coordination

Each lane starts from the then-current `origin/main`, owns its affected files,
and opens one independently useful PR. Workers publish their branches directly.
No lane waits for a standing integrator; where two lanes touch a shared
manifest, the later PR rebases once on the merged authority and resolves the
small mechanical overlap.

Each task commit runs focused affected tests. Each lane receives one independent
whole-diff review and one full Woodpecker run on its immutable head. A changed
head invalidates that lane's review and CI evidence.

The preferred merge order is:

1. Lean customer projection.
2. Acceptance and verification.
3. Reversible factory commands.
4. Active authority cleanup.
5. Bootstrap and projection hygiene.

The order reduces conflicts but does not serialize implementation. All five
lanes may be developed concurrently from `origin/main`; only final rebases and
merges are ordered when shared manifests overlap.

## Explicitly Deferred

Custom deployment authority, census, checkpoints, promotion, rollback, and old
release archive storage are not changed here. Replacing them with Woodpecker,
Cloudflare, Convex, or provider-native authority requires a separate security
equivalence design and explicit owner approval.

Fabro remains paused. This effort does not create a replacement factory control
plane, project ledger, deterministic agent scheduler, or SHA choreography.
