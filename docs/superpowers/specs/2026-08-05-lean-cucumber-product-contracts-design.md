# Lean Cucumber Product Contracts

**Status:** Approved for implementation

## Purpose

Turn the product spec into an executable contract. A coding agent is finished
only when Cucumber can perform the promised behavior through a generated
application's real UI and real CLI against the same disposable backend.

The `.feature` file is the acceptance authority. There is no parallel journey
manifest, graph, receipt, evidence database, attestation, or controller.

## Chosen Approach

Three prototype shapes were considered:

1. A checker-only Gherkin demo is fastest but does not prove product behavior.
2. One real UI-to-CLI walking skeleton gives useful feedback with the least
   runtime work. **Selected.**
3. Building the complete four-scenario harness before the first run delays the
   most important architectural feedback.

The walking skeleton must pass before the remaining cases or factory-wide
workflow are generalized.

## Contract Format

Contracts live under `features/` and describe observable outcomes in business
language. They do not name implementation files, functions, tables, or test
machinery.

Every Feature has exactly one lifecycle tag:

- `@wip`: a draft promise; excluded from required execution;
- `@required`: an accepted promise; blocking at the final delivery head.

Every Scenario has exactly one interaction tag:

- `@ui`;
- `@cli`;
- `@cross_surface`.

A required Feature contains at least one `@cross_surface` Scenario. A Scenario
never combines interaction tags.

One small checker, using the installed Gherkin parser, enforces only:

- valid Gherkin;
- exactly one Feature lifecycle tag;
- exactly one Scenario interaction tag;
- at least one cross-surface Scenario in a required Feature.

Cucumber dry-run owns undefined and ambiguous step detection. Human review owns
whether steps are declarative and useful. The checker does not inspect source
code, topology, inventories, wording patterns, Pickles, Messages, or evidence.

## Reference Contract

```gherkin
@required
Feature: Manage workspace records
  A workspace member can manage the same records from the app and the CLI.

  @cross_surface
  Scenario: A record created in the app is available from the CLI
    Given the contracts workspace is ready
    When I create a record named "Launch checklist" in the app
    Then listing records from the CLI includes "Launch checklist"

  @cross_surface
  Scenario: A record created from the CLI is available in the app
    Given the contracts workspace is ready
    When I create a record named "Release notes" from the CLI
    Then the app shows a record named "Release notes"

  @cross_surface
  Scenario: A missing CLI API key cannot create a record
    Given the contracts workspace is ready
    When I try to create a record named "Rejected without a key" without a CLI API key
    Then the CLI reports that an API key is required
    And the app does not show "Rejected without a key"

  @cross_surface
  Scenario: A workspace-bound key cannot mutate another workspace
    Given the contracts workspace is ready
    When I try to create a record named "Rejected across workspaces" for another workspace
    Then the CLI reports that the API key is bound to a different workspace
    And the app does not show "Rejected across workspaces"
```

Progress is reported only as `0/4` through `4/4 scenarios`.

## Runtime

The Cucumber process starts the existing `maestro start --mode local` command
with free port overrides. That command continues to supervise local Convex,
Confect, and Vite; the contract runner introduces no daemon or service.

The runner generates one ephemeral API key in process memory and passes only its
SHA-256 hash to an idempotent internal local-fixture seed. The seed reuses the
canonical users, organizations, workspaces, memberships, and API-key tables. The
raw key is never written or logged.

Both surfaces use the fixed reviewer-facing slug `template-demo`:

- CLI capability execution uses the existing request shape and sends it to the
  generated app's `/api/<operationId>` boundary when `MAESTRO_API_BASE_URL` and
  `MAESTRO_API_KEY` are present.
- In contract mode, the records UI uses an HTTP adapter. Vite's development
  proxy attaches the same API key server-side, so browser code never receives
  the secret.

The HTTP boundary resolves the API key and workspace server-side, then invokes
record operations that reuse the existing records persistence and
`requireWorkspaceActorAccess`. It returns stable unauthorized and
workspace-bound denial results. There is no second records service or general
headless registry.

## Maestro Workflow

Generated targets ultimately expose:

```text
maestro contracts add <journey>
maestro contracts check
maestro contracts test [journey|--required]
```

- `add` writes one `@wip` Feature and never invents passing steps.
- `check` parses tags and runs Cucumber dry-run without starting the product.
- `test` runs the chosen contract through the existing local-start lifecycle.

`maestro create --outcome` seeds a personalized `@wip` first-outcome Feature.
Generated `AGENTS.md` makes the Feature → implementation → contract-test loop
part of ordinary product work.

These commands and factory projection follow the walking skeleton; they are not
prerequisites for its first pass.

## Verification

The harness is credible only if all of these are observed:

1. the UI-create → CLI-list Scenario fails before the runtime binding exists;
2. it passes through the real generated UI, CLI executable, and one local
   backend;
3. changing the visible `Save record` behavior in a disposable generated target
   makes it fail;
4. restoring the behavior makes it pass again.

Focused tests run while authoring. The complete generated-target proof and
repository verification run once at the frozen delivery head, followed by one
Woodpecker PR run.

## Removal And Scope

After the walking skeleton proves the replacement, remove the active custom
`packages/product-journey` authority, `check-product-journeys` gate, and their
factory projections. Historical plans and releases remain unchanged.

One delivery batch may use at most four implementation commits, 35 added or
modified source/test files, no new dependency, no new long-running process, and
roughly 3,000 maintained changed lines. Documentation and deletion of the old
authority do not consume the file budget. Stop if the design starts growing a
controller, gateway service, protocol, generalized auth framework, or persistent
acceptance store.

All recovery-analysis non-goals remain binding.
