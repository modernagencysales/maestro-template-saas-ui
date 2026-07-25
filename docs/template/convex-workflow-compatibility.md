# Convex Workflow Compatibility

Status: executable compatibility baseline; production workflow publication is
blocked until the semantic ledger and Phase 1 runtime fixtures pass.

## Pinned Set

| Package                | Current tested version | Posture                                                                                                          |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `convex`               | `1.42.1`               | pinned                                                                                                           |
| `@convex-dev/workflow` | `0.4.4`                | pinned with restrictions below                                                                                   |
| `@convex-dev/workpool` | `0.4.7`                | compatibility-only; duplicate completion/cancel regressions must be avoided or a proven fixed candidate selected |
| `convex-test`          | `0.0.54`               | component fixture harness                                                                                        |
| `@confect/*`           | `9.1.5`                | pinned contract/codegen set                                                                                      |
| `effect`               | `3.21.4`               | pinned contract/runtime set                                                                                      |

The machine-readable authority is
[`convex-compatibility.json`](./convex-compatibility.json). Package source under
the exact installed versions is the compatibility evidence; upstream docs are
useful context, not a substitute for fixtures.

Upstream references:

- [Convex Workflow 0.4.4 source](https://github.com/get-convex/workflow/tree/v0.4.4)
- [Convex Workpool releases](https://github.com/get-convex/workpool/releases)
- [Convex Workflow documentation](https://docs.convex.dev/agents/workflows)

## Audited Semantics

| Semantic                         | Pinned source truth                                                                                                                                                                                          | Maestro posture and repair                                                                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default kickoff                  | `startAsync` defaults to false and performs an eager first poll in the creating mutation. A caught initial handler failure can therefore commit a terminal workflow ID. It is not fail-fast atomic rollback. | Supported only as `eager-first-poll`; never describe it as fail-fast. Use queued kickoff when the caller must return before polling.                                      |
| Queued kickoff                   | `startAsync: true` creates the workflow and enqueues its first poll through Workpool.                                                                                                                        | Supported as an explicit kickoff profile.                                                                                                                                 |
| Scheduled child workflow         | `runWorkflow` accepts scheduling fields, but 0.4.4 does not preserve the required child workflow options through the complete component path.                                                                | Unsupported on 0.4.4. Use a named sleep followed by an unscheduled child as an explicitly non-equivalent repair, or upgrade only after matrix and behavior fixtures pass. |
| Handler `Date` and random        | The runtime patches `Date.now()`/zero-arg `Date` from generation state and seeds `Math.random()` by workflow ID.                                                                                             | Supported normalized primitives; they must not be described as upstream nondeterminism.                                                                                   |
| Locale/timezone formatting       | The 0.4.4 source explicitly leaves `Date#toLocale*`, timezone offset, and `Intl` normalization incomplete.                                                                                                   | Intentionally restricted. Format in a capability using explicit locale/timezone and journal the result.                                                                   |
| Ambient effects                  | Replay handlers do not own database, scheduler, environment, fetch, provider, or cryptographic-random effects.                                                                                               | Unsupported in handlers. Dispatch a versioned capability step.                                                                                                            |
| Payload preview/redaction        | Arguments enter the component before Maestro application redaction and component records may retain previews/values.                                                                                         | Do not claim pre-component redaction. Pass bounded identifiers or already-redacted values; keep secrets/provider payloads out.                                            |
| Cleanup                          | Cleanup is batched and nested cleanup can continue asynchronously; a return value cannot prove immediate full component deletion.                                                                            | Expose requested/in-progress/completed evidence and verify residuals through fixtures.                                                                                    |
| Event identity                   | `EventId` is a component-owned branded identifier; lookup/consumption belongs to the workflow component.                                                                                                     | Application code uses generated typed event contracts and never invents IDs or queries event storage directly.                                                            |
| Workpool scheduling              | Workpool derives `runAt` from `Date.now()` plus `runAfter`; admission may clamp execution and scheduled time is not actual start time.                                                                       | Record requested schedule separately from observed start; lateness policy uses observed timestamps.                                                                       |
| Terminal retry errors            | Workpool exports `NonRetryableError` to terminate retries.                                                                                                                                                   | Provider/domain errors map through a capability-owned retry strategy; workflow handlers do not throw raw terminal provider errors.                                        |
| Runtime closure                  | A function handle does not freeze every transitive module, capability binding, or interpreter dependency.                                                                                                    | Active/restartable runs require versioned graph, runner, completion ref, capability refs, and interpreter/source closure. Never call this immutable from a handle alone.  |
| Workpool 0.4.7 completion/cancel | Known duplicate-completion and cancellation races are not proven absent in Maestro.                                                                                                                          | Not production-supported until avoidance fixtures pass; evaluate 0.4.8 as a candidate without floating the lockfile.                                                      |

## Deliberately Stricter Maestro Policy

- Applications author graphs through the typed Maestro builder and generator.
- Workflow steps call versioned workflow-callable capabilities only.
- Stable unique step names, principal propagation, bounded Convex values, policy
  snapshots, explicit retry/dedupe posture, and immutable bindings are required
  even where the component API accepts looser input.
- Raw component imports are limited to exact generated runtime and
  compatibility-fixture paths.
- `check:workflow-graph-boundary` remains a shape-only check and cannot prove
  semantic compatibility.

Run `pnpm check:workflow:fast` while authoring and
`pnpm check:workflow-semantics` for the full executable ledger. Changing a
status requires its compiler mapping and positive or rejection fixture in the
same change.
