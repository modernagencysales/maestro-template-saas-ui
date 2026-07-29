# Factory Remediation: F-001–F-044 and External-User Union

Status: active. This is the durable remediation ledger for the upstream Maestro
SaaS application factory. It must remain current through reproduction, fixes,
fresh-customer proof, and final handoff.

## Scope and authority

- Primary authority: `/home/maestro/change-signal/docs/factory-evaluation.md`,
  findings `F-001` through `F-044`, evaluated at template commit `35c5bd1`.
- Additive read-only authority:
  `/home/maestro/jungler-better-listening/docs/external-user-test-failures.md`,
  findings `F-01` through `F-85` as observed on 2026-07-29. Stable ledger IDs
  use the `ES-F-` prefix so source coordinates cannot collide with ChangeSignal.
- Remediation target: `/home/maestro/maestro-template-saas-ui` on `main`,
  fast-forwarded cleanly to `f55653a0` before remediation.
- ChangeSignal is evidence-only except for status updates after direct upstream
  proof. Signal Scout is strictly read-only evidence.
- No pipeline mutation, deployment, secret access, threshold increase, broad
  ignore, fabricated authority, generated-file hand edit, or fake-success path
  is authorized.

## Coordination checkpoint

- Agent Mail identity: `SwiftBadger`.
- Project key: `/home/maestro/maestro-template-saas-ui`.
- Initial exclusive reservations:
  `docs/template/factory-remediation-f001-f044.md` and
  `docs/template/factory-remediation-f001-f044.evidence.json`.
- Startup inspection: template and ChangeSignal worktrees were clean; Signal
  Scout already had unrelated edits to its failure ledger and remains untouched.
- Historical search: CM returned no rules; CASS was unavailable because its
  lexical checkpoint is incomplete. Current source/tests remain authoritative.

## Work-package classification

All remediation is a `template-gap` repair against the existing application
factory and customer materialization boundary. No new product subsystem is being
introduced. Sub-slices reuse or extend these canonical patterns:

1. Bootstrap and safe create: factory CLI/preflight/materializer.
2. Command/help/provenance: customer command registry and generator dispatcher.
3. Customer closure: privacy-reviewed transitive runtime, test, workspace, and
   verification projection.
4. Generated SaaS slice: canonical Confect, lifecycle, topology, TanStack, and
   UI projections.
5. Workflow emission: `template:add-workflow` plus its focused semantic gates.
6. Headless parity: one operation/ref projection for API, CLI, MCP, and OpenAPI.
7. Acceptance: public create command followed by untouched-customer gates.

## Primary inventory

Each row retains the original status and severity. `triage` means current-main
reproduction or obsolescence evidence is not yet complete.

| IDs         | Original status / severity                        | Root-cause cluster                                                | Current status |
| ----------- | ------------------------------------------------- | ----------------------------------------------------------------- | -------------- |
| F-001–F-002 | Worked around / high                              | bootstrap and pinned package manager                              | triage         |
| F-003–F-006 | Open or worked around / critical–low              | create receipt, reviewability, safe Git handoff                   | triage         |
| F-007–F-015 | Open or worked around / critical–medium           | customer command/help registry, doctor schema, closure, lifecycle | triage         |
| F-016–F-017 | Under evaluation or worked around / high–critical | canonical Confect/workflow generation                             | triage         |
| F-018–F-022 | Open or worked around / critical–high             | canonical headless refs, MCP stdio, customer runtime closure      | triage         |
| F-023–F-030 | Open or customer-corrected / high–medium          | dependency pins, SaaS/TanStack/UI/format/lint output              | triage         |
| F-031–F-036 | Open or customer-corrected / critical–low         | workflow emitter and materialized source/test closure             | triage         |
| F-037–F-043 | Open or customer-corrected / critical–high        | customer test/verify/authority/App Map/SBOM/readiness projection  | triage         |
| F-044       | Customer-corrected / medium                       | route-file identity versus public route node                      | triage         |

## External-user inventory reconciliation

The source ledger deliberately mixes upstream factory issues, product-specific
implementation defects, tester mistakes, environment limitations, and live
deployment evidence. Every source ID is retained here; only genuinely upstream,
non-overlapping claims become remediation requirements.

| Source IDs      | Initial disposition                                                            | Primary overlap or upstream claim                                                                                                  |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| ES-F-01–ES-F-07 | upstream candidate                                                             | F-002, release preflight, F-006/F-007/F-011                                                                                        |
| ES-F-08         | likely obsolete / tester error                                                 | shell quoting outside factory                                                                                                      |
| ES-F-09–ES-F-19 | upstream candidate                                                             | F-027, recipe/generator safety, F-013, offline codegen, F-011, F-010                                                               |
| ES-F-20–ES-F-46 | mostly product/test-specific; shared-emitter candidates retained               | naming validation, shared help, workflow emitter, registry/projection brittleness                                                  |
| ES-F-47–ES-F-48 | upstream candidate                                                             | nested help and generated-freshness semantics                                                                                      |
| ES-F-49–ES-F-51 | upstream candidate requiring generic proof                                     | fake start composition, personalization, verification receipt persistence                                                          |
| ES-F-52–ES-F-58 | mixed                                                                          | machine-readable launcher, exit-code preservation, help/schema discovery; product cache/idempotency issues remain product-specific |
| ES-F-59–ES-F-82 | product/test/environment-specific unless generic reproduction proves otherwise | retained for explicit obsolete/not-applicable evidence                                                                             |
| ES-F-83–ES-F-84 | environment/docs candidate                                                     | secret-wrapper/deploy-doctor discoverability; no live mutation permitted                                                           |
| ES-F-85         | upstream candidate                                                             | clean JSON stdout; same root as ES-F-12/ES-F-52                                                                                    |

## Per-finding evidence contract

Before any finding becomes `fixed`, `obsolete`, or `blocked`, record:

1. exact ID/title and original status/severity;
2. narrow current-main reproduction, or direct evidence it is obsolete;
3. root cause;
4. failing regression test first where practical;
5. canonical upstream fix and files;
6. focused command output;
7. untouched fresh-customer evidence;
8. final status and commit.

Detailed per-ID records will be appended below as root-cause clusters close.

## Acceptance contract

The final customer must be materialized to a distinct temporary directory by the
public command and committed locally for cleanliness/freshness tests. It must
prove:

- package-manager preflight and pinned frozen install without lockfile drift;
- concise reviewable preview and collision-safe materialization;
- complete workspace dependency closure;
- command/help/handler/script consistency and doctor compatibility;
- advertised feature, capability, table, workflow, agent, and private-package
  paths;
- offline Confect generation, bounded Convex generation posture, and TanStack
  generation with no unexpected drift;
- MCP stdio initialize, tools/list, tools/call, malformed input, and unknown
  tool behavior;
- one canonical API/CLI/MCP operation/ref projection;
- format, lint, typecheck, tests, workflow gates, App Map, topology, lifecycle,
  security, SBOM/license, provider readiness, builds, and `just verify`;
- no unreviewed large-chunk warning; and
- empty Git status after the normal install/generate/check/test/verify/build
  sequence.

## Progress log

- 2026-07-29: exact goal created; coordination and release-evidence skills
  loaded; both AGENTS files and both complete defect inventories read.
- 2026-07-29: template worktree inspected clean at `35c5bd1`; ChangeSignal
  clean; Signal Scout dirty only in its read-only evidence ledger.
- 2026-07-29: template fast-forwarded without conflict to current `origin/main`
  at `f55653a0`; no other Agent Mail reservations were active.
- 2026-07-29: restored every root `template:*` package script to the executable
  generator boundary, then added exact leaf help for all 15 retained customer
  commands. Both direct argv and pnpm-forwarded `--` argv shapes now pass.
- 2026-07-29: added a Node-standard-library bootstrap preflight for fresh
  checkouts and removed pnpm 9.15.4 from the customer preflight allowlist so the
  repository's `packageManager` field is the single version authority.

## Verification evidence

### Executable generator entrypoint cluster

- IDs/titles: F-001 (fresh checkout generator bootstrap), F-008 (advertised
  customer generator commands), F-010 (systems no-match guidance), F-015
  (command-level help), plus ES-F-05, ES-F-06, ES-F-10, ES-F-11, and ES-F-18.
- Original posture: critical/high/medium, open or worked around.
- Confirmed current-main reproduction: every root `template:*` package script
  targeting `tooling/generators/src/index.ts` exited zero without output because
  the target is a library module with no direct-run boundary. The new regression
  failed with 23 inert scripts. After routing those scripts through the existing
  `cli.ts` boundary, `template:systems -- --query workflow-runtime` returns the
  canonical owner and a multi-word no-match returns structured guidance.
- Regression: `tooling/generators/src/direct-run.test.ts` asserts no declared
  root generator script points at the inert library entry.
- Canonical fix: root `package.json` only; the customer package projection
  already rewrites executable generator targets to its narrower
  `customer-cli.ts` boundary.
- Focused result:
  `npx --yes pnpm@10.12.1 --dir tooling/generators exec vitest run src/direct-run.test.ts --maxWorkers=1 --no-file-parallelism`
  passes 2/2.
- Commit: `a249e744 fix: restore generator entrypoints`.
- Remaining: F-001 still needs dependency-free preinstall diagnosis and F-008
  still needs full fresh-customer script/handler closure proof.
- Status: partial fix; no primary ID is closed by this commit alone.

### Package-manager bootstrap cluster

- IDs/titles: F-001 (Fresh checkout cannot run generators before install), F-002
  (Ambient pnpm is not pinned and frozen install gives a false failure), ES-F-01
  (Frozen install failed with the globally installed pnpm), and ES-F-02
  (Corepack could not install the pinned pnpm).
- Original posture: F-001 and F-002 worked around/high; ES-F-01 and ES-F-02
  worked around in the immutable external-user release.
- Confirmed reproduction: ambient `pnpm --version` is 9.15.4 while
  `package.json#packageManager` declares pnpm 10.12.1. Before dependencies are
  linked, generator entrypoints necessarily import unavailable workspace
  packages. The retained customer preflight also explicitly accepted 9.15.4,
  contradicting the manifest authority and the frozen-install contract.
- Regression: `scripts/bootstrap-preflight.test.mjs` runs the dependency-free
  script against synthetic pnpm 10.12.1 and 9.15.4 executables, requiring exact
  acceptance and a copy-paste-safe recovery. `composition.test.ts` pins the
  customer policy to no alternate supported pnpm versions.
- Canonical fix: `scripts/bootstrap-preflight.mjs` uses only Node built-ins,
  reads the exact version from `packageManager`, performs no network mutation,
  and reports the pinned frozen-install command plus Corepack signing-key
  fallback. `customerComposition.ts` now accepts only the manifest version.
  `README.md`, `quickstart.md`, and `preflight.md` put this check before install
  or generator use and require the pinned `npx` prefix while ambient pnpm
  remains mismatched.
- Focused result:
  `npx --yes pnpm@10.12.1 exec vitest run scripts/bootstrap-preflight.test.mjs --maxWorkers=1 --no-file-parallelism`
  passes 2/2; the focused customer-policy test passes 1/1. The real pinned
  invocation `npx --yes pnpm@10.12.1 exec node scripts/bootstrap-preflight.mjs`
  exits zero and prints `pnpm 10.12.1 is ready`; direct ambient invocation exits
  one and prints the exact `npx --yes pnpm@10.12.1 install --frozen-lockfile`
  recovery without changing the worktree.
- Clean-customer evidence: pending the post-commit materialization tests and
  isolated public acceptance run. The post-commit release-shaped
  `test:customer-cli-runtime` projection passes 2/2 after cloning committed
  `HEAD`, frozen-installing the customer, and importing its retained runtime.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof. Implementation commit: `2f90cde9`.

### Canonical customer instance cluster

- ID/title: F-009 (Generated doctor rejects generated template instance).
- Original posture: open/critical.
- Confirmed reproduction: a customer materialized by public create receives the
  versioned release-authority schema (`schemaVersion`, `release`, `blueprint`,
  and `personalization`), while `template:doctor` called the unrelated legacy
  parser requiring top-level `name`, `slug`, and `providerMode`; it exited one
  with `template-instance.json is missing name, slug, or providerMode`.
- Regression: `customer-runtime.test.ts` supplies the exact version-one shape
  emitted by public create, including release authority, and requires fake
  doctor success without changing a byte of the instance file.
- Canonical fix: `customer-runtime.ts` now owns one read-only version-aware
  adapter. Legacy manifests remain supported; versioned manifests must receive a
  safe canonical compatibility resolution from
  `@maestro-template/template-core/templateInstance` before their customer
  identity is projected into the existing doctor model. Customer doctor,
  preflight, start, and provider-posture inspection all consume this shared
  reader through `customer-dispatcher.ts` and `customerComposition.ts`.
- Focused result:
  `npx --yes pnpm@10.12.1 exec vitest run tooling/generators/src/customer-runtime.test.ts tooling/generators/src/customer-closure.test.ts --maxWorkers=1 --no-file-parallelism`
  passes 21/21; generator and CLI typechecks both exit zero.
- Clean-customer evidence: pending the post-commit release-shaped test and
  isolated public acceptance run.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof and the coherent commit coordinate.

### Generator leaf-help cluster

- IDs/titles: F-015 (Supported customer generators have no command-level help)
  and ES-F-05 (Documented scaffold help command was unavailable). F-008
  (Customer package scripts advertise unsupported generator commands) shares the
  registry/dispatch root cause but remains open pending clean-customer closure.
  ES-F-47 concerns the product CLI's workflow surface and is retained separately
  rather than falsely deduplicated with generator help.
- Original posture: F-015 open/medium; ES-F-05 open in the immutable
  external-user release; F-008 open/critical.
- Confirmed reproduction: before this repair,
  `npx --yes pnpm@10.12.1 --silent template:add-table -- --help` exited 1 with
  `Missing required --name for add-table`. The generator dispatcher had no
  per-command help registry, and pnpm's standalone `--` forwarding separator was
  interpreted as a command argument.
- Regression: `customer-runtime.test.ts` covers `--help` and `-h` for every
  command exported by `CUSTOMER_COMMANDS`, in both direct and pnpm-forwarded
  argv shapes. `index.test.ts` independently covers representative root leaf
  commands and pins executable package-script owners.
- Canonical fix: `tooling/generators/src/customer-dispatcher.ts` owns the exact
  customer help registry; `tooling/generators/src/index.ts` selects the matching
  root usage line; both boundaries normalize standalone package-manager
  separators. Tests are in `customer-runtime.test.ts` and `index.test.ts`.
- Focused result:
  `npx --yes pnpm@10.12.1 exec vitest run tooling/generators/src/customer-runtime.test.ts tooling/generators/src/customer-closure.test.ts tooling/generators/src/index.test.ts tooling/generators/src/direct-run.test.ts --maxWorkers=1 --no-file-parallelism`
  passes 81/81; `npx --yes pnpm@10.12.1 --dir tooling/generators typecheck`
  exits zero. Real package invocations for `template:add-table -- --help` and
  `template:add-workflow -- -h` both exit zero and print their exact usage.
- Clean-customer evidence: pending the isolated public materialization run.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof. Implementation commit: `d17946a2`.

No full acceptance command is yet claimed passing. Exact command outputs and
commit coordinates will be added only after observation.
