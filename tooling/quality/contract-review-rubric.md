# Contract Review Rubric

This gate has two layers and both are required:

1. **Deterministic guardrails** — typecheck, lint, dependency-cruiser, layer
   boundary checks, debt/suppression counters, and the other `check-*` gates pin
   the known contract shapes. Removing a required gate or weakening the CI shape
   must turn CI red.
2. **Holistic non-deterministic pass** — the AI judge reviews PR scope for edge
   cases the deterministic rules cannot reliably see. Do not duplicate
   mechanical gates; judge whether the PR has the right shape.

CI already enforces typecheck, lint, formatting, dependency boundaries, and the
deterministic `check-*` gates. Do not re-check those mechanically; identify
contract gaps that require PR-level judgment or a new ratchet gate.

## Four-question bar

For each substantive changed file, ask:

1. Is this the simplest implementation that could work?
2. Is the abstraction at the right altitude — not over-engineered, not
   under-factored?
3. Could a naive developer read this file top-to-bottom and understand it?
4. Is this the right implementation, not merely a working one?

## Outcome-proof questions

1. Would the test fail if the promised user outcome stopped working?
2. Does it exercise the public surface named by the contract?
3. Would it still pass against a no-op, canned-success, or mocked product path?
4. Does it observe the important denial or absence outcome where applicable?

A yes to question 3 or no to questions 1 or 2 is a review finding. Semantic
usefulness remains advisory judgment, not a deterministic self-certification.

## Layer law

The repo layer law (AGENTS.md) is blocking contract:

```text
web routes -> screens -> features -> blocks -> Saas UI/shared primitives
client hooks -> @confect/react refs -> Confect specs -> Convex functions
agents -> workflows -> capabilities -> domain/checks -> schema
API/CLI/MCP -> headless registry -> same capabilities/workflows as web
storage/notifications/observability -> Effect services -> provider adapters
admin/support/privacy -> audited capabilities -> narrow operator surfaces
```

Flag semantic layer violations that dependency-cruiser may miss:

- Skipping layers for convenience instead of adding the missing boundary.
- Business logic in capabilities instead of domain modules.
- Deterministic logic written inline instead of imported from checks.
- Schema importing upward from checks/domain/capabilities/workflows/agents.
- Blocks importing Convex, Confect refs, route modules, provider SDKs, or
  workspace auth internals.
- Provider SDK imports or bare model calls outside adapter packages.
- New dumping-ground modules under any name.
- Duplicated business logic across web, API, CLI, or MCP surfaces instead of
  shared capabilities/workflows.

## Canonical system ownership

`docs/template/system-catalog.json` is the checked-in responsibility and schema
ownership contract. For a subsystem, capability, workflow, agent, route, or
table change, judge the meaning that deterministic checks cannot:

- Does the change reuse or extend the named canonical system, or does it build a
  parallel lifecycle under new nouns?
- Is a supposedly new system genuinely distinct from every catalog summary,
  responsibility, alias, table, and canonical entrypoint?
- Do actor-specific web/API/CLI/MCP/agent surfaces delegate to one owner, or do
  they introduce separate state, orchestration, or command implementations?
- Does an `introduce`, `replace`, or `retire` change include a reviewed system
  decision and, when applicable, a migration/feature-preservation plan?

Block unrecorded parallel systems and duplicated table families even when each
individual file obeys the layer law. The deterministic `check:system-catalog`
gate already checks exact table coverage, unique ownership, IDs, and paths; do
not reimplement those checks here.

Also inspect `docs/template/product-topology.json` and generated provenance. The
deterministic topology gate proves exact ownership coverage; semantic review
must still catch two differently named resources that own the same
responsibility, lifecycle, command authority, or durable state.

## Data and promotion contracts

- Every new durable table must have one entry in `data-resources.json` with an
  explicit tenant scope, sensitivity/PII posture, export/delete/retention
  behavior, workspace lifecycle, write authority, and migration decision.
- Block shadow tables, per-surface copies, read-model sprawl without a declared
  source of truth, and table families that duplicate an existing lifecycle.
- Code under `experiments/` and `private-packages/` is intentionally free to be
  rough, but it is not production code. Production must never import it or let
  it register a table, route, headless operation, job, or provider.
- Promotion re-scaffolds the learned contract through `template:add-feature` or
  the matching generator. Flag copied sandbox implementations that bypass the
  auth, tenancy, typed-state, audit, observability, rollout, entitlement,
  lifecycle, test, and provenance contract.

## Typed errors and tenancy

- Throw only typed errors from the closed error taxonomy; Confect specs declare
  args, returns, and expected errors. Untyped `throw new Error` in product
  layers is a finding.
- Every workspace/tenant-scoped read or write must guard tenancy explicitly
  (e.g. `row?.workspaceId !== ctx.workspace._id` with optional chaining). A
  query that returns another tenant's rows is a red finding.
- Capabilities stay `auth -> validate -> delegate -> return` with args and
  returns validators; workflows compose capabilities and do not call provider
  adapters directly; agents call capabilities or start workflows, never repos or
  adapters directly.
- No ambient time/random in logic; inject clocks/randomness.
- No secrets exposed to web code; no raw provider payloads, webhook bodies,
  tokens, or API keys in logs. Docs name secret env vars, never values.

## Suppression ban

Suppressions (`eslint-disable`, `ts-expect-error`, `@ts-ignore`, `nosemgrep`,
`istanbul ignore`) are debt. They may not be added without a comment explaining
the constraint and a backlog note, and never merely to make a red gate green.
Editing a gate file to make red turn green is a red finding.

## Ratchet rule

If this PR fixes a bad pattern found in review, audit, or an incident, the same
PR must make the pattern structurally impossible: an eslint rule with
adversarial tests, a dependency-cruiser edge, a debt metric, or an architecture
test. A follow-up is not enough for a known pattern fix.

## Meta-gate / CI security review

If the PR touches `.github/`, `.woodpecker/`, `tooling/ci/`, `tooling/quality/`,
`tooling/generators/`, `dependency-cruiser.config.cjs`, `eslint.config.mjs`, or
the contract reviewer itself, run the strict meta-gate review:

- No gate is deleted, renamed, made advisory, narrowed, or moved out of the
  required CI path.
- Secrets are never exposed to PR-controlled code. Secret-bearing CI steps must
  run repo-owned scripts and treat candidate file contents/diffs as data.
- Untrusted PR content must not be placed in shell/argv positions that can
  execute or override instructions; pass large untrusted packets through
  stdin/data files.
- LLM judges stay pinned, tool-less, fail-closed when running in CI, and treat
  reviewed content as untrusted data.

Sanctioned exception: files under `tooling/quality/`, `tooling/ci/`, and
`.woodpecker/` are CI infrastructure, not product code. Product layer rules
(adapter-only provider imports, dependency-cruiser edges, domain placement) do
NOT apply to CI tooling. CI judges (taste-review.mts, contract-review.mts)
calling model provider APIs directly is correct; they are not product
capabilities. Do NOT flag CI tooling for violating product layer discipline.

## Tests

Tests must assert behavior, not source text. New branching logic needs
meaningful failure-case coverage, not just happy path. A test should survive a
correct rewrite. New deterministic gates need adversarial tests that prove the
banned shape is caught. Fake/local providers are the test default; tests never
require live provider keys.

## File-lane review

- `product:` architecture, behavior, placement, typed errors, tenancy, tests.
- `test:` behavioral value and failure coverage.
- `meta-gate:` weakening/bypass/security review.
- `contract-doc:` implementation drift and whether the deterministic checker was
  updated to pin the contract change.

## Output contract

Return minified JSON only. Each finding must include:

- `severity`: `red`, `yellow`, or `green`.
- `path`, `line`, `issue`, `contract`, `fix`.
- `clause`: stable clause id such as `LAYER_LAW`, `TYPED_ERRORS`,
  `TENANCY_GUARD`, `SYSTEM_OWNERSHIP`, `META_GATE_SECURITY`, `SUPPRESSION_BAN`,
  `DATA_RESOURCE`, `PROMOTION_BOUNDARY`, `RATCHET`, `TEST_QUALITY`,
  `PR_HYGIENE`.
- `confidence`: `high`, `medium`, or `low`.
- `mechanicalGateCandidate`: `eslint`, `debt`, `depcruise`, `arch-test`, or
  `none`.
- `applyability`: `exact` when the fix is straightforward, otherwise
  `needs-human`.

Verdict: block on any red/yellow finding. Pass only with no findings. Green nits
may be omitted; do not invent findings.
