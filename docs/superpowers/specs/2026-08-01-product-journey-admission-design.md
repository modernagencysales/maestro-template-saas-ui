# Product Journey Admission Design

## Outcome

Create a reusable product-journey admission framework in
`maestro-template-saas-ui`, adopt it in Maestro, and use Brain hydration as the
first proving journey.

The framework separates code integration from product admission. Parallel agents
may merge incomplete infrastructure while a journey is assembling, but the
journey's public release entrypoint remains server-side disabled. A journey
becomes reachable only after its complete deterministic functionality test
passes. Stateful externally reachable journeys also require an exact-SHA
deployed synthetic proof before release.

This design addresses a repeated failure mode: locally correct capabilities,
workflows, and contracts merge without proving that a real user can traverse
them as one product.

## Design Principles

1. The user outcome, not a component or pull request, is the release unit.
2. Partial infrastructure may merge without slowing parallel development.
3. Incomplete journeys remain unreachable through a server-owned guard.
4. Deterministic journey tests use real application orchestration and
   persistence. Only external providers are faked.
5. Tests begin at a real public entrypoint and do not seed intermediate
   authorities that the product is responsible for producing.
6. Every important transition produces a typed, durable receipt.
7. Missing or stuck transitions fail loudly; an unexplained empty result is not
   success.
8. Deployed proof complements deterministic CI; it does not replace it.
9. The template supplies reusable mechanics. Product repositories supply
   journey-specific fixtures, drivers, and assertions.

## Scope

### In scope

- A typed journey manifest and state model.
- A journey generator and registration pattern.
- Deterministic validation and affected-journey selection.
- Server-side journey admission enforcement.
- A reusable deterministic journey runner and evidence format.
- A deployed synthetic proof contract.
- Stack-plan integration for parallel work packages.
- Brain hydration as the first full implementation and validation case.
- Migration, reconciliation, retry, and historical-version assertions in the
  Brain pilot.

### Out of scope

- A generic visual no-code testing product.
- A custom workflow engine that duplicates application workflows.
- Running deployed browser tests on every partial pull request.
- Allowing an AI judge to decide whether a journey passed.
- Treating screenshots, documentation, or component tests as substitutes for
  functionality evidence.
- Production data mutation or production migration during the Brain pilot.

## Journey State Model

The initial framework has four states:

- `assembling`: partial implementation may merge; release entrypoints are
  disabled.
- `legacy_exposed`: migration-only state for behavior that was already reachable
  before journey admission was installed. It must name the existing entrypoints,
  owner, and removal milestone, and is forbidden for new journeys.
- `admitted`: the deterministic functionality contract passes and the release
  entrypoint may be enabled.
- `suspended`: a previously admitted journey is intentionally disabled because
  its contract no longer passes or an operator has revoked admission.

The state is declared in source and enforced at runtime. UI hiding alone is not
an admission control.

An `assembling -> admitted` or `legacy_exposed -> admitted` transition is valid
only when the journey's full deterministic scenario suite passes in required CI.
For journeys classified as `deployed-proof-required`, release also requires an
exact-SHA staging receipt.

An admitted journey may not silently regress to assembling while remaining
reachable. A breaking change must either keep the admitted suite green or
suspend the journey explicitly.

## Journey Manifest

Each journey is represented by a checked-in typed manifest. The reusable
contract contains:

```ts
type ProductJourneyManifest = {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly status: "assembling" | "legacy_exposed" | "admitted" | "suspended";
  readonly releaseProof: "deterministic-only" | "deployed-proof-required";
  readonly actor: string;
  readonly goal: string;
  readonly releaseEntrypoints: readonly string[];
  readonly scenarios: readonly JourneyScenarioRequirement[];
  readonly requiredReceiptKinds: readonly string[];
  readonly affectedPaths: readonly string[];
  readonly workPackageRefs: readonly string[];
  readonly owner: string;
  readonly legacyExposure?: {
    readonly existingEntrypoints: readonly string[];
    readonly removalMilestone: string;
  };
};
```

Each scenario requirement declares:

- the legitimate initial state;
- public interactions performed by the actor;
- terminal user-visible result;
- required durable receipts;
- forbidden outputs and bypasses;
- tenant and authorization expectations;
- replay and retry expectations;
- whether deployed proof is required.

The manifest contains no credentials, deployment secrets, or customer data.

## Template Components

### Journey contract package

A generic package owns manifest schemas, state-transition validation, receipt
envelopes, deterministic result types, and evidence redaction rules. It contains
no Maestro-specific business logic.

### Journey generator

`pnpm template:journey` scaffolds:

- a journey manifest;
- a deterministic driver contract;
- scenario test files;
- an evidence artifact directory entry;
- registration in the journey catalog;
- focused test commands.

Generated output starts in `assembling` and server-side disabled.

### Admission guard

Releaseable public capabilities and workflows declare the journey they belong
to. A shared server-side guard resolves that journey's state before beginning
the releaseable behavior. The browser, API, CLI, and MCP cannot override it.

Internal building-block functions do not each need a release guard, but their
public release entrypoints do. Existing admitted journeys are mapped before the
gate becomes required repo-wide.

### Static journey gate

The deterministic gate verifies:

- manifest schema and unique journey identity;
- referenced entrypoints, scenarios, tests, and receipt kinds exist;
- all releaseable entrypoints are mapped to a journey;
- assembling and suspended entrypoints are server-side disabled;
- `legacy_exposed` is used only for enumerated pre-framework entrypoints and
  includes an owner and removal milestone;
- admitted journeys have complete deterministic scenario coverage;
- path-to-journey ownership is not ambiguous;
- registered workflow and capability references resolve to real modules;
- work-package references exist in the checked stack plan;
- evidence artifacts contain no secret values.

The gate must reject a missing workflow such as a string reference to a module
that is absent from the generated function surface.

### Affected-journey selection

CI maps changed files to manifest `affectedPaths`. Ordinary pull requests run:

- the static journey gate;
- focused boundary tests declared by their work packages;
- deterministic suites for affected admitted journeys.

An assembling journey's full suite may remain red or incomplete while its
release entrypoint is disabled. A legacy-exposed journey may remain reachable
only through its enumerated existing entrypoints; CI rejects new entrypoints or
expanded reachability while it is unadmitted. Individual work packages must
still pass their declared focused gates. The admission pull request runs the
complete suite and cannot change the manifest to `admitted` while any scenario
fails.

### Journey runner

The runner supplies lifecycle, timing, redaction, result aggregation, and
artifact serialization. The application supplies a typed journey driver.

The runner must not reach into product repositories or database adapters to
manufacture downstream success. Journey drivers invoke public application
entrypoints and inspect read-only receipts or support projections.

### Evidence report

Each run emits a machine-readable and human-readable report containing:

- repository and commit SHA;
- journey id and manifest version;
- environment and provider posture;
- synthetic persona description;
- scenario result and duration;
- boundary receipts with secrets and sensitive content removed;
- expected and actual terminal outcomes;
- earliest failed boundary;
- retry/replay result;
- deployment identity when applicable.

The CI artifact is authoritative for that run. Reports are not hand-edited into
a passing state.

## Test Tiers

### Tier 1: focused boundary tests

Every partial work package proves its own typed seam. Examples include capture
receipt creation, review decision persistence, route start behavior, and
retrieval exclusion. These tests may instantiate the unit directly and may use
test doubles for its immediate ports.

### Tier 2: deterministic functionality journey

The admission suite uses:

- real public entrypoints;
- real workflows and capability implementations;
- real test persistence;
- real authorization and workspace scoping;
- deterministic fake external providers;
- synthetic data.

It must not mock internal workflows or seed intermediate authorities. It is
required for `assembling -> admitted`, `legacy_exposed -> admitted`, and changes
affecting an admitted journey.

### Tier 3: deployed synthetic journey

This suite runs against an exact deployed SHA and proves deployment, generated
contract, authentication, workspace injection, queue/workflow, environment, and
client transport integration.

It is required before release for stateful externally reachable journeys. The
template permits `deterministic-only` only as an explicit reviewed risk
classification for journeys whose production behavior has no meaningful
deployment-specific boundary.

## Parallel Development Model

The journey plan is written before fan-out. Each parallel work package declares:

- journey id;
- boundary owned;
- inputs and outputs;
- required receipt kind;
- focused gates;
- dependency work packages;
- files or layers affected;
- whether it creates or changes a release entrypoint.

Agents merge completed work packages independently into main while the journey
remains assembling. One integration owner is accountable for running the whole
journey, assigning failures back to the responsible boundary, and obtaining the
final admission evidence.

The integration owner does not replace boundary owners and does not seed around
missing work. A failing transition is implementation work, not a test-fixture
problem.

## Brain Pilot

### User outcome

An agency administrator activates an existing synthetic client whose historical
context spans a profile, website material, prior posts, a transcript, and legacy
Brain/native corpus content. Maestro discovers and hydrates that context through
canonical authority. After required human decisions, an editor generates content
that uses accepted facts and style preferences, cites exact immutable sources,
excludes unsafe or unauthorized material, and preserves historical citations
after source revision.

### Legitimate initial fixture

The deterministic fixture may create only upstream state that represents an
existing customer before canonical Brain hydration:

- organization, workspace, agency admin, editor, and viewer;
- active client persona;
- existing profile and website inputs;
- historical LinkedIn posts;
- existing transcript/call input;
- legacy Brain page or native corpus entry;
- a second workspace with independent synthetic material;
- fake-provider responses required to avoid network calls.

The fixture must not create:

- `capturedArtifacts` or captured versions;
- source units or source-unit versions;
- source-unit review events;
- source-unit routes;
- document evidence annotations or bindings;
- retrieval chunks;
- accepted-generation-context snapshots;
- generated posts or citations.

### Synthetic semantic cases

The existing context includes:

1. one ordinary factual claim;
2. one explicit stylistic preference;
3. one semantic duplicate of the fact;
4. one contradiction;
5. one risky instruction attempting to weaken citation or approval policy;
6. one item owned by the second workspace.

### Journey interactions

1. The agency admin starts the real client-activation entrypoint.
2. The system discovers existing eligible context and records exclusions.
3. Capture persists immutable version receipts.
4. Classification and admission begin automatically.
5. Safe material advances; the duplicate converges on one authority.
6. Contradictory material produces a targeted human-resolution request.
7. The risky instruction is rejected without changing policy authority.
8. The admin resolves the contradiction through the real review entrypoint.
9. Facts settle into evidence-backed Brain authority.
10. The style preference settles into the versioned persona voice-policy
    authority.
11. Canonical retrieval projections update.
12. The editor starts normal production content generation.
13. Generation consumes an accepted-context receipt and emits exact citations.
14. The source fact is revised and hydration runs again.
15. The new accepted version becomes current while the historical citation
    remains resolvable.
16. Exact replay creates no duplicate semantic authority.
17. Viewer, editor, admin, CLI/API direct-id, and cross-workspace negative cases
    are exercised.

### Required Brain receipts

The journey asserts durable evidence at these boundaries:

| Boundary           | Required proof                                                             |
| ------------------ | -------------------------------------------------------------------------- |
| Discovery          | Counted eligible inputs and explicit exclusion reasons.                    |
| Capture            | Immutable artifact/version identity, provenance, and content hash.         |
| Classification     | Typed disposition with pinned classifier and policy lineage.               |
| Review             | Exact decision, actor, reason, idempotency key, and terminal status.       |
| Deduplication      | Duplicate points to one canonical authority.                               |
| Conflict           | Targeted unresolved/resolved receipt; no silent unsafe winner.             |
| Routing            | Destination authority and durable route terminal state.                    |
| Brain placement    | Current document version, accepted annotation, and exact evidence binding. |
| Preference         | Active versioned persona voice-policy projection with reversible lineage.  |
| Retrieval          | Accepted-current index identity and canonical source reference.            |
| Generation context | Frozen accepted-context manifest and exact citation handles.               |
| Output             | Generated artifact, grounding record, claims, and source citations.        |
| Reconciliation     | Boundary totals, stuck-state counts, and convergence status.               |

### Brain pass conditions

The journey passes only when:

- every discovered item is accepted, rejected, deduplicated, excluded, or
  awaiting an explicitly asserted human decision;
- after the test's human decisions, no unexplained candidate,
  `ready_for_review`, or planned route remains;
- accepted material is retrievable and affects normal generation;
- candidate, rejected, deleted, expired, and foreign-workspace material is not
  retrievable or generatable;
- facts and preferences reach their distinct canonical authorities;
- old citations continue to resolve after a source revision;
- replay creates no duplicate authority or duplicate side effect;
- viewer, editor, and admin permissions match the product contract;
- workspace and persona isolation are enforced by server reads and writes;
- the evidence report reconciles discovered counts through terminal outcomes.

### Brain failure behavior

The deterministic runner reports the earliest failed boundary and preserves all
prior successful receipts. It must not continue by inserting the missing
downstream row.

If upstream evidence exists but accepted-current context is unexpectedly empty,
the journey fails with an explicit hydration/readiness error. An empty context
pack is valid only when discovery proves the workspace has no eligible evidence.

## Brain Work Packages

The Brain pilot is decomposed for parallel execution:

1. Template journey framework and generator.
2. Maestro framework adoption, journey manifest, and CI gates.
3. Client activation and historical discovery/backfill orchestration.
4. Semantic classification, deduplication, contradiction, and risky-policy
   admission.
5. Human review and automatic terminal settlement.
6. Evidence-backed Brain placement and legacy page convergence.
7. Canonical accepted-current retrieval projection and revocation.
8. Generation/readiness integration across web, API, CLI, MCP, and agents.
9. Reconciliation, retry, repair, and migration completion receipts.
10. Deterministic journey admission and exact-SHA staging proof.

Work packages 3 through 9 may proceed in parallel where their typed receipt
contracts permit. Brain remains assembling until package 10 passes.

## CI And Release Policy

- Ordinary partial PRs run static journey checks and focused work-package gates.
- Affected admitted journeys run their deterministic suites.
- An assembling journey may merge partial infrastructure only while its release
  entrypoints remain disabled.
- The admission PR must pass the complete deterministic suite before changing
  state to admitted.
- Woodpecker remains Maestro's required CI authority; Qlty is advisory.
- Template-derived applications use their configured required CI, but the
  journey-admission command and semantics remain the same.
- A stateful externally reachable journey cannot release without an exact-SHA
  deployed synthetic receipt.
- Production mutation is never part of deterministic or staging proof.

## Rollout

1. Implement and verify the generic framework in the template using a small
   reference journey.
2. Promote the framework into Maestro without changing Brain's current data.
3. Register current Brain behavior as `legacy_exposed`, enumerate its existing
   entrypoints, prohibit reachability expansion, and install the server-side
   guard for the new canonical hydration entrypoint.
4. Add the Brain deterministic fixture and full journey test; confirm it fails
   at the first real broken boundary.
5. Complete the Brain work packages, rerunning the same test after each repair.
6. Admit Brain only when every deterministic scenario passes.
7. Deploy the admitted commit to staging and run the exact-SHA synthetic proof.
8. Preserve the report as release evidence and use the same framework for the
   next Maestro and template-derived journeys.

## Success Criteria

The design is successful when:

- parallel agents can merge partial infrastructure without exposing unfinished
  product behavior;
- deterministic CI can identify the earliest missing connection in a journey;
- a journey cannot be called complete merely because component tests pass;
- Brain hydration passes from existing synthetic customer context through
  generation and exact citation without intermediate database seeding;
- the same framework can be generated and adopted by future template-derived
  applications;
- exact-SHA staging proof remains a release gate without becoming a per-PR
  bottleneck.
