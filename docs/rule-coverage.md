# Rule Coverage

Every stated rule maps to the mechanism that enforces it. Enforcement tiers,
strongest first:

- **mechanical** — a tool measures the code itself and fails the build.
- **ai-judge** — an LLM gate reviews the diff against a pinned rubric in CI
  (fail-closed; deterministic fake mode locally).
- **pin-only** — a grep harness (`tooling/quality/src/gate.mts`) asserts that
  config/docs keep a pinned shape. It protects the gate structure; it does not
  measure behavior. Pin-only gates say `ok (pin-only)` in their output, and the
  highest-risk shape pins such as `check:generators` and
  `check:workflow-graph-boundary` print `(shape-only)` in the display name.
- **review** — humans/agents via the PR template checklist and rubric injection
  at pre-push. Weakest tier; anything resting here is a porting candidate.

## Layer law and contracts

| Rule                                                                                                                                       | Enforcement                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preserve layer law (imports respect layers)                                                                                                | mechanical: `check:layer-boundaries` (dependency-cruiser) + `eslint-plugin-template` (`no-cross-domain-value-import`, `workflow-steps-are-capabilities`)                                                                                                                                                  |
| Typed errors at Convex boundaries                                                                                                          | mechanical: `template/typed-convex-errors` ESLint rule                                                                                                                                                                                                                                                    |
| Domain errors are values, never thrown (a thrown tagged error inside `Effect.gen` = untyped defect that escapes the client error contract) | mechanical: `template/no-throw-tagged-error` (planners return `Either`) + `template/no-throw-in-effect-handler` (no throws in `*.impl.ts`) ESLint rules + `check:effect-diagnostics` (Effect language-service `floatingEffect`/`missingEffectError`)                                                      |
| Writes require a role gate                                                                                                                 | mechanical: `template/require-minrole-on-write` ESLint rule                                                                                                                                                                                                                                               |
| Workflow handlers stay deterministic                                                                                                       | mechanical: `template/workflow-handler-determinism`, `template/no-raw-scheduler` ESLint rules                                                                                                                                                                                                             |
| Workflow runs pin a policy snapshot                                                                                                        | mechanical: `template/workflow-policy-snapshot` ESLint rule                                                                                                                                                                                                                                               |
| Routes stay thin; server stays at boundary                                                                                                 | mechanical: `template/frontend-route-thin`, `template/frontend-route-server-boundary` ESLint rules                                                                                                                                                                                                        |
| Keep React Flow out of durable workflow logic                                                                                              | mechanical: `check:workflow-graph-boundary` file pins + dependency-cruiser                                                                                                                                                                                                                                |
| Use Confect/Effect contracts                                                                                                               | mechanical: `check:convex` codegen drift diff, semantic `check:confect-contracts`, `check:confect-manifest`, and `check:headless-surface-contract`; static compatibility: `check:confect-compat`; selected `@confect/test` contract paths cover runtime execution                                         |
| Preserve Confect v9 authoring model                                                                                                        | mechanical subset: `check:confect-v9` verifies v9 package pins, no root aggregate entrypoints, no `effect` barrel imports under `packages/convex/confect`, lazy `FunctionSpec` schema thunks, generated `databaseSchema` impls with finalize, and lazy table default exports without table-name arguments |
| Keep frontend Effect usage behind boundaries                                                                                               | mechanical: `check:frontend-effect-boundary` scans frontend roots for the approved Effect/TanStack/Effect Atom boundary: `Effect.runPromise` only in the web effect adapter, no client `effect` barrel imports, and `@effect-atom/*` imports only under approved prefixes                                 |
| Keep product env reads behind typed boundaries                                                                                             | mechanical: `check:env-boundary` scans `apps/` and `packages/` for direct `process.env`, `import.meta.env`, or `Deno.env` access outside the CLI decoder, web env shim, and Convex shared env accessor                                                                                                    |
| Keep provider SDKs behind adapters and runtime boundaries                                                                                  | mechanical: `check:provider-boundary` scans `apps/` and `packages/` for provider SDK imports outside approved integration/provider packages and explicit WorkOS/PostHog runtime boundary files                                                                                                            |
| Keep product logs behind redacted seams                                                                                                    | mechanical: `check:logging-boundary` scans `apps/` and `packages/` for product runtime `console.*` calls; product telemetry must go through typed redacted observability/notification seams                                                                                                               |
| Access lifecycle planner events are durably recorded                                                                                       | mechanical: `check:access-audit-events` pins member and invitation lifecycle impls to `recordAccessLifecycleEvents`; table/schema tests pin `accessAuditEvents` indexes and row shape                                                                                                                     |
| Do not edit generated files                                                                                                                | mechanical: `check:convex` (codegen + `git diff --exit-code`); pin-only: `check:generated-files`                                                                                                                                                                                                          |
| API/CLI/MCP generated surface parity                                                                                                       | mechanical: `check:headless-surface-contract` verifies generated manifest exposure has typed errors, idempotency-key enforcement proof, generated ref mappings, and no canned registry/runtime success shortcuts                                                                                          |

## Code quality

| Rule                              | Enforcement                                                                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting                        | mechanical: `check:format` (prettier); lefthook pre-commit auto-format                                                                                                     |
| Lint cleanliness, no `any`        | mechanical: `pnpm lint` (eslint strict + typescript-eslint), zero warnings tolerated in `verify`                                                                           |
| Strict types                      | mechanical: `pnpm typecheck` (strict tsconfig); `check:types-coverage` (`type-coverage --at-least 99.7`)                                                                   |
| No unused exports/deps            | mechanical: `check:knip`                                                                                                                                                   |
| Dependency hygiene                | mechanical: `check:deps` version pins; `pnpm install --frozen-lockfile` in CI                                                                                              |
| Coverage only rises               | mechanical: `check:coverage-ratchet` across every package incl. `packages/convex` and `apps/web` (vitest json-summary vs `coverage-baseline.json`; `--update` only raises) |
| Tests survive mutation            | mechanical: `test:mutation` (Stryker, scheduled/manual CI)                                                                                                                 |
| Single responsibility, naming     | ai-judge: `taste` gate (rubric pinned in `tooling/quality/taste-review.mts`)                                                                                               |
| Contract-shape review of the diff | ai-judge: `contract-review` gate (rubric: `tooling/quality/contract-review-rubric.md`)                                                                                     |
| Generated modules are born tested | mechanical: generator emits fast-check property tests; `check:generators` pins docs                                                                                        |

## Security and tenancy

| Rule                                  | Enforcement                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| No caller-supplied tenant identity    | mechanical: `template/require-minrole-on-write`; review: security docs + `check:auth-demo-bypass` (pin-only) |
| Secrets never committed               | mechanical: `check:secret-canaries` (gitleaks with real config)                                              |
| Provider SDKs stay behind adapters    | mechanical: `check:provider-boundary`; ai-judge: contract-review rubric lane                                 |
| Product env reads use typed decoders  | mechanical: `check:env-boundary`; focused tests cover bad app/backend reads and approved boundary files      |
| Provider payloads redacted before log | mechanical: `check:logging-boundary` plus unit tests on provider, notification, and observability redactors  |
| Licenses inventoried                  | pin-only: `check:sbom-license`                                                                               |

## Process and CI integrity

| Rule                                 | Enforcement                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CI gate structure cannot be weakened | mechanical-ish: secretless `ci-self-protection` Buildkite step runs `check:ci-completeness` + `check:config-drift` pins before any credentialed job                                                                                                                            |
| Canonical gate names stay stable     | pin-only: `check:ci-completeness` pins Justfile recipes, pipeline steps, lefthook config                                                                                                                                                                                       |
| Gates run before push                | mechanical: lefthook pre-push (typecheck, lint, deps, knip, gates, debt) + AI rubric injection (`scripts/pre-push-rubric.sh`)                                                                                                                                                  |
| Stacked PRs merge safely             | mechanical: `stack:preflight` / `stack:merge` (`tooling/stack`, injectable Runner, tested)                                                                                                                                                                                     |
| Docs stay navigable                  | pin-only: `check:docs-freshness`                                                                                                                                                                                                                                               |
| Hosted app works                     | mechanical: Playwright smoke + accessibility + visual baselines (`smoke:hosted:*`), static build smoke; the smoke suite asserts the Saas UI shell renders and the workflow card shows either a configured live Convex stream or an honest fake-safe/unseeded/unavailable state |
| Debt is visible                      | pin-only: `check:debt`; review: suppression ban in PR template                                                                                                                                                                                                                 |

## Known unenforced (candidates for the next ratchet)

- Audit-event persistence coverage is currently focused on member and invitation
  lifecycle mutations. Future admin surfaces should extend the same
  `recordAccessLifecycleEvents` discipline.
