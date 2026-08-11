# Product Spec Traceability Design

**Status:** Approved for implementation

## Purpose

Make a generated application's product promises traceable from specification to
plan, implementation, acceptance proof, documentation, and an exact-head
verification receipt. The system should make it difficult for an AI agent to
claim a feature is complete after writing only tautological unit tests.

The smallest durable design uses machinery already present in the template:
Effect Schema, YAML, typed work packages, the App Map, Playwright, generated
documentation, package-script gates, and Maestro verification receipts. It does
not adopt HitchStory, rewrite HitchStory, or retain Cucumber as a second
acceptance authority.

This design deliberately supersedes the current Cucumber authority in
`AGENTS.md`. Cutover is incomplete until the factory instructions, generated
customer instructions, scripts, projections, tests, and quality pins all name
the new authority. Immutable historical releases under `releases/**` are never
rewritten.

## Authority Model

Each artifact has one job:

| Artifact                        | Authority                                                          | Must not claim                                  |
| ------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `product.contract.yaml`         | Observable product promises and lifecycle                          | Implementation detail or verification status    |
| Typed plan frontmatter          | Work-package, App Map, and proof mapping for behavior IDs          | That implementation has passed                  |
| Product code                    | Implementation                                                     | Its own correctness                             |
| `tests/acceptance/**/*.spec.ts` | Black-box examples linked by native Playwright tags                | Broader behavior than the observation exercises |
| Generated product docs          | Human-readable projection of the contract and its links            | Stale or stored `verified: true` state          |
| Maestro receipt                 | Gate results for the exact repository head and environment posture | Product truth after its bindings become stale   |

The flow is:

```text
product.contract.yaml
        │ stable behavior IDs
        ├───────────────┬──────────────────┬───────────────────┐
        ▼               ▼                  ▼                   ▼
typed plan         App Map targets   Playwright tags   generated docs
work packages      named by plan     on black-box tests  and links
        └───────────────┴──────────────────┴───────────────────┘
                                │
                                ▼
                     exact-head verification receipt
```

Only projections self-update. Product promises and historical plans never
rewrite themselves from code or tests. A changed promise is a deliberate
contract edit and review event.

## Typed Product Contract

A generated customer app has one root `product.contract.yaml`. Its Effect Schema
lives in `packages/template-core`, alongside the promoted `WorkPackageSchema`;
`packages/app-idea-evaluator` re-exports that existing work package API. A
checker under `tooling/acceptance` owns YAML loading and receives `yaml` as a
direct dependency. A generated JSON Schema provides editor feedback. No new
workspace package is introduced. Unknown keys, malformed IDs, blank strings,
duplicate IDs, and invalid lifecycle records fail closed. Every behavior has a
nonblank title, actor, and action plus at least one surface and outcome;
preconditions may be empty when the promise has none.

Version 1 is deliberately small:

```yaml
schemaVersion: 1
product:
  id: records-demo
  name: Records Demo
  summary: Workspace members manage the same records from supported surfaces.

behaviors:
  - id: BHV-REC-001
    revision: 1
    status: required
    title: A web-created record appears in the CLI
    actor: workspace member
    surfaces: [web-ui, cli-process]
    preconditions:
      - The member has an active workspace.
    action: The member saves a record from the web form.
    outcomes:
      - Listing records from the CLI includes the saved title.

  - id: BHV-REC-003
    revision: 1
    status: required
    title: A missing API key cannot create a record
    actor: CLI caller without an API key
    surfaces: [cli-process, web-ui]
    preconditions:
      - The workspace does not contain the proposed title.
    action: The caller requests record creation without an API key.
    outcomes:
      - The CLI reports that an API key is required.
      - The web app still does not show the proposed title.
```

The contract contains observable language only. Source paths, functions, tables,
shell commands, fixtures, test mechanics, and database assertions are rejected
by review rather than invented as another unreliable prose parser. `surfaces`
uses a versioned closed set owned by the schema. Version 1 permits only the
surfaces the acceptance harness can exercise directly: `web-ui`, `cli-process`,
and `public-http`. A schema version change may add another surface kind only
with its real-surface adapter and admission rules in the same delivery batch.

### IDs and lifecycle

Behavior IDs match `BHV-<DOMAIN>-<NUMBER>`, are globally unique in the contract,
are never reassigned, and remain present after retirement. Each behavior has a
positive integer `revision`. A semantic change to actor, surfaces,
preconditions, action, or outcomes increments it and invalidates plan proof
bindings to the previous revision.

- `draft` is a proposed promise. It may be planned or tested but does not block
  delivery.
- `required` is an accepted product promise. It must satisfy every admission
  rule below.
- `retired` is no longer promised. Retirement requires a reason and may name a
  replacement behavior ID. Its history remains visible in generated docs.

The allowed lifecycle is `draft -> required -> retired` or `draft -> retired`.
`required -> draft` is forbidden, replacement IDs must name a non-retired
behavior, and retired records are immutable. In addition to current-state shape
and reference checks, delivery validation loads the contract from the trusted
merge base, using the same target-branch resolution pattern as
`tooling/quality/check-workflow-version-immutability.mts` and
`CI_COMMIT_TARGET_BRANCH`. It rejects edits to an already retired record,
missing historical IDs, invalid status transitions, any revision decrease, and
semantic field edits whose revision is not greater than the trusted-base
revision. Review of the contract diff still owns whether an unclassified wording
edit is semantic and who approved a reduction; deterministic comparison prevents
history from being silently rewritten.

Any delivery head containing a `required` behavior is inadmissible unless the
behavior has a typed plan mapping, resolved App Map targets, a discovered
black-box acceptance test, fresh generated docs, and passing acceptance evidence
on that head. No file stores `verified: true`; current verification is always
derived from the receipt.

## Typed Guided Plans

Plans remain readable Markdown. YAML frontmatter supplies the strict join keys;
the prose body supplies sequencing and engineering judgment. This avoids turning
the product YAML into an executable step language.

```yaml
---
planSchemaVersion: 1
productContract: product.contract.yaml

workPackages:
  - id: WP-REC-001
    behaviorIds: [BHV-REC-001, BHV-REC-003]
    appMapTargets:
      - route:records
      - headless:executor
    work:
      kind: fixture-to-real
      target: records persistence
      persistenceOrProviderBoundary: packages/convex records repository
      followUpGates: [check:confect-contracts, check:headless-surface-contract]

proofs:
  - behavior: BHV-REC-001
    behaviorRevision: 1
    level: black-box
    surfaces: [web-ui, cli-process]
    observation: The CLI lists the title created through the web form.
    failureWitness: If Save does not persist, the CLI cannot list the title.
  - behavior: BHV-REC-003
    behaviorRevision: 1
    level: black-box
    surfaces: [cli-process, web-ui]
    observation: The CLI rejects the call and the web list remains unchanged.
    failureWitness:
      If authorization mutates before rejecting, the title appears.
---
```

Each `work` value is validated by the existing `WorkPackageSchema` union:
`pattern-instance`, `fixture-to-real`, or `template-gap`. The wrapper adds only
the behavior IDs, App Map node IDs, and proof obligations needed for
traceability. Required behavior targets must resolve in the current App Map;
draft work may name an unresolved target only through a `template-gap` package.
The union of work-package behavior IDs must equal the union of proof behavior
IDs. Every required behavior has at least one `black-box` proof whose revision
and surfaces exactly match the contract. Active plans and tests cannot cite a
retired behavior.

The checker validates only plans that opt into `planSchemaVersion`. Existing
historical plans remain unchanged, but they cannot satisfy a new required
behavior. Every required behavior must be covered by at least one typed plan, so
an untyped AI plan cannot close the contract.

The planning skill changes its questions and output order:

1. Write or select draft behavior IDs before implementation tasks.
2. Capture actor, action, observable success, and important denial or absence
   promises. A denial with independent product value gets its own behavior ID.
3. Search the current App Map and classify each work package with the existing
   union.
4. Design black-box proof first, including the observation and a concrete
   failure witness.
5. Add focused unit or integration tests only for identified implementation
   risks such as branching, parsing, authorization, idempotency, or error
   translation.
6. Generate docs, run focused checks, and promote a behavior only after its
   acceptance test passes.
7. Run full verification once at the immutable delivery head and inspect the
   resulting receipt before claiming completion.

## Native Playwright Acceptance

Generated customers receive `playwright.acceptance.config.ts` and acceptance
tests under `tests/acceptance/`. The config pins one Chromium project,
`forbidOnly: true`, zero retries, and one worker. The repository pins
`@playwright/test` to the exact tested version rather than relying on the
current caret range. Tests use Playwright's native metadata:

```ts
test(
  "a web-created record appears in the CLI",
  { tag: "@BHV-REC-001-R1" },
  async ({ page }) => {
    // Interact through the running web app and CLI, then observe CLI output.
  },
);
```

Playwright 1.61.1 exposes these tags through
`playwright test --list --reporter=json`. Contract coverage consumes that native
JSON output. It does not scan TypeScript source, parse test names, introduce a
test execution engine, or create a step registry.

The tag binds both stable identity and contract revision:
`@<BEHAVIOR-ID>-R<REVISION>`. A contract revision therefore invalidates an old
acceptance binding until the example is deliberately reviewed and retagged.

Two scopes stay distinct:

- `pnpm acceptance:required` reads the required behavior IDs and revisions from
  the contract, passes their escaped revision-tag pattern to the pinned
  Playwright config, writes a temporary JSON report, and is the blocking runtime
  gate.
- `pnpm acceptance:all` is an explicit authoring command for draft and required
  examples. Drafts have no required coverage and cannot block delivery merely
  because they exist in the contract.

The selector is a thin argv adapter around Playwright, not a runner. The
structural checker and runtime command use the same config and revision-tag
parser. The checker rejects `only`, `skip`, `fixme`, `fail`, retries, unknown or
retired tags, stale revisions, an empty required selection, and any required
revision absent from the selected test set. Static lint rejects `test.only`,
`test.skip`, `test.fixme`, and `test.fail`, including conditional forms; runtime
validation is the backstop for annotations created indirectly.

The gate does not equate Playwright's exit code with proof. It parses the JSON
runtime report and joins executed test identities back to the discovery set. For
every required revision tag, at least one selected result must exist, and every
selected result must have actual status `passed`, expected status `passed`,
retry index `0`, and no skip, fixme, fail, expected-failure, or flaky outcome.
Missing, unexecuted, skipped, expected-failure, or flaky results fail the gate
even when Playwright exits zero. Discovery alone is never reported as acceptance
evidence.

An admitted acceptance test:

- runs the real generated app against a disposable backend;
- interacts through UI, CLI, or public HTTP boundaries;
- observes externally visible output or state;
- does not import application internals or query the database directly;
- does not mock application responses;
- carries exactly one known behavior tag.

Every `required` behavior has at least one discovered acceptance test. Every
tagged acceptance test refers to a known non-retired behavior. A behavior may
have multiple examples, but a single test cannot claim several behavior IDs.

Shared helpers may start and stop the disposable runtime, provision workspace
fixtures, create API keys, invoke the CLI process, and collect diagnostics. They
remain test mechanics, not a business-step DSL. Scenario control flow stays
visible in the Playwright test.

The runtime always starts a fresh `maestro start --mode local` process from the
current checkout on free ports, provisions a disposable backend namespace, and
terminates it after the run. `cli-process` means a child `maestro` process, not
an in-process function call. `web-ui` means role/label interaction with the
rendered app, not direct HTTP. Web and CLI receive the same runtime API base and
workspace fixtures. Hosted URL overrides are not accepted by this suite.

Scenario files may import only Playwright, Node built-ins, and acceptance
support. The whole acceptance tree may not import `apps/**`, product
`packages/**`, Convex/Confect internals, or database clients. Scenario files may
not use network interception, HAR replay, `page.evaluate`, storage injection,
dynamic imports, or mocking APIs. One audited support proxy may attach the
scenario API key and forward an unmodified response from the same disposable
backend; it may never synthesize success and has adversarial tests for
forwarding failure and redaction.

## What Can Be Enforced

Two deterministic layers belong in the normal repository gates:

1. `pnpm lint` uses the existing ESLint/dependency machinery to enforce local
   acceptance boundaries, including the recursive import rules, scenario API
   bans, `only`/`skip`/`fixme`/`fail`, and synthetic application responses. Each
   rule has an adversarial failing fixture.
2. `pnpm check:product-contract` validates the YAML schema, lifecycle, typed
   plan links, current App Map targets, Playwright-discovered tags, and
   generated documentation freshness. It is included in `pnpm verify`, because
   this is a cross-file repository check rather than an ESLint concern.

`pnpm acceptance:required` is also a required package-script gate in
`pnpm verify`. Both structural coverage and runtime acceptance observations are
registered in the existing gate/receipt machinery. The observation's canonical
argv re-reads the exact-head contract, so its selected IDs are derived rather
than copied into a second manifest. A passing unit-test or coverage gate cannot
substitute for either one.

The repository cannot honestly lint whether a story or assertion is useful.
Instead, the existing advisory contract-review rubric gains four explicit
questions:

- Would the test fail if the promised user outcome stopped working?
- Does it exercise the public surface named by the contract?
- Would it still pass against a no-op, canned-success, or mocked product path?
- Does it observe the important denial or absence outcome where applicable?

A “yes” to the third question or “no” to either of the first two is a review
failure. This review remains advisory/human judgment; it never manufactures a
deterministic pass.

The runtime report proves that revision-bound examples executed and produced
their declared passing observations. It does not mechanically infer from
arbitrary Playwright code that every declared surface was meaningfully used, or
that an assertion caused the promised outcome. Surface use and causal strength
remain explicit review findings under the rubric above. Therefore the
deterministic admission status is “runtime execution observed”; semantic
usefulness remains `unproven`, never silently promoted to mathematical proof.

Coverage ratchets continue to prevent broad regression. Stryker remains useful
for selected pure logic. Neither is product-story evidence, and neither is run
indiscriminately merely to inflate a test count.

## Documentation and Receipts

`pnpm product-contract:generate` reads the typed contract, opted-in plan
frontmatter, current App Map, and native Playwright listing, then writes the
editor JSON Schema and `docs/template/generated/product-contract.md`. The
document lists active and retired promises, behavior revisions, lifecycle,
surfaces, typed plan links, App Map targets, and discovered acceptance-test
locations. Generated files are committed and `check:product-contract` compares
their bytes; CI never silently rewrites them.

The document describes proof coverage, not current verification. Current status
comes from the existing `.maestro/verification-receipt.json`, whose commit,
dirty-state, environment, scope, and gate bindings already become stale when the
subject changes. The deterministic acceptance gate validates the temporary
per-test and per-behavior JSON results; the exact-head receipt records only the
atomic gate result and canonical command. It does not become a second evidence
database. Delivery is complete only when the receipt contains passing
product-contract and acceptance observations and all other required gates pass.
An agent may claim delivery only from a clean committed checkout; dirty receipts
are authoring feedback, never delivery evidence. Woodpecker recomputes
`pnpm verify` for the PR head and never trusts a candidate-authored receipt.
Woodpecker remains the sole merge authority.

This separation prevents three common lies: implementation cannot edit its own
promise, generated docs cannot preserve an old green badge, and a passing test
from an earlier commit cannot prove the current head.

## Cucumber and HitchStory Decision

HitchStory's useful ideas are retained: a readable non-Turing-complete spec,
strict schema validation, and generated documentation. Its Python runtime is not
adopted because the template already has the required schema, test, docs, and
receipt components in TypeScript. Rewriting it would add a framework whose
central step/handler abstraction this design intentionally avoids.

Cucumber is not kept in tandem. Its readable scenarios helped establish the
acceptance boundary, but its string-matched steps duplicate the typed contract
and hide proof mechanics in glue. During migration it remains green only until
Playwright parity is demonstrated; after cutover there is one contract and one
acceptance runner.

Cutover updates the complete active authority in one delivery batch:

| Surface                       | Replacement                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Seed sources                  | `product.contract.yaml`, typed Records plan, Playwright config/spec/support                          |
| Factory projection            | Project the contract, plan, generated docs, checker, config, and tests                               |
| Customer scripts and `verify` | Replace Cucumber scripts/CLI calls with product-contract and Playwright gates                        |
| Operator policy               | Replace Feature authority in `AGENTS.md`, planning skill, coding standards, and enforced-rules index |
| Provenance and tests          | Name the new generated paths and reject active Cucumber files/dependencies                           |
| Historical releases           | Leave `releases/**` unchanged                                                                        |

OpenAPI, AsyncAPI, Pact, and schema-first API tools remain useful for their own
protocol boundaries but do not connect user promises, UI/CLI behavior, plans,
docs, and exact-head evidence. Adding one would not remove any component in this
design.

## Records Migration and Credibility Trial

The existing Records feature is the walking skeleton. Its four promises become
four stable behavior IDs:

1. web create appears in CLI list;
2. CLI create appears in the web list;
3. missing API key is rejected without mutation;
4. a workspace-bound key cannot mutate another workspace.

Reuse the current disposable backend/app startup, API-key setup, workspace
isolation, CLI-process execution, cleanup, diagnostics, and denial fixtures.
Replace Cucumber World/hooks with native Playwright worker/test fixtures and
keep the four scenario flows visible in `records.spec.ts`.

The candidate is credible only after this observed sequence:

1. all four Playwright behaviors pass through the real surfaces;
2. deliberately change `Save record` so it does not persist;
3. observe `BHV-REC-001` fail for the promised outcome;
4. restore the implementation and observe all four pass again;
5. generate docs and produce a current exact-head receipt.

The denial tests use unique sentinels and an independent authorized CLI read to
prove the source and destination workspace state stayed unchanged. The one
sabotage is a walking-skeleton check that the harness detects a broken product
path, not a claim of universal mutation coverage. It is temporary and never
committed. After parity, remove the `.feature` files, step definitions, Cucumber
World/hooks/config, required-tag selection adapter, `@cucumber/cucumber`, and
their factory/customer projections. Also remove the Cucumber-specific
`maestro contracts` CLI route rather than retargeting it into another
abstraction; package scripts are sufficient.

## Trust Limits

This is evidence, not a mathematical proof of the whole application.

- Schema validation proves artifact shape and references, not the truth or
  completeness of the prose.
- Contract wording, lifecycle reductions, and whether an assertion is useful
  remain explicit review judgments; deterministic gates prove only their stated
  structural and runtime observations.
- A passing revision-bound runtime result does not mechanically prove causal
  strength or meaningful use of every declared surface; those remain review
  obligations, and the generated docs and receipt do not label them proven.
- A black-box example proves the observed path in its test environment, not all
  inputs or production health.
- Generated docs prove freshness against their sources, not that a deployed
  environment matches the repository.
- An exact-head receipt prevents stale local claims; live deployment truth still
  requires an explicit live gate.
- AI review can identify weak tests but cannot self-certify semantic usefulness.

These limits are reported as `unproven`, never rounded up to success.

## Non-goals

The first implementation does not add:

- a HitchStory clone, Gherkin parser, step registry, inheritance system, or
  executable YAML;
- a second journey manifest, evidence database, controller, daemon, or hosted
  specification service;
- source-text heuristics that pretend to understand test semantics;
- a contract CRUD UI or new long-running process;
- automatic edits to promises or historical plans based on implementation;
- a requirement that every unit test map to a product behavior;
- broad mutation testing as a delivery gate.

Add any of these only after the typed Records path is operating end to end and a
measured limitation cannot be solved by the existing components.
