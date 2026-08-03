# Cucumber Product Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`
> (recommended) or `executing-plans` to implement this plan task-by-task. Keep
> the checkbox state in this file current and use a fresh isolated worktree for
> each pull request.

**Goal:** Make reviewed Gherkin the sole human-maintained behavioral contract
for Maestro-built products, execute every admitted contract against the built
browser and built CLI on one real backend, and let only a strict protected
Cucumber Messages verdict authorize the completion claim.

**Approved design:**
[`2026-08-02-cucumber-product-contracts-design.md`](../specs/2026-08-02-cucumber-product-contracts-design.md)
at commit `795d94848fbb30e94c7ae3609dec565f597cd00e`.

**Implementation safety amendments:** Runtime review against Cucumber 13.2.0
found that configuration `require` arrays are additive and all source/support
paths share one `cwd`. This plan therefore deliberately narrows the design's
`features/**/*.ts` support glob to the two protected support/step roots and runs
Cucumber from a controller-owned overlay root; candidate TypeScript is never a
support-code input. Official Hook/TestRunHook envelopes replace the design's
custom ordinary-hook counters. These amendments are part of the contract for
implementation and must be reflected in the next design revision without
changing the immutable approved-design commit cited above.

**Implementation baseline:** Start every implementation branch from protected
`origin/main`. The repository snapshot used to write this plan was
`73fad4e42d471e1fe2d4c526bbc8b68d7b343c7f`; re-read protected main before each
task and record its immutable base SHA in the pull request. Do not build from
the older design branch.

**Architecture:** A minimal protected/tokenless Woodpecker root is installed
before any candidate Cucumber code. Official Cucumber owns parsing, compilation,
step matching, execution, status semantics, and Messages. Existing Maestro
registration, principal, process-supervision, upgrade, release, and Woodpecker
authorities gain only the policy Cucumber cannot provide: exhaustive
public-surface inventory, lifecycle darkness, exact source/execution equality,
real runtime identity, and protected merge-candidate binding. No second BDD
protocol, receipt service, dashboard, retry layer, sharding system, or parallel
release authority is introduced.

**Tech stack:** Node 22, TypeScript, Effect Schema, Convex, Confect,
`@cucumber/cucumber@13.2.0`, `@cucumber/gherkin@41.0.0`,
`@cucumber/messages@34.0.1`, Playwright, pnpm, Vitest, Woodpecker, GitHub merge
queue.

## Global Constraints

### Scope Guard

- This plan changes `maestro-template-saas-ui` first and consumes the sealed
  result in Maestro as one downstream pilot. It does not redesign Brain.
- Woodpecker is the sole blocking CI authority. Qlty stays advisory under its
  30-second cap. Buildkite, Fabro, and Graphite are not restored or invoked.
- Existing process supervision, API-key crypto/indexes, principal union,
  feature-policy deny boundary, staged upgrade transaction, customer release
  materializer, and deploy authority are extended in place.
- Candidate application/build/runtime processes are untrusted. Cucumber,
  protected steps and drivers, Messages storage, tuple verification, and status
  posting stay outside candidate namespaces.
- The temporary `W0` trust floor precedes even the `W0` pull request: revoke
  pull-request secret injection, install a server-side root derived from the
  immutable protected-main baseline, require its temporary context, and prove
  its candidate child is tokenless before the branch receives its first CI
  event. No candidate-supplied dependency, support, generator, gate, or pipeline
  change receives a CI event or merges before that floor exists; offline local
  bootstrap development remains credentialless.
- Dependency resolution is candidate execution. Candidate `pnpm fetch`, lockfile
  generation, `.pnpmfile.cjs`, and package-manager hooks run only in the same
  empty-environment, resource-limited sandbox as install/build, with no
  controller mounts or sockets and dependency egress restricted to the protected
  allowlist.
- Every external transition is compare-and-swap in both directions. A pre-state
  mismatch performs no write; rollback applies only while live state exactly
  equals that step's recorded forward postimage. Otherwise both checks remain
  required and the operator stops for reconciliation.
- No product slice may claim completion. Slices retain `@assembling`, run all
  journeys already admitted on protected main, and keep newly activation-owned
  entrypoints dark. Only a final current-main pull request may flip a Feature
  already assembling on protected main to `@admitted`.
- An admission pull request cannot change contract-control code. Control-plane
  changes and lifecycle flips use separate pull requests and merge-queue batch
  size one.
- Feature prose never owns routes, selectors, auth rules, shell commands, or
  implementation paths. Stable coverage tags join Features to generated
  technical authority.
- Existing product implementation roots are CODEOWNED. Every product slice
  requires a non-author owner approval for its current head; no new
  implementation-path receipt is introduced.
- Broad verification runs on `maestro-worker` after a commit. If unavailable,
  run broad local commands only through `host-test-slot`; focused Vitest and
  documentation checks use the same host policy.

## Work Classification

Every task is one of:

- `template-gap`: reusable capability absent from the template;
- `pattern-instance`: extend one existing authority instead of making a new one;
- `fixture-to-real`: replace fake or structural evidence with a real product
  boundary.

## Program Invariants

1. Checked-in UTF-8/LF `.feature` bytes are the only manually maintained
   behavioral contract bytes.
2. Each Feature has one stable `@journey_*` tag and one Feature-level lifecycle
   tag. Reserved tags cannot be shadowed below Feature.
3. The public-surface inventory is a generated bijection over every reachable
   public registration and action discriminant. New entries default to
   `auth_deny_all`.
4. Generated UI and server guards keep activation-owned assembling or suspended
   entrypoints dark. Emergency policy may disable, never enable.
5. HTTP, CLI, API, MCP, session, and internal callers adapt verified identities
   into one principal union. Caller tenant data is only a target assertion.
6. The canonical CLI invokes the real authenticated HTTP transport
   asynchronously; credentials never enter argv.
7. Expected Pickles and steps come from the pinned Gherkin compiler. Runtime IDs
   are followed only inside one Messages stream and are never persisted as
   stable identity.
8. Every expected Pickle, Outline row, Pickle step, emitted scenario/run hook,
   and trusted BeforeStep/AfterStep marker executes exactly once at attempt zero
   and passes.
9. A trusted driver records Action and Outcome observations only after a real
   product interaction or actor-visible assertion succeeds.
10. Web, CLI, backend, source, artifact, and merge-candidate identities agree
    through independently observed values.
11. A zero admitted inventory is an explicit static result; it cannot be called
    product completion and does not create synthetic Messages.
12. Old journey and fake-proof machinery is deleted only after the replacement
    reference fixture and every mutation are green.
13. When exhaustive inventory for a journey exposes both UI and CLI, admission
    requires UI, CLI, and cross-surface Pickles. Single-surface admission is
    valid only when the inventory contains exactly one transport.
14. Admission pull requests contain only the lifecycle line and byte-exact
    generated projections derived from it. Product repairs are new assembling
    slices.
15. Release tags are protected annotated objects. Consumers verify the remote
    tag-object OID, peeled commit, and manifest digest; the public default moves
    only after verified tag materialization in a separate pull request.
16. A candidate package-manager hook is untrusted code even with lifecycle
    scripts disabled. Resolution, fetch, lockfile generation, install, and build
    never execute in the status controller namespace.
17. External inverse writes are conditional on the recorded forward postimage;
    rollback never overwrites an intervening GitHub or Woodpecker change.

## Quality Targets

- Product scenarios assert actor-visible behavior through accessible roles,
  labels, and text; CSS selectors, component props, handlers, and fixture state
  are not outcome oracles.
- Static checks enforce objective Gherkin structure only. Human product review
  owns domain language, concrete examples, one primary action, observable
  outcomes, useful Backgrounds, and unresolved business questions; no LLM or
  prose score enters the execution verdict.
- Loading and mutation progress remain visible and non-destructive; empty state
  does not imply success; ready/read and ready/edit are distinguishable; denied
  and failed mutations preserve prior durable state.
- Every authority-bearing control has keyboard/focus behavior inherited from the
  existing UI kit, an unambiguous accessible name, and a server guard behind its
  UI darkness guard.
- Build Pack review shows exact draft bytes/digest, edit state, awaiting-review,
  stale approval, approval success/failure, export retry, and exported
  provenance without a second contract copy.
- Reference and Brain scenarios cover UI mutation success/failure, CLI
  success/failure, cross-surface read-after-write, signed-out, read-only, and
  foreign-tenant states with synthetic data.
- Diagnostics redact credentials and customer content while retaining the
  smallest actionable file/line, step, surface, identity, or sandbox finding.

## Test Plan

| Surface                | Required behavior states                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static contract check  | malformed, assembling unresolved, admitted resolved, suspended, lifecycle downgrade, zero admitted                                                |
| UI registration/action | hidden while assembling/suspended, visible admitted, emergency-disabled, mutation success, mutation failure                                       |
| Authenticated backend  | session/API-key success, missing credential, insufficient role/scope, foreign tenant, caller-tenant mismatch                                      |
| Built CLI              | local help/schema, external success, 401, 403, validation error, backend unavailable, redacted output                                             |
| Build Pack review      | loading, no draft, draft read, draft edit, awaiting review, stale CAS, approve success/failure, export success/retry                              |
| Acceptance runtime     | startup, readiness, zero inventory, complete run, failed step/hook, signal cleanup, resource limit, evidence tamper                               |
| Existing-app adoption  | preview, stale fingerprint/preimage, package-manager mismatch, hostile registry/pnpmfile, pre-apply failure, journal recovery, monotonic baseline |
| CI cutover             | pre-PR secret revocation, old+temporary overlap, wrong App/context/digest, expected-state drift, post-read mismatch, inverse CAS refusal          |
| Release                | absent-root non-default seal, protected annotated tag, staging-proof, component mismatch, production re-observation, separate default switch      |

Each task names the smallest focused test that first turns red. The full
generated-app fixture and mutation gauntlet are integration evidence, not
substitutes for those focused checks.

## Canonical Interfaces

These signatures are shared across tasks. Change them only in a dedicated
control-plane pull request with matching tests and plan amendment.

```ts
export type ContractLifecycle = "assembling" | "admitted" | "suspended";
export type ContractTransport = "ui" | "cli" | "api" | "mcp" | "webhook";
export type StablePickleKey = `pickle_sha256:${string}`;
export type StableStepKey = `step_sha256:${string}`;

export type PublicSurface = {
  readonly id: string;
  readonly transport: ContractTransport;
  readonly coverageTag: `@covers_${string}`;
  readonly activationJourneyId?: `journey_${string}`;
  readonly authPolicyId: `auth_${string}`;
  readonly authority: {
    readonly kind:
      | "route"
      | "ui-action"
      | "convex-function"
      | "http-route"
      | "command"
      | "trigger"
      | "webhook";
    readonly registrationLocator: string;
    readonly actionDiscriminant?: string;
  };
};

export type ContractSource = {
  readonly path: string;
  readonly uri: string;
  readonly bytes: string;
  readonly sha256: `sha256:${string}`;
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
};

export type ExpectedStep = {
  readonly key: StableStepKey;
  readonly index: number;
  readonly pickleStepType: "CONTEXT" | "ACTION" | "OUTCOME" | "UNKNOWN";
  readonly text: string;
  readonly argumentDigest?: `sha256:${string}`;
  readonly astLocation: { readonly line: number; readonly column: number };
};

export type ExpectedPickle = {
  readonly key: StablePickleKey;
  readonly sourceSha256: `sha256:${string}`;
  readonly uri: string;
  readonly scenarioLocation: { readonly line: number; readonly column: number };
  readonly examplesRowLocation?: {
    readonly line: number;
    readonly column: number;
  };
  readonly tags: readonly string[];
  readonly journeyId: `journey_${string}`;
  readonly lifecycle: ContractLifecycle;
  readonly transports: readonly ContractTransport[];
  readonly coverageTags: readonly `@covers_${string}`[];
  readonly steps: readonly ExpectedStep[];
};

export type SelectionManifest = {
  readonly schemaVersion: 1;
  readonly mode: "authoritative" | "focused";
  readonly featurePaths: readonly string[];
  readonly pickleKeys: readonly StablePickleKey[];
  readonly focusedJourneyId?: `journey_${string}`;
};

export type RuntimeManifest = {
  readonly schemaVersion: 1;
  readonly checkoutSha: string;
  readonly webArtifactDigest: `sha256:${string}`;
  readonly cliArtifactDigest: `sha256:${string}`;
  readonly backend: BackendRuntimeIdentity;
};

export type BackendRuntimeIdentity = {
  readonly inputDigest: `sha256:${string}`;
  readonly deploymentId: string;
  readonly startNonce: string;
};

export type DriverObservation = {
  readonly stepKey: StableStepKey;
  readonly kind: "action" | "outcome";
  readonly correlationNonce?: string;
  readonly surfaceId?: string;
  readonly transport?: ContractTransport;
};

export type ServerCorrelationObservation = {
  readonly stepKey: StableStepKey;
  readonly scenarioNonce: string;
  readonly correlationNonce: string;
  readonly actorPrincipalDigest: `sha256:${string}`;
  readonly surfaceId: string;
  readonly transport: ContractTransport;
  readonly backend: BackendRuntimeIdentity;
};

export type RuntimeObservationAttachment = {
  readonly schemaVersion: 1;
  readonly pickleKey: StablePickleKey;
  readonly checkoutSha: string;
  readonly webArtifactDigest: `sha256:${string}`;
  readonly cliArtifactDigest: `sha256:${string}`;
  readonly webBuildSourceSha: string;
  readonly cliBuildSourceSha: string;
  readonly backends: {
    readonly controller: BackendRuntimeIdentity;
    readonly web: BackendRuntimeIdentity;
    readonly cli: BackendRuntimeIdentity;
  };
  readonly scenarioNonce: string;
  readonly observations: readonly DriverObservation[];
  readonly serverCorrelations: readonly ServerCorrelationObservation[];
  readonly hooks: {
    readonly beforeStepKeys: readonly StableStepKey[];
    readonly afterStepKeys: readonly StableStepKey[];
  };
};
```

The canonical public-authority key is the stable serialization of
`(authority.kind, authority.registrationLocator, authority.actionDiscriminant, transport, authPolicyId)`.

## Dependency And Pull-Request Graph

```text
W0 protected/tokenless CI bootstrap
  -> C1 pinned Cucumber/config
  -> C2 public/auth authority
  -> C3 exhaustive registrations/provenance
  -> C4 lifecycle compiler + darkness
  -> C5 principal/auth repair
  -> C6 external CLI HTTP
  -> C7 exact contract inventory
  -> C8 strict Messages verifier
  -> C9 trusted observations/runtime identity
  -> C10 isolated controller/runtime
  -> C11a assembling reference product
  -> C12 mutation gauntlet
       -> F1 create/contracts-add
       -> F2 generator cleanup/provenance
       -> U1 existing-app audit upgrade
       -> R1 immutable release manifests
       -> W1 protected Woodpecker cutover
            -> C11b reference lifecycle/projection admission
                 -> P1 immutable Brain pilot release
                      -> M-pre Maestro temporary protected-CI root
                      -> M0 Maestro contracts-audit install
                      -> M0b Maestro protected-CI source/canonical cutover
                      -> M1 Maestro Brain assembling slices
                      -> M2 Brain lifecycle/projection admission
                      -> D1 old machinery deletion
       -> B1 Build Pack human review -----------------------> D2 alpha.3 seal/tag
                                                              -> D3 default switch
```

`W0` first makes existing deterministic gates protected and candidate-tokenless.
`C1` through `C12` then land one at a time. `F1`, `F2`, `B1`, `U1`, and `R1` may
be prepared in parallel after `C12`, but each rebases on current main and reruns
admitted contracts. `W1` changes only the already protected controller's
semantics through an overlapping context transition. `C11b` then admits the
reference Feature already assembling on protected main. `P1` seals a non-default
immutable pilot without waiting for `B1`; `B1` is required only for the public
`D2` release. Before `M0` receives a pull-request event, `M-pre` installs and
requires a temporary protected root from immutable Maestro main and revokes PR
secret injection. `M0` installs the manifest-declared additive audit payload and
preimage-bound integrations under that root; `M0b` ports only the required
target wrappers and performs the canonical cutover before `M1`. `M2` contains
only the lifecycle line plus exact generated projections. Any repair is another
assembling slice before a fresh `M2`. `D2` seals and tags without changing the
public default; `D3` switches the default only after remote-tag materialization.

## Per-Task Completion Protocol

For every task:

1. Add the named behavioral test and run it red for the stated reason.
2. Implement only the named interface using existing authorities.
3. Run the focused command green.
4. Run the task's integration command green.
5. Commit only that task's files and record the immutable commit SHA.
6. Open a normal GitHub pull request with its dependency as base only when the
   dependency is not yet on main; merge bottom-up.
7. After merge, rerun the next task from current `origin/main`.

---

### Task 1: Bootstrap Protected, Tokenless CI Before Cucumber

**Class:** `pattern-instance`

**PR:** `W0`

**Depends on:** no source task. Before opening or running `W0`, freeze merges
and complete Step 0's external temporary-root trust floor.

**Files:**

- Create: `tooling/ci/protected-bootstrap.mts`
- Create: `tooling/ci/protected-bootstrap.test.mts`
- Create: `tooling/ci/controller.Dockerfile`
- Modify: `tooling/ci/ci-self-protection.sh`
- Modify: `tooling/ci/phase1.sh`
- Modify: `.woodpecker/verify.yml`
- Delete: `.github/workflows/quality.yml`
- Modify: `.github/CODEOWNERS`
- Modify: `tooling/quality/woodpecker-template-pipeline.test.mts`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Create: `docs/template/protected-ci-bootstrap.md`

**Interfaces:**

```ts
export type ProtectedBootstrapObservation = {
  readonly repository: string;
  readonly baseRef: "main";
  readonly protectedBaseOid: string;
  readonly controllerImageDigest: `sha256:${string}`;
  readonly appId: number;
  readonly canonicalContext: "ci/woodpecker/pr/verify";
  readonly temporaryContext: `ci/woodpecker/pr/${string}`;
  readonly woodpeckerConfigDigest: `sha256:${string}`;
  readonly githubRulesetDigest: `sha256:${string}`;
};

export type ProtectedTransitionJournal = {
  readonly schemaVersion: 1;
  readonly observation: ProtectedBootstrapObservation;
  readonly steps: readonly {
    readonly id: string;
    readonly preimageDigest: `sha256:${string}`;
    readonly forwardPostimageDigest?: `sha256:${string}`;
    readonly inverseAllowedOnlyFrom?: `sha256:${string}`;
  }[];
};

export function verifyProtectedBootstrap(
  observation: ProtectedBootstrapObservation,
): readonly string[];

export function planProtectedTransition(input: {
  readonly action:
    "install-temporary" | "enable-canonical" | "remove-temporary" | "rollback";
  readonly journal: ProtectedTransitionJournal;
  readonly expectedLiveDigest: `sha256:${string}`;
}): {
  readonly previewFingerprint: `protected_transition_sha256:${string}`;
  readonly confirmationArgv: readonly string[];
};
```

- [ ] **Step 0: Keep bootstrap development PR-free.** Freeze merges and develop
      Steps 1-6 in the isolated local worktree without opening a pull request or
      triggering any branch event. The immutable external base is
      `73fad4e42d471e1fe2d4c526bbc8b68d7b343c7f`; if protected main advances,
      restart the observation from the new exact commit instead of silently
      substituting it. No candidate code receives credentials during local
      development or tests.

- [ ] **Step 1: Write red trust-boundary tests.** Prove the candidate namespace
      has no `GITHUB_TOKEN`, BWS/Cloudflare/provider/deploy secret, host home,
      SSH agent, Docker/control socket, or writable controller storage. Prove a
      PR-head pipeline edit cannot select a protected root or post either
      protected context. Prove GitHub queries/status posting occur only in the
      controller and are bound to repository, base/head/merge-group OIDs and the
      observed App ID.

- [ ] **Step 2: Write red CODEOWNERS and transition tests.** Require future
      control paths (`features/**`, `cucumber.cjs`, `tooling/acceptance/**`,
      generated inventory/projection and auth-policy sources, manifests,
      package/lock/Just/Woodpecker files, `packages/template-core/**`,
      `tooling/confect-manifest/**`, `tooling/agent-pack/**`, `tooling/ci/**`,
      and CODEOWNERS) plus the product roots `apps/web/**`, `apps/cli/**`,
      `packages/convex/**`, and `examples/saas-application/**`. Require
      non-author approval on the current PR head, and make external preflight
      fail unless every rule resolves to at least one write-enabled owner other
      than the PR author. Model exact states
      `old-only -> old+temporary -> protected-canonical+temporary -> protected-canonical`;
      reject any removal when the expected Woodpecker/GitHub digests drift or a
      post-read differs. Against fake GitHub and Woodpecker HTTP servers, spawn
      the real `observe`, `install-temporary`, `enable-canonical`,
      `remove-temporary`, `verify`, and `rollback` CLI commands; require preview
      by default, exact confirmation argv, redacted journal output, and inverse
      refusal after an intervening write.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/protected-bootstrap.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts`

  Expected: FAIL because the checked-in PR-head verify still owns its pipeline
  and declares `GITHUB_TOKEN`; Step 0 prevents that producer from running while
  this source repair is developed.

- [ ] **Step 4: Make the existing deterministic gate root protectable.** Keep
      `phase1.sh` and existing gate commands; do not add a second CI engine.
      Move GitHub/branch/review queries and status posting out of the candidate
      step, remove the secret mapping, delete the retired GitHub Actions PR
      workflow, and make the server-side root launch the resource-limited
      candidate gate namespace from an immutable protected-base commit. Build
      `tooling/ci/controller.Dockerfile` without application dependencies and
      pin its published digest in Woodpecker repository/server state.

- [ ] **Step 5: Add future-path and product-root ownership.** Extend the
      existing CODEOWNERS file with the exact roots from Step 2. Treat
      `packages/template-core/**` as contract/public-surface authority,
      `tooling/confect-manifest/**` and `tooling/agent-pack/**` as supervised
      generation/materialization authority, and `tooling/ci/**` as trust-root
      authority. The protected controller verifies that each matching rule has
      an eligible non-author owner and that one such owner approved the latest
      `headOid`, with stale-approval dismissal, administrator/bypass
      enforcement, and current-base merge-candidate evaluation. Ordinary product
      files no longer auto-merge without owner review; this replaces a
      speculative implementation-path ledger.

- [ ] **Step 6: Run green and commit the source half.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/protected-bootstrap.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts`

  ```bash
  rtk git add tooling/ci/protected-bootstrap.mts tooling/ci/protected-bootstrap.test.mts tooling/ci/controller.Dockerfile tooling/ci/ci-self-protection.sh tooling/ci/phase1.sh .woodpecker/verify.yml .github/workflows/quality.yml .github/CODEOWNERS tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.mts tooling/quality/check-ci-completeness.test.mts docs/template/protected-ci-bootstrap.md
  rtk git commit -m "ci: bootstrap protected tokenless verification"
  ```

- [ ] **Step 7: Establish the temporary trust floor before opening `W0`.** A
      non-author reviews the local source commit and built operator/controller
      digest. The operator CLI defaults to preview, reads GitHub/Woodpecker
      credentials only from BWS-backed environment, permits egress only to
      GitHub and `https://ci.maestrogtm.com`, writes no secret value to its
      journal, and returns an exact confirmation argv. Run:

  ```bash
  rtk headless-bws-env exec sh -c 'exec rtk env WOODPECKER_SERVER=https://ci.maestrogtm.com WOODPECKER_TOKEN="$WOODPECKER_API_TOKEN" pnpm exec tsx tooling/ci/protected-bootstrap.mts observe --repository modernagencysales/maestro-template-saas-ui --base-ref main --base-oid 73fad4e42d471e1fe2d4c526bbc8b68d7b343c7f --journal /Users/headless/.local/state/maestro-ci-transitions/maestro-template-W0.json'
  rtk headless-bws-env exec sh -c 'exec rtk env WOODPECKER_SERVER=https://ci.maestrogtm.com WOODPECKER_TOKEN="$WOODPECKER_API_TOKEN" pnpm exec tsx tooling/ci/protected-bootstrap.mts install-temporary --temporary-context ci/woodpecker/pr/protected-bootstrap --journal /Users/headless/.local/state/maestro-ci-transitions/maestro-template-W0.json'
  ```

  Review the preview, then execute its returned confirmation argv byte-for-byte.
  It narrows/removes secret mappings from pull-request events, installs a
  server-side temporary root that ignores candidate `.woodpecker/**`,
  materializes the immutable base's deterministic gate controls into read-only
  controller storage, and requires `ci/woodpecker/pr/protected-bootstrap`. Run
  `verify --stage temporary` against the same journal and a canary PR; prove a
  no-op candidate pipeline cannot select the root, see a secret, or post the
  context. A pre-state mismatch makes no write.

- [ ] **Step 8: Open and merge `W0` under the temporary trust floor.** Require
      current-head non-author owner approval and the server-side
      `protected-bootstrap` context; the retired secret-bearing PR producer is
      neither executed nor accepted. Merge while all other merges remain frozen,
      publish the controller image from that protected-main SHA, and append its
      immutable digest to the journal.

- [ ] **Step 9: Perform the overlapping canonical cutover.** Observe the exact
      temporary Woodpecker config and GitHub ruleset digests. Enable the new
      protected producer for `ci/woodpecker/pr/verify` while the temporary
      context remains required, and prove both on two fresh merge candidates
      from the recorded App/controller digest. Preview
      `protected-bootstrap.mts enable-canonical --journal /Users/headless/.local/state/maestro-ci-transitions/maestro-template-W0.json`,
      execute its returned confirmation argv, then run
      `verify --stage canonical-overlap`. Only then disable any remaining
      candidate-controlled producer.

- [ ] **Step 10: Close or roll back with bidirectional compare-and-swap.** A
      pre-write mismatch performs no write. On a failed post-read, apply an
      inverse only when live state exactly equals that step's recorded forward
      postimage; otherwise leave both checks required and stop for
      reconciliation. After two proven protected candidates, remove only the
      temporary requirement by previewing `remove-temporary`, executing its
      returned confirmation argv, and running `verify --stage canonical` against
      the same journal. `rollback --step <id>` is likewise preview-first and
      refuses unless live state equals the recorded forward postimage. Retain
      preimage, forward postimage, and inverse condition in the run record.

**Unlock:** Candidate pull requests are tokenless, future trust/product paths
require non-author review, and only a protected server-side root can produce the
canonical required status. `C1` may now begin.

---

### Task 2: Pin Official Cucumber And Freeze Its Configuration

**Class:** `template-gap`  
**PR:** `C1`  
**Depends on:** `W0` fully cut over and verified on protected main

**Files:**

- Create: `cucumber.cjs`
- Create: `tooling/acceptance/check-contracts.mts`
- Create: `tooling/acceptance/check-contracts.test.mts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/template-core/package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

```ts
export type CheckedCucumberConfiguration = {
  readonly requireModule: readonly ["tsx/cjs"];
  readonly require: readonly [
    "features/support/**/*.ts",
    "features/step_definitions/**/*.ts",
  ];
  readonly retry: 0;
  readonly parallel: 0;
};

export function validateCucumberConfigurationSource(
  source: string,
):
  | { readonly ok: true; readonly value: CheckedCucumberConfiguration }
  | { readonly ok: false; readonly findings: readonly string[] };
```

- [ ] **Step 1: Write the failing configuration tests.** In
      `check-contracts.test.mts`, prove the exact four-key object and two exact
      support globs pass. Prove `features/**/*.ts`, any `*.test.ts` below
      `features/`, `paths`, `tags`, `name`, `format`, `retry: 1`, `parallel: 1`,
      an altered TS loader, and every unknown key fail with the offending
      key/value. Add a runtime-resolution fixture proving an attempted CLI
      `--require` is additive rather than replacing configured support, and a
      candidate `features/support/steal.ts` canary that must never be evaluated
      from the eventual controller-owned run root.

```ts
expect(validateCucumberConfigurationSource(validSource)).toEqual({
  ok: true,
  value: validConfig,
});
expect(
  validateCucumberConfigurationSource(sourceWithTagsSelector),
).toMatchObject({ ok: false, findings: [expect.stringMatching(/tags/)] });
```

- [ ] **Step 2: Run the focused test red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/check-contracts.test.mts`

  Expected: FAIL because `check-contracts.mts` does not exist.

- [ ] **Step 3: Add the four-key CommonJS profile and validator.** Export only
      `default` from `cucumber.cjs`:

```js
module.exports = {
  default: {
    requireModule: ["tsx/cjs"],
    require: ["features/support/**/*.ts", "features/step_definitions/**/*.ts"],
    retry: 0,
    parallel: 0,
  },
};
```

The validator never imports candidate JavaScript. It reads the file as text and
requires exact equality with the protected canonical source above, so extra
executable code, inherited keys, comments, selectors, or value changes fail
before Cucumber starts. It separately parses root `package.json` as JSON and
checks exact package versions. Install the three Cucumber packages at exact
versions; declare Gherkin/Messages in `template-core` for its pure compiler
subpath and keep the Cucumber runner at the repository root. Do not add another
Gherkin parser or reporter. The protected runner later copies this config and
protected support files into a controller-owned run root, overlays only
candidate `.feature` bytes at identical repository-relative paths, sets that
root as Cucumber `cwd`, and supplies no additive CLI `--require`/`--import`.
Candidate config and TypeScript are never loaded.

- [ ] **Step 4: Add the initial command surface.** Add
      `acceptance:check = "tsx tooling/acceptance/check-contracts.mts"` and a
      `check-contracts` Just recipe. Register it in the gate-definition
      authority, but do not add `pnpm acceptance` until the real runtime exists.

- [ ] **Step 5: Run focused and manifest checks green.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/check-contracts.test.mts`

  Run: `rtk pnpm acceptance:check`

  Expected: both PASS and print the pinned versions plus the exact accepted
  configuration keys.

- [ ] **Step 6: Commit.**

  ```bash
  rtk git add cucumber.cjs tooling/acceptance/check-contracts.mts tooling/acceptance/check-contracts.test.mts package.json pnpm-lock.yaml packages/template-core/package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "build: pin cucumber contract runtime"
  ```

**Unlock:** Cucumber APIs are stable enough for every expected/runtime model; no
contract is admitted by this task.

---

### Task 3: Define One Public-Surface And Auth-Policy Authority

**Class:** `pattern-instance`

**PR:** `C2` **Depends on:** `C1`

**Files:**

- Create: `packages/template-core/src/publicSurface.ts`
- Create: `packages/convex/confect/capabilities/_kit/authPolicies.ts`
- Create: `packages/convex/test/public-surface-authority.test.ts`
- Modify: `packages/template-core/package.json`
- Modify: `packages/template-core/src/index.ts`
- Modify: `tooling/confect-manifest/src/index.ts`
- Modify: `tooling/confect-manifest/src/index.test.ts`
- Modify: `packages/convex/confect/access/roles.ts`
- Modify: `packages/convex/confect/headless/auth.ts`

**Interfaces:**

```ts
export type AuthPolicy = {
  readonly id: `auth_${string}`;
  readonly credential:
    | "public"
    | "session"
    | "api-key"
    | "owner-token"
    | "webhook-signature"
    | "deny-all";
  readonly principalKind: "anonymous" | "user" | "apiKey" | "system";
  readonly tenantAuthority: "none" | "membership" | "principal-workspace";
  readonly minimumRole?: Role;
  readonly requiredScopes: readonly ApiKeyScope[];
};

export const authPolicies: Readonly<Record<AuthPolicy["id"], AuthPolicy>>;
export const authDenyAll: AuthPolicy;
export function compareAuthPolicyStrength(
  base: AuthPolicy,
  candidate: AuthPolicy,
): "same" | "stronger" | "weaker" | "incomparable";
```

- [ ] **Step 1: Write authority tests red.** Cover `PublicSurface` decoding,
      duplicate IDs, duplicate canonical authority keys, unknown policies,
      invalid role/scope literals, and auth changes that remove tenant
      authority, lower a role, remove a scope, or switch from a credential to
      public access.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/public-surface-authority.test.ts`

  Expected: FAIL because the public surface and policy modules do not exist.

- [ ] **Step 3: Add the shared technical type and actual policy registry.**
      Re-export existing `Role` and `ApiKeyScope` types; do not introduce string
      copies. Define policy entries next to the validators they describe,
      including `auth_deny_all`, current WorkOS/session membership, API-key
      scope, owner-token, Dodo/Postmark webhook, and signed unsubscribe
      mechanisms. A surface with no explicit policy receives `auth_deny_all`
      during generation.

- [ ] **Step 4: Extend Confect manifest entries without changing behavior.** Add
      stable surface registration metadata to `ContractFunctionManifest` while
      retaining its existing operation/schema fields. One operation reachable by
      UI session and API-key CLI emits two `PublicSurface` records because the
      transport/auth keys differ.

- [ ] **Step 5: Prove closed strength comparison.** The comparator handles only
      the finite canonical role/scope/credential sets. `incomparable` is treated
      as security review, never as safe. Add property tests for reflexivity and
      for scope/role removal never returning `same` or `stronger`.

- [ ] **Step 6: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/public-surface-authority.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/confect-manifest test`

  ```bash
  rtk git add packages/template-core/package.json packages/template-core/src/publicSurface.ts packages/template-core/src/index.ts packages/convex/confect/capabilities/_kit/authPolicies.ts packages/convex/confect/access/roles.ts packages/convex/confect/headless/auth.ts packages/convex/test/public-surface-authority.test.ts tooling/confect-manifest/src/index.ts tooling/confect-manifest/src/index.test.ts
  rtk git commit -m "feat: define public surface authority"
  ```

**Unlock:** Every generated exposure can name one real auth policy. No route or
operation is considered exhaustively inventoried yet.

---

### Task 4: Generate An Exhaustive Public-Entrypoint Inventory

**Class:** `template-gap`  
**PR:** `C3`  
**Depends on:** `C2`

**Files:**

- Create: `tooling/confect-manifest/src/publicSurfaceGeneration.ts`
- Create: `tooling/confect-manifest/src/publicSurfaceGeneration.test.ts`
- Generate:
  `packages/template-core/src/generated/public-surfaces.generated.json`
- Generate: `packages/template-core/src/generated/publicSurfaces.ts`
- Generate:
  `packages/template-core/src/generated/template-contracts-legacy-baseline.json`
- Modify: `packages/template-core/src/publicSurface.ts`
- Modify: `tooling/confect-manifest/src/generate.ts`
- Modify: `tooling/confect-manifest/src/check.ts`
- Modify: `tooling/confect-manifest/src/index.ts`
- Modify: `packages/template-core/package.json`
- Modify: `packages/convex/confect/http.ts`
- Modify: `apps/web/src/navigation/reference-app-routes.ts`
- Modify: `tooling/quality/check-system-topology.mts`
- Modify: `tooling/quality/check-system-topology.test.mts`
- Modify: `tooling/quality/check-headless-surface-contract.mts`
- Modify: `tooling/quality/check-headless-surface-contract.test.mts`

**Interfaces:**

```ts
export type DiscoveredPublicAuthority = PublicSurface["authority"] & {
  readonly transport: PublicSurface["transport"];
};

export function discoverPublicAuthorities(
  root: string,
): readonly DiscoveredPublicAuthority[];
export function generatePublicSurfaceInventory(input: {
  readonly discovered: readonly DiscoveredPublicAuthority[];
  readonly registered: readonly PublicSurface[];
}): { readonly surfaces: readonly PublicSurface[] };

export type ContractsLegacyBaseline = {
  readonly schemaVersion: 1;
  readonly capturedFromInventoryDigest: `sha256:${string}`;
  readonly surfaces: readonly {
    readonly id: string;
    readonly authorityKey: string;
  }[];
};
```

- [ ] **Step 1: Add failing discovery fixtures.** The test fixture contains a
      generated TanStack route, registered UI action, generated Confect
      operation, raw public Convex function, `httpRouter` route, command action
      discriminant, workflow/job trigger, webhook, CLI, API, and MCP exposure.
      For each mechanism, prove unregistered, duplicate, and one-way-only
      mappings fail.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/confect-manifest exec vitest run src/publicSurfaceGeneration.test.ts`

  Expected: FAIL because discovery/generation is absent.

- [ ] **Step 3: Replace manual Confect imports with deterministic discovery.**
      Recursively discover production `*.spec.ts` manifests, import them in
      sorted repository-relative order under `tsx`, merge their schema
      registries, and derive generated Convex ref locators. Delete the four
      hardcoded spec imports and `generatedRefModules` map from `generate.ts`.
      Duplicate operation IDs or missing refs remain fatal.

- [ ] **Step 4: Generate the bijection.** Parse the already generated route tree
      and Convex API declarations, import registered
      route/action/command/trigger metadata, and enumerate `httpRouter`
      registrations. Normalize each into the canonical authority key, compare
      both directions with registered `PublicSurface` records, sort by surface
      ID, then emit JSON and a typed TS projection from the same in-memory
      value. Normalize the existing Confect surface name `web` to the behavioral
      transport `ui` in this single generator; every other public transport
      keeps its canonical spelling. Confect `workflow`/`internal` are not public
      transports by themselves; only an externally registered trigger becomes a
      public entrypoint with its real transport and auth policy.

- [ ] **Step 5: Make raw bypasses red.** Extend system-topology and headless
      checks so a public Convex export, HTTP route, action discriminant, UI
      mutation adapter, command, trigger, webhook, API, CLI, or MCP registration
      missing from the generated inventory fails with its locator. Forbid
      customer UI mutation imports except through the registered action adapter;
      navigation remains a route surface.

- [ ] **Step 6: Freeze the template's one-time adoption baseline.** Before
      enforcing coverage over the already-shipping template, write its sorted,
      content-addressed current surface set to
      `template-contracts-legacy-baseline.json`. The gate compares every
      candidate with this frozen file and rejects growth or authority-key
      changes. Existing entries stay available and explicitly unadmitted; every
      surface introduced after this commit needs contract/auth provenance and
      darkness immediately. `F2` reduces the baseline to the generic platform
      entries and `D1`, after `C11b` and the pilot, deletes the empty file and
      enables full enforcement. Do not copy this migration baseline into a newly
      created customer app.

- [ ] **Step 7: Run generation and drift checks.**

  Run: `rtk pnpm confect:manifest`

  Run: `rtk pnpm check:confect-manifest`

  Run: `rtk pnpm check:system-topology`

  Run: `rtk pnpm check:headless-surface-contract`

  Run: `rtk pnpm check:route-tree`

  Run: `rtk pnpm check:convex`

  Expected: PASS; deleting any discovered registration from the generated
  inventory makes at least one check red. This task changes registration
  metadata, not route or Convex function shape, so both existing generated files
  remain byte-identical; if either check reports drift, stop and move the source
  shape change plus its real generator command into a dedicated PR.

- [ ] **Step 8: Commit generated and source authority together.**

  ```bash
  rtk git add tooling/confect-manifest packages/template-core/src/publicSurface.ts packages/template-core/src/generated packages/template-core/package.json packages/convex/confect/http.ts apps/web/src/navigation/reference-app-routes.ts tooling/quality/check-system-topology.mts tooling/quality/check-system-topology.test.mts tooling/quality/check-headless-surface-contract.mts tooling/quality/check-headless-surface-contract.test.mts
  rtk git commit -m "feat: generate exhaustive public surface inventory"
  ```

**Unlock:** Static checks know every public authority boundary. New actions
cannot hide inside a registered shared route.

---

### Task 5: Compile Lifecycle, Coverage, And Darkness

**Class:** `template-gap`  
**PR:** `C4`  
**Depends on:** `C3`

**Files:**

- Create: `tooling/acceptance/contract-inventory.ts`
- Create: `tooling/acceptance/contract-inventory.test.ts`
- Create: `packages/template-core/src/productContract.ts`
- Create: `packages/template-core/src/productContract.test.ts`
- Modify: `packages/template-core/package.json`
- Generate: `packages/template-core/src/generated/admittedJourneys.ts`
- Modify: `tooling/acceptance/check-contracts.mts`
- Modify: `tooling/acceptance/check-contracts.test.mts`
- Modify: `packages/convex/confect/capabilities/_kit/surfaces.ts`
- Create: `packages/convex/confect/capabilities/_kit/admissionGuard.ts`
- Create: `packages/convex/test/admission-guard.test.ts`
- Create: `apps/web/src/navigation/admitted-action.ts`
- Create: `apps/web/src/navigation/admitted-action.test.ts`
- Modify: `packages/convex/confect/ops/flags.impl.ts`
- Modify: `tooling/quality/check-auth-demo-bypass.mts`
- Modify: `tooling/quality/check-auth-demo-bypass.test.mts`
- Modify: `tooling/ci/protected-bootstrap.mts`
- Modify: `tooling/ci/protected-bootstrap.test.mts`

**Interfaces:**

```ts
export type ContractInventory = {
  readonly schemaVersion: 1;
  readonly sources: readonly ContractSource[];
  readonly pickles: readonly ExpectedPickle[];
  readonly admittedPickleKeys: readonly StablePickleKey[];
  readonly journeys: Readonly<Record<string, ContractLifecycle>>;
  readonly authPolicyDeltas: readonly {
    readonly surfaceId: string;
    readonly basePolicyId: `auth_${string}`;
    readonly candidatePolicyId: `auth_${string}`;
    readonly comparison: "weaker" | "incomparable";
  }[];
};

export function compileContractInventory(input: {
  readonly root: string;
  readonly protectedBaseSha: string;
  readonly mode: "authoritative" | "focused" | "static";
}): ContractInventory;

export function requireAdmittedSurface(
  surfaceId: string,
  emergencyDenied: boolean,
): void;
```

- [ ] **Step 1: Write lifecycle/tag/coverage tests red.** Cover one Feature per
      file; exact Feature-level journey/lifecycle tags; reserved-tag placement;
      transport and coverage inheritance; Outline rows; at least one Action and
      one Outcome per Pickle using the compiled official `PickleStep.type`, not
      raw AST `keywordType`. Test `When/And/But/Then/And/But` so conjunctions
      inherit ACTION or OUTCOME exactly; BOM, CRLF, path traversal/collision;
      duplicate journeys; unresolved assembling coverage intent; resolved
      admitted coverage; and the rule that an exhaustive UI+CLI inventory
      requires UI, CLI, and `@cross-surface` Pickles while a single-surface
      journey is valid only when inventory contains exactly one transport;
      per-entrypoint positive/authentication/authorization/tenant denial; and
      the closed transition matrix against an immutable protected-base fixture.
      In the same one compiler suite, cover Scenario, Rule, Background, Scenario
      Outline with two Examples blocks/multiple rows, interpolation, DataTable,
      DocString/media type, Unicode, tag inheritance, exact ordered step
      projections, and distinct stable keys for every example row.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/check-contracts.test.mts`

  Expected: FAIL because inventory/lifecycle compilation is missing.

- [ ] **Step 3: Compile with official Gherkin.** Use
      `generateMessages(bytes, uri, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, { includeSource: true, includeGherkinDocument: true, includePickles: true, newId: IdGenerator.incrementing() })`.
      Stable keys use raw source digest, normalized URI, Scenario/Outline
      location, and optional Examples-row location, encoded as canonical JSON
      before hashing; never store generated IDs or concatenate ambiguous raw
      strings. Stable step identity hashes canonical JSON containing the Pickle
      key, ordered index, official `PickleStep.type`, interpolated text, and
      complete DataTable/DocString projection. Put every ordered Pickle and step
      projection in `ContractInventory.pickles`; no later selector or verifier
      recompiles expected projections from keys alone. Put the byte-to-
      AST/Pickle pure compiler in the
      `@maestro-template/template-core/product-contract` subpath; repository
      file discovery, protected-base Git reads, surface policy, and projection
      writes remain in `tooling/acceptance/contract-inventory.ts`. Acceptance,
      Agent Pack, and factory CLI reuse that compiler rather than importing one
      another.

- [ ] **Step 4: Compare only with protected base.** Authoritative mode receives
      the base SHA from the protected controller, reads Features with
      `git show <base>:<path>`, and implements the exact closed transition
      matrix. Reject a candidate-provided SHA, `HEAD^`, absent-to-admitted,
      admitted deletion or demotion, suspended deletion, and admitted ID reuse.
      A focused run cannot produce an authoritative verdict. An assembling
      Feature with no admitted history may be deleted. Retirement removes every
      activation-owned surface only after suspension, while retaining the
      suspended Feature's journey ID and behavioral prose as its permanent
      tombstone. A suspended-to-admitted change joins the full authoritative
      selection and cannot reuse historical evidence.

- [ ] **Step 5: Enforce auth strength against protected base.** Diff the
      generated canonical surface/auth policies at `protectedBaseSha`. Any
      `weaker` or `incomparable` result is rejected unless the complete
      candidate is a dedicated auth-policy PR and the protected `W0` controller
      observes a current-head approval from the security CODEOWNER. Candidate
      input cannot assert that approval. Add mutations for public credential,
      removed tenant authority, lowered role, and removed scope; each must
      require the same external approval path.

- [ ] **Step 6: Generate and enforce darkness.** Emit a sorted const map to
      `admittedJourneys.ts`. UI route/action registration omits activation-owned
      entries unless the map is true. The server wrapper authenticates first,
      then calls `requireAdmittedSurface` before tenant authorization or
      business logic. Existing `featureFlagPolicies` is evaluated after
      generated admission and can only turn true to false. The existing
      `check-contracts.mts` command accepts `--write` solely to write byte-exact
      generated projections; without it, any drift is a failure.

- [ ] **Step 7: Prove bypass and zero-inventory behavior.** Direct raw Convex or
      HTTP invocation of an assembling operation fails before its handler. An
      inventory with zero admitted Pickles returns `no-admitted-contracts` only
      after every activation-owned non-admitted surface is proven dark; it does
      not invoke Cucumber or create an empty Messages file.

- [ ] **Step 8: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run packages/template-core/src/productContract.test.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/check-contracts.test.mts packages/convex/test/admission-guard.test.ts apps/web/src/navigation/admitted-action.test.ts`

  Run: `rtk pnpm acceptance:check`

  Run: `rtk pnpm check:auth-demo-bypass`

  ```bash
  rtk git add tooling/acceptance packages/template-core/src/productContract.ts packages/template-core/src/productContract.test.ts packages/template-core/src/generated/admittedJourneys.ts packages/template-core/package.json packages/convex/confect/capabilities/_kit/surfaces.ts packages/convex/confect/capabilities/_kit/admissionGuard.ts packages/convex/confect/ops/flags.impl.ts packages/convex/test/admission-guard.test.ts apps/web/src/navigation/admitted-action.ts apps/web/src/navigation/admitted-action.test.ts tooling/quality/check-auth-demo-bypass.mts tooling/quality/check-auth-demo-bypass.test.mts tooling/ci/protected-bootstrap.mts tooling/ci/protected-bootstrap.test.mts
  rtk git commit -m "feat: enforce contract lifecycle darkness"
  ```

**Unlock:** Assembling slices can merge safely. Admission still has no runtime
verdict and remains forbidden.

---

### Task 6: Unify Verified Principals And Repair Tenant Identity

**Class:** `pattern-instance`  
**PR:** `C5`  
**Depends on:** `C4`

**Files:**

- Modify: `packages/convex/confect/capabilities/_kit/principal.ts`
- Modify: `packages/convex/confect/capabilities/_kit/workspaceAccess.ts`
- Modify: `packages/convex/confect/access/tenancySchemas.ts`
- Modify: `packages/convex/confect/access/provisioning.ts`
- Modify: `packages/convex/confect/access/provisioning.impl.ts`
- Modify: `packages/convex/confect/access/handlerContext.ts`
- Modify: `packages/convex/confect/editor/sync.ts`
- Modify: `packages/convex/confect/tables/users.ts`
- Modify: `packages/convex/confect/headless/auth.ts`
- Modify: `packages/convex/confect/tables/apiKeys.ts`
- Modify generated: `packages/convex/confect/_generated/**`
- Modify generated: `packages/convex/convex/_generated/**`
- Modify: `packages/convex/confect/manifest/executor.ts`
- Modify: `packages/convex/confect/httpRequest.ts`
- Modify: `packages/convex/confect/http.ts`
- Create: `packages/convex/confect/capabilities/_kit/authorizedDispatch.ts`
- Create: `packages/convex/test/authorized-dispatch.test.ts`
- Modify: `packages/convex/test/headless-auth.test.ts`
- Modify: `packages/convex/test/headless-executor.test.ts`
- Modify: `packages/convex/test/http-docs.test.ts`
- Create:
  `docs/template/migrations/2026-08-03-token-identifier-and-api-principal.md`

**Interfaces:**

```ts
export type AnonymousPrincipal = {
  readonly kind: "anonymous";
  readonly surface: "web" | "api";
};

export type AuthorizedOperationRequest = {
  readonly surfaceId: string;
  readonly operationId: string;
  readonly principal: Principal;
  readonly input: Record<string, JsonValue>;
  readonly idempotencyKey?: string;
  readonly correlationNonce?: string;
};

export async function executeAuthorizedOperation(
  ctx: AuthorizedDispatchContext,
  request: AuthorizedOperationRequest,
): Promise<HeadlessExecutorResult>;

export async function authenticateApiKey(input: {
  readonly authorization: string | undefined;
  readonly policy: AuthPolicy;
  readonly nowMs: number;
  readonly loadByHash: (hash: string) => Promise<ApiKeyRow | null>;
}): Promise<ApiKeyPrincipal>;

export function principalSurfaceFor(
  transport: ContractTransport,
): "web" | "api" | "cli" | "mcp" | "webhook";
```

- [ ] **Step 1: Write red identity and dispatch tests.** Prove two issuers with
      the same subject resolve different users; bare-subject lookup is
      impossible; missing, unknown, revoked, expired, and under-scoped keys
      fail; inactive workspaces/memberships fail; caller workspace mismatch
      fails; and a valid session principal and API-key principal reach the same
      internal operation implementation.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/authorized-dispatch.test.ts test/headless-auth.test.ts test/headless-executor.test.ts`

  Expected: FAIL because dispatch is session-dependent and users are indexed by
  bare subject.

- [ ] **Step 3: Move user identity to issuer-bound authority.** Add required
      `tokenIdentifier` to new user rows and index `by_token_identifier`;
      document and test the deterministic backfill from trusted
      `(issuer, subject)` data. Update every `by_subject` consumer in
      provisioning, handler context, workspace access, and editor sync. Remove
      `by_subject` only after all callers and migration fixtures use the new
      index; authorization also rechecks active organization, workspace,
      membership, and API-key status.

- [ ] **Step 4: Complete API-key principal rows.** Persist principal kind/ID,
      workspace authority, scopes, expiry, status, and creator audit fields.
      Keep `by_key_hash`, hash the presented key once, compare without exposing
      the secret, and derive the entire principal from the row. Do not merge
      `workspaceSlug`, `workspaceId`, actor, or role from request JSON into it.

  Extend the existing `Principal` union with the small anonymous variant for
  genuinely public policies; protected operations reject it through their policy
  before tenant/business logic. Do not represent missing credentials as a fake
  user or system principal.

- [ ] **Step 5: Add one internal dispatch boundary.** Session public functions,
      HTTP, CLI, API, and MCP adapt verified identity into the existing
      `Principal` union and call `executeAuthorizedOperation`. The dispatcher
      resolves the generated surface/auth policy, authenticates, applies
      admission/emergency deny, derives tenant authority, checks role/scope,
      then invokes the existing query/mutation/action adapter. Session users
      derive workspace authority from active membership; API keys derive it from
      the key row. Public Confect refs that reread session auth are not used
      from API-key transports.

  Keep one explicit naming adapter: behavioral/public transport `ui` maps to the
  existing principal surface `web`; API/CLI/MCP map identically; add `webhook`
  only to the system-principal branch. Do not add another principal union or let
  a webhook become a user/API-key principal.

- [ ] **Step 6: Delete the demo tenant oracle.** Remove
      `demoWorkspaceIdsBySlug`, `workspaceSlugToId`, and the
      `acme-demo -> workspace_123` mapping from `httpRequest.ts`. A caller
      workspace field may be checked against the verified principal, never used
      to select authority.

- [ ] **Step 7: Run green and schema checks.**

  Run on a connected codegen worker: `rtk pnpm confect:codegen`

  Run on a connected codegen worker: `rtk pnpm convex:codegen`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/authorized-dispatch.test.ts test/headless-auth.test.ts test/headless-executor.test.ts test/http-docs.test.ts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:schema-migration-notes`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:generators`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:convex`

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add packages/convex/confect/capabilities/_kit/principal.ts packages/convex/confect/capabilities/_kit/workspaceAccess.ts packages/convex/confect/capabilities/_kit/authorizedDispatch.ts packages/convex/confect/access packages/convex/confect/editor/sync.ts packages/convex/confect/tables/users.ts packages/convex/confect/tables/apiKeys.ts packages/convex/confect/headless/auth.ts packages/convex/confect/manifest/executor.ts packages/convex/confect/httpRequest.ts packages/convex/confect/http.ts packages/convex/confect/_generated packages/convex/convex/_generated packages/convex/test docs/template/migrations/2026-08-03-token-identifier-and-api-principal.md
  rtk git commit -m "fix: authenticate every headless principal"
  ```

**Unlock:** Local issuer identities and real CLI API keys can be safe. The built
CLI still uses its old in-process capability path until `C6`.

---

### Task 7: Make Canonical CLI Capabilities Use Authenticated HTTP

**Class:** `fixture-to-real`  
**PR:** `C6`  
**Depends on:** `C5`

**Files:**

- Create: `apps/cli/src/httpCapabilityClient.ts`
- Create: `apps/cli/src/httpCapabilityClient.test.ts`
- Modify: `apps/cli/src/types.ts`
- Modify: `apps/cli/src/runtimeConfig.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/router.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `packages/convex/confect/http.ts`
- Modify: `packages/convex/test/http-docs.test.ts`

**Interfaces:**

```ts
export type CliRuntimeConfig = {
  readonly providerEnv: Record<string, string | undefined>;
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
};

export type CliCapabilityRunner = (
  capabilityId: string,
  request: CliCapabilityRequest,
) => Promise<CliResult>;

export function createHttpCapabilityRunner(input: {
  readonly config: CliRuntimeConfig;
  readonly fetch: typeof globalThis.fetch;
}): CliCapabilityRunner;

export async function dispatchCliCommandAsync(
  handlers: readonly CliCommandHandler[],
  argv: readonly string[],
  config: CliRuntimeConfig,
): Promise<CliResult>;
```

- [ ] **Step 1: Write red transport tests.** Prove a capability command performs
      a POST to the generated CLI operation route, sends a Bearer key only in
      the Authorization header, preserves input/idempotency/correlation data,
      maps structured 401/403/404/422 responses to stable nonzero CLI results,
      redacts credentials, and never calls `runTemplateApiOperation`.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/httpCapabilityClient.test.ts src/index.test.ts`

  Expected: FAIL because `runStaticCliCapability` imports the in-process
  workflow tool.

- [ ] **Step 3: Add the real generated CLI HTTP route.** For every inventory
      surface whose transport is `cli`, expose its generated route and resolve
      its exact surface ID before authentication. Route identity, not a caller
      header, selects the CLI policy. Feed the verified API-key principal into
      the internal dispatcher from `C5`.

- [ ] **Step 4: Make only execution async.** Keep schema/list/help/catalog
      projections local. Change capability execution and the top-level dispatch
      to promises, make `runCliAsync` canonical, and retain `runCli` temporarily
      only for pure local compatibility tests. Delete the workflow-tooling
      import and `runStaticCliCapability` from `index.ts`.

- [ ] **Step 5: Decode credentials from environment only.** Read
      `MAESTRO_API_BASE_URL` and `MAESTRO_API_KEY` in `decodeCliRuntimeConfig`.
      Neither flag is accepted by `parseNamedArgs`; help and errors never print
      the key. The acceptance driver supplies an exact sanitized child
      environment.

- [ ] **Step 6: Run green.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/httpCapabilityClient.test.ts src/index.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/http-docs.test.ts test/authorized-dispatch.test.ts`

- [ ] **Step 7: Commit.**

  ```bash
  rtk git add apps/cli/src/httpCapabilityClient.ts apps/cli/src/httpCapabilityClient.test.ts apps/cli/src/types.ts apps/cli/src/runtimeConfig.ts apps/cli/src/commands.ts apps/cli/src/router.ts apps/cli/src/index.ts apps/cli/src/index.test.ts packages/convex/confect/http.ts packages/convex/test/http-docs.test.ts
  rtk git commit -m "feat: execute cli capabilities over http"
  ```

**Unlock:** A CLI scenario can reach the same backend as the browser. The
in-process compatibility function is gone from capability execution, while the
pure local dispatcher remains until end-to-end proof is green.

---

### Task 8: Select Exact Sources And Pickles Without Recompiling

**Class:** `pattern-instance`

**PR:** `C7` **Depends on:** `C6`

**Files:**

- Modify: `tooling/acceptance/contract-inventory.ts`
- Modify: `tooling/acceptance/contract-inventory.test.ts`
- Modify: `tooling/acceptance/check-contracts.mts`
- Modify: `tooling/acceptance/check-contracts.test.mts`
- Create: `tooling/acceptance/selection-manifest.ts`
- Create: `tooling/acceptance/selection-manifest.test.ts`

**Interfaces:**

```ts
export function selectContracts(input: {
  readonly inventory: ContractInventory;
  readonly mode: "authoritative" | "focused";
  readonly journeyId?: `journey_${string}`;
}): SelectionManifest;
```

- [ ] **Step 1: Add red selection cases.** Consume the complete projections
      already produced in `C4`; assert the selector never calls Gherkin or
      reconstructs a step key. Authoritative mode must equal the complete
      admitted Pickle set. Focused mode must equal the named nonempty journey
      set. Reject unknown focus, empty focus, duplicate normalized path,
      traversal, and any supplied selector not derived from the inventory.
      Include a Feature with admitted and unselected scenarios.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/contract-inventory.test.ts tooling/acceptance/selection-manifest.test.ts`

  Expected: FAIL because exact selection does not exist.

- [ ] **Step 3: Select from the existing compiled inventory.** Filter and sort
      `ContractInventory.sources` and `.pickles` by lifecycle/journey without a
      second parse or compiler pass. Preserve the exact `C4` projections and
      stable keys byte-for-byte. A selector input is only mode plus optional
      journey ID; paths, tags, keys, and source bytes are outputs, never caller
      authority.

- [ ] **Step 4: Produce an exact manifest, not a tag query.** Sort Feature paths
      and stable Pickle keys. The protected launcher supplies those complete
      paths plus `--tags @admitted`; the verifier proves the resulting executed
      stable-key set equals the manifest through `TestCase.pickleId`. Cucumber
      may emit unselected Pickle envelopes from a loaded Feature; they are valid
      source inventory but cannot have an executed TestCase. Add a mixed Feature
      fixture containing admitted and unselected scenarios. Shared config cannot
      add paths/tags/name/shard/order.

- [ ] **Step 5: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/contract-inventory.test.ts tooling/acceptance/selection-manifest.test.ts tooling/acceptance/check-contracts.test.mts`

  Run: `rtk pnpm acceptance:check`

  ```bash
  rtk git add tooling/acceptance/contract-inventory.ts tooling/acceptance/contract-inventory.test.ts tooling/acceptance/check-contracts.mts tooling/acceptance/check-contracts.test.mts tooling/acceptance/selection-manifest.ts tooling/acceptance/selection-manifest.test.ts
  rtk git commit -m "feat: select exact cucumber contract inventory"
  ```

**Unlock:** The controller can know exactly what must execute before invoking
Cucumber.

---

### Task 9: Verify Strict Cucumber Messages Linkage

**Class:** `template-gap`  
**PR:** `C8`  
**Depends on:** `C7`

**Files:**

- Create: `tooling/acceptance/verify-messages.mts`
- Create: `tooling/acceptance/verify-messages.test.mts`
- Create: `tooling/acceptance/fixtures/messages/passing.feature`
- Create: `tooling/acceptance/fixtures/messages/passing.ndjson`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

```ts
export type MessagesVerificationInput = {
  readonly expected: ContractInventory;
  readonly selection: SelectionManifest;
  readonly runtime: RuntimeManifest;
  readonly ciTuple?: {
    readonly repository: string;
    readonly baseRef: string;
    readonly baseOid: string;
    readonly headOid: string;
    readonly mergeGroupOid: string;
  };
  readonly ndjson: string;
};

export type MessagesVerdict =
  | {
      readonly ok: true;
      readonly executedPickleKeys: readonly StablePickleKey[];
    }
  | { readonly ok: false; readonly findings: readonly string[] };

export function verifyMessages(
  input: MessagesVerificationInput,
): MessagesVerdict;
```

- [ ] **Step 1: Check in one genuine passing stream.** Generate `passing.ndjson`
      once with pinned `cucumber-js` from `passing.feature`, review it, and keep
      it as protocol compatibility input. Its Source bytes must exactly equal
      the committed Feature.

- [ ] **Step 2: Write table-driven red mutations.** Starting from the passing
      stream, independently test `{}`, unknown payload, two payloads, invalid
      JSON, schema-invalid nested IDs/arrays/enums, blank-only stream, truncated
      final line, duplicate/missing meta, incompatible protocol,
      missing/duplicate/cross-document AST IDs, wrong Outline row,
      missing/substituted/duplicate PickleStep, invalid TestCase linkage,
      zero/multiple/unresolved StepDefinition links, unresolved Hook links,
      missing/duplicate emitted Before/After/BeforeAll/AfterAll hooks,
      missing/duplicate BeforeStep or AfterStep attachment markers, orphan
      started/finished events, attempt > 0, `willBeRetried`, every non-PASSED
      status, failed run hook, unsuccessful/missing run finish, duplicate
      Pickle, wrong Source bytes/URI, mixed selected/unselected Pickles, and
      zero/wrong selection. Swap or replay an otherwise valid attachment across
      TestCaseStarted/TestStep/run IDs; each must fail its exact linkage.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts`

  Expected: FAIL because the verifier does not exist.

- [ ] **Step 4: Validate the bundled schema before using `parseEnvelope`.** Add
      the already-locked `ajv@8.18.0` as a direct root development dependency
      and compile the pinned `@cucumber/messages/schema` with strict mode. For
      each nonblank line, parse raw JSON, require full schema validity plus an
      object with exactly one known Envelope payload key and no unknown own key,
      then call official `parseEnvelope` (which is only JSON parsing). Index
      Sources, GherkinDocuments, Pickles, PickleSteps, StepDefinitions, Hooks,
      TestCases, TestCaseStarted, step events, run-hook events, attachments, and
      run boundaries by runtime ID. Reject duplicates and unresolved links at
      index time.

- [ ] **Step 5: Re-derive stable identity from runtime AST.** Follow Source ->
      GherkinDocument -> Pickle -> Scenario/Outline and Examples row, compare
      exact source bytes and normalized URI, and re-create stable identities for
      all emitted source Pickles. Derive the executed set only through
      `TestCase.pickleId`; require exact equality with `SelectionManifest`, no
      TestCase for an unselected Pickle, one TestCase and one attempt-zero
      TestCaseStarted per selected Pickle, one test step per selected
      PickleStep, exactly one unique StepDefinition plus aligned match arguments
      for every Pickle-backed test step, and exactly one Hook for each hook-
      backed test step. Use official Hook, TestCase, TestRunHook,
      TestStepStarted/Finished, and TestRunStarted/Finished envelopes to require
      ordinary Before/After and run hooks to start and finish once with PASSED
      status; do not maintain a second lowercase hook inventory.

- [ ] **Step 6: Validate the closed observation envelope.** Require exactly one
      attachment whose `testCaseStartedId` resolves to the selected
      TestCaseStarted -> TestCase -> Pickle chain, whose `testStepId` is that
      TestCase's unique passing protected After hook, and whose
      `testRunStartedId` matches the one pinned-v34 run. Require the declared
      schema version, stable Pickle key, checkout and artifact identities, all
      three independently observed backend identities, scenario nonce,
      Action/Outcome step keys, exact BeforeStep/AfterStep markers for every
      expected step, server correlations, and observed surface/transport pairs.
      Reject swapped/replayed attachments, empty fields, and extra fields. The
      committed protocol fixture carries reviewed synthetic values matching its
      `RuntimeManifest`; `C9` replaces the fixture producer with trusted real
      drivers.

- [ ] **Step 7: Add the command and run green protocol tests.** Add
      `acceptance:verify-messages` as a direct verifier command used by the
      protected runner, not as a separate status badge.

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/verify-messages.test.mts`

  Run: `rtk pnpm acceptance:verify-messages -- --help`

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add tooling/acceptance/verify-messages.mts tooling/acceptance/verify-messages.test.mts tooling/acceptance/fixtures/messages package.json pnpm-lock.yaml Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "feat: verify exact cucumber messages"
  ```

**Unlock:** Cucumber execution can be proven complete at the protocol level;
real action/outcome and runtime identity observations remain required.

---

### Task 10: Add Trusted Driver Observations And Runtime Identity

**Class:** `template-gap`  
**PR:** `C9`  
**Depends on:** `C8`

**Files:**

- Create: `features/support/observations.ts`
- Create: `tooling/acceptance/observations.test.ts`
- Create: `features/support/world.ts`
- Create: `features/support/hooks.ts`
- Create: `features/support/browser-driver.ts`
- Create: `features/support/cli-driver.ts`
- Create: `features/support/runtime-identity.ts`
- Create: `tooling/acceptance/runtime-identity.test.ts`
- Create: `apps/web/src/adapters/build-identity.ts`
- Create: `apps/web/src/adapters/build-identity.test.ts`
- Modify: `apps/web/vite.config.ts`
- Create: `apps/cli/build-executable.mts`
- Modify: `apps/cli/package.json`
- Modify: `apps/cli/src/commands.ts`
- Create: `apps/cli/src/commands.test.ts`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/convex/confect/capabilities/_kit/authorizedDispatch.ts`
- Modify: `packages/convex/test/authorized-dispatch.test.ts`
- Create: `packages/convex/confect/runtime/identity.ts`
- Create: `packages/convex/confect/runtime/identity.spec.ts`
- Create: `packages/convex/confect/runtime/identity.impl.ts`
- Modify generated: `packages/convex/confect/_generated/**`
- Modify generated: `packages/convex/convex/_generated/**`
- Modify: `packages/convex/confect/http.ts`
- Create: `packages/convex/test/runtime-identity.test.ts`
- Modify: `tooling/acceptance/verify-messages.mts`
- Modify: `tooling/acceptance/verify-messages.test.mts`

**Interfaces:**

```ts
export class ContractWorld extends World<ContractWorldParameters> {
  readonly observations: ScenarioObservations;
  currentStepKey: string | undefined;
}
```

- [ ] **Step 1: Write red observation tests.** Prove no public `markCovered`
      function exists; a driver cannot record before performing its injected
      action/assertion; observations are bound to the current stable step key;
      passing Action/Outcome steps without the matching kind fail in
      `AfterStep`; observations cannot be attributed to a previous step; and
      each scenario emits exactly one redacted attachment from its unique
      passing protected After hook. Omitting or duplicating any per-step
      BeforeStep/AfterStep marker fails; ordinary scenario/run hook execution is
      proved from official Messages rather than custom counters.

- [ ] **Step 2: Write red identity tests.** Prove the web and CLI expose their
      compile-time source SHA, the backend generates its own per-start nonce and
      reports deployment/input identity, and no identity endpoint accepts an
      expected SHA, deployment ID, nonce, digest, or timestamp from the caller.
      Build one CLI executable bundle, hide source/workspace `node_modules`, and
      prove plain Node still runs it with the compiled SHA unchanged even when
      the runtime SHA environment is altered. Make web, CLI, and controller
      independently observe backend deployment/input/start-nonce values; point
      either surface at a second backend and require a mismatch.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/observations.test.ts tooling/acceptance/runtime-identity.test.ts apps/web/src/adapters/build-identity.test.ts packages/convex/test/runtime-identity.test.ts`

  Expected: FAIL because trusted drivers and identity surfaces are absent.

- [ ] **Step 4: Implement one scenario observation set.** Browser methods use
      Playwright accessible roles/labels/text and record only after the
      interaction or actor-visible assertion resolves. CLI methods spawn the
      built executable with `child_process`, an exact environment, no shell, and
      credentials outside argv; they record only after exit/output assertions
      resolve. Surface methods add the exact `(surfaceId, transport)`. There is
      no page-object hierarchy or generic step DSL.

- [ ] **Step 5: Bind hooks to expected steps.** `Before` allocates scenario
      adapters/nonce; `BeforeStep` resolves the current runtime PickleStep to
      the precompiled stable step key; `AfterStep` requires the Action/Outcome
      observation after a passing step and clears the binding; `After` revokes
      scenario handles, closes its browser context, and attaches one JSON
      envelope. The attachment records exact BeforeStep/AfterStep key lists;
      these hooks have no separate Messages events in Cucumber 13. Global hooks
      perform checks only and never own long-lived processes. Do not import a
      hook-registration module for inventory; Cucumber's Hook/TestRunHook
      envelopes are the ordinary-hook inventory.

- [ ] **Step 6: Build isolated artifacts and server-owned identity.** Vite
      compiles source/component identity into the web build. Reuse the already-
      locked `esbuild@0.28.1` as a direct CLI development dependency;
      `build-executable.mts` bundles `apps/cli/src/index.ts` and every workspace
      dependency into one Node 22 ESM executable, injects the protected checkout
      SHA as a compile-time define, writes `apps/cli/dist/maestro.mjs`, and
      emits `apps/cli/dist/maestro.meta.json` proving no runtime
      source/workspace import remains. The CLI `identity` command prints that
      compiled identity and its independently authenticated backend identity;
      the backend creates its start nonce inside the runtime and returns
      deployment/input identity. Hash the bundle plus its reviewed metafile as
      the complete CLI runtime closure, then execute it with source and
      workspace dependencies inaccessible. Controller artifact hashes remain
      independently computed and are not self-reported.

- [ ] **Step 7: Add transient trusted server correlation.** Extend the one
      authorized dispatcher from `C5`, not each product handler. When an
      authenticated admitted operation succeeds, append a bounded in-memory
      acceptance-only record containing the controller-minted scenario and
      per-step correlation nonces, server-derived principal digest, surface,
      transport, and the backend's own runtime identity. The controller maps the
      unguessable per-step nonce back to the stable step key; candidate request
      JSON cannot name that key. The protected controller reads and clears those
      records through its private local control path after each scenario; no
      production route or durable receipt table is added. Require every Action
      observation to have exactly one matching server record. Test hardcoded/
      optimistic UI and CLI output, a dropped record, a replayed nonce, wrong
      actor/surface, and an operation sent to a second backend.

- [ ] **Step 8: Close verifier observation equality.** Require every expected
      Action and Outcome step key, every declared surface/transport pair, no
      unknown or non-admitted incidental surface, distinct web/CLI artifact
      hashes, equal source SHA, exact web-observed, CLI-observed, and
      controller- observed backend identity equality with `RuntimeManifest`, and
      exact Action/server-correlation equality. Reject cookie, token, key,
      private- key, Authorization, or raw-customer fields.

- [ ] **Step 9: Run green and commit.**

  Run on a connected codegen worker: `rtk pnpm confect:codegen`

  Run on a connected codegen worker: `rtk pnpm convex:codegen`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/observations.test.ts tooling/acceptance/runtime-identity.test.ts apps/web/src/adapters/build-identity.test.ts apps/cli/src/commands.test.ts packages/convex/test/runtime-identity.test.ts tooling/acceptance/verify-messages.test.mts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:convex`

  ```bash
  rtk git add features/support tooling/acceptance/observations.test.ts tooling/acceptance/runtime-identity.test.ts apps/web/src/adapters/build-identity.ts apps/web/src/adapters/build-identity.test.ts apps/web/vite.config.ts apps/cli/build-executable.mts apps/cli/package.json apps/cli/src/commands.ts apps/cli/src/commands.test.ts pnpm-lock.yaml packages/convex/confect/capabilities/_kit/authorizedDispatch.ts packages/convex/confect/runtime packages/convex/confect/http.ts packages/convex/confect/_generated packages/convex/convex/_generated packages/convex/test/authorized-dispatch.test.ts packages/convex/test/runtime-identity.test.ts tooling/acceptance/verify-messages.mts tooling/acceptance/verify-messages.test.mts
  rtk git commit -m "feat: observe real contract interactions"
  ```

**Unlock:** Approved steps can prove they crossed real driver boundaries and
agree on runtime identity. Process and trust isolation is still absent.

---

### Task 11: Build The Secretless Protected Acceptance Controller

**Class:** `template-gap`  
**PR:** `C10`  
**Depends on:** `C9`

**Files:**

- Create: `tooling/acceptance/run-acceptance.mts`
- Create: `tooling/acceptance/run-acceptance.test.mts`
- Create: `tooling/acceptance/sandbox.ts`
- Create: `tooling/acceptance/sandbox.test.ts`
- Create: `tooling/acceptance/runtime-target.ts`
- Create: `tooling/acceptance/runtime-target.test.ts`
- Create: `tooling/acceptance/runtime-target.template.json`
- Create: `features/support/local-auth.ts`
- Create: `tooling/acceptance/local-auth.test.ts`
- Create: `tooling/acceptance/controller.Dockerfile`
- Modify: `tooling/agent-pack/src/processSupervisor.ts`
- Modify: `tooling/agent-pack/src/processSupervisor.test.ts`
- Create: `apps/web/src/providers/auth-runtime.tsx`
- Create: `apps/web/src/providers/auth-runtime.acceptance.tsx`
- Modify: `apps/web/src/routes/__root.tsx`
- Modify: `apps/web/vite.config.ts`
- Create: `packages/convex/convex/auth.acceptance.config.ts`
- Modify: `tooling/quality/check-auth-demo-bypass.mts`
- Modify: `tooling/quality/check-auth-demo-bypass.test.mts`
- Modify: `tooling/quality/check-env-boundary.mts`
- Modify: `tooling/quality/check-env-boundary.test.mts`
- Modify: `package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interfaces:**

```ts
export type ProcessEnvironmentProjection = {
  readonly base: "inherit" | "empty";
  readonly remove: readonly string[];
  readonly set: Readonly<Record<string, string>>;
};

export type AcceptanceRunRequest = {
  readonly mode: "authoritative" | "focused";
  readonly repositoryRoot: string;
  readonly runtimeTarget: RuntimeTargetManifest;
  readonly protectedBaseSha?: string;
  readonly ciTuple?: MessagesVerificationInput["ciTuple"];
  readonly focusedJourneyId?: `journey_${string}`;
};

export type AcceptanceRunResult =
  | { readonly ok: true; readonly kind: "verified" | "no-admitted-contracts" }
  | { readonly ok: false; readonly findings: readonly string[] };

export type RuntimeTargetManifest = {
  readonly schemaVersion: 1;
  readonly targetKind: "generated-template" | "unmanaged-existing-repository";
  readonly web: {
    readonly packageDir: string;
    readonly buildScript: "build";
    readonly artifactDir: string;
  };
  readonly cli: {
    readonly packageDir: string;
    readonly buildScript: "build:executable" | "build";
    readonly executable: string;
  };
  readonly backend: { readonly packageDir: string };
};

export async function runAcceptance(
  request: AcceptanceRunRequest,
): Promise<AcceptanceRunResult>;

export function acceptanceExitCode(result: AcceptanceRunResult): 0 | 1;
```

- [ ] **Step 1: Write red supervisor/environment tests.** Add an empty-base
      projection test that asserts exact key equality, not a denylist. Prove
      process groups, readiness, first-child failure, SIGINT/SIGTERM forwarding,
      timeout, and idempotent cleanup still work. Add an awaited
      `whileReady(signal)` body: race it against child exit and user signal,
      return its value only after formatter closure, then terminate and await
      all services. A body failure/signal is red, and cleanup failure overrides
      an otherwise successful body. Preserve `base: "inherit"` and the existing
      wait-for-child behavior for callers that omit `whileReady`; acceptance
      always selects `empty` and supplies the awaited body.

- [ ] **Step 2: Write red sandbox canaries.** In a disposable fixture, prove a
      candidate cannot read representative GitHub/BWS/provider canaries, host
      home, SSH agent, Docker/control sockets, cloud metadata, controller
      Messages/run manifest, or writable trusted tools; cannot shadow PATH;
      cannot write source or launched artifacts; cannot signal/ptrace controller
      processes; and cannot open an outbound runtime socket. Prove loopback
      between approved runtime peers remains available and
      CPU/memory/storage/PID/wall limits terminate the candidate. Add a hostile
      `.pnpmfile.cjs` that attempts environment/file/socket access, a lockfile
      with a non-allowlisted registry/tarball origin, redirects and DNS
      rebinding attempts, an oversized dependency response, and a package
      archive with traversal/symlink/device entries. Prove resolution/fetch
      fails closed or remains contained before any candidate build starts.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/agent-pack/src/processSupervisor.test.ts tooling/acceptance/sandbox.test.ts tooling/acceptance/runtime-target.test.ts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/local-auth.test.ts`

  Expected: FAIL because exact empty environment, isolation, and controller are
  absent.

- [ ] **Step 4: Extend existing supervision and add the minimal sandbox.** Use
      the existing spawner/readiness/signal/cleanup code. On Linux, the pinned
      controller image invokes Bubblewrap with separate user/PID/mount/network
      namespaces, read-only candidate source, bounded writable temp locations,
      and no controller mount. Treat resolution as candidate execution:
      `.pnpmfile.cjs` and `pnpm fetch --frozen-lockfile --ignore-scripts` run
      inside that empty-environment, resource-limited build sandbox, never in
      the status controller. Give fetch no controller mounts/sockets and only a
      controller-owned dependency proxy whose protected configuration permits
      HTTPS to the exact registry origins approved on protected main, rejects
      candidate credentials, redirects, IP literals, private/link-local
      addresses, and response overflow, and records content digests. Candidate
      install/build then runs offline in the same sandbox. Validate the
      controller-supplied `RuntimeTargetManifest` with exact keys, relative
      non-traversing paths, and the two allowed CLI build-script names; the
      candidate cannot supply command strings. Copy only regular files from its
      declared web, self-contained CLI executable, and backend outputs, reject
      traversal/symlinks/devices, hash them, make the runtime copy read-only,
      then launch all candidate runtime peers in one fresh private network
      namespace with only loopback. A controller-owned fixed-port proxy joins
      only that network namespace (not its mount/PID namespaces) and exposes
      approved web/backend ports through controller-only Unix sockets; Cucumber
      and Playwright use that proxy. The candidate cannot see either proxy
      control socket or gain another outbound route.

  `runtime-target.template.json` is exact: generated-template; web package
  `apps/web`, build `build`, artifact `apps/web/dist`; CLI package `apps/cli`,
  build `build:executable`, executable `apps/cli/dist/maestro.mjs`; backend
  package `packages/convex`.

- [ ] **Step 5: Add the local issuer and private fixture control.** Use Node
      `crypto` to create an RSA key pair and Node `http` to serve loopback JWKS.
      Mint short-lived issuer/audience/signature/expiry-validated tokens for
      synthetic actors. The private key and internal Convex bootstrap stay in
      the controller. Create users, workspaces, memberships, legitimate Given
      records, and expiring API keys only through local admin/internal
      invocation; expose no public bootstrap route.

- [ ] **Step 6: Keep acceptance auth out of production.** The controller
      overlays the protected `auth.acceptance.config.ts` only into the hashed
      local backend input. Vite aliases the production and acceptance auth
      adapters by explicit build mode. Extend build-graph and bundle-marker
      gates to prove production entrypoints cannot import/select the loopback
      issuer, synthetic token adapter, or bootstrap code. The normal root uses
      the production AuthKit-to- `ConvexProviderWithAuth` path, not
      `fakeInitialAuth`. Apply the same production import/bundle prohibition to
      transient correlation storage and its private controller read/clear path.

- [ ] **Step 7: Orchestrate the authoritative sequence.** Verify checkout SHA
      equals `mergeGroupOid`; compile inventory/selection; handle the explicit
      zero case; fetch; sandbox install/build; copy/hash; start one local
      Convex, built web preview, and built CLI; await web/CLI/Confect/backend
      identity probes. Materialize a fresh controller- owned run root containing
      the protected-base `cucumber.cjs`, support, and step-definition files;
      overlay only selected candidate `.feature` bytes at identical
      repository-relative paths. Set that root as Cucumber `cwd`, use its config
      without CLI `--require`/`--import`, pass `--tags @admitted` and
      `--format message:<controller path>`, and add a canary proving candidate
      support code is never evaluated. Run Cucumber inside the supervisor's
      awaited `whileReady(signal)` body while services remain alive. After its
      formatter closes, require a normal code-zero exit, verify Messages/runtime
      manifest, then terminate services; cleanup failure is final failure. A
      valid passing Messages stream paired with exit 1 or a signal is failure. A
      proposed control-plane delta runs only in a separately labeled observation
      pass. Never use a candidate-owned command string to post status.

- [ ] **Step 8: Add the three public developer commands.** Add
      `acceptance:focus`, `acceptance`, and the existing `acceptance:check` to
      root scripts/Justfile/gate definitions. `acceptance:focus --journey <id>`
      records a non-authoritative local checkout and must select a nonempty
      journey. Root `verify` invokes authoritative acceptance through the
      protected launcher in CI and the local alias outside CI; no new completion
      badge is created. The executable entry point awaits `runAcceptance`, maps
      only `verified` and the explicitly permitted static
      `no-admitted-contracts` result to exit `0`, maps every red result, signal,
      Cucumber/verifier exception, and cleanup failure to nonzero
      `process.exitCode`, and catches top-level rejection.

- [ ] **Step 9: Run green unit and observation-mode canaries.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/agent-pack/src/processSupervisor.test.ts tooling/acceptance/sandbox.test.ts tooling/acceptance/runtime-target.test.ts tooling/acceptance/run-acceptance.test.mts tooling/acceptance/local-auth.test.ts tooling/quality/check-auth-demo-bypass.test.mts tooling/quality/check-env-boundary.test.mts`

  The controller tests include passing NDJSON with Cucumber exit `1`, signal
  termination, formatter-stream failure, verifier failure, cleanup failure, and
  candidate-support evaluation. Spawn the real command for each case and require
  a nonzero OS exit; do not only call `runAcceptance`. Spawn verified and static
  zero-inventory cases and require exit `0`.

  Run inside the actual Woodpecker agent in non-required observation mode:
  `rtk pnpm acceptance -- --sandbox-canary`

  Expected: unit tests PASS. The canary must prove every boundary; if the agent
  kernel rejects user/mount/network namespace enforcement, keep acceptance
  non-authoritative and block `W1` until the protected agent/image is corrected.

- [ ] **Step 10: Commit without cutting over CI authority.**

  ```bash
  rtk git add tooling/acceptance features/support/local-auth.ts tooling/agent-pack/src/processSupervisor.ts tooling/agent-pack/src/processSupervisor.test.ts apps/web/src/providers apps/web/src/routes/__root.tsx apps/web/vite.config.ts packages/convex/convex/auth.acceptance.config.ts tooling/quality/check-auth-demo-bypass.mts tooling/quality/check-auth-demo-bypass.test.mts tooling/quality/check-env-boundary.mts tooling/quality/check-env-boundary.test.mts package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "feat: isolate secretless contract acceptance"
  ```

**Unlock:** The candidate cannot forge Messages/runtime evidence or reach
secrets/status state. Required-status cutover still waits for the real product
fixture and mutations.

---

### Task 12: Assemble A Generated Reference Product Through UI And CLI

**Class:** `fixture-to-real`  
**PR:** `C11a`

**Depends on:** `C10`

**Files:**

- Create:
  `tooling/acceptance/fixtures/reference-app/features/template_records.feature`
- Create:
  `tooling/acceptance/fixtures/reference-app/features/step_definitions/template_records.steps.ts`
- Create: `features/platform_access.feature`
- Create: `features/step_definitions/platform_access.steps.ts`
- Create: `tooling/acceptance/reference-app.ts`
- Create: `tooling/acceptance/reference-app.test.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify:
  `examples/saas-application/seed/source/packages/convex/confect/records.spec.ts`
- Modify:
  `examples/saas-application/seed/source/packages/convex/confect/records.impl.ts`
- Modify:
  `examples/saas-application/seed/source/apps/web/src/features/records/records-surface.tsx`
- Modify: `apps/cli/src/factory/candidateComposition.test.ts`
- Modify: `apps/cli/src/factory/customerCliRuntime.test.ts`

**Contract:** The disposable fixture Feature uses
`@journey_template_records @admitted` only inside the explicitly
non-authoritative factory target and contains these observable scenarios:

- authorized UI create/read;
- authorized external CLI create/list;
- UI create followed by CLI read in one cross-surface scenario;
- signed-out UI denial;
- read-only UI denial without mutation;
- missing CLI key denial;
- read-only CLI scope denial;
- foreign-workspace CLI denial with no foreign data;
- matching web/CLI/backend runtime identity.

The repository also adds one `@journey_platform_access @assembling` Feature for
behavior genuinely present in every normal output: the public shell loads, the
local CLI describes the same template, the built UI/CLI identity agrees with one
backend, and signed-out access to a protected platform route is denied. Its
coverage tags name only those generic platform surfaces; it contains no records
or customer-domain prose.

- [ ] **Step 1: Write the fixture and assembling platform Feature first.** Keep
      prose actor/outcome-focused and use generated surface tags. Overlay the
      admitted records Feature and its steps only into a disposable
      non-authoritative factory target; do not add that domain journey to normal
      output. Check in the normal platform Feature as assembling with its real
      steps. The first fixture step-definition file contains only `export {};`,
      so every disposable Feature step is intentionally undefined for the red
      run. No repository Feature transitions from absent to admitted.

- [ ] **Step 2: Add the failing generated-app integration test.** Generate a
      fresh app through the real release adapter, overlay the CODEOWNED fixture,
      configure real local Convex, and invoke `runAcceptance` in `focused` mode
      with the fixture's reviewed `RuntimeTargetManifest` and no CI tuple/status
      capability. Assert that focused mode cannot post status or relax the
      repository lifecycle compiler. Preserve the existing green UI create/read
      assertion. Replace the placeholder with thin domain steps that reuse only
      the trusted browser, CLI, local-auth, and fixture-control drivers; do not
      import React components, handlers, `runCliAsync`, operation
      implementations, or database readers for a Then assertion. Assert that
      external CLI create/list and UI-to-CLI visibility are red before product
      repair.

- [ ] **Step 3: Run the focused integration red locally before repair.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/reference-app.test.ts`

  Expected: FAIL only on the absent authenticated external CLI and cross-surface
  visibility. Existing configured-Convex UI persistence remains green.

- [ ] **Step 4: Repair only the missing boundaries.** Preserve the existing
      configured-Convex UI create/read path, route its Save control through the
      registered UI-action boundary, and expose the same real Confect operations
      through authenticated CLI HTTP. Remove fixture state as an outcome oracle.
      Given setup may create tenants/memberships/API keys and explicitly named
      starting records, but never the record promised by When.

- [ ] **Step 5: Run the complete fixture green and verify cleanup.**

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts`

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm --dir apps/cli test:customer-cli-runtime`

  Expected: every Pickle passes exactly once, the strict verifier passes, all
  keys/fixture data/browser contexts/process groups are removed, and the normal
  generated app contains no `journey_template_records` Feature.

- [ ] **Step 6: Commit.**

  ```bash
  rtk git add features/platform_access.feature features/step_definitions/platform_access.steps.ts tooling/acceptance/fixtures/reference-app tooling/acceptance/reference-app.ts tooling/acceptance/reference-app.test.ts tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.test.ts examples/saas-application/seed/source/packages/convex/confect/records.spec.ts examples/saas-application/seed/source/packages/convex/confect/records.impl.ts examples/saas-application/seed/source/apps/web/src/features/records/records-surface.tsx apps/cli/src/factory/candidateComposition.test.ts apps/cli/src/factory/customerCliRuntime.test.ts
  rtk git commit -m "test: prove generated ui and cli product contract"
  ```

**Unlock:** The harness has one real generated-app success path. It cannot
become required authority until every listed false-green mutation turns red; the
repository platform Feature remains assembling.

---

### Task 13: Close Every Harness False-Green Mutation

**Class:** `fixture-to-real`  
**PR:** `C12`  
**Depends on:** `C11a`

**Files:**

- Create: `tooling/acceptance/mutation-gauntlet.mts`
- Create: `tooling/acceptance/mutation-gauntlet.test.mts`
- Modify: `tooling/ci/mutation.sh`
- Modify: `package.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`

**Interface:**

```ts
export type ContractMutation = {
  readonly id: string;
  readonly apply: (fixtureRoot: string) => Promise<void>;
  readonly expectedFinding: RegExp;
};

export const contractMutations: readonly ContractMutation[];
export async function runContractMutationGauntlet(input: {
  readonly pristineFixtureRoot: string;
  readonly run: (mutatedRoot: string) => Promise<AcceptanceRunResult>;
}): Promise<void>;
```

- [ ] **Step 1: Write a red completeness test.** Assert the mutation registry
      has exactly 33 unique core cases, one for every row below, and that each
      case operates on a fresh copy of the last known-green generated fixture.
      `R1` and `W1` append the three CI/release cases once those authorities
      exist; `P1` and `D2` require the complete 36-case registry before sealing
      either release.

| Mutation                                          | Required red authority         |
| ------------------------------------------------- | ------------------------------ |
| Disconnect Save handler                           | UI Pickle                      |
| Replace Action or Outcome UI step with no-op      | driver observation             |
| Replace Action or Outcome CLI step with no-op     | driver observation             |
| Add action discriminant inside shared route       | public inventory               |
| Generate surface without journey/auth provenance  | generator/provenance           |
| Restore in-process `FeatureDisabled` CLI path     | CLI Pickle                     |
| Dispatch API key through session-only public ref  | positive CLI auth              |
| Point CLI at a second backend                     | cross-surface/runtime identity |
| Trust caller workspace                            | tenant-isolation Pickle        |
| Call assembling operation through raw public path | server admission guard         |
| Select no expected Pickles                        | selection equality             |
| Omit one Outline row                              | Pickle equality                |
| Link Outline to wrong row/document                | AST integrity                  |
| Omit/substitute PickleStep or TestCase mapping    | step linkage                   |
| Supply empty/multi-payload/truncated Envelope     | strict protocol                |
| Fail `AfterAll` or run success                    | run boundary                   |
| Echo caller expected SHA from backend             | server identity                |
| Add Cucumber selector/key or retry/parallel       | config validator               |
| Compare lifecycle against `HEAD^`                 | protected-base transition      |
| Add admitted Feature absent from base             | closed transition              |
| Weaken tenant/role/scope metadata                 | auth strength comparison       |
| Inject representative secret canary               | exact environment              |
| Shadow trusted tool                               | sandbox mount/PATH             |
| Open outbound runtime socket                      | network namespace              |
| Candidate overwrites Messages/run manifest        | namespace ownership            |
| Load candidate support code in controller         | controller-owned Cucumber root |
| Make CLI bundle import hidden workspace source    | CLI artifact closure           |
| Hardcode UI/CLI success without backend operation | server correlation             |
| Drop the matching server correlation              | correlation equality           |
| Replay correlation/attachment from another run    | nonce/attachment linkage       |
| Emit a schema-invalid nested Envelope             | bundled Messages schema        |
| Return red result with process exit zero          | entrypoint exit mapping        |
| Fail cleanup after an otherwise passing run       | cleanup dominance              |

- [ ] **Step 2: Run the registry test red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/mutation-gauntlet.test.mts`

  Expected: FAIL until all mutation IDs and expected findings exist.

- [ ] **Step 3: Implement deterministic mutations without a framework.** Use
      bounded exact text/JSON transformations against the disposable fixture and
      assert each preimage exists exactly once before changing it. Run one
      mutation per clean copy, require a nonzero acceptance result, and require
      its specific finding. A crash, unrelated compilation error, timeout, or
      different gate is not credit for the intended oracle.

- [ ] **Step 4: Wire the existing release mutation lane.** Extend
      `tooling/ci/mutation.sh` and root `test:mutation`; do not add a second
      mutation service. Ordinary product pull requests run admitted contracts,
      not this synthetic gauntlet. Changes to acceptance control paths and
      release sealing run all mutations.

- [ ] **Step 5: Run every mutation green-as-a-test.**

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm test:mutation`

  Expected: the pristine fixture passes; each mutation independently produces
  its required red finding; the gauntlet command exits zero only after all
  intended failures are observed.

- [ ] **Step 6: Commit.**

  ```bash
  rtk git add tooling/acceptance/mutation-gauntlet.mts tooling/acceptance/mutation-gauntlet.test.mts tooling/ci/mutation.sh package.json Justfile tooling/quality/src/check-definitions.mts
  rtk git commit -m "test: close contract false-green mutations"
  ```

**Unlock:** The replacement oracle is credible. Factory UX, Build Packs,
upgrades, CI authority, and deletion may now depend on it.

---

### Task 14: Make `maestro create` And `contracts add` Contract-First

**Class:** `pattern-instance`  
**PR:** `F1`  
**Depends on:** `C12`

**Files:**

- Create: `tooling/agent-pack/src/productContracts.ts`
- Create: `tooling/agent-pack/src/productContracts.test.ts`
- Modify: `tooling/agent-pack/src/create.ts`
- Modify: `tooling/agent-pack/src/create.test.ts`
- Modify: `tooling/agent-pack/src/index.ts`
- Create: `apps/cli/src/factory/contracts.ts`
- Create: `apps/cli/src/factory/contracts.test.ts`
- Modify: `apps/cli/src/factory/create.ts`
- Modify: `apps/cli/src/factory/create.test.ts`
- Modify: `apps/cli/src/factory/createComposition.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `apps/cli/src/factory/composition.test.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `docs/template/quickstart.md`
- Modify: `docs/template/blueprints/saas-application.md`

**Interfaces:**

```ts
export type ReviewedContract = {
  readonly sourcePath: string;
  readonly targetPath: `features/${string}.feature`;
  readonly bytes: string;
  readonly sha256: `sha256:${string}`;
  readonly journeyId: `journey_${string}`;
  readonly title: string;
  readonly primary: boolean;
};

export type CustomerCreateInput = {
  readonly target: string;
  readonly name: string;
  readonly contracts: readonly ReviewedContract[];
  readonly demoOnly: boolean;
  readonly write: boolean;
  readonly privacyReviewed: boolean;
};

export function readReviewedContracts(input: {
  readonly cwd: string;
  readonly specPaths: readonly string[];
  readonly primaryJourneyId?: string;
  readonly maxBytes: number;
}): readonly ReviewedContract[];

export type ContractsAddPreview = {
  readonly journeyId: `journey_${string}`;
  readonly sourceSha256: `sha256:${string}`;
  readonly previewFingerprint: `contracts_add_sha256:${string}`;
  readonly confirmationArgv: readonly [
    "pnpm",
    "contracts:add",
    "--",
    "--spec",
    string,
    "--write",
    "--preview-fingerprint",
    `contracts_add_sha256:${string}`,
  ];
};
```

- [ ] **Step 1: Write parser/contract tests red.** Prove repeatable `--spec`,
      one-Feature auto-primary, multi-Feature required `--primary-journey`,
      exact primary match, assembling-only customer contracts, duplicate
      journey/path, traversal, destination collision, malformed Gherkin,
      BOM/CRLF, oversize read, and changed-on-read bytes all fail. Prove
      `--outcome` returns an explicit migration error naming `--spec`.

- [ ] **Step 2: Write transaction tests red.** For create and contracts-add,
      assert preview is default, reviewed write requires the existing privacy
      and preflight/plan fingerprints, preimages are rechecked, collision or
      dirty target leaves all files unchanged, and successful output preserves
      exact Feature bytes. Require preview to return the structured
      `ContractsAddPreview.confirmationArgv`, execute that argv array without
      shell re-parsing, and prove any reordered, omitted, appended, or manually
      reconstructed write argument fails the fingerprint/preimage check.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/productContracts.test.ts src/create.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/contracts.test.ts src/factory/create.test.ts`

  Expected: FAIL because create still requires scalar `outcome` and no contracts
  command exists.

- [ ] **Step 4: Read and validate exact contract bytes at the CLI boundary.**
      Resolve bounded regular files without symlink/path escape, compile through
      the shared `@maestro-template/template-core/product-contract` compiler,
      require assembling lifecycle, and pass immutable `ReviewedContract` values
      into Agent Pack. `personalization.firstOutcome` becomes the primary
      Feature title; no prose is converted to a gate and Agent Pack does not
      import acceptance controller code.

- [ ] **Step 5: Extend the existing reviewed materialization.** Add exact
      Feature writes and the disabled admitted-journey projection to the
      existing blueprint/release plan, so preview checksums and collision
      semantics cover them. Unresolved well-formed `@covers_*` intents are
      reported as the implementation queue and do not cause create to invent
      surfaces or code.

- [ ] **Step 6: Add `maestro contracts add`.** Route the two-token command in
      existing factory composition. It accepts one reviewed assembling `--spec`,
      previews exact file/projection changes through the existing transaction,
      reports journey/rule/scenario/resolved/unresolved coverage, and invokes
      Cucumber dry-run only to print undefined snippets. Preview returns the
      exact structured `confirmationArgv` defined above; that array is the sole
      authorized write invocation consumed later by Maestro `M1a`. It emits no
      UI, operation, fixture, or completion claim.

- [ ] **Step 7: Update factory tests and docs to the new command.** Replace all
      create fixtures that use `--outcome` with checked-in temporary Feature
      bytes; retain one negative migration test. Keep sealed alpha.2 bytes
      unchanged.

- [ ] **Step 8: Run focused and real create integration green.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/agent-pack exec vitest run src/productContracts.test.ts src/create.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/contracts.test.ts src/factory/create.test.ts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm --dir apps/cli test:create-root-integration`

- [ ] **Step 9: Commit.**

  ```bash
  rtk git add tooling/agent-pack/src/productContracts.ts tooling/agent-pack/src/productContracts.test.ts tooling/agent-pack/src/create.ts tooling/agent-pack/src/create.test.ts tooling/agent-pack/src/index.ts apps/cli/src/factory/contracts.ts apps/cli/src/factory/contracts.test.ts apps/cli/src/factory/create.ts apps/cli/src/factory/create.test.ts apps/cli/src/factory/createComposition.ts apps/cli/src/factory/createRootIntegration.test.ts apps/cli/src/factory/composition.ts apps/cli/src/factory/composition.test.ts apps/cli/src/commands.ts tooling/generators/src/blueprints/saasApplication.ts tooling/generators/src/blueprints/saasApplicationFactory.ts tooling/generators/src/blueprints/saasApplication.test.ts docs/template/app-factory-guide.md docs/template/quickstart.md docs/template/blueprints/saas-application.md
  rtk git commit -m "feat: make factory creation contract first"
  ```

**Unlock:** Every new app begins with reviewed natural-language contracts in
assembling state and no false completion claim.

---

### Task 15: Bind The Existing Feature Generator And Delete Fake Completion Output

**Class:** `fixture-to-real`  
**PR:** `F2`  
**Depends on:** `F1`

**Files:**

- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `tooling/generators/src/customer-runtime.ts`
- Modify: `tooling/generators/src/customer-runtime.test.ts`
- Modify: `tooling/generators/src/customer-dispatcher.ts`
- Modify: `tooling/generators/src/cli.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/generators/src/blueprints/saasApplication.test.ts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Delete: `tooling/generators/src/crud-proof.ts`
- Delete: `tooling/generators/src/crud-proof.test.ts`
- Delete:
  `examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts`
- Modify:
  `packages/template-core/src/generated/template-contracts-legacy-baseline.json`
- Modify: `packages/template-core/src/recipes/schema.ts`
- Modify: `docs/template/recipes/crud-business-entity.json`
- Modify: `docs/template/recipes/validated-file-import.json`
- Modify: `package.json`
- Modify: `tooling/quality/check-generators.mts`
- Modify: `tooling/quality/check-generators.test.mts`
- Modify: `tooling/quality/check-promotion-boundary.mts`
- Modify: `tooling/quality/check-promotion-boundary.test.mts`
- Modify: `tooling/app-map/src/composition.test.ts`
- Modify: `tooling/release/src/customerTarget/finalFilesystem.test-support.ts`
- Modify: `AGENTS.md`
- Modify: `docs/template/agent-worker-playbook.md`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `docs/template/generator-output-contract.md`
- Modify: `docs/template/how-to-add-frontend-route.md`
- Modify: `docs/template/promotion-boundary.md`
- Modify: `tooling/quality/contract-review-rubric.md`

**Interfaces:**

```ts
export type PublicEntrypointProvenance = {
  readonly surfaceId: string;
  readonly coverageTag: `@covers_${string}`;
  readonly journeyId: `journey_${string}`;
  readonly authPolicyId: `auth_${string}`;
  readonly authorityLocator: string;
  readonly actionDiscriminant?: string;
};

export type PublicGeneratorOptions = {
  readonly publicEntrypoint?: PublicEntrypointProvenance;
};
```

- [ ] **Step 1: Write red generator tests.** For every reviewed generator that
      can create a route, UI action, Confect/Convex public function, HTTP route,
      command, trigger, webhook, CLI, API, or MCP surface, require all
      provenance fields together. Prove partial/unknown journey/policy/surface,
      duplicate locator/discriminant, and generated surface absent from
      provenance fail.

- [ ] **Step 2: Write red anti-fake tests.** Assert standard customer output has
      no presenter-only fake-ready state, no no-op authority-bearing control, no
      records fake adapter, no standalone CRUD proof, no unrelated admitted
      domain Feature, and no unbound `template:add-feature` output. Prove the
      existing command remains registered but refuses a missing/non-assembling
      journey, unknown or transport-incompatible unresolved coverage tag,
      missing surface/auth policy, or already resolved authority. The
      factory-only reference overlay must still pass `C11a`.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/index.test.ts src/customer-runtime.test.ts src/blueprints/saasApplication.test.ts`

  Expected: FAIL on current fake-ready/add-feature/CRUD output.

- [ ] **Step 4: Put provenance into the existing generator receipt.** Extend the
      current generated provenance JSON; do not create another ledger. Internal
      outputs may omit public provenance. Any public output requires a stable
      surface ID, activation journey, auth policy, and canonical locator plus
      action discriminant when applicable. The inventory generator consumes this
      same receipt and defaults an incomplete entry to deny-all/failure, never
      enabled.

- [ ] **Step 5: Convert the golden path into a contract-bound scaffold.** Keep
      the `template:add-feature` dispatcher, script, docs, app-map identity, and
      promotion flow. Require
      `--journey <journey_id> --coverage-tag <@covers_id> --surface <surface_id> --auth-policy <auth_id>`
      in addition to the existing name/system/disposition inputs. Resolve the
      exact assembling Feature and at least one transport-compatible Scenario
      carrying that unresolved coverage tag before emitting files. Emit the
      existing provenance plus dark, compile-valid technical boundaries; omit
      fake fixtures, ready-state claims, presenter-only proof, and
      authority-bearing controls until real implementation supplies them.
      Recipes reference stable journey and coverage/scenario identities plus
      engineering prerequisites; remove `doneState` from the schema and every
      recipe instead of translating it into shell gates.

- [ ] **Step 6: Remove fake proof from normal customer output.** Delete
      `crud-proof` and the non-Convex records adapter. Omit the neutral records
      domain route/action from standard create output unless a supplied
      assembling contract and explicit generator provenance owns it. Keep the
      real records implementation only in the factory acceptance overlay used by
      `C11a`. Narrow standard public registration to existing generic platform
      surfaces plus surfaces explicitly introduced by supplied contract
      provenance; unused product modules may remain internal but cannot be
      publicly registered. Reduce the frozen template baseline to only generic
      platform entries that `C11b` will admit. Do not delete the baseline or
      enable full enforcement before that protected lifecycle transition; `D1`
      performs the final mechanical removal after the pilot.

- [ ] **Step 7: Run generator, acceptance, and factory checks green.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/generators exec vitest run src/index.test.ts src/customer-runtime.test.ts src/blueprints/saasApplication.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-generators.test.mts tooling/quality/check-promotion-boundary.test.mts tooling/acceptance/reference-app.test.ts`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:generators`

- [ ] **Step 8: Commit.**

  ```bash
  rtk git add tooling/generators packages/template-core/src/recipes/schema.ts packages/template-core/src/generated/template-contracts-legacy-baseline.json docs/template/recipes package.json tooling/quality/check-generators.mts tooling/quality/check-generators.test.mts tooling/quality/check-promotion-boundary.mts tooling/quality/check-promotion-boundary.test.mts tooling/app-map/src/composition.test.ts tooling/release/src/customerTarget/finalFilesystem.test-support.ts AGENTS.md docs/template/agent-worker-playbook.md docs/template/app-factory-guide.md docs/template/generator-output-contract.md docs/template/how-to-add-frontend-route.md docs/template/promotion-boundary.md tooling/quality/contract-review-rubric.md examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts
  rtk git commit -m "refactor: bind feature scaffold to product contracts"
  ```

**Unlock:** Generators cannot create a reachable behavior without contract/auth
provenance, and structural fake output no longer masquerades as product proof.

---

### Task 16: Add Human Build Pack Contract Review And Exact Export

**Class:** `pattern-instance`  
**PR:** `B1`  
**Depends on:** `C12`; rebase after `F1` before merge

**Files:**

- Modify: `packages/app-idea-evaluator/src/buildPack.ts`
- Modify: `packages/app-idea-evaluator/src/buildPack.test.ts`
- Modify: `packages/app-idea-evaluator/src/premiumPipeline.ts`
- Modify: `packages/app-idea-evaluator/src/premiumPipeline.test.ts`
- Modify: `packages/app-idea-evaluator/src/maestroMapping.ts`
- Modify: `packages/app-idea-evaluator/src/maestroMapping.test.ts`
- Modify: `packages/convex/confect/buildPacks/packs.spec.ts`
- Modify: `packages/convex/confect/buildPacks/packs.impl.ts`
- Modify: `packages/convex/confect/buildPacks/maestro.impl.ts`
- Modify: `packages/convex/confect/tables/buildPacks.ts`
- Modify: `packages/convex/confect/tables/buildPackStages.ts`
- Modify generated: `packages/convex/confect/_generated/**`
- Modify generated: `packages/convex/convex/_generated/**`
- Modify: `packages/convex/test/build-pack-pipeline.test.ts`
- Modify: `apps/web/src/features/public-funnel/build-pack/build-pack-storage.ts`
- Modify:
  `apps/web/src/features/public-funnel/build-pack/build-pack-storage.test.ts`
- Modify: `apps/web/src/features/public-funnel/build-pack/build-pack-view.tsx`
- Modify:
  `apps/web/src/features/public-funnel/build-pack/build-pack-view.test.tsx`

**Interfaces:**

```ts
export type BuildPackContractDraft = {
  readonly path: `features/${string}.feature`;
  readonly draftGherkin: string;
  readonly journeyId: `journey_${string}`;
  readonly primary: boolean;
  readonly draftDigest: `sha256:${string}`;
};

export type ExportedBuildPackContract = {
  readonly path: `features/${string}.feature`;
  readonly journeyId: `journey_${string}`;
  readonly primary: boolean;
  readonly approvedDigest: `sha256:${string}`;
  readonly repository: string;
  readonly commitSha: string;
};

export type ApproveBuildPackContractInput = {
  readonly packId: string;
  readonly expectedDraftDigest: `sha256:${string}`;
  readonly approvedGherkin: string;
};
```

- [ ] **Step 1: Write red state-machine tests.** V1 packs remain readable and
      display-only. V2 `specify` produces draft Gherkin, then the run pauses in
      `awaiting-review`; automatic model execution cannot advance it. Stale
      digest, non-owner/non-`build_pack:approve`, edit-after-approval, duplicate
      resume, and export of unapproved bytes fail.

- [ ] **Step 2: Write red exact-export tests.** Successful CAS approval records
      server-derived actor/time and exact digest, compile exports exactly those
      bytes, map-to-Maestro passes paths plus primary journey to `create --spec`
      or `contracts add --spec`, failed export retains approved bytes for
      idempotent retry, and successful checked-in export replaces the byte copy
      with provenance.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator exec vitest run src/buildPack.test.ts src/premiumPipeline.test.ts src/maestroMapping.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/build-pack-pipeline.test.ts`

  Expected: FAIL because the current automatic `review` stage advances and
  mapping concatenates acceptance prose into `gates`.

- [ ] **Step 4: Version the existing model, do not add a contract store.** Add
      V2 decoding and `awaiting-review` to the current Build Pack/run/stage
      rows. `specify` creates drafts; authenticated CAS approval stores exact
      bytes only until export. V1 `userJourneys`/`acceptanceCriteria` remain
      readable but can never authorize admission.

- [ ] **Step 5: Make review a human mutation.** Reuse workspace authorization
      and the canonical `build_pack:approve` policy. Derive actor and timestamp
      on the server, compare the expected digest atomically, revalidate the
      approved Feature, and resume `compile` idempotently. An edit creates a new
      digest and returns to awaiting review.

- [ ] **Step 6: Delete prose gates from mapping.** `maestroMapping.ts` emits
      exact contract file content/path/primary journey and work-package
      references to stable journey/scenario IDs. Derive legacy display
      journeys/outcomes from the current draft before export and from checked-in
      Features after export.

- [ ] **Step 7: Add the smallest review UI.** Reuse existing Build Pack view and
      form components to show exact Gherkin, edit, approve, stale-draft error,
      and export state. No contract dashboard or receipt browser.

- [ ] **Step 8: Run green and commit.**

  Run on a connected codegen worker: `rtk pnpm confect:codegen`

  Run on a connected codegen worker: `rtk pnpm convex:codegen`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/app-idea-evaluator exec vitest run src/buildPack.test.ts src/premiumPipeline.test.ts src/maestroMapping.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir packages/convex exec vitest run test/build-pack-pipeline.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/web exec vitest run src/features/public-funnel/build-pack/build-pack-storage.test.ts src/features/public-funnel/build-pack/build-pack-view.test.tsx`

  Run after commit on the remote worker:
  `rtk maestro-remote-test -- pnpm check:convex`

  ```bash
  rtk git add packages/app-idea-evaluator/src packages/convex/confect/buildPacks packages/convex/confect/tables/buildPacks.ts packages/convex/confect/tables/buildPackStages.ts packages/convex/confect/_generated packages/convex/convex/_generated packages/convex/test/build-pack-pipeline.test.ts apps/web/src/features/public-funnel/build-pack
  rtk git commit -m "feat: require human gherkin approval"
  ```

**Unlock:** AI may draft behavior but cannot approve bytes or mint a verdict.

---

### Task 17: Add Recoverable Existing-App Contracts Audit

**Class:** `pattern-instance`  
**PR:** `U1`  
**Depends on:** `C12`; rebase after `F1` and `F2` before merge

**Files:**

- Modify: `tooling/release/src/upgrade/contract.ts`
- Create: `tooling/release/src/upgrade/contract.test.ts`
- Modify: `tooling/release/src/upgrade/plan.ts`
- Modify: `tooling/release/src/upgrade/plan.test.ts`
- Create: `tooling/release/src/upgrade/rootIntegrations.ts`
- Create: `tooling/release/src/upgrade/rootIntegrations.test.ts`
- Modify: `tooling/release/src/upgrade/applyCollisionFree.ts`
- Modify: `tooling/release/src/upgrade/applyCollisionFree.test.ts`
- Modify: `tooling/release/src/upgrade/repository.ts`
- Modify: `tooling/release/src/upgrade/repository.test.ts`
- Modify: `tooling/release/src/customerTarget/manifest.ts`
- Modify: `tooling/release/src/customerTarget/manifest.test.ts`
- Modify: `tooling/release/src/customerTarget/createAdapter.ts`
- Modify: `tooling/release/src/customerTarget/createAdapter.test.ts`
- Modify: `schemas/maestro-customer-release-manifest.schema.json`
- Modify: `tooling/release-seal.mts`
- Modify: `tooling/release-seal.test.mts`
- Modify: `apps/cli/src/factory/upgrade.ts`
- Modify: `apps/cli/src/factory/upgrade.test.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `apps/cli/src/factory/composition.test.ts`
- Generate in the disposable audit target, never stage in this factory PR:
  `.maestro/contracts-legacy-baseline.json`
- Create: `docs/template/contracts-upgrade.md`

**Interfaces:**

```ts
import type { ContractsLegacyBaseline } from "@maestro-template/template-core/publicSurface";

export type ContractsAuditReleaseClosure = {
  readonly payloadPaths: readonly {
    readonly path: string;
    readonly sha256: `sha256:${string}`;
  }[];
  readonly rootIntegrations: readonly {
    readonly path: string;
    readonly kind: "json-merge" | "pnpm-lockfile" | "anchored-text";
    readonly patchSha256: `sha256:${string}`;
  }[];
  readonly digest: `sha256:${string}`;
};

export type ContractsAuditUpgrade = {
  readonly mode: "contracts-audit";
  readonly source: {
    readonly repository: string;
    readonly releaseVersion: string;
    readonly releaseTag: string;
    readonly remoteTagObjectOid: string;
    readonly releaseRootCommit: string;
    readonly releaseManifestDigest: `sha256:${string}`;
  };
  readonly target: {
    readonly kind: "template-instance" | "unmanaged-existing-repository";
    readonly preAuditCommit: string;
    readonly packageManager: `pnpm@${string}`;
    readonly runtimeTarget: {
      readonly path: ".maestro/product-contracts/runtime-target.json";
      readonly sha256: `sha256:${string}`;
    };
  };
  readonly baseline: ContractsLegacyBaseline;
  readonly stagedInventoryDigest: `sha256:${string}`;
  readonly previewFingerprint: `contracts_audit_sha256:${string}`;
  readonly stagedOperations: readonly {
    readonly path: string;
    readonly kind: "additive-payload" | "structured-integration";
    readonly preimageSha256?: `sha256:${string}`;
    readonly postimageSha256: `sha256:${string}`;
  }[];
  readonly enforcement: false;
};
```

- [ ] **Step 1: Write red audit-plan tests.** Capture all pre-guard public
      surfaces exactly once; keep them enabled and label them
      `legacy behavior unadmitted`; require contracts/darkness for every new
      surface; reject baseline growth, changed authority key under an old ID,
      removal without admitted coverage, hand-edited digest, and enforcement
      while nonempty. Make the sealed customer-release manifest carry one exact
      sorted `contractsAudit` path/digest closure derived from its existing
      path-ownership graph. Payload paths must live under the reviewed
      `.maestro/product-contracts/**` namespace and be additive. Root files are
      represented only by structured integration recipes. Unknown, missing,
      duplicate, factory-only, whole-template `package.json`/lockfile/Justfile,
      or digest-mismatched entries fail sealing. Include a Maestro-shaped
      unmanaged fixture with pnpm 9, its own scripts/dependencies/CI, and no
      `template-instance.json`. Require the audit to derive exactly one web
      package/artifact, CLI package/build script/bin, and backend package from
      the release integration recipe plus target package metadata, emit the
      minimal runtime-target JSON, and reject ambiguous, missing, absolute, or
      traversing paths and arbitrary command strings. Add the absent-root
      non-default sealer cases before implementation: moved/missing base,
      accidental composition output, dirty source, source/base role reversal,
      and drifted check mode must all fail for their named reason.

- [ ] **Step 2: Write red staged/recovery tests.** Simulate collision, stale
      preimage, generator failure, static verification failure, process
      interruption, unavailable target, an unmanaged repository with no
      `template-instance.json`, package-manager mismatch, root-script collision,
      a hostile target `.pnpmfile.cjs`, a non-allowlisted registry/tarball URL,
      and a command run from the wrong repository. Make the hostile hook try to
      read environment/controller files and open a private-network socket; prove
      it runs only inside the bounded empty-environment dependency sandbox and
      cannot affect the controller or original target. Every failure before the
      first apply rename leaves original files byte-identical. Inject a hard
      stop after every journaled rename; the next audit/status invocation must
      detect the journal, restore all recorded preimages, verify their digests,
      and only then continue. Success stages exactly the additive payload,
      target-specific structured postimages, and baseline. Unmanaged audit does
      not invent a template-instance provenance claim.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/upgrade/contract.test.ts src/upgrade/plan.test.ts src/upgrade/rootIntegrations.test.ts src/upgrade/applyCollisionFree.test.ts src/upgrade/repository.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/upgrade.test.ts src/factory/composition.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts`

  Expected: FAIL because no exact contracts-audit release closure or unmanaged
  adoption command exists.

- [ ] **Step 4: Extend the existing upgrade authority behind preview
      confirmation.** Add
      `maestro-template upgrade --contracts-audit --release-root <absolute-clean-root> --to <exact-version> --target-root <absolute-clean-root>`
      to `createUpgradeCliHandler`; retain `contracts` only for `add`. Preview
      is mandatory and returns the exact confirmation argv ending in
      `--write --preview-fingerprint <contracts_audit_sha256:...>`. Write
      refuses a missing/stale fingerprint, changed target HEAD/preimage, changed
      remote annotated tag object, changed peeled release commit, or changed
      manifest. The executable comes from the same verified release root. For a
      recognized template instance, reuse its upgrade authority; for an
      unmanaged repository, stage only additive namespaced payload plus
      target-bound root integrations and baseline.

- [ ] **Step 5: Merge target roots without replacing them.** Preserve every
      unrelated `package.json` key and the target's `packageManager`; add only
      collision-free contract scripts and exact dependencies. Support the
      repository's existing pnpm 9 or 10 line, generate the lockfile postimage
      with that exact toolchain under `--ignore-scripts`, then prove
      `pnpm install --frozen-lockfile --ignore-scripts` in the staged target.
      Run both commands inside Task 11's empty-environment, resource-limited
      dependency sandbox with no controller mounts/sockets and only the
      protected dependency-proxy allowlist; target `.pnpmfile.cjs` is preserved
      but executes only there. Never copy the template root manifest, lockfile,
      Justfile, or Woodpecker files into an unmanaged repository. Generate the
      content-addressed legacy baseline, run static checks in the staged target,
      and start the journaled apply only when legacy reachability is unchanged.
      Persist the one closed `ContractsAuditUpgrade` envelope at
      `.maestro/contracts-legacy-baseline.json`; it records remote source/tag,
      target preimages/postimages, and recovery facts, so no second receipt or
      PR description binding exists. The structured root integration also adds
      collision-free `acceptance:check`, `contracts:add`,
      `contracts:surfaces:write`, and `contracts:surfaces:check` scripts and
      emits a reviewed `.maestro/product-contracts/runtime-target.json`.
      Generated template instances use the sealed default recipe; an unmanaged
      target uses the uniquely matched reviewed recipe and package `bin`
      metadata. The preview and baseline bind the emitted digest; it never adds
      another upgrade or audit command layer.

- [ ] **Step 6: Make reduction monotonic.** Subsequent upgrades may remove a
      baseline surface only when generated admitted coverage owns it. When the
      set reaches empty, the same staged transaction deletes the file and flips
      full enforcement. Emergency deny remains independent and is never cleared.

- [ ] **Step 7: Support absent-root, non-default release sealing.** Extend the
      existing sealer so
      `release:seal -- --version <new> --source-commit <sha> --base-version <immutable-prior> --non-default`
      uses the pinned prior release only as the immutable base for ancestry,
      comparison, and prior migration state. The recorded clean current source
      commit supplies the new blueprint, ownership graph, contracts-audit
      closure, and migration declaration. The sealer rejects any input not
      reachable by immutable Git object lookup; it must not pre-seed the new
      directory, read bytes from a dirty worktree, or emit
      `apps/cli/src/factory/createComposition.ts` in non-default mode. Make the
      already-red Step 1 sealer cases pass.

- [ ] **Step 8: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/upgrade/contract.test.ts src/upgrade/plan.test.ts src/upgrade/rootIntegrations.test.ts src/upgrade/applyCollisionFree.test.ts src/upgrade/repository.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm --dir apps/cli exec vitest run src/factory/upgrade.test.ts src/factory/composition.test.ts`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts`

  ```bash
  rtk git add tooling/release/src/upgrade tooling/release/src/customerTarget/manifest.ts tooling/release/src/customerTarget/manifest.test.ts tooling/release/src/customerTarget/createAdapter.ts tooling/release/src/customerTarget/createAdapter.test.ts schemas/maestro-customer-release-manifest.schema.json tooling/release-seal.mts tooling/release-seal.test.mts apps/cli/src/factory/upgrade.ts apps/cli/src/factory/upgrade.test.ts apps/cli/src/factory/composition.ts apps/cli/src/factory/composition.test.ts docs/template/contracts-upgrade.md
  rtk git commit -m "feat: add recoverable contracts audit adoption"
  ```

**Unlock:** Working existing apps can adopt the harness without an outage or a
false retroactive admission claim.

---

### Task 18: Bind Promotion To One Immutable Multi-Component Manifest

**Class:** `pattern-instance`  
**PR:** `R1`  
**Depends on:** `C12`; rebase after `F1`, `F2`, and `U1` before merge

**Files:**

- Create: `tooling/release/src/deploy/releaseManifest.ts`
- Create: `tooling/release/src/deploy/releaseManifest.test.ts`
- Modify: `tooling/release/src/deploy/contract.ts`
- Modify: `tooling/release/src/deploy/authority.ts`
- Modify: `tooling/release/src/deploy/trustedAuthority.ts`
- Modify: `tooling/release/src/deploy/requirements.ts`
- Modify: `tooling/release/src/deploy/decision.ts`
- Modify: `tooling/release/src/deploy/verdict.ts`
- Modify: `tooling/release/src/deploy/verify.ts`
- Modify: `tooling/release/src/deploy/audit.ts`
- Modify: `tooling/release/src/deploy/census.ts`
- Modify: `tooling/release/src/deploy/censusEndpoint.ts`
- Modify: `tooling/release/src/deploy/checkpoint.ts`
- Modify: `tooling/release/src/deploy/closure.test.ts`
- Modify: `tooling/release/src/deploy/consumption.ts`
- Modify: `tooling/release/src/deploy/durableAuthority.ts`
- Modify: `tooling/release/src/deploy/guardedDeploy.ts`
- Modify: `tooling/release/src/deploy/audit.test.ts`
- Modify: `tooling/release/src/deploy/authority.test.ts`
- Modify: `tooling/release/src/deploy/census.test.ts`
- Modify: `tooling/release/src/deploy/censusEndpoint.test.ts`
- Modify: `tooling/release/src/deploy/checkpoint.test.ts`
- Modify: `tooling/release/src/deploy/decision.test.ts`
- Modify: `tooling/release/src/deploy/durableAuthority.test.ts`
- Modify: `tooling/release/src/deploy/fullChain.test.ts`
- Modify: `tooling/release/src/deploy/requirements.test.ts`
- Modify: `tooling/release/src/deploy/verdict.test.ts`
- Modify: `.woodpecker/deploy.yml`
- Modify: `tooling/acceptance/selection-manifest.ts`
- Modify: `tooling/acceptance/selection-manifest.test.ts`
- Modify: `tooling/acceptance/mutation-gauntlet.mts`
- Modify: `tooling/acceptance/mutation-gauntlet.test.mts`

**Interfaces:**

```ts
export type ComponentIdentity = {
  readonly digest: `sha256:${string}`;
  readonly deploymentId?: string;
};

export type ReleaseManifestV2 = {
  readonly schemaVersion: 2;
  readonly sourceSha: string;
  readonly components: {
    readonly web: ComponentIdentity;
    readonly cli: ComponentIdentity;
    readonly backend: Required<ComponentIdentity>;
    readonly schemaMigration: ComponentIdentity;
    readonly runtimeConfig: ComponentIdentity;
    readonly admissionPolicy: ComponentIdentity;
  };
  readonly rollbackCompatibleManifestDigests: readonly `sha256:${string}`[];
};

export function digestReleaseManifest(
  manifest: ReleaseManifestV2,
): `sha256:${string}`;
```

- [ ] **Step 1: Write red canonical-manifest tests.** Prove stable sorted JSON
      hashing, all six required components, lowercase SHA-256 format, backend
      deployment identity, source SHA, duplicate/malformed fields, and byte
      changes in each component. V1 singular-artifact records remain readable
      for audit but cannot authorize a V2 promotion.

- [ ] **Step 2: Write red authority-chain tests.** Readiness, approval,
      authorization, verdict, receipt, audit, census, checkpoint, and closure
      must all bind the same `releaseManifestDigest`; a singular `artifactHash`
      cannot substitute. Platform observations for web/CLI/backend must match
      the manifest, and staging/prod observations cannot be copied from
      application self-report.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/deploy/releaseManifest.test.ts src/deploy/fullChain.test.ts src/deploy/requirements.test.ts src/deploy/checkpoint.test.ts`

  Expected: FAIL because the existing authority centers on one artifact hash.

- [ ] **Step 4: Extend the authority in place.** Add V2 decoding and propagate
      only the manifest digest through existing decisions/receipts. Build each
      component once in the trusted post-merge job, hash web, canonical built
      CLI, backend input/deployment, generated schema/migration, normalized
      runtime config, and generated admission policy, then persist one immutable
      manifest. Do not create a parallel deploy service.

- [ ] **Step 5: Add exact staging-proof selection.** Define a
      `StagingSelectionManifest` containing exactly every admitted Pickle
      carrying `@staging-proof`. It reuses the same expected inventory and
      Messages verifier, cannot mint the PR required context, rejects zero when
      staging-proof Pickles exist, and never enables local issuer/bootstrap.
      This separate promotion selection avoids weakening authoritative PR
      selection, which remains the full admitted inventory.

- [ ] **Step 6: Promote and rollback manifests, never loose artifacts.** Deploy
      the exact digest to isolated staging, run strict staging-proof contracts
      with restricted identities, query platform APIs for component/deployment
      IDs, promote that digest, then query production again. Rollback selects a
      recorded digest that the trusted schema/migration compatibility check
      placed in the list; candidate input cannot declare compatibility. It never
      clears emergency deny.

- [ ] **Step 7: Append the release drift mutation.** Add
      `release-component-outside-manifest` to the shared mutation registry.
      Change one staged component after manifest creation and require
      platform-observed digest mismatch. The registry now contains 26 cases.

- [ ] **Step 8: Run green and commit.**

  Run:
  `rtk host-test-slot --class focused pnpm --dir tooling/release exec vitest run src/deploy`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/selection-manifest.test.ts tooling/acceptance/mutation-gauntlet.test.mts`

  ```bash
  rtk git add tooling/release/src/deploy .woodpecker/deploy.yml tooling/acceptance/selection-manifest.ts tooling/acceptance/selection-manifest.test.ts tooling/acceptance/mutation-gauntlet.mts tooling/acceptance/mutation-gauntlet.test.mts
  rtk git commit -m "feat: bind promotion to release manifest"
  ```

**Unlock:** Staging, promotion, production verification, and rollback name the
same immutable multi-component product.

---

### Task 19: Cut Over The Protected Woodpecker Merge-Candidate Authority

**Class:** `pattern-instance`  
**PR:** `W1`  
**Depends on:** `R1`, `C12`, and a green `C10` sandbox canary on the actual
Woodpecker agent; `W0` remains the active protected authority throughout

**Files:**

- Create: `tooling/ci/mergeCandidate.mts`
- Create: `tooling/ci/mergeCandidate.test.mts`
- Modify: `tooling/ci/ci-self-protection.sh`
- Create: `tooling/ci/ci-self-protection.test.mts`
- Modify: `tooling/ci/phase1.sh`
- Modify: `.woodpecker/verify.yml`
- Modify: `tooling/quality/woodpecker-template-pipeline.test.mts`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `.github/CODEOWNERS`
- Modify: `package.json`
- Delete: `tooling/stack/submit.mts`
- Delete: `tooling/stack/submit.test.mts`
- Delete: `tooling/stack/merge.mts`
- Delete: `tooling/stack/merge.test.mts`
- Delete: `tooling/stack/sync.mts`
- Delete: `tooling/stack/sync.test.mts`
- Delete: `tooling/stack/merge-preflight.mts`
- Delete: `tooling/stack/merge-preflight.test.mts`
- Modify: `tooling/stack/exec.mts`
- Modify: `tooling/stack/exec.test.mts`
- Modify: `tooling/acceptance/mutation-gauntlet.mts`
- Modify: `tooling/acceptance/mutation-gauntlet.test.mts`
- Create: `docs/template/product-contract-ci-operations.md`

**Interfaces:**

```ts
export type ProtectedMergeCandidate = {
  readonly repository: string;
  readonly baseRef: string;
  readonly baseOid: string;
  readonly headOid: string;
  readonly mergeGroupOid: string;
};

export type CandidateDeltaClass =
  "ordinary" | "admission" | "control-plane" | "invalid-mixed";

export function classifyCandidateDelta(input: {
  readonly basePaths: ReadonlyMap<string, Uint8Array>;
  readonly mergeGroupPaths: ReadonlyMap<string, Uint8Array>;
}): CandidateDeltaClass;
```

- [ ] **Step 1: Write red tuple/classifier tests.** Reject absent/wrong repo,
      base ref/OID, head OID, merge-group OID, checkout not equal to merge
      group, admitted lifecycle absent from protected base, admission plus any
      protected control path, and control changes hidden in another batched pull
      request. A semantic lifecycle-only edit of an already-assembling Feature
      plus byte-exact generated admission projections derived from that edit is
      the admission delta itself, not a control-plane edit; any non-derived
      projection byte, Feature prose/scenario/tag other than lifecycle, or
      step/support change in the same candidate is `invalid-mixed`. Base
      movement reruns the tuple check; unchanged PR head retains its approval;
      changed PR head requires fresh approval.

- [ ] **Step 2: Write red protected-semantics tests.** Preserve every `W0`
      tokenless/root/App assertion. Prove the active protected bootstrap root
      cannot claim contract admission until its protected-base controller loads
      the pinned Cucumber config, compiler, verifier, driver/hook inventory, and
      support adapters; validates the exact merge tuple; and accepts the strict
      result. A candidate-proposed adapter runs only under the distinct
      observation context. Qlty failure/timeout cannot fail either protected
      context.

- [ ] **Step 3: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/mergeCandidate.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts`

  Expected: FAIL because the `W0` protected root intentionally lacks Cucumber
  admission semantics and the merge-candidate classifier.

- [ ] **Step 4: Land contract control code before changing protected
      semantics.** Publish the reviewed acceptance `controller.Dockerfile` image
      only after `W1` reaches protected main and record its immutable digest
      beside the still-active `W0` digest in Woodpecker server state. The
      observation run loads launcher, config, compiler, verifier, drivers, and
      step/support adapters from protected base while reading candidate Feature
      bytes and launching the merge-group product artifacts. A dedicated
      control-plane PR runs its proposed adapters in a separate
      non-authoritative observation pass; they become required authority only
      after merge to protected main. The protected controller alone queries
      GitHub approvals, branch protection, merge queue, app/context binding, and
      posts status.

- [ ] **Step 5: Extend the tokenless candidate run with acceptance.** Keep the
      `W0` sandbox and external GitHub queries unchanged, run deterministic
      gates plus candidate build/runtime inside it, and run protected-base
      Cucumber and verification in the controller. Return only bounded evidence
      to controller storage. Run Qlty in a separate advisory step with a hard
      30-second cap and remove `check:qlty` from root blocking `verify`.

- [ ] **Step 6: Verify every contract authority remains protected.** Extend and
      test the `W0` CODEOWNER coverage for `features/**`, `cucumber.cjs`,
      `tooling/acceptance/**`, public registration and generator provenance,
      auth policies/principals, generated inventory and projection sources,
      `package.json`, `pnpm-lock.yaml`, `Justfile`, Woodpecker config, CI
      self-protection, and CODEOWNERS. External preflight requires a non-author
      code-owner approval for exact `headOid`, stale-approval dismissal,
      administrator/bypass enforcement, exact `{context, app_id}`, and batch
      size one for admission/control changes.

- [ ] **Step 7: Remove Graphite mutations, keep read-only planning.** Delete
      submit/merge/sync/preflight paths and their package scripts. Retain stack
      plan validation and read-only GitHub status reporting. Operators use
      normal GitHub pull requests, explicit base only for real code dependency,
      auto-merge/merge queue, and bottom-up order.

- [ ] **Step 8: Append the two CI mutations.** Add
      `candidate-pipeline-success-noop` and `mixed-admission-control-delta`;
      require that the first cannot post the app-bound context and the second is
      rejected by the protected classifier. The registry now contains all 36
      cases.

- [ ] **Step 9: Run green and commit source before the external cutover.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/ci/mergeCandidate.test.mts tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts tooling/acceptance/mutation-gauntlet.test.mts`

  ```bash
  rtk git add tooling/ci .woodpecker/verify.yml tooling/quality/woodpecker-template-pipeline.test.mts tooling/quality/check-ci-completeness.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.mts tooling/quality/check-config-drift.test.mts .github/CODEOWNERS package.json tooling/stack tooling/acceptance/mutation-gauntlet.mts tooling/acceptance/mutation-gauntlet.test.mts docs/template/product-contract-ci-operations.md
  rtk git commit -m "ci: protect merge candidate contract verdict"
  ```

- [ ] **Step 10: Merge source, then run the complete gauntlet and observation.**
      Merge `W1` while the `W0` protected canonical rule remains active. From
      its committed protected-main SHA, run on the remote worker:
      `rtk maestro-remote-test -- pnpm test:mutation`.

  Run `protected-bootstrap.mts observe` for repository
  `modernagencysales/maestro-template-saas-ui`, the literal merged W1
  40-character SHA, and journal
  `/Users/headless/.local/state/maestro-ci-transitions/maestro-template-W1.json`.
  Preview
  `install-temporary --temporary-context ci/woodpecker/pr/contracts-protected`
  against that journal, review and execute its returned confirmation argv, then
  run `verify --stage temporary` with the same BWS-backed command form used in
  W0 Step 7.

  Run the acceptance controller as `ci/woodpecker/pr/contracts-protected` on a
  real test pull request, then mutate its PR-head pipeline to a no-op and rerun.
  Expected: all 36 intended faults are caught; only the protected controller
  posts the temporary context; the candidate no-op cannot do so.

- [ ] **Step 11: Perform the overlapping semantic cutover.** Record exact live
      Woodpecker/server and GitHub-ruleset digests. Require
      `ci/woodpecker/pr/contracts-protected` alongside the still-working
      canonical `W0` context and prove both on a fresh merge candidate. With an
      expected-state compare-and-swap, preview `enable-canonical` against the W1
      journal, execute its returned confirmation argv, and run
      `verify --stage canonical-overlap`. Prove a second candidate receives both
      App-bound contexts. Only then preview/execute `remove-temporary` and run
      `verify --stage canonical`. In the same journaled transition, add a tag
      ruleset protecting `maestro-template-v0.2.0-alpha.3*` from update/deletion
      and restrict tag creation to the release actor; verify it by post-read
      before `P1`. The release/consumer checks enforce the annotated-object
      shape. On a pre-state mismatch, perform no write. On a failed post-read,
      restore the recorded `W0` producer only if live state exactly equals that
      update's recorded forward postimage; otherwise leave both checks required
      and stop for reconciliation. The executable `rollback --step <id>`
      enforces that condition. Retain each preimage, forward postimage, inverse,
      and inverse compare condition in the journal.

**Unlock:** The sole required status now proves the exact protected merge
candidate with approved control code and no candidate secrets.

---

### Task 20: Admit The Protected Reference Platform Contract

**Class:** `fixture-to-real`

**PR:** `C11b`

**Depends on:** `W1` fully cut over on protected main

**Files:**

- Modify: `features/platform_access.feature`
- Modify generated: `packages/template-core/src/generated/admittedJourneys.ts`

- [ ] **Step 1: Prove the immutable base is eligible.** From current protected
      main, require `features/platform_access.feature` to exist as assembling,
      all its steps/support to resolve from protected base, and its generated
      admission projection to be false. Run: `rtk pnpm acceptance:check`.
      Expected: PASS with no source/projection drift and no absent-to-admitted
      transition.

- [ ] **Step 2: Flip lifecycle and regenerate mechanically.** Change only the
      Feature-level `@assembling` token to `@admitted`, then run
      `rtk pnpm exec tsx tooling/acceptance/check-contracts.mts --write`.
      Expected: the only derived change is the matching `admittedJourneys.ts`
      value. The command fails if any unrelated generated byte changes.

- [ ] **Step 3: Verify the closed delta.**

  Run: `rtk pnpm acceptance:check`

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/acceptance/contract-inventory.test.ts tooling/ci/mergeCandidate.test.mts`

  Expected: the classifier returns `admission`; removing the projection,
  hand-editing it, or changing Feature prose/steps returns `invalid-mixed`.

- [ ] **Step 4: Commit and admit through batch-one merge queue.**

  ```bash
  rtk git add features/platform_access.feature packages/template-core/src/generated/admittedJourneys.ts
  rtk git commit -m "test: admit protected platform contract"
  ```

  The protected controller must execute the complete platform inventory and all
  older admitted contracts for the exact merge candidate. Any repair closes
  `C11b`, lands as a new assembling PR, and starts a fresh lifecycle/projection
  PR.

**Unlock:** The normal repository now has one permanently admitted reference
contract; the factory mutation fixture is no longer the only success path.

---

### Task 21: Seal The Immutable Brain Pilot Release Candidate

**Class:** `fixture-to-real`

**PR:** `P1`

**Depends on:** `F1`, `F2`, `U1`, `R1`, `W1`, and `C11b` merged on protected
main, plus the green 36-case gauntlet. `B1` is deliberately not on the pilot
critical path.

**Repository:** `maestro-template-saas-ui`

**Files:**

- Generate and add: `releases/v0.2.0-alpha.3-pilot.1/**`

**Binding:** Reuse `ContractsAuditUpgrade.source`; do not create a pilot ledger
or store release authority in pull-request prose.

- [ ] **Step 1: Freeze the source candidate.** Start from a clean protected-main
      worktree after every dependency has merged. Record its 40-character HEAD;
      the release candidate may contain both new Cucumber authority and the old
      journey machinery, because `D1` deletes the old machinery only after the
      real pilot passes.

- [ ] **Step 2: Seal the non-default pilot version.** Run
      `rtk pnpm release:seal -- --version 0.2.0-alpha.3-pilot.1 --source-commit <recorded-40-character-source-sha> --base-version 0.2.0-alpha.2 --non-default`.
      It must generate a materializable release with the exact contracts-audit
      path/digest closure from `U1`. Do not change create composition or the
      alpha.2 default.

- [ ] **Step 3: Verify the candidate before committing.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/release-seal.test.mts tooling/release/src/customerTarget/manifest.test.ts tooling/release/src/upgrade/repository.test.ts`

  Expected: the release source, complete path hashes, contract-audit closure,
  CLI compatibility, and source ancestry all match; a byte change is red.

- [ ] **Step 4: Commit and bind the immutable tag.**

  ```bash
  rtk git add releases/v0.2.0-alpha.3-pilot.1
  rtk git commit -m "release: seal cucumber contracts brain pilot"
  ```

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm release:seal -- --check --version 0.2.0-alpha.3-pilot.1 --source-commit <recorded-40-character-source-sha> --base-version 0.2.0-alpha.2 --non-default`

  Run P1 through the protected merge queue. After the release bytes are on
  protected main, rerun the check against that commit, create an annotated tag
  with
  `rtk git tag -a maestro-template-v0.2.0-alpha.3-pilot.1 <verified-protected-main-release-commit> -m "maestro template cucumber brain pilot"`,
  then run
  `rtk git push origin refs/tags/maestro-template-v0.2.0-alpha.3-pilot.1`. Query
  the remote tag and peeled ref with
  `rtk git ls-remote --tags origin maestro-template-v0.2.0-alpha.3-pilot.1 'maestro-template-v0.2.0-alpha.3-pilot.1^{}'`.
  Require two OIDs: the protected annotated tag object and the exact release
  commit. In a clean worktree detached at the peeled commit, verify the manifest
  digest, contracts-audit closure, earlier source commit, and tag object again.
  The protected tag ruleset rejects updates/deletion. `M0` persists all of these
  facts in `ContractsAuditUpgrade.source` when its preview is applied.

**Unlock:** Brain can adopt one exact release with one exact CLI and manifest;
the pilot no longer depends on the final alpha.3 seal.

---

### Task 22: Pilot One Real Maestro Brain Journey

**Class:** `fixture-to-real`

**PRs:** audit installation `M0`, target-CI cutover `M0b`, `M1a` through `M1d`,
then lifecycle/projection admission `M2`

**Depends on:** immutable pilot release `P1`. The pilot validates that exact
manifest before `D2` seals the public alpha.3 release; production adoption uses
the resulting public release, not the pilot tag.

**Repository:** `/Users/headless/maestro`, from a clean isolated worktree based
on its then-current protected `origin/main`. Do not use the existing dirty
checkout.

**Files:**

- Generate in `M0`: every exact additive path/digest in the immutable P1
  manifest's `contractsAudit.payloadPaths`, all below
  `.maestro/product-contracts/**`
- Modify through preimage-bound `M0` integration: `package.json`
- Modify through preimage-bound `M0` integration: `pnpm-lock.yaml`
- Create in `M0`: `.maestro/contracts-legacy-baseline.json`
- Create through preimage-bound `M0` integration:
  `.maestro/product-contracts/runtime-target.json`
- Modify in `M0b`: `.woodpecker/verify.yml`
- Modify in `M0b`: `tooling/ci/woodpecker-verify.sh`
- Create in `M0b`: `tooling/ci/ci-self-protection.sh`
- Modify in `M0b`: `.github/CODEOWNERS`
- Modify in `M0b`: `tooling/quality/check-self-hosted-ci.mts`
- Modify in `M0b`: `tooling/quality/check-self-hosted-ci.test.mts`
- Modify in `M0b`: `tooling/quality/check-ci-completeness.mts`
- Modify in `M0b`: `tooling/quality/check-ci-completeness.test.mts`
- Create: `features/brain_grounded_content.feature`
- Create: `features/step_definitions/brain_grounded_content.steps.ts`
- Create: `features/support/brain-fixtures.ts`
- Modify: `packages/convex/convex/registry/headlessSurfaces.ts`
- Modify: `packages/convex/convex/registry/headlessSurfaces.test.ts`
- Modify: `packages/convex/convex/capabilities/brain/claimCandidateReview.ts`
- Modify:
  `packages/convex/convex/capabilities/brain/claimCandidateReview.test.ts`
- Modify: `packages/convex/convex/capabilities/brain/contextPacksPublic.ts`
- Modify: `packages/convex/convex/capabilities/brain/contextPacks.test.ts`
- Modify: `packages/convex/convex/capabilities/content/postGenerations.ts`
- Modify: `packages/convex/convex/capabilities/content/postGenerations.test.ts`
- Modify: `apps/web/src/features/brain/brain-learning-review-adapter.ts`
- Modify: `apps/web/src/features/brain/brain-learning-review-adapter.test.ts`
- Modify: `apps/web/src/features/brain/brain-accepted-sources.tsx`
- Modify: `apps/web/src/features/brain/brain-accepted-sources.test.tsx`
- Modify: `apps/web/src/features/posts/posts-generation-controls.commands.ts`
- Modify: `apps/web/src/features/posts/posts-generation-start-request.test.ts`
- Modify: `tooling/maestro-cli/src/maestro.ts`
- Modify generated: `tooling/maestro-cli/generated/headless-contract.json`
- Modify generated in `M1b` and `M1c`:
  `.maestro/product-contracts/generated/public-surfaces.generated.json`
- Modify generated in `M1b` and `M1c`:
  `.maestro/product-contracts/generated/publicSurfaces.ts`
- Modify generated in `M1a` and `M2`:
  `.maestro/product-contracts/generated/admittedJourneys.ts`

**Feature outcome:** An authorized member reviews call-backed client context,
resolves a real conflict, activates the supported context, and produces a
durable grounded content draft with resolvable citations. An authorized agent
can inspect or initiate the same outcome through the built CLI. Read-only,
unauthenticated, and foreign-tenant actors are denied through their distinct
transports.

- [ ] **Step 0: Satisfy Maestro's plan-first intake rule.** Bind this pilot to a
      concrete Brain Linear story, generate/review its required approved-plan
      bundle with the repository's normal `story-to-spec` and `plan` commands,
      and cite that immutable bundle in `M1a` through `M2`. If no suitable story
      exists, the operator creates one before implementation; no product file
      changes begin without the approved bundle.

- [ ] **Step 1 (`M-pre`): Require a protected target root before `M0` runs.**
      From Maestro's then-current immutable protected-main commit (the planning
      baseline was `aa133adefc5e90f48b5b39db047867ea9bc10016`), record the live
      Woodpecker repository configuration, PR-secret mappings, required GitHub
      ruleset, producer App ID, and canonical digests. Freeze merges. With
      expected-state writes, remove every secret mapping from pull-request
      events and install a server-side temporary root that ignores candidate
      `.woodpecker/**`; materialize its command list from that immutable main's
      existing `.woodpecker/verify.yml`, `tooling/ci/woodpecker-verify.sh`, and
      self-protection control into controller-owned read-only storage. Candidate
      code runs only in an empty-environment child. Require
      `ci/woodpecker/pr/protected-bootstrap` and prove on a canary PR that the
      App/repository/base/head/merge-group tuple is exact, a candidate pipeline
      no-op cannot forge the context, and neither package code nor
      `.pnpmfile.cjs` can observe a secret. A pre-state mismatch performs no
      write; a failed post-read may be inverted only while live state exactly
      equals that write's forward postimage. Otherwise keep the temporary check
      required and stop. Create and verify the clean detached P1 worktree at
      `/Users/headless/.worktrees/maestro-template-alpha3-pilot1`, install its
      immutable locked toolchain without lifecycle scripts, then use its
      `tooling/ci/protected-bootstrap.mts` to run `observe` for
      `modernagencysales/maestro` and journal
      `/Users/headless/.local/state/maestro-ci-transitions/maestro-M0.json`.
      Preview
      `install-temporary --temporary-context ci/woodpecker/pr/protected-bootstrap`,
      review and execute its returned confirmation argv, and run
      `verify --stage temporary` using the exact BWS-backed command form from W0
      Step 7. This completes before an `M0` branch is opened or receives CI.

- [ ] **Step 2 (`M0`): Install the exact pilot contract closure.** Create the
      clean target worktree at
      `/Users/headless/.worktrees/maestro-brain-grounded-content` from the exact
      Maestro protected main recorded in M-pre. Re-verify the detached P1 remote
      annotated tag object, peeled commit, manifest, source checksum, and clean
      status, then run the audit in preview mode:

  ```bash
  rtk pnpm --dir /Users/headless/.worktrees/maestro-template-alpha3-pilot1 install --frozen-lockfile --ignore-scripts
  rtk git -C /Users/headless/.worktrees/maestro-template-alpha3-pilot1 status --short
  rtk pnpm --dir /Users/headless/.worktrees/maestro-template-alpha3-pilot1 exec tsx apps/cli/src/index.ts upgrade --contracts-audit --release-root /Users/headless/.worktrees/maestro-template-alpha3-pilot1 --to 0.2.0-alpha.3-pilot.1 --target-root /Users/headless/.worktrees/maestro-brain-grounded-content
  ```

  Expected before audit: status output is empty. Expected preview: additive
  payload only below `.maestro/product-contracts/**`; structured, preimage-bound
  postimages for Maestro's existing `package.json` and pnpm 9 lockfile; no
  template root manifest/lockfile/Justfile/Woodpecker replacement; and one exact
  `confirmationArgv` containing the preview fingerprint. The reviewed runtime
  target names web package `apps/web` with artifact `apps/web/dist`, CLI package
  `tooling/maestro-cli` with build script `build` and executable
  `tooling/maestro-cli/dist/maestro.js`, and backend package `packages/convex`;
  no candidate command string is stored. Review the preview, then execute that
  returned argv byte-for-byte. Do not append `--write` manually.

  The transaction must recognize Maestro as `unmanaged-existing-repository`,
  avoid creating `template-instance.json`, keep every legacy surface enabled and
  unadmitted, add collision-free `acceptance:check` and `contracts:add` scripts,
  and record source/tag/preimage/postimage facts in the one baseline envelope.
  Use the release controller's dependency-sandbox launcher to run target
  `pnpm install --frozen-lockfile --ignore-scripts` and `pnpm acceptance:check`;
  do not execute Maestro's candidate `.pnpmfile.cjs` in the operator or
  status-controller namespace. Commit only the additive payload, exact
  structured postimages, and baseline; merge `M0` under the already-required
  `M-pre` context before `M0b`.

  ```bash
  rtk git add .maestro/product-contracts package.json pnpm-lock.yaml .maestro/contracts-legacy-baseline.json
  rtk git commit -m "build: install cucumber contracts audit"
  ```

- [ ] **Step 3 (`M0b`): Extend Maestro's existing Woodpecker path and perform
      the canonical cutover.** Maestro already has `.woodpecker/verify.yml`,
      `tooling/ci/woodpecker-verify.sh`,
      `tooling/quality/check-self-hosted-ci.mts`, and CI-completeness tests.
      Modify them in place. Port only the active self-protection entrypoint from
      `.buildkite/scripts/ci-self-protection.sh` to
      `tooling/ci/ci-self-protection.sh`, point the existing Woodpecker verify
      root at it, and extend `woodpecker-verify.sh` with the protected product-
      contract invocation while retaining its existing deterministic command
      list. Do not create setup/phase wrappers or a parallel pipeline test, and
      do not edit or invoke a Buildkite pipeline. The server-side `M-pre` root
      remains required throughout. Update existing self-hosted/CI-completeness
      tests and CODEOWNERS so `.maestro/product-contracts/**`, `features/**`,
      package/lockfile, Brain UI/CLI/backend roots, `.woodpecker/**`,
      `tooling/ci/**`, and the control tests are explicitly protected; preserve
      the repository-wide default owner rule and prove at least one matching
      write-enabled owner is not the PR author. Pin the exact P1 acceptance-
      controller image digest in Maestro's Woodpecker server configuration; do
      not copy template root CI files and do not edit `.buildkite/**`.

  Run:
  `rtk host-test-slot --class focused pnpm exec tsx --test tooling/quality/check-self-hosted-ci.test.mts tooling/quality/check-ci-completeness.test.mts`

  Run: `rtk pnpm acceptance:check`

  Commit exactly the target CI paths:

  ```bash
  rtk git add .woodpecker/verify.yml tooling/ci/woodpecker-verify.sh tooling/ci/ci-self-protection.sh tooling/quality/check-self-hosted-ci.mts tooling/quality/check-self-hosted-ci.test.mts tooling/quality/check-ci-completeness.mts tooling/quality/check-ci-completeness.test.mts .github/CODEOWNERS
  rtk git commit -m "ci: protect maestro product contract verdict"
  ```

  Merge under the already required temporary protected Woodpecker context. With
  the P1 operator and Maestro M0 journal, preview/execute
  `install-temporary --temporary-context ci/woodpecker/pr/contracts-protected`
  and run `verify --stage temporary`. Observe the pinned acceptance controller
  on a second real Maestro merge candidate as
  `ci/woodpecker/pr/contracts-protected`; verify controller digest, App ID,
  repository/base/head/merge-group tuple, tokenless child environment, no-op
  PR-pipeline resistance, and a valid Messages canary. Require the bootstrap and
  contracts contexts together. With expected Woodpecker/GitHub state digests,
  use the P1 operator and Maestro M0 journal to preview/execute
  `enable-canonical`, run `verify --stage canonical-overlap`, and bind
  `ci/woodpecker/pr/verify` to the protected acceptance producer. Prove a third
  candidate, then preview/execute `remove-temporary` and run
  `verify --stage canonical`. A pre-state mismatch performs no write. On a
  failed post-read, restore the recorded bootstrap producer only when live state
  exactly equals that update's forward postimage; otherwise leave all temporary
  contexts required and stop for reconciliation. Assert that no Buildkite
  context is required or accepted as contract evidence; executable
  `rollback --step <id>` enforces the recorded forward-postimage condition. No
  `M1` slice starts before this cutover is verified.

- [ ] **Step 4 (`M1a`): Add only an assembling contract through the installed
      command.** Review the frozen legacy baseline and author the approved
      `@journey_brain_grounded_content @assembling` Feature outside the target
      worktree with UI, CLI, cross-surface, authentication, authorization, and
      tenant-isolation scenarios. Given may seed synthetic client/source/call/
      candidate/conflict state, but not activation, resolved conflict, generated
      draft, or citations. From the target, run
      `rtk pnpm contracts:add -- --spec <absolute-reviewed-feature-path>` in
      preview mode, review the exact Feature and false admission-projection
      postimages, then execute the structured
      `ContractsAddPreview.confirmationArgv` returned by `F1` byte-for-byte as
      an argv array without shell parsing or manually appended flags.

  Run: `rtk pnpm acceptance:check`

  Expected: PASS with unresolved assembling coverage/undefined steps reported as
  work; all legacy behavior remains enabled and unadmitted.

  Commit only the Feature and mechanically generated false projection:

  ```bash
  rtk git add features/brain_grounded_content.feature .maestro/product-contracts/generated/admittedJourneys.ts
  rtk git commit -m "test: assemble brain grounded content contract"
  ```

- [ ] **Step 5 (`M1b`): Register and implement UI authority while dark.** Add
      stable surface/auth/activation metadata to the existing claim-review,
      accepted-source, and post-generation controls. Reuse current capabilities
      and durable citation substrate; do not add Brain tables. Wire real
      accessible UI actions/outcomes and keep all newly activation-owned
      controls absent while the journey is assembling.

  Run `rtk pnpm contracts:surfaces:write`, then
  `rtk pnpm contracts:surfaces:check`; stage both exact generated public-surface
  projections with the UI registrations. Run focused UI/capability tests,
  `rtk pnpm acceptance:check`, and all previously admitted journeys. Expected:
  PASS; direct raw invocation remains denied.

  ```bash
  rtk git add packages/convex/convex/capabilities/brain/claimCandidateReview.ts packages/convex/convex/capabilities/brain/claimCandidateReview.test.ts packages/convex/convex/capabilities/brain/contextPacksPublic.ts packages/convex/convex/capabilities/brain/contextPacks.test.ts packages/convex/convex/capabilities/content/postGenerations.ts packages/convex/convex/capabilities/content/postGenerations.test.ts apps/web/src/features/brain/brain-learning-review-adapter.ts apps/web/src/features/brain/brain-learning-review-adapter.test.ts apps/web/src/features/brain/brain-accepted-sources.tsx apps/web/src/features/brain/brain-accepted-sources.test.tsx apps/web/src/features/posts/posts-generation-controls.commands.ts apps/web/src/features/posts/posts-generation-start-request.test.ts .maestro/product-contracts/generated/public-surfaces.generated.json .maestro/product-contracts/generated/publicSurfaces.ts
  rtk git commit -m "feat: wire assembling brain ui journey"
  ```

- [ ] **Step 6 (`M1c`): Register and implement CLI authority while dark.** Add
      generated headless surfaces for context inspection and generation
      initiation, with API-key scopes, server-derived tenant, and the same
      internal capability implementations as UI. Run
      `rtk pnpm contracts:surfaces:write` and
      `rtk pnpm contracts:surfaces:check`, then run
      `rtk pnpm headless:contract:generate` and
      `rtk pnpm headless:contract:check`. Stage both public-surface projections
      and `tooling/maestro-cli/generated/headless-contract.json`; do not create
      a second Brain workflow.

  Run focused registry/CLI/auth tests and `rtk pnpm acceptance:check`. Expected:
  PASS; missing/read-only/foreign keys receive the declared denial classes.

  ```bash
  rtk git add packages/convex/convex/registry/headlessSurfaces.ts packages/convex/convex/registry/headlessSurfaces.test.ts tooling/maestro-cli/src/maestro.ts tooling/maestro-cli/generated/headless-contract.json .maestro/product-contracts/generated/public-surfaces.generated.json .maestro/product-contracts/generated/publicSurfaces.ts
  rtk git commit -m "feat: wire assembling brain cli journey"
  ```

- [ ] **Step 7 (`M1d`): Implement trusted steps and make a local temporary flip
      green.** Steps use Playwright/external CLI only; deterministic fake model
      provider stays behind the real server provider boundary and returns the
      same typed durable draft/citations. Temporarily flip the local dirty
      Feature to admitted, run
      `rtk pnpm exec tsx .maestro/product-contracts/check-contracts.mts --write`,
      then run
      `rtk pnpm acceptance:focus --journey journey_brain_grounded_content`, then
      restore assembling, rerun the projection generator, and verify the
      Feature/projection are byte-identical to their committed assembling state
      before committing steps.

  Expected: every positive/negative/cross-surface Pickle passes, and no
  When/Then outcome was seeded.

  ```bash
  rtk git add features/step_definitions/brain_grounded_content.steps.ts features/support/brain-fixtures.ts
  rtk git commit -m "test: execute assembling brain product contract"
  ```

- [ ] **Step 8: Merge `M1a` through `M1d` bottom-up through GitHub.** Each pull
      request retains assembling, runs existing admitted regressions and
      darkness. Maestro's existing `*` CODEOWNER rule plus the explicit `M0b`
      paths require a non-author product/code-owner approval for the current
      head of every slice; the protected controller verifies it. Do not batch
      any slice with a control-plane change.

- [ ] **Step 9 (`M2`): Create the current-main admission-only pull request.**
      From protected main after all four slices merge, change only
      `@assembling -> @admitted`, then run
      `rtk pnpm exec tsx .maestro/product-contracts/check-contracts.mts --write`
      and stage the exact generated true projection. The protected classifier
      accepts only those two paths and independently regenerates the projection;
      a missing or non-derived byte is `invalid-mixed`. If complete current-main
      execution exposes any repair, close M2, land that repair in a new
      assembling `M1e` slice, rerun the temporary local flip, and create a fresh
      lifecycle/projection M2. The Feature must already exist assembling on the
      immutable protected base. Use merge-queue batch size one.

  Expected required evidence: full admitted inventory selected; Brain UI, built
  CLI, cross-surface, auth, tenant, runtime identity, exact Messages, and every
  older admitted journey pass for the exact merge-group tuple.

  ```bash
  rtk git add features/brain_grounded_content.feature .maestro/product-contracts/generated/admittedJourneys.ts
  rtk git commit -m "test: admit brain grounded content journey"
  ```

**Unlock:** The first real product—not the fixture—has a deterministic
natural-language completion contract across human UI and agent CLI.

---

### Task 23: Delete Superseded Journey And Fake-Proof Machinery

**Class:** `fixture-to-real`

**PR:** `D1`

**Depends on:** immutable `P1`, the green 36-case mutation gauntlet, and merged
Brain admission `M2`. Do not perform any deletion on a weaker evidence set.

**Files:**

- Delete: `packages/product-journey/**`
- Delete: `tooling/quality/check-product-journeys.mts`
- Delete: `tooling/quality/check-product-journeys.test.mts`
- Delete:
  `docs/superpowers/specs/2026-08-01-product-journey-admission-design.md`
- Delete:
  `docs/superpowers/plans/2026-08-01-product-journey-admission-and-brain-completion.md`
- Modify:
  `docs/superpowers/specs/2026-08-02-cucumber-product-contracts-design.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Modify: `Justfile`
- Modify: `tooling/quality/src/check-definitions.mts`
- Modify: `tooling/quality/src/diagnosticRegistry.test.mts`
- Modify: `tooling/quality/check-ci-completeness.mts`
- Modify: `tooling/quality/check-ci-completeness.test.mts`
- Modify: `tooling/quality/check-config-drift.test.mts`
- Modify: `tooling/generators/src/blueprints/saasRegistrationProjections.ts`
- Modify: `apps/cli/src/index.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `apps/cli/src/types.ts`
- Modify: `apps/cli/src/router.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `tooling/agent-pack/evals/walking-skeleton/verifier.ts`
- Modify: `tooling/agent-pack/evals/walking-skeleton/walking-skeleton.test.ts`
- Delete:
  `packages/template-core/src/generated/template-contracts-legacy-baseline.json`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `docs/template/customer-target-contract.md`

- [ ] **Step 1: Write deletion guards red.** Assert no import/script/Just
      recipe, gate definition, generated projection, docs index, package
      reference, or release source references `product-journey`,
      `check:product-journeys`, recipe `doneState`, generated CRUD proof,
      fake-ready/no-op add-feature output, Graphite mutation, or in-process
      capability execution. `template:add-feature` itself must remain as the
      contract-bound golden path. Immutable alpha.1/alpha.2 release bytes and
      historical `.superpowers` reports are explicit read-only scan exceptions,
      not files to rewrite.

- [ ] **Step 2: Run red.**

  Run:
  `rtk host-test-slot --class focused pnpm exec vitest run tooling/quality/check-ci-completeness.test.mts tooling/quality/check-generators.test.mts apps/cli/src/index.test.ts`

  Expected: FAIL while superseded journey/package/CLI compatibility references
  remain.

- [ ] **Step 3: Delete only the proven duplicates.** Remove the custom journey
      package/gate and active August 1 design/plan; Git history preserves them.
      Remove their scripts, gate definitions, and customer projection closure.
      Delete the synchronous `runCli`/sync capability handler now that reference
      and Brain CLI acceptance prove `runCliAsync` over HTTP; retain local
      catalog/help behavior through the async dispatcher. Delete the now-empty
      template legacy baseline and enable full active-surface enforcement only
      because `C11b` admitted every retained generic platform entry. Update the
      August 2 design's link to the deleted August 1 file into the plain
      immutable citation
      `795d94848fbb30e94c7ae3609dec565f597cd00e:docs/superpowers/specs/2026-08-01-product-journey-admission-design.md`
      so no active Markdown link breaks. Update the complete active-reference
      closure listed above; do not modify immutable alpha.1/alpha.2 release
      directories.

  Run:
  `rtk git grep -n -e product-journey -e check:product-journeys -e check-product-journeys -e doneState -e crud-proof -- ':!releases/v0.2.0-alpha.1/**' ':!releases/v0.2.0-alpha.2/**' ':!.superpowers/**' ':!docs/superpowers/specs/2026-08-02-cucumber-product-contracts-design.md' ':!docs/superpowers/plans/2026-08-03-cucumber-product-contracts-implementation.md'`

  Expected: no output. A hit adds that exact active file to `D1`; it never
  authorizes rewriting an immutable historical release.

- [ ] **Step 4 (`D1`): Commit only the proven deletion.** The release sealer
      requires a clean source commit, so do not generate alpha.3 or update the
      default composition in this pull request.

  ```bash
  rtk git add -A packages/product-journey tooling/quality/check-product-journeys.mts tooling/quality/check-product-journeys.test.mts docs/superpowers/specs/2026-08-01-product-journey-admission-design.md docs/superpowers/plans/2026-08-01-product-journey-admission-and-brain-completion.md docs/superpowers/specs/2026-08-02-cucumber-product-contracts-design.md package.json pnpm-lock.yaml tsconfig.json Justfile tooling/quality/src/check-definitions.mts tooling/quality/src/diagnosticRegistry.test.mts tooling/quality/check-ci-completeness.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/check-config-drift.test.mts tooling/generators/src/blueprints/saasRegistrationProjections.ts apps/cli/src/index.ts apps/cli/src/index.test.ts apps/cli/src/types.ts apps/cli/src/router.ts apps/cli/src/commands.ts apps/cli/src/factory/createRootIntegration.test.ts tooling/agent-pack/evals/walking-skeleton/verifier.ts tooling/agent-pack/evals/walking-skeleton/walking-skeleton.test.ts packages/template-core/src/generated/template-contracts-legacy-baseline.json docs/template/app-factory-guide.md docs/template/customer-target-contract.md
  rtk git commit -m "refactor: remove superseded journey machinery"
  ```

- [ ] **Step 5: Verify and merge D1 before sealing.**

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts`

  Run on the remote worker: `rtk maestro-remote-test -- pnpm test:mutation`

  Run on the remote worker: `rtk maestro-remote-test -- pnpm verify`

  Run D1 through the protected Woodpecker merge queue. Expected: the pristine
  product passes, all 36 mutations are red for their named reason, and
  `ci/woodpecker/pr/verify` is green for the exact candidate. Qlty is advisory;
  no Buildkite/Fabro/Graphite authority is invoked.

**Unlock:** Only the official Cucumber chain remains active; the repository is
ready to seal from a clean source commit.

---

### Task 24: Seal, Publish, And Materialize `v0.2.0-alpha.3`

**Class:** `fixture-to-real`

**PR:** `D2`

**Depends on:** merged `D1`, merged `B1`, merged Brain `M2`, and the green
36-case gauntlet

**Files:**

- Generate and add: `releases/v0.2.0-alpha.3/**`

- [ ] **Step 1: Freeze a clean non-default source.** Start from a new clean
      worktree at current protected main after every dependency. Record its
      40-character source SHA. Assert `releases/v0.2.0-alpha.3` is absent and
      `apps/cli/src/factory/createComposition.ts` still names alpha.2.

- [ ] **Step 2: Seal the absent root without changing the default.** Run
      `rtk pnpm release:seal -- --version 0.2.0-alpha.3 --source-commit <recorded-40-character-source-sha> --base-version 0.2.0-alpha.2 --non-default`.
      Alpha.2 supplies only the immutable comparison/migration base; the
      recorded clean source commit supplies alpha.3's blueprint, ownership
      graph, contracts-audit closure, and migration declaration. Verify the
      generated manifest contains Cucumber/config/auth/controller, public-
      surface, contracts-audit, upgrade, and release assets and contains no
      custom journey/fake-proof machinery. The output set must contain only
      `releases/v0.2.0-alpha.3/**`; alpha.2, the pilot, and create composition
      remain byte-identical.

- [ ] **Step 3: Exercise the sealed release explicitly.** Generate fresh apps
      from the candidate release with one and multiple assembling Features;
      verify exact byte copies, primary journey, darkness, and zero-admitted
      behavior. Run contracts-add preview and its returned confirmation argv,
      the factory-only reference acceptance overlay, and template-instance plus
      Maestro-shaped unmanaged contracts-audit fixtures.

- [ ] **Step 4: Commit and verify only release bytes.**

  ```bash
  rtk git add releases/v0.2.0-alpha.3
  rtk git commit -m "release: seal cucumber product contracts alpha.3"
  ```

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm release:seal -- --check --version 0.2.0-alpha.3 --source-commit <recorded-40-character-source-sha> --base-version 0.2.0-alpha.2 --non-default`

- [ ] **Step 5: Merge, annotate, push, and verify the remote tag.** Run `D2`
      through the protected merge queue. After the verified release commit is on
      protected main, run:

  ```bash
  rtk git tag -a maestro-template-v0.2.0-alpha.3 <verified-protected-main-release-commit> -m "maestro template cucumber product contracts alpha.3"
  rtk git push origin refs/tags/maestro-template-v0.2.0-alpha.3
  rtk git ls-remote --tags origin maestro-template-v0.2.0-alpha.3 'maestro-template-v0.2.0-alpha.3^{}'
  ```

  Require the protected annotated tag-object OID and peeled release commit.
  Materialize an untouched customer target from a clean worktree detached at
  that peeled commit and verify archive, manifest, blueprint, source, and
  contracts-audit digests. Tag drift, a lightweight tag, or any materialization
  difference blocks `D3`; never move or reuse the tag.

**Unlock:** Alpha.3 is an immutable verified release, but alpha.2 remains the
public create/quickstart default.

---

### Task 25: Switch The Public Default After Tag Materialization

**Class:** `pattern-instance`

**PR:** `D3`

**Depends on:** remote annotated `D2` tag and untouched materialization green

**Files:**

- Modify: `apps/cli/src/factory/createComposition.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `docs/template/customer-target-contract.md`

- [ ] **Step 1: Write the default-switch test red.** Bind expected version,
      remote tag-object OID, peeled commit, manifest checksum, and blueprint
      checksum to the verified D2 values. Require the default create path to
      materialize from that remote tag. Prove a moved/lightweight tag,
      mismatched checksum, local-main fallback, or any change below
      `releases/v0.2.0-alpha.3/**` fails.

- [ ] **Step 2: Change only composition and default-facing docs.** Update the
      existing constants to the verified alpha.3 tag/digests; do not reseal,
      rewrite, or derive new release bytes. Keep explicit alpha.2 consumers
      valid.

- [ ] **Step 3: Verify untouched create and commit.**

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm --dir apps/cli test:create-root-integration`

  Run on the remote worker:
  `rtk maestro-remote-test -- pnpm release:seal -- --check --version 0.2.0-alpha.3 --source-commit <recorded-D2-source-sha> --base-version 0.2.0-alpha.2 --non-default`

  ```bash
  rtk git add apps/cli/src/factory/createComposition.ts apps/cli/src/factory/createRootIntegration.test.ts docs/template/app-factory-guide.md docs/template/customer-target-contract.md
  rtk git commit -m "release: make cucumber product contracts alpha.3 default"
  ```

  Run `D3` through the protected merge queue and repeat untouched create from
  the published tag. Expected: `ci/woodpecker/pr/verify` is the sole required
  context and no release byte changed.

**Final evidence:** Net duplicate journey/fake-proof code is deleted; one
official Cucumber execution chain proves behavior; new factory contracts begin
assembling; existing apps migrate without darkness; Brain passes UI and built
CLI; and only the app-bound Woodpecker merge-candidate verdict can authorize
admission.

## Spec-To-Task Traceability

| Approved success criterion                                   | Proof PR/task(s)         |
| ------------------------------------------------------------ | ------------------------ |
| Feature is sole behavioral contract                          | C1, C7, F1, B1, D1       |
| Create/contracts-add preserve assembling bytes               | F1                       |
| Existing feature golden path is contract-bound               | F2                       |
| Shared route actions cannot hide                             | C2, C3, C12              |
| Exhaustive public inventory/raw bypass                       | C3, C4, C12              |
| UI/server darkness                                           | C4, C11a, C11b           |
| UI+CLI inventory requires cross-surface proof                | C4, C11a, M1, M2         |
| Stacked slices; lifecycle/projection-only admission          | C4, W1, C11b, M1, M2     |
| Every Pickle/row/step/required hook executes once            | C7, C8, C9               |
| Exact Source/AST/step-definition equality                    | C7, C8                   |
| UI and built CLI share backend/identity                      | C6, C9, C11a             |
| Per-transport auth denial and protected-base strength        | C2, C4, C5, C11a, M1, M2 |
| Caller tenant cannot authorize                               | C5, C11a, C12            |
| Wrong exit/selection/retry/hook/protocol/runtime drift fails | C8, C9, C10, C12         |
| Existing-app adoption is additive and recoverable            | U1, P1, M0               |
| Candidate is secretless and cannot forge evidence/status     | W0, C10, C12, W1, M0b    |
| App-bound exact merge-group tuple/approval                   | W0, W1, M0b              |
| Staging tests/promotes one release manifest                  | R1                       |
| Protected annotated tag and separate default switch          | U1, W1, P1, D2, D3       |
| Build Pack human exact-byte provenance                       | B1                       |
| Complete mutation gauntlet                                   | C12, R1, W1, P1, D2      |
| Custom/fake machinery deleted after proof                    | F2, D1                   |
| Real Brain UI/CLI journey                                    | M1, M2                   |

## Final Program Verification

Run from committed current protected-main candidates, not a dirty design
worktree:

```bash
rtk maestro-remote-test -- pnpm acceptance:check
rtk maestro-remote-test -- pnpm acceptance
rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance
rtk maestro-remote-test -- pnpm exec vitest run tooling/acceptance/reference-app.test.ts
rtk maestro-remote-test -- pnpm test:mutation
rtk maestro-remote-test -- pnpm verify
```

From the committed Maestro `M2` head, run separately:

```bash
rtk maestro-remote-test -- pnpm acceptance:check
rtk maestro-remote-test -- pnpm acceptance
rtk maestro-remote-test -- pnpm verify
```

Then verify external state from the protected controller:

- in both repositories, the sole required context is `ci/woodpecker/pr/verify`
  bound to the repository's observed Woodpecker App ID; no Buildkite context is
  required, invoked, or accepted as evidence;
- merge queue/current-candidate enforcement and batch-one classification are
  active;
- code-owner approval is bound to the current PR head and stale approvals are
  dismissed;
- administrator/bypass actors are governed;
- candidate jobs have no secrets and the sandbox canary passes;
- the latest release manifest digest equals platform-observed web, CLI, backend,
  schema/migration, runtime-config, and admission-policy identities.
- both pilot and alpha.3 remote refs resolve to protected annotated tag objects,
  their peeled commits and manifest digests match their persisted
  `ContractsAuditUpgrade.source`/release facts, and update/deletion is denied;
- the `D2` peeled commit materializes alpha.3 without changing the alpha.2
  default, while `D3` changes only the four declared composition/default-doc
  paths and leaves every alpha.3 release byte identical to `D2`.

Do not declare the program complete from a branch-head test, a focused run, an
LLM review, an empty admitted inventory, or individually green slice pull
requests.
