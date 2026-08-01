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
10. Admission is continuously revalidated, not awarded permanently.
11. Test and manifest weakening is itself a governed contract change.

## What This Can And Cannot Guarantee

No test framework can guarantee that a product remains correct forever. This
framework is intended to make the recurring failure expensive to hide and cheap
to discover by enforcing four properties:

1. **No false completion:** component completion cannot admit a journey.
2. **No dark seam:** every required producer-to-consumer boundary has a typed
   receipt contract and executable consumer assertion.
3. **No permanent green badge:** admission becomes stale when relevant code,
   contracts, configuration, or deployment identity changes.
4. **No silent test weakening:** changes to journey contracts, scenarios, gates,
   fixtures, or expected evidence receive independent contract review.

The remaining unavoidable risks are incomplete product requirements, provider
behavior that synthetic tests do not represent, and real-world data shapes that
the declared scenarios omit. Production telemetry, support findings, and new
incidents must therefore be able to add regression scenarios to the same journey
contract.

The framework cannot validate its own product oracle. Before first admission,
the journey contract therefore requires named product-owner acceptance of the
actor, goal, terminal outcome, forbidden outcomes, and coverage profile. That
acceptance is version-bound: a material contract reduction invalidates it and
requires renewed product approval in addition to contract review.

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
  readonly coverageProfile: "read-only" | "stateful" | "high-risk";
  readonly releaseEntrypoints: readonly string[];
  readonly scenarios: readonly JourneyScenarioRequirement[];
  readonly requiredReceiptKinds: readonly string[];
  readonly dependsOnJourneys: readonly JourneyDependency[];
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

Every manifest also declares a versioned journey graph. Graph nodes are user
interactions or product-owned boundaries; graph edges name the typed receipt
that transfers authority between them. A work package may implement a node or
edge, but it may not invent an incompatible private handoff.

The manifest records a `journeyProtocolVersion`. Template upgrades provide
deterministic compatibility checks and migrations for supported protocol
versions. A fork cannot silently consume a newer manifest or evidence format.

`dependsOnJourneys` names the minimum admitted contract version and required
terminal receipt of another journey. Dependency cycles are rejected. Admission,
affected-change selection, lease staleness, suspension, and deployed proof
propagate transitively, so a healthy downstream journey cannot conceal a stale
shared prerequisite.

The manifest contains no credentials, deployment secrets, or customer data.

Coverage profiles impose minimum scenario classes so a manifest cannot declare
one happy path and call itself complete:

- all journeys: success, empty/not-applicable, authorization denial, and
  user-visible failure;
- stateful journeys: mutation failure, retry, exact replay, partial progress,
  and recovery;
- high-risk journeys: tenant isolation, unsafe-input refusal, revocation or
  deletion, historical-version behavior, migration/backfill, and deployed proof.

Applications may add scenario classes but may not remove profile requirements
without changing the shared protocol through contract review.

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
- `legacy_exposed` reachability and data-writing authority never increase, its
  removal milestone has not expired, and its inventory monotonically shrinks;
- admitted journeys have complete deterministic scenario coverage;
- path-to-journey ownership is not ambiguous;
- manifest affected paths agree with generated capability, workflow, route,
  schema, and caller/callee inventories;
- registered workflow and capability references resolve to real modules;
- every journey-graph edge has exactly one producer contract and at least one
  consumer assertion;
- every inter-journey dependency resolves to an admitted compatible contract and
  terminal receipt;
- work-package references exist in the checked stack plan;
- evidence artifacts contain no secret values.

The gate must reject a missing workflow such as a string reference to a module
that is absent from the generated function surface.

Hand-maintained `affectedPaths` are a readable declaration, not the sole source
of truth. CI expands them through generated dependency and surface inventories.
If the generator cannot classify a changed releaseable surface, the change is
treated as affecting all admitted journeys until ownership is declared.

### Affected-journey selection

CI maps changed files to manifest `affectedPaths`. Ordinary pull requests run:

- the static journey gate;
- focused boundary tests declared by their work packages;
- deterministic suites for affected admitted journeys.

An assembling journey does not check in ignored or permanently red required
tests. Its deterministic skeleton passes by proving the declared frontier and
the typed not-yet-implemented boundary while its release entrypoint is disabled.
A legacy-exposed journey may remain reachable only through its enumerated
existing entrypoints; CI rejects new entrypoints or expanded reachability while
it is unadmitted. Individual work packages must still pass their declared
focused gates. The admission pull request runs the complete suite and cannot
change the manifest to `admitted` while any scenario fails.

### Assembling frontier

An assembling journey has an explicit tested frontier: the last graph boundary
that the deterministic skeleton can reach from the real public start without
seeding downstream state. The frontier may initially be the admission guard.
Each work package that claims to connect another boundary must advance or
preserve it.

CI records the reached node, expected next node, and typed reason for stopping.
The frontier may not move backward. This provides integration feedback during
parallel development instead of deferring all wiring discovery to the final
admission pull request. An unimplemented boundary is explicit evidence, not a
passing journey.

Scenario requirements beyond the frontier remain structurally declared in the
manifest and are reported as `not_reached`, not represented by skipped test
files. The admission transition changes the expected frontier to the terminal
node, making every required scenario executable and passing.

### Journey runner

The runner supplies lifecycle, timing, redaction, result aggregation, and
artifact serialization. The application supplies a typed journey driver.

The runner must not reach into product repositories or database adapters to
manufacture downstream success. Journey drivers invoke public application
entrypoints and inspect read-only receipts or support projections.

The primary deterministic journey runs at the fastest public service boundary,
normally authenticated capability or API entrypoints. Thin transport-parity
tests prove that browser, CLI, and MCP invoke those same entrypoints and expose
the same terminal receipt. The framework does not duplicate the complete state
machine in every transport or force the core journey into a large browser test.

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

### Gate integrity

An agent could otherwise make a red journey green by weakening its scenario,
fixture, manifest, assertion, or gate. The framework therefore treats changes
under journey contracts, runner code, evidence validators, and required scenario
fixtures as contract-risk changes.

Those changes require:

- an explicit rationale describing whether behavior or only the test changed;
- adversarial gate tests that demonstrate the previous and proposed verdicts;
- independent contract-review approval rather than approval solely from the
  implementation agent;
- a prohibition on deleting a required receipt or negative scenario without a
  versioned journey-contract change;
- CI comparison against the merge base to report reduced scenario, receipt,
  role, transport, or isolation coverage.

The required CI workflow, branch protection, contract-owner rules, and runtime
admission verifier are part of the protected admission control plane. The same
pull request may change implementation and propose a contract change, but it
cannot self-approve a coverage reduction or mint its own admission evidence.

### Admission attestation and trust chain

Checked-in `status: admitted` expresses intent; it does not by itself enable a
release entrypoint. Required CI issues a machine-verifiable admission
attestation only after the protected gate passes. The attestation binds:

- repository and commit SHA;
- journey id, manifest version, protocol version, and full contract hash;
- scenario, fixture, runner, and evidence-validator hashes;
- generated capability/workflow/schema identity;
- dependency-journey attestation identities;
- required-CI workflow identity and result;
- deployment identity and deployed-proof receipt when required;
- issuance and expiry times.

The runtime guard accepts only an attestation issued by the configured trusted
CI identity and matching the running artifact. A repository file, test fixture,
environment flag, browser client, or implementation agent cannot manufacture
admission. Local development may use an explicit local-only issuer that is
cryptographically and configurationally invalid outside local environments.

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

### Tier 4: continuous admitted canary

Admission is a renewable lease over a particular journey-contract hash,
application commit, generated-contract identity, and deployment identity. It is
not a timeless label.

For deployed-proof-required journeys, a scheduled synthetic canary runs in a
dedicated non-production or isolated synthetic tenant and rechecks the critical
terminal outcome without using customer data. Runtime telemetry also records
journey boundary transitions and stuck-state age without logging source content.

Lease health is reported separately from the source state as `current`, `stale`,
or `failing`. The journey becomes `stale` operationally when its admitted
contract hash no longer matches the deployed artifact, an affected admitted test
is skipped, or the required canary exceeds its freshness window. Repeated canary
failure pages the journey owner and triggers the configured suspension or
fail-closed policy; it does not silently preserve a green launch label.

Runtime reachability uses the effective admission state: checked-in source state
plus lease health plus any audited operator suspension. An admitted source
manifest with a stale or failing required lease is not treated as fully admitted
by the release guard. Each journey declares whether that condition fails closed
or preserves a narrowly defined degraded read-only behavior.

A journey lease is also stale when any transitive dependency attestation is
stale, failing, suspended, or incompatible. Renewal reuses unchanged evidence
only when its hashes and dependency attestations still match; it never treats a
previous green run against different code or contracts as current proof.

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

Before fan-out, producer and consumer agents share the generated edge contract
and focused contract fixture. Parallelism begins after those contracts compile,
not after each agent has independently guessed its handoff shape.

## Portability And Template Lifecycle

The reusable core remains product- and backend-neutral:

- manifest and evidence schemas;
- journey graph and state-transition validation;
- runner lifecycle and redaction;
- affected-journey selection interfaces;
- report rendering;
- contract-diff and protocol compatibility checks.

The core defines an issuer/verifier interface rather than assuming one CI
vendor. Template examples may use Buildkite; Maestro uses Woodpecker. Each fork
must configure its trusted issuer and required-check identity explicitly.

Template adapters provide Confect/Convex release guards, generated surface
inventory, Vitest execution, Playwright transport proof, and Buildkite examples.
Maestro supplies its own Convex/Woodpecker adapter without putting Maestro
business concepts into the template core.

`pnpm template:journey` emits a version-pinned protocol declaration. Template
release notes and a migration command describe incompatible protocol changes.
The reference application contains one admitted miniature journey and one
assembling journey so a new fork proves both positive admission and dark
partial-infrastructure behavior on day zero.

The framework must be independently extractable as a workspace package. It may
live in the template monorepo initially, but application adoption must not
depend on copying undocumented scripts or absolute repository paths.

## Performance Budget

Journey admission must preserve development throughput:

- static manifest, graph, reference, and affected-journey checks target seconds;
- ordinary partial PRs run focused seam tests and only affected admitted
  journeys;
- deterministic full journeys are sharded by scenario and cache immutable
  fixture setup where isolation remains valid;
- core state-machine proof runs below the browser layer, while browser, CLI,
  API, and MCP tests remain thin parity checks;
- deployed proof runs on admission, release, and scheduled canary cadence, not
  every partial PR;
- CI reports selection reasons so an unexpectedly broad run is diagnosable;
- unclassifiable release-surface changes fail safe but generate a concrete
  ownership action rather than a generic full-suite mystery.

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
   guard for the new canonical hydration entrypoint. CI records the initial
   legacy inventory as a ratchet baseline and fails any later increase or
   expired removal milestone.
4. Add the Brain deterministic fixture and full journey test; confirm it fails
   at the first real broken boundary.
5. Complete the Brain work packages, rerunning the same test after each repair.
6. Admit Brain only when every deterministic scenario passes.
7. Deploy the admitted commit to staging, verify the deployed artifact and
   generated-contract hashes match the CI admission receipt, and run the
   exact-SHA synthetic proof.
8. Start the continuous admitted canary and freshness reporting.
9. Preserve the report as release evidence and use the same framework for the
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
  bottleneck;
- admitted journey leases become stale or failing when code, contracts,
  deployment, or canary evidence drifts;
- changing tests or manifests cannot silently reduce required journey coverage.
- runtime admission requires a trusted attestation matching the exact artifact,
  contract, test apparatus, and transitive journey dependencies;
- legacy exposure can only shrink, and an expired migration milestone fails the
  required gate rather than becoming permanent debt.
