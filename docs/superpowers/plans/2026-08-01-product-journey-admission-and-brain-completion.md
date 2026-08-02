# Product Journey Admission And Brain Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a reusable product-journey admission system from
`maestro-template-saas-ui`, adopt it in Maestro, and repair Brain until an
existing synthetic client hydrates into accepted context and produces
historically resolvable cited content through real product boundaries.

**2026-08-02 execution correction:** Only template Tasks 1–4 remain active.
Maestro/Brain Tasks 5–12 are closed and must not be revived. The template CI
adapter is Woodpecker; `.buildkite/scripts` may remain only as explicitly
labeled compatibility implementations while active pipeline configuration,
operator language, and required-check identity use Woodpecker.

**Architecture:** A backend-neutral package owns journey manifests, graphs,
evidence, contract diffs, leases, and attestation verification. Repository
adapters own surface discovery, CI identity, persistence, release guards, and
transport drivers. Maestro's Brain pilot begins at authenticated client
activation, uses the existing canonical capture/source-unit/document/context
authorities, and admits the journey only after deterministic and exact-SHA
deployed proofs pass.

**Tech Stack:** TypeScript, Effect Schema, Convex, Confect, Vitest, Playwright,
pnpm, Woodpecker, GitHub pull requests.

## Global Constraints

- Never mutate production; all journey content is synthetic and non-sensitive.
- Broad test suites run only on `maestro-worker`; this host runs orchestration
  and focused checks through `host-test-slot` when needed.
- Woodpecker `ci/woodpecker/pr/verify` is Maestro's required CI authority; Qlty
  is advisory; Graphite is excluded.
- Partial work packages may merge while the journey is `assembling`; new release
  entrypoints remain server-side dark.
- Existing Brain surfaces enter `legacy_exposed`; their enumerated reachability
  and write authority may only shrink.
- The deterministic journey starts at an authenticated public capability and may
  seed only legitimate pre-hydration customer state.
- Tests may not seed captured artifacts, source units, review events, routes,
  evidence bindings, retrieval projections, accepted-context snapshots,
  generated posts, or citations.
- External providers are deterministic fakes in Tier 2; Tier 3 records its
  explicit provider posture.
- Journey contracts, required scenarios, fixtures, runners, validators, gates,
  and trusted-issuer configuration are protected contract-risk surfaces.
- Runtime admission requires a trusted attestation matching the running
  artifact, contract, test apparatus, generated interfaces, dependencies, and
  deployment and canonical runtime-configuration identities.
- Repository adapters must prove exhaustive release-surface discovery, guard
  domination before side effects, and fail-closed adapter conformance; an
  unknown registration mechanism or unreadable merge base is a gate failure.
- Legacy exposure is compared with an immutable release-bound surface and
  authority baseline; ordinary pull requests may only shrink it.
- Required-check, contract-owner, protected-path, and issuer-context enforcement
  is verified against the live source-control/CI control plane before admission.
- Deployed-proof bootstrap uses a short-lived exact-identity attestation limited
  to the registered staging canary actor and synthetic tenant; it never enables
  general traffic.
- Receipt consumers verify versioned payload and exact journey, actor,
  workspace/persona, input/version, policy, idempotency, and terminal-state
  correlation; receipt-label existence alone never proves an edge.
- Journey ids are immutable. Rename, split, merge, replacement, and retirement
  require a protected migration ledger preserving old ownership, dependencies,
  contracts, and lease continuity.
- Minimum proof class is derived from surface authority: durable writes,
  external dispatch, asynchronous work, and non-local transport require deployed
  proof, and downgrades are governed coverage reductions.
- Every work package uses a dedicated worktree and ordinary GitHub branch/PR; no
  active checkout or tmux session is repurposed.
- No Brain v2, generic learning table, parallel retrieval store, or adjacent
  context authority is introduced.

## Program Dependency Graph

```text
T1 core contracts ─┬─> T2 validation/gates ─┬─> T4 template reference proof
                   └─> T3 runner/attestation┘
                                      │
                                      v
M1 Maestro adoption + failing Brain journey
      ├─> M2 activation/discovery/capture
      ├─> M3 classification/review/convergence
      ├─> M4 canonical placement/voice authority
      ├─> M5 accepted retrieval/revocation/scaling
      └─> M6 generation/citations/transports
                         │
                         v
M7 reconciliation + full deterministic admission
                         │
                         v
M8 merge + exact-SHA staging proof + release QA
```

Tasks 1–4 (T1–T4) belong to `maestro-template-saas-ui`. Tasks 5–12 (M1–M8)
belong to `maestro`. Each task is a reviewable work package; Tasks 6–10 may
execute in parallel after Task 5 publishes the typed edge contracts.

---

### Task 1: Backend-Neutral Journey Contracts

**Repository:** `maestro-template-saas-ui`

**Files:**

- Create: `packages/product-journey/package.json`
- Create: `packages/product-journey/tsconfig.json`
- Create: `packages/product-journey/src/manifest.ts`
- Create: `packages/product-journey/src/receipts.ts`
- Create: `packages/product-journey/src/evidence.ts`
- Create: `packages/product-journey/src/index.ts`
- Create: `packages/product-journey/src/manifest.test.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `tsconfig.json`

**Interfaces:**

- Produces: `ProductJourneyManifest`, `JourneyScenarioRequirement`,
  `JourneyGraph`, `JourneyReceiptEnvelope`, `JourneyEvidenceReport`, and
  `parseProductJourneyManifest(value: unknown)`.
- Consumes: `effect` and no product, backend, CI-vendor, browser, Convex, or
  Confect module.

- [ ] **Step 1: Write failing schema tests**

Add table-driven tests proving that a high-risk manifest is rejected when it
lacks tenant isolation, unsafe-input refusal, deletion/revocation, historical
version, migration/backfill, or deployed-proof scenarios; also reject duplicate
node ids, dangling edges, dependency cycles, and credentials in fixture
metadata.

```ts
expect(() =>
  parseProductJourneyManifest(highRiskWithout("tenant_isolation")),
).toThrowError(/tenant_isolation/);
expect(() => parseProductJourneyManifest(withDanglingEdge())).toThrowError(
  /unknown graph node/,
);
```

- [ ] **Step 2: Run the focused test and observe the missing module failure**

Run: `rtk pnpm --dir packages/product-journey test`

Expected: FAIL because `src/manifest.ts` and the package do not exist.

- [ ] **Step 3: Add the closed contract types and parsers**

Define literal unions for states, lease health, coverage profiles, scenario
classes, receipt status, and evidence verdicts. Define the manifest identity as:

```ts
export type ProductJourneyManifest = {
  readonly journeyProtocolVersion: 1;
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly status: "assembling" | "legacy_exposed" | "admitted" | "suspended";
  readonly releaseProof: "deterministic-only" | "deployed-proof-required";
  readonly coverageProfile: "read-only" | "stateful" | "high-risk";
  readonly actor: string;
  readonly goal: string;
  readonly releaseEntrypoints: readonly string[];
  readonly scenarios: readonly JourneyScenarioRequirement[];
  readonly graph: JourneyGraph;
  readonly requiredReceiptKinds: readonly string[];
  readonly dependsOnJourneys: readonly JourneyDependency[];
  readonly affectedPaths: readonly string[];
  readonly workPackageRefs: readonly string[];
  readonly owner: string;
  readonly legacyExposure?: LegacyExposure;
};
```

- [ ] **Step 4: Export the package and run its focused gates**

Run:
`rtk pnpm --dir packages/product-journey test && rtk pnpm --dir packages/product-journey typecheck`

Expected: all contract and type tests pass.

- [ ] **Step 5: Commit**

Run:
`rtk git add packages/product-journey pnpm-workspace.yaml tsconfig.json pnpm-lock.yaml && rtk git commit -m "feat: add product journey contracts"`

---

### Task 2: Graph Validation, Contract Diff, And Affected Selection

**Repository:** `maestro-template-saas-ui`

**Files:**

- Create: `packages/product-journey/src/graph.ts`
- Create: `packages/product-journey/src/contract-diff.ts`
- Create: `packages/product-journey/src/selection.ts`
- Create: `packages/product-journey/src/graph.test.ts`
- Create: `packages/product-journey/src/contract-diff.test.ts`
- Create: `packages/product-journey/src/selection.test.ts`
- Create: `tooling/quality/check-product-journeys.mts`
- Create: `tooling/quality/check-product-journeys.test.mts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `package.json`
- Modify: `Justfile`

**Interfaces:**

- Consumes: Task 1 contracts plus a repository-supplied
  `ReleaseSurfaceInventory`.
- Produces: `validateJourneyCatalog`, `diffJourneyContract`,
  `selectAffectedJourneys`, and `pnpm check:product-journeys`.

- [ ] **Step 1: Write adversarial gate tests**

Cover missing entrypoints, two producers for one receipt, zero consumer
assertions, assembling-frontier regression, new legacy entrypoints, expired
legacy milestones, reduced roles/transports/negative scenarios, unresolved
release surfaces, incompatible dependency versions, and transitive invalidation.

```ts
expect(diffJourneyContract(base, removeIsolation(base))).toEqual(
  expect.objectContaining({
    risk: "coverage_reduction",
    requiresApproval: true,
  }),
);
expect(
  selectAffectedJourneys(catalog, inventory, ["unknown/release.ts"]),
).toEqual(catalog.map(({ id }) => id));
```

- [ ] **Step 2: Verify the tests fail at the unimplemented interfaces**

Run:
`rtk pnpm exec vitest run packages/product-journey/src/graph.test.ts packages/product-journey/src/contract-diff.test.ts packages/product-journey/src/selection.test.ts tooling/quality/check-product-journeys.test.mts`

Expected: FAIL with missing exports.

- [ ] **Step 3: Implement deterministic graph and catalog validation**

Use stable sorting and closed diagnostic codes. The gate output shape is:

```ts
export type JourneyDiagnostic = {
  readonly code:
    | "ENTRYPOINT_UNMAPPED"
    | "EDGE_PRODUCER_INVALID"
    | "EDGE_CONSUMER_MISSING"
    | "FRONTIER_REGRESSION"
    | "LEGACY_EXPANSION"
    | "LEGACY_MILESTONE_EXPIRED"
    | "DEPENDENCY_INCOMPATIBLE"
    | "SURFACE_UNCLASSIFIED"
    | "COVERAGE_REDUCED";
  readonly journeyId: string;
  readonly path?: string;
  readonly message: string;
};
```

Compare the merge-base catalog as well as individual manifests. Deleting or
renaming an admitted/legacy journey, transferring reachable entrypoints without
a protected migration record, or reducing the proof class below discovered
surface authority is a coverage reduction. Journey replacement/split/merge and
retirement preserve predecessor hashes, dependencies, attestations, and lease
continuity.

- [ ] **Step 4: Register the fail-closed static command**

Add `check:product-journeys` to `package.json`, `Justfile`, gate definitions,
config-drift expectations, and CI completeness so deletion or downgrading fails.
The command loads an explicit repository catalog/inventory adapter and optional
merge-base contract input. It exits nonzero when the adapter is missing or
invalid. Do not add it to root `verify` until Task 4 supplies the real reference
catalog and generated inventory; a passing empty no-op gate is forbidden.

- [ ] **Step 5: Run focused gate tests**

Run:
`rtk pnpm exec vitest run packages/product-journey/src tooling/quality/check-product-journeys.test.mts`

Expected: all tests pass; a fixture-backed valid catalog returns success;
malformed, unowned, weakened, or missing adapter inputs return stable nonzero
verdicts. Direct default `pnpm check:product-journeys` remains fail-closed until
Task 4 installs the repository adapter.

- [ ] **Step 6: Commit**

Run:
`rtk git add packages/product-journey tooling/quality package.json Justfile && rtk git commit -m "feat: enforce product journey contracts"`

---

### Task 3: Deterministic Runner, Evidence, Leases, And Attestations

**Repository:** `maestro-template-saas-ui`

**Files:**

- Create: `packages/product-journey/src/runner.ts`
- Create: `packages/product-journey/src/redaction.ts`
- Create: `packages/product-journey/src/attestation.ts`
- Create: `packages/product-journey/src/lease.ts`
- Create: `packages/product-journey/src/runner.test.ts`
- Create: `packages/product-journey/src/attestation.test.ts`
- Create: `packages/product-journey/src/lease.test.ts`

**Interfaces:**

- Consumes: a product-supplied `JourneyDriver` and trusted
  `AttestationIssuer`/`AttestationVerifier` adapters.
- Produces: `runJourney`, `verifyAdmissionAttestation`,
  `effectiveAdmissionState`, JSON/Markdown evidence, and
  earliest-failed-boundary reporting.

- [ ] **Step 1: Write failing lifecycle and trust-chain tests**

Prove ordered receipts, `not_reached` after the earliest failure, secret
redaction, stable JSON, expiry, mismatched commit/contract/generated/deployment
hash refusal, transitive dependency staleness, and local-issuer rejection when
`environment !== "local"`.

```ts
expect(report.scenarios[0]?.boundaries.map(({ status }) => status)).toEqual([
  "passed",
  "failed",
  "not_reached",
]);
expect(
  verifyAdmissionAttestation(attestation, runningIdentity, trustedKeys),
).toEqual({ ok: false, reason: "COMMIT_MISMATCH" });
```

- [ ] **Step 2: Run and observe failures**

Run:
`rtk pnpm exec vitest run packages/product-journey/src/runner.test.ts packages/product-journey/src/attestation.test.ts packages/product-journey/src/lease.test.ts`

Expected: FAIL with missing runner, attestation, and lease modules.

- [ ] **Step 3: Implement runner and evidence redaction**

Use a driver contract that exposes public interactions and read-only receipt
inspection without database insertion hooks:

```ts
export type JourneyDriver = {
  readonly invoke: (interaction: JourneyInteraction) => Promise<unknown>;
  readonly inspectReceipt: (handle: JourneyReceiptHandle) => Promise<unknown>;
  readonly identity: () => Promise<JourneyRuntimeIdentity>;
};
```

Validate versioned receipt payloads and mandatory correlation fields at every
consumer boundary. An altered, stale, foreign-workspace/persona, unrelated
input/version, policy-mismatched, or invalid replay receipt fails the boundary
even when its kind string is correct.

- [ ] **Step 4: Implement attestation verification and lease projection**

Bind repository SHA, journey/contract/test hashes, generated identity,
dependency attestations, CI issuer, deployment, issued time, and expiry. Keep
the signing algorithm behind an adapter; core verification consumes bytes and
trusted issuer identity.

- [ ] **Step 5: Run focused tests and typecheck**

Run:
`rtk pnpm --dir packages/product-journey test && rtk pnpm --dir packages/product-journey typecheck`

Expected: all tests pass.

- [ ] **Step 6: Commit**

Run:
`rtk git add packages/product-journey && rtk git commit -m "feat: add journey evidence and admission leases"`

---

### Task 4: Generator, Runtime Guard Adapter, And Reference Journeys

**Repository:** `maestro-template-saas-ui`

**Files:**

- Create: `tooling/generators/src/journey-files.ts`
- Create: `tooling/generators/src/journey-files.test.ts`
- Create: `tooling/generators/src/journey-package-export.ts`
- Create: `tooling/generators/src/journey-package-export.test.ts`
- Create: `packages/convex/confect/journeys/admission.spec.ts`
- Create: `packages/convex/confect/journeys/admission.impl.ts`
- Create: `packages/convex/test/journey-admission.test.ts`
- Modify (generated): `packages/convex/confect/_generated/spec.ts`
- Create (generated):
  `packages/convex/confect/_generated/registeredFunctions/journeys/admission.ts`
- Create: `journeys/reference-read/manifest.ts`
- Create: `journeys/reference-read/driver.ts`
- Create: `journeys/reference-read/journey.test.ts`
- Create: `journeys/reference-write/manifest.ts`
- Create: `journeys/reference-write/frontier.test.ts`
- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-config-drift.mts`
- Modify: `package.json`
- Create: `.woodpecker/verify.yml`
- Create: `tooling/ci/woodpecker-env.sh`
- Create: `tooling/ci/woodpecker-verify.sh`
- Modify compatibility implementation: `.buildkite/scripts/phase1.sh`
- Modify compatibility implementation:
  `.buildkite/scripts/ci-self-protection.sh`
- Modify: `.github/CODEOWNERS`
- Modify: `docs/template/generator-output-contract.md`
- Create: `docs/template/product-journey-admission.md`

**Interfaces:**

- Consumes: Tasks 1–3.
- Produces:
  `pnpm template:journey --name client-onboarding --profile high-risk`,
  deterministic package export, a Confect runtime guard, one admitted miniature
  read journey, one assembling dark write journey, a hashed repository-adapter
  descriptor, a complete surface-coverage witness, and adapter conformance tests
  runnable in a freshly generated target.

- [ ] **Step 1: Write generator and guard failures first**

Assert deterministic file output, collision refusal, protocol pinning, generated
catalog registration, server-side denial without a trusted current attestation,
and local-only development admission.

```ts
expect(result.files.map(({ path }) => path)).toContain(
  "journeys/client-onboarding/manifest.ts",
);
await expect(
  runGuard({ attestation: null, environment: "staging" }),
).rejects.toMatchObject({ code: "JOURNEY_NOT_ADMITTED" });
```

- [ ] **Step 2: Run focused failures**

Run:
`rtk pnpm exec vitest run tooling/generators/src/journey-files.test.ts packages/convex/confect/journeys/admission.impl.test.ts`

Expected: FAIL because generator and guard modules do not exist.

- [ ] **Step 3: Add generator command and template blueprint registration**

Generated manifests start with `status: "assembling"`, a frontier at the guard,
explicit scenario classes from the coverage profile, and no credential fields.
Add `template:journey` to root scripts.

Add `template:export-product-journey`, which copies only the package's tracked
files, writes `journey-package.provenance.json` containing the exact template
commit and content hash, and refuses a dirty source package or a destination
containing uncommitted changes. Its canonical export manifest contains sorted
relative paths, per-file SHA-256, aggregate canonical-JSON SHA-256, package
version, journey protocol version, and exact source commit. It rejects symlinks,
untracked source bytes, source/destination overlap, existing target paths, or a
dirty destination before its first write.

- [ ] **Step 4: Add the real Confect guard adapter**

The public entrypoint calls the guard before any product mutation. The adapter
loads the checked-in intent plus runtime attestation/lease projection and
returns only an admitted identity or a typed denial.

```ts
export type RequireJourneyAdmission = (input: {
  readonly journeyId: string;
  readonly entrypoint: string;
  readonly runtime: JourneyRuntimeIdentity;
}) => Effect.Effect<VerifiedAdmission, JourneyNotAdmitted>;
```

Represent `JourneyNotAdmitted` as a Confect `Schema.TaggedError` containing only
journey id, entrypoint, and a closed public reason. Runtime identity and lease
projection are injected services; no ambient local/test bypass is allowed.
Generate Confect refs and test the registered public entrypoint through
`TestConfect`, including a durable-write count of zero on denial.

Generate a closed surface-kind/registration-mechanism witness. Prove that every
registered public or autonomous surface is journey-owned and that the verified
guard dominates its first durable write or external dispatch. Include HTTP/API,
generated functions, routes, CLI/MCP operations, webhooks, cron/scheduled work,
queues/retries/dead letters, plugins, and feature-activated registrations; an
unknown mechanism fails. Deferred workers propagate and reverify journey and
attestation identity before side effects.

- [ ] **Step 5: Add reference positive and dark journeys**

The read journey proves terminal success and denial. The assembling write
journey proves its public mutation makes zero durable writes and reports the
guard as its explicit frontier.

- [ ] **Step 6: Wire protected CI**

Run `pnpm check:product-journeys` in deterministic phase one. Add contract-risk
path detection and require the configured independent contract-owner approval
for coverage reductions. Woodpecker is this repository's active adapter. This
task also installs the real reference catalog and generated release-surface
inventory, then adds the now-executable command to root `verify`, config drift,
CI completeness, `phase1.sh`, and secretless CI self-protection.

Check in a content-hashed adapter descriptor naming the catalog, witness,
merge-base provider, supported registration mechanisms, and required command.
Add a backend/CI-neutral adapter conformance suite and execute it against both
the template checkout and a freshly generated application. Add provider-adapter
tests for the out-of-band protection audit; missing provider capability fails
admission rather than silently skipping it.

- [ ] **Step 7: Run focused and broad template verification**

Run focused:
`rtk pnpm exec vitest run packages/product-journey tooling/generators/src/journey-files.test.ts packages/convex/confect/journeys journeys`

Commit the branch, then run broad: `rtk maestro-remote-test -- pnpm verify`

Expected: focused suites and full template verification pass.

- [ ] **Step 8: Commit and merge through GitHub**

Run:
`rtk git add packages/product-journey packages/convex/confect/journeys tooling/generators tooling/ci journeys package.json .woodpecker docs/template && rtk git commit -m "feat: ship journey admission template"`

Create a normal GitHub PR, obtain independent contract review, wait for required
checks, and merge without bypassing protection.

---

### Task 5: Maestro Adoption And The First Failing Brain Journey

**Repository:** `maestro`

**Files:**

- Create: `packages/product-journey/` using the template's deterministic
  `template:export-product-journey` command
- Create: `packages/product-journey/journey-package.provenance.json`
- Create: `journeys/brain-hydration/manifest.ts`
- Create: `journeys/brain-hydration/edge-contracts.ts`
- Create: `journeys/brain-hydration/fixture.ts`
- Create: `journeys/brain-hydration/driver.ts`
- Create: `journeys/brain-hydration/journey.test.ts`
- Create: `journeys/brain-hydration/frontier.test.ts`
- Create: `tooling/quality/check-product-journeys.mts`
- Create: `tooling/quality/check-product-journeys.test.mts`
- Create: `tooling/journeys/maestro-release-surface-inventory.mts`
- Create: `tooling/journeys/maestro-release-surface-inventory.test.mts`
- Create: `journeys/brain-hydration/product-acceptance.json`
- Modify: `package.json`
- Modify: `.woodpecker/verify.yml`
- Modify: `.github/CODEOWNERS`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-config-drift.mts`
- Create: `docs/product/brain/journey-admission.md`

**Interfaces:**

- Consumes: merged Task 4 framework.
- Produces: `brain.hydration.v1`, shared edge receipt types for M2–M6, protected
  Woodpecker gates, a Maestro surface-coverage witness and immutable legacy
  baseline, and deterministic evidence whose expected frontier is the first
  genuinely missing boundary.

- [ ] **Step 1: Import the framework with provenance**

From the clean merged template worktree, resolve
`journey_template_sha=$(rtk git rev-parse HEAD)` and run the documented exporter
with the clean Maestro worktree as destination. Record that exact SHA, package
content hash, and protocol version. Reject local package links, floating git
refs, dirty source packages, and hand-copied untracked scripts.

- [ ] **Step 2: Write the high-risk Brain manifest**

Declare the exact graph:

```ts
export const brainHydrationGraph = defineJourneyGraph({
  start: "client_activation",
  terminal: "historical_citation_resolved",
  edges: [
    edge("client_activation", "discovery", "brain.discovery.v1"),
    edge("discovery", "capture", "brain.capture.v1"),
    edge("capture", "classification", "brain.classification.v1"),
    edge("classification", "human_resolution", "brain.review-request.v1"),
    edge("human_resolution", "canonical_settlement", "brain.settlement.v1"),
    edge("canonical_settlement", "accepted_retrieval", "brain.retrieval.v1"),
    edge("accepted_retrieval", "generation", "brain.generation-context.v1"),
    edge("generation", "citation_resolution", "brain.output.v1"),
    edge("citation_resolution", "source_revision", "brain.citation.v1"),
    edge(
      "source_revision",
      "historical_citation_resolved",
      "brain.revision.v1",
    ),
  ],
});
```

- [ ] **Step 3: Add only legitimate upstream synthetic state**

Fixture creation is limited to two workspaces; admin/editor/viewer users; one
active persona; profile, website, prior post, transcript, and native-corpus
inputs; and deterministic provider responses. Add an assertion that all
forbidden intermediate tables are empty before activation.

- [ ] **Step 4: Write the complete deterministic scenario matrix**

Include success, empty, loading/progress, user-visible failure, permission
denial, tenant isolation, unsafe instruction rejection, contradiction review,
duplicate convergence, retry/replay, partial recovery, deletion/revocation,
historical citation, migration/backfill, direct foreign-id access, and transport
parity requirements.

Generate a Maestro release-surface inventory from the registered Convex function
surface, headless registry/schema, web route tree, workflow manifests, and
schema imports. Inventory asynchronous and dynamic registrations as first-class
surfaces, record reachable operation/write authority, and fail on an unknown
registration mechanism. Create a release-bound legacy baseline that normal PRs
may only shrink. Add product-owner acceptance for actor, goal, terminal and
forbidden outcomes, and coverage profile; protect that acceptance, the manifest,
fixture, runner, and gate paths through `CODEOWNERS`.

- [ ] **Step 5: Run the test and preserve the truthful first failure**

Run:
`rtk maestro-remote-test -- pnpm --dir packages/convex exec vitest run ../../../journeys/brain-hydration/journey.test.ts`

Expected on baseline `95c9a04c048dcf8806bd754ccc606225b4314e5b`: FAIL at
activation because `workflows/clientActivation:run` is referenced but absent.
The report must mark later boundaries `not_reached`; it must not seed around the
failure.

- [ ] **Step 6: Install the static Woodpecker gate and commit**

Run focused gate tests, commit, open a normal GitHub PR, and merge after
`ci/woodpecker/pr/verify` passes. Brain remains `legacy_exposed`; the canonical
hydration entrypoint remains dark.

---

### Task 6: Activation, Discovery, Capture, And Immediate Admission Start

**Repository:** `maestro`

**Files:**

- Create: `packages/convex/convex/workflows/clientActivation.ts`
- Create: `packages/convex/convex/workflows/clientActivation.test.ts`
- Create:
  `packages/convex/convex/capabilities/clients/clientActivationDiscovery.ts`
- Create:
  `packages/convex/convex/capabilities/clients/clientActivationDiscovery.test.ts`
- Create: `packages/convex/convex/domain/clientActivationDiscovery.ts`
- Create: `packages/convex/convex/domain/clientActivationDiscovery.test.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/capturedArtifactEvidenceStarts.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/capturedArtifactEvidenceStarts.test.ts`
- Modify:
  `packages/convex/convex/capabilities/clients/clientActivationStarts.ts`
- Modify: `packages/convex/convex/capabilities/clients/profileSources.ts`
- Modify: `packages/convex/convex/capabilities/clients/profileSourcePosts.ts`
- Modify: `packages/convex/convex/capabilities/brain/operatorContextIntake.ts`

**Interfaces:**

- Consumes: `brain.discovery.v1` and `brain.capture.v1` edge contracts from M1.
- Produces: counted discovery receipts, immutable capture/version receipts, and
  an owned start of `capturedArtifactEvidence.admitCurrentInternal` for every
  eligible item.

- [ ] **Step 1: Write failing behavior tests**

Prove discovery across all five upstream source classes, explicit exclusions,
immutable hashes, exact replay, capture-version advancement, zero foreign rows,
and automatic admission kickoff. Assert no terminal `ready_for_review` result is
returned merely because source-unit rows were created.

- [ ] **Step 2: Verify the current boundary fails**

Run focused tests for the new workflow plus existing profile/operator intake
tests. Expected: missing workflow and missing coordinator start assertions fail.

- [ ] **Step 3: Implement the durable client activation workflow**

Use `@convex-dev/workflow`; each `step.run*` targets an internal capability.
Stages are discovery, capture/admission, review settlement, projection, and
readiness. A failure records the exact stage reason and remains retryable.

```ts
export const run = defineWorkflow(components.workflow, {
  args: clientActivationWorkflowArgs,
  returns: clientActivationWorkflowResult,
}).handler(async (step, args) => {
  const discovered = await step.runQuery(discoverRef, args, {
    name: "client-activation.discover",
  });
  const captured = await step.runMutation(captureRef, discovered, {
    name: "client-activation.capture-and-admit",
  });
  return step.runMutation(settleRef, captured, {
    name: "client-activation.settle",
  });
});
```

- [ ] **Step 4: Connect every capture producer to admission**

Profile, post, website/operator, transcript, and native-corpus producers pass
their exact artifact/version receipt into the same admission-start capability.
Do not duplicate source-unit creation logic inside producers.

```ts
await ctx.runMutation(
  internal.capabilities.knowledge.capturedArtifactEvidenceStarts.startInternal,
  { workspaceId, artifactId: receipt.artifactId, versionId: receipt.versionId },
);
```

- [ ] **Step 5: Advance the journey frontier and verify replay**

Run the M2 focused tests and the full journey. Expected: activation reaches
classification/review, replay creates no duplicate artifact/version/source
authority, and the next truthful failure is at semantic convergence or review.

- [ ] **Step 6: Commit, independently review, and merge**

Commit one workflow/capability intention per PR where the 300-line source limit
requires separation. Merge only after Woodpecker passes.

Run focused:
`rtk pnpm --dir packages/convex exec vitest run convex/workflows/clientActivation.test.ts convex/capabilities/clients/clientActivationDiscovery.test.ts convex/capabilities/knowledge/capturedArtifactEvidenceStarts.test.ts`

Run committed frontier proof:
`rtk maestro-remote-test -- pnpm --dir packages/convex exec vitest run ../../../journeys/brain-hydration/journey.test.ts`

---

### Task 7: Classification, Deduplication, Contradiction, Risk, And Review Settlement

**Repository:** `maestro`

**Files:**

- Create:
  `packages/convex/convex/capabilities/knowledge/sourceUnitClassification.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/sourceUnitClassification.test.ts`
- Create: `packages/convex/convex/domain/sourceUnitClassification.ts`
- Create: `packages/convex/convex/domain/sourceUnitClassification.test.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/sourceUnitReviewSettlement.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/sourceUnitReviewSettlement.test.ts`
- Create: `packages/convex/convex/repos/knowledge/sourceUnitConvergenceRepo.ts`
- Create:
  `packages/convex/convex/repos/knowledge/sourceUnitConvergenceRepo.test.ts`
- Modify: `packages/convex/convex/capabilities/knowledge/sourceUnits.ts`
- Modify:
  `packages/convex/convex/repos/knowledge/sourceUnitAutoAdmissionRepo.ts`
- Modify: `packages/convex/convex/schema/sourceUnits.ts`
- Modify: `packages/convex/convex/schema/sourceUnitReviewEvents.ts`

**Interfaces:**

- Consumes: capture receipts from M2 and the existing pinned LLM gateway/policy
  system.
- Produces: `brain.classification.v1`, `brain.review-request.v1`, and terminal
  settlement receipts with accepted/rejected/deduplicated/conflict states and
  useful reasons.

- [ ] **Step 1: Write the five semantic-case tests first**

The fact is safe and accepted; the style preference targets persona voice
authority; the duplicate points to one canonical unit; the contradiction creates
a targeted resolution request; the risky instruction is rejected and cannot
alter policy. Also prove classifier failure is retryable and rejected rows
retain a reason.

- [ ] **Step 2: Add a closed model verdict and deterministic validator**

The LLM call returns one closed schema:

```ts
type SourceUnitClassificationVerdict =
  | { readonly kind: "fact"; readonly disposition: "safe_candidate" }
  | {
      readonly kind: "style_preference";
      readonly disposition: "voice_candidate";
    }
  | {
      readonly kind: "duplicate";
      readonly canonicalSourceUnitId: Id<"sourceUnits">;
    }
  | {
      readonly kind: "contradiction";
      readonly conflictsWith: Id<"sourceUnits">;
    }
  | { readonly kind: "risky_policy"; readonly reason: string };
```

Code validates identity, lineage, and allowed transition; it does not recreate
semantic classification with keywords.

- [ ] **Step 3: Implement automatic and human settlement**

Low-risk safe facts may auto-approve under pinned policy. Contradictions remain
pending only until the targeted public review action resolves them. Risky policy
material becomes terminal rejected. Failed decisions retain typed retry
semantics. `needs_review` is never used as an unexplained terminal state.

```ts
export type SourceUnitSettlement =
  | {
      readonly status: "accepted";
      readonly reviewEventId: Id<"sourceUnitReviewEvents">;
    }
  | {
      readonly status: "rejected";
      readonly reviewEventId: Id<"sourceUnitReviewEvents">;
      readonly reason: string;
    }
  | {
      readonly status: "deduplicated";
      readonly canonicalSourceUnitId: Id<"sourceUnits">;
    }
  | {
      readonly status: "awaiting_human";
      readonly conflictId: string;
      readonly reason: string;
    }
  | {
      readonly status: "failed";
      readonly retryable: boolean;
      readonly reason: string;
    };
```

- [ ] **Step 4: Verify deletion and rejection exclusion**

Read APIs for generation/retrieval must see no rejected, deleted, expired,
candidate, duplicate-shadow, or unresolved-conflict version.

- [ ] **Step 5: Advance the full journey and merge**

Expected frontier: canonical Brain/voice settlement. Commit and merge after
focused tests plus Woodpecker.

Run focused:
`rtk pnpm --dir packages/convex exec vitest run convex/domain/sourceUnitClassification.test.ts convex/capabilities/knowledge/sourceUnitClassification.test.ts convex/capabilities/knowledge/sourceUnitReviewSettlement.test.ts convex/repos/knowledge/sourceUnitConvergenceRepo.test.ts`

---

### Task 8: Evidence-Backed Brain Placement And Versioned Voice Authority

**Repository:** `maestro`

**Files:**

- Modify: `packages/convex/convex/capabilities/brain/sourceUnitPages.ts`
- Modify: `packages/convex/convex/capabilities/brain/sourceUnitPages.test.ts`
- Modify:
  `packages/convex/convex/capabilities/documents/sourceUnitBrainPageProposals.ts`
- Modify:
  `packages/convex/convex/capabilities/documents/sourceUnitBrainPageProposals.lifecycle.test.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/sourceUnitCanonicalSettlement.ts`
- Create:
  `packages/convex/convex/capabilities/knowledge/sourceUnitCanonicalSettlement.test.ts`
- Create:
  `packages/convex/convex/capabilities/clients/personaVoicePolicySettlement.ts`
- Create:
  `packages/convex/convex/capabilities/clients/personaVoicePolicySettlement.test.ts`
- Modify: `packages/convex/convex/workflows/personaVoiceLearning.ts`

**Interfaces:**

- Consumes: terminal classifications/reviews from M3.
- Produces: `brain.settlement.v1` with exact accepted document
  annotation/evidence binding or exact active persona voice-policy version.

- [ ] **Step 1: Replace title-only placement acceptance tests**

Assert a fact placement creates non-empty document markdown, an accepted source
annotation, exact `documentEvidenceBindings`, route completion, immutable source
version linkage, and replay stability. Reject stale versions and cross-workspace
ids.

- [ ] **Step 2: Make canonical Brain placement use the existing proposal
      lifecycle**

`placeSourceUnitInBrainImpl` must delegate to the canonical proposal/acceptance
authority rather than directly calling `createBrainPageImpl` with only a title.
The terminal route is complete only after the accepted document version and
binding exist.

```ts
const settlement = await settleAcceptedSourceUnitInBrain(ctx, {
  workspaceId: ctx.workspace._id,
  sourceUnitId: sourceUnit._id,
  sourceUnitVersionId: requireCurrentVersionId(sourceUnit),
  evidenceKey: requireSingleEvidenceKey(sourceUnit),
  actor: { kind: "user", userId: String(ctx.user._id) },
  now: input.now,
});
```

- [ ] **Step 3: Settle preferences into versioned persona voice policy**

Persist active persona-scoped policy lineage with source unit/version/evidence,
supersede the previous active version explicitly, and support reversal on
revocation. Never place style preference text as a factual Brain page.

```ts
export type PersonaVoiceSettlementReceipt = {
  readonly personaId: Id<"clientPersonas">;
  readonly voicePolicyVersionId: Id<"policies">;
  readonly sourceUnitVersionId: Id<"sourceUnitVersions">;
  readonly evidenceKey: string;
  readonly supersededPolicyVersionId: Id<"policies"> | null;
};
```

- [ ] **Step 4: Verify the settlement boundary and merge**

Expected journey frontier: accepted retrieval. Run focused tests, journey test,
Woodpecker, independent review, and merge.

Run focused:
`rtk pnpm --dir packages/convex exec vitest run convex/capabilities/brain/sourceUnitPages.test.ts convex/capabilities/documents/sourceUnitBrainPageProposals.lifecycle.test.ts convex/capabilities/knowledge/sourceUnitCanonicalSettlement.test.ts convex/capabilities/clients/personaVoicePolicySettlement.test.ts`

---

### Task 9: Accepted Retrieval, Revocation, Isolation, And Scale

**Repository:** `maestro`

**Files:**

- Modify:
  `packages/convex/convex/repos/content/generationContextAdmissionRepo.ts`
- Modify:
  `packages/convex/convex/capabilities/content/generationContextAdmissions.test.ts`
- Create:
  `packages/convex/convex/repos/brain/acceptedRetrievalProjectionRepo.ts`
- Create:
  `packages/convex/convex/repos/brain/acceptedRetrievalProjectionRepo.test.ts`
- Create: `packages/convex/convex/capabilities/brain/acceptedRetrieval.ts`
- Create: `packages/convex/convex/capabilities/brain/acceptedRetrieval.test.ts`
- Modify: `packages/convex/convex/schema/brainRetrievalChunks.ts`
- Modify: `packages/convex/convex/capabilities/brain/search.ts`

**Interfaces:**

- Consumes: exact canonical settlement receipts from M4.
- Produces: `brain.retrieval.v1`, one accepted-current projection shared by
  search, generation, CLI, MCP, and agents.

- [ ] **Step 1: Write inclusion/exclusion and scale tests**

Prove accepted facts and preferences are retrievable; candidate, rejected,
deleted, expired, conflicted, superseded, and foreign-workspace material is not.
Insert 101 legitimate accepted concepts/pages through public test setup and
prove retrieval paginates or selects deterministically instead of hard-failing
the workspace.

- [ ] **Step 2: Replace caller-labelled parallel projections**

Define one projection identity keyed by workspace, persona scope, canonical
authority kind/id/version, lifecycle, and content hash. Search and generation
consume the same projection contract; they may apply different query ranking
without owning different truth.

```ts
export type AcceptedRetrievalProjection = {
  readonly workspaceId: Id<"workspaces">;
  readonly clientPersonaId: Id<"clientPersonas"> | null;
  readonly authority: "source_unit" | "brain_document" | "voice_policy";
  readonly authorityId: string;
  readonly versionId: string;
  readonly lifecycle: "accepted_current" | "revoked";
  readonly contentHash: string;
};
```

- [ ] **Step 3: Remove the global 100-row workspace failure mode**

Use bounded indexed pages and selection budgets. A query may return a typed
truncation receipt, but a workspace with more than 100 active records remains
functional. Preserve fixed query counts and avoid per-head hydration.

```ts
export type AcceptedRetrievalPage = {
  readonly items: readonly AcceptedRetrievalProjection[];
  readonly cursor: string | null;
  readonly truncated: boolean;
};
```

- [ ] **Step 4: Implement revocation and current-version invalidation**

Source rejection/deletion/expiry, document supersession, policy reversal, and
persona/workspace changes invalidate projections before subsequent retrieval or
generation admission.

- [ ] **Step 5: Verify and merge**

Expected journey frontier: normal generation. Run focused retrieval/context
tests, the journey, Woodpecker, review, and merge.

Run focused:
`rtk pnpm --dir packages/convex exec vitest run convex/repos/brain/acceptedRetrievalProjectionRepo.test.ts convex/capabilities/brain/acceptedRetrieval.test.ts convex/capabilities/content/generationContextAdmissions.test.ts`

---

### Task 10: Normal Generation, Exact Citations, Historical Resolution, And Transport Parity

**Repository:** `maestro`

**Files:**

- Modify:
  `packages/convex/convex/capabilities/content/generationContextAdmissions.ts`
- Modify: `packages/convex/convex/domain/generationContextBrief.ts`
- Modify: `packages/convex/convex/capabilities/content/postVersionGrounding.ts`
- Modify:
  `packages/convex/convex/capabilities/content/postVersionGrounding.test.ts`
- Create: `packages/convex/convex/capabilities/brain/citationReceipts.ts`
- Create: `packages/convex/convex/capabilities/brain/citationReceipts.test.ts`
- Modify:
  `packages/convex/convex/adapters/headlessBrainWriteExecutorSurfaces.ts`
- Modify: `packages/convex/convex/adapters/headlessSchemas.ts`
- Modify: `tooling/workflow/headless-cli.test.mts`
- Modify: `tooling/brain/product-brain-mcp.test.mts`
- Modify: `apps/web/src/features/brain/brain-revision-evidence.tsx`
- Modify: `apps/web/src/features/brain/brain-revision-evidence.test.tsx`

**Interfaces:**

- Consumes: accepted-current retrieval projection from M5.
- Produces: `brain.generation-context.v1`, `brain.output.v1`,
  `brain.citation.v1`, and thin web/API/CLI/MCP parity proofs.

- [ ] **Step 1: Write the grounded-generation failures first**

Use the normal post-generation entrypoint with a deterministic fake model.
Assert the generated text uses the accepted synthetic fact and style preference,
excludes risky/rejected/foreign content, and emits only citation handles from
the frozen accepted-context manifest.

- [ ] **Step 2: Freeze accepted context at generation start**

Persist ordered accepted members, exact source-unit versions/evidence keys,
document versions, persona voice-policy versions, prompt/policy/model pins, and
the rendered input hash. Empty context is permitted only with a discovery
receipt proving no eligible evidence; otherwise return an explicit hydration
readiness error.

```ts
export type FrozenBrainGenerationContext = {
  readonly acceptedContextManifestHash: string;
  readonly sourceVersions: readonly AcceptedCitationHandle[];
  readonly documentVersionIds: readonly Id<"documentVersions">[];
  readonly voicePolicyVersionIds: readonly Id<"policies">[];
  readonly discoveryReceiptId: string;
};
```

- [ ] **Step 3: Add immutable citation resolution**

Resolve a citation by workspace plus exact historical source-unit version and
evidence key. After a new source version becomes current, old output continues
to resolve the old quote/locator/version hash while new generation receives the
new accepted version.

```ts
export type HistoricalCitationReceipt = {
  readonly sourceUnitVersionId: Id<"sourceUnitVersions">;
  readonly evidenceKey: string;
  readonly quote: string;
  readonly locator: string;
  readonly versionHash: string;
  readonly isCurrent: boolean;
};
```

- [ ] **Step 4: Add transport parity tests**

Browser, API, released-schema CLI, repo-local CLI, MCP, and agent context-pack
surfaces invoke the same capability and expose the same terminal receipt. Their
thin tests compare operation id, schema identity, workspace/persona scope, and
citation handles rather than duplicating the full state machine.

- [ ] **Step 5: Verify and merge**

Expected journey frontier: terminal historical citation resolution. Run focused
tests, the complete deterministic journey, Woodpecker, review, and merge.

Run focused:
`rtk pnpm --dir packages/convex exec vitest run convex/capabilities/content/generationContextAdmissions.test.ts convex/capabilities/content/postVersionGrounding.test.ts convex/capabilities/brain/citationReceipts.test.ts`

Run transport proof:
`rtk maestro-remote-test -- pnpm exec vitest run tooling/workflow/headless-cli.test.mts tooling/brain/product-brain-mcp.test.mts apps/web/src/features/brain/brain-revision-evidence.test.tsx`

---

### Task 11: Reconciliation, Runtime Admission, And Deterministic Brain Admission

**Repository:** `maestro`

**Files:**

- Create: `packages/convex/convex/capabilities/brain/hydrationReconciliation.ts`
- Create:
  `packages/convex/convex/capabilities/brain/hydrationReconciliation.test.ts`
- Create: `packages/convex/convex/repos/brain/hydrationReconciliationRepo.ts`
- Create:
  `packages/convex/convex/repos/brain/hydrationReconciliationRepo.test.ts`
- Create: `packages/convex/convex/capabilities/system/journeyAdmission.ts`
- Create: `packages/convex/convex/capabilities/system/journeyAdmission.test.ts`
- Modify: `journeys/brain-hydration/manifest.ts`
- Modify: `journeys/brain-hydration/journey.test.ts`
- Modify: `.woodpecker/verify.yml`
- Create: `tooling/journeys/issue-admission-attestation.mts`
- Create: `tooling/journeys/issue-admission-attestation.test.mts`

**Interfaces:**

- Consumes: terminal receipts from M2–M6.
- Produces: reconciled counts, stuck-state ages, retry/repair actions, a
  Woodpecker-issued deterministic admission attestation, and effective
  server-side admission.

- [ ] **Step 1: Write reconciliation and stuck-state tests**

Every discovered item must reconcile to accepted, rejected, deduplicated,
excluded, or explicitly awaiting the test's targeted human decision. After
decisions, assert zero unexplained candidate, `ready_for_review`, planned route,
failed-without-retry, or orphan projection rows.

```ts
export type BrainHydrationReconciliation = {
  readonly discovered: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly deduplicated: number;
  readonly excluded: number;
  readonly awaitingHuman: number;
  readonly unexplained: number;
  readonly stuck: readonly {
    readonly boundary: string;
    readonly ageMs: number;
  }[];
};
```

- [ ] **Step 2: Implement bounded repair semantics**

Retry restarts from the earliest failed receipt, preserves prior immutable
receipts, and never inserts a downstream authority directly. Reconciliation
returns explicit counts and typed repair commands.

```ts
export type BrainHydrationRepair =
  | { readonly kind: "retry_boundary"; readonly receiptId: string }
  | { readonly kind: "request_human_resolution"; readonly conflictId: string }
  | { readonly kind: "none" };
```

- [ ] **Step 3: Run the complete deterministic suite**

Run on `maestro-worker` against the committed SHA. Expected: every required
scenario passes, replay is byte/cardinality stable, isolation produces zero
foreign receipts, and no scenario is skipped or `not_reached`.

- [ ] **Step 4: Issue and verify the deterministic attestation**

Woodpecker binds exact SHA, journey contract/test/fixture/runner hashes,
generated Convex/headless schema identity, dependency attestations, and expiry.
It also binds the authoritative evidence digest, the complete required-scenario
result set (no skipped or `not_reached` scenario), and a canonical digest of
feature/route/operation/auth/policy/provider/schema/migration/guard
configuration identities. The runtime guard rejects a source-only `admitted`
state, unavailable configuration digest, or digest mismatch.

Before issuance, a Woodpecker/GitHub control-plane adapter verifies the live
required-check rule, distinct contract-owner approval, protected control-plane
paths, trusted non-PR issuer context, and audited break-glass posture.

- [ ] **Step 5: Transition Brain to admitted intent and merge**

Change `legacy_exposed` to `admitted` only in the admission PR. The same PR may
not reduce coverage. Merge after required Woodpecker and independent contract
approval.

Run focused:
`rtk pnpm --dir packages/convex exec vitest run convex/capabilities/brain/hydrationReconciliation.test.ts convex/repos/brain/hydrationReconciliationRepo.test.ts convex/capabilities/system/journeyAdmission.test.ts tooling/journeys/issue-admission-attestation.test.mts`

---

### Task 12: Exact-SHA Staging Proof, Full Release QA, Issues, And Launch Verdict

**Repository:** `maestro`

**Files:**

- Create: `tooling/journeys/brain-staging-canary.mts`
- Create: `tooling/journeys/brain-staging-canary.test.mts`
- Create: `docs/launch/evidence/brain-hydration/admission-release/manifest.json`
- Create:
  `docs/launch/evidence/brain-hydration/admission-release/scenario-results.json`
- Create: `docs/launch/evidence/brain-hydration/admission-release/release-qa.md`
- Create: `docs/launch/evidence/brain-hydration/admission-release/logs/`
- Create: `docs/launch/evidence/brain-hydration/admission-release/screenshots/`
- Modify: `docs/product/brain/journey-admission.md`

**Interfaces:**

- Consumes: exact merged SHA and staging deployment identity.
- Produces: deployed-proof attestation, renewable canary lease, complete A–E
  release-QA evidence, deduplicated GitHub issues, and launch verdict.

- [ ] **Step 1: Verify deployment identity before mutation**

Read the staging deployment's reported SHA and generated-contract hash. Abort
with `DEPLOYMENT_IDENTITY_MISMATCH` if either differs from the deterministic
bootstrap attestation. Also compare the canonical runtime-configuration digest.
Never fall back to production.

```ts
if (
  deployed.commitSha !== attestation.commitSha ||
  deployed.generatedContractHash !== attestation.generatedContractHash
) {
  throw new Error("DEPLOYMENT_IDENTITY_MISMATCH");
}
```

Use a short-lived `canary_bootstrap` attestation accepted only by the registered
staging canary actor in the dedicated synthetic tenant. It cannot enable general
user traffic. After the exact-SHA canary passes, the trusted issuer incorporates
that deployed receipt into the normal admission attestation; rerun denial tests
showing the bootstrap identity cannot reach any other workspace, persona,
entrypoint, mutation, or external dispatch.

- [ ] **Step 2: Run the synthetic deployed Brain journey**

Use a dedicated staging test workspace/persona and synthetic content. Exercise
activation, discovery, capture, immediate review, targeted contradiction
resolution, safe settlement, retrieval, normal generation, revision, historical
citation, replay, role denial, direct foreign-id denial, and cross-workspace
isolation. Store redacted request/response evidence.

- [ ] **Step 3: Run Brain application QA**

Verify load without console/request errors; overview/list/detail counts; search
for pages/concepts/claims/source evidence; links/backlinks/favorites/broken-link
indicators; page create/edit/reload persistence; exact immutable citations; and
empty/loading/success/error/permission-denied UI states. Capture screenshots and
browser/request logs for every verdict.

- [ ] **Step 4: Run the released CLI matrix in a clean temporary worker
      environment**

Execute exactly:

```sh
rtk npm install @maestrogtm/maestro-cli@0.3.0
rtk maestro --version
rtk maestro --help
rtk maestro headless list --format table
rtk maestro headless inspect brain.concepts.list --format table
rtk maestro headless schema brain.concepts.list
rtk maestro mcp manifest
rtk maestro auth status
```

If approved staging credentials resolve through the secret manager, execute
`maestro login --staging` and
`maestro headless call brain.concepts.list --json '{}'` without printing tokens.
Also record the expected failures for the old npm scope, unauthenticated GitHub
release installation, Homebrew, and obsolete `operations search/describe`
commands. Compare with the repo-local CLI and classify each mismatch as
installation, naming, authentication, endpoint, registry/schema, or
command-version drift.

- [ ] **Step 5: Produce the evidence-backed scenario table**

For every A–E scenario record expected result, actual result, evidence path,
severity, environment, exact SHA, staging version, synthetic persona, and
credential posture. A missing credential is `BLOCKED`, never `PASS`.

- [ ] **Step 6: File deduplicated GitHub bugs for every reproducible failure**

Search open and closed issues before creation. Each issue includes environment
and SHA, redacted minimal reproduction, expected/actual, suspected boundary
without asserting an unverified root cause, severity, and launch impact.

- [ ] **Step 7: Start the renewable staging canary**

Schedule the critical terminal journey in the isolated synthetic tenant. Lease
health becomes `stale` when its freshness window expires and `failing` after the
declared repeated-failure threshold. Runtime effective admission applies the
configured fail-closed or degraded-read-only policy.

```ts
const lease = projectLeaseHealth({
  attestation,
  canaryRuns,
  now: verifiedServerTime,
  freshnessWindowMs: BRAIN_CANARY_FRESHNESS_WINDOW_MS,
  repeatedFailureThreshold: 2,
});
```

- [ ] **Step 8: Publish the final launch recommendation**

Return `PASS`, `CONDITIONAL PASS`, or `FAIL`; separate code defects,
deployment/configuration defects, stale documentation, and missing
release/distribution work. Do not call the goal complete until all required
scenarios have authoritative evidence and every reproducible failure has a
deduplicated issue.

---

## Integration And Review Protocol

1. The integration owner creates fresh worktrees from current `origin/main` and
   records baseline SHAs before dispatch.
2. M1 lands the graph and edge contracts before M2–M6 fan out.
3. Each implementation subagent receives one work package, its owned paths,
   exact interfaces, focused tests, and prohibition on editing contract/gate
   files outside that package.
4. Each work package receives two evaluations: spec/edge-contract compliance,
   then code quality and focused verification.
5. The integration owner reruns the journey after every accepted package and
   records whether the frontier advanced, stayed stable for an expected reason,
   or regressed. A regression blocks that package.
6. Partial packages merge only while the new entrypoint remains dark and their
   focused gates plus Woodpecker pass.
7. The admission PR is the only PR that changes Brain from `legacy_exposed` to
   `admitted`; it cannot change required scenarios except through a separately
   approved contract-risk change.
8. Exact-SHA staging proof renews the admission lease; it does not replace
   deterministic CI.

## Completion Audit

Before declaring completion, inspect current evidence for every item below:

- Template core, generator, reference admitted journey, reference assembling
  journey, protected gate, runtime verifier, and documentation are merged.
- Maestro imports a version-pinned framework package with provenance.
- Brain deterministic fixture contains only legitimate upstream state.
- Every graph edge has one producer receipt and a consumer assertion.
- Every required high-risk scenario executes and passes without intermediate
  seeding.
- Activation, capture, classification, review, settlement, retrieval,
  generation, revision, replay, permissions, and tenant isolation are proven.
- No unexplained candidate, review, route, projection, or retry state remains.
- Runtime admission verifies a trusted current attestation for the running SHA.
- Woodpecker required checks pass on every merged Maestro PR; Qlty findings are
  preserved as advisory evidence.
- Exact merged SHA is deployed to staging and its full synthetic proof passes.
- Brain UI and released/repo-local CLI matrices have output or screenshot
  evidence for every verdict.
- Reproducible failures have deduplicated GitHub issues.
- The final recommendation distinguishes code, deployment/configuration,
  documentation, and release/distribution findings.
