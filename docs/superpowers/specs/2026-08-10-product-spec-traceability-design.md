# Product Spec Traceability Design

**Status:** Awaiting written-spec review

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

A generated customer app has one root `product.contract.yaml`. An Effect Schema
is the runtime authority for its shape; a generated JSON Schema provides editor
feedback. Unknown keys, malformed IDs, blank strings, duplicate IDs, and invalid
lifecycle records fail closed. Existing workspace YAML and Effect dependencies
are reused.

Version 1 is deliberately small:

```yaml
schemaVersion: 1
product:
  id: records-demo
  name: Records Demo
  summary: Workspace members manage the same records from supported surfaces.

behaviors:
  - id: BHV-REC-001
    status: required
    title: A web-created record appears in the CLI
    actor: workspace member
    surfaces: [web, cli]
    preconditions:
      - The member has an active workspace.
    action: The member saves a record from the web form.
    outcomes:
      - Listing records from the CLI includes the saved title.

  - id: BHV-REC-003
    status: required
    title: A missing API key cannot create a record
    actor: CLI caller without an API key
    surfaces: [cli, web]
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
uses a versioned closed set owned by the schema. A schema version change is
required to add a new surface kind.

### IDs and lifecycle

Behavior IDs match `BHV-<DOMAIN>-<NUMBER>`, are globally unique in the contract,
are never reassigned, and remain present after retirement.

- `draft` is a proposed promise. It may be planned or tested but does not block
  delivery.
- `required` is an accepted product promise. It must satisfy every admission
  rule below.
- `retired` is no longer promised. Retirement requires a reason and may name a
  replacement behavior ID. Its history remains visible in generated docs.

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
      - capability:records.create
      - headless-operation:records.list
    work:
      kind: fixture-to-real
      target: records persistence
      persistenceOrProviderBoundary: packages/convex records repository
      followUpGates: [check:confect-contracts, check:headless-surface-contract]

proofs:
  - behavior: BHV-REC-001
    level: black-box
    surfaces: [web, cli]
    observation: The CLI lists the title created through the web form.
    failureWitness: If Save does not persist, the CLI cannot list the title.
  - behavior: BHV-REC-003
    level: black-box
    surfaces: [cli, web]
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
IDs, and each proof's surfaces must match its contract behavior's surfaces.

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

Acceptance tests live under `tests/acceptance/` and use Playwright's native test
metadata:

```ts
test(
  "a web-created record appears in the CLI",
  { tag: "@BHV-REC-001" },
  async ({ page }) => {
    // Interact through the running web app and CLI, then observe CLI output.
  },
);
```

Playwright 1.61.1 exposes these tags through
`playwright test --list --reporter=json`. Contract coverage consumes that native
JSON output. It does not scan TypeScript source, parse test names, introduce a
custom runner, or create a step registry.

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

## What Can Be Enforced

Two deterministic layers belong in the normal repository gates:

1. `pnpm lint` uses the existing ESLint/dependency machinery to enforce local
   acceptance boundaries, including forbidden product-internal imports and
   application-response mocking primitives.
2. `pnpm check:product-contract` validates the YAML schema, lifecycle, typed
   plan links, current App Map targets, Playwright-discovered tags, and
   generated documentation freshness. It is included in `pnpm verify`, because
   this is a cross-file repository check rather than an ESLint concern.

The black-box Playwright suite is also a required package-script gate in
`pnpm verify`. Both structural coverage and runtime acceptance observations are
registered in the existing gate/receipt machinery. A passing unit-test or
coverage gate cannot substitute for either one.

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

Coverage ratchets continue to prevent broad regression. Stryker remains useful
for selected pure logic. Neither is product-story evidence, and neither is run
indiscriminately merely to inflate a test count.

## Documentation and Receipts

`docs/product-contract.md` is generated from the typed contract and its
validated joins. It lists active and retired promises, lifecycle, surfaces,
typed plan links, App Map targets, and discovered acceptance-test locations. The
generated file is committed and byte-for-byte freshness checked; CI never
silently rewrites it.

The document describes proof coverage, not current verification. Current status
comes from the existing `.maestro/verification-receipt.json`, whose commit,
dirty-state, environment, scope, and gate bindings already become stale when the
subject changes. Delivery is complete only when the exact-head receipt contains
passing product-contract and acceptance observations and all other required
gates pass. Woodpecker remains the sole merge authority.

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

Reuse the current disposable backend/app startup, browser and API-key setup,
workspace isolation, CLI execution, cleanup, diagnostics, Records actions, and
denial fixtures. Move those mechanics behind narrow Playwright support helpers.

The candidate is credible only after this observed sequence:

1. all four Playwright behaviors pass through the real surfaces;
2. deliberately change `Save record` so it does not persist;
3. observe `BHV-REC-001` fail for the promised outcome;
4. restore the implementation and observe all four pass again;
5. generate docs and produce a current exact-head receipt.

The sabotage is temporary and never committed. After parity, remove the
`.feature` files, step definitions, Cucumber World/hooks/config, required-tag
selection adapter, `@cucumber/cucumber`, and their factory/customer projections.

## Trust Limits

This is evidence, not a mathematical proof of the whole application.

- Schema validation proves artifact shape and references, not the truth or
  completeness of the prose.
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
