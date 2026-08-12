# Enforced Engineering Rules

This is the short, executable index for engineering rules. Use the focused
checks for the surface changed; run a full verification once for an integrated
batch, release candidate, or when the current checkout requires it. The current
checkout's scripts and configuration are authoritative when they differ from
this index. Never weaken a red deterministic gate to match this document.

Before Convex work, read `packages/convex/convex/_generated/ai/guidelines.md`;
it overrides remembered Convex patterns.

## Postures

| Posture               | Meaning                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| Deterministic blocker | A command or CI check that must pass for the changed surface.                   |
| Local authoring check | Run while editing to keep new code easy to review; repair owned findings.       |
| Conditional check     | Run only when its named surface or trust boundary changes.                      |
| Advisory review       | A Qlty, AI, or human finding. It informs review but is not the merge authority. |

## Baseline blockers and authoring limits

- TypeScript is strict. `pnpm check:types-coverage` blocks below **99.7%**;
  `pnpm typecheck` remains the focused type proof.
- The changed-code ESLint ratchet deterministically enforces function complexity
  **10**, nesting **4**, and parameters **5**. Keep those limits in new code.
- Qlty reports these eight advisory authoring thresholds: identical code **12
  lines**, similar code **15 lines**, function complexity **10**, file
  complexity **50**, return statements **5**, boolean logic **4**, function
  parameters **5**, and nested control flow **4**.
- Qlty excludes `tooling/**`. Existing monitored rule/path debt remains
  monitor-scoped; do not treat it as a reason to hide new owned-code findings.
- Dependency, secret, architecture, and Effect diagnostics have deterministic
  command owners below. Qlty's Gitleaks/OSV findings are advisory and do not
  replace the deterministic secret or dependency checks.

Local TypeScript authoring checks:

```sh
pnpm prettier --check <changed-files>
pnpm eslint -- <changed-files>
pnpm tsx tooling/quality/check-eslint-debt-ratchet.mts <staged-files>
pnpm check:qlty -- --staged
```

## Focused trigger index

| Changed area                                       | Deterministic blocker / conditional proof                                                                                                                      | Local authoring or advisory review                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TypeScript                                         | `pnpm typecheck`; `pnpm check:types-coverage`                                                                                                                  | ESLint ratchet and Qlty commands above                                                     |
| Feature or customer journey                        | `pnpm acceptance:syntax`; `pnpm acceptance:check` for `@required` bindings; `pnpm maestro -- contracts test <journey>`                                         | Exercise the promised UI and CLI behavior with real step bindings                          |
| Confect spec or implementation                     | `pnpm confect:codegen`; `pnpm confect:manifest`; `pnpm check:confect-contracts`; `pnpm check:effect-diagnostics`                                               | Check typed errors, auth denial, invalid input, and idempotency behavior                   |
| Exposed API, CLI, or MCP operation                 | `pnpm check:confect-manifest`; `pnpm check:headless-surface-contract`; focused CLI/MCP tests                                                                   | Verify generated-ref parity and denial paths                                               |
| Table, index, or lifecycle resource                | `pnpm data-resources:generate`; `pnpm check:data-resources`; `pnpm check:append-only-tables`; `pnpm check:schema-migration-notes`; `pnpm check:system-catalog` | Test export, retention, suppression, deletion, and cross-workspace denial where applicable |
| Workflow                                           | `pnpm check:workflow:fast`; `pnpm check:workflow-semantics`; `pnpm check:workflow-graph-boundary`                                                              | Test capability composition and replay-safe policy behavior                                |
| Route or UI                                        | `pnpm check:route-tree`; `pnpm check:layer-boundaries`; `pnpm check:frontend-effect-boundary`; focused web type/state/accessibility tests                      | Review loading, empty, ready, success, and failure states                                  |
| Provider, environment, logging, or secret boundary | `pnpm check:env-boundary`; `pnpm check:provider-boundary`; `pnpm check:logging-boundary`; `pnpm check:secret-canaries`                                         | Test invalid credentials/input, redaction, authorization, and provider failures            |
| Dependency                                         | `pnpm check:deps`; `pnpm check:knip`; `pnpm check:sbom-license`                                                                                                | `pnpm check:qlty -- --diff`; review license and vulnerability findings                     |
| Generated output                                   | The generator's emitted focused gates and `pnpm check:generated-files` when applicable                                                                         | Inspect the generated diff; never hand-edit generated authority                            |

Saas UI frontend changes also run the template ESLint rules for shell authority,
official primitives, and semantic colors across application, package, generator,
and generated-fixture source scopes.

Run the narrowest commands that cover the work. `pnpm verify` is a
full-batch/frozen-delivery check, not the default proof for every small task.

## Customer journeys

- `features/**/*.feature` is the customer-journey authority. Do not add a
  parallel journey manifest, evidence store, or acceptance controller.
- `pnpm acceptance:syntax` parses every draft Feature. `pnpm acceptance:check`
  dry-runs only `@required` bindings; Cucumber execution proves a named journey.
  Fix flakes rather than masking them with retries or parallelism.
- Promote an accepted journey only after
  `pnpm maestro -- contracts test <journey>` passes. For a batch containing
  accepted journeys, run `pnpm maestro -- contracts test --required` once on the
  delivery candidate.
- Journey and capability tests include authentication, role and cross-workspace
  denial, invalid input, typed errors, idempotency, and side-effect ordering
  when those behaviors apply.

## Required boundaries

- Derive tenant, actor, subject, and scope from authenticated server-side
  identity; never trust caller-supplied tenant identity.
- Treat workspace guards and cross-workspace authorization coverage as required
  whenever a surface reads or writes tenant-scoped data.
- Keep invalid test fixtures honest: do not use type escapes or casts to make an
  impossible production value appear valid.
- Keep prompt and model-policy boundaries explicit; a model may propose work,
  but it does not receive ambient authority to change deployment or data policy.
- Keep provider SDKs in adapters, runtime configuration in typed boundaries, and
  product logs behind redacted observability seams.
- Keep public Confect boundaries typed; expected failures are typed values, not
  thrown defects. Workflows compose capabilities and do not call adapters,
  repositories, raw scheduling, environment, or fetch directly.
- Every durable table has one canonical owner and lifecycle metadata. Use the
  reviewed table path, keep migration decisions with schema changes, and retain
  tested export/retention/suppression/deletion behavior.
- Generated route trees, Confect/Convex output, manifests, lifecycle runtime,
  workflow semantics, release payloads, and provenance are generator-owned.
  Regenerate them; never hand-edit them.
- API, CLI, and MCP use the generated operation authority. Preserve parity,
  typed errors, authorization, and idempotency; do not add a parallel registry
  or canned-success path.

## Factory and generated customers

Generated customers receive this index and their applicable Qlty configuration.
They run only commands present in their checkout. Woodpecker and other factory
CI paths are factory policy and reference-only here: a generated customer must
provide its own CI coverage rather than execute absent factory paths.

In the factory, Woodpecker is the blocking CI authority. Qlty remains advisory;
do not describe Qlty thresholds as Woodpecker blockers. The detailed mapping of
rules to mechanisms is in [rule coverage](../rule-coverage.md), and examples and
domain exceptions remain in [coding standards](coding-standards.md).
