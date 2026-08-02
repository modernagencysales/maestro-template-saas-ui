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
- Migrated-host continuation: Agent Mail was re-created under project key
  `/Users/headless/migrated-worktrees/maestro-template-saas-ui-f037` with
  identity `StormyPuma`; the pre-migration `SwiftBadger` record remains
  historical authority rather than a live lease. Exact source and ledger paths
  are reserved through the fresh mailbox. The user explicitly canceled the
  proposed Convex Auth exploration; WorkOS/AuthKit remains unchanged.

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
8. Post-remediation compatibility upgrade: Confect v10 next.8 plus Effect v4,
   with a second clean-customer acceptance run after the defect union is closed.

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
- 2026-07-29: resumed on the migrated worktree; explicitly canceled the Convex
  Auth exploration and preserved the existing WorkOS/AuthKit identity and
  tenancy architecture. Reproduced the customer MCP package-root export gap and
  repaired the canonical customer Agent Pack projection.
- 2026-07-29: release-shaped customer reproduction found that the React 19.1.1
  lock projection was paired with the alpha.1 base web manifest at 19.1.0. The
  current target plan now replaces both authorities together.
- 2026-07-31: resumed the focused acceptance lane, removed four customer-stale
  factory recipes, corrected the Justfile base replacement authority, and
  completed a clean v16 customer acceptance checkpoint without aggregate
  verification, Fabro, publish, deploy, provider, or secret actions.

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
  fresh-customer proof. Implementation commit: `c40e6f33`.

### Safe create handoff cluster

- ID/title: F-005 (Factory follow-up order can mutate a parent Git repository).
- Original posture: worked around/critical.
- Confirmed reproduction: create returned install before Git initialization; a
  customer under an ancestor worktree ran the prepare hook against that parent
  and installed Lefthook there.
- Regression/fix: `28c0cbfc` makes Git initialization precede the pinned frozen
  install and adds a Node-only installer that requires the resolved Git
  top-level to equal the real current directory. Ancestor worktrees are skipped.
  Release-shaped proof later showed the customer omitted `lefthook.yml`, so the
  safe installer exited zero without installing hooks. The current customer plan
  now introduces the config plus its three read-only rubric support files as one
  regenerated closure, explicitly replacing their existing base-release copy
  operations. A macOS release-shaped run then proved that ambient global
  `core.hooksPath` redirected successful Lefthook installation outside the
  customer. The installer now sets a repository-local `.git/hooks` override
  before invoking Lefthook and fails closed if that local configuration cannot
  be written.
- Focused result: agent-pack create and hook tests pass 9/9; scoped ESLint,
  agent-pack/quality typechecks, formatting, and projection checks pass. The
  complete SaaS target-plan suite passes 21/21 after the hook-closure repair;
  the isolated installer boundary passes 2/2 including local-hook ownership.
- Clean-customer evidence: the committed release-shaped customer runtime suite
  passes 4/4 under the declared Node 22.23.2 host, including repository-local
  hook installation. Final isolated public acceptance remains pending.
- Status: source fixed; final fixed status waits for clean-customer proof.

### Customer workspace closure cluster

- IDs/titles: F-013 (Generated workspace has unresolved internal dependencies),
  F-022 (Generated CLI package omits required internal runtime), and exact
  external overlap ES-F-14.
- Original posture: worked around/critical, worked around/high, and fixed only
  in the external product.
- Confirmed reproduction: the customer retained three `workspace:*` links to
  omitted release/stack packages; frozen install passed only because stale
  lockfile bytes masked the invalid graph, while lockfile refresh failed.
- Regression/fix: `9ea96531` derives customer package manifests from the
  retained runtime and validates every workspace link; `50823f6f` declares the
  package-manifest and lockfile replacements in the target plan.
- Focused result: SaaS blueprint tests pass 17/17. A committed tagged public
  customer passed pinned frozen install, explicit workspace-graph validation,
  offline lockfile-only refresh, and runtime import in the selected integration
  test.
- Clean-customer evidence: the complete committed release-shaped customer
  runtime suite passes 4/4 under Node 22.23.2, including pinned frozen install,
  workspace-graph validation, offline lockfile-only refresh, and CLI import.
  Final full acceptance remains pending.
- Status: upstream implementation fixed; final fixed status waits for the full
  untouched-customer contract.

### Generated workflow compile cluster

- IDs/titles: F-017 (Generated workflow files do not pass focused lint or
  typecheck), plus exact ES-F-28 and ES-F-39 emitter overlaps.
- Original posture: worked around/critical; external findings fixed only in the
  product.
- Confirmed reproduction: the customer workflow emitter imported raw Workflow
  component primitives and emitted policy/error/environment expressions that
  failed its own ESLint and isolated Convex typecheck. The first compile repair
  then replaced canonical policy resolution with a manual `none`-only branch;
  `check:workflow-policy-snapshots` rejected the generated kickoff, and pinned
  policy declarations could never start.
- Regression/fix: `55f6aae5` extends the generated-output smoke to lint the
  contract and runner and compile the isolated generated Convex package. The
  follow-up regression requires emitted kickoff to call
  `resolveWorkflowPolicySnapshotForRun` and map its typed resolution failure.
  `tooling/generators/src/workflow-files.ts` now emits that canonical call, and
  `packages/convex/confect/workflows/_kit/policySnapshot.ts` returns one
  normalized `Effect.gen` value instead of a conditional union of incompatible
  Effect values. This retains exact pinned version/hash/workspace validation
  while compiling for both `none` and `pinned` postures. No generated file was
  hand-edited.
- Focused result: the new regression failed on the missing resolver and then
  passed; the complete generator package passes 12/12 files and 145/145 tests;
  `check:workflow-policy-snapshots`, `template:workflow-output-smoke`,
  `packages/convex` typecheck, `check:workflow:fast`, scoped ESLint, and scoped
  formatting all exit zero. The smoke generated, linted, and typechecked an
  isolated workflow output and reproduced/repaired generated Confect projection
  drift. Deployment-bound Convex ref generation is truthfully skipped because
  `CONVEX_DEPLOYMENT` is unset.
- Clean-customer evidence: the complete committed release-shaped customer
  runtime suite passes 4/4 under Node 22.23.2; its generated workflow policy and
  principal gates both exit zero. Final isolated public acceptance remains
  pending.
- Status: source fixed; final fixed status waits for clean-customer proof.

### Deployment-authority customer closure cluster

- ID/title: F-037 (Generated customer tests cannot run), acceptance subfinding
  for the current SaaS registry compile.
- Original posture: open/critical.
- Confirmed reproduction: the public root-create integration materialized the
  current `deployAuthority/admin.ts` beside the immutable release's older
  `deployAuthority/store.ts` and deployment-authority table definitions. The
  generated Convex package then failed typecheck on missing store exports,
  missing table fields, and missing indexes.
- Root cause: the current target plan introduced the new admin owner and two new
  tables but did not project the complete pre-existing source/table dependency
  closure that changed with that owner. The first closure repair removed the
  admin/schema failures and exposed the same drift one edge farther out: the
  historical deploy caller and test still passed the superseded runtime-key
  contract into the current store.
- Regression: the SaaS target-plan test now requires the current store plus the
  action-consumption, approval, census-snapshot, issuer, and verdict table
  definitions to be reviewed `copy` replacements, while the newly introduced
  admin and audit-event files remain replacement-free. The committed root-create
  integration compiles the resulting materialized Convex registry.
- Canonical fix: `saasRegistrationProjections.ts` owns the complete current
  deployment-authority source/table closure, including the Confect spec/impl,
  plain Convex caller, environment and HTTP boundaries, generated wrapper,
  component config, and behavioral test. `saasApplication.ts` binds only paths
  actually written by reviewed source commit `de1bac52` to `replaces: "copy"`;
  the later `deployAuthority/env.ts` introduction has no replacement claim. No
  deployment command, pipeline, provider, secret, generated Confect file, or
  generated Convex file was hand-edited or executed.
- Focused result: the target-plan regression failed on the absent store path and
  then passed; the complete SaaS blueprint suite passes 21/21. Generator and CLI
  typechecks, formatting, scoped lint, and `git diff --check` all exit zero.
- Clean-customer evidence: after commits `add73a1`, `93f77cd`, and `b7e7940`,
  the targeted committed root-create materialization/Convex compile passes 1/1,
  and the complete root-create integration passes 7/7 under Node 22.23.2. Final
  isolated public acceptance remains pending.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof.

### MCP generated-name round-trip cluster

- ID/title: F-018 (Advertised fallback MCP tool names cannot be called).
- Original posture: open/critical.
- Confirmed reproduction: generated MCP listing used `template.<operationId>`
  whenever an operation lacked an explicit rename, but call dispatch compared
  only the explicit rename map. A listed fallback name therefore returned a
  structured `ToolNotFound` error.
- Regression: `tooling/workflow/src/index.test.ts` removes an explicit mapping,
  lists the generated fallback tool, and requires that exact listed name to
  dispatch successfully before restoring the test fixture.
- Canonical fix: `tooling/workflow/src/index.ts` now owns one
  `mcpToolNameFor(operationId)` projection consumed by both `tools/list` and
  `tools/call`; no generated manifest or generated ref file was hand-edited.
- Focused result: `npx --yes pnpm@10.12.1 --dir tooling/workflow test` passes
  13/13 and `npx --yes pnpm@10.12.1 --dir tooling/workflow typecheck` exits
  zero.
- Clean-customer evidence: pending the canonical customer MCP stdio repair and
  isolated public acceptance run.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof. Implementation commit: `0f454318`.

### Semantic headless-ref validation cluster

- ID/title: F-019 (The generated-ref gate rejects the canonical multi-surface
  mapping).
- Original posture: open/critical.
- Confirmed reproduction: the quality gate encoded operation-ID-shaped Convex
  refs and exact local variable spellings with regular expressions. A valid
  mapping such as `changesignal.overview.get` to
  `api.capabilities.changeFeed.getOverview`, or a shared CLI/MCP resolver,
  failed despite routing through the canonical generated projection. The first
  shared MCP-name repair also reproduced the false failure on the template's own
  `check:headless-surface-contract` gate.
- Regression: `check-headless-surface-contract.test.mts` covers differently
  named HTTP refs, CLI ref helpers, and one MCP helper serving both explicit and
  fallback names, while retaining wrong-key and inert-mapping failures.
- Canonical fix: `check-headless-surface-contract.mts` now parses TypeScript
  source and validates generated mapping keys, `api`-rooted refs, ref derivation
  into runtime dispatch, and shared MCP list/call naming semantics. The manifest
  remains the operation inventory authority; no naming regex or exact local
  variable spelling defines correctness.
- Focused result: the quality test passes 21/21, quality typecheck exits zero,
  and `npx --yes pnpm@10.12.1 check:headless-surface-contract` reports
  `headless-surface-contract: ok`.
- Clean-customer evidence: pending the canonical customer headless projection
  and isolated public acceptance run.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof and the coherent commit coordinate.

### Customer MCP stdio cluster

- ID/title: F-020 (Generated app has no real MCP stdio server).
- Original posture: open/critical.
- Confirmed reproduction: customer materialization retained MCP protocol/server
  sources but deliberately removed the `runCliEntry` stdio branch; `maestro mcp`
  therefore returned `Unknown command: mcp`.
- Regression: Agent Pack tests require a composition to publish only commands it
  actually retains. Customer composition tests exercise initialize, tools/list,
  a successful tools/call, unknown-tool, and malformed-input frames over stdio.
  The release-shaped customer runtime test repeats the five-frame contract.
- Canonical fix: the Agent Pack MCP projection now filters from one reviewed
  descriptor set by the supplied command composition. Customer composition
  exposes only preflight, support preview, and verify, and customer CLI
  projection retains the canonical stdio entry without restoring factory-only
  configure authority. A later release-shaped import exposed that
  `tooling/agent-pack/src/customer.ts`, which becomes the generated package
  root, omitted the MCP protocol, projection, and server exports. The canonical
  customer export now retains exactly those three runtime modules. The immutable
  release manifest omits their source paths, so the current plan also introduces
  all three as generated/regenerated output with no false `replaces` authority;
  the target-plan regression pins both the package-root exports and real files.
- Focused result: Agent Pack MCP tests pass 21/21, customer stdio composition
  passes 1/1, SaaS blueprint tests pass 17/17, and Agent Pack, CLI, and
  generator typechecks exit zero. After the export and source-closure repairs,
  the complete SaaS blueprint file passes 19/19 and both Agent Pack and
  generator typechecks exit zero. The final-filesystem gate originally retained
  a stale blanket ban on Agent Pack MCP sources; it now requires exactly the
  protocol, projection, and server sources plus their three customer-safe tests,
  while still rejecting factory/native-host MCP authority. That gate passes 2/2
  and its disposable customer completes frozen install, CLI typecheck, workflow
  policy/principal gates, Convex typecheck, and web build.
- Clean-customer evidence: the post-commit release-shaped runtime suite passes
  4/4 under Node 22.23.2. Its customer MCP stdio sequence passes initialize,
  tools/list, successful tools/call, unknown-tool, and malformed-input frames.
  Final isolated public acceptance remains pending.
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

### Generated feature fixture lint cluster

- ID/title: F-030 (Generated frontend feature fixtures violate the customer lint
  policy).
- Original posture: open in the template, corrected only in ChangeSignal;
  severity medium.
- Confirmed reproduction: both canonical `add-feature` emitters generated
  `fake<Feature>Items[0]!` for the edit and success states while the retained
  customer ESLint policy rejects non-null assertions. Focused root and customer
  runtime regressions failed on the emitted fixture bytes before the repair.
- Root cause: the fixture states recovered a known singleton through an
  unchecked array lookup instead of giving that canonical item its own typed
  binding. The duplicated root and materialized-customer emitters shared the
  same defect.
- Regression: `tooling/generators/src/index.test.ts` and
  `tooling/generators/src/customer-runtime.test.ts` require the typed singleton,
  require edit/success states to reuse it, and reject `[0]!` in emitted fixture
  source.
- Canonical fix: `tooling/generators/src/index.ts` and
  `tooling/generators/src/customer-runtime.ts` now emit one typed
  `fake<Feature>Item`, derive the fixture array from it, and reuse the binding
  in every state. No lint rule, compiler option, or generated customer file was
  weakened or hand-edited.
- Focused result: the two red-to-green regressions pass 2/2; the complete root
  and customer generator files pass 82/82; generator typecheck, scoped ESLint,
  formatting, and `check:generators` all exit zero.
- Clean-customer evidence: canonical source and public customer-runtime output
  are covered; final untouched fresh-customer lint and full acceptance remain
  pending.
- Status: upstream implementation fixed; final fixed status waits for the
  isolated clean-customer acceptance run.

### Frontend peer compatibility cluster

- ID/title: F-023 (Generated frontend dependency pins violate Saas UI peer
  ranges).
- Original posture: open/medium.
- Confirmed reproduction: `apps/web/package.json` pinned React and ReactDOM
  `19.1.0`, while the installed `@saas-ui/react@3.0.0-next.51` and
  `@saas-ui-pro/react@1.0.0-next.4` packages both declare `^19.1.1` React and
  ReactDOM peers. The new compatibility regression failed against those
  authoritative installed package manifests before the repair.
- Root cause: the React pair was pinned one patch below the tested Saas UI
  stack's minimum after the Saas UI packages advanced their peer contract; the
  application manifest and peer-resolved lock snapshots were not advanced
  together.
- Regression: `apps/web/src/dependency-compatibility.test.ts` reads the web
  manifest plus both installed Saas UI manifests, requires equal React and
  ReactDOM pins, and proves each pin satisfies every declared React peer range.
- Canonical fix: `apps/web/package.json` now pins React and ReactDOM together at
  `19.1.1`; `pnpm-lock.yaml` was regenerated with pnpm `10.12.1` and formatted
  without refreshing unrelated dependency versions. The current customer target
  plan also replaces the release base's `apps/web/package.json` with that
  canonical manifest whenever it projects the current lockfile. No Confect,
  Effect, Saas UI, or framework package was upgraded.
- Focused result: the red-to-green compatibility test passes 1/1; a pinned
  frozen install succeeds with the resolution step skipped and no peer warning;
  web typecheck exits zero; all 27 web files and 102 tests pass; the production
  client/SSR build succeeds; `check:deps`, `check:route-tree`, scoped ESLint,
  and formatting pass. The existing large client-chunk warning is preserved as
  separate F-027 evidence and was not suppressed or threshold-adjusted.
- Clean-customer evidence: source compatibility and the template workspace are
  green. A release-shaped reproduction first failed frozen install with the
  projected lock at 19.1.1 and retained manifest at 19.1.0; the target-plan
  regression now pins both current authorities. The post-commit release-shaped
  suite passes 4/4 under Node 22.23.2 and its pinned frozen install exits zero.
  Final untouched fresh-customer acceptance remains pending.
- Status: upstream implementation fixed; final fixed status waits for the
  isolated clean-customer acceptance run.

### Customer Agent Pack test-closure cluster

- ID/title: F-037 (Generated customer tests cannot run).
- Original posture: open/critical.
- Confirmed reproduction: the generated Agent Pack package used its factory
  discovery script, so customer `pnpm test` selected host installers, projection
  synchronizers, native-host acceptance, and real-workspace version assertions
  that require factory-only source and authority. On macOS, the retained runtime
  test also exposed `/var` versus `/private/var` Git-root comparison drift.
- Root cause: one package-level test command owned both customer runtime
  behavior and factory distribution authority, while the target plan neither
  projected a reviewed customer test inventory nor replaced the one mixed
  real-workspace test. Repository-root comparison used lexical `resolve` instead
  of filesystem identity.
- Regression: `customerTestClosure.test.ts` binds every customer test path to
  the `test:customer` script and rejects named factory-authority paths. The SaaS
  target-plan test requires the projected Agent Pack manifest, customer closure,
  three MCP tests, and customer-safe Node adapter test; new paths have no false
  replacement claim. The Node adapter fixture deterministically maps a symlinked
  Git root to the same real source root.
- Canonical fix: Agent Pack retains its complete factory `test` command and adds
  an explicit customer-safe command. The current customer plan projects that
  manifest, the customer-owned tests, and the customer-safe Node adapter test;
  the real-workspace version assertion moved to `nodeAdapters.factory.test.ts`.
  Runtime preflight now compares available filesystem real paths and falls back
  fail-closed to resolved lexical paths.
- Focused result: customer Agent Pack tests pass 29/29 files and 249/249 tests
  through `host-test-slot`; the complete SaaS target-plan suite passes 21/21;
  Agent Pack and generator typechecks and formatting pass.
- Factory-suite observation: the complete Agent Pack discovery run on the shared
  macOS host passed 45 files but failed 12 factory/native-host files, primarily
  from existing five-second timeouts under high load and direct-temp-path checks
  that reject the host's `/var` symlink. No timeout or safety gate was changed.
- Clean-customer evidence: the post-commit release-shaped customer runtime suite
  passes 4/4 under Node 22.23.2; the generated customer test closure, context
  checks, MCP path, ownership/lifecycle catalogs, and private-package import all
  execute successfully. Final isolated public acceptance remains pending.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof.

### Generated Confect freshness cluster

- ID/title: F-016 (generated Confect/Convex projections drift immediately after
  materialization). ES-F-48 remains a distinct pre-commit freshness-semantics
  finding because its reviewed-uncommitted-output root cause does not match this
  stale factory projection.
- Original posture: under evaluation/high for F-016; open external-user friction
  for ES-F-48.
- Confirmed reproduction: untouched customer
  `/private/tmp/maestro-fresh-customer-ZbdsjziC/customer`, materialized from
  template `8c80783ad1ba1ca92b16456a362a980172df92a4`, completed a frozen
  install and doctor with zero warnings, then successful `pnpm confect:codegen`
  changed `_generated/id.ts`, `_generated/spec.ts`, and `_generated/docs.ts`,
  removed both flat `records.ts` wrappers, and created nested
  `records/records.ts` wrappers.
- Root cause: the SaaS registration projection manually encoded the historical
  flat Confect group shape. Current Confect derives the source path
  `records/records.spec.ts` as nested group `records.records`, emits nested
  registered-function and Convex wrappers, includes the new table in generated
  docs, and de-duplicates the existing `workflowArtifacts` table ID. The
  reviewed alpha.1 plan still truthfully owns the historical flat layout and
  must remain reproducible.
- Regression: `saasApplication.test.ts` first failed on the absent nested
  registered-function wrapper. It now pins nested wrapper imports, nested spec
  ownership, Records document projection, single table-ID membership, absence of
  the obsolete flat paths, and preservation of alpha.1's exact historical
  projection authority.
- Canonical fix: `saasRegistrationProjections.ts` emits current codegen-shaped
  `spec`, `docs`, `id`, registered-function, and Convex wrapper projections only
  for current-main. `saasApplication.ts` registers those current paths while
  retaining the sealed historical paths for the alpha.1 plan. No generated
  customer file, vendored Confect source, codegen gate, or deployment state was
  edited.
- Focused result: the red regression passes; the complete SaaS blueprint suite
  passes 22/22, generator typecheck exits zero, scoped ESLint exits zero, and
  formatting plus `git diff --check` pass.
- Clean-customer evidence: public preview from exact template source
  `18be1945787a2429e6e6c8b51398f80f0e8ba6fc` reported 1,385 writes, 3,195
  omissions, zero collisions, and the correct distinct target. Public
  materialization created
  `/private/tmp/maestro-fresh-customer-v2-mdTkr0/customer`; its pinned frozen
  offline install passed without lock drift, doctor reported zero warnings and
  failures, and baseline commit `c4730e137e362b43f1266ca808523db46d63c2fc`
  remained clean after `pnpm confect:codegen` reported “Generated files are
  up-to-date.”
- Status: fixed for F-016. ES-F-48 remains separately open pending its own
  reviewed-uncommitted-output semantics evidence.

#### Nested ref consumer follow-up

- Confirmed reproduction: after the codegen-stable projection repair and the
  generator source-closure fix, fresh customer
  `/private/tmp/maestro-fresh-customer-v3-p3domo/customer` advanced through 20
  package typechecks before web failed on the generated Records surface. Its
  three consumers still addressed `public.records.list/create`, while current
  Confect generated `public.records.records.list/create`; four strict TypeScript
  diagnostics stopped `just verify`.
- Regression/root cause: the current projection test first failed on the flat
  refs and now binds both nested consumers while rejecting the obsolete
  spelling. The alpha.1 integrity test also proves its sealed flat source bytes
  remain independently reproducible.
- Canonical fix: `saasApplicationFactory.ts` adapts only the current SaaS
  Records surface to the nested generated refs. The historical seed, generated
  customer, Confect output, and route files remain untouched.
- Focused result: the complete SaaS blueprint suite passes 22/22; generator
  typecheck and scoped ESLint pass. The post-commit disposable final-filesystem
  integration passes 1/1 in 74 seconds and now includes customer web typecheck
  before the production web build. Full `just verify` remains pending a new
  persistent public customer.

### Customer generator source-closure cluster

- ID/title: F-037 (generated customer tests and verification cannot run),
  additional current-composition source-closure reproduction.
- Original posture: open/critical.
- Confirmed reproduction: `just verify` in untouched customer baseline
  `c4730e137e362b43f1266ca808523db46d63c2fc` passed format and lint, then failed
  `@maestro-template/generators#typecheck` with eight missing-module and
  implicit-any diagnostics. The customer retained six factory-only generator
  files whose factory dependencies were correctly omitted:
  `saasApplicationFactory.ts`, `saasRegistrationProjections.ts`, `cli.ts`,
  `customer-closure.test.ts`, `upgrade-wiring.test.ts`, and
  `workflow-files.test.ts`.
- Root cause: the immutable base release classifies its broad generator subtree
  as copied and predates these six paths. Current-main correctly omits
  `index.ts` and `saasApplication.ts`, but its tagged current composition had no
  exact, reviewed omission overlay for later factory-only additions. Blueprint
  target plans intentionally cannot claim `omit` replacement authority.
- Regression: the final-customer filesystem audit first failed with the exact
  six-file residue list. It now rejects every path explicitly and includes the
  retained generator package typecheck in its compile gates. Adapter coverage
  requires the exact omission set to appear in preview and change the immutable
  current-composition checksum.
- Canonical fix: `createAdapter.ts` adds a safe, unique, exact omission
  authority only to tagged current compositions, incorporates its sorted paths
  into the composition checksum, rejects overlap with reviewed exact base
  authority, and applies the same manifest overlay at preview and
  materialization. The CLI create composition owns the six generic factory-only
  paths. The sealed release manifest, blueprint replacement validator, generated
  customer files, pipelines, secrets, and deployment state remain unchanged.
- Focused result: the adapter suite passes 19/19; release-tooling and CLI
  typechecks exit zero; scoped ESLint, formatting, and `git diff --check` pass.
- Clean-customer evidence: the post-commit final-filesystem integration passes
  1/1 with all six factory-only paths absent; retained generator, CLI, Convex,
  workflow, and web compile/build gates pass. A new persistent public
  materialization followed by `just verify` remains pending.
- Status: upstream implementation fixed; final fixed status waits for untouched
  fresh-customer proof.

### FR-F-001 — Retained template-core test reads an omitted factory fixture

- ID/title: FR-F-001 (retained template-core test reads an omitted factory
  fixture).
- Original posture: newly reproduced/critical because the defect stops the
  generated customer's canonical `just verify` gate.
- Confirmed reproduction: untouched customer
  `/private/tmp/maestro-fresh-customer-v4-5n9VDP/customer`, materialized from
  exact template source `8bf61bd7d62e5fba05c895d9fc559b9e79aef2ba`, passed
  frozen offline install, doctor, formatting, lint, all 21 executable package
  typechecks, and strict Effect diagnostics. `pnpm test` then failed
  `packages/template-core/src/templateInstance/templateInstance.test.ts` because
  `tooling/release/__fixtures__/upgrade/provider-posture-v1-to-v2.contract.json`
  was absent. The focused customer result was 1 failed and 112 passed tests in
  that package.
- Root cause: the retained `template-core` provider-posture test crossed into
  the factory-only release-tooling fixture tree. Customer materialization
  intentionally omits `tooling/release`, so the test's runtime dependency was
  outside its package and outside the reviewed customer source closure.
- Regression: the SaaS target-plan suite requires a package-owned posture
  fixture plus the updated retained test, pins the test as an exact replacement
  of the base release copy, rejects the factory-relative lookup, and keeps the
  sealed alpha.1 integrity proof unchanged. The regression failed on the missing
  current entries before implementation.
- Canonical fix and files: the reviewed fixture now also lives at
  `packages/template-core/src/templateInstance/__fixtures__/provider-posture-v1-to-v2.contract.json`;
  `templateInstance.test.ts` resolves it within its owning package; and
  `saasApplicationFactory.ts` plus `saasApplication.ts` project the current-main
  test closure with exact copy-replacement authority only for the pre-existing
  test. The frozen alpha.1 plan and release fixture remain byte-preserved.
- Focused result: the red-to-green SaaS and provider-posture suites pass 58/58;
  generator typecheck, scoped ESLint, formatting, and `git diff --check` exit
  zero. From committed source `0190353ca81f2481d807d847b8d62b4d2f597ec8`, the
  release-shaped create-root integration passes 1/1 in 38.77 seconds after
  cloning exact `HEAD`, performing its frozen offline install, materializing the
  customer, and compiling the canonical Convex and web registries.
- Clean-customer evidence: the v4 failure is direct untouched-customer
  reproduction. A post-fix release-shaped integration and entirely new public
  customer are required before final fixed status.
- Status: upstream implementation fixed in `0190353c`; final fixed status waits
  for untouched fresh-customer proof.

### FR-F-002 — Customer verification runs factory-authority-only tests

- ID/title: FR-F-002 (customer verification runs factory-authority-only tests).
- Original posture: newly reproduced/critical because the retained customer
  `pnpm test` and coverage commands fail after all typechecks pass.
- Confirmed reproduction: untouched customer
  `/private/tmp/maestro-fresh-customer-v5-Mnmwbl/customer`, materialized from
  exact template source `ff2f75feba7850404e3d8341277616c9170e7957`, ran the
  quality package's complete root-only test catalog. Seven tests required
  omitted factory authority: AI gate scripts, Agent Pack release validation,
  Convex AI-file installation, deploy authority, docs freshness, recipes, and
  mutation-script enforcement.
- Root cause: `tooling/quality/package.json` was copied without a customer test
  closure even though the target intentionally omits the release, recipe,
  pipeline, and factory mutation owners those exact tests audit.
- Regression: the SaaS blueprint suite requires the customer quality package to
  exclude only the seven enumerated factory-authority tests and requires the
  root coverage command to use the identical audited closure. It separately
  proves that generator publication tests remain enabled; there is no broad
  pattern ignore.
- Canonical fix and files: `saasRegistrationProjections.ts` emits a
  customer-specific quality `test`/`test:customer` script and the matching root
  coverage arguments; `saasApplication.ts` registers the projected package as an
  exact replacement of the base release copy.
- Focused result: SaaS blueprint tests, the complete generator package,
  generator typecheck, the root quality package, scoped ESLint, and formatting
  pass.
- Clean-customer evidence: pending post-commit v6 materialization and untouched
  `just verify`.
- Status: upstream source fixed; final fixed status waits for untouched
  fresh-customer proof. Source commit: `1f149645`.

### FR-F-003 — Customer tests reference omitted factory source trees

- ID/title: FR-F-003 (customer tests reference omitted factory source trees).
- Original posture: newly reproduced/critical because retained generator and
  quality tests fail in an otherwise valid generated workspace.
- Confirmed reproduction: the same untouched v5 customer failed three CRUD proof
  cases while reading
  `examples/saas-application/seed/source/apps/web/src/adapters/records/fake.ts`;
  `tooling/quality/src/env-manifest.test.mts` also read omitted
  `tooling/generators/src/index.ts`.
- Root cause: both tests asserted factory composition sources rather than the
  equivalent retained customer-owned sources.
- Regression: the SaaS target plan requires exact copy replacements whose
  contents use `apps/web/src/adapters/records/fake.ts` and
  `tooling/generators/src/customer-runtime.ts`, and rejects the two omitted
  factory paths.
- Canonical fix and files: `saasApplicationFactory.ts` projects the two tests
  from canonical root source with narrow marker-checked substitutions;
  `saasApplication.ts` grants exact copy-replacement authority. No generated
  customer file is edited after materialization.
- Focused result: the SaaS blueprint suite, full generator package, generator
  typecheck, quality package, ESLint, and formatting pass.
- Clean-customer evidence: pending post-commit v6 materialization and untouched
  test/coverage gates.
- Status: upstream source fixed; final fixed status waits for untouched
  fresh-customer proof. Source commit: `1f149645`.

### FR-F-004 — Generated Records route lacks canonical ownership provenance

- ID/title: FR-F-004 (generated Records route lacks canonical ownership
  provenance).
- Original posture: newly reproduced/high because the generated customer's
  system-topology gate rejects an otherwise functional route as unowned.
- Confirmed reproduction: the v5 customer topology audit reported
  `apps/web/src/routes/_workspace.records.tsx` without a canonical owner or
  generator provenance record.
- Root cause: the current SaaS slice materializes the Records vertical but did
  not retain the `template:add-feature` provenance artifact expected by the
  topology owner.
- Regression: the SaaS plan requires a generated/regenerated
  `docs/template/generated/provenance/add-feature/records.json` binding the
  complete vertical to `knowledge-brain` with disposition `extend`.
- Canonical fix and files: `saasApplicationFactory.ts` emits the generic Records
  feature provenance and `saasApplication.ts` registers it as a new generated
  path with no false replacement claim.
- Focused result: `pnpm check:system-topology` passes with 42 production
  resources across seven kinds; SaaS blueprint, formatting, and lint gates pass.
- Clean-customer evidence: pending post-commit v6 materialization and untouched
  topology/App Map gates.
- Status: upstream source fixed; final fixed status waits for untouched
  fresh-customer proof. Source commit: `1f149645`.

### FR-F-005 — Current policy repair mutates an immutable publication closure

- ID/title: FR-F-005 (current policy repair mutates an immutable publication
  closure).
- Original posture: newly reproduced/critical because both root and customer
  generator suites reject published workflow source drift.
- Confirmed reproduction: root and untouched v5 customer both failed two of four
  workflow-publication tests with the sole drift path
  `packages/convex/confect/workflows/_kit/policySnapshot.ts`. Its current hash
  was `2ac7ac6e...`, while the published descriptor requires `cd360058e...`.
- Root cause: the current-main F-031 policy typing repair edited a shared module
  transitively sealed into the immutable `publicationFixture` source closure.
  The repository already isolates evolving runtime primitives behind
  `*Current.ts` files, but policy resolution lacked that boundary.
- Regression: the publication suite still detects ordinary source/artifact
  mutation and now deliberately mutates `policySnapshotCurrent.ts` while
  requiring the two published releases to remain clean. Generator tests require
  newly emitted workflow contracts to import the current resolver. The combined
  regression first failed on the two original drift assertions, the missing
  current source, and the old emitted import.
- Canonical fix and files: the sealed `policySnapshot.ts` bytes are restored
  exactly to SHA-256
  `cd360058e27ae3ecf6de33178de7d23267bb45a3fc1dd442d963c042f66a7492`;
  `policySnapshotCurrent.ts` owns the normalized `Effect.gen` resolver;
  `workflow-files.ts` imports it; and the SaaS factory projects the new current
  source as `generate`/`regenerate` with no `replaces` field. No published
  descriptor, authority, manifest, checksum, or generated Confect/Convex file is
  rewritten.
- Focused result: workflow-publication, generator-index, and SaaS blueprint
  suites pass together; the complete generator package and typecheck, Convex
  typecheck, all 107 workflow semantic rules, system topology, scoped ESLint,
  formatting, and `git diff --check` pass.
- Clean-customer evidence: pending post-commit v6 materialization and untouched
  workflow-publication/`just verify` proof.
- Status: upstream source fixed; final fixed status waits for untouched
  fresh-customer proof. Source commit: `1f149645`.

### FR-F-006 — Current generated path is registered twice

- ID/title: FR-F-006 (current generated path is registered twice).
- Original posture: newly reproduced/critical because the public create preview
  fails closed before any customer write.
- Confirmed reproduction: exact-SHA release clone
  `/private/tmp/maestro-fresh-customer-v6-3KM4em/release` at `1f149645` passed a
  pinned frozen offline install, then `pnpm maestro -- create ... --details`
  returned `AGENT_PACK_CREATE_RELEASE_UNAVAILABLE` with “Blueprint target plan
  is incomplete or contains drift.” A read-only invariant probe found 224 unique
  entries and valid hashes but duplicate registration of only
  `packages/convex/confect/workflows/_kit/policySnapshotCurrent.ts`.
- Root cause: the new current policy source was registered both with the generic
  customer source projections and with the current workflow-kit closure. The
  existing sealed-manifest comparison filtered post-alpha paths before comparing
  registrations, so it did not assert current-plan uniqueness.
- Regression: the SaaS blueprint suite now asserts registration uniqueness on
  the complete current plan before any historical filtering. It failed with 140
  registrations versus 139 unique paths before the repair.
- Canonical fix and files: `saasApplication.ts` keeps the single semantically
  correct workflow-kit registration and removes the duplicate source-projection
  registration. The generated entry remains `generate`/`regenerate` with no
  replacement claim.
- Focused result: the red-to-green SaaS blueprint suite passes; generator
  typecheck and scoped lint/format pass. Exact-SHA release clone
  `/private/tmp/maestro-fresh-customer-v7-5KGIuj/release` at `7e16a24f` passed
  frozen offline install and public preview with zero collisions, then public
  materialization wrote 1,383 customer files.
- Clean-customer evidence: v7 proves preview/materialization and was committed
  locally as `ca4e20bb`; subsequent canonical manifest generation exposed
  FR-F-007, so final acceptance moves to a wholly new customer after that fix.
- Status: upstream source fixed in `7e16a24f`; final fixed status waits for
  untouched fresh-customer proof.

### FR-F-007 — Customer Confect manifest omits the Records table

- ID/title: FR-F-007 (customer Confect manifest omits the Records table).
- Original posture: newly reproduced/high because normal canonical generation
  leaves tracked drift before verification.
- Confirmed reproduction: untouched v7 customer at baseline commit `ca4e20bb`
  passed frozen offline install, fake doctor with zero warnings/failures,
  Confect codegen (“Generated files are up-to-date”), and the TanStack
  route-tree pin check. `pnpm confect:manifest` then added `"records"` at four
  schema-enum projections in
  `packages/template-core/src/generated/confectManifest.ts`, leaving that sole
  tracked diff.
- Root cause: the current SaaS blueprint adds the Records table and Confect
  group to its generated customer schema/spec, but retained the base template's
  pre-Records shared manifest projection.
- Regression: the SaaS blueprint suite requires an exact copy replacement for
  the customer Confect manifest and exactly four Records table projections. The
  assertion failed on the missing plan entry before implementation.
- Canonical fix and files: `saasApplicationFactory.ts` now projects the
  canonical root manifest through a marker-counted Records-table insertion;
  `saasApplication.ts` registers the exact base-copy replacement. The projection
  SHA-256 `ea30856e...` matches the bytes produced independently by
  `pnpm confect:manifest` in v7. No generated customer file is hand-edited.
- Focused result: the red-to-green SaaS suite passes. Full generator tests,
  typecheck, scoped lint/format, and a new customer generation-drift proof
  remain required before final status.
- Clean-customer evidence: v7 is direct untouched reproduction; final proof will
  use a new post-fix customer rather than repairing v7.
- Status: upstream source fixed; final fixed status waits for focused gates,
  commit, and untouched fresh-customer proof.

No full acceptance command is yet claimed passing. Exact command outputs and
commit coordinates will be added only after observation.

### FR-F-008 — Customer env manifest omits retained deploy authority

- ID/title: FR-F-008 (customer env manifest omits retained deploy authority).
- Original posture: newly reproduced/high because the generated customer's
  retained quality suite rejects its machine-readable environment authority.
- Confirmed reproduction: fresh customer
  `/private/tmp/maestro-fresh-customer-recovery-v9-SbN9S7/customer` at baseline
  commit `cc77fd3` passed pinned frozen install, fake doctor, Confect codegen,
  Confect manifest generation, route-tree freshness, format, lint, and all 21
  typecheck tasks. Its individual `just test-tooling` recipe then failed 1 of
  268 assertions because `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL` was
  absent from `docs/template/env-manifest.json`.
- Root cause: current customer composition replaced the updated env-manifest
  test and retained the deployment-authority runtime, Convex configuration, and
  operations docs, but still copied the sealed base release's older env
  manifest. The test and runtime therefore described a current authority
  variable that the customer manifest did not register.
- Regression: the SaaS target-plan suite now requires an exact reviewed copy
  replacement for `docs/template/env-manifest.json` and requires that projection
  to contain the runtime-only private-key descriptor. The regression first
  failed because the plan entry was absent.
- Canonical fix and files:
  `tooling/generators/src/blueprints/saasApplicationFactory.ts` projects the
  current canonical env manifest;
  `tooling/generators/src/blueprints/saasApplication.ts` grants its exact base
  copy-replacement authority and registers the path; and the SaaS blueprint test
  pins both the replacement and current-plan inventory. No sealed release
  manifest or generated customer file is edited.
- Focused result: the red-to-green SaaS blueprint suite passes 25/25; generator
  typecheck, scoped ESLint with zero warnings, and scoped Prettier all pass
  through the focused host semaphore using pnpm `10.12.1`.
- Clean-customer evidence: the v9 customer is the untouched reproduction. Final
  proof moves to a wholly new post-fix customer rather than repairing v9.
- Status: upstream source fixed; final fixed status waits for the coherent
  commit and untouched post-fix customer acceptance.

### FR-F-009 — Customer authority runbook and env docs are stale

- ID/title: FR-F-009 (customer authority runbook and env docs are stale).
- Original posture: newly reproduced/high because the generated customer's
  retained quality suite rejects its deploy-authority documentation contract.
- Confirmed reproduction: untouched v10 customer
  `/private/tmp/maestro-fresh-customer-recovery-v10-rtRAf6/customer` at baseline
  commit `04cbcf4` passed frozen install, doctor, Confect generation, Confect
  manifest generation, and route-tree freshness. Its focused env-manifest test
  then passed the FR-F-008 machine-readable descriptor assertion but failed
  because `docs/template/operations-runbook.md` did not mention
  `PROMOTION_AUTHORITY_MODE`; direct comparison also proved that both the
  customer runbook and `docs/template/env-manifest.md` lacked the current
  authority-mode and runtime-only private-key contract.
- Root cause: the current factory retained the deploy-authority runtime,
  configuration, test, and machine-readable manifest while still copying both
  prose authority documents from the sealed base release.
- Regression: the SaaS target-plan suite requires exact reviewed copy
  replacements for both prose documents and requires each projection to name
  `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL`. The regression first failed
  because both plan entries were absent.
- Canonical fix and files: the current customer source projection now includes
  `docs/template/env-manifest.md` and `docs/template/operations-runbook.md`;
  `saasApplication.ts` grants exact base copy-replacement authority and
  registers both paths; and the exact current-plan inventory remains pinned. No
  sealed release bytes or generated customer files are changed.
- Focused result: the red-to-green SaaS blueprint suite passes 25/25; generator
  typecheck, scoped ESLint with zero warnings, and scoped Prettier all pass
  through the focused host semaphore using pnpm `10.12.1`.
- Clean-customer evidence: v10 is the untouched reproduction. Final proof moves
  to a wholly new post-fix customer rather than repairing v10.
- Status: upstream source fixed; final fixed status waits for the coherent
  commit and untouched post-fix customer acceptance.

### FR-F-010 — Customer env test reads an omitted factory pipeline

- ID/title: FR-F-010 (customer env test reads an omitted factory pipeline).
- Original posture: newly reproduced/critical because a retained focused test
  fails in an otherwise valid freshly materialized customer.
- Confirmed reproduction: untouched v11 customer
  `/private/tmp/maestro-fresh-customer-recovery-v11-c1jtcG/customer`,
  materialized from exact template source
  `dc03cb27cd004cb824f00c93c3ec712a7d3ec0a4` with preview fingerprint
  `sha256:41451305b27abcf9e2050894e3c8f2eeb9ab232b788c41f1096b5403e3c8d3f9`,
  passed its pinned frozen install and baseline commit, then failed the focused
  env-manifest test with `ENOENT` while opening `.buildkite/pipeline.yml`.
- Root cause: customer materialization intentionally omits the factory-owned
  Buildkite pipeline, but the retained env-manifest test still executed the
  template-root assertion that inspects that pipeline's private-authority
  environment boundary.
- Regression: the SaaS blueprint suite requires the projected customer test to
  import `existsSync`, assert that `.buildkite/pipeline.yml` is absent, and omit
  the factory-only pipeline-content read. The regression first failed because
  the projected test retained the factory assertion.
- Canonical fix and files:
  `tooling/generators/src/blueprints/saasApplicationFactory.ts` performs a
  marker-checked customer-only substitution, while
  `tooling/generators/src/blueprints/saasApplication.test.ts` pins the projected
  behavior. The canonical root env-manifest test continues inspecting the real
  Buildkite pipeline; no pipeline, secret, deployment authority, or gate is
  weakened or shipped to the customer.
- Focused result: the red-to-green SaaS blueprint suite passes 25/25 through
  `host-test-slot` with pnpm `10.12.1`; generator typecheck exits zero; scoped
  ESLint reports zero warnings; and scoped Prettier reports all matched files
  use the repository style.
- Clean-customer evidence: v11 is the untouched reproduction. Final proof moves
  to a wholly new post-fix v12 customer rather than repairing v11.
- Status: upstream source fix is focused-green; final fixed status waits for
  untouched v12 customer acceptance and the final evidence update.

### FR-F-011 — Generated feature provenance is unsupported by App Map

- ID/title: FR-F-011 (generated feature provenance is unsupported by App Map).
- Original posture: newly reproduced/high because a retained customer App Map
  gate rejects the SaaS blueprint's canonical `add-feature` provenance.
- Confirmed reproduction: untouched v12 customer
  `/private/tmp/maestro-fresh-customer-recovery-v12-k3uJJM/customer`,
  materialized from exact template source
  `b20d10c04d8a1bef0f8cd93b86f94f3c9e2ddb32` with preview fingerprint
  `sha256:ea3a4b99613ab53cf2f2c1c72e279a8a0c72b665c87809feb7447b900c2ba086`,
  passed its pinned frozen install, doctor, Confect codegen and manifest,
  route-tree check, focused env-manifest suite, and `just test-tooling`, then
  failed `just test-app-map` in two composition tests with
  `Unsupported generator provenance: docs/template/generated/provenance/add-feature/records.json`.
- Root cause: the App Map generator-provenance adapter supported only
  `add-table` and `add-workflow`. The SaaS blueprint truthfully retains reviewed
  `add-feature` provenance and a generated `/records` route, but the adapter
  neither projected that route's generator edge nor consumed the provenance's
  canonical `ownership.system`, leaving the generated route unowned. The
  customer also did not explicitly project the current App Map source closure.
- Regression: the composition fixture preserves the complete canonical route
  tree, adds reviewed `add-feature` provenance and `/records`, and requires both
  `generated-by:route:records->package:tooling/generators` and
  `owns:system:knowledge-brain->route:records`. It first failed with the exact
  unowned-route diagnostic. The SaaS blueprint regression requires exact copy
  replacements for the App Map composition source, its regression, and the
  closed source-authority schema while keeping the sealed alpha.1 plan
  unchanged.
- Canonical fix and files: `tooling/app-map/src/composition.ts` now recognizes
  `add-feature`, validates its ownership record, and projects generation plus
  system ownership for the generated route; `tooling/app-map/src/schema.ts`
  grants the generator-provenance adapter only the new `owns`/`route` authority;
  and the SaaS blueprint projects that exact three-file closure through
  `tooling/generators/src/blueprints/saasApplicationFactory.ts` and
  `tooling/generators/src/blueprints/saasApplication.ts`. No generated customer
  file or immutable release artifact is hand-edited.
- Focused result: the red-to-green composition suite passes 8/8, the complete
  App Map package suite passed 93/93 during the fix, the SaaS blueprint suite
  passes 25/25, and both App Map and generator package typechecks exit zero, all
  through focused `host-test-slot` runs with pnpm `10.12.1`.
- Clean-customer evidence: v12 remains the untouched reproduction. Final proof
  moves to a wholly new post-fix v13 customer rather than repairing v12.
- Status: upstream source fix is focused-green; final fixed status waits for the
  coherent commit and untouched v13 customer acceptance.

### FR-F-012 — App Map misses registry-backed TanStack routes

- ID/title: FR-F-012 (App Map misses registry-backed TanStack routes).
- Original posture: newly reproduced/high because the repaired provenance
  adapter exposes a second customer-only App Map closure failure and blocks the
  remaining acceptance recipes.
- Confirmed reproduction: untouched v13 customer
  `/private/tmp/maestro-fresh-customer-recovery-v13-iTwq2C/customer-clean` at
  baseline commit `113de7e82f43b526e58bd0365387c2e295f58a2e`, materialized from
  exact template source `0d9a13b100a26a8a26a31699895356acbff7e87e` with preview
  fingerprint
  `sha256:451e841631ce070b9e8d7c47d499ce9cce637a982ea1c235609020c3ca19fa63`,
  passed pinned frozen install without lock drift, doctor, Confect codegen and
  manifest, route-tree freshness, the 8/8 env-manifest suite, and all three
  `test-tooling` packages (268/268 quality, 12/12 workflow, 34/34 generators).
  `just test-app-map` then failed two ordinary composition cases because both
  new `route:records` provenance edges were dangling; later recovered recipes
  did not run.
- Root cause: the generated TanStack route is present and correctly uses the
  canonical registry expression `path: saasApplicationRoutes.records`. Its
  generated type metadata resolves that expression as `fullPath: "/records"`,
  but the App Map route adapter reads only string literals directly inside
  `.update({ path: ... })`. The route therefore exists in generated truth while
  remaining invisible to App Map composition.
- Regression: the feature-provenance fixture now mirrors the generated form: a
  registry-backed nonliteral `path` plus literal generated `fullPath` metadata.
  The existing ownership/generation assertions first failed with the exact
  dangling `route:records` diagnostics instead of passing through a synthetic
  literal update path.
- Canonical fix and files: `tooling/app-map/src/composition.ts` now reads
  non-root literal `fullPath` property signatures from TanStack's generated
  route metadata in addition to direct literal update paths;
  `tooling/app-map/src/composition.test.ts` pins the generated form; and the
  existing exact customer projection regression in
  `tooling/generators/src/blueprints/saasApplication.test.ts` requires that
  parser support. Neither generated TanStack output nor the customer is edited.
- Focused result: the strengthened red-to-green composition suite passes 8/8,
  the SaaS blueprint suite passes 25/25, both App Map and generator package
  typechecks exit zero, scoped ESLint reports zero warnings, scoped Prettier is
  clean, and `git diff --check` passes, all through focused `host-test-slot`
  runs with pnpm `10.12.1` where applicable.
- Clean-customer evidence: v13 remains the untouched reproduction. Final proof
  moves to a wholly new post-fix customer rather than repairing v13.
- Status: upstream source fix is focused-green; final fixed status waits for the
  coherent commit and untouched post-fix customer acceptance.

### FR-F-013 — Customer Justfile advertises omitted factory gates

- ID/title: FR-F-013 (customer Justfile advertises omitted factory gates).
- Original posture: newly reproduced/high because retained canonical recipes
  fail in a freshly materialized customer before its remaining acceptance can
  run.
- Confirmed reproduction: untouched v14 customer
  `/private/tmp/maestro-fresh-customer-recovery-v14-O5m7TW/customer` at baseline
  commit `ae347e907c622c013fd4f658e23f6ea886cfc59b`, materialized from exact
  template source `8b4eb2e6a4f5f8f957eb09c86516031336831588` with preview
  fingerprint
  `sha256:7c65a1a469be7cd32da1003bf2169e2f4d2cc1f1c6914a10a05f784622b72d25`. It
  passed the pinned frozen install without lock drift, doctor, Confect codegen
  and manifest, route-tree freshness, env-manifest 8/8, tooling quality 268/268,
  workflow tooling 12/12, generator tooling 34/34, App Map 90/90, workflow
  12/12, and Convex compatibility 22/22. The next retained recipe,
  `just test-pr-backlog`, then failed because root script `test:pr-backlog` is
  absent. Direct closure inspection also found retained `evals`,
  `check-workflow-output-smoke`, and `mutation` recipes whose root scripts or
  `.buildkite/scripts/mutation.sh` owner are intentionally omitted.
- Root cause: current customer composition projected the template-root
  `Justfile` unchanged while correctly narrowing the customer root-script and
  filesystem closures. Four factory-only recipes consequently advertised
  commands with no customer owner.
- Regression: the SaaS blueprint suite requires the exact reviewed base-generate
  replacement for `Justfile`, rejects all four factory-only recipe names, and
  checks every retained direct `pnpm <script>` delegation against the projected
  customer root scripts. The regression first failed on the retained
  `template:workflow-output-smoke` delegation after the original v14
  `test:pr-backlog` reproduction.
- Canonical fix and files:
  `tooling/generators/src/blueprints/saasApplicationFactory.ts` performs
  fail-closed, marker-checked removal of only the four factory-only recipe
  blocks; `tooling/generators/src/blueprints/saasApplication.ts` grants the
  current projection exact base-generate replacement authority and registers it;
  and `tooling/generators/src/blueprints/saasApplication.test.ts` pins both the
  closure and current-plan inventories. The canonical template `Justfile`, its
  factory gates, and the sealed release remain unchanged.
- Focused result: the red-to-green SaaS blueprint suite passes 25/25, generator
  typecheck exits zero, scoped ESLint reports zero warnings, scoped Prettier is
  clean, and `git diff --check` passes through the focused host semaphore using
  pnpm `10.12.1` where applicable.
- Clean-customer evidence: untouched v16 customer
  `/private/tmp/maestro-fresh-customer-recovery-v16-0xxMcj/customer` proves the
  narrowed recipe closure and remains clean at baseline commit
  `4fed48852dea90eb3b881181c56b2a0e359f2dff` after all authorized focused
  acceptance commands.
- Status: fixed upstream and confirmed in untouched v16; commit
  `4043cc9142889934f992113d6426239fc86e1819`.

### FR-F-014 — Customer Justfile replacement names the wrong base action

- ID/title: FR-F-014 (customer Justfile replacement names the wrong base
  action).
- Original posture: newly reproduced/critical because reviewed public create
  rejects the post-FR-F-013 candidate before preview or materialization.
- Confirmed reproduction: disposable v15 release checkout
  `/private/tmp/maestro-fresh-customer-recovery-v15-xb0vCK/release` at exact
  template source `4043cc9142889934f992113d6426239fc86e1819`, with the reviewed
  `maestro-template-v0.2.0-alpha.1` tag bound to the same SHA and a clean pinned
  frozen install, failed the public create preview with
  `AGENT_PACK_CREATE_UNSAFE_TARGET: Blueprint target plan overlaps release operation: Justfile`.
  No customer target was written.
- Root cause: the sealed base manifest owns `Justfile` as `action: "generate"`,
  but the new current blueprint projection declared `replaces: "copy"`. The
  materializer correctly requires exact agreement with the base write authority
  and rejected the mismatch.
- Regression: the SaaS blueprint suite now requires `Justfile` to declare exact
  `replaces: "generate"` authority. It first failed with the projected `copy`
  value.
- Canonical fix and files:
  `tooling/generators/src/blueprints/saasApplication.ts` changes only the
  `Justfile` replacement action from `copy` to `generate`, and
  `tooling/generators/src/blueprints/saasApplication.test.ts` pins the sealed
  manifest contract. No validator, materializer, sealed manifest, or generated
  customer file is changed.
- Focused result: the red-to-green SaaS blueprint suite passes 25/25, generator
  typecheck exits zero, scoped ESLint reports zero warnings, and
  `git diff --check` passes through the focused host semaphore using pnpm
  `10.12.1` where applicable.
- Clean-customer evidence: public preview and write both succeed for untouched
  v16 from exact post-fix source, with the same reviewed fingerprint and zero
  collisions; its generated customer remains clean after the authorized focused
  acceptance sequence.
- Status: fixed upstream and confirmed in untouched v16; commit
  `e629cd2357a886aead3b936546cb13386a554ba7`.

### v16 focused fresh-customer acceptance checkpoint

- Release checkout:
  `/private/tmp/maestro-fresh-customer-recovery-v16-0xxMcj/release`.
- Customer checkout:
  `/private/tmp/maestro-fresh-customer-recovery-v16-0xxMcj/customer`.
- Exact template source and reviewed tag:
  `e629cd2357a886aead3b936546cb13386a554ba7`.
- Release/ownership checksum:
  `sha256:fb8aabc5d6309cb15b040a7c383924b2538cda70962ee59f25693fdc29e2f2ab`.
- Public preview/write fingerprint:
  `sha256:7311d989c401a55bd1a8039d8d6dd0954e8ae01166c0d91da2bed0ab048b8890`;
  1,382 writes, 3,201 omissions, zero collisions, and 1,382 materialized files.
- Pinned frozen customer install: pnpm `10.12.1`, lock hash unchanged before and
  after install at
  `70a691b32fef0999b3df1dc837f2d971417571f6f76ccbaeb8612aeb13bf64ea`.
- Customer baseline commit: `4fed48852dea90eb3b881181c56b2a0e359f2dff`.
- Focused freshness: fake doctor reports zero warnings and zero failures;
  Confect codegen reports generated files up to date; Confect manifest exits
  zero; route-tree reports `ok (pin-only)`; env-manifest passes 8/8.
- Retained individual recipes through `host-test-slot --class focused`: tooling
  quality 268/268, workflow tooling 12/12, generator tooling 34/34, App Map
  90/90, workflow 12/12, and Convex compatibility 22/22.
- Recipe closure: `test-pr-backlog`, `evals`, `check-workflow-output-smoke`, and
  `mutation` are absent; every retained direct `pnpm <script>` recipe is backed
  by the projected customer root script closure.
- Final observed customer state: empty Git status and unchanged lock hash.
- Explicitly not claimed by this checkpoint: aggregate/full verification, Fabro,
  manual proof, publish, deploy, provider, or secret actions, all forbidden by
  the current host/user lane constraints.
