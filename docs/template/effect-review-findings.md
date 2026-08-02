# Effect / Confect Review Findings

An adversarial review of the backend's Effect and Confect usage, run against the
pinned candidate toolchain (`effect@4.0.0-beta.102`, Confect `10.0.0-next.9`).
Every claim here was reproduced, not inferred. Fixes and new gates landed in the
same pass; this doc is the record of what was found and how it is now prevented.

## Headline: thrown tagged errors became untyped defects (FIXED)

**What.** Several `*.impl.ts` handlers surfaced domain failures by `throw`-ing a
`Schema.TaggedErrorClass` instance (`Forbidden`, `Unauthorized`,
`ValidationFailed`, …) from inside `Effect.gen`, either directly
(`requireActorRole`) or via a pure planner called in the generator body
(`changeMemberRole`, `buildProvisioningPlan`).

**Why it matters.** A `throw` reached from inside `Effect.gen` is captured by
the Effect runtime as a **defect** (`Cause.Die`), not a typed failure
(`Cause.Fail`). Confect's handler runner encodes only the **failure** channel
into a client `ConvexError`; a defect sails past that typed-failure encoder, the
fiber dies, and `runPromise` rejects with a generic internal error. The typed
error declared in the function `.spec.ts` — the entire value proposition of the
typed contract — **never reaches the client.**

**Proof.** Revalidated against `effect@4.0.0-beta.102`:

| Pattern                                        | Cause  | Through Confect's failure encoder       |
| ---------------------------------------------- | ------ | --------------------------------------- |
| `throw new Forbidden(...)` inside `Effect.gen` | `Die`  | defect leaks → generic 500              |
| `yield* new Forbidden(...)`                    | `Fail` | encoded → typed `ConvexError` to client |

This is now structurally impossible: planners return `Result` (no throw exists),
and two lint rules forbid reintroducing the pattern (see below).

**Sites fixed** (`access/` domain — the live, wired handlers):

- `access/members.impl.ts` — `requireActorRole` (×3 handlers) + the
  `changeMemberRole` / `removeMember` / `transferOwnership` planner calls.
- `access/invitations.impl.ts` — `requireActorRole`, `requireLoadedInvitation`,
  and the `buildWorkspaceInvitation` / `acceptInvitation` / `declineInvitation`
  planner calls.
- `access/provisioning.impl.ts` — both `buildProvisioningPlan` calls (throw
  `Unauthorized`) and the `requireInsertValue` invariant guard.

**Fix shape.** The pure planners no longer throw domain errors at all — they
return `Result<Success, DomainError>`, and the handler explicitly bridges a
failure into the Effect error channel:

```text
// planner (access/lifecycle.ts)
export const changeMemberRole = (input): Result.Result<Plan, MemberNotInWorkspace | Forbidden | LastOwnerProtected> =>
  Result.gen(function* () {
    yield* assertLiveWorkspaceMember(input.target, input.workspaceId);
    yield* assertActorCanManage(input.actorRole, input.target.role);
    ...
    return { patch, events };
  });

// handler (access/members.impl.ts)
const planned = changeMemberRole(input);
if (Result.isFailure(planned)) return yield* planned.failure;
const plan = planned.success;
```

Every internal assert helper (`assertActorCanManage`, `assertNotLastOwner`,
`requireNormalizedEmail`, `requireAccessibleInvitation`, …) returns
`Result<void|T, Error>` and is composed with `Result.gen`. This removes the
intermediate `fromThrowing` bridge entirely: there is no throw to convert
because there is no throw. Genuine never-happen invariants
(`requireInsertValue`) stay a plain `throw new Error(...)` — an intentional
defect, and a plain `Error` is explicitly allowed by the `no-throw-tagged-error`
rule below.

**Tests** moved from `.toThrow(X)` to `Result.isFailure(result)` +
`result.failure instanceof X`, and success paths unwrap the returned Result. The
10 lifecycle + 3 provisioning assertions were converted with their intent
preserved.

**Not changed on purpose.** `access/auth.ts` still throws plain `Error`
(`NO_WORKSPACE_ACCESS`, invariant guards) — see the latent finding below. It
throws no tagged errors, so it is clean under the rule; typing its domain
failures is deferred until the spine is wired to a handler.

## Test gap: no handler is driven end-to-end for the error channel

`access-confect-groups.test.ts` asserts only that handler **refs are
registered**; `access-lifecycle.test.ts` asserts the **pure planners** return
the right `Result.fail`. Nothing invokes a handler and asserts a typed `Fail`
reaches the boundary — which is exactly why the original defect leak was
invisible to a green suite. A full handler-invocation test needs a provisioned
Convex deployment (the investor packet already lists `@confect/test` coverage as
remaining client work). The planner-level `Result` tests now pin the failure
values directly; **recommend** adding provisioned handler tests that assert
`Cause.Fail` with the declared error for each public mutation, as the first
thing a client fork wires up.

## Latent: the access spine (`access/auth.ts`) throws untyped `Error`

`resolveEffectiveWorkspaceRole` / `requireWorkspaceMember` throw
`new Error("NO_WORKSPACE_ACCESS")`. Today this module is only exercised by unit
tests, so it is not a live leak — but it is the workspace-access spine, and the
moment it is wired into a handler its throws become **both** untyped **and**
defects, and the `NO_WORKSPACE_ACCESS` code (already in
`shared/errors.ts#ErrorCode`) is lost. **Recommend** converting these to typed
errors when the spine is connected; tracked as a backlog item, deliberately not
force-fixed on a disconnected module.

## Optimizations (non-blocking)

- **Redundant catch** — `integrations/src/llm.ts#captureTelemetrySafely`
  composes `Effect.tryPromise({ catch })` **and** `.pipe(Effect.catch(...))`;
  the constructor catch maps rejection and the outer catch neutralizes that
  typed failure. Best-effort telemetry intentionally swallows it at this
  boundary.
- **Raw clock reads** — handlers call `Date.now()` / `new Date()` directly
  (`members.impl.ts`, `invitations.impl.ts`, `provisioning.impl.ts`, `llm.ts`).
  Functionally fine in a Convex mutation, but the repo ships a `Clock` service
  (`shared/clock.ts`) and a determinism module; routing clock reads through a
  service makes handlers trivially time-mockable and is the pattern the workflow
  layer already enforces. Consider an injected clock for consistency.

## Gates added (so this class of bug cannot return)

- **`template/no-throw-tagged-error`** (new ESLint rule) — bans `throw`-ing any
  `Schema.TaggedErrorClass` (a binding imported from an `errors` module, or an
  in-file `class … extends Schema.TaggedErrorClass`) anywhere in
  `packages/convex/confect/**`. This is the source-level gate that makes the
  throwing-planner pattern impossible: domain errors must be `Result.fail` /
  `Effect.fail` / `yield*`. Plain `throw new Error(...)` for a real invariant is
  still allowed (an intentional defect).
- **`template/no-throw-in-effect-handler`** (new ESLint rule) — bans any `throw`
  in a `*.impl.ts` handler (stricter than the above: even a plain-`Error`
  invariant must be `Effect.dieMessage` in a handler). Together the two rules
  cover what the Effect language-service does **not**: a thrown value is not a
  "floating effect", so the LSP is blind to it. Both unit-tested in
  `tooling/eslint-plugin-template/rules/__tests__/rules.test.mjs`.
- **`check:effect-diagnostics`** (new `verify` step) — runs the Effect
  language-service (`@effect/language-service`) diagnostics over the backend as
  a fail-closed CI gate: `floatingEffect`, `missingEffectError`,
  `missingEffectContext`, `leakingRequirements`,
  `missingEffectServiceDependency`, `missingReturnYield` promoted to errors.
  Editor parity via the tsconfig plugin; `effect-language-service patch` is
  available to fold these into `tsc` itself. Current status: **0 errors, 0
  warnings across 233 files.**

All three gates run in the local `verify` chain and belong in the Buildkite
phase-1 deterministic suite.
