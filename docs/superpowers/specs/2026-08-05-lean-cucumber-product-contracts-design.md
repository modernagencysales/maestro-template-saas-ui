# Lean Cucumber Product Contracts

**Status:** Approved direction; written specification awaiting user review

## Purpose

Make the natural-language product spec executable. A coding agent is finished
only when Cucumber can perform the promised behavior through the generated
application's real UI and real CLI against the same disposable backend.

This replaces the custom product-journey protocol with ordinary Gherkin,
Cucumber, Playwright, subprocess execution, and normal assertions.

## Problem

The template can currently merge many structurally valid slices without proving
that a user outcome works. `maestro create` records a one-line outcome, but that
outcome does not become an executable contract.

The attempted solution added a second verification platform:

- `packages/product-journey` defines manifests, graphs, leases, receipts,
  evidence, attestations, selection, and a custom runner;
- `check-product-journeys.mts` validates that protocol through adapters,
  inventories, hashes, migration ledgers, and reviewer identities;
- the Cucumber installation validates configuration and metadata, but the
  generated application has no required executable feature;
- normal `verify` does not prove a complete UI/CLI journey.

This machinery is larger than the problem and still permits a false green: it
can validate descriptions of evidence without exercising the promised product.

## Decision

Use Cucumber directly as the contract runner:

```text
features/*.feature
  -> Cucumber step definitions
  -> Playwright against the built web app
  -> subprocess calls to the built Maestro CLI
  -> one disposable backend shared by both surfaces
  -> ordinary assertions
  -> Cucumber exit status
```

The `.feature` file is the canonical acceptance contract. There is no parallel
JSON manifest, journey graph, receipt format, evidence database, attestation, or
controller.

## Alternatives Considered

1. **Keep and simplify `product-journey`.** Rejected because two contract
   languages can drift and the custom protocol remains work agents can satisfy
   without proving user behavior.
2. **Use Playwright tests alone.** Rejected because the contract would live in
   test code rather than reviewable product language, and CLI coverage would be
   bolted on separately.
3. **Use Cucumber as the only acceptance contract.** Selected because it keeps
   the promise, implementation binding, execution, and verdict in one standard
   toolchain.

## Contract Format

Contracts live under `features/`. They use business language and describe
observable outcomes, not filenames, functions, database tables, or test
implementation.

Each Feature has one lifecycle tag:

- `@wip`: the contract is being written and is excluded from normal execution;
- `@ready`: steps are bound and the journey runs during focused development;
- `@required`: the accepted product promise; it runs in the final blocking
  contract gate.

Scenarios declare their interaction surface with `@ui`, `@cli`, or
`@cross_surface`. A required Feature must cover UI and CLI and must contain at
least one cross-surface scenario. This is the deterministic proof that both
interfaces reach the same application behavior.

The lifecycle and surface rules are enforced by one small checker using the
already-installed Gherkin parser. It performs no product inventory, source-code
analysis, evidence generation, or custom result interpretation. Cucumber's own
undefined/ambiguous-step and exit-status behavior remains authoritative.

Example:

```gherkin
@required
Feature: Manage workspace records
  A workspace member can manage the same records from the app or the CLI.

  @cross_surface @ui @cli
  Scenario: A record created in the app is available from the CLI
    Given I am signed in to a disposable workspace
    When I create a record named "Launch checklist" in the app
    Then listing records from the CLI includes "Launch checklist"

  @cross_surface @cli @ui
  Scenario: A record created from the CLI is available in the app
    Given I am signed in to a disposable workspace
    When I create a record named "Release notes" from the CLI
    Then the app shows a record named "Release notes"

  @cross_surface @ui @cli
  Scenario: A denied mutation changes nothing
    Given I am signed out
    When I try to create a record from the CLI
    Then the CLI reports that authentication is required
    And the app does not show the rejected record
```

## Runtime Harness

The support code has four responsibilities only:

1. start and stop one disposable fake/test backend and built web app;
2. create a Playwright browser context and page;
3. invoke the built CLI with `spawn`, capturing exit code, stdout, and stderr;
4. reset scenario data and authentication state.

UI steps use accessible roles, labels, and visible text. CLI steps invoke the
same executable a user or coding agent invokes. Neither driver calls Convex,
repositories, fixtures, or internal capability functions directly.

The UI and CLI receive the same backend URL and workspace identity. Scenario
data uses a unique human-readable suffix so failures are diagnosable and runs do
not collide. Failed mutations are followed by a read through the other surface
to prove state did not change.

No screenshots, traces, JSON receipts, or custom evidence are required for a
pass. On failure, standard Cucumber output is authoritative; Playwright may
attach a screenshot as a debugging convenience only.

## Reference Journey

The first implementation proves one generated customer target, not the factory
demo in place. It uses the generated records vertical slice because that is the
smallest existing persisted behavior with a web surface.

The generated target must expose record create/list through its normal CLI
capability transport. If that transport is currently fake or in-process, this
batch replaces only those record operations with the existing authenticated HTTP
capability boundary so UI and CLI reach the same backend. It does not create a
second record service or general public-surface registry.

The reference Feature proves:

- UI create -> CLI read;
- CLI create -> UI read;
- signed-out mutation denial -> unchanged data;
- foreign-workspace mutation denial -> unchanged data.

This journey is the walking skeleton for later app-specific Features. The
harness is considered valid only when changing one observable product behavior
causes its corresponding scenario to fail.

## Maestro Workflow

Generated customer targets expose three commands through their existing
`maestro` CLI:

```text
maestro contracts add <journey>
maestro contracts check
maestro contracts test [journey]
```

- `contracts add` creates one `@wip` Feature with the lifecycle and UI/CLI
  structure. It never invents passing steps or marks the journey complete.
- `contracts check` validates Gherkin syntax, lifecycle/surface rules, and step
  bindings without starting the product.
- `contracts test` runs `@ready` and `@required` Features, or one named Feature.
  CI passes `--required` to run only accepted promises.

The updated customer blueprint makes `maestro create --outcome` seed one `@wip`
Feature named from the first outcome once the change is included in the next
normal template release. The generated `AGENTS.md` makes the contract loop part
of ordinary feature work:

```text
write/review Feature -> contracts check -> implement -> contracts test <journey>
-> promote to @required -> final batch verification
```

An agent may not mark a task complete merely because unit, type, lint, or build
checks pass. For product behavior, the affected required Feature must pass.

The factory blueprint and generator-output tests must prove that a target built
from the updated blueprint contains the contract files and commands. Publishing
that blueprint in a public template release remains part of the repository's
normal release process; this batch does not add a special release, tag, Brain
pilot, or default-cutover project.

## Removal

Delete the custom acceptance system rather than leaving two authorities:

- `packages/product-journey`;
- `tooling/quality/check-product-journeys.mts` and its tests;
- product-journey gate registrations and generated blueprint projections;
- manifest/graph/lease/receipt/evidence/attestation terminology in active agent
  and template instructions.

Keep Cucumber itself, the pinned `cucumber.cjs`, and only the smallest useful
parts of the current feature/config checks. Do not cherry-pick Tasks 1-10 from
the abandoned branch. Reimplement the few useful ideas against current main.

Historical plans and released artifacts remain immutable history. They are not
runtime authorities and are not rewritten to disguise what happened.

## Verification And CI

During implementation, each task runs only its focused tests. There is no PR or
full CI cycle per task.

At one frozen delivery-batch head:

1. generate a fresh customer target;
2. build its backend, web app, and CLI;
3. run `maestro contracts check`;
4. run `maestro contracts test --required` against the disposable backend;
5. run the repository's existing deterministic verification once;
6. submit one PR and let Woodpecker provide the sole blocking status.

Qlty remains advisory. No Buildkite, Fabro, controller, gateway, HMAC, COSE,
Bubblewrap, dependency proxy, runtime byte manifest, or custom container is
introduced.

## Scope Guard

This is one delivery batch with four implementation tasks:

1. replace the custom journey protocol with minimal Gherkin lifecycle checks;
2. make one generated records journey pass through real UI and CLI;
3. add `contracts add/check/test` and generated-target integration;
4. update agent/docs/gates and run one final batch verification.

Target at most roughly 3,000 maintained lines and 30 added or modified
source/test files; deleting the old package is encouraged and does not consume
that file budget. Prefer deletion over addition. Any new daemon, service,
protocol, cryptography, controller image, release campaign, or generalized
inventory is out of scope.

## Acceptance Criteria

The batch is complete when a fresh generated target contains a natural-language
required Feature, both cross-surface directions pass against one backend,
authorization failures prove unchanged state, mutating the implementation makes
the scenario fail, the old custom journey authority is absent from active
source, and the single Woodpecker batch gate is green.
