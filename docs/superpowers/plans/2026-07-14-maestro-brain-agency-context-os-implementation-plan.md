# Maestro Brain: Agency Context OS Implementation Plan

> **Status:** parallel-factory execution plan; implementation-ready only for
> task packets marked `ready` in Appendix M. Every `open:F` packet is blocked
> until its exact hand-authored path and shared-lock inventory is completed and
> the binding manifest is regenerated.
>
> **Plan date:** 2026-07-14  
> **Canonical design:**
> [`../specs/2026-07-14-maestro-brain-agency-context-os-design.md`](../specs/2026-07-14-maestro-brain-agency-context-os-design.md)  
> **Pinned
> implementation base:**
> [`modernagencysales/maestro-template-saas-ui@123adb18`](https://github.com/modernagencysales/maestro-template-saas-ui/tree/123adb18c0abfe81fe98dd531c910b6cf493c8dd)

## Goal

Ship the smallest launchable Maestro Brain: one agency connects one Slack
workspace through Nango, explicitly adds the Maestro bot to multiple channels,
captures exact source history into an organization vault, routes complete source
units into isolated Client Brains, maintains a cited and versioned Client Brief,
and serves the same authorized context through the SaaS UI, requester-private
Slack answers, read-only API, and stateless MCP.

This plan is deliberately executable by an engineer or agent with no access to
the originating conversation. Each task names its requirements, dependency,
template classification, existing anchors, exact files, test-first sequence,
typed contract, state changes, migration and rollback, commands, receipt, and
lane branch/commit boundary.

The binding task manifest contains exactly 56 task contracts. That count is
authoritative and supersedes any stale instruction, receipt, or handoff that
refers to 55 tasks.

## Product And Architecture Outcome

- Convex is the V1 canonical store; public contracts expose stable keys and
  never Convex document IDs.
- WorkOS/AuthKit establishes human identity and agency organization; the
  template's existing `viewer | editor | admin | owner` role resolver remains
  the only human authorization source.
- Nango owns Slack OAuth, token storage/refresh, API proxying, bounded history
  and send actions. Maestro owns the native signed Events receiver, connection
  binding, exact bot identity, per-channel scheduling/state, source semantics,
  routing, lifecycle, and delivery authorization.
- Capture, normalization, ordering, persistence, leases, policies, lifecycle,
  and commits are deterministic. Semantic selection, classification,
  maintenance, scope selection, and answering are explicit structured model
  calls. No helper mixes the two sides.
- Slack Connect may route captured source through Direct/Classify, but delivery
  is capture-only in V1. Internal Slack answers are visible only to the verified
  requester through ephemeral or DM delivery.
- External API/MCP is read-only and one-Brain-scoped. Analytics, arbitrary
  connectors, file ingestion, Git sync, re-import, write MCP, channel-wide
  answers, digests, and content generation remain outside V1.

## Non-Negotiable Execution Rules

Repository-wide layer, generator, work-package, testing, gate, commit,
suppression, and worktree rules come from [`AGENTS.md`](../../../AGENTS.md) and
the linked app-factory/playbook sources; this plan does not restate or weaken
them. Product-specific additions are:

1. S00-T01's three-host Convex plugin receipt is acceptance and deployment
   authority. It does not block isolated source preparation, integration, or
   review; affected tasks remain explicitly unaccepted until the receipt is
   green.
2. The pinned SaaS UI/Chakra fork is the implementation base; external Maestro
   is read-only prior art.
3. This Markdown is canonical. Generate, validate, hash, and discard only the
   next stack's temporary StackPlan JSON.
4. Each StackPlan reports hand-authored source lines separately from generated,
   test, and documentation review totals. The 300-source-line and four-slice
   limits remain binding.
5. Receipts contain names, versions, hashes, counts, statuses, redacted error
   tags, and command results—never secrets or customer text.

## Parallel Execution Amendment

The task packets remain the acceptance contracts, but their original stack
dependencies are no longer code-start barriers. This greenfield product has no
tenant data to preserve, so downstream work may begin against frozen typed
contracts, generated refs, and deterministic fake/local providers before the
corresponding real body is integrated. A task is still not accepted until all of
its original prerequisites and focused evidence are integrated.

The machine-readable code-start graph at
`docs/superpowers/execution/maestro-brain/task-manifest.json` is binding for
Fabro dispatch. It must preserve every original acceptance prerequisite while
applying these rules:

1. **Contract before body:** stable keys, principals, typed errors, lifecycle
   generations, provider interfaces, capability/workflow specs, and receipt
   shapes unblock consumers. Consumers use generated refs or deterministic
   fixtures; they do not duplicate a missing upstream body.
2. **Speculative isolation:** S00-T01 remains external acceptance and deployment
   authority while independent code is prepared, reviewed, and integrated.
   Integrated records whose original dependency is unmet must say
   `accepted: false` and name the `acceptanceBlocker`; no candidate is deployed
   before the three-host receipt is green.
3. **Central shared ownership:** generated Convex/Confect output, route trees,
   root dependency files, canonical schema registries, environment manifests,
   and other manifest-declared shared locks have one live owner. Parallel lanes
   never resolve those files independently.
4. **Focused lane quality:** each lane writes tests before behavior, runs its
   task packet's focused commands plus its deterministic gate profile, receives
   an independent contract/security review, and emits a minimal proof packet.
   Red gates return to implementation inside the same Fabro run. Appendix A's
   source number is the task estimate. A slice is one task contract. A task
   remains one slice and may produce one to four coherent one-intention commits;
   every commit remains <=300 changed hand-authored source lines and the task is
   accepted only as one proof set. If a task requires more than four coherent
   commits, or any coherent commit cannot fit the limit, split the task contract
   and regenerate the binding manifest before implementation.
5. **Tranche integration:** one-intention task commits are cherry-picked into
   dependency-safe integration tranches.
   `rtk host-test-slot --class full pnpm verify` runs once on the integrated
   tranche; tasks become complete only after that gate passes. Broad
   verification is not duplicated in every isolated lane.
6. **Phase-scoped delivery:** a temporary StackPlan contains at most four whole
   slices and is a planning/receipt unit, not a PR boundary. A manifest tranche
   contains one or more validated StackPlans and is the unit of full
   host-slotted verification and PR delivery. The binding manifest currently
   defines five tranches. Use one PR per manifest tranche; if size requires
   subdivision, materialize unique sub-tranche IDs in the manifest before
   dispatch. Preserve one intention per task commit and its receipt. Graphite
   ordering is optional PR hygiene, never the scheduler.
7. **Just-in-time context:** the approved design, this task packet, its named
   anchors/playbook, and directly relevant vendored examples are sufficient. Do
   not rerun global product research, plan review, task-plan generation, or AI
   CI-risk scoring before implementation.

The dispatcher may start only tasks whose `codeStartAfter` contracts are
available and whose file locks do not intersect another active lane. The
original dependency in each packet and Appendix A remains its `acceptanceAfter`
condition.

## Source Pins And Existing-Code Authority

| Source                      | Pinned revision                                                                                                                                           | Permitted use                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| SaaS UI template            | [`123adb18c0abfe81fe98dd531c910b6cf493c8dd`](https://github.com/modernagencysales/maestro-template-saas-ui/tree/123adb18c0abfe81fe98dd531c910b6cf493c8dd) | Canonical implementation base and architecture authority                          |
| Maestro                     | [`c8b644c154af91f7e6b67b31861fd6b7eaa211b1`](https://github.com/modernagencysales/maestro/tree/c8b644c154af91f7e6b67b31861fd6b7eaa211b1)                  | Read-only Brain identity, page-tree, source-unit, and export prior art            |
| Nango                       | [`0bef47367085384c037a0ccca83c7d5bfc696d7f`](https://github.com/NangoHQ/nango/tree/0bef47367085384c037a0ccca83c7d5bfc696d7f)                              | OAuth, Connect session, Slack proxy, and webhook contract reference               |
| Nango integration templates | [`e286bd20c5795f9e8bfbc9053e65669941c08c89`](https://github.com/NangoHQ/integration-templates/tree/e286bd20c5795f9e8bfbc9053e65669941c08c89)              | Channel/message/sending prior art; never copy the one-channel scheduler wholesale |
| Vercel AI SDK Slackbot      | [`7d84809865ba4624a38eab4dd6dbb2aecc3758bc`](https://github.com/vercel-labs/ai-sdk-slackbot/tree/7d84809865ba4624a38eab4dd6dbb2aecc3758bc)                | Thread and mention behavior only; do not copy static Slack-token ownership        |
| Context OS                  | [`b31051f5a7837c70b9e5d7b81f8a055801877741`](https://github.com/jacob-dietle/context-os/tree/b31051f5a7837c70b9e5d7b81f8a055801877741)                    | Simplicity/read-before-act/deposit-after-act principles only                      |

### Drift Protocol

Before every stack:

1. Run `rtk git status --short`, `rtk git rev-parse HEAD`, and
   `rtk git merge-base --is-ancestor 123adb18c0abfe81fe98dd531c910b6cf493c8dd HEAD`.
2. Confirm all prerequisite stack PRs are present in `HEAD`; record their merge
   commits in the stack receipt.
3. Re-open every existing-code anchor used by that stack. If a file moved or a
   contract changed, stop and add a dated **Drift amendment** to this plan
   before generating the stack manifest.
4. Never silently move an external pin. A pin update requires a docs-only PR
   that states the old/new revisions, changed assumptions, affected tasks, and
   re-run review evidence.
5. Build the temporary StackPlan JSON against that exact `HEAD`, with one slice
   per task, `estLines <= 300`, no more than four slices, all task refs present,
   contract risk IDs populated, and each work package classified.
6. Run `rtk pnpm stack:check <absolute-temp-plan.json>`. A passing receipt is a
   prerequisite to the first code commit in the stack.

## Requirement Ledger

| ID     | Requirement                                                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FND-01 | Install and verify the curated Convex Codex plugin on all three working computers before source implementation.                                            |
| FND-02 | Pin source revisions, detect drift, use temporary validated stack manifests, and preserve unrelated work.                                                  |
| FND-03 | Use expand/backfill/verify/contract migrations with resumable, idempotent batches and explicit rollback.                                                   |
| IAM-01 | Replace fake AuthKit/Convex identity with real WorkOS-backed identity and organization binding.                                                            |
| IAM-02 | Provision and list only authorized agency/client Brains; no unfiltered public workspace query remains.                                                     |
| IAM-03 | Use tenant-namespaced stable public keys for agencies, Brains, pages, sources, revisions, connections, receipts, and exports.                              |
| IAM-04 | Reuse `viewer \| editor \| admin \| owner`, enforce roles server-side, manage members/invites, and audit privileged success/denial.                        |
| UI-01  | Show only Clients, Agency Brain, Connections, Settings, and global Ask/Search in the SaaS UI/Chakra shell.                                                 |
| UI-02  | Create an agency Brain and client Brains with the ordinary six-page Client Brief and a sub-15-minute first-value path.                                     |
| UI-03  | Provide a responsive Notion-like BlockNote page tree/editor with read-only viewer behavior and authorized editing.                                         |
| UI-04  | Expose citations, page history/diff, restore-as-new-revision, source freshness, and review queues.                                                         |
| SLK-01 | Connect one Slack workspace per agency through Nango Connect; reauthorization preserves connection identity and increments generation.                     |
| SLK-02 | Capture every explicitly joined channel independently; never auto-join, sample, use a shared cursor, or stop after one channel.                            |
| SLK-03 | Support immutable Direct, Classify-with-finite-allowlist, and Capture-only channel policies; classification selects zero or one Brain.                     |
| SLK-04 | Verify native Slack Events authenticity, replay window, size, team/app/bot/connection binding, bot membership, and event idempotency before tenant writes. |
| SLK-05 | Preserve exact append-only observations, `A -> B -> A` edits, tombstones, total ordering, hashes, permalinks, and immutable latest pointers.               |
| SLK-06 | Assemble bounded immutable source-unit snapshots at a fixed cut before any model call.                                                                     |
| SLK-07 | Run fenced, fair, bounded live/recent/deep/reconciliation work with atomic cursors, rate limits, dead letters, and honest gaps.                            |
| SLK-08 | Keep Slack Connect delivery capture-only while allowing reviewed Direct/Classify ingestion; send internal answers only to a current requester.             |
| SLK-09 | Link exact Slack/Maestro identities and use an idempotent, authorization-fenced outbound delivery outbox.                                                  |
| ZFC-01 | Keep capture/gather/commit pipes deterministic and model adapters semantic, separately typed, metered, observable, and testable.                           |
| AI-01  | Provide provider-neutral schema-constrained LLM calls with immutable request/response hashes, versions, usage, budgets, and typed failures.                |
| AI-02  | Make Classify review-first, allowlist-closed, zero-or-one target, no-confidence-authority, and independently replayable.                                   |
| AI-03  | Make Brain maintenance cited, review-first, budgeted, restorable, and explicitly administrator-graduated to Autopilot.                                     |
| AI-04  | Treat every customer/provider/model value as untrusted data and enforce model egress, retention, prompt-injection, cost, and tool boundaries.              |
| KNW-01 | Store stable page trees, immutable page revisions, exact source-revision citations, and optimistic-concurrency/fencing metadata.                           |
| KNW-02 | Propagate edit/delete/revocation/retention/DSAR/legal-hold actions across every raw, derived, indexed, queued, delivered, exported, and backup copy.       |
| KNW-03 | Use an asynchronous search seam and Brain-scoped active search projections; organization-vault rows never enter client search directly.                    |
| KNW-04 | Pin immutable retrieval candidate manifests, return cited answers or typed abstention, and reauthorize immediately before delivery.                        |
| KNW-05 | Export deterministic Markdown/JSON bundles with stable paths, lifecycle fences, temporary Convex storage, expiry, and purge; no import or Git sync.        |
| HLS-01 | Create display-once, hashed, expiring, revocable, one-Brain service-principal keys with `viewer` ceiling and `brain:read`/`brain:ask` scopes.              |
| HLS-02 | Dispatch web, Slack, API, CLI, and MCP through the same generated server capabilities with server-owned tenant injection.                                  |
| HLS-03 | Expose only reviewed read/Ask tools through stateless HTTPS `POST /mcp` with strict protocol, origin, size, timeout, rate, and redaction controls.         |
| REL-01 | Pass frozen classification, citation-entailment, abstention, maintenance, multilingual, and prompt-injection evaluations by model/prompt version.          |
| REL-02 | Pass the declared 25-client/100-channel/100k-revision/burst/concurrency capacity fixture with fair progress and no tenant bleed.                           |
| REL-03 | Ship redacted observability, spend/rate/storage budgets, overload admission control, audited recovery, and kill switches.                                  |
| REL-04 | Prove staging, pilot value, rollback, and launch evidence; any cross-client, audience, key-scope, or webhook incident blocks launch.                       |

## Acceptance Delivery Map

Each row remains an acceptance checkpoint. It is not the implementation
scheduler and no longer requires one PR per task. Parallel code-start and
integration-tranche ownership are defined by Appendix O and the generated task
manifest.

| Stack                                        | Slices | Depends on    | Release checkpoint                                                |
| -------------------------------------------- | -----: | ------------- | ----------------------------------------------------------------- |
| S00 Readiness and migration foundation       |      4 | none          | Plugin/pins, isolated deployments, migration harness              |
| S01 Identity, tenancy, and RBAC              |      4 | S00           | Real sign-in/provision/list/member isolation on staging           |
| S02 Brain persistence and revision contracts |      4 | S01           | Authorized stable-key page/version/citation/editor contracts      |
| S03 Product shell and Client Brief UI        |      4 | S02           | Useful responsive Brain UI with history/restore                   |
| S04 Nango and channel control plane          |      4 | S01, S03      | One Slack connect flow and multi-channel policy UI                |
| S05 Exact source ledger and routing          |      4 | S04           | Verified atomic capture, immutable snapshots, Direct/Capture-only |
| S06 Workpool, backfill, and reconciliation   |      4 | S05           | Fair recent/deep progress, rate handling, recovery                |
| S07 Lifecycle and derived-data revocation    |      4 | S05, S06      | Current-read revocation plus retention/DSAR/purge proof           |
| S08 Structured cognition and review          |      4 | S02, S05, S07 | ZFC classification and maintenance with review gates              |
| S09 Search, retrieval, and Ask               |      4 | S07, S08      | Authorized projection search and cited/abstaining web Ask         |
| S10 Slack identity and private delivery      |      4 | S04, S09      | Verified requester-only mention/DM answers                        |
| S11 Service principals, API, and MCP         |      4 | S09           | Read-only one-Brain API/MCP from shared capabilities              |
| S12 Deterministic export                     |      3 | S07, S11      | Byte-identical authorized export with expiring artifact           |
| S13 Evals, capacity, and operations          |      4 | S10, S11, S12 | Reproducible eval/capacity and safe operations                    |
| S14 Staging, pilot, launch, and rollback     |      1 | S13           | Signed release, pilot, promotion, and rollback evidence           |

---

## S00 — Machine Readiness, Pins, Backlog, And Migration Foundation

### S00-T01 — Install And Attest The Convex Codex Plugin On Three Hosts

- **Outcome / requirements:** satisfy FND-01 before product acceptance or
  deployment; produce three distinct, redacted, reproducible host receipts.
- **Classification:** `template-gap`; target `TB-DEVEX-CONVEX-01` (multi-host
  plugin readiness is not represented by a repo generator); resolution is a host
  bootstrap receipt, not application code.
- **Dependencies:** none. This is external acceptance and deployment authority,
  not a code-start, integration, or review gate.
- **Existing anchors:** the repo already uses Convex/Confect and mounts Convex
  components in
  [`convex.config.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/convex/convex.config.ts#L1-L25);
  follow the official
  [Convex Codex setup](https://docs.convex.dev/ai/using-codex).
- **Files:** create
  `docs/superpowers/receipts/maestro-brain/convex-plugin-readiness.md`; modify
  no application source.
- **Failure-first gate:** on each computer, run `rtk hostname`,
  `rtk codex --version`, and `rtk codex plugin list`. The precondition is red
  until three unique host identifiers are recorded and `convex@openai-curated`
  is present on each.
- **Implementation:** on each host run exactly
  `rtk codex plugin add convex@openai-curated`; restart the Codex session if the
  CLI requires it; rerun `rtk codex plugin list`; open a fresh session and prove
  the Convex plugin is discoverable. Record host alias, OS, Codex version,
  plugin identifier/version, command timestamp, and pass/fail only. Do not
  record usernames, home paths, tokens, or machine serial numbers.
- **Contract / state:** host state is
  `unknown -> missing | installed -> verified`; only `verified` counts. An
  already-installed result is acceptable after the fresh-session check.
- **Migration / rollback:** no data migration. If the plugin breaks a host,
  remove only that plugin using the CLI's documented remove command, record the
  failure, and keep acceptance and deployment blocked; never attest readiness
  with two hosts.
- **Focused verification:** external-only acceptance: run
  `rtk codex plugin list` and a fresh-session Convex capability discovery on
  each of the three named hosts; then run
  `rtk pnpm exec prettier --check docs/superpowers/receipts/maestro-brain/convex-plugin-readiness.md`,
  and `rtk git diff --check`.
- **Completion receipt:** the Markdown file contains exactly three redacted host
  rows, all `verified`, plus the command/version evidence. Any missing row keeps
  S00 open.
- **Lane branch / commit boundary:** branch
  `codex/brain-s00-convex-plugin-readiness`; commit
  `chore: attest Convex plugin readiness`; docs-only first slice.

### S00-T02 — Freeze Sources, Repair Pnpm Settings, And Prove Stack Receipts

- **Outcome / requirements:** satisfy FND-02, make every later `template-gap`
  reviewable, restore the ignored root pnpm override contract, and prove the
  just-in-time StackPlan projection fails closed.
- **Classification:** `template-gap`; target the missing Maestro Brain pattern
  ledger; backlog reference `docs/template/porting-backlog.md`; resolution is to
  register gaps and their promotion/import paths.
- **Dependencies:** S00-T01.
- **Existing anchors:** current planning validation requires classified work
  packages in
  [`tooling/stack/plan.mts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/stack/plan.mts#L12-L58),
  while the current backlog already identifies source ingestion, migrations, and
  lifecycle gaps in
  [`porting-backlog.md`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/porting-backlog.md#L506-L541).
- **Files:** modify `package.json`, `pnpm-workspace.yaml`, and
  `docs/template/porting-backlog.md`; create
  `docs/superpowers/receipts/maestro-brain/source-baseline.md` and
  `docs/superpowers/receipts/maestro-brain/stack-execution-contract.md`; do not
  modify the design or this plan except through an explicit drift amendment.
- **Failure-first gate:** run `rtk pnpm --version` and
  `rtk pnpm config get overrides`; fail while pnpm 10 reports that
  `package.json#pnpm.overrides` is ignored or the configured override map is
  unavailable. Run `rtk git rev-parse HEAD`; verify the implementation base
  contains `123adb18c0abfe81fe98dd531c910b6cf493c8dd`; verify the five external
  repositories at the pinned commits in **Source Pins**. Fail if any pin cannot
  be resolved or if an anchor disagrees with the design. Create the temporary
  S00 manifest outside the repo, omit `workPackages.followUpGates`, use
  `estLines: 301`, and add a fifth slice in separate trials;
  `rtk pnpm stack:check <absolute-temp-plan.json>` must reject each before the
  corrected manifest passes.
- **Implementation:** move the existing override map unchanged from
  `package.json#pnpm.overrides` to the root `overrides` setting in
  `pnpm-workspace.yaml`; do not change package pins or regenerate the lockfile
  unless pnpm reports a real resolution change. Add backlog entries with exact
  IDs and ownership: `TB-DEVEX-CONVEX-01`, `TB-AUTHKIT-01`, `TB-BRAIN-UI-01`,
  `TB-NANGO-SLACK-01`, `TB-SOURCE-01`, `TB-SOURCE-LIFECYCLE-01`,
  `TB-AUTHORIZED-KNOWLEDGE-01`, `TB-STRUCTURED-LLM-01`,
  `TB-INTERNAL-WORKFLOW-01`, `TB-ASYNC-SEARCH-01`, `TB-HEADLESS-01`,
  `TB-BRAIN-EXPORT-01`, `TB-DEPLOY-ISOLATION-01`, `TB-AUTHORIZED-TENANCY-01`,
  `TB-ACCESS-UI-01`, `TB-EVALS-01`, `TB-OPERATIONS-01`, and
  `TB-RELEASE-EVIDENCE-01`. Each entry names current absence, generic template
  lesson, product-specific first implementation path, promotion criteria, owner,
  and focused gates. Document the StackPlan fields, source-line audit,
  generated/test/docs review totals, and split-not-waive rule. Record source
  pins without customer data and delete the temporary JSON after preserving its
  hash/result.
- **Contract / state:** a gap is
  `registered -> product instance -> proven -> promoted | retained product-specific`;
  no task may call a gap “complete” just because the product instance exists.
- **Migration / rollback:** workspace configuration plus docs only. Revert the
  setting relocation if pnpm does not resolve the identical override map. Revert
  the docs if a pin or gap name is wrong; never renumber an ID after a dependent
  PR references it.
- **Focused verification:**
  `rtk pnpm exec prettier --check docs/template/porting-backlog.md docs/superpowers/receipts/maestro-brain/source-baseline.md docs/superpowers/receipts/maestro-brain/stack-execution-contract.md`,
  `rtk pnpm --version`, `rtk pnpm config get overrides`,
  `rtk host-test-slot --class focused pnpm test:stack`,
  `rtk pnpm check:docs-freshness`, `rtk git diff --check`, broad verification is
  deferred to tranche acceptance under Appendix L.
- **Completion receipt:** source commit, resolved URL, verification date, gap
  IDs/promotion paths, adversarial fail/pass transcript, temporary manifest
  hash, depth, and source estimates are present; no floating source or stale
  JSON plan is treated as authority.
- **Lane branch / commit boundary:** branch
  `codex/brain-s00-source-gap-stack-contract` stacked on T01; commit
  `chore: define Brain execution contract`.

### S00-T03 — Isolate Staging And Production Deployments

- **Outcome / requirements:** satisfy FND-02 and REL-04 before tenant data
  exists; staging and production must use distinct Convex deployments,
  credentials, provider callbacks, data, and promotion/rollback paths with no
  demo seed.
- **Classification:** `template-gap`; target `TB-DEPLOY-ISOLATION-01`; the
  product instance repairs the template deployment scripts, and the generic
  promotion path is a reusable isolated-backend release pattern.
- **Dependencies:** S00-T02.
- **Existing anchors:** the current config explicitly shares one read-only demo
  Convex backend between staging and production in
  [`project.config.json`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/project.config.json#L1-L42),
  and both pinned deploy scripts seed `demo/showcase` after backend deploy
  ([staging](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/.buildkite/scripts/staging-deploy.sh#L19-L35),
  [production](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/.buildkite/scripts/production-promote.sh#L24-L41)).
- **Files:** modify `project.config.json`, `.buildkite/pipeline.yml`,
  `.buildkite/scripts/staging-deploy.sh`,
  `.buildkite/scripts/production-promote.sh`, `tooling/release/src/index.ts`,
  `tooling/release/src/index.test.ts`, `.env.example`,
  `docs/template/env-manifest.md`, `docs/template/env-manifest.json`,
  `tooling/quality/src/check-definitions.mts`, and
  `tooling/quality/check-config-drift.test.mts`; create
  `tooling/release/src/project-config.ts` and
  `docs/superpowers/receipts/maestro-brain/deployment-isolation.md`.
- **Failure-first tests:** current config fails because staging/production
  `convexUrl` values match; current scripts fail because they invoke
  `demo/showcase:seed`; staging credentials cannot deploy production and vice
  versa; promotion of an unstaged SHA and rollback to an incompatible schema
  fail closed. `rtk pnpm check:config-drift` must fail while its static
  descriptor still requires `sharedConvexBackendNote` and `demo/showcase:seed`.
- **Implementation:** provision/configure distinct deployment names, URLs and
  namespaced deploy-key environment names and callback-origin slots; later
  provider tasks populate the WorkOS/Nango callback registrations. Remove demo
  seeding from both tenant deploy paths; require explicit
  `deploy-doctor staging` and `deploy-doctor production`; backend-first staging
  emits a signed release packet containing commit, deployment hash, schema hash,
  manifest hash, build ID, and timestamp. Production promotion requires that
  exact packet and never defaults a missing staged SHA to the current SHA. Add
  `rollback-plan <current-release-packet> <candidate-release-packet>`; it
  selects only a prior binary whose schema/manifest contract is
  forward-compatible and never performs a data down-migration. Update the
  config-drift descriptor in the same slice to require the isolated deployment,
  key, callback, and release-packet shape and to forbid the shared-backend note
  and tenant demo seeding.
- **Typed errors / state:** environment is
  `unconfigured -> isolated -> staged -> promoted | rollback_ready`; errors are
  `SharedBackendForbidden`, `EnvironmentCredentialMismatch`,
  `DemoSeedForbidden`, `UnstagedCommit`, and `IncompatibleRollback`.
- **Migration / compatibility / rollback:** no customer data exists yet. Create
  the production deployment empty, verify isolation canaries, and destroy only
  erroneous empty deployments. Never copy the shared demo database into either
  tenant environment.
- **Focused verification:** lane-local gates are
  `rtk host-test-slot --class focused pnpm --dir tooling/release test`,
  `rtk pnpm --dir tooling/release typecheck`,
  `rtk host-test-slot --class focused pnpm --dir tooling/quality test check-config-drift`,
  `rtk pnpm check:config-drift`, script/config fixture tests proving distinct
  URL/deployment/key names, required callback origins, no `demo/showcase:seed`,
  no missing-receipt promotion fallback, staged schema/manifest matching,
  incompatible rollback rejection, and `rtk pnpm check:env-boundary`.
  Provider-backed `rtk pnpm deploy:doctor staging` and
  `rtk pnpm deploy:doctor production` are acceptance gates when credentials are
  available; broad verification belongs to tranche integration.
- **Completion receipt:** redacted deployment names/URL hashes, distinct-key
  owner metadata, negative cross-deploy attempts, staged/promotion/rollback-plan
  results, and no-demo-seed scan.
- **Lane branch / commit boundary:** branch
  `codex/brain-s00-deployment-isolation`; commit
  `fix: isolate tenant deployments`.

### S00-T04 — Add A Resumable Expand/Backfill/Contract Migration Harness

- **Outcome / requirements:** satisfy FND-03 before stable-key or source tables
  change; provide a tested, internal-only, idempotent migration path.
- **Classification:** `template-gap`; target the migrations component pattern;
  backlog `TB-SOURCE-01` plus existing backlog item 87; resolution is a generic
  Confect/Convex migration wrapper promoted after two product migrations use it.
- **Dependencies:** S00-T03.
- **Existing anchors:** `@convex-dev/migrations` is already mounted but unused
  in
  [`convex.config.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/convex/convex.config.ts#L1-L25),
  and the backlog explicitly calls for a real example in
  [`porting-backlog.md`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/porting-backlog.md#L524-L526).
  Use `packages/convex/confect/jobs/workpool.spec.ts` and
  `packages/convex/confect/jobs/workpool.impl.ts` as the plain-function
  registration anchor: the spec imports the plain Convex function with
  `import type` and `FunctionSpec.convexInternalMutation`, while the impl
  imports its runtime value and binds it with `FunctionImpl.make`.
- **Files:** create `packages/convex/confect/internal/migrations.ts`,
  `packages/convex/test/migrations.test.ts`, and
  `packages/convex/confect/internal/migrations.spec.ts`,
  `packages/convex/confect/internal/migrations.impl.ts`,
  `packages/convex/confect/tables/migrationRuns.ts`,
  `packages/convex/confect/tables/migrationReceipts.ts`, and
  `docs/product/maestro-brain-migrations.md`; modify
  `docs/template/porting-backlog.md`. Confect generates
  packages/convex/convex/internal/migrations.ts and the remaining generated
  contract output only in tranche integration.
- **Failure-first tests:** use generated Confect refs and the real mounted
  component to prove an internal migration runs in bounded batches, starts with
  an explicit `null` initial cursor, resumes after an injected production
  component failure from the last committed cursor, skips already-migrated rows,
  decodes the component's dry-run rollback into its truthful
  component-observable `scanned` count without a write, marks definition-owned
  counts unavailable rather than inventing them when the component cannot return
  them, refuses unknown/reserved/destructive migrations, rejects forged cursors
  and concurrent lease owners, aggregates deterministic child hashes, reruns
  idempotently, and exposes no public/MCP/API function. A spy-only adapter,
  hand-implemented paginator, fabricated component reference, or string search
  over a spec is not acceptance evidence.
- **Implementation:** instantiate `componentMigrations` with the real generated
  `components.migrations`; never fabricate component function references or cast
  the component API. Define the executable probe/real migration entrypoints as
  plain internal mutations with `componentMigrations.define`, register their
  types through `FunctionSpec.convexInternalMutation`, bind the runtime values
  through `FunctionImpl.make`, and call them through the Confect
  `MutationRunner` bridge using generated Confect refs. Raw `RegisteredMutation`
  values, empty fake contexts, `as unknown`/`as never` bridges, and duplicated
  component pagination are forbidden. Keep the future organization/Brain/page
  migration names in a separate server-owned reserved registry; they are
  non-executable until the task that supplies their real idempotent predicate
  activates each name.

  Execute mode never accepts raw function values, `reset`, `next`, a caller
  cursor, or an unbounded batch size. The server supplies `null`, never
  `undefined`, for the first component batch. Decode only the component's typed
  dry-run rollback payload as a successful rolled-back result; every other
  component failure follows the failure-persistence path without retrying the
  request in execute mode. A durable migration-run coordinator acquires an
  atomic lease/fence generation before invoking a batch, enforces
  `planned -> running -> complete | failed`, releases the lease on every
  terminal batch outcome, and permits `failed -> running` only from its last
  committed component cursor after release/deployment/schema preconditions
  match. Cursor authority and ordering use an explicit monotonic batch sequence
  plus fence generation, never timestamps or receipt insertion order.

  Receipts are append-only with one stable release-parent ID, one final release
  parent, zero or more failure checkpoints, and many child receipts per release
  migration. Each batch appends one child containing
  `{ migrationName, mode, cursor, scanned, changed, skipped, failed, complete, startedAt, finishedAt }`;
  every child binds its immutable receipt ID and the stable release-parent ID
  before insertion. A production component failure appends its failed child and
  a distinct `failure_checkpoint` that lists child hashes through that failure,
  then returns `MigrationBatchFailed`; a checkpoint is not the release parent
  and never makes the run complete. After a later resume, the single final
  `release_parent` adds
  `{ releaseCommit, schemaBefore, schemaAfter, parityChecks, rollbackOwner, observationEndsAt }`
  and lists every child hash exactly once in batch-sequence order. Hash the full
  redacted receipt with a recursive canonical serializer and SHA-256; bind the
  parent ID, batch sequence, fence generation, actor, deployment/build IDs, and
  prior/next cursor. Completed reruns return the stored terminal result without
  inserting or patching a receipt. Counts are definition-owned and truthful:
  `scanned` is the component's processed rows; `changed` counts rows whose
  idempotent predicate produced a write; `skipped` counts already-migrated rows;
  and `failed` counts failed rows. Because `@convex-dev/migrations` returns only
  `{ continueCursor, isDone, processed }` and rolls back dry-run side effects,
  `changed` and `skipped` are nullable with explicit `unavailable` provenance
  unless a migration definition supplies exact execute-mode counters. Never
  infer them from `processed`, duplicate pagination/predicate evaluation, or use
  a no-op fixture as evidence.

  Component execution and coordinator settlement are separate transactions. The
  coordinator therefore guarantees idempotent replay, not impossible
  cross-component atomicity: settlement requires an unexpired matching
  owner/fence, `priorCursor` equal to the durable committed cursor, and the next
  monotonic sequence. Inject a crash after a real component batch commits but
  before settlement, then prove replay deduplicates target effects and advances
  the cursor/receipts exactly once.

  Before dispatching a C1 contract-spine task, conditionally inspect whether an
  isolated C1 lane has already authored undeployed schema additions. If so,
  first prove there is no tenant deployment and no affected row; otherwise
  inventory the additions as expand-phase drift and add backfill/parity work
  before claiming completion.

- **Typed errors / state:** errors are `MigrationNotFound`,
  `MigrationAlreadyRunning`, `MigrationCursorInvalid`, and
  `MigrationBatchFailed`; every declared error must be reachable through the
  generated internal Confect function and tested there. Run state is
  `planned -> running -> complete | failed`; a failed run resumes from its last
  committed cursor, including `null` when no batch committed, under a new fence
  generation.
- **Migration / rollback:** this task creates the harness only. Rollback removes
  the wrapper after proving no migration rows/runs were created. Later schema
  tasks must state their own dual-read/write and rollback.
- **Focused verification:**
  `rtk pnpm brain:factory:check-confect-codegen -- --test migrations`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:generated-files`, and
  `rtk pnpm check:headless-surface-contract`. Tests reject unknown names, forged
  cursors, reset/next, invalid batch sizes, cross-release resume, concurrent
  start, destructive expand/backfill definitions, public refs, and any dry-run
  write. The failure/resume test must commit a real component cursor `C1`, fail
  the next component batch, resume from `C1` under a new fence, complete, and
  rerun byte-for-byte idempotently; fabricated cursors are forbidden. Broad
  verification belongs to tranche integration.
- **Completion receipt:** attach real-component dry-run rollback, real-cursor
  production-failure/resume, post-component/pre-settlement crash replay,
  expired/concurrent-fence rejection, idempotent rerun, deterministic
  child/checkpoint/final-parent hash aggregation, generated-diff, and generated
  no-public-ref evidence.
- **Lane branch / commit boundary:** branch `codex/brain-s00-migration-harness`;
  at most four commits, each changing no more than 300 hand-authored production
  source lines: failure-first tests; Confect/component contracts and tables;
  generated-ref execution plus lease/fence; receipt/failure integration and
  docs. Final S00 slice and release checkpoint.

---

## S01 — Real Identity, Tenancy, Stable Brain Identity, And RBAC

### S01-T01 — Wire Real AuthKit Identity Into TanStack Start And Convex

- **Outcome / requirements:** satisfy IAM-01; production can no longer run with
  the fake user or static demo JWT configuration.
- **Classification:** `template-gap`; target `TB-AUTHKIT-01`; resolve by proving
  the pinned WorkOS AuthKit package's server/client/Convex token bridge, then
  promote the generic bridge into the template.
- **Dependencies:** S00 complete.
- **Existing anchors:** the root currently injects `fakeInitialAuth` and plain
  `ConvexProvider` in
  [`__root.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/routes/__root.tsx#L45-L88);
  middleware is conditionally present but the Convex auth config is pinned to
  fake values in
  [`auth.config.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/convex/auth.config.ts#L13-L36).
- **Files:** create `apps/web/src/auth/authkit-server.ts`,
  `apps/web/src/auth/authkit-server.test.ts`,
  `apps/web/src/auth/authkit-client.tsx`, and
  `apps/web/src/auth/authkit-client.test.tsx`; modify
  `apps/web/src/routes/__root.tsx`, `apps/web/src/start.ts`,
  `apps/web/src/server-env.ts`, `packages/convex/convex/auth.config.ts`,
  `.env.example`, `docs/template/env-manifest.md`, and
  `docs/template/env-manifest.json`.
- **Failure-first tests:** unauthenticated request gets a typed signed-out
  state; authenticated request supplies the real AuthKit snapshot and a Convex
  auth token; missing/malformed issuer/JWKS/client values fail startup in live
  mode; local fake mode is explicit and cannot be selected in production; no
  browser bundle contains server secrets.
- **Implementation:** use the supported APIs from
  `@workos/authkit-tanstack-react-start@0.9.1`; obtain initial auth on the
  server, provide it to `AuthKitProvider`, and implement Convex's auth
  hook/provider with the WorkOS access token. Derive `customJwt` config from
  validated environment values, not demo constants. Keep fake auth only behind
  an explicit test-only adapter.
- **Typed contract / errors:**
  `AuthSnapshot = { status: signedOut } | { status: authenticated; subject; email; organizationId; accessToken }`;
  externally visible errors are `Unauthorized` and `AuthConfigurationInvalid`;
  never return/log tokens.
- **Migration / compatibility / rollback:** no data migration. Keep the old fake
  adapter in test fixtures only. Roll back by restoring the prior web deployment
  and auth config together; never deploy a web root expecting real tokens
  against fake Convex JWT settings.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test auth start-runtime`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test workos-auth-config`,
  `rtk pnpm check:env-boundary`, `rtk pnpm check:auth-demo-bypass`,
  `rtk pnpm check:secret-canaries`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** redacted successful/failed auth traces, environment
  name inventory, client-bundle secret scan, and test output.
- **Lane branch / commit boundary:** branch `codex/brain-s01-real-authkit`;
  commit `feat: wire real AuthKit identity`.

### S01-T02 — Add WorkOS Organization Binding And Stable Agency/Brain Keys

- **Outcome / requirements:** satisfy IAM-01, IAM-03, and FND-03; every tenant
  and Brain has a stable public identity before headless or source contracts
  exist.
- **Classification:** `template-gap`; target `TB-AUTHKIT-01` plus
  existing-module repair of organizations/workspaces; resolve through
  expand/backfill/contract migrations rather than a parallel tenant model.
- **Dependencies:** S01-T01.
- **Existing anchors:** organizations currently lack a WorkOS organization ID in
  [`tenancySchemas.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/tenancySchemas.ts#L37-L55),
  while workspaces are already organization-owned in
  [`workspaces.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/tables/workspaces.ts#L4-L18).
- **Files:** modify `packages/convex/confect/access/tenancySchemas.ts`,
  `packages/convex/confect/tables/organizations.ts`,
  `packages/convex/confect/tables/workspaces.ts`,
  `packages/convex/confect/access/provisioning.ts`, and
  `packages/convex/confect/internal/migrations.ts`; create
  `packages/convex/confect/identity/stableKeys.ts` and
  `packages/convex/test/stable-tenant-keys.test.ts`.
- **Failure-first tests:** duplicate WorkOS org binding, duplicate
  `(organizationId, agencyKey)`, duplicate `(organizationId, brainKey)`, invalid
  key syntax, cross-organization resolution, and public Convex-ID serialization
  all fail. Backfill is deterministic and idempotent for existing demo rows.
- **Implementation:** add `workosOrganizationId`, `agencyKey`, tenant lifecycle
  and revocation generation to organizations; add `brainKey`,
  `kind: agency | client`, `clientSlug?`, lifecycle and revocation generation to
  workspaces. Generate opaque sortable stable keys once; names/slugs never form
  authorization. Add compound indexes `by_workos_organization`, `by_agency_key`,
  `by_organization_brain_key`, and `by_organization_kind`.
- **Typed contract / errors:** internal resolvers accept server-derived
  organization plus stable key and return typed IDs after authorization; errors
  are `AgencyNotFound`, `BrainNotFound`, `StableKeyConflict`, and
  `TenantMismatch`.
- **Migration / compatibility / rollback:** expand optional fields/indexes;
  dual-read legacy rows; backfill in bounded batches; verify zero null/duplicate
  keys; switch writers then readers; make fields required in a later contract
  deploy. Roll back readers to legacy IDs while leaving additive keys; never
  delete generated keys.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test stable-tenant-keys access-provisioning`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:schema-migration-notes`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** migration dry-run/execute/idempotent-rerun counts,
  uniqueness query, no-public-Convex-ID scan, generated diff, and rollback
  checkpoint.
- **Lane branch / commit boundary:** branch
  `codex/brain-s01-stable-tenant-keys`; commit
  `feat: add stable agency and Brain identity`.

### S01-T03 — Authorize Workspace Listing And Brain Provisioning

- **Outcome / requirements:** satisfy IAM-01, IAM-02, IAM-03, UI-02; a signed-in
  user sees only Brains granted by current organization/workspace membership and
  authorized admins can create a client Brain.
- **Classification:** `template-gap`; target `TB-AUTHORIZED-TENANCY-01` while
  extending the already database-backed `auth/workspaces.{spec,impl}.ts`; the
  promotion path is a generic server-derived workspace-list/provision pattern.
- **Dependencies:** S01-T02.
- **Existing anchors:** the current public query collects every workspace
  without auth in
  [`workspaces.impl.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/auth/workspaces.impl.ts#L8-L16),
  while the canonical effective-role resolver already exists in
  [`access/auth.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/auth.ts#L118-L249).
- **Files:** modify `packages/convex/confect/auth/workspaces.spec.ts`,
  `packages/convex/confect/auth/workspaces.impl.ts`,
  `packages/convex/confect/access/provisioning.spec.ts`,
  `packages/convex/confect/access/provisioning.impl.ts`,
  `packages/convex/confect/access/provisioning.ts`,
  `apps/web/src/providers/workspace-operations.ts`, and
  `apps/web/src/providers/workspace-operations.test.ts`; create
  `packages/convex/test/authorized-brain-provisioning.test.ts`.
- **Failure-first tests:** signed-out list/create, suspended user/org, unrelated
  org, viewer/editor client creation, duplicate client slug/key, caller-supplied
  org/workspace ID, and archived Brain all fail with typed errors. Org admin
  sees its authorized Brains; direct client member sees only granted Brains.
- **Implementation:** make list args empty and derive identity server-side;
  return stable summaries
  `{ agencyKey, brainKey, name, kind, clientSlug, effectiveRole, status, freshness }`.
  Add admin-only `createClientBrain({ name, clientSlug })`, create
  membership/audit rows atomically, and ensure exactly one Agency Brain per
  organization. Replace fake web operations with generated refs; preserve the
  workspace controller interface.
- **Typed errors / state:** `Unauthorized`, `Forbidden`, `OrganizationNotFound`,
  `BrainNotFound`, `BrainAlreadyExists`, `ProvisioningConflict`; Brain state is
  `provisioning -> active`, `active <-> archived`, and
  `active | archived -> deleting -> deleted`; only active rows list by default.
- **Migration / compatibility / rollback:** dual-return legacy `workspaceId`
  internally only until all web adapters consume `brainKey`; public contract
  never exposes it. Roll back the web adapter and public spec together; creation
  remains additive and audit-preserving.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test authorized-brain-provisioning workspace-access`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test workspace-operations workspace`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:access-audit-events`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** table-driven role results, cross-tenant denials,
  generated-ref diff, stable response sample, and audit event sample with no
  customer text.
- **Lane branch / commit boundary:** branch
  `codex/brain-s01-authorized-provisioning`; commit
  `feat: authorize Brain provisioning`.

### S01-T04 — Apply Existing RBAC To Members, Settings, And Privileged Actions

- **Outcome / requirements:** satisfy IAM-04 and establish the role/capability
  matrix every later task must reuse.
- **Classification:** `template-gap`; target `TB-ACCESS-UI-01` while extending
  real `access/members`/`access/invitations`; promote the generated-ref member
  management and settings composition after its role matrix is proven.
- **Dependencies:** S01-T03.
- **Existing anchors:** member and invitation mutations already exist under
  `packages/convex/confect/access/`; the Settings surface still renders
  placeholder copy in
  [`settings-surface.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/features/settings/settings-surface.ts#L34-L52).
- **Files:** modify `packages/convex/confect/access/tenancySchemas.ts`,
  `packages/convex/confect/access/audit.ts`,
  `packages/convex/confect/access/members.spec.ts`,
  `packages/convex/confect/access/members.impl.ts`,
  `packages/convex/confect/access/invitations.spec.ts`,
  `packages/convex/confect/access/invitations.impl.ts`,
  `apps/web/src/features/settings/settings-surface.ts`,
  `apps/web/src/features/settings/settings-surface.test.ts`, and
  `apps/web/src/routes/_workspace.settings.tsx`; create
  `apps/web/src/features/settings/member-management-adapter.ts`,
  `apps/web/src/features/settings/member-management-adapter.test.ts`,
  `apps/web/src/features/settings/member-management.tsx`,
  `apps/web/src/features/settings/member-management.test.tsx`, and
  `packages/convex/test/brain-role-matrix.test.ts`.
- **Failure-first tests:** exercise every operation in Appendix B for all four
  roles, direct workspace membership, organization-admin baseline, revoked
  membership, last-owner removal, and cross-Brain access. Denials must occur
  before provider/model/storage calls and emit redacted audit metadata for
  privileged attempts.
- **Implementation:** render member/invite management from generated refs;
  preserve role ordering and last-owner rules; add named audit actions for Slack
  connection/policy, retention, model egress, Autopilot, export, and API key
  administration so later capabilities reuse one vocabulary. UI hiding is only
  convenience.
- **Typed errors / state:** reuse `Unauthorized`, `Forbidden`,
  `MemberNotInWorkspace`, `CannotRemoveLastOwner`, `Invitation*`; membership
  remains `pending -> active -> revoked`, invitations retain their existing
  terminal states.
- **Migration / compatibility / rollback:** additive audit-action enum/schema
  migration; no membership rewrite. Rollback may hide the UI but must not remove
  audit events or weaken server checks.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test access brain-role-matrix`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test settings`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:access-audit-events`, `rtk pnpm check:layer-boundaries`, and
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** complete matrix output, last-owner/cross-tenant
  denials, audit vocabulary diff, UI state screenshots, and generated refs.
- **Lane branch / commit boundary:** branch `codex/brain-s01-rbac-settings`;
  commit `feat: apply Brain RBAC to settings`; final S01 checkpoint.

---

## S02 — Brain Page, Revision, Citation, And Editor Contracts

### S02-T01 — Expand Brain Pages To Stable Tree Identity

- **Outcome / requirements:** satisfy IAM-03 and KNW-01 with a stable,
  tenant-namespaced page tree and current-revision pointer.
- **Classification:** `template-gap`; target `TB-AUTHORIZED-KNOWLEDGE-01` plus
  existing-module repair. The documented Brain-schema generator is not a
  runnable package script, so do not claim generator coverage.
- **Dependencies:** S01 complete.
- **Existing anchors:** `brainPages` currently stores only workspace, slug,
  title, Markdown, editor snapshot, source kind, and time in
  [`brainPages.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/tables/brainPages.ts#L5-L18);
  production Maestro demonstrates stable keys and parent/export identity in
  [`brainPages.ts`](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/packages/convex/convex/schema/brainPages.ts#L22-L83).
- **Files:** modify `packages/convex/confect/tables/brainPages.ts`,
  `packages/convex/confect/internal/migrations.ts`, and
  `docs/product/maestro-brain-lifecycle-adoption/S02-T01.md`; create
  `packages/convex/confect/tables/pageRevisions.ts`,
  `packages/convex/confect/brain/pageSchemas.ts`, and
  `packages/convex/test/brain-page-schema.test.ts`.
- **Failure-first tests:** reject duplicate `(workspaceId,pageKey)`, duplicate
  active sibling slug, parent in another Brain, cycles, invalid sort key,
  current revision from another page, and public Convex IDs.
- **Implementation:** add `organizationId`, `pageKey`, `parentPageKey`,
  `siblingSlug`, `sortKey`, `favorite`, `status`, `currentRevisionKey`, and
  lifecycle envelope. Add immutable page revisions with BlockNote JSON, Markdown
  projection, prior revision, content hash, causation, actor/model receipt,
  publish state, and lifecycle. Add compound indexes from Appendix C.
- **Typed errors / state:** `PageNotFound`, `ParentPageNotFound`,
  `PageTreeConflict`, `PageCycle`, `RevisionNotFound`, `TenantMismatch`; page is
  `active <-> archived`, then `active | archived -> redacted -> purged`.
  Revision transitions are `draft -> proposed` and
  `proposed -> published | rejected`; any non-purged revision may transition to
  `redacted`, and `redacted -> purged`.
- **Migration / compatibility / rollback:** expand optional fields; backfill
  deterministic keys/root parents/revision seeds from current Markdown; verify
  hashes and sibling uniqueness; dual-write old snapshot fields through S02;
  contract later. Rollback reads legacy Markdown and leaves revisions dormant.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-page-schema`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:confect-contracts`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** migration counts/hash comparison, index inventory,
  cycle/cross-tenant denials, generated diff, rollback marker.
- **Lane branch / commit boundary:** branch `codex/brain-s02-page-tree-schema`;
  commit `feat: add stable Brain page tree`.

### S02-T02 — Complete Authorized Page Tree CRUD

- **Outcome / requirements:** satisfy IAM-04, KNW-01, UI-03; viewers read while
  editors create/rename/move/favorite/archive and all authority is
  server-derived.
- **Classification:** `template-gap`; target `TB-AUTHORIZED-KNOWLEDGE-01` while
  extending the existing database-backed `brain/pages` module, not replacing it.
- **Dependencies:** S02-T01.
- **Existing anchors:** current specs take caller Convex IDs and expose
  `createMarkdown` to MCP in
  [`pages.spec.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/brain/pages.spec.ts#L26-L99),
  while the impl already calls `requireWorkspaceAccess` in
  [`pages.impl.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/brain/pages.impl.ts#L18-L63).
- **Files:** modify `packages/convex/confect/brain/pages.spec.ts` and
  `packages/convex/confect/brain/pages.impl.ts`; create
  `packages/convex/confect/brain/pageTree.ts` and
  `packages/convex/test/brain-pages-crud.test.ts`. Generated Confect/Convex
  output is integration-owned and enumerated by the named dry-run manifest; the
  isolated lane never commits that output:
  `docs/superpowers/receipts/maestro-brain/file-inventories/S02-T02-confect-generated-files.json`.
- **Failure-first tests:** role table for list/get/create/rename/move/favorite/
  archive; caller tenant/Convex fields rejected; concurrent move conflict;
  cycle/cross-Brain parent; archived Brain; stale expected revision; and MCP
  write exposure all fail.
- **Implementation:** public web functions accept stable page keys and derive
  the active workspace from the authenticated web principal. Return stable
  `PageSummary`/`PageDetail`. Use an internal mutation for editor snapshot
  commits. Remove external write exposure; reserve headless read exposure for
  S11. Every mutation writes a page revision/audit event atomically and takes an
  `expectedCurrentRevisionKey`.
- **Typed contract / errors:** args/returns are detailed in Appendix F; errors
  include `Unauthorized`, `Forbidden`, `BrainNotFound`, `PageNotFound`,
  `PageTreeConflict`, `StaleRevision`, and `LifecycleRevoked`.
- **Migration / compatibility / rollback:** keep a web adapter compatibility
  layer for current route code until S03; no public legacy ID args. Rollback the
  UI/spec as one deployment while keeping appended revisions.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-pages`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:confect-contracts`,
  `rtk pnpm check:headless-surface-contract`, broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** role matrix, stale/cycle/cross-tenant denials,
  manifest diff proving no write MCP tool, and revision/audit samples.
- **Lane branch / commit boundary:** branch `codex/brain-s02-page-crud`; commit
  `feat: complete authorized page CRUD`.

### S02-T03 — Replace Versioning/Knowledge Fixtures With Authorized Revisions And Citations

- **Outcome / requirements:** satisfy KNW-01, UI-04, ZFC-01; every human/model
  save is immutable, cited where factual, inspectable, and restorable.
- **Classification:** `fixture-to-real` for `ops/versioning` and
  `ops/knowledge`, but deliberately migrate their specs/tables together; real
  boundary is authorized page/source repositories, not a body-only swap.
- **Dependencies:** S02-T02 and the source-revision stable-key contract reserved
  by S00; tests use fixtures until S05 creates live sources.
- **Existing anchors:** versioning is a fixed-time fixture in
  [`versioning.impl.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/ops/versioning.impl.ts#L36-L160),
  and current citations point to generic source IDs in
  [`citations.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/tables/citations.ts#L4-L20).
- **Files:** modify `packages/convex/confect/ops/versioning.spec.ts`,
  `packages/convex/confect/ops/versioning.impl.ts`,
  `packages/convex/confect/ops/knowledge.spec.ts`,
  `packages/convex/confect/ops/knowledge.impl.ts`,
  `packages/convex/confect/tables/citations.ts`,
  `packages/convex/confect/tables/versionedEntries.ts`, and
  `packages/convex/confect/internal/migrations.ts`; create
  `packages/convex/confect/brain/revisions.ts`,
  `packages/convex/confect/brain/citations.ts`, and
  `packages/convex/test/brain-revisions.test.ts`.
- **Failure-first tests:** restore deletes history, citation points outside the
  supplied candidate set/Brain, quote/range/hash mismatch, uncited factual
  Autopilot publish, stale current revision, duplicate effect key, and
  caller-supplied workspace all fail. Restore must append a new revision.
- **Implementation:** change public reads to stable keys/current principal and
  make writes internal or web-authorized. Store exact `sourceRevisionKey`,
  quote, offsets/block locator, quote hash, redaction state, causation, and
  model receipt. Commit page revision/citations/current pointer by one
  transaction and one unique effect key. Preserve generic concepts/claims only
  if still used by another template feature; do not overload them for Brain
  pages.
- **Typed errors / state:** `CitationRequired`, `CitationNotInManifest`,
  `CitationMismatch`, `StaleRevision`, `DuplicateEffect`, `LifecycleRevoked`,
  plus auth/not-found errors. Restore causation is `restore`; it never mutates
  the restored row.
- **Migration / compatibility / rollback:** backfill seed page revisions and
  translate existing citations only when exact provenance exists; mark others
  `legacy_unresolved` and never use them for Autopilot. Dual-read through S03;
  rollback current pointer reads without deleting appended rows.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-revisions versioning knowledge`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:schema-migration-notes`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** fixture-to-real checklist, migration counts, exact
  citation resolution, restore history, effect-key idempotency, and
  authorization denials.
- **Lane branch / commit boundary:** branch
  `codex/brain-s02-revisions-citations`; commit
  `feat: persist authorized Brain revisions`.

### S02-T04 — Bind Realtime Editor Sync To Stable Pages And Revision Fences

- **Outcome / requirements:** satisfy UI-03, IAM-04, KNW-01; BlockNote sync is
  readable by viewers, writable by editors, and cannot publish a stale or
  cross-Brain snapshot.
- **Classification:** `template-gap`; target `TB-AUTHORIZED-KNOWLEDGE-01`;
  integrate the existing ProseMirror substrate with stable-key resolution and
  revision fences, then promote that generic bridge.
- **Dependencies:** S02-T03.
- **Existing anchors:** the reusable editor takes `documentId` and `editable` in
  [`BlockNoteSyncEditor.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/editor-react/src/BlockNoteSyncEditor.tsx#L20-L69),
  and current server access resolves a raw page ID then effective role in
  [`editor/sync.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/editor/sync.ts#L24-L63).
- **Files:** modify `packages/convex/confect/editor/documentTargets.ts`,
  `packages/convex/confect/editor/sync.ts`,
  `packages/convex/confect/editor/syncApi.ts`,
  `packages/convex/confect/brain/pages.spec.ts`,
  `packages/convex/confect/brain/pages.impl.ts`, and
  `packages/convex/test/editor-sync.test.ts`; create
  `packages/convex/test/brain-editor-revision-fence.test.ts`.
- **Failure-first tests:** forged stable key, cross-Brain key collision, viewer
  write, revoked membership, archived/redacted page, stale expected revision,
  concurrent editor snapshot, and restore race all fail before persistence.
- **Implementation:** make editor document IDs opaque stable page targets;
  resolve internally after current auth; keep ProseMirror component APIs using
  internal IDs only after resolution. Snapshot commit appends a page revision,
  checks expected current revision/lifecycle generation, and updates the pointer
  atomically. Do not expose source/model operations to the editor client.
- **Typed errors / state:** map sync denial to redacted `EditorAccessDenied`;
  commit returns `{ pageKey, pageRevisionKey, contentHash, savedAt }` or
  `StaleRevision | LifecycleRevoked`.
- **Migration / compatibility / rollback:** support legacy document IDs only in
  a bounded migration adapter disabled after S03; rollback can re-enable it but
  cannot bypass current role checks.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test editor brain-editor-revision-fence`,
  `rtk host-test-slot --class focused pnpm --dir packages/editor-react test`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:layer-boundaries`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** viewer/editor/revocation/concurrency results,
  stable-to-internal resolution trace with redacted IDs, and appended revision
  proof.
- **Lane branch / commit boundary:** branch `codex/brain-s02-editor-fences`;
  commit `feat: fence Brain editor revisions`; final S02 checkpoint.

---

## S03 — Clients UI, Brain Shell, BlockNote, History, And Client Brief

### S03-T01 — Replace Generic Navigation With The V1 Product Shell

- **Outcome / requirements:** satisfy UI-01 without building a second shell.
- **Classification:** `template-gap`; target `TB-BRAIN-UI-01`; resolution ports
  only generic Brain behavior into existing SaaS UI/Chakra primitives.
- **Dependencies:** S02 complete.
- **Existing anchors:** customer navigation currently exposes many reference
  routes in
  [`workspace.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/navigation/workspace.ts#L37-L179),
  and the Brain route delegates to a generic card surface in
  [`business-shell.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/saas-ui/business-shell.tsx#L501-L587).
- **Files:** modify `apps/web/src/navigation/workspace.ts`,
  `apps/web/src/navigation/workspace.test.ts`,
  `apps/web/src/saas-ui/business-shell.tsx`, and
  `apps/web/src/platform-routes.test.ts`; create
  `apps/web/src/routes/_workspace.clients.tsx`,
  `apps/web/src/routes/_workspace.connections.tsx`,
  `apps/web/src/features/clients/clients-screen.tsx`,
  `apps/web/src/features/clients/clients-screen.test.tsx`,
  `apps/web/src/features/connections/connections-screen.tsx`, and
  `apps/web/src/features/connections/connections-screen.test.tsx`. Generated
  route-tree changes remain codegen-owned.
- **Failure-first tests:** route/navigation manifest must contain only Clients,
  Agency Brain, Connections, Settings, and global Ask/Search; hidden reference
  URLs cannot appear in product nav; loading/empty/typed/transport/ready states
  render; mobile nav is keyboard accessible.
- **Implementation:** reuse `BusinessAppShell`, Page, Sidebar, DataGrid, Drawer,
  and Chakra responsive primitives. Keep reference routes available only behind
  a non-production developer flag if tests/docs still need them. Add no
  analytics, workflow, campaign, content, or connector marketplace UI.
- **Typed contract / state:** screen state is
  `loading | empty | ready | typed_failure | transport_failure`; routes consume
  feature adapters only.
- **Migration / compatibility / rollback:** no data migration. Rollback the nav
  manifest and route components together; do not delete underlying template
  primitives.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test navigation clients connections`,
  `rtk pnpm check:route-tree`, `rtk pnpm check:frontend-effect-boundary`,
  `rtk pnpm check:layer-boundaries`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** desktop/mobile/keyboard screenshots, route manifest
  output, hidden-reference-route assertion, and layer gate.
- **Lane branch / commit boundary:** branch `codex/brain-s03-product-shell`;
  commit `feat: simplify the Brain product shell`.

### S03-T02 — Build Clients List, Creation, And Standard Client Brief

- **Outcome / requirements:** satisfy UI-02; an admin creates a Client Brain and
  lands in the six-page editable Client Brief.
- **Classification:** `template-gap`; target `TB-BRAIN-UI-01`; the current
  `template:add-client-domain` emits only JSON/README, so no false generator
  claim.
- **Dependencies:** S03-T01.
- **Existing anchors:** the generator limitation is visible in
  [`buildClientDomainFiles`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/generators/src/index.ts#L1086-L1140);
  authorized provisioning comes from S01-T03.
- **Files:** create `apps/web/src/features/clients/clients-adapter.ts`,
  `apps/web/src/features/clients/clients-adapter.test.ts`,
  `apps/web/src/features/clients/clients-state.ts`,
  `apps/web/src/features/clients/clients-state.test.ts`,
  `apps/web/src/features/clients/clients-table.tsx`,
  `apps/web/src/features/clients/clients-table.test.tsx`,
  `apps/web/src/features/clients/create-client-dialog.tsx`,
  `apps/web/src/features/clients/create-client-dialog.test.tsx`, and
  `packages/convex/confect/brain/clientBrief.ts`; modify the Clients route
  `apps/web/src/routes/_workspace.clients.tsx`,
  `packages/convex/confect/access/provisioning.impl.ts`, and
  `packages/convex/test/authorized-brain-provisioning.test.ts`.
- **Failure-first tests:** viewer/editor creation denial, duplicate slug,
  partial six-page creation rollback, retry idempotency, archived client,
  empty/list states, and route-to-new-Brain behavior. Six pages are ordinary
  renameable pages, not schema enums.
- **Implementation:** one idempotent `createClientBrain` transaction creates
  Brain, admin membership, Overview, Stakeholders, Decisions, Commitments and
  next steps, Risks and open questions, and Proof and assets with stable page
  keys/order. Return stable keys. Render freshness, connection health, recent
  changes, and explicit capacity-envelope counts.
- **Typed errors / state:** `ClientBrainAlreadyExists`, `CapacityExceeded`,
  `ProvisioningConflict`, auth errors; onboarding is
  `creating -> seeding -> ready | failed` with same idempotency key resuming
  safely.
- **Migration / compatibility / rollback:** no existing clients are reseeded. A
  separate admin action may seed missing pages after preview. Rollback hides
  creation but retains created Brains/pages/audit history.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test client-brief`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test clients`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:route-tree`, and broad
  verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** role/idempotency/capacity tests, six-page stable tree
  sample, UI states, and atomic-failure proof.
- **Lane branch / commit boundary:** branch `codex/brain-s03-client-brief`;
  commit `feat: create client Brains with a Brief`.

### S03-T03 — Build The Responsive Page Tree And BlockNote Workspace

- **Outcome / requirements:** satisfy UI-03 and IAM-04 with the specified
  three-region desktop layout and drawer-based mobile layout.
- **Classification:** `template-gap`; target `TB-BRAIN-UI-01`, importing
  behavior but not shell/CSS from production Maestro.
- **Dependencies:** S03-T02.
- **Existing anchors:** production behavioral prior art is the
  [`workspace composition`](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/apps/web/src/features/brain/brain-workspace-content.tsx#L108-L155)
  and
  [`page tree`](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/apps/web/src/features/brain/brain-page-tree.tsx#L57-L118);
  the fork already has the reusable
  [`BlockNoteSyncEditor`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/editor-react/src/BlockNoteSyncEditor.tsx#L20-L69).
- **Files:** replace `apps/web/src/features/brain/brain-surface.ts` and
  `apps/web/src/features/brain/brain-surface.test.ts` with state/view-model
  modules; create `apps/web/src/features/brain/brain-adapter.ts`,
  `apps/web/src/features/brain/brain-adapter.test.ts`,
  `apps/web/src/features/brain/brain-workspace.tsx`,
  `apps/web/src/features/brain/brain-workspace.test.tsx`,
  `apps/web/src/features/brain/brain-page-tree.tsx`,
  `apps/web/src/features/brain/brain-page-tree.test.tsx`,
  `apps/web/src/features/brain/brain-editor-pane.tsx`,
  `apps/web/src/features/brain/brain-editor-pane.test.tsx`,
  `apps/web/src/features/brain/brain-evidence-drawer.tsx`, and
  `apps/web/src/features/brain/brain-evidence-drawer.test.tsx`; modify
  `apps/web/src/routes/_workspace.brain.tsx` and
  `apps/web/src/saas-ui/business-shell.tsx`.
- **Failure-first tests:** loading/empty/not-found/typed/transport states;
  viewer read-only; editor save; tree create/rename/move/archive/favorite;
  mobile drawers; keyboard tree navigation; unsaved/conflict state; cross-Brain
  URL key fails without leaking existence.
- **Implementation:** left client/page tree, center title/freshness/BlockNote,
  right contextual evidence/history drawer, top Ask trigger placeholder. Use
  generated refs only in the adapter. Mount the S02 stable editor target and
  display optimistic-concurrency conflicts rather than overwriting.
- **Typed contract / state:** `BrainWorkspaceState` is
  `loading | empty | ready | not_found | forbidden | stale_revision | transport_failure`;
  mutations return the typed S02 page contract.
- **Migration / compatibility / rollback:** no data migration. Keep the old
  generic Brain fixture only in isolated story/test data; rollback the route to
  a read-only maintenance screen without changing backend data.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test brain`,
  `rtk host-test-slot --class focused pnpm --dir packages/editor-react test`,
  `rtk pnpm check:route-tree`, `rtk pnpm check:layer-boundaries`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test brain accessibility`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** role/state screenshots at desktop/mobile, keyboard and
  screen-reader output, stale-edit proof, route denial, and layer imports.
- **Lane branch / commit boundary:** branch `codex/brain-s03-notion-workspace`;
  commit `feat: build the Client Brain workspace`.

### S03-T04 — Add History, Diff, Citations, Restore, And Review Queue Shells

- **Outcome / requirements:** satisfy UI-04, KNW-01, AI-03 UI prerequisites;
  every revision is inspectable and restoration appends history.
- **Classification:** `template-gap`; target `TB-BRAIN-UI-01`; build the
  reusable revision/review UI on S02 contracts and promote it after the product
  instance passes accessibility and role gates.
- **Dependencies:** S03-T03.
- **Existing anchors:** current template versioning vocabulary and table exist
  in
  [`versioning.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/template-core/src/versioning.ts#L1-L36)
  and
  [`versionedEntries.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/tables/versionedEntries.ts#L4-L35).
- **Files:** create `apps/web/src/features/brain/revision-history.tsx`,
  `apps/web/src/features/brain/revision-diff.tsx`,
  `apps/web/src/features/brain/citation-list.tsx`,
  `apps/web/src/features/brain/restore-dialog.tsx`,
  `apps/web/src/features/brain/review-queue.tsx`,
  `apps/web/src/features/brain/revision-history.test.tsx`,
  `apps/web/src/features/brain/revision-diff.test.tsx`,
  `apps/web/src/features/brain/citation-list.test.tsx`,
  `apps/web/src/features/brain/restore-dialog.test.tsx`, and
  `apps/web/src/features/brain/review-queue.test.tsx`; modify
  `apps/web/src/features/brain/brain-evidence-drawer.tsx` and
  `apps/web/src/features/brain/brain-adapter.ts`.
- **Failure-first tests:** viewer cannot restore/review; editor restores;
  redacted citation shows marker not text; unresolved legacy citation cannot
  authorize publication; stale restore fails; diff escapes untrusted HTML; queue
  exposes age/status/no-route without customer text in telemetry.
- **Implementation:** show causation/actor/time/model receipt metadata, safe
  BlockNote/Markdown diff, exact citation locator/permalink/freshness, and
  restore confirmation. Add the empty Brain-maintenance review queue shell now
  and wire it from S08-T04. S08-T03 owns the separate Connections-scoped
  classification queue. Do not infer semantic change type locally.
- **Typed contract / state:** revision display is
  `published | proposed | rejected | redacted`; citation resolution is
  `resolved | redacted | legacy_unresolved`; restore returns a new revision key.
- **Migration / compatibility / rollback:** no schema migration. Rollback hides
  drawers/dialogs but preserves all history. Never delete a bad revision as UI
  rollback.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test brain revision citation review`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test accessibility`,
  `rtk pnpm check:layer-boundaries`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** revision/restore/redaction/viewer-denial screenshots,
  XSS fixture result, and empty/ready queue states.
- **Lane branch / commit boundary:** branch `codex/brain-s03-history-review-ui`;
  commit `feat: add Brain history and review UI`; final S03 checkpoint.

---

## S04 — Nango, Slack Connection Security, Channels, And Policy Control Plane

### S04-T01 — Add The Nango Provider Boundary And Admin Connect Session

- **Outcome / requirements:** satisfy SLK-01 and IAM-04 without storing Slack
  credentials or building OAuth infrastructure.
- **Classification:** `template-gap`; target `TB-NANGO-SLACK-01`; resolution
  adds a generic Nango Effect service and a product-specific Slack connection
  capability.
- **Dependencies:** S01 and S03 complete.
- **Existing anchors:** Nango's pinned Slack guide documents authorization,
  proxy access, syncs, and actions in
  [`slack.mdx`](https://github.com/NangoHQ/nango/blob/0bef47367085384c037a0ccca83c7d5bfc696d7f/docs/api-integrations/slack.mdx#L7-L87);
  provider SDK imports must remain behind the template's Effect adapter
  boundary.
- **Files:** modify `packages/integrations/package.json`,
  `packages/convex/package.json`, `pnpm-lock.yaml`, `.env.example`,
  `docs/template/env-manifest.md`, and `docs/template/env-manifest.json`; create
  `packages/integrations/src/nango/client.ts`,
  `packages/integrations/src/nango/connectBrowser.ts`,
  `packages/integrations/src/nango/slack.ts`,
  `packages/integrations/src/nango/client.test.ts`,
  `packages/integrations/src/nango/connectBrowser.test.ts`,
  `packages/convex/confect/integrations/slackConnections.spec.ts`,
  `packages/convex/confect/integrations/slackConnections.impl.ts`,
  `packages/convex/test/slack-connections.test.ts`, and
  `apps/web/src/features/connections/nango-connect-button.tsx` and
  `apps/web/src/features/connections/nango-connect-button.test.tsx`.
- **Failure-first tests:** signed-out/non-org-admin connect, raw token input,
  forged/expired Connect session, second active Slack connection, provider
  timeout, and connection ID from another organization all fail. Tests assert no
  token/session value enters logs or durable rows.
- **Implementation:** pin `@nangohq/node@0.71.0` and `@nangohq/frontend@0.71.0`
  inside `packages/integrations`; web imports only the narrow `connectBrowser`
  adapter, never a provider SDK. An authenticated org-admin capability creates a
  short-lived Nango Connect session and returns only its client token/expiry.
  The browser opens Nango Connect. The authenticated callback persists the
  returned `connectionId` through the backend; no Slack access/refresh token
  crosses Maestro code.
- **Typed contract / errors:**
  `beginSlackConnect({}) -> { connectSessionToken, expiresAt }`;
  `completeSlackConnect({ connectionId, connectSessionId }) -> { connectionKey, status }`;
  errors are `Unauthorized`, `Forbidden`, `ConnectionAlreadyExists`,
  `ConnectSessionInvalid`, `ProviderUnavailable`, and `TenantMismatch`.
- **State:** `not_connected -> authorizing -> verifying -> active | error`;
  reauthorization is `active -> reauthorizing -> active | error`, preserves
  `connectionKey`, and increments `connectionGeneration` only after successful
  bot/team verification.
- **Migration / compatibility / rollback:** no legacy Slack data. Feature-flag
  Connect UI off until webhook security in T03 is green. Rollback disables new
  sessions and marks the connection unavailable without deleting Nango's
  connection or captured data.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/integrations test nango`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-connections`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test nango-connect`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:provider-boundary`, `rtk pnpm check:env-boundary`,
  `rtk pnpm check:secret-canaries`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** package versions, fake/live adapter tests, role
  denials, redacted Nango sandbox connection result, and log canary result.
- **Lane branch / commit boundary:** branch `codex/brain-s04-nango-connect`;
  commit `feat: add Nango Slack connection`.

### S04-T02 — Persist Exact Connection, Bot Identity, And Channel Directory State

- **Outcome / requirements:** satisfy SLK-01 and SLK-02; bind one verified Slack
  team/app/bot to one agency and discover all accessible channels without
  auto-joining them.
- **Classification:** `template-gap`; target `TB-NANGO-SLACK-01`; product
  instance of a provider connection/directory pattern.
- **Dependencies:** S04-T01.
- **Existing anchors:** Nango's channel model exposes `is_member` and Slack
  Connect flags in
  [`channels.ts`](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/channels.ts#L6-L24),
  but its optional auto-join behavior must remain disabled
  ([source](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/channels.ts#L147-L163)).
- **Files:** create `packages/convex/confect/tables/providerConnections.ts`,
  `packages/convex/confect/tables/sourceChannels.ts`,
  `packages/convex/confect/tables/channelSyncStates.ts`,
  `packages/convex/confect/integrations/slackDirectory.spec.ts`,
  `packages/convex/confect/integrations/slackDirectory.impl.ts`,
  `packages/convex/confect/integrations/slackDirectory.ts`, and
  `packages/convex/test/slack-directory.test.ts`; modify
  `packages/convex/confect/internal/migrations.ts` and
  `docs/product/maestro-brain-lifecycle-adoption/S04-T02.md`.
- **Failure-first tests:** duplicate active connection/team/app binding,
  `is_member` derived from installer user token, auto-join invocation, channel
  from a stale connection generation, team mismatch, channel rename creating a
  new key, same-connection reauthorization losing cursors, replacement retaining
  old jobs/bindings, and Slack Connect flag loss all fail.
- **Implementation:** after connect, call Slack `auth.test` through Nango's bot
  credential and persist `teamId`, `apiAppId`, `botUserId`. Reconcile the full
  paginated channel directory in bounded pages. Persist stable `connectionKey`
  and `channelKey`; external channel ID is unique inside connection generation.
  Update names/flags in place; exact bot membership controls capture
  eligibility. Same-connection reauthorization preserves channel keys/cursors
  and increments credentials generation. Replacement, team/app change,
  disconnect, or uninstall revokes the old generation, pauses lanes, and records
  a typed replacement audit. S07 consumes that generation/audit to propagate to
  routes/jobs and assigns exact S09/S10 projection/outbox/binding adoption to
  their owning tasks. Never call `conversations.join`.
- **Typed contract / errors:** internal
  `reconcileChannels({ connectionKey, expectedGeneration, cursor, limit }) -> { upserted, accessGained, accessLost, nextCursor }`;
  errors `ConnectionNotFound`, `ConnectionGenerationMismatch`,
  `BotIdentityMismatch`, `ProviderRateLimited`, `ProviderUnavailable`.
- **State:** connection verification is `verifying -> active | error`, and
  `active | error -> revoked`. Channel membership is
  `discovered_not_joined -> joined_needs_policy -> joined_active`, then
  `joined_active -> access_lost | archived`;
  `access_lost -> joined_needs_policy` is permitted only under a new access
  generation. Routing state is added in T04, independent from directory state.
- **Migration / compatibility / rollback:** additive tables. A failed initial
  reconciliation keeps connection `error` and Connect disabled for ingestion;
  rollback stops reconciliation and retains rows as inactive diagnostics.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-directory`,
  `rtk host-test-slot --class focused pnpm --dir packages/integrations test slack`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:provider-boundary`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** multi-page fixture counts, exact bot identity receipt,
  rename/re-add behavior, no-auto-join call assertion, and index inventory.
- **Lane branch / commit boundary:** branch `codex/brain-s04-slack-directory`;
  commit `feat: persist Slack channel directory`.

### S04-T03 — Pin Slack Manifest And Verify Every Webhook Before Tenant Resolution

- **Outcome / requirements:** satisfy SLK-04 and AI-04; no unsigned, replayed,
  oversized, unmatched, stale-generation, or wrong-app event reaches tenant
  data.
- **Classification:** `template-gap`; target `TB-NANGO-SLACK-01`; resolution
  establishes a reusable native signed-provider-event envelope while Nango
  remains the OAuth/token/API/action boundary.
- **Dependencies:** S04-T02.
- **Existing anchors:** Nango's pinned Slack webhook guide warns that unmatched
  raw events may bypass its wrapper in
  [`webhooks.mdx`](https://github.com/NangoHQ/nango/blob/0bef47367085384c037a0ccca83c7d5bfc696d7f/docs/api-integrations/slack/webhooks.mdx#L45-L99),
  so forwarding is not the V1 trust boundary.
- **Files:** create
  `packages/integrations/config/slack/maestro-brain-manifest.json`,
  `packages/integrations/src/slack/eventsVerifier.ts` and
  `packages/integrations/src/slack/eventsVerifier.test.ts`,
  `packages/convex/confect/slack/webhook.spec.ts`,
  `packages/convex/confect/slack/webhook.impl.ts`,
  `packages/convex/confect/slack/webhookSecurity.ts`,
  `packages/convex/confect/slack/webhook.ts`, and
  `packages/convex/test/slack-webhook-security.test.ts`; modify
  `packages/convex/confect/http.ts`, `.env.example`,
  `docs/template/env-manifest.md`, `docs/template/env-manifest.json`,
  `tooling/quality/check-provider-boundary.mts`, and
  `tooling/quality/check-logging-boundary.mts`. Generated Confect/Convex output
  is integration-owned and enumerated by the named dry-run manifest; the
  isolated lane never commits that output:
  `docs/superpowers/receipts/maestro-brain/file-inventories/S04-T03-confect-generated-files.json`.
- **Failure-first tests:** invalid Slack signature secret, current/previous
  signature rotation boundaries, stale/future timestamp, duplicate request
  ID/event ID, oversized body, malformed JSON, raw unmatched Slack payload,
  inactive connection, generation/team/app/bot mismatch, and revoked connection.
  Invalid signature, timestamp, size, malformed-body, and unmatched-connection
  denials emit only redacted pre-tenant security telemetry; they create no
  Convex tenant row and do not invoke the capture transaction.
- **Implementation:** use one narrow Maestro-owned Slack Events receiver. Verify
  Slack's native signature over the exact raw bytes and timestamp before JSON
  decode, handle URL verification without tenant writes, and normalize only
  after verification. After native signature verification, decode the minimum
  binding fields, resolve exactly one active organization/connection generation,
  and only then create the tenant-scoped provider-event receipt. Unknown or
  unmatched connections emit non-tenant security telemetry and make zero tenant
  writes. Nango continues to own OAuth/tokens/API proxy/history/send actions.
  Bind `providerConfigKey + connectionId + generation + teamId + apiAppId` to
  exactly one active org before capture.
- **Manifest:** request only scopes/events in Appendix E; auto-join scopes and
  `users:read.email` are absent. The checked-in manifest is the deployment
  source of truth and its hash is recorded after Slack/Nango configuration.
- **Typed errors / state:** `WebhookUnverified`, `WebhookExpired`,
  `WebhookReplay`, `PayloadTooLarge`, `ConnectionUnmatched`,
  `ConnectionGenerationMismatch`, `TeamAppMismatch`; tenant receipt outcome is
  `rejected_after_binding | accepted_duplicate | accepted`. Pre-verification and
  unmatched-connection failures are telemetry, not receipt states.
- **Migration / compatibility / rollback:** add current/previous webhook secret
  names, never values. Rotate by deploy-current-as-previous, add-new-current,
  verify, then remove old. Rollback disables the native receiver and capture;
  never accept Nango or unsigned forwarding as fallback.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/integrations test eventsVerifier`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-webhook-security`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:provider-boundary`, `rtk pnpm check:logging-boundary`,
  `rtk pnpm check:secret-canaries`, and broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** native signature/replay/size matrix, raw-byte verifier
  evidence, manifest hash, secret-name inventory, redacted pre-tenant telemetry
  samples, and proof rejected payloads made zero tenant writes.
- **Lane branch / commit boundary:** branch `codex/brain-s04-webhook-security`;
  commit `feat: verify Slack webhook bindings`.

### S04-T04 — Build Multi-Channel Routing And Delivery Policy Control Plane

- **Outcome / requirements:** satisfy SLK-02, SLK-03, SLK-08, IAM-04, and UI-01;
  admins can bulk-select any joined channels and set explicit policies.
- **Classification:** `template-gap`; target `TB-SOURCE-01`; frontend follow-up
  remains tracked by `TB-BRAIN-UI-01`. Policy semantics belong to Maestro, not
  Nango.
- **Dependencies:** S04-T03 and S03.
- **Existing anchors:** the template's current integration route is generic; the
  product spec requires channel table control rather than a connector catalog.
  Existing workspace role resolution remains authoritative
  ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/capabilities/_kit/workspaceAccess.ts#L28-L212)).
- **Files:** create `packages/convex/confect/tables/channelRoutingPolicies.ts`,
  `packages/convex/confect/tables/channelDeliveryPolicies.ts`,
  `packages/convex/confect/slack/channelPolicies.spec.ts`,
  `packages/convex/confect/slack/channelPolicies.impl.ts`,
  `packages/convex/confect/slack/channelPolicy.ts`,
  `packages/convex/test/channel-policies.test.ts`,
  `apps/web/src/features/connections/channel-table.tsx`,
  `apps/web/src/features/connections/channel-policy-dialog.tsx`,
  `apps/web/src/features/connections/connections-adapter.ts`,
  `apps/web/src/features/connections/channel-policy-view-model.ts`,
  `apps/web/src/features/connections/channel-policy-view-model.test.ts`; modify
  `apps/web/src/routes/_workspace.connections.tsx` and
  `docs/product/maestro-brain-lifecycle-adoption/S04-T04.md`.
- **Failure-first tests:** non-org-admin policy change, Direct with zero/two
  targets, Classify with empty/duplicate/unauthorized/cross-org target,
  Capture-only with targets, Slack Connect requester-private delivery, stale
  connection/channel generation, a 101st active channel, a 26th Client Brain
  target, and bulk partial commit all fail.
- **Implementation:** immutable policy epochs with
  `direct | classify | capture_only`; Direct has exactly one authorized Brain;
  Classify has a finite stable target descriptor set and Review-first;
  Capture-only has none. Independently write delivery policy: Slack Connect is
  always `capture_only`; internal channels may be `requester_private`. First
  policy records a bounded pending-source processing interval. Enforce the
  approved 25-client/100-channel launch envelope in capability and UI before
  accepting policy. Bulk change is all-or-nothing and audited.
- **Typed errors / state:** `ChannelNotJoined`, `PolicyInvalid`,
  `TargetBrainForbidden`, `PolicyGenerationMismatch`, `CapacityExceeded`;
  routing status is `needs_policy -> streaming | capture_only`, and
  `streaming | capture_only -> access_lost | error`. Channel membership retains
  T02's canonical names. Backfill has its own state.
- **Migration / compatibility / rollback:** additive policy tables. Normal
  changes are prospective by first-observed time. Rollback creates a new policy
  epoch; it never rewrites the prior one. Emergency historical revocation is
  S07.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test channel-policies`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test connections`,
  `rtk pnpm brain:factory:check-confect-codegen`, `rtk pnpm check:route-tree`,
  `rtk pnpm check:layer-boundaries`, `rtk pnpm check:access-audit-events`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test accessibility`,
  and broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** all role/policy invariants, 100-channel selection
  fixture, Slack Connect Direct/Classify ingestion allowed plus
  requester-private delivery denial, bulk atomicity, UI screenshots, and audit
  rows.
- **Lane branch / commit boundary:** branch
  `codex/brain-s04-channel-control-plane`; commit
  `feat: add multi-channel policy control`; final S04 checkpoint.

---

## S05 — Verified Exact Capture, Immutable Source Units, And Mechanical Routing

### S05-T01 — Add The Organization Source Ledger And Atomic Capture Tables

- **Outcome / requirements:** satisfy SLK-04, SLK-05, IAM-03, KNW-02; accepted
  deliveries have distinct transport receipts that converge on one logical
  observation/source revision and assembly intent.
- **Classification:** `template-gap`; target `TB-SOURCE-01`; promote as the
  generic source intake pattern only after Slack proves it.
- **Dependencies:** S04 complete.
- **Existing anchors:** the template backlog has only `brainPages` for source
  ingestion and calls out missing source/source-unit tables in
  [`porting-backlog.md`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/porting-backlog.md#L516-L523);
  production Maestro's source-unit separation is prior art
  ([schema](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/packages/convex/convex/schema/sourceUnits.ts#L85-L140)).
- **Files:** create `packages/convex/confect/tables/providerEventReceipts.ts`,
  `packages/convex/confect/tables/sourceArtifacts.ts`,
  `packages/convex/confect/tables/sourceRevisions.ts`,
  `packages/convex/confect/tables/sourceProcessingJobs.ts`,
  `packages/convex/confect/sources/sourceSchemas.ts`, and
  `packages/convex/test/source-ledger-schema.test.ts`; modify
  `packages/convex/confect/internal/migrations.ts` and
  `docs/product/maestro-brain-lifecycle-adoption/S05-T01.md`.
- **Failure-first tests:** missing organization/channel binding, duplicate
  transport receipt, multiple receipts for one logical observation, conflicting
  observation identity, invalid source key/revision key, cross-org channel,
  content over limit, noncanonical timestamp/text, and partial transaction
  failure.
- **Implementation:** use stable tenant keys and every table/index in Appendix
  C. `providerEventReceipts` deduplicates transport delivery IDs and points to a
  logical observation key; multiple live/backfill/reconciliation receipts may
  reference the same source revision. Content-bearing rows carry lifecycle
  envelope and exact normalized text/blocks, author snapshot, timestamps,
  permalink, provider revision/order metadata, canonical hash, and tombstone
  flag. Job row begins at `assembly_pending` with pinned policy epoch and unique
  effect key.
- **Typed contract / errors:** internal capture input is a
  `VerifiedSlackEnvelope` plus normalized observation; result
  `{ outcome: inserted | duplicate, sourceKey, sourceRevisionKey, assemblyJobKey }`;
  errors `TenantMismatch`, `ChannelAccessLost`, `ObservationInvalid`,
  `PayloadTooLarge`, `DuplicateKeyConflict`.
- **Migration / compatibility / rollback:** new tables only. Rollback stops new
  capture and retains exact rows; never delete captured evidence to revert code.
  Re-enable only after the new binary understands every stored schema version.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-ledger-schema`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:confect-contracts`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** table/index inventory, schema version, tenant/key/
  partial-write tests, and lifecycle declarations.
- **Lane branch / commit boundary:** branch
  `codex/brain-s05-source-ledger-schema`; commit
  `feat: add exact source ledger schema`.

### S05-T02 — Implement Deterministic Slack Normalization, Ordering, And Atomic Capture

- **Outcome / requirements:** satisfy SLK-04, SLK-05, ZFC-01; exact capture
  succeeds with every model disabled.
- **Classification:** `template-gap`; target `TB-SOURCE-01`; deterministic
  source adapter instance behind the verified webhook.
- **Dependencies:** S05-T01.
- **Existing anchors:** the pinned template's provider boundary exposes typed
  integrations and rate-limit services but no source normalizer in
  [`rateLimit.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/rateLimit.ts#L1-L135).
  Nango remains the API/history boundary. The design's `A -> B -> A` invariant
  separates transport event IDs from logical observation identity.
- **Files:** create `packages/convex/confect/sources/slackNormalizer.ts`,
  `packages/convex/confect/sources/sourceOrdering.ts`,
  `packages/convex/confect/sources/captureTransaction.ts`,
  `packages/convex/test/source-capture.property.test.ts`, and
  `packages/convex/test/source-capture.test.ts`; modify
  `packages/convex/confect/slack/webhook.impl.ts` to call only the capture
  transaction before ACK.
- **Failure-first tests:** repeated delivery, live/backfill race, out-of-order
  edit, `A -> B -> A`, delete-before-create, thread reply, bot-authored answer,
  malformed permalink, Unicode/newline normalization, crash before commit, crash
  after commit/before ACK, and LLM outage.
- **Implementation:** parse the verified event/history item into canonical
  schemas. Transport receipt key is
  `(connectionGeneration, transport, deliveryId)`; logical observation key is
  `(connectionGeneration, channelId, providerObjectId, providerRevisionDiscriminator, canonicalHashOrTombstone)`.
  Append only when the logical observation is new, attach every receipt as
  provenance, and update latest pointer only under the total order
  `(provider effective timestamp, provider revision discriminator, deterministic minimum receipt key)`.
  Append tombstones without retaining deleted text in current pointers.
  Atomically write event receipt/source artifact/revision/assembly intent, then
  ACK. Self-authored bot answers retain a receipt but are mechanically excluded
  from maintenance/classification.
- **Typed errors / state:** `NormalizationFailed`, `ObservationConflict`,
  `ChannelAccessLost`, `LifecycleRevoked`; receipt outcome is
  `inserted | duplicate | ignored_bot_output | tombstone | rejected`.
- **Migration / compatibility / rollback:** no existing events. Version the
  normalizer and keep old decoder support for rows already written. Rollback
  disables webhook acceptance rather than writing with an older schema.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-capture`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-capture property adversarial`,
  `rtk pnpm check:provider-boundary`, `rtk pnpm check:logging-boundary`,
  `rtk pnpm brain:factory:check-confect-codegen`, and broad verification is
  deferred to tranche acceptance under Appendix L.
- **Completion receipt:** `A -> B -> A` rows, crash matrix, duplicate/race
  outcome, zero model calls, ACK timing, and no raw webhook log proof.
- **Lane branch / commit boundary:** branch `codex/brain-s05-atomic-capture`;
  commit `feat: capture exact Slack revisions`.

### S05-T03 — Assemble Immutable Bounded Source-Unit Revisions At A Fixed Cut

- **Outcome / requirements:** satisfy SLK-06 and ZFC-01; model adapters receive
  complete content, never database keys they must dereference.
- **Classification:** `template-gap`; target `TB-SOURCE-01`, informed by
  production Maestro source-unit separation but translated into generic Slack
  thread units.
- **Dependencies:** S05-T02.
- **Existing anchors:** production source-unit prior art separates exact source,
  evidence, and routing in
  [`source-unit-knowledge-model.md`](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/docs/architecture/source-unit-knowledge-model.md);
  do not import its content-generation taxonomy.
- **Files:** create `packages/convex/confect/tables/sourceUnits.ts`,
  `packages/convex/confect/tables/sourceUnitRevisions.ts`,
  `packages/convex/confect/sources/assembler.ts`,
  `packages/convex/confect/sources/sourceUnits.spec.ts`,
  `packages/convex/confect/sources/sourceUnits.impl.ts`, and
  `packages/convex/test/source-unit.test.ts`; modify
  `packages/convex/confect/tables/sourceProcessingJobs.ts` and
  `docs/product/maestro-brain-lifecycle-adoption/S05-T03.md`.
- **Failure-first tests:** standalone and thread assembly, out-of-order replies,
  reply arriving during assembly, a thread spanning a policy change, edit/delete
  at the cut, over-message/byte/token bounds, stale lease, duplicate assembly
  effect, and cross-channel/org revision.
- **Implementation:** group mechanically by Slack `thread_ts` or standalone
  message ID and partition by each message's first-observed policy epoch. After
  the fixed quiet window claim one same-epoch segment, pin a database cut, load
  latest active revisions for that segment, and produce an ordered immutable
  snapshot with canonical hash, source revision keys, one policy epoch, and
  assembly version. A reply after a policy change starts a new segment and
  cannot reroute earlier-epoch text. A later reply creates a new unit revision
  for its segment and supersedes older pending cognitive jobs without mutation.
- **Typed contract / errors:**
  `assembleSourceUnit({ jobKey, leaseToken }) -> { sourceUnitKey, sourceUnitRevisionKey, hash, messageCount, byteCount, fixedCut }`;
  errors `LeaseLost`, `SourceRevisionMissing`, `SourceUnitTooLarge`,
  `StalePolicyEpoch`, `LifecycleRevoked`, `DuplicateEffect`.
- **Migration / compatibility / rollback:** new tables. Oversized units enter
  typed review/dead-letter state; code does not semantically split them.
  Rollback stops new assembly and leaves pending intents resumable.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-unit`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-unit property concurrency`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:access-audit-events`,
  and broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** fixed-cut race proof, bounds, deterministic repeated
  hash, supersession, tenant isolation, and no LLM/provider imports.
- **Lane branch / commit boundary:** branch
  `codex/brain-s05-source-unit-snapshots`; commit
  `feat: assemble immutable source units`.

### S05-T04 — Dispatch Capture-Only And Direct Routes Mechanically

- **Outcome / requirements:** satisfy SLK-03, ZFC-01, KNW-01; Direct performs
  zero classification calls and Capture-only produces no route/model work.
- **Classification:** `pattern-instance` capability generated with
  `rtk pnpm template:add-capability -- --name commitSourceRoute --description "Commits an authorized source route without semantic reinterpretation." --exposure workflow --write`,
  followed by deliberate internal-only contract review and the focused gates in
  `docs/template/how-to-add-capability.md`.
- **Dependencies:** S05-T03 and S04-T04.
- **Existing anchors:** the capability generator defaults to a public mutation,
  so use workflow exposure and review every generated surface
  ([generator](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/generators/src/index.ts#L1143-L1178)).
- **Files:** the generator dry-run enumerates/hashes the generated
  `commitSourceRoute` capability target; create
  `packages/convex/confect/tables/sourceRoutes.ts`,
  `packages/convex/confect/sources/policyDispatch.ts`, and
  `packages/convex/test/direct-routing.test.ts`; modify
  `packages/convex/confect/tables/sourceProcessingJobs.ts`,
  `docs/product/maestro-brain-lifecycle-adoption/S05-T04.md`, and generated
  manifests.
- **Failure-first tests:** no policy -> `awaiting_policy`; Capture-only creates
  no route/job; Direct creates one exact route; stale policy/route/lifecycle/
  lease generation, wrong Brain org, duplicate effect, and any classification
  adapter invocation in Direct all fail.
- **Implementation:** dispatch only from pinned policy epoch. For Direct, build
  a one-Brain route command from the human-confirmed target and apply it without
  model interpretation. Store exact included source revision keys, active
  interval, origin, generations, reviewer/policy actor, and effect key. For
  `needs_policy` retain the unit only in organization vault; when first policy
  arrives, enqueue bounded pending units.
- **Typed errors / state:** the source-processing job has orthogonal fields.
  Execution status uses Appendix G's claim/lease machine. Routing stage is
  `assembled -> awaiting_policy | capture_only | route_pending`;
  `awaiting_policy -> capture_only | route_pending`; `route_pending -> routed`;
  and any non-terminal stage may become `superseded | revoked`. Errors are
  `PolicyNotFound`, `PolicyGenerationMismatch`, `TenantMismatch`,
  `DuplicateEffect`, and `LifecycleRevoked`.
- **Migration / compatibility / rollback:** additive route table. A normal
  rollback writes a prospective Capture-only epoch; historical route deletion is
  forbidden and emergency deactivation is S07.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name commitSourceRoute --description "Commits an authorized source route without semantic reinterpretation." --exposure workflow`,
  `rtk pnpm template:add-capability -- --name commitSourceRoute --description "Commits an authorized source route without semantic reinterpretation." --exposure workflow --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test commitSourceRoute direct-routing`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:workflow-graph-boundary`,
  `rtk pnpm check:headless-surface-contract`,
  `rtk pnpm check:provider-boundary`, and broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** generator provenance, Direct/Capture-only/no-policy
  state results, exact route row, idempotency/fencing, and manifest proof that
  no public route-commit tool exists.
- **Lane branch / commit boundary:** branch
  `codex/brain-s05-mechanical-routing`; commit
  `feat: commit direct source routes`; final S05 checkpoint.

---

## S06 — Fenced Workpool, Fair Scheduling, Backfill, And Reconciliation

### S06-T01 — Replace The Demo Workpool With Fenced Source Job Claims

- **Outcome / requirements:** satisfy SLK-07 and ZFC-01; at-least-once workers
  can duplicate attempts but accept only one logical effect.
- **Classification:** `fixture-to-real` for `jobs/workpool`; real boundary is
  `@convex-dev/workpool` plus `sourceProcessingJobs` leases/CAS.
- **Dependencies:** S05 complete.
- **Existing anchors:** the workpool is mounted but current enqueue/status/
  background work is demo behavior in
  [`workpool.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/jobs/workpool.ts#L18-L86).
- **Files:** modify `packages/convex/confect/jobs/workpool.spec.ts`,
  `packages/convex/confect/jobs/workpool.impl.ts`,
  `packages/convex/confect/jobs/workpool.ts`,
  `packages/convex/confect/tables/sourceProcessingJobs.ts`; create
  `packages/convex/confect/jobs/leases.ts`,
  `packages/convex/confect/jobs/jobState.ts`, and
  `packages/convex/test/source-workpool.test.ts`.
- **Failure-first tests:** crash before/after claim, after external response,
  before/after commit, and before ACK; lease expiry/reclaim; stale worker
  commit; duplicate enqueue/effect; retryable/permanent error; max attempts;
  cancellation and emergency generation fence.
- **Implementation:** claim by compare-and-set with `leaseGeneration`, opaque
  `leaseToken`, owner, expiry, attempt; heartbeat only the current token;
  completion compares all pinned generations and effect key. Persist immutable
  attempt receipts and external response hashes before commit where available.
  Status/control functions are internal/admin-observed, not API/MCP tools.
- **Typed errors / state:**
  `queued -> leased -> running -> succeeded | retry_wait | dead_letter | superseded | revoked | cancelled`;
  errors `LeaseLost`, `RetryableJobFailure`, `PermanentJobFailure`,
  `MaxAttemptsReached`, `StaleGeneration`, `DuplicateEffect`.
- **Migration / compatibility / rollback:** migrate demo rows only in test
  fixtures; new source jobs use schema version 1. Rollback stops claims and lets
  leases expire; never clear pending jobs.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-workpool`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-workpool contract`,
  `rtk pnpm check:workflow-graph-boundary`, and broad verification is deferred
  to tranche acceptance under Appendix L.
- **Completion receipt:** full crash matrix, duplicate external-call versus one
  accepted effect proof, lease fencing, terminal/retry states, no public
  control.
- **Lane branch / commit boundary:** branch `codex/brain-s06-fenced-workpool`;
  commit `feat: fence source workpool jobs`.

### S06-T02 — Add Fair Priority Pools And Central Slack Rate Budgets

- **Outcome / requirements:** satisfy SLK-07 and REL-02; a large channel cannot
  starve another, and live/outbound work outranks recent/deep history without
  semantic scoring.
- **Classification:** `template-gap`; target `TB-SOURCE-01`; generic
  deterministic scheduling/rate-limit mechanism.
- **Dependencies:** S06-T01.
- **Existing anchors:** the pinned template already has provider-neutral
  rate-limit helpers in
  [`rateLimit.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/rateLimit.ts#L1-L135),
  but no per-connection/method/channel durable scheduler.
- **Files:** create
  `packages/convex/confect/tables/providerRateLimitBuckets.ts`,
  `packages/convex/confect/jobs/fairScheduler.ts`,
  `packages/convex/confect/jobs/fairScheduler.test.ts`,
  `packages/convex/confect/jobs/slackRateBudget.ts`,
  `packages/convex/confect/jobs/slackRateBudget.test.ts`, and
  `packages/convex/test/source-fairness.test.ts`; modify
  `packages/convex/confect/tables/channelSyncStates.ts`,
  `packages/convex/confect/tables/sourceProcessingJobs.ts`, and
  `docs/product/maestro-brain-lifecycle-adoption/S06-T02.md`.
- **Failure-first tests:** 100-channel round-robin, one huge queue, one failing
  channel, live burst while deep backfill runs, connection/method 429 with
  `Retry-After`, organization concurrency cap, above-envelope admission, noisy
  tenant, and clock advance. Assert no message text influences order.
- **Implementation:** fixed priority classes `live_capture`,
  `outbound_delivery`, `recent_history`, `reconciliation`, `deep_history` with
  configured concurrency. Within a class, deterministic tenant/channel
  round-robin and bounded quantum. Central token/budget rows apply by provider,
  connection, method, and organization; `Retry-After` sets `blockedUntil`.
  Admission above the approved channel/job/concurrency policy returns
  `CapacityExceeded` or an explicit bounded queued state; it never silently
  accepts work that the scheduler will drop.
- **Typed errors / state:** bucket `available -> blocked_until -> available`;
  admission `accepted | queued | capacity_rejected`; errors
  `RateBudgetExceeded`, `ProviderRateLimited`, `CapacityExceeded`.
- **Migration / compatibility / rollback:** additive rows/config. Launch
  defaults are policy data, not hard-coded customer semantics. Rollback sets
  concurrency to zero for history pools while live capture continues.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-fairness slack-rate-budget`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test source-fairness property TestClock scheduler-dependency`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** fairness distribution, priority latency, 429 timeline,
  noisy-neighbor isolation, and configured launch limits.
- **Lane branch / commit boundary:** branch `codex/brain-s06-fair-scheduler`;
  commit `feat: schedule Slack work fairly`.

### S06-T03 — Implement Bounded Recent And Deep History Backfill

- **Outcome / requirements:** satisfy SLK-02, SLK-07, REL-02; every joined
  channel owns independent recent/deep cursors and bounded batches.
- **Classification:** `template-gap`; target `TB-SOURCE-01` using Nango's
  message sync as provider-call prior art only.
- **Dependencies:** S06-T02.
- **Existing anchors:** the stock Nango sync fetches useful messages/replies but
  processes only `allChannels.slice(0, 1)` in
  [`messages-received.ts`](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/messages-received.ts#L70-L93).
- **Files:** create `packages/integrations/src/nango/slackHistory.ts`,
  `packages/integrations/src/nango/slackHistory.test.ts`,
  `packages/convex/confect/slack/backfill.spec.ts`,
  `packages/convex/confect/slack/backfill.impl.ts`,
  `packages/convex/confect/slack/backfillBatch.ts`, and
  `packages/convex/test/slack-backfill.test.ts`; modify
  `packages/convex/confect/tables/channelSyncStates.ts`,
  `packages/convex/confect/tables/sourceProcessingJobs.ts`, and
  `apps/web/src/features/connections/channel-health-view-model.ts`.
- **Failure-first tests:** multiple channels, paginated messages and replies,
  crash before/after observation commit and cursor CAS, duplicate live/backfill
  event, partial page failure, access loss, edited/deleted retained item,
  `Retry-After`, recent completion independent of deep, and bounded memory.
- **Implementation:** one job fetches one bounded page for one channel through
  Nango. Reuse S05 normalization/capture. Commit observations and next cursor
  atomically, or observations then cursor CAS only after all succeed. Recent is
  a fixed newest time/message window; deep continues to retention boundary.
  Never accumulate connection-wide messages or classify in the adapter.
- **Typed errors / state:** each independent `recent`/`deep` lane uses the
  Appendix G sync-lane machine: `not_started | idle -> queued -> running`;
  `running -> complete | waiting_rate_limit | retry_wait | access_lost | dead_letter`;
  and retry/access restoration returns through `queued` without resetting the
  cursor. A batch returns counts, cursor, oldest/newest timestamps, and typed
  gap; errors `ProviderRateLimited`, `ChannelAccessLost`, `CursorConflict`,
  `BatchTooLarge`, `ProviderMalformed`.
- **Migration / compatibility / rollback:** new cursors start null. Rollback
  pauses history pools without resetting cursors; live capture remains enabled.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-backfill`,
  `rtk host-test-slot --class focused pnpm --dir packages/integrations test slackHistory`,
  `rtk pnpm check:provider-boundary`, `rtk pnpm check:logging-boundary`,
  `rtk pnpm brain:factory:check-confect-codegen`, broad verification is deferred
  to tranche acceptance under Appendix L.
- **Completion receipt:** 100-channel cursor independence, batch memory bound,
  crash/CAS proof, live-race idempotency, recent/deep status, and no first-
  channel sampling.
- **Lane branch / commit boundary:** branch `codex/brain-s06-slack-backfill`;
  commit `feat: backfill every Slack channel`.

### S06-T04 — Add Reconciliation, Dead-Letter Replay, And Honest Gap Recovery

- **Outcome / requirements:** satisfy SLK-07, REL-03, UI-04; missed edits/
  deletions recover when possible and impossible history is visibly incomplete.
- **Classification:** `template-gap`; target `TB-SOURCE-01` plus admin-surface
  pattern; the documented admin generator is not runnable, so implement the
  product instance and record promotion evidence.
- **Dependencies:** S06-T03.
- **Existing anchors:** the pinned template's health fixture is a narrow status
  seam in
  [`health.impl.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/ops/health.impl.ts#L1-L18).
  S04 supplies the Connections surface; Nango/provider retry alone does not
  provide source-level reconciliation.
- **Files:** create `packages/convex/confect/slack/reconciliation.spec.ts`,
  `packages/convex/confect/slack/reconciliation.impl.ts`,
  `packages/convex/confect/slack/recovery.ts`,
  `packages/convex/test/slack-reconciliation.test.ts`,
  `apps/web/src/features/connections/channel-health.tsx`,
  `apps/web/src/features/connections/channel-health.test.tsx`,
  `apps/web/src/features/connections/dead-letter-dialog.tsx`, and
  `apps/web/src/features/connections/dead-letter-dialog.test.tsx`; modify
  `packages/convex/confect/jobs/fairScheduler.ts`,
  `packages/convex/confect/tables/channelSyncStates.ts`,
  `packages/convex/confect/ops/notifications.spec.ts`,
  `packages/convex/confect/ops/notifications.impl.ts`, and
  `packages/convex/confect/access/audit.ts`.
- **Failure-first tests:** missed edit/delete in overlap, bot removed/re-added,
  message expired during access loss, permanent poison record, max attempts,
  admin replay wrong generation, viewer replay, and one channel's dead letter
  blocking others.
- **Implementation:** periodically reread a fixed recent overlap, feed S05
  idempotent capture, compare watermarks, and record `gap_unrecoverable` with
  time bounds/reason when Slack no longer exposes content. Admin replay creates
  a new attempt with current auth/generation; it never edits the prior receipt.
  UI shows live lag, recent/deep progress, retries, access loss, and redacted
  last error separately.
- **Typed errors / state:** dead letter `open -> replaying -> resolved | open`;
  access `access_lost -> reconciling -> streaming | gap_unrecoverable`; errors
  `ReplayForbidden`, `GenerationMismatch`, `ProviderHistoryUnavailable`.
- **Migration / compatibility / rollback:** additive status/receipts. Rollback
  disables reconciliation/replay, not live capture; retain visible gaps.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-reconciliation`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test channel-health`,
  `rtk host-test-slot --class focused pnpm --dir packages/notifications test`,
  `rtk pnpm check:access-audit-events`, `rtk pnpm check:logging-boundary`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test accessibility`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** repairable/unrecoverable fixtures, dead-letter replay
  authorization, independent progress, UI screenshots, and operator audit.
- **Lane branch / commit boundary:** branch `codex/brain-s06-reconciliation`;
  commit `feat: reconcile Slack capture gaps`; final S06 checkpoint.

---

## S07 — Retention, Redaction, Revocation, DSAR, And Recovery

### S07-T01 — Add The Shared Lifecycle Envelope, Policies, Holds, And Jobs

- **Outcome / requirements:** satisfy KNW-02, IAM-04, FND-03 for all rows that
  exist through S06 and define the mandatory adoption contract for later S09-S12
  descendants.
- **Classification:** `template-gap`; target `TB-SOURCE-LIFECYCLE-01` while
  extending the already database-backed `ops/dataLifecycle` planner; promote the
  lifecycle envelope/job pattern after descendant adoption is complete.
- **Dependencies:** S05 and S06 complete.
- **Existing anchors:** the template currently plans lifecycle work but keeps
  delete entries `executable: false` and retention dry-run-only in
  [`data-lifecycle.md`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/data-lifecycle.md#L30-L63).
- **Files:** create `packages/convex/confect/lifecycle/envelope.ts`,
  `packages/convex/confect/tables/retentionPolicies.ts`,
  `packages/convex/confect/tables/legalHolds.ts`,
  `packages/convex/confect/tables/lifecycleJobs.ts`,
  `packages/convex/test/lifecycle-envelope.test.ts`; modify
  `docs/product/maestro-brain-lifecycle-adoption/S07-T01.md`,
  `packages/convex/confect/tables/brainPages.ts`,
  `packages/convex/confect/tables/pageRevisions.ts`,
  `packages/convex/confect/tables/citations.ts`,
  `packages/convex/confect/tables/providerEventReceipts.ts`,
  `packages/convex/confect/tables/sourceArtifacts.ts`,
  `packages/convex/confect/tables/sourceRevisions.ts`,
  `packages/convex/confect/tables/sourceProcessingJobs.ts`,
  `packages/convex/confect/tables/sourceRoutes.ts`,
  `packages/convex/confect/tables/channelSyncStates.ts`,
  `packages/convex/confect/ops/dataLifecycle.spec.ts`,
  `packages/convex/confect/ops/dataLifecycle.impl.ts`,
  `packages/convex/confect/ops/dataLifecycle.ts`,
  `packages/convex/confect/internal/migrations.ts`, and
  `docs/template/data-lifecycle.md`. The adoption document assigns exact S09-S12
  descendant files/tests to their owning future tasks; S07 does not name
  nonexistent files as its own diff.
- **Failure-first tests:** missing lifecycle owner/posture, stale lifecycle
  generation read/commit, purge under active hold, policy from non-org-admin,
  retroactive shortening without preview/approval, and cross-org job target.
- **Implementation:** common fields
  `lifecycleState: active | redacted | purged`, `lifecycleGeneration`,
  `redactedAt?`, `purgeAfter?`, `legalHoldKey?`. Store immutable organization
  policy epochs and affected resource types. Internal guard functions filter
  current reads and existing commits. Export reusable guards for S09-S12; those
  tasks must add their own search/model/outbox/export integrations before the
  whole-matrix gate.
- **Typed errors / state:** `LifecycleRevoked`, `LegalHoldActive`,
  `RetentionPolicyInvalid`, `LifecycleGenerationMismatch`, `PurgeNotApproved`;
  job `planned -> approved -> running -> complete | failed | blocked_by_hold`.
- **Migration / compatibility / rollback:** expand default legacy rows to active
  generation 1; backfill/verify before requiring fields. Rollback readers may
  ignore new policy only before any redaction; after a redaction, rollback must
  preserve the stricter visibility decision.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test dataLifecycle lifecycle-envelope`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:access-audit-events`,
  `rtk pnpm check:confect-contracts`, and broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** resource owner/export/delete/retention inventory,
  migration counts, hold/generation denials, and current-read filter proof.
- **Lane branch / commit boundary:** branch
  `codex/brain-s07-lifecycle-envelope`; commit
  `feat: add enforceable lifecycle policies`.

### S07-T02 — Propagate Slack Edit/Delete And Emergency Route Revocation

- **Outcome / requirements:** satisfy KNW-02, SLK-05, SLK-08; forbidden text
  disappears from current reads, search/model inputs, and new deliveries
  immediately while audit metadata remains.
- **Classification:** `template-gap`; target `TB-SOURCE-LIFECYCLE-01`;
  deterministic lifecycle propagation workflow using internal capabilities only.
- **Dependencies:** S07-T01.
- **Existing anchors:** the pinned lifecycle UI explicitly presents reviewed
  planning and fulfillment states in
  [`data-lifecycle-surface.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/features/data-lifecycle/data-lifecycle-surface.tsx#L102-L137),
  but has no real propagation executor. S05/S06 provide the revision and route
  generations to fence.
- **Files:** create `packages/convex/confect/lifecycle/propagation.ts`,
  `packages/convex/confect/lifecycle/sourceRedaction.spec.ts`,
  `packages/convex/confect/lifecycle/sourceRedaction.impl.ts`,
  `packages/convex/confect/lifecycle/routeRevocation.spec.ts`,
  `packages/convex/confect/lifecycle/routeRevocation.impl.ts`, and
  `packages/convex/test/lifecycle-propagation.test.ts`; modify
  `packages/convex/confect/sources/captureTransaction.ts`,
  `packages/convex/confect/sources/sourceOrdering.ts`,
  `packages/convex/confect/sources/policyDispatch.ts`,
  `packages/convex/confect/brain/revisions.ts`,
  `packages/convex/confect/brain/citations.ts`,
  `packages/convex/confect/jobs/workpool.impl.ts`, and
  `docs/product/maestro-brain-lifecycle-adoption/S07-T02.md`.
- **Failure-first tests:** Slack delete after page citation, emergency revoke
  during existing route/page/job work, current page read/history/editor snapshot
  after revoke, normal prospective policy change versus historical revoke, legal
  hold, duplicate propagation, and crash/resume at every extant resource class.
  S09-S12 own equivalent Ask/export/outbound tests when those resources exist.
- **Implementation:** Slack delete marks prior cleartext non-current
  immediately, appends tombstone, increments lifecycle generation,
  cancels/fences jobs, deactivates routes, marks citations redacted, and marks
  the entire affected current page revision non-readable before queueing a
  reviewed safe replacement. History returns metadata/redacted markers, not the
  unsafe editor snapshot. Emergency route revocation increments route and
  lifecycle fences and applies the same whole-revision rule. Normal policy
  changes remain prospective and do not invoke this path.
- **Typed errors / state:** propagation item
  `pending -> applied | already_applied | retry_wait | failed`; errors
  `LifecycleGenerationMismatch`, `RouteGenerationMismatch`, `LegalHoldActive`
  (blocks purge, not access revocation), `PropagationIncomplete`.
- **Migration / compatibility / rollback:** additive propagation receipts.
  Redaction/revocation is monotonic; rollback may restore service code but never
  make redacted text current. An authorized re-route creates new active derived
  rows from still-retained source, not resurrected old rows.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test lifecycle-propagation race`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:access-audit-events`,
  `rtk pnpm check:schema-migration-notes`, broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** extant-resource matrix results, immediate
  page/current-read/history/editor denial, in-flight fencing, idempotent resume,
  redacted citation marker, and the explicit S09-S12 adoption ledger.
- **Lane branch / commit boundary:** branch
  `codex/brain-s07-revocation-propagation`; commit
  `feat: propagate source revocations`.

### S07-T03 — Execute Retention, DSAR, Purge, Organization/Brain Delete, And Backup Policy

- **Outcome / requirements:** satisfy KNW-02 and REL-04 with reviewed,
  legal-hold-aware destructive execution and an honest backup contract.
- **Classification:** `template-gap`; target `TB-SOURCE-LIFECYCLE-01` while
  extending the already database-backed `ops/dataLifecycle`; the real boundary
  is audited internal jobs, not a broad public deleter.
- **Dependencies:** S07-T02.
- **Existing anchors:** current `createDsarRequest` is only the review handoff
  and explicitly does not execute deletion
  ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/data-lifecycle.md#L44-L55)).
- **Files:** modify `packages/convex/confect/ops/dataLifecycle.spec.ts`,
  `packages/convex/confect/ops/dataLifecycle.impl.ts`,
  `packages/convex/confect/ops/dataLifecycle.ts`, and
  `packages/convex/confect/tables/dsarRequests.ts`; create
  `packages/convex/confect/tables/dataSubjectBindings.ts`,
  `packages/convex/confect/tables/dataSubjectOccurrences.ts`,
  `packages/convex/confect/lifecycle/dataSubjects.ts`,
  `packages/convex/confect/lifecycle/executor.ts`,
  `packages/convex/confect/lifecycle/purge.ts`,
  `packages/convex/confect/lifecycle/backupPolicy.ts`,
  `packages/convex/test/data-subject-scope.test.ts`,
  `packages/convex/test/lifecycle-executor.test.ts`, and
  `docs/product/maestro-brain-data-handling.md`.
- **Failure-first tests:** wrong confirmation, non-owner organization delete,
  non-owner Brain delete including admin denial, active hold, expired approval,
  exact WorkOS/Slack subject binding, free-text identity ambiguity, partial
  purge/resume, derived table omitted, previously downloaded export, and
  provider backup retention unknown.
- **Implementation:** preserve plan/review phase; require typed resource counts,
  exact confirmation, current role, second approval for organization delete, and
  current generations. Deterministically scope exact WorkOS subject,
  organization membership, verified Slack user, source-author occurrences, and
  keyed descendants. Free-text/inferred identity enters a reviewed manual-
  discovery manifest and is never auto-deleted. Immediately revoke access; after
  grace/hold checks, blank or delete protected primary-store text and retain
  approved tombstone/ hash/audit metadata. Purge temporary artifacts. Document
  Convex backup retention and restoration handling; if selective tenant deletion
  from backups is unavailable, mark backups inaccessible immediately, let them
  age out under the verified provider window, and disclose that window. Launch
  blocks until provider evidence is attached.
- **Typed errors / state:** DSAR
  `draft -> ready_for_review -> approved -> executing -> complete | blocked | failed`;
  `ConfirmationMismatch`, `ApprovalExpired`, `LegalHoldActive`,
  `BackupContractUnverified`, `PurgeIncomplete`.
- **Migration / compatibility / rollback:** destructive actions have no data
  rollback. Require a pre-execution manifest/hash/count receipt and staging
  rehearsal. Application rollback cannot restore purged text; backup restore
  must reapply tombstones/revocation journal before serving traffic.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test dataLifecycle purge dsar`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:access-audit-events`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:secret-canaries`;
  external-only acceptance: staging purge/DSAR rehearsal; broad verification is
  deferred to tranche acceptance under Appendix L.
- **Completion receipt:** approval/manifest hashes, per-resource counts, hold
  denial, resume result, provider backup evidence/window, and restored-backup
  tombstone replay test.
- **Lane branch / commit boundary:** branch `codex/brain-s07-dsar-purge`; commit
  `feat: execute audited lifecycle jobs`.

### S07-T04 — Expose Lifecycle Health, Holds, Recovery, And Redacted Citations

- **Outcome / requirements:** satisfy UI-04, KNW-02, REL-03; administrators can
  see and recover lifecycle work without exposing customer text.
- **Classification:** `template-gap`; target `TB-SOURCE-LIFECYCLE-01` because
  the documented lifecycle/admin generators are not runnable; promote the
  product lifecycle-health surface after its role/accessibility gates pass.
- **Dependencies:** S07-T03.
- **Existing anchors:** the existing lifecycle route is a request review surface
  backed by the dry-run planner in
  [`data-lifecycle.md`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/data-lifecycle.md#L52-L63).
- **Files:** modify
  `apps/web/src/features/data-lifecycle/data-lifecycle-surface.tsx`,
  `apps/web/src/features/data-lifecycle/data-lifecycle-surface.test.tsx`,
  `apps/web/src/routes/_workspace.data-lifecycle.tsx`, and
  `apps/web/src/features/brain/brain-evidence-drawer.tsx`; create
  `apps/web/src/features/settings/retention-policy.tsx`,
  `apps/web/src/features/settings/retention-policy.test.tsx`,
  `apps/web/src/features/settings/legal-holds.tsx`,
  `apps/web/src/features/settings/legal-holds.test.tsx`,
  `apps/web/src/features/settings/lifecycle-job-detail.tsx`,
  `apps/web/src/features/settings/lifecycle-job-detail.test.tsx`, and
  `docs/product/maestro-brain-lifecycle-operations.md`.
- **Failure-first tests:** viewer/editor policy/hold/job denial, redacted
  citation rendering, failed job retry stale generation, purge preview counts,
  downloaded-export disclaimer, and no customer text in UI telemetry/errors.
- **Implementation:** surface policy epoch, retention window, legal holds,
  revocation generation, job progress, blocked reason, retry action, and
  `gap_unrecoverable`. Client readers see only explicit redacted citation
  markers. Put destructive confirmation behind owner/admin matrix and audited
  server capability.
- **Typed contract / state:** UI mirrors lifecycle/DSAR states exactly; it does
  not infer success from percentages. Retry returns a new attempt key.
- **Migration / compatibility / rollback:** no new migration. Rollback UI hides
  controls but does not stop already-approved jobs; use the server kill switch
  for that.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test data-lifecycle retention legal-holds`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test accessibility`,
  `rtk pnpm check:route-tree`, `rtk pnpm check:layer-boundaries`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:access-audit-events`, and
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** role/state screenshots, redacted citation UX,
  destructive confirmation, telemetry canary, and operator recovery rehearsal.
- **Lane branch / commit boundary:** branch `codex/brain-s07-lifecycle-ui`;
  commit `feat: expose Brain lifecycle controls`; final S07 checkpoint.

---

## S08 — Structured LLM Gateway, Internal Workflows, Classification, And Maintenance

### S08-T01 — Replace The Text Placeholder With A Structured Provider-Neutral LLM Gateway

- **Outcome / requirements:** satisfy AI-01, AI-04, and ZFC-01; model adapters
  receive closed content-bearing requests and return schema-decoded decisions
  plus auditable receipts.
- **Classification:** `template-gap`; target `TB-STRUCTURED-LLM-01`; extend the
  existing provider seam rather than introducing model SDKs in features or Slack
  handlers.
- **Dependencies:** S02, S05, and S07 complete.
- **Existing anchors:** the current gateway defines an OpenRouter-shaped seam
  and spend envelope but its live path returns placeholder text in
  [`llm.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/llm.ts#L53-L95)
  and
  [`llm.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/llm.ts#L167-L248).
- **Files:** modify `packages/integrations/src/llm.ts`,
  `packages/integrations/src/llmResponse.ts`,
  `packages/integrations/src/llm.test.ts`,
  `packages/integrations/src/llmResponse.test.ts`,
  `packages/integrations/package.json`, `pnpm-lock.yaml`, `.env.example`,
  `docs/template/env-manifest.md`, and `docs/template/env-manifest.json`; create
  `packages/integrations/src/llmStructured.ts`,
  `packages/integrations/src/llmReceipt.ts`,
  `packages/integrations/src/llmEgressPolicy.ts`,
  `packages/integrations/src/llmStructured.test.ts`,
  `packages/integrations/src/llmReceipt.test.ts`,
  `packages/integrations/src/llmEgressPolicy.test.ts`, and
  `packages/convex/confect/tables/modelCallReceipts.ts`; modify lifecycle
  inventory `docs/product/maestro-brain-lifecycle-adoption/S08-T01.md`.
- **Failure-first tests:** valid structured output, malformed JSON/schema, wrong
  request/source hash, provider/model mismatch, timeout, cancellation, rate
  limit, spend/token/input bounds, disallowed provider/model/region,
  retention/no-training policy absent, duplicate response, and prompt/customer
  text logging canary.
- **Implementation:** use Vercel AI SDK structured generation behind this
  adapter only if its pinned package/API passes a small compile/runtime spike;
  otherwise call the OpenRouter-compatible HTTP API directly behind the same
  service. Record the selected exact package/version and decision before
  install. Input is
  `{ trustedInstructionVersion, toolSchemaVersion, modelPolicy, immutableContentManifest, outputSchema }`;
  output is decoded Effect data plus provider/model, sampling, latency,
  usage/cost, canonical request/response hashes, and attempt key. Never
  store/log raw prompts or completions by default.
- **Typed errors / state:** `ModelPolicyDenied`, `ModelInputTooLarge`,
  `ModelBudgetExceeded`, `ModelTimeout`, `ProviderRateLimited`,
  `MalformedModelOutput`, `ModelReceiptMismatch`; attempt
  `queued -> running -> succeeded | retryable_failure | permanent_failure | cancelled`.
- **Migration / compatibility / rollback:** add receipt table; keep
  deterministic fake/test adapter. Live traffic remains feature-flagged.
  Rollback disables cognition and leaves capture/read paths live; receipts
  remain append-only.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/integrations test llm`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test model-call-receipts`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:provider-boundary`, `rtk pnpm check:env-boundary`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:secret-canaries`, broad
  verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** selected transport/package pin, fake and sandbox
  structured calls, every typed failure, egress policy, request/response hashes,
  cost/token bounds, and log canary.
- **Lane branch / commit boundary:** branch `codex/brain-s08-structured-llm`;
  commit `feat: add structured LLM gateway`.

### S08-T02 — Add An Internal-Only Workflow Generator Mode

- **Outcome / requirements:** satisfy ZFC-01 and HLS-02 by making capture-driven
  cognition durable without exposing start/status/approve controls to web/API/
  CLI/MCP.
- **Classification:** `template-gap`; target `TB-INTERNAL-WORKFLOW-01`;
  resolution extends the existing workflow generator and promotes the generic
  mode.
- **Dependencies:** S08-T01.
- **Existing anchors:** current generated start/status/approve functions are
  public and declare all four surfaces in
  [`tooling/generators/src/index.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/generators/src/index.ts#L1803-L1875).
- **Files:** modify `tooling/generators/src/index.ts`,
  `tooling/generators/src/index.test.ts`,
  `tooling/generators/src/workflow-output-smoke.ts`,
  `tooling/generators/package.json`, root `package.json`,
  `docs/template/how-to-add-workflow.md`, and
  `docs/template/generator-output-contract.md`; create
  `tooling/generators/__fixtures__/workflow/internal.expected.json`,
  `tooling/generators/__fixtures__/workflow/public.expected.json`, and
  `tooling/generators/__fixtures__/workflow/invalid-exposure.json`. S08 owns no
  template-backlog edit; S09-T01 owns the async-search backlog update.
- **Failure-first tests:** `--exposure internal` is initially rejected; after
  implementation its generated spec uses internal functions, manifest surfaces
  are empty, no OpenAPI/MCP/CLI descriptor exists, durable runner still composes
  only internal capabilities, and default/public generator behavior remains
  unchanged.
- **Implementation:** add explicit workflow exposure `public | internal`
  independent from capability exposure. Internal mode emits durable runner,
  graph, internal start/status/review functions, tests, docs, and provenance; it
  never emits externally dispatchable metadata. Generated control remains
  authenticated by the calling internal capability/job fence.
- **Typed contract / errors:** generator rejects unknown/missing exposure with a
  deterministic CLI error; generated internal controls retain typed workflow
  status/errors but have no public authority contract.
- **Migration / compatibility / rollback:** generator-only change. Existing
  workflow output remains byte-identical. Rollback removes the new mode only if
  no generated internal workflow has landed; afterward, revert via a forward
  migration that preserves generated contracts.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir tooling/generators test`,
  `rtk pnpm template:workflow-output-smoke`,
  `rtk host-test-slot --class focused pnpm test:workflow`,
  `rtk pnpm check:generators`, and `rtk pnpm check:headless-surface-contract`.
- **Completion receipt:** before/after generator output tree, provenance,
  byte-identical public fixture, no-surface manifest, and CLI help.
- **Lane branch / commit boundary:** branch
  `codex/brain-s08-internal-workflows`; commit
  `feat: generate internal workflows`.

### S08-T03 — Implement Review-First Zero-Or-One Classification

- **Outcome / requirements:** satisfy AI-02, ZFC-01, SLK-03, IAM-04; only
  explicitly Classify channels call a model, and an org admin commits zero or
  one allowed route after review.
- **Classification:** `pattern-instance`; run
  `rtk pnpm template:add-capability -- --name classifySourceUnit --description "Returns a typed zero-or-one route proposal from an immutable source unit." --exposure workflow --write`
  and
  `rtk pnpm template:add-workflow -- --name sourceClassification --description "Gathers, classifies, reviews, and commits one source route." --exposure internal --write`;
  then replace starter contracts deliberately and run the focused gates from
  `docs/template/how-to-add-capability.md` and
  `docs/template/how-to-add-workflow.md`.
- **Dependencies:** S08-T02, S05-T04, S07-T02.
- **Existing anchors:** generated capability drafts are public mutations by
  default, so the named workflow exposure and manifest review are mandatory
  ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/generators/src/index.ts#L1143-L1178)).
- **Files:** generator dry-runs enumerate/hash the generated classifySourceUnit
  capability and sourceClassification workflow targets; create
  `packages/convex/confect/tables/classificationDecisions.ts`,
  `packages/convex/confect/classification/gather.ts`,
  `packages/convex/confect/classification/request.ts`,
  `packages/convex/confect/classification/review.ts`,
  `packages/convex/confect/classification/commit.ts`,
  `packages/convex/test/source-classification.test.ts`,
  `apps/web/src/features/connections/classification-review-queue.tsx`, and
  `apps/web/src/features/connections/classification-review-queue.test.tsx`;
  modify `packages/convex/confect/tables/sourceProcessingJobs.ts`,
  `docs/product/maestro-brain-lifecycle-adoption/S08-T03.md`, and generated
  manifests.
- **Failure-first tests:** Direct/Capture-only makes zero calls; empty/multiple/
  out-of-allowlist target, wrong snapshot/hash/policy, unresolved evidence
  quote, stale route/lifecycle/lease, model timeout, non-admin review,
  confidence-based auto-commit, mixed-client proposal/reviewer override,
  duplicate attempts, and prompt injection.
- **Implementation:** gather loads the immutable source-unit revision and pinned
  finite target descriptors, producing the exact `ClassificationRequest` in
  Appendix F. Adapter has no tools/database/Slack/Nango imports and returns
  `{ contentScope: single_target | mixed_client | no_target, targetBrainKey }`.
  Structural validation requires a nullable target for `no_target`, a null
  target for `mixed_client`, and one allowed target for `single_target`. An
  admin may change single-target to another allowed target or no-route, and may
  mark any proposal mixed-client/no-route, but cannot change `mixed_client` to a
  route in V1 because no target-safe span splitter exists. Commit rechecks
  current authority/generations and calls the mechanical route capability once.
  This Connections-scoped classification queue is distinct from S03-T04's
  Brain-maintenance review queue shell.
- **Typed errors / state:** the source-processing job's orthogonal stage is
  `awaiting_classification -> classifying -> awaiting_classification_review`,
  then
  `routed | classified_no_route | mixed_client_no_route | superseded | revoked`;
  retry remains an execution status rather than a decision stage. The durable
  classification decision uses Appendix G's canonical proposal/review machine.
  Errors are `MalformedModelOutput`, `TargetNotAllowed`, `EvidenceMismatch`,
  `ReviewForbidden`, `StaleGeneration`, and `DuplicateEffect`.
- **Migration / compatibility / rollback:** Classify policies remain disabled
  until eval and UI evidence pass; existing captured units stay replayable.
  Rollback disables new classification and leaves proposals pending; never
  guess/fallback to a Brain.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name classifySourceUnit --description "Returns a typed zero-or-one route proposal from an immutable source unit." --exposure workflow`,
  `rtk pnpm template:add-capability -- --name classifySourceUnit --description "Returns a typed zero-or-one route proposal from an immutable source unit." --exposure workflow --write`,
  `rtk pnpm template:add-workflow -- --name sourceClassification --description "Gathers, classifies, reviews, and commits one source route." --exposure internal`,
  `rtk pnpm template:add-workflow -- --name sourceClassification --description "Gathers, classifies, reviews, and commits one source route." --exposure internal --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test classification`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test review-queue`,
  `rtk pnpm check:workflow-graph-boundary`, `rtk pnpm check:confect-contracts`,
  `rtk pnpm check:headless-surface-contract`, `rtk pnpm check:layer-boundaries`,
  `rtk host-test-slot --class focused pnpm --dir tooling/evals test classification`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** generator provenance, zero-call Direct proof,
  allowlist/zero-one/mixed-client fixtures, admin review actions, duplicate
  model attempts versus one route, injection fixtures, and no public cognition
  tools.
- **Lane branch / commit boundary:** branch `codex/brain-s08-classification`;
  commit `feat: classify source units for review`.

### S08-T04 — Implement Cited Review-First Brain Maintenance And Autopilot Gate

- **Outcome / requirements:** satisfy AI-03, AI-04, KNW-01, UI-04; routed units
  produce cited no-op/revision proposals, with administrator-controlled
  progressive autonomy and one accepted revision effect.
- **Classification:** `pattern-instance`; run
  `rtk pnpm template:add-capability -- --name maintainBrainPage --description "Returns cited Brain revision proposals from an immutable context pack." --exposure workflow --write`
  and internal
  `rtk pnpm template:add-workflow -- --name sourceToBrainMaintenance --description "Gathers routed evidence and proposes cited Brain revisions." --exposure internal --write`
  after dry-runs; follow `docs/template/how-to-add-capability.md` and
  `docs/template/how-to-add-workflow.md`, including their focused gates.
- **Dependencies:** S08-T03 and S02-T03.
- **Existing anchors:** version/citation persistence is S02; the current generic
  LLM seam is now structured from T01. The repo layer law requires workflows to
  compose capabilities and provider calls to stay behind adapters
  ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/AGENTS.md#L50-L58)).
- **Files:** generator dry-runs enumerate/hash the generated maintainBrainPage
  capability and sourceToBrainMaintenance workflow targets; create
  `packages/convex/confect/tables/brainMaintenanceProposals.ts`,
  `packages/convex/confect/maintenance/gather.ts`,
  `packages/convex/confect/maintenance/request.ts`,
  `packages/convex/confect/maintenance/policy.ts`,
  `packages/convex/confect/maintenance/commit.ts`,
  `packages/convex/test/brain-maintenance.test.ts`,
  `apps/web/src/features/brain/maintenance-review.tsx`, and
  `apps/web/src/features/brain/maintenance-review.test.tsx`; modify
  `packages/convex/confect/tables/sourceProcessingJobs.ts`,
  `docs/product/maestro-brain-lifecycle-adoption/S08-T04.md`, generated
  manifests, and `tooling/evals/src/index.ts`.
- **Failure-first tests:** typed no-op, new/existing page proposal, uncited
  factual claim, citation outside context pack, stale
  page/source/route/lifecycle generation, revision budget, model
  self-confidence, changed model/prompt, non-admin Autopilot, review
  accept/edit/reject, duplicate attempts, and indirect prompt injection from
  pages/source/model output.
- **Implementation:** gather exact routed unit/current pages/citation candidates
  into immutable bounded context pack. Model chooses no-op/page/revision and
  exact citations. Structural commit validates only schema, citation membership,
  policy, budgets, and generations; it does not rewrite/rerank model meaning.
  Pilot defaults Review-first. Brain admin may enable Autopilot only for a
  model/prompt pair with passing eval receipt and reviewed sample count. Changed
  pair returns to Review-first. Restore remains a human action from S02/S03. The
  Brain maintenance surface reuses and completes S03-T04's `review-queue.tsx`
  shell; it does not create a second generic review queue.
- **Typed errors / state:** the maintenance proposal uses Appendix G's canonical
  machine: `gathering -> proposed_noop | proposed_revision`;
  `proposed_noop -> accepted_noop | rejected | superseded`;
  `proposed_revision -> awaiting_review`; and
  `awaiting_review -> published | edited_and_published | rejected | superseded | revoked`.
  Autopilot may move a proven `proposed_revision` directly to `published` under
  the same commit fences. Errors are `CitationRequired`,
  `CitationNotInManifest`, `RevisionBudgetExceeded`, `AutopilotNotEligible`,
  `StaleRevision`, and `LifecycleRevoked`.
- **Migration / compatibility / rollback:** additive proposals/policy fields.
  Rollback sets maintenance `Off`, cancels/fences pending commits, and preserves
  all proposals/revisions. It never rolls back exact source capture.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name maintainBrainPage --description "Returns cited Brain revision proposals from an immutable context pack." --exposure workflow`,
  `rtk pnpm template:add-capability -- --name maintainBrainPage --description "Returns cited Brain revision proposals from an immutable context pack." --exposure workflow --write`,
  `rtk pnpm template:add-workflow -- --name sourceToBrainMaintenance --description "Gathers routed evidence and proposes cited Brain revisions." --exposure internal`,
  `rtk pnpm template:add-workflow -- --name sourceToBrainMaintenance --description "Gathers routed evidence and proposes cited Brain revisions." --exposure internal --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-maintenance`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test maintenance-review`,
  `rtk pnpm check:workflow-graph-boundary`,
  `rtk pnpm check:headless-surface-contract`, `rtk pnpm check:layer-boundaries`,
  `rtk host-test-slot --class focused pnpm --dir tooling/evals test maintenance injection`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** no-op/review/autopilot states, citation and stale-race
  proof, model-change downgrade, revision budget, prompt-injection matrix,
  generator provenance, and no public workflow controls.
- **Lane branch / commit boundary:** branch `codex/brain-s08-maintenance`;
  commit `feat: maintain cited Client Briefs`; final S08 checkpoint.

---

## S09 — Async Search, Brain Projections, Retrieval Manifests, And Web Ask

### S09-T01 — Migrate The Search Seam To Asynchronous Effect Semantics

- **Outcome / requirements:** satisfy KNW-03 and ZFC-01; live Convex search can
  be awaited without preserving the fake token-overlap scorer as product
  cognition.
- **Classification:** `template-gap`; target `TB-ASYNC-SEARCH-01`; promote the
  async provider-neutral contract after live/fake parity.
- **Dependencies:** S07 and S08 complete.
- **Existing anchors:** current live search `query` returns synchronously in
  [`packages/search/src/index.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/search/src/index.ts#L57-L64),
  which cannot wrap a Convex query.
- **Files:** modify `packages/search/src/index.ts`,
  `packages/search/src/index.test.ts`, `packages/search/package.json`, and
  `pnpm-lock.yaml` and
  `docs/product/maestro-brain-lifecycle-adoption/S09-T01.md`; create
  `packages/search/src/asyncSearch.ts` and
  `packages/search/src/asyncSearch.test.ts`; update
  `docs/template/porting-backlog.md`. The pinned baseline has no external
  first-party consumer; drift preflight enumerates any new one.
- **Failure-first tests:** async fake/live parity, cancellation, timeout,
  provider failure, explicit cap/filter propagation, deterministic fake order,
  and a compile test rejecting synchronous consumer use.
- **Implementation:** expose an Effect service whose operation is
  `SearchService.search(input): Effect.Effect<SearchPage, SearchError, SearchProvider>`;
  `SearchError` is the closed union below and interruption cancels the provider
  request. Results are candidates with exact stable revision/projection keys and
  provider score/order only. Keep token-overlap implementation fake/test-only
  and label it so product runtime cannot import it. Semantic evidence choice
  remains a model call.
- **Typed errors / state:** `SearchUnavailable`, `SearchTimeout`,
  `SearchQueryInvalid`, `SearchCursorInvalid`; request is stateless and
  cancellation-safe.
- **Migration / compatibility / rollback:** compatibility-wrap synchronous test
  fixtures during one slice, then remove all production sync consumers. Rollback
  switches to the async fake service, not old product scoring.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/search test`,
  `rtk pnpm --dir packages/search typecheck`, `rtk pnpm check:knip`, and
  `rtk pnpm check:layer-boundaries`; the lane gate requires both async
  source/test files and a compile assertion that production consumers cannot use
  a synchronous API. Broad root typecheck and verification belong to tranche
  integration.
- **Completion receipt:** consumer inventory, compile failure/pass, fake/live
  contract parity, cancellation/timeout, and runtime import scan.
- **Lane branch / commit boundary:** branch `codex/brain-s09-async-search`;
  commit `refactor: make search asynchronous`.

### S09-T02 — Build Authorized Workspace Search Projections

- **Outcome / requirements:** satisfy KNW-03 and KNW-02; only active routed
  source/page revisions become searchable inside one Brain.
- **Classification:** `template-gap`; target `TB-ASYNC-SEARCH-01`; Convex
  full-text is the first adapter, vectors remain absent/optional.
- **Dependencies:** S09-T01.
- **Existing anchors:** the template backlog mentions a generic search/vector
  gap in
  [`porting-backlog.md`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/porting-backlog.md#L520-L523),
  but this product needs a workspace-scoped projection rather than direct vault
  indexing.
- **Files:** create
  `packages/convex/confect/tables/workspaceSearchProjections.ts`,
  `packages/convex/confect/search/projections.spec.ts`,
  `packages/convex/confect/search/projections.impl.ts`,
  `packages/convex/confect/search/projectionWriter.ts`,
  `packages/convex/confect/search/convexSearch.ts`, and
  `packages/convex/test/search-projections.test.ts`; modify
  `packages/convex/confect/sources/policyDispatch.ts`,
  `packages/convex/confect/brain/revisions.ts`,
  `packages/convex/confect/lifecycle/propagation.ts`,
  `packages/convex/confect/internal/migrations.ts`, and
  `docs/product/maestro-brain-lifecycle-adoption/S09-T02.md`.
- **Failure-first tests:** organization-vault-only source, inactive/revoked/
  redacted route, wrong workspace/org, stale projection generation, duplicate
  effect, edit/delete, page restore, route revocation, and cross-client query.
- **Implementation:** commit projection only after active authorized route/page
  revision. Store exact revision, projection version, route/policy/lifecycle
  generations, searchable text, active/redacted state, and unique effect key.
  Define a Convex search index filtered by organization/workspace/active/kind.
  Authorization is resolved before query; every returned candidate is rechecked
  against current generations.
- **Typed errors / state:** projection is `pending -> active`;
  `active -> inactive | redacted`; `inactive | redacted -> purged`. Errors are
  `ProjectionStale`, `RouteInactive`, `LifecycleRevoked`, `TenantMismatch`,
  `DuplicateEffect`.
- **Migration / compatibility / rollback:** backfill active pages/routes in
  bounded batches after dry-run counts; do not index vault-only source. Rollback
  disables the live adapter and deactivates new projections; reads use exact
  page/source APIs.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test search-projections`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:schema-migration-notes`, `rtk pnpm check:access-audit-events`,
  `rtk pnpm check:confect-contracts`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** projection/index inventory, backfill counts, vault-
  exclusion proof, revoke/delete behavior, and authorization-before-query trace.
- **Lane branch / commit boundary:** branch
  `codex/brain-s09-search-projections`; commit
  `feat: index authorized Brain projections`.

### S09-T03 — Add Shared Page/Source/Context Reads And Immutable Retrieval Receipts

- **Outcome / requirements:** satisfy KNW-04, HLS-02, IAM-03; web now and
  headless later consume one stable, authorized read contract.
- **Classification:** `pattern-instance`; dry-run then generate
  `rtk pnpm template:add-capability -- --name brainContextRead --description "Reads stable pages, sources, search candidates, and bounded Brain context." --exposure headless --write`,
  then replace its single starter operation with the six reviewed read
  operations in Appendix F. S09-T03 exclusively owns this `brainContextRead`
  scaffold and those six operations; S09-T04 exclusively owns the generated
  `askBrain` scaffold and seventh operation. Together those two scaffold-first
  slices own all seven registry inputs before S11-T03 assembles them without
  rerunning either generator. Run the exact
  `docs/template/how-to-add-capability.md` follow-up gates.
- **Dependencies:** S09-T02 and S02.
- **Existing anchors:** current Brain list is web-only while `createMarkdown` is
  incorrectly headless in
  [`pages.spec.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/brain/pages.spec.ts#L52-L99);
  generated MCP descriptors come from manifest metadata
  ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/manifest/mcp.ts#L17-L25)).
- **Files:** the generator dry-run enumerates/hashes the generated
  brainContextRead target; modify `packages/convex/confect/brain/pages.spec.ts`,
  `packages/convex/confect/brain/pages.impl.ts`; create
  `packages/convex/confect/tables/retrievalReceipts.ts`,
  `packages/convex/confect/retrieval/manifest.ts`,
  `packages/convex/confect/retrieval/reads.ts`, and
  `packages/convex/test/brain-context-read.test.ts`; update
  `docs/product/maestro-brain-lifecycle-adoption/S09-T03.md` and generated
  manifests.
- **Failure-first tests:** signed-out/wrong role, caller tenant/Convex fields,
  vault-only/inactive/redacted source, stale route/lifecycle generation,
  candidate outside immutable manifest, oversized context, and manifest hash
  mismatch.
- **Implementation:** implement `brain.pages.list/get/history`,
  `brain.sources.search/get`, and `brain.context.get`. Principal supplies no
  tenant args; adapter injects current Brain. Return stable keys, `asOf`,
  freshness/watermarks, exact citations, and bounded content. Persist the query
  hash, normalized filter manifest/hash, immutable retrieval candidate manifest,
  generations, and canonical manifest hash before any answer model. The receipt
  never stores raw query text.
- **Typed errors / state:** `Unauthorized`, `Forbidden`, `PageNotFound`,
  `SourceNotFound`, `SourceRedacted`, `ContextLimitExceeded`,
  `RetrievalManifestStale`, `LifecycleRevoked`; receipt
  `assembled -> consumed | stale | revoked`.
- **Migration / compatibility / rollback:** additive receipt table and read
  contracts. Keep web adapter compatibility through S11; rollback disables
  headless metadata while web reads remain generated-ref based.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name brainContextRead --description "Reads stable pages, sources, search candidates, and bounded Brain context." --exposure headless`,
  `rtk pnpm template:add-capability -- --name brainContextRead --description "Reads stable pages, sources, search candidates, and bounded Brain context." --exposure headless --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-context-read retrieval`,
  `rtk pnpm check:confect-contracts`,
  `rtk pnpm check:headless-surface-contract`,
  `rtk pnpm check:access-audit-events`, broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** operation schemas, role/cross-tenant/redaction tests,
  immutable manifest/hash, stable response examples, and generated surface diff.
- **Lane branch / commit boundary:** branch `codex/brain-s09-context-reads`;
  commit `feat: add stable Brain context reads`.

### S09-T04 — Implement Cited Ask With Abstention And Final Reauthorization

- **Outcome / requirements:** satisfy KNW-04, AI-04, HLS-02, UI-01; Web Ask
  returns claim-level citations or typed insufficient evidence.
- **Classification:** `pattern-instance`; generate
  `rtk pnpm template:add-capability -- --name askBrain --description "Answers from an immutable authorized retrieval manifest with citations or abstention." --exposure headless --write`
  and publish operation ID `brain.answers.ask`; run the focused gates from
  `docs/template/how-to-add-capability.md`.
- **Dependencies:** S09-T03 and S08-T01.
- **Existing anchors:** the pinned template isolates model calls behind the
  provider-neutral
  [`llm.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/llm.ts#L1-L117)
  seam. Search supplies candidates only; the model, not local weights or keyword
  trees, chooses evidence through S08's shared gateway.
- **Files:** the generator dry-run enumerates/hashes the generated askBrain
  target; create `packages/convex/confect/answers/gather.ts`,
  `packages/convex/confect/answers/request.ts`,
  `packages/convex/confect/answers/validate.ts`,
  `packages/convex/confect/answers/deliver.ts`,
  `packages/convex/test/brain-ask.test.ts`,
  `apps/web/src/features/brain/ask-dialog.tsx`,
  `apps/web/src/features/brain/ask-dialog.test.tsx`,
  `apps/web/src/features/brain/ask-adapter.ts`, and
  `apps/web/src/features/brain/ask-adapter.test.ts`; modify
  `packages/convex/confect/tables/retrievalReceipts.ts`,
  `docs/product/maestro-brain-lifecycle-adoption/S09-T04.md`, and
  `apps/web/src/features/brain/brain-workspace.tsx`.
- **Failure-first tests:** evidence question, no-evidence abstention, citation
  outside manifest, claim without citation, stale role/route/lifecycle after
  model response, model memory answer, prompt injection, multilingual question,
  budget/timeout, and duplicate attempt.
- **Implementation:** authorize first, run explicit read/search tools under
  server-bound Brain scope, pin candidate manifest, call answer model, validate
  structured claims/citations or `insufficient_evidence`, then re-resolve
  principal role and every generation immediately before return. Record receipt
  and accepted answer hash; never return stale content.
- **Typed errors / state:** answer
  `gathering -> manifest_pinned -> model_running`;
  `model_running -> cited_answer | insufficient_evidence | retryable_failure`;
  both content results must pass `reauthorized -> returned`, or terminate as
  `stale_authorization | revoked`. Errors are `CitationRequired`,
  `CitationNotInManifest`, `InsufficientEvidence`, `RetrievalManifestStale`, and
  the typed `Model*` errors.
- **Migration / compatibility / rollback:** additive receipt fields. Feature
  flag Ask off if eval threshold is red; exact reads remain. Rollback does not
  alter source/pages.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name askBrain --description "Answers from an immutable authorized retrieval manifest with citations or abstention." --exposure headless`,
  `rtk pnpm template:add-capability -- --name askBrain --description "Answers from an immutable authorized retrieval manifest with citations or abstention." --exposure headless --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test ask-brain`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test ask`,
  `rtk pnpm check:headless-surface-contract`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:layer-boundaries`,
  `rtk host-test-slot --class focused pnpm --dir tooling/evals test answers`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** cited/abstention examples, final-auth race, injection/
  multilingual results, duplicate attempts/one accepted receipt, UI states, and
  no local semantic heuristic scan.
- **Lane branch / commit boundary:** branch `codex/brain-s09-ask`; commit
  `feat: answer from cited Brain context`; final S09 checkpoint.

---

## S10 — Slack Identity, Mention/DM Intake, Scope Selection, And Private Delivery

### S10-T01 — Link Exact Slack Users To Current Maestro Users

- **Outcome / requirements:** satisfy SLK-09 and IAM-04; no display-name/email
  inference can authorize Slack reads.
- **Classification:** `template-gap`; target `TB-NANGO-SLACK-01`;
  product-specific identity-binding capability over existing WorkOS users.
- **Dependencies:** S04 and S09 complete.
- **Existing anchors:** Nango authenticates Maestro to Slack, not Slack humans
  to Maestro. Existing user identity is WorkOS subject-based in
  [`tenancySchemas.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/tenancySchemas.ts#L37-L45).
- **Files:** create `packages/convex/confect/tables/slackIdentityBindings.ts`,
  `packages/convex/confect/slack/identityLinks.spec.ts`,
  `packages/convex/confect/slack/identityLinks.impl.ts`,
  `packages/convex/confect/slack/identityLink.ts`,
  `packages/convex/test/slack-identity-links.test.ts`,
  `apps/web/src/features/settings/slack-link-adapter.ts`,
  `apps/web/src/features/settings/slack-link-adapter.test.ts`,
  `apps/web/src/features/settings/slack-link-button.tsx`,
  `apps/web/src/features/settings/slack-link-button.test.tsx`,
  `apps/web/src/features/settings/slack-link-status.tsx`, and
  `apps/web/src/features/settings/slack-link-status.test.tsx`; modify
  `packages/convex/confect/internal/migrations.ts` and
  `docs/product/maestro-brain-lifecycle-adoption/S10-T01.md`.
- **Failure-first tests:** forged/replayed/expired link token, wrong team/user,
  display-name/email match, binding identity already linked to another active
  user, revoked WorkOS user/membership, stale connection generation, and token
  logging.
- **Implementation:** authenticated user creates short-lived single-use link
  intent bound to organization/team and nonce hash; Slack interaction confirms
  exact `teamId + slackUserId`; backend consumes once and records binding
  generation/verified time. Revoke the organization-scoped binding on user
  request, organization-membership/user suspension, or connection replacement.
  Removing one workspace membership only revokes that Brain's access through the
  current role generation; it does not unlink the Slack identity from other
  authorized Brains. Every request rechecks binding and current Brain role.
- **Typed errors / state:**
  `unlinked -> pending_verification -> active -> revoked`; `LinkExpired`,
  `LinkReplay`, `SlackIdentityAlreadyBound`, `TeamMismatch`, `BindingRevoked`,
  auth errors.
- **Migration / compatibility / rollback:** new table. Rollback revokes active
  Slack answering while keeping audit rows; capture is unaffected.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-identity-links`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test slack-identity`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:access-audit-events`, `rtk pnpm check:logging-boundary`,
  `rtk pnpm check:secret-canaries`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** link/replay/spoof/revocation matrix, exact binding
  metadata sample, role recheck, and no-secret log result.
- **Lane branch / commit boundary:** branch `codex/brain-s10-slack-identity`;
  commit `feat: link Slack users to Maestro`.

### S10-T02 — Capture Mentions/DMs And Select Only An Authorized Brain Scope

- **Outcome / requirements:** satisfy SLK-08, SLK-09, ZFC-01, HLS-02; webhook
  ACK is fast, and any ambiguous semantic Brain selection is an explicit closed
  model call over authorized Brains.
- **Classification:** `pattern-instance`; run
  `rtk pnpm template:add-capability -- --name selectAuthorizedBrainScope --description "Selects zero or one authorized Brain for a verified Slack requester." --exposure workflow --write`;
  the generated target follows `docs/template/how-to-add-capability.md`, and the
  thin transport remains tracked by `TB-NANGO-SLACK-01`.
- **Dependencies:** S10-T01 and S09-T04.
- **Existing anchors:** Vercel's pinned Slackbot shows useful thread/mention
  behavior in
  [`slack-utils.ts`](https://github.com/vercel-labs/ai-sdk-slackbot/blob/7d84809865ba4624a38eab4dd6dbb2aecc3758bc/lib/slack-utils.ts#L72-L107)
  and
  [`handle-app-mention.ts`](https://github.com/vercel-labs/ai-sdk-slackbot/blob/7d84809865ba4624a38eab4dd6dbb2aecc3758bc/lib/handle-app-mention.ts#L29-L56),
  but its static token client must not be copied.
- **Files:** the generator dry-run enumerates/hashes the generated
  selectAuthorizedBrainScope capability target; create
  `packages/convex/confect/slack/intake.spec.ts`,
  `packages/convex/confect/slack/intake.impl.ts`,
  `packages/convex/confect/slack/answerJobs.ts`,
  `packages/convex/confect/slack/scopeSelection.ts`, and
  `packages/convex/test/slack-intake.test.ts`; modify
  `packages/convex/confect/slack/webhook.impl.ts`,
  `packages/convex/confect/tables/sourceProcessingJobs.ts`,
  `docs/product/maestro-brain-lifecycle-adoption/S10-T02.md`, and generated
  manifests.
- **Failure-first tests:** Slack Connect mention, unbound/revoked user,
  bot/non-user event, Direct channel without viewer role, ambiguous DM,
  cross-org/free-text client, out-of-authorized-set model result, replay, ACK
  waiting on model, and injection in question/thread.
- **Implementation:** verified event persists/dedupes answer intent and ACKs.
  Worker loads exact binding/current accessible Brains. Direct internal channel
  resolves its one target mechanically then checks viewer. DM free text invokes
  closed scope-selection model over authorized stable descriptors; interactive
  picker selection is mechanical. Result is one Brain or `needs_clarification`;
  handler has no matching heuristics or Ask prompt.
- **Typed errors / state:** answer job is
  `received -> scope_required | scoped | denied`;
  `scope_required -> scoped | needs_clarification | denied`;
  `scoped -> answering`; and
  `answering -> outbox_pending | abstained | retry_wait | superseded`;
  `SlackBindingRequired`, `DeliveryNotAllowed`, `BrainAccessDenied`,
  `ScopeNotAllowed`, `NeedsClarification`, model errors.
- **Migration / compatibility / rollback:** additive answer jobs. Rollback stops
  answer-job claims; capture continues. Pending mentions receive a generic
  requester-private unavailable response only through the outbox after T03.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name selectAuthorizedBrainScope --description "Selects zero or one authorized Brain for a verified Slack requester." --exposure workflow`,
  `rtk pnpm template:add-capability -- --name selectAuthorizedBrainScope --description "Selects zero or one authorized Brain for a verified Slack requester." --exposure workflow --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-intake scope-selection`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test webhook-ack-timing`,
  `rtk pnpm check:workflow-graph-boundary`,
  `rtk pnpm check:headless-surface-contract`, `rtk pnpm check:layer-boundaries`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** direct/DM/clarification flows, Slack Connect denial,
  spoof/replay/auth results, ACK latency, injection fixture, no matcher scan.
- **Lane branch / commit boundary:** branch `codex/brain-s10-slack-intake`;
  commit `feat: authorize Slack answer intake`.

### S10-T03 — Add A Fenced Outbox And Requester-Private Slack Delivery

- **Outcome / requirements:** satisfy SLK-08, SLK-09, KNW-04; authorize again
  before send, use at-most-once ephemeral delivery, and never convert an unknown
  provider outcome into a blind retry.
- **Classification:** `template-gap`; target `TB-NANGO-SLACK-01`; reuse Nango's
  ephemeral send action behind the shared outbox.
- **Dependencies:** S10-T02.
- **Existing anchors:** Nango already implements `chat.postEphemeral` with user
  and optional thread timestamp in
  [`send-ephemeral-message.ts`](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/actions/send-ephemeral-message.ts#L4-L35).
- **Files:** create `packages/convex/confect/tables/outboundDeliveryOutbox.ts`,
  `packages/convex/confect/slack/outbox.spec.ts`,
  `packages/convex/confect/slack/outbox.impl.ts`,
  `packages/convex/confect/slack/deliveryPolicy.ts`,
  `packages/convex/confect/slack/sanitizeSlack.ts`,
  `packages/convex/test/slack-outbox.test.ts`,
  `packages/integrations/src/nango/slackSend.ts`,
  `packages/integrations/src/nango/slackSend.test.ts`,
  `packages/integrations/src/nango/slackReconcile.ts`, and
  `packages/integrations/src/nango/slackReconcile.test.ts`; modify
  `packages/convex/confect/answers/deliver.ts`,
  `packages/convex/confect/lifecycle/propagation.ts`, and
  `packages/convex/confect/jobs/slackRateBudget.ts`.
- **Failure-first tests:** Slack Connect destination, wrong user/channel/team,
  role/binding/route/lifecycle revoked after answer, mass mention/unsafe link,
  Slack timeout before/after accepted ephemeral/DM send, forbidden retry of an
  ambiguous ephemeral, duplicate worker, rate limit, self-authored event loop,
  and DM to different user.
- **Implementation:** before the provider call, persist the exact sanitized
  payload bytes, payload schema/render version, payload hash, requester,
  audience, destination, answer/retrieval receipt keys, authorization
  generations, lifecycle generation, and unique effect key. The payload is an
  encrypted lifecycle-bound content field on the outbox, not audit/receipt
  metadata. Logs, audits, and completion receipts contain only its hash, size,
  schema version, and status. Retry sends the persisted bytes and never
  rerenders from mutable answer or page state. Reauthorize immediately before
  send. Internal channel uses ephemeral requester/thread; DM uses exact verified
  user. Persist Slack timestamp/response hash. On ambiguous timeout, an
  ephemeral row stops terminally at `ambiguous_no_retry` because Slack cannot
  read ephemeral history. Operators may mark the receipt observed but cannot
  resend it; the requester may create a new answer request/effect. DM retries
  are enabled only when the selected Nango action proves a stable idempotency or
  reconciliation contract; otherwise DM ambiguity is also terminal.
- **Typed errors / state:** `pending -> authorized -> sending`, then
  `sending -> delivered | retry_wait | ambiguous_no_retry | denied | revoked | dead_letter`;
  `DeliveryAudienceDenied`, `StaleAuthorization`, `ProviderRateLimited`,
  `AmbiguousProviderOutcome`, `PayloadUnsafe`.
- **Migration / compatibility / rollback:** new outbox. Rollback stops sends but
  preserves pending rows and accepted answer receipts. Never bypass outbox for a
  direct provider retry.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-outbox`,
  `rtk host-test-slot --class focused pnpm --dir packages/integrations test slack-send`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:provider-boundary`,
  `rtk pnpm check:access-audit-events`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test slack-outbox ambiguous-send crash`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** audience matrix, final-auth race, sanitize fixtures,
  terminal ambiguous-ephemeral proof, DM idempotency/reconciliation evidence or
  terminal ambiguity, self-event suppression, and redacted logs.
- **Lane branch / commit boundary:** branch `codex/brain-s10-slack-outbox`;
  commit `feat: deliver private Slack answers`.

### S10-T04 — Complete Slack Linking, Clarification, Delivery, And Recovery UX

- **Outcome / requirements:** satisfy SLK-08, SLK-09, UI-04, REL-03 with a
  usable and auditable Slack experience.
- **Classification:** `template-gap`; target `TB-NANGO-SLACK-01` plus
  `TB-BRAIN-UI-01`; promote the Slack recovery UX after provider/audience gates.
- **Dependencies:** S10-T03.
- **Existing anchors:** the pinned notification center consumes generated
  `ops.notifications` refs and preferences in
  [`notification-center-surface.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/features/notifications/notification-center-surface.tsx#L17-L43).
  Connections and Settings are product routes from S03/S04.
- **Files:** create `apps/web/src/features/settings/slack-link-status.tsx`,
  `apps/web/src/features/settings/slack-link-status.test.tsx`,
  `apps/web/src/features/brain/slack-scope-picker.tsx`,
  `apps/web/src/features/brain/slack-scope-picker.test.tsx`,
  `apps/web/src/features/connections/slack-answer-status.tsx`,
  `apps/web/src/features/connections/slack-answer-status.test.tsx`,
  `apps/web/src/features/connections/outbox-detail.tsx`,
  `apps/web/src/features/connections/outbox-detail.test.tsx`, and
  `docs/product/maestro-brain-slack-recovery.md`; modify
  `packages/convex/confect/ops/notifications.spec.ts` and
  `packages/convex/confect/ops/notifications.impl.ts`.
- **Failure-first tests:** expired link recovery, ambiguous DM picker, denied
  Brain, revoked binding/key while dialog open, ambiguous delivery admin action,
  viewer/admin UI visibility, accessibility, and no client text in
  notifications.
- **Implementation:** show exact team/account/link generation, revoke/relink,
  private-delivery promise, and Slack Connect capture-only badge. Clarification
  offers only currently authorized Brains. Admin outbox view shows status,
  hashes/counts/redacted errors, retry/reconcile actions; never raw payload.
- **Typed contract / state:** UI mirrors binding/answer/outbox states from T01-
  T03 and treats `ambiguous_no_retry` as unresolved/terminal, never delivered or
  operator-retryable.
- **Migration / compatibility / rollback:** no migration. UI rollback hides
  actions; server kill switch stops intake/send independently.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test slack-answer-recovery accessibility visual`,
  `rtk host-test-slot --class focused pnpm --dir packages/notifications test`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:access-audit-events`;
  external-only acceptance: provider sandbox end-to-end; broad verification is
  deferred to tranche acceptance under Appendix L.
- **Completion receipt:** full signed-in/link/mention/DM/clarify/deliver/revoke
  walkthrough, screenshots, provider timestamps, audience assertion, and
  recovery drill.
- **Lane branch / commit boundary:** branch `codex/brain-s10-slack-ux`; commit
  `feat: complete private Slack Q&A`; final S10 checkpoint.

---

## S11 — Service Principals, Secure Headless Dispatch, Read API, And MCP

### S11-T01 — Add Human-Authorized One-Brain API Key CRUD And Service Principals

- **Outcome / requirements:** satisfy HLS-01, IAM-04, KNW-02; only current Brain
  admins create display-once, read-only, expiring keys with viewer ceiling.
- **Classification:** `template-gap`; target `TB-HEADLESS-01` plus
  existing-module repair; extend crypto/table primitives into authenticated
  Confect capabilities.
- **Dependencies:** S09 complete.
- **Existing anchors:** current helpers define hashed/scoped/expiring keys and
  constant-time verification in
  [`headless/auth.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/headless/auth.ts#L9-L38)
  and
  [`headless/auth.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/headless/auth.ts#L109-L196),
  but no authenticated CRUD exists.
- **Files:** modify `packages/convex/confect/headless/auth.ts`,
  `packages/convex/confect/tables/apiKeys.ts`,
  `packages/convex/confect/internal/migrations.ts`, and
  `docs/product/maestro-brain-lifecycle-adoption/S11-T01.md`; create
  `packages/convex/confect/tables/servicePrincipals.ts`,
  `packages/convex/confect/headless/apiKeys.spec.ts`,
  `packages/convex/confect/headless/apiKeys.impl.ts`,
  `packages/convex/test/api-keys.test.ts`,
  `apps/web/src/features/settings/api-keys.tsx`, and
  `apps/web/src/features/settings/api-keys.test.tsx`.
- **Failure-first tests:** viewer/editor creation, wrong Brain, requested write/
  admin/workflow scope, role above viewer, plaintext persistence, second
  display, no expiry/overlong expiry, revoked creator/member/Brain/org,
  duplicate name, rotation/revoke race, and key minting another key.
- **Implementation:** use scopes only `brain:read` and optional `brain:ask`;
  service principal binds organization/workspace/brain stable key, viewer
  ceiling, principal/revocation generations, created-by, expiry. Generate
  256-bit secret, show once, store hash/prefix only, list metadata,
  revoke/rotate by Brain admin. Key calls never inherit creator session or
  permissions.
- **Typed errors / state:** principal/key `active -> expired | revoked`;
  `ApiKeyScopeInvalid`, `ApiKeyExpiryInvalid`, `ApiKeyNotFound`,
  `ApiKeyRevoked`, `ApiKeyExpired`, `ServicePrincipalRevoked`, auth errors.
- **Migration / compatibility / rollback:** migrate any template demo keys to
  disabled legacy state; no legacy key authenticates V1. Rollback revokes newly
  issued keys and hides UI; never restore plaintext.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test headless-auth api-keys`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test api-keys`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:access-audit-events`, `rtk pnpm check:secret-canaries`,
  `rtk pnpm check:headless-surface-contract`, broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** full role/scope/expiry/revoke/rotation table,
  display-once proof, database secret canary, service-principal row, audit
  events.
- **Lane branch / commit boundary:** branch `codex/brain-s11-api-keys`; commit
  `feat: issue read-only Brain keys`.

### S11-T02 — Resolve Bearer Principals Before Decoding Or Dispatching Requests

- **Outcome / requirements:** satisfy HLS-01, HLS-02, IAM-03; all headless
  requests derive tenant/Brain from verified bearer state and fail closed.
- **Classification:** `template-gap`; target `TB-HEADLESS-01`; repair the
  existing HTTP request helper and executor.
- **Dependencies:** S11-T01.
- **Existing anchors:** the current request helper accepts caller tenant fields
  and contains a demo slug map in
  [`httpRequest.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/httpRequest.ts#L6-L10)
  and
  [`httpRequest.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/httpRequest.ts#L40-L56).
- **Files:** modify `packages/convex/confect/httpRequest.ts`,
  `packages/convex/confect/http.ts`,
  `packages/convex/confect/manifest/executor.ts`,
  `packages/convex/confect/headless/auth.ts`,
  `packages/convex/confect/headless/errorEnvelope.ts`,
  `packages/convex/test/headless-auth.test.ts`, and
  `packages/convex/test/headless-executor.test.ts`; create
  `packages/convex/confect/headless/principal.ts`,
  `packages/convex/confect/headless/authorizeOperation.ts`, and
  `packages/convex/test/http-request-security.test.ts`.
- **Failure-first tests:** missing/malformed/header-in-URL key, tenant fields,
  wrong scope/Brain, revoked/expired key/principal/Brain/org, changed
  generation, unknown operation, operation not headless, payload
  decoded/provider called before auth, timing-safe not-found/revoked behavior,
  and raw header logging.
- **Implementation:** parse Authorization header only; hash and indexed lookup;
  resolve active key/principal/org/workspace/Brain/generations; authorize
  required manifest scope; inject internal IDs/stable Brain; only then decode
  tool args and call generated ref. Reject
  organization/workspace/brain/user/Convex ID fields at schema boundary. Update
  last-used asynchronously without changing authorization result.
- **Typed errors / state:** uniform external
  `Unauthorized | Forbidden | ValidationFailed | RateLimited`; internal reason
  codes remain redacted audit metadata. Request state
  `received -> authenticated -> authorized -> decoded -> dispatched -> reauthorized -> returned`.
- **Migration / compatibility / rollback:** remove demo map and caller workspace
  support in one contract deploy. No compatibility fallback. Rollback disables
  headless routes rather than accepting legacy tenant args.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test headless http-request`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:headless-surface-contract`,
  `rtk pnpm check:confect-contracts`, `rtk pnpm check:logging-boundary`,
  `rtk pnpm check:secret-canaries`, `rtk pnpm check:access-audit-events`, broad
  verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** auth-before-decode/provider trace, field rejection,
  revocation matrix, error envelopes, no-header log proof, and demo-map removal.
- **Lane branch / commit boundary:** branch
  `codex/brain-s11-headless-principal`; commit
  `feat: derive headless Brain principals`.

### S11-T03 — Expose Only The Reviewed Read And Ask Capability Registry

- **Outcome / requirements:** satisfy HLS-02 and HLS-03; API/CLI/MCP registry
  contains exactly the seven V1 operations and no write/cognition/admin
  controls.
- **Classification:** `template-gap`; target `TB-HEADLESS-01`. The capability
  generators are owned exclusively by S09-T03 (`brainContextRead`, six reads)
  and S09-T04 (`askBrain`, one Ask operation); no generator scaffolds this
  cross-surface registry integration, so do not rerun either generator here.
  Assemble the seven reviewed inputs and promote the reusable registry wiring
  through the backlog path after manifest/headless parity gates pass.
- **Dependencies:** S11-T02 and S09-T04.
- **Existing anchors:** MCP descriptors are generated from Confect metadata in
  [`manifest/mcp.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/manifest/mcp.ts#L17-L25);
  current CLI is a static demonstration and must call the shared dispatcher.
- **Files:** modify `packages/convex/confect/brain/pages.spec.ts`,
  `packages/convex/confect/brain/pages.impl.ts`,
  `packages/convex/confect/manifest/executor.ts`,
  `packages/convex/confect/manifest/mcp.ts`,
  `packages/convex/confect/manifest/openapi.ts`, `apps/cli/src/index.ts`, and
  `apps/cli/src/index.test.ts`; create
  `packages/convex/test/headless-surface-parity.test.ts` and
  `apps/cli/src/headless-security.test.ts`. Generated capability and manifest
  output is integration-owned and enumerated by the named dry-run manifest; the
  isolated lane never commits that output:
  `docs/superpowers/receipts/maestro-brain/file-inventories/S11-T03-headless-generated-files.json`.
- **Failure-first tests:** exact allowlist mismatch,
  write/admin/workflow/capture/ generic-prompt tool exposure, schema drift among
  API/CLI/MCP, caller tenant field, Convex ID response, final reauthorization
  race, and scope mismatch.
- **Implementation:** registry exactly `brain.pages.list`, `brain.pages.get`,
  `brain.pages.history`, `brain.sources.search`, `brain.sources.get`,
  `brain.context.get`, `brain.answers.ask`. Map first six to `brain:read`, Ask
  to `brain:ask`. API/CLI/MCP call the same executor and generated refs. CLI
  accepts endpoint/key via secure environment/stdin, never command-line URL key.
- **Typed contract / errors:** use Appendix F schemas and one sanitized error
  envelope with request ID; all responses include stable `brainKey`, `asOf`,
  freshness; Ask includes retrieval receipt/citations.
- **Migration / compatibility / rollback:** generated manifest change only.
  Remove old `createMarkdown` headless exposure and static CLI response in the
  same slice. Rollback disables the registry rather than re-exposing writes.
- **Focused verification:** `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk pnpm check:headless-surface-contract`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test headless-surface-parity`,
  `rtk host-test-slot --class focused pnpm --dir apps/cli test headless-security`,
  `rtk pnpm check:confect-contracts`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** exact registry diff, schema hash parity across four
  projections, negative tool list, final-auth race, stable sample responses.
- **Lane branch / commit boundary:** branch `codex/brain-s11-read-registry`;
  commit `feat: publish Brain read contracts`.

### S11-T04 — Implement Stateless Streamable HTTP MCP And Copyable Client Config

- **Outcome / requirements:** satisfy HLS-03, HLS-01, HLS-02; Claude Code and
  compatible clients can securely use one remote Brain without a session server.
- **Classification:** `template-gap`; target `TB-HEADLESS-01`; extend the
  generated manifest into a deployable protocol transport.
- **Dependencies:** S11-T03.
- **Existing anchors:** the pinned HTTP composition root is
  [`http.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/http.ts#L1-L293);
  it has generated descriptors but no MCP server and must remain the external
  routing root.
- **Files:** create `packages/convex/confect/headless/mcpProtocol.ts`,
  `packages/convex/confect/headless/mcpHttp.ts`,
  `packages/convex/test/mcp-http.test.ts`; modify
  `packages/convex/confect/http.ts`, `packages/convex/convex/http.ts`,
  `packages/convex/confect/headless/errorEnvelope.ts`, and
  `packages/convex/confect/headless/securityHeaders.ts`; create
  `apps/web/src/features/settings/mcp-config.tsx` and
  `apps/web/src/features/settings/mcp-config.test.tsx`; update
  `docs/product/maestro-brain-deployment.md`, `docs/template/env-manifest.md`,
  `docs/template/env-manifest.json`, and
  `docs/product/maestro-brain-privacy-security.md`.
- **Failure-first tests:** non-POST/GET, no bearer, unsupported protocol
  version, wrong `Accept`/`Content-Type`, invalid JSON-RPC, notifications,
  oversized body/batch, timeout/cancel, unknown tool, disallowed Origin/CORS,
  Host mismatch, cookies/ambient credentials, token/IP rate limits, concurrent
  limit, and payload/header logging.
- **Implementation:** HTTPS `POST /mcp` only; stateless request/response; bearer
  every call; auth/rate/Brain resolve before argument decode; strict
  JSON-RPC/MCP version and manifest tool schema; body/batch/timeout limits; deny
  browser Origin/CORS by default; security headers/request ID; GET returns 405;
  no SSE, resume, cookies, notifications, or server sessions. Settings renders a
  ready-to-paste remote MCP config with endpoint and display-once key; never
  persists the displayed secret in browser storage.
- **Typed errors / state:** protocol error codes map to sanitized JSON-RPC
  errors; internal typed causes remain redacted. Each request is independent; no
  session state exists.
- **Migration / compatibility / rollback:** new route behind kill switch. First
  deploy with route disabled, run security smoke, enable pilot keys. Rollback
  disables route/revokes pilot principals; web/Slack remain.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test mcp-http protocol security`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test mcp-config`,
  `rtk pnpm check:headless-surface-contract`, `rtk pnpm check:confect-manifest`,
  `rtk pnpm check:route-tree`, `rtk pnpm check:env-boundary`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:secret-canaries`; the
  Confect manifest check is a zero-delta assertion because this task consumes
  S11-T03's registry and changes no manifest source registry; external-only
  acceptance: Claude Code sandbox connection and hosted smoke; broad
  verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** full negative matrix, protocol transcript with
  redacted key, exact tool list/schema hashes, origin/rate/timeout results,
  copy-config UX, route kill-switch drill.
- **Lane branch / commit boundary:** branch `codex/brain-s11-mcp-transport`;
  commit `feat: serve read-only Brain MCP`; final S11 checkpoint.

---

## S12 — Deterministic Export, Temporary Convex Storage, And Artifact Lifecycle

### S12-T01 — Build The Deterministic Stable-Key Export Codec

- **Outcome / requirements:** satisfy KNW-05 and IAM-03; identical authorized
  Brain state at one pinned revision produces byte-identical Markdown/JSON.
- **Classification:** `template-gap`; target `TB-BRAIN-EXPORT-01`; import only
  proven generic behavior from production Maestro into template-core.
- **Dependencies:** S07 and S11 complete.
- **Existing anchors:** production Maestro implements stable-path sorted
  Markdown/link rewriting in
  [`exports.ts`](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/packages/convex/convex/capabilities/brain/exports.ts#L27-L86),
  while the template has a Markdown/OKF codec in
  [`knowledge.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/template-core/src/knowledge.ts#L219-L250).
- **Files:** create `packages/template-core/src/brainExport.ts` and
  `packages/template-core/src/brainExport.test.ts`; modify
  `packages/template-core/src/index.ts`,
  `packages/template-core/src/knowledge.ts`, and
  `docs/product/maestro-brain-export.md`.
- **Failure-first tests:** shuffled input, repeated export, Unicode/newlines,
  duplicate sibling path, nested links, archived/redacted/purged source, missing
  citation, unsafe path, Convex ID/token/raw provider field, and timestamp
  nondeterminism.
- **Implementation:** encode exactly `manifest.json`, stable sorted
  `pages/<path>.md`, `sources/index.jsonl`, `citations/index.jsonl`,
  `revisions/pages.jsonl`, and `revisions/sources.jsonl`. Manifest pins format
  version, agency/brain stable keys, Brain revision, lifecycle/policy
  generations, file hashes, and deterministic created-at value supplied by the
  job receipt rather than ambient clock. Canonical JSON key/order/newline/UTF-8
  and stable Markdown links are explicit.
- **Typed errors / state:** pure codec returns bytes/file hashes or
  `ExportPathConflict`, `ExportReferenceMissing`, `ExportValueUnsafe`,
  `ExportLifecycleDenied`; it performs no auth/storage/provider calls.
- **Migration / compatibility / rollback:** new format
  `maestro-brain-export/v1`; no import path. Never change v1 bytes in place—add
  a new version. Rollback stops new exports; prior downloaded bundles remain
  valid and outside control.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/template-core test brainExport`,
  `rtk host-test-slot --class focused pnpm --dir packages/template-core test brainExport property golden`,
  `rtk pnpm check:secret-canaries`, `rtk pnpm check:headless-surface-contract`,
  `rtk pnpm check:provider-boundary`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** byte-identical hashes across shuffled/repeated runs,
  golden tree, redaction/path/link tests, schema/version manifest.
- **Lane branch / commit boundary:** branch `codex/brain-s12-export-codec`;
  commit `feat: encode deterministic Brain exports`.

### S12-T02 — Add Authorized Export Jobs And Temporary Convex Storage

- **Outcome / requirements:** satisfy KNW-05, IAM-04, KNW-02; only current Brain
  admins can request a lifecycle-fenced export, and artifacts expire/purge.
- **Classification:** `pattern-instance` capability generated with
  `rtk pnpm template:add-capability -- --name exportBrain --description "Creates a lifecycle-fenced deterministic Brain export." --exposure web --write`,
  with the focused gates from `docs/template/how-to-add-capability.md`; real
  object persistence remains tracked by backlog gap `TB-BRAIN-EXPORT-01`.
- **Dependencies:** S12-T01.
- **Existing anchors:** the pinned storage service exposes a signed-URL seam but
  no real object write/delete in
  [`index.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/storage/src/index.ts#L1-L103).
  V1 uses Convex storage rather than introducing R2 or a customer Git
  repository.
- **Files:** the generator dry-run enumerates/hashes the generated exportBrain
  target; create `packages/convex/confect/tables/brainExportJobs.ts`,
  `packages/convex/confect/brain/exports/gather.ts`,
  `packages/convex/confect/brain/exports/job.ts`,
  `packages/convex/confect/brain/exports/storage.ts`, and
  `packages/convex/test/brain-export-job.test.ts`; modify
  `packages/storage/src/index.ts`, `packages/storage/src/index.test.ts`,
  `packages/convex/confect/http.ts`,
  `packages/convex/confect/jobs/workpool.impl.ts`,
  `docs/product/maestro-brain-lifecycle-adoption/S12-T02.md`, and generated
  manifests.
- **Failure-first tests:** viewer/editor, archived Brain, stale role/route/
  lifecycle after gather, redacted/deleted source, duplicate idempotency key,
  partial write, oversized bundle, URL expiry, job retry, purge failure, and
  export operation appearing in API/MCP.
- **Implementation:** admin request writes job with pinned Brain/current page
  revisions, active routes, export policy/lifecycle generations, and effect key.
  Worker reauthorizes, gathers exact rows, encodes T01, writes one temporary
  Convex storage artifact, rechecks generations, publishes short-lived signed
  URL, records manifest/artifact hash and size, never raw text in audit. Failed
  partial objects are deleted. No external provider bucket is added.
- **Typed errors / state:**
  `requested -> gathering -> encoding -> storing -> ready -> expired -> purged`,
  with `revoked | failed` terminals; `ExportForbidden`, `ExportStale`,
  `ExportTooLarge`, `StorageUnavailable`, `ArtifactExpired`, `LifecycleRevoked`.
- **Migration / compatibility / rollback:** additive job table and storage
  adapter. Feature disabled until purge cron/job is proven. Rollback revokes
  download publication and purges temporary artifacts; downloaded copies cannot
  be recalled.
- **Focused verification:**
  `rtk pnpm template:add-capability -- --name exportBrain --description "Creates a lifecycle-fenced deterministic Brain export." --exposure web`,
  `rtk pnpm template:add-capability -- --name exportBrain --description "Creates a lifecycle-fenced deterministic Brain export." --exposure web --write`,
  `rtk pnpm brain:factory:check-confect-codegen`,
  `rtk host-test-slot --class focused pnpm --dir packages/template-core test brainExport`,
  `rtk host-test-slot --class focused pnpm --dir packages/storage test`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-export-job TestClock`,
  `rtk pnpm check:headless-surface-contract`,
  `rtk pnpm check:access-audit-events`, `rtk pnpm check:secret-canaries`,
  `rtk pnpm check:logging-boundary`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** role/final-auth races, job states, artifact/hash/size,
  expiring URL, partial cleanup, no-MCP exposure, and Convex storage proof.
- **Lane branch / commit boundary:** branch `codex/brain-s12-export-job`; commit
  `feat: generate authorized Brain exports`.

### S12-T03 — Add Export UI, Audit History, Expiry, And Purge Recovery

- **Outcome / requirements:** satisfy KNW-05, UI-04, REL-03 with clear lifecycle
  and downloaded-copy posture.
- **Classification:** `template-gap`; target `TB-BRAIN-EXPORT-01` plus
  `TB-BRAIN-UI-01`; promote the artifact-lifecycle UI after expiry/purge gates.
- **Dependencies:** S12-T02.
- **Existing anchors:** the pinned Settings surface already separates admin and
  viewer posture in
  [`settings-surface.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/features/settings/settings-surface.ts#L34-L87),
  while the lifecycle surface supplies the audited action pattern.
- **Files:** create `apps/web/src/features/settings/brain-exports.tsx`,
  `apps/web/src/features/settings/brain-exports.test.tsx`,
  `apps/web/src/features/settings/export-dialog.tsx`,
  `apps/web/src/features/settings/export-dialog.test.tsx`,
  `apps/web/src/features/settings/export-history.tsx`, and
  `apps/web/src/features/settings/export-history.test.tsx`; modify
  `apps/web/src/features/settings/settings-surface.ts`,
  `apps/web/src/features/settings/lifecycle-job-detail.tsx`,
  `packages/convex/confect/ops/notifications.spec.ts`,
  `packages/convex/confect/ops/notifications.impl.ts`, and
  `docs/product/maestro-brain-lifecycle-operations.md`.
- **Failure-first tests:** viewer/editor request denial, admin request/download,
  URL expired, lifecycle revoked while dialog open, failed/purge states,
  downloaded-copy disclaimer, duplicate click idempotency, and no source text in
  telemetry.
- **Implementation:** show format/content policy, pinned revision, estimated
  size, request progress, manifest hash, expiry, download, and purge status.
  Require confirmation that downloaded copies leave Maestro control. Admin may
  retry failed generation with a new attempt; purge retry does not regenerate.
- **Typed contract / state:** render exact T02 states; never label an export
  complete until object publish and final authorization succeed.
- **Migration / compatibility / rollback:** no data migration. UI rollback
  disables requests/downloads; server cleanup remains active.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test brain-export accessibility visual`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:access-audit-events`;
  external-only acceptance: staging artifact expiry/purge rehearsal; broad
  verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** request/download/expiry/purge walkthrough, role and
  final-auth denial, manifest hash, screenshots, telemetry canary.
- **Lane branch / commit boundary:** branch `codex/brain-s12-export-ui`; commit
  `feat: expose Brain export lifecycle`; final S12 checkpoint.

---

## S13 — Semantic Evals, Capacity, And Operational Controls

### S13-T01 — Build Frozen Semantic And Security Evaluation Suites

- **Outcome / requirements:** satisfy REL-01, AI-02, AI-03, AI-04, KNW-04; no
  model/prompt pair ships without versioned quality and safety evidence.
- **Classification:** `template-gap`; target `TB-EVALS-01`; extend the existing
  harness into a reproducible semantic-suite pattern without importing scorers
  into product runtime.
- **Dependencies:** S10, S11, S12 complete.
- **Existing anchors:** the pinned eval style lives in
  [`source-grounded-brief.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/evals/src/source-grounded-brief.ts#L1-L184);
  its keyword-based refusal scoring is test-harness behavior and must not enter
  product runtime.
- **Files:** create `tooling/evals/src/brain-classification.ts`,
  `tooling/evals/src/brain-classification.test.ts`,
  `tooling/evals/src/brain-answers.ts`,
  `tooling/evals/src/brain-answers.test.ts`,
  `tooling/evals/src/brain-maintenance.ts`,
  `tooling/evals/src/brain-maintenance.test.ts`,
  `tooling/evals/src/brain-prompt-injection.ts`,
  `tooling/evals/src/brain-prompt-injection.test.ts`,
  `tooling/evals/src/brain-multilingual.ts`,
  `tooling/evals/src/brain-multilingual.test.ts`,
  `tooling/evals/src/brain-eval-report.ts`,
  `tooling/evals/src/brain-eval-report.test.ts`,
  `tooling/evals/fixtures/maestro-brain/classification.jsonl`,
  `tooling/evals/fixtures/maestro-brain/answers.jsonl`,
  `tooling/evals/fixtures/maestro-brain/maintenance.jsonl`,
  `tooling/evals/fixtures/maestro-brain/prompt-injection.jsonl`,
  `tooling/evals/fixtures/maestro-brain/multilingual.jsonl`, and
  `tooling/evals/fixtures/maestro-brain/fixture-manifest.json`; modify
  `tooling/evals/package.json`, `tooling/evals/src/index.ts`, and
  `docs/product/maestro-brain-evals.md`.
- **Failure-first tests:** each suite fails against deliberately wrong fixtures:
  cross-client route, multi-target, unsupported claim, bad citation, no-evidence
  answer, uncited maintenance, tool/tenant/allowlist injection, and non-English
  synonym that defeats keyword logic.
- **Implementation:** immutable fixture IDs/hashes, train/dev/test separation,
  two-reviewer labels with adjudication, and the frozen Appendix J denominator/
  seed/repeat/95%-Wilson-lower-bound algorithm. Classification: >=90% agreement
  including no-route/mixed-client, 100% allowlist, zero cross-client commits.
  Answers: >=95% claim entailment, 100% locator resolution/redaction marker,
  with a no-evidence abstention threshold of `>=95%`. Maintenance requires 100%
  factual citation coverage and `>=80%` accepted without factual correction.
  Multilingual evaluation includes at least 74 cases per launch language and per
  thresholded language subgroup so a perfect observed rate can attain a `>=95%`
  two-sided Wilson lower bound. Injection/multilingual authorization invariants
  pass 100% in every subgroup and repeat.
- **Typed contract / state:** eval receipt
  `{ suiteVersion, fixtureHash, modelId, promptVersion, toolSchemaVersion, totals, metrics, failures, passed }`;
  model/prompt status `candidate -> evaluated -> approved | rejected`.
- **Migration / compatibility / rollback:** no product data migration. Fixture
  changes create a new suite version and require re-baseline review; never edit
  labels simply to pass. Rollback model/prompt to last approved receipt.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir tooling/evals test`,
  `rtk pnpm --dir tooling/evals brain:eval`,
  `rtk pnpm --dir tooling/evals brain:fixture-check`,
  `rtk pnpm check:provider-boundary`, broad verification is deferred to tranche
  acceptance under Appendix L.
- **Completion receipt:** frozen hashes, per-suite/model/prompt reports,
  intentional-red then green proof, failure examples, reviewer signoff.
- **Lane branch / commit boundary:** branch `codex/brain-s13-semantic-evals`;
  commit `test: add Brain semantic evals`.

### S13-T02 — Build And Pass The Declared Capacity/Fairness Harness

- **Outcome / requirements:** satisfy REL-02 and SLK-07 at the declared launch
  envelope before accepting equivalent customer configuration.
- **Classification:** `template-gap`; target `TB-SOURCE-01`; promote the
  deterministic multi-tenant source load harness after this product instance.
- **Dependencies:** S13-T01 and S06.
- **Existing anchors:** the pinned workpool fixture is deliberately small and
  deterministic in
  [`workpool.impl.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/jobs/workpool.impl.ts#L1-L38),
  while the repo has Vitest, fast-check, TestClock, and release tooling but no
  Brain capacity fixture.
- **Files:** create `tooling/evals/src/brain-capacity.ts`,
  `tooling/evals/src/brain-capacity.test.ts`,
  `tooling/evals/src/brain-capacity-fixture.ts`,
  `tooling/evals/src/brain-capacity-report.ts`, and
  `packages/convex/test/brain-capacity.test.ts`; modify
  `tooling/evals/package.json` and `docs/product/maestro-brain-capacity.md`.
- **Failure-first tests:** intentionally set shared cursor, concurrency 1 with
  unfair FIFO, dropped event, queue overflow, cross-Brain leak, and a second
  canary agency's cross-tenant key/read/commit/delivery attempts; harness must
  detect each.
- **Implementation:** deterministic loaded fixture: one agency, Agency Brain +
  25 clients, 100 channels (75 Direct/20 Classify/5 Capture-only), 100,000
  source revisions, 20 events/sec for 60 sec during backfill, and 10 concurrent
  Ask/MCP requests, plus one lightweight adversarial canary agency. Measure live
  p50/p95/p99, per-channel progress, queue depth, attempts/effects, rate waits,
  recent/deep progress, Ask latency, storage/model usage, and tenant-denial
  canaries. Use 60-second fairness windows; every runnable channel advances in
  every window or records an exact provider-rate block, and none misses two
  consecutive windows. At least 95% of live events are visible within 60
  seconds, all admitted events drain within five minutes, and loss/cross-tenant
  effects remain zero.
- **Typed contract / state:** capacity receipt pins code/config/fixture hashes,
  hardware/runner class, seeds, windows, drain deadline, metrics and pass/fail.
  Admission enforcement itself is owned by S04-T04/S06-T02; this task proves it.
- **Migration / compatibility / rollback:** no customer data. Raising limits
  requires a new passing receipt. Rollback selects the last passing capacity
  policy already enforced by S04/S06; never stop exact capture already admitted.
- **Focused verification:** `rtk pnpm --dir tooling/evals brain:capacity`,
  `rtk host-test-slot --class focused pnpm --dir tooling/evals test brain-capacity`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-capacity`,
  `rtk host-test-slot --class focused pnpm check:coverage-ratchet`, broad
  verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** fixture/config/runner hashes, latency/fairness/loss/
  isolation report, overload proof, cost/storage estimates, raw synthetic-only
  artifacts.
- **Lane branch / commit boundary:** branch `codex/brain-s13-capacity`; commit
  `test: prove Brain launch capacity`.

### S13-T03 — Add Redacted Telemetry, Budgets, And Kill Switches

- **Outcome / requirements:** satisfy REL-03, AI-04, SLK-07; operators can
  diagnose and stop each risky subsystem independently without viewing customer
  text or stopping exact capture unnecessarily.
- **Classification:** `template-gap`; target `TB-OPERATIONS-01`; compose the
  existing observability/flag/notification seams into a generic safe-operations
  pattern with no semantic local alert classifier.
- **Dependencies:** S13-T02.
- **Existing anchors:** the pinned template already exposes typed telemetry and
  redaction primitives in
  [`index.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/observability/src/index.ts#L1-L183)
  and notification persistence in
  [`index.ts`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/notifications/src/index.ts#L1-L388);
  extend those seams instead of a second operator platform.
- **Files:** create `packages/convex/confect/ops/brainOperations.spec.ts`,
  `packages/convex/confect/ops/brainOperations.impl.ts`,
  `packages/convex/confect/ops/brainOperationPolicy.ts`,
  `packages/convex/test/brain-operation-policy.test.ts`, and
  `packages/observability/src/brainMetrics.ts`, and
  `packages/observability/src/brainMetrics.test.ts`; modify
  `packages/observability/src/index.ts`,
  `packages/convex/confect/ops/flags.spec.ts`,
  `packages/convex/confect/ops/flags.impl.ts`,
  `tooling/quality/check-logging-boundary.mts`, and
  `docs/product/maestro-brain-operations.md`.
- **Failure-first tests:** prompt/source/token/header logging canaries; model
  spend/token/input cap; Slack rate/storage/queue/channel cap; kill switches for
  capture, backfill, classification, maintenance, Ask, Slack delivery, MCP,
  export, lifecycle execution; and stale operator role.
- **Implementation:** emit IDs/hashes/counts/durations/status/error tags only.
  Metrics cover connection/channel lag, queues/leases/dead letters, model spend
  and eval version, search projection lag, Ask abstention/errors, outbox
  ambiguity, lifecycle/export jobs, and capacity use. Kill switches are policy
  data with owner, reason, expiry, audit. Preserve independent controls:
  classification/model outage does not disable exact capture; deep history
  throttle does not stop live capture; lifecycle emergency revoke can override
  publication.
- **Typed errors / state:** operation policy `enabled -> paused -> enabled`,
  with emergency `disabled`; `OperatorForbidden`, `BudgetExceeded`,
  `SubsystemDisabled`, `RecoveryGenerationMismatch`.
- **Migration / compatibility / rollback:** additive policy/metric fields.
  Default risky external surfaces off until launch enablement. Rollback via kill
  switches first, code deploy second; retain audit/receipts.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-operation-policy`,
  `rtk host-test-slot --class focused pnpm --dir packages/observability test brainMetrics`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:secret-canaries`,
  `rtk pnpm check:access-audit-events`, broad verification is deferred to
  tranche acceptance under Appendix L.
- **Completion receipt:** metric dictionary, every kill-switch drill, canary
  result, budget enforcement, and redacted audit samples.
- **Lane branch / commit boundary:** branch `codex/brain-s13-operations`; commit
  `feat: operate Brain safely`.

### S13-T04 — Add Operations Dashboard, Alerts, And Recovery Drills

- **Outcome / requirements:** satisfy REL-03 with a narrow audited operator
  surface over S13-T03 metrics/policies, including alert dedupe and safe
  recovery.
- **Classification:** `template-gap`; target `TB-OPERATIONS-01`; the documented
  admin generator is not runnable, so promote the dashboard/alert/recovery
  pattern only after access, redaction, and rehearsal gates pass.
- **Dependencies:** S13-T03.
- **Existing anchors:** the pinned template health and notification surfaces are
  existing UI seams in
  [`health-surface.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/features/health/health-surface.tsx#L1-L151)
  and
  [`notification-center-surface.tsx`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/features/notifications/notification-center-surface.tsx#L17-L118),
  while operator authorization must continue through audited Confect
  capabilities rather than direct metric/provider access.
- **Files:** create `apps/web/src/features/health/brain-operations.tsx`,
  `apps/web/src/features/health/brain-operations.test.tsx`,
  `packages/convex/confect/ops/brainAlerts.spec.ts`,
  `packages/convex/confect/ops/brainAlerts.impl.ts`,
  `packages/convex/test/brain-alerts.test.ts`, and
  `docs/product/maestro-brain-recovery-runbook.md`; modify
  `apps/web/src/features/health/health-surface.tsx`,
  `apps/web/src/features/health/health-surface.test.tsx`,
  `packages/convex/confect/ops/notifications.spec.ts`,
  `packages/convex/confect/ops/notifications.impl.ts`, and
  `docs/product/maestro-brain-operations.md`.
- **Failure-first tests:** viewer/editor operator denial, stale admin role,
  customer-text metric canary, alert flood/dedupe, expired kill switch, recovery
  replay with wrong generation, and dashboard status disagreement with durable
  policy.
- **Implementation:** show only IDs/hashes/counts/durations/status/error tags;
  render the metric dictionary and exact policy state; dedupe alerts by
  subsystem/error/generation/window; recovery creates a new audited attempt and
  never edits prior receipts. Drill each kill switch independently and prove
  exact capture can remain live while semantic/deep/delivery surfaces pause.
- **Typed errors / state:** alert `open -> acknowledged -> resolved` with a new
  alert on recurrence; audited recovery attempt
  `planned -> running -> complete | failed | generation_mismatch`. Both machines
  are canonical Appendix G rows. Errors are `OperatorForbidden`, `AlertStale`,
  and `RecoveryGenerationMismatch`.
- **Migration / compatibility / rollback:** additive notification/alert fields.
  UI rollback hides controls; server policies remain authoritative and existing
  recovery attempts finish or fail under their generation fence.
- **Focused verification:**
  `rtk host-test-slot --class focused pnpm --dir apps/web test brain-operations`,
  `rtk host-test-slot --class focused pnpm --dir packages/convex test brain-alerts`,
  `rtk pnpm check:logging-boundary`, `rtk pnpm check:access-audit-events`,
  `rtk host-test-slot --class focused pnpm --dir apps/web test accessibility`,
  broad verification is deferred to tranche acceptance under Appendix L.
- **Completion receipt:** role/redaction screenshots, alert dedupe timeline,
  every kill-switch/recovery drill, exact-capture continuity, and audit samples.
- **Lane branch / commit boundary:** branch `codex/brain-s13-operations-ui`;
  commit `feat: expose safe Brain operations`; final S13 checkpoint.

---

## S14 — Staging, Pilot, Launch, And Rollback Evidence

### S14-T01 — Stage, Pilot, Launch, And Prove Rollback

- **Outcome / requirements:** satisfy REL-04 and the whole-program Definition of
  Done; produce live evidence, not a local-readiness claim.
- **Classification:** `template-gap`; target `TB-RELEASE-EVIDENCE-01`; use the
  template release process and hosted smoke as anchors, then promote a generic
  signed product-release/attestation evidence contract.
- **Dependencies:** every prior task merged; all focused receipts green.
- **Existing anchors:** the pinned canonical full local gate and host semaphore
  are defined in
  [`Justfile`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/Justfile#L21-L63),
  while deploy/hosted/release commands are pinned in
  [`package.json`](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/package.json#L95-L127).
- **Files:** create/update `docs/product/maestro-brain-release-checklist.md`,
  `docs/product/maestro-brain-deployment.md`,
  `docs/product/maestro-brain-migration-receipt.md`,
  `docs/product/maestro-brain-incident-rollback.md`,
  `docs/product/maestro-brain-limits.md`,
  `docs/product/maestro-brain-privacy-security.md`, and
  `docs/superpowers/receipts/maestro-brain/staging-pilot-launch.md`. Environment
  or source changes are separate product-candidate PRs; this attestation task is
  documentation-only.
- **Failure-first preflight:** staging starts with every external/risky kill
  switch off. `rtk pnpm deploy:doctor staging` and
  `rtk pnpm deploy:doctor production` must each fail when their required
  environment/provider binding is removed. Hosted smoke must fail when auth/
  route/key is invalid. Restore the real configuration only after the negative
  controls are captured.
- **Implementation sequence:**
  1. Pin `productReleaseCommit`, generated manifest, migration set, Slack
     manifest, provider/app IDs, approved model/prompt/eval receipt, capacity
     receipt, and env-name manifest.
  2. Run `rtk just verify-full`; archive exact output and commit hash.
  3. Deploy schema expand, run staging migration dry-runs, deploy compatible
     writers, execute/backfill/verify, then compatible readers. Do not contract
     fields until rollback window closes.
  4. Run `rtk pnpm deploy:doctor staging`,
     `rtk proxy .buildkite/scripts/staging-deploy.sh`, hosted HTTP, browser,
     accessibility, visual, auth, Nango Connect, multi-channel live/
     recent/deep, edit/delete, lifecycle, Ask, Slack-private, API/MCP, and
     export smokes using synthetic/pilot data.
  5. Perform rollback drill: disable each risky subsystem, revert web/backend to
     previous compatible release, let leases expire, verify exact capture/read
     safety, then roll forward and reconcile. Prove no schema/data
     down-migration is required.
  6. Pilot with at least five design-partner agencies for at least seven days.
     Track activation, first accepted Brief, useful cited answer, second-surface
     use, weekly admin time, correction/restore rate, spend, and incidents.
  7. If every gate passes, run `rtk pnpm deploy:doctor production` and
     `rtk proxy .buildkite/scripts/production-promote.sh`, then enable by
     organization cohort, not globally. Keep rollback owner/window active.
- **Go/no-go:** freeze cohort membership and missing-data treatment before
  scoring. The denominator is every enrolled agency that reaches its seven-day
  observation cut; nonresponse fails Brief acceptance and cited-answer
  usefulness. With ceiling-rounded integer numerators, >=80% get an accepted
  Client Brief proposal, >=70% rate a cited answer useful, and >=50% use Slack
  or MCP in week one. Report second-surface use against both the full cohort and
  activated agencies; the full-cohort threshold gates launch. Median time to
  first reviewable cited proposal or explicit insufficient-evidence result is
  <15 minutes; median Brain admin is <10 minutes/week; each active client-week,
  including zero-action weeks, averages <2 manual maintenance actions; and there
  are zero cross-client disclosure, Slack-audience, key-scope, or
  unverified-webhook incidents. Any such incident is automatic no-go. The
  release packet records the deployed Slack app distribution mode and verified
  history/replies rate class. A fast deep-history launch promise requires Tier 3
  or equivalent qualification; otherwise the limits and UI copy must publish the
  measured slower catch-up window and keep recent/deep status separate. A
  nonqualifying class with an unchanged fast-history promise is automatic no-go.
- **Typed contract / state:** release packet is
  `{ productReleaseCommit, attestationCommit, buildId, deployId, manifestHashes, migrationReceipt, evalReceipt, capacityReceipt, pilotMetrics, incidents, inheritedEvidence, approvers, rollbackReceipt, verdict }`.
  Release state is `candidate -> staging -> pilot`, then either terminal `no_go`
  or `launch_approved -> cohort_enabled -> general`.
- **Migration / rollback:** follow Appendix K. Schema contraction and legacy
  field removal are a later PR after observation window. Rollback uses feature
  flags/compatible binaries, never destructive reverse migrations. Revoked/
  redacted state remains monotonic.
- **Evidence inheritance:** the attestation commit may differ only by scoped
  evidence/docs and names the tested `productReleaseCommit`. Any source,
  dependency, generated contract, environment, migration, provider policy,
  model/prompt/tool schema, or capacity change creates a new candidate and
  requires full restaging plus a new pilot window. A docs-only correction may
  inherit evidence only when approvers sign a materiality record containing the
  old/new hashes and unaffected gates.
- **Focused verification:** `rtk host-test-slot --class full pnpm verify`,
  `rtk pnpm deploy:doctor staging`,
  `rtk proxy .buildkite/scripts/staging-deploy.sh`,
  `rtk pnpm deploy:doctor production`,
  `rtk proxy .buildkite/scripts/production-promote.sh`, and
  `rtk git diff --check`; external-only acceptance: authoritative Appendix L
  Buildkite step keys, provider-backed Slack rate-class receipt, real Claude
  Code MCP connection, hosted smokes, migration/rollback drill, and security
  review.
- **Completion receipt:** one signed release packet with commit/build/deploy
  IDs, command output, manifests/hashes, migration counts, screenshots,
  provider/eval/capacity results, pilot metrics, incidents, go/no-go approvers,
  and rollback proof.
- **Lane branch / commit boundary:** branch `codex/brain-s14-launch-evidence`;
  commit `docs: record Brain launch evidence`; final release PR. Fixes
  discovered here create a new product candidate and follow the
  evidence-inheritance rule above.

---

## Appendix A — Acceptance Dependency, Classification, And Slice Budget Matrix

`est source lines` counts hand-authored production source only. Tests, generated
output, and docs are reported separately in the StackPlan receipt and fully
reviewed; generator dry-runs enumerate them before implementation. The binding
hand-authored source limit remains 300 per commit. If a task requires more than
four coherent commits, or any coherent commit cannot fit the limit, split the
task contract and regenerate the manifest. If a StackPlan would exceed four
slices, move whole slices into another StackPlan; moving a task does not relax
its commit budget. The prerequisite column intentionally uses transitive stack
completion shorthand where a whole stack is required; the task packet's
**Dependencies** field remains the exact direct acceptance edge and is the
source materialized into `acceptanceAfter`.

| Task    | Acceptance prerequisite | Work-package classification                      | Est. source lines |
| ------- | ----------------------- | ------------------------------------------------ | ----------------: |
| S00-T01 | none                    | template-gap `TB-DEVEX-CONVEX-01`                |                 0 |
| S00-T02 | S00-T01                 | template-gap backlog/pnpm/StackPlan contract     |                 0 |
| S00-T03 | S00-T02                 | template-gap `TB-DEPLOY-ISOLATION-01`            |               280 |
| S00-T04 | S00-T03                 | template-gap migration pattern                   |               780 |
| S01-T01 | S00 complete            | template-gap `TB-AUTHKIT-01`                     |               240 |
| S01-T02 | S01-T01                 | template-gap + existing-module repair            |               260 |
| S01-T03 | S01-T02                 | template-gap authorized tenancy                  |               280 |
| S01-T04 | S01-T03                 | template-gap access UI                           |               260 |
| S02-T01 | S01 complete            | template-gap authorized Brain schema             |               260 |
| S02-T02 | S02-T01                 | template-gap authorized pages                    |               280 |
| S02-T03 | S02-T02                 | fixture-to-real `ops/versioning`/`ops/knowledge` |               290 |
| S02-T04 | S02-T03                 | template-gap authorized editor sync              |               250 |
| S03-T01 | S02 complete            | template-gap Brain UI                            |               240 |
| S03-T02 | S03-T01                 | template-gap Client Brief UI                     |               280 |
| S03-T03 | S03-T02                 | template-gap Brain workspace UI                  |               290 |
| S03-T04 | S03-T03                 | template-gap revision/review UI                  |               260 |
| S04-T01 | S01, S03                | template-gap Nango provider                      |               260 |
| S04-T02 | S04-T01                 | template-gap connection/channel directory        |               280 |
| S04-T03 | S04-T02                 | template-gap verified webhook                    |               290 |
| S04-T04 | S04-T03                 | template-gap source policy + UI                  |               290 |
| S05-T01 | S04 complete            | template-gap source ledger                       |               260 |
| S05-T02 | S05-T01                 | template-gap Slack normalizer/capture            |               290 |
| S05-T03 | S05-T02                 | template-gap source-unit assembly                |               280 |
| S05-T04 | S05-T03                 | generated capability pattern-instance            |               290 |
| S06-T01 | S05 complete            | fixture-to-real `jobs/workpool`                  |               280 |
| S06-T02 | S06-T01                 | template-gap deterministic scheduler             |               260 |
| S06-T03 | S06-T02                 | template-gap Nango history adapter               |               290 |
| S06-T04 | S06-T03                 | template-gap reconciliation/admin UI             |               260 |
| S07-T01 | S05, S06                | template-gap lifecycle envelope                  |               280 |
| S07-T02 | S07-T01                 | template-gap propagation workflow                |               290 |
| S07-T03 | S07-T02                 | template-gap lifecycle execution                 |               290 |
| S07-T04 | S07-T03                 | template-gap lifecycle UI                        |               260 |
| S08-T01 | S02, S05, S07           | template-gap structured LLM                      |               290 |
| S08-T02 | S08-T01                 | template-gap internal workflow generator         |               260 |
| S08-T03 | S08-T02                 | generated capability/workflow pattern-instance   |               295 |
| S08-T04 | S08-T03                 | generated capability/workflow pattern-instance   |               295 |
| S09-T01 | S07, S08                | template-gap async search                        |               240 |
| S09-T02 | S09-T01                 | template-gap search projection                   |               280 |
| S09-T03 | S09-T02, S02            | generated headless capability pattern-instance   |               290 |
| S09-T04 | S09-T03, S08            | generated Ask capability pattern-instance        |               290 |
| S10-T01 | S04, S09                | template-gap Slack identity                      |               260 |
| S10-T02 | S10-T01                 | capability pattern-instance + transport gap      |               290 |
| S10-T03 | S10-T02                 | template-gap outbox/provider action              |               280 |
| S10-T04 | S10-T03                 | template-gap Slack recovery UI                   |               240 |
| S11-T01 | S09 complete            | template-gap `TB-HEADLESS-01`                    |               280 |
| S11-T02 | S11-T01                 | template-gap bearer dispatcher                   |               280 |
| S11-T03 | S11-T02                 | template-gap `TB-HEADLESS-01` registry           |               260 |
| S11-T04 | S11-T03                 | template-gap Streamable HTTP MCP                 |               290 |
| S12-T01 | S07, S11                | template-gap deterministic export                |               260 |
| S12-T02 | S12-T01                 | capability pattern-instance + storage gap        |               290 |
| S12-T03 | S12-T02                 | template-gap export UI                           |               240 |
| S13-T01 | S10, S11, S12 complete  | template-gap reproducible eval harness           |               280 |
| S13-T02 | S13-T01, S06            | template-gap capacity harness                    |               260 |
| S13-T03 | S13-T02                 | template-gap operations policy                   |               260 |
| S13-T04 | S13-T03                 | template-gap operations UI/recovery              |               250 |
| S14-T01 | all prior tasks         | template-gap release evidence                    |                 0 |

## Appendix B — Canonical Role And Capability Matrix

The role ordering is exactly the existing template ordering—no `member`,
`operator`, `integration_admin`, or hidden super-role is added. Organization
admins receive the existing capped administrator baseline; direct workspace
membership may be more restrictive. Service principals never participate in
human role inheritance.

| Action                                                        | Viewer | Editor |   Admin   |   Owner   | Extra binding/rule                                      |
| ------------------------------------------------------------- | :----: | :----: | :-------: | :-------: | ------------------------------------------------------- |
| List/read Brain pages and citations                           | allow  | allow  |   allow   |   allow   | Current active Brain membership                         |
| Search/read routed source                                     | allow  | allow  |   allow   |   allow   | Active route + lifecycle generation                     |
| Ask through web                                               | allow  | allow  |   allow   |   allow   | Current role rechecked before response                  |
| Ask through Slack                                             | allow  | allow  |   allow   |   allow   | Verified Slack identity + requester-private destination |
| Create/edit/rename/move/favorite/archive page                 |  deny  | allow  |   allow   |   allow   | Expected current revision required                      |
| Restore page revision                                         |  deny  | allow  |   allow   |   allow   | Appends a new revision                                  |
| Review/accept/edit/reject maintenance proposal                |  deny  | allow  |   allow   |   allow   | Citation and generation checks still apply              |
| Create/invite/remove Brain members; change non-owner roles    |  deny  |  deny  |   allow   |   allow   | Last-owner protections                                  |
| Enable/disable Autopilot or change Brain model policy         |  deny  |  deny  |   allow   |   allow   | Passing eval receipt required to enable                 |
| Create/list/revoke/rotate Brain API keys                      |  deny  |  deny  |   allow   |   allow   | Viewer ceiling, display-once secret                     |
| Request/download/purge Brain export artifact                  |  deny  |  deny  |   allow   |   allow   | Final auth/lifecycle fence                              |
| Archive Brain                                                 |  deny  |  deny  |   allow   |   allow   | Does not purge data                                     |
| Delete Brain                                                  |  deny  |  deny  |   deny    |   allow   | Reviewed lifecycle job and confirmation                 |
| Transfer Brain ownership                                      |  deny  |  deny  |   deny    |   allow   | Cannot leave zero owners                                |
| Connect/reauthorize/disconnect agency Slack                   |  deny  |  deny  | org admin | org owner | Organization scope only                                 |
| Reconcile directory, set/bulk-change channel policy/allowlist |  deny  |  deny  | org admin | org owner | Joined channels and authorized target Brains only       |
| Review Classify route proposal/no-route                       |  deny  |  deny  | org admin | org owner | Reviewer can select only pinned allowlist               |
| Emergency historical route revoke/reroute                     |  deny  |  deny  | org admin | org owner | Separate audited action and derived-data remediation    |
| Change organization retention/model-egress/capacity policy    |  deny  |  deny  | org admin | org owner | Immutable policy epoch and preview                      |
| Create/release legal hold                                     |  deny  |  deny  | org admin | org owner | Release may require configured second approval          |
| Delete organization                                           |  deny  |  deny  |   deny    | org owner | Second approval + exact confirmation                    |
| Billing/organization ownership                                |  deny  |  deny  |   deny    | org owner | Existing template ownership rule                        |

Every row receives table-driven tests at web capability, Slack adapter, API
executor, and MCP executor boundaries where the action is exposed. A UI-hidden
button without server denial does not satisfy the matrix.

Service principals use a separate matrix because no ambient human session or
role participates in a key-authenticated request:

| Principal               | Allowed scopes                     | Role ceiling | Tenant source                             | Revocation checks                                                 |
| ----------------------- | ---------------------------------- | ------------ | ----------------------------------------- | ----------------------------------------------------------------- |
| Brain service principal | `brain:read`, optional `brain:ask` | `viewer`     | One Brain injected from verified key hash | key, principal, Brain, organization, expiry, lifecycle generation |

## Appendix C — Canonical Durable Table And Compound-Index Inventory

Convex indexes are not uniqueness constraints by themselves. Every “unique”
invariant below is enforced transactionally by querying the compound index
before insert/update. Every durable row includes timestamps and a schema
version; every customer-bearing or derived row includes the S07 lifecycle
envelope.

| Table                            | Stack       | Required indexes/search index                                                                                                              | Canonical invariant                                                                                                                        |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `users` (modify)                 | S01         | existing `by_subject`, `by_email`                                                                                                          | WorkOS subject is canonical human identity; email never authorizes                                                                         |
| `organizations` (modify)         | S01         | `by_workos_organization`, `by_agency_key`, `by_owner`, `by_status`                                                                         | One internal org per WorkOS org; tenant-scoped stable `agencyKey`                                                                          |
| `organizationMembers` (existing) | S01         | `by_organization_user`, `by_organization_status`                                                                                           | One active membership per org/user                                                                                                         |
| `workspaces` (modify)            | S01         | `by_organization`, `by_organization_brain_key`, `by_organization_kind`, `by_organization_status`                                           | Exactly one Agency Brain; unique Brain key inside org                                                                                      |
| `workspaceMembers` (existing)    | S01         | `by_workspace_user`, `by_workspace_status`                                                                                                 | Canonical direct Brain role                                                                                                                |
| `accessAuditEvents` (modify)     | S01         | `by_workspace_created`, `by_organization_created`, `by_action_created`                                                                     | Redacted privileged success/denial journal                                                                                                 |
| `brainPages` (modify)            | S02         | `by_workspace_page_key`, `by_workspace_parent_sort`, `by_workspace_parent_slug`, `by_workspace_status`                                     | Unique page key and active sibling slug inside Brain                                                                                       |
| `pageRevisions`                  | S02         | `by_workspace_revision_key`, `by_page_created`, `by_page_hash`, `by_effect_key`                                                            | Immutable content; one accepted revision effect                                                                                            |
| `citations` (modify)             | S02         | `by_page_revision`, `by_answer_receipt`, `by_source_revision`, `by_citation_key`                                                           | Exact source-revision locator and quote hash                                                                                               |
| `providerConnections`            | S04         | `by_organization_provider_status`, `by_connection_key`, `by_nango_connection_generation`, `by_team_app_generation`                         | One active Slack connection per org; exact generation binding                                                                              |
| `sourceChannels`                 | S04         | `by_connection_external_channel`, `by_channel_key`, `by_organization_membership_state`, `by_connection_generation`                         | External ID unique inside connection generation; exact bot membership                                                                      |
| `channelRoutingPolicies`         | S04         | `by_channel_epoch`, `by_channel_active`, `by_organization_created`                                                                         | Immutable epoch; Direct one target, Classify finite target set, Capture-only none                                                          |
| `channelDeliveryPolicies`        | S04         | `by_channel_generation`, `by_channel_active`                                                                                               | Slack Connect only `capture_only`; internal may be requester-private                                                                       |
| `channelSyncStates`              | S04/S06     | `by_channel`, `by_live_lag`, `by_recent_next_retry`, `by_deep_next_retry`, `by_access_state`                                               | Independent live/recent/deep cursors and fenced lease generations                                                                          |
| `providerEventReceipts`          | S05         | `by_connection_transport_delivery`, `by_observation_key`, `by_received_at`, `by_outcome`                                                   | One transport receipt; many receipts may cite one logical observation                                                                      |
| `sourceArtifacts`                | S05         | `by_channel_provider_object`, `by_source_key`, `by_thread_key`, `by_lifecycle_purge_after`                                                 | Stable message/source object and total-ordered latest pointer                                                                              |
| `sourceRevisions`                | S05         | `by_source_revision_key`, `by_source_provider_order`, `by_source_created`, `by_lifecycle_purge_after`                                      | Immutable exact observation/tombstone; preserves `A -> B -> A`                                                                             |
| `sourceUnits`                    | S05         | `by_channel_unit_key`, `by_source_unit_key`, `by_latest_revision`                                                                          | Stable thread-or-message unit with latest snapshot pointer                                                                                 |
| `sourceUnitRevisions`            | S05         | `by_unit_revision_key`, `by_unit_fixed_cut`, `by_hash`, `by_lifecycle_purge_after`                                                         | Immutable ordered content snapshot at fixed cut                                                                                            |
| `sourceProcessingJobs`           | S05/S06/S08 | `by_stage_status_next_retry`, `by_effect_key`, `by_unit_stage`, `by_lease_expiry`, `by_organization_status`                                | At-least-once attempt with one accepted effect and fenced lease                                                                            |
| `sourceRoutes`                   | S05         | `by_workspace_unit_active`, `by_source_revision_active`, `by_effect_key`, `by_route_generation`                                            | Brain-readable only through active route; one logical route effect                                                                         |
| `providerRateLimitBuckets`       | S06         | `by_provider_connection_method`, `by_blocked_until`, `by_organization`                                                                     | Central deterministic rate/admission state                                                                                                 |
| `retentionPolicies`              | S07         | `by_organization_epoch`, `by_organization_active`                                                                                          | Immutable policy epochs                                                                                                                    |
| `legalHolds`                     | S07         | `by_organization_status`, `by_resource_key`, `by_expires_at`                                                                               | Hold blocks purge, never access revocation                                                                                                 |
| `lifecycleJobs`                  | S07         | `by_organization_status_next_retry`, `by_effect_key`, `by_resource_key`                                                                    | Resumable audited propagation/purge effect                                                                                                 |
| `dataSubjectBindings`            | S07         | `by_organization_workos_subject`, `by_organization_team_slack_user`, `by_status`                                                           | Exact reviewed WorkOS/Slack identity equivalence; no email/display-name authority                                                          |
| `dataSubjectOccurrences`         | S07         | `by_subject_resource`, `by_resource_subject`, `by_organization_created`                                                                    | Deterministic exact-author/descendant DSAR inventory; free text remains reviewed                                                           |
| `modelCallReceipts`              | S08         | `by_attempt_key`, `by_workflow_stage`, `by_model_prompt`, `by_request_hash`                                                                | No raw prompts/completions; immutable hashes/usage/versions                                                                                |
| `classificationDecisions`        | S08         | `by_unit_policy_epoch`, `by_status_created`, `by_effect_key`, `by_target_brain`                                                            | Exactly one nullable target; one reviewed accepted decision                                                                                |
| `brainMaintenanceProposals`      | S08         | `by_workspace_status_created`, `by_page_status`, `by_effect_key`, `by_model_prompt`                                                        | Cited no-op/revision proposal and review/autopilot receipt                                                                                 |
| `workspaceSearchProjections`     | S09         | indexes `by_workspace_revision`, `by_route_effect`, `by_lifecycle_state`; search index `search_text` filtered by org/workspace/active/kind | Only active page/routed-source text enters a Brain corpus                                                                                  |
| `retrievalReceipts`              | S09         | `by_receipt_key`, `by_workspace_created`, `by_effect_key`, `by_lifecycle_purge_after`                                                      | Query hash, normalized filter manifest/hash, immutable candidate/result/generation manifest; no raw query text                             |
| `slackIdentityBindings`          | S10         | `by_organization_team_slack_user`, `by_organization_user_status`, `by_link_token_hash`                                                     | One active Maestro user per exact org/team/Slack user                                                                                      |
| `outboundDeliveryOutbox`         | S10         | `by_effect_key`, `by_status_next_attempt`, `by_destination_answer`, `by_lease_expiry`                                                      | Encrypted sanitized payload, payload hash/render version, requester/audience/answer/auth/lifecycle generations; one logical visible answer |
| `servicePrincipals`              | S11         | `by_principal_key`, `by_workspace_status`, `by_organization_status`                                                                        | One-Brain viewer ceiling and revocation generation                                                                                         |
| `apiKeys` (modify)               | S11         | `by_key_hash`, `by_workspace_status`, `by_principal_status`, `by_expiry`                                                                   | Hash only; display once; read/Ask scopes only                                                                                              |
| `brainExportJobs`                | S12         | `by_workspace_status_created`, `by_effect_key`, `by_artifact_expiry`, `by_lifecycle_generation`                                            | One pinned authorized export effect and temporary artifact                                                                                 |

### Stable-Key Formats

- Keys are opaque, lowercase, URL-safe, and collision-resistant; prefixes make
  type mistakes visible (`agy_`, `brn_`, `pag_`, `src_`, `srv_`, `sun_`, `suv_`,
  `prv_`, `cit_`, `con_`, `chn_`, `ret_`, `ans_`, `key_`, `exp_`).
- Key generation uses secure random/ULID-style data, not names, Slack IDs,
  emails, or Convex IDs.
- Uniqueness is tenant-scoped unless the key is an externally presented secret
  prefix/hash. Resolvers always take current server principal plus key.
- Public schemas never contain `_id`, `_creationTime`, `workspaceId`,
  `organizationId`, or any string that serializes an internal Convex ID.

## Appendix D — Provider, Environment, And Secret Inventory

| Name                                         | Exposure                     | Required by | Purpose / rule                                                   |
| -------------------------------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------- |
| `VITE_CONVEX_URL`                            | browser public               | S01         | Convex client endpoint; not a secret                             |
| `CONVEX_DEPLOYMENT` / deployment credentials | deploy secret                | S00+        | Existing Convex deploy tooling only; never browser-visible       |
| `WORKOS_API_KEY`                             | server secret                | S01         | AuthKit server operations                                        |
| `WORKOS_CLIENT_ID`                           | server/config                | S01         | AuthKit application/client ID                                    |
| `WORKOS_COOKIE_PASSWORD`                     | server secret                | S01         | AuthKit encrypted cookie protection                              |
| `WORKOS_REDIRECT_URI`                        | server config                | S01         | Exact allowlisted callback                                       |
| `WORKOS_JWT_ISSUER`                          | server config                | S01         | Convex custom JWT issuer; replaces demo constant                 |
| `WORKOS_JWKS_URL`                            | server config                | S01         | Convex JWKS URL; replaces demo org URL                           |
| `NANGO_SECRET_KEY`                           | server secret                | S04         | Create Connect sessions and call Nango server API                |
| `NANGO_BASE_URL`                             | server/browser config        | S04         | Pinned Nango Cloud/self-host endpoint                            |
| `NANGO_SLACK_PROVIDER_CONFIG_KEY`            | server config                | S04         | Exact reviewed Slack provider configuration                      |
| `SLACK_SIGNING_SECRET_CURRENT`               | server secret                | S04         | Verify the Maestro-owned native Events receiver                  |
| `SLACK_SIGNING_SECRET_PREVIOUS`              | server secret, optional      | S04         | Bounded native-receiver rotation overlap                         |
| `OPENROUTER_API_KEY`                         | server secret                | S08         | Existing provider-neutral LLM endpoint credential                |
| `OPENROUTER_BASE_URL`                        | server config                | S08         | Exact allowlisted endpoint; no arbitrary per-request URL         |
| `MAESTRO_PUBLIC_APP_URL`                     | server/browser config        | S01/S10/S11 | Link callbacks and public remote MCP URL                         |
| `MCP_ALLOWED_ORIGINS`                        | server config, default empty | S11         | Explicit browser allowlist; empty means deny all browser origins |
| existing PostHog env names                   | existing boundary            | S13         | Redacted operational events only; no prompts/source text         |

Model IDs, prompt versions, tool-schema versions, budgets, retention/no-training
approval, data region, channel capacity, and kill switches are versioned policy
data, not secrets or ad hoc environment branches. Slack access/refresh/bot/user
tokens remain exclusively in Nango. API key plaintext exists only in the create
response and transient UI memory. Convex storage needs no new third-party bucket
secret.

For every secret: document owner, staging/production presence, rotation method,
current/previous overlap, canary test, and emergency revoke. Documentation lists
names only; receipts contain existence/version/last-rotated metadata, never
values.

## Appendix E — Slack App Manifest, Scopes, Events, And Nango Settings

The checked-in `packages/integrations/config/slack/maestro-brain-manifest.json`
is authoritative. The installed Slack/Nango configuration hash must match it
before live ingestion.

### Bot scopes

| Scope               | V1 use                                                                       |
| ------------------- | ---------------------------------------------------------------------------- |
| `app_mentions:read` | Receive internal mentions                                                    |
| `channels:read`     | Public channel directory/membership metadata                                 |
| `channels:history`  | Joined public-channel messages/history                                       |
| `groups:read`       | Private channel directory/membership metadata granted to bot                 |
| `groups:history`    | Joined private/Slack Connect channel messages/history                        |
| `im:read`           | DM channel metadata                                                          |
| `im:history`        | DM requests                                                                  |
| `im:write`          | Open/respond to exact verified requester DM when required                    |
| `mpim:read`         | Multi-person DM metadata if enabled in pilot                                 |
| `mpim:history`      | Multi-person DM events if enabled in pilot; delivery still requester-private |
| `chat:write`        | Ephemeral/DM response action as the bot                                      |
| `users:read`        | Resolve stable Slack user metadata; never email-authorize                    |
| `files:read`        | Preserve visible file metadata/permalink only; no download/OCR in V1         |

Forbidden unless a later reviewed spec changes scope: `channels:join`,
`channels:manage`, `groups:write`, `users:read.email`, `chat:write.public`,
admin scopes, user-token-only broad scopes, and any auto-join Nango option.

### Subscribed bot events

- `message.channels`, `message.groups`, `message.im`, and—only if the pilot
  enables MPIM—`message.mpim`; edits/deletes arrive as message subtypes.
- `app_mention` for internal requester-private questions.
- `member_joined_channel` and `member_left_channel` as membership fast paths;
  directory reconciliation remains authoritative.
- `channel_rename`, `channel_archive`, `channel_unarchive`, and
  `channel_deleted` when Slack exposes them to the app.
- `app_uninstalled` and relevant token-revocation event for immediate connection
  disablement.

### Nango configuration

- `joinPublicChannels = false` and no equivalent auto-join behavior.
- Bot credential is the default ingestion/proxy identity; user tokens are not
  used to infer bot membership.
- Auth webhook/Connect callback preserves the stable Maestro `connectionKey`.
- Slack Events request URL targets the Maestro-owned native receiver; Nango
  forwarding is disabled for live capture.
- Channel directory sync is full and paginated. Message history is called only
  by Maestro's one-channel bounded scheduler, never Nango's stock all-channel
  loop.
- Outbound action is `chat.postEphemeral` for internal channel replies and exact
  DM send for the verified requester. Slack Connect never receives answers.

## Appendix F — Capability Registry And Typed Contract Inventory

### External API/MCP operation registry

No operation accepts `agencyKey`, `organizationId`, `workspaceId`,
`workspaceSlug`, `brainKey`, `userId`, or Convex ID as authority. The verified
service principal injects one Brain. Optional filters below can only narrow that
Brain.

| Operation              | Scope        | Args                                                                                   | Return essentials                                                          |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `brain.pages.list`     | `brain:read` | `{ cursor?: string, limit?: 1..100, includeArchived?: false }`                         | `{ brainKey, asOf, freshness, pages[], nextCursor? }`                      |
| `brain.pages.get`      | `brain:read` | `{ pageKey: string }`                                                                  | current revision, safe BlockNote/Markdown projection, citations, freshness |
| `brain.pages.history`  | `brain:read` | `{ pageKey, cursor?, limit? }`                                                         | immutable revision metadata/causation; no hidden source text               |
| `brain.sources.search` | `brain:read` | `{ query, filters?: { channelKeys?, from?, to?, kinds? }, cursor?, limit? }`           | active projection candidates with exact stable revision keys               |
| `brain.sources.get`    | `brain:read` | `{ sourceRevisionKey }`                                                                | exact current-authorized revision or explicit redacted marker              |
| `brain.context.get`    | `brain:read` | `{ pageKeys?, sourceRevisionKeys?, recent?: { from?, to?, channelKeys? }, maxBytes? }` | bounded deterministic context and citations; no model answer               |
| `brain.answers.ask`    | `brain:ask`  | `{ question, maxCitations?: 1..20 }`                                                   | cited structured answer or typed `InsufficientEvidence`, retrieval receipt |

All successes contain `brainKey`, `asOf`, freshness derived from explicit live/
recent/deep watermarks, request/receipt key, and stable citations. Shared
errors: `Unauthorized`, `Forbidden`, `ValidationFailed`, `NotFound`,
`RateLimited`, `LifecycleRevoked`, `StaleAuthorization`, `InsufficientEvidence`
where relevant.

### Human-authenticated web capability registry

| Group                                   | Operations                                        | Minimum role                                                         |
| --------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `auth.workspaces`                       | list authorized Brains                            | authenticated membership                                             |
| `access.provisioning`                   | ensure agency/Agency Brain; create Client Brain   | org admin for client create                                          |
| `access.members` / `access.invitations` | existing member/invite operations                 | Brain admin/owner per Appendix B                                     |
| `brain.pages`                           | list/get/create/rename/move/favorite/archive/save | viewer for read, editor for write                                    |
| `brain.revisions`                       | history/diff/restore                              | viewer read, editor restore                                          |
| `slack.connections`                     | begin/complete/reauthorize/disconnect             | org admin                                                            |
| `slack.channelPolicies`                 | list/bulk set policy/allowlist/delivery           | org admin                                                            |
| `classification.review`                 | accept/change-to-allowed/no-route                 | org admin                                                            |
| `maintenance.review`                    | accept/edit/reject proposal                       | Brain editor                                                         |
| `brain.policy`                          | maintenance mode/Autopilot/model policy           | Brain admin                                                          |
| `dataLifecycle`                         | plan/list; execute/hold/revoke                    | admin/owner only, with destructive actions restricted per Appendix B |
| `headless.apiKeys`                      | create/list/revoke/rotate                         | Brain admin                                                          |
| `brain.exports`                         | request/list/download/purge                       | Brain admin                                                          |

### Internal-only capability/workflow registry

| Stage                         | Input pin                                            | Output/effect                                  | Must not import/call                             |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `slack.webhook.verify`        | raw bytes/headers + current/previous secret metadata | verified envelope or rejection metadata        | LLM, tenant lookup before verification           |
| `sources.capture`             | verified envelope + connection/channel generation    | atomic event/source/assembly intent            | LLM, search                                      |
| `sources.assemble`            | job/lease + fixed cut                                | immutable content-bearing source-unit revision | LLM, Slack/Nango                                 |
| `sources.policyDispatch`      | source-unit + pinned policy                          | awaiting/capture-only/direct/classify command  | semantic matcher                                 |
| `routes.commit`               | authorized reviewed/mechanical command + generations | one source route effect                        | LLM/provider SDK                                 |
| `classification.gather`       | unit/policy keys                                     | closed immutable request                       | LLM/provider SDK                                 |
| `classification.model`        | closed request                                       | zero-or-one proposal + model receipt           | DB, Slack, Nango, tools                          |
| `classification.review`       | current admin + proposal                             | reviewed route/no-route command                | LLM/provider SDK                                 |
| `maintenance.gather`          | active route/current page/generations                | bounded context pack                           | DB writer, LLM                                   |
| `maintenance.model`           | context pack/instructions/schema                     | cited no-op/revision proposal                  | DB, Slack, Nango, tools                          |
| `revisions.commit`            | proposal/review/policy/generations                   | one revision/citation effect                   | LLM/provider SDK                                 |
| `search.project`              | active page/route revision                           | active/inactive projection effect              | LLM                                              |
| `answers.gather/model/commit` | principal + immutable retrieval manifest             | cited answer/abstention receipt                | caller tenant authority; arbitrary network tools |
| `slack.outbox.send`           | outbox row + current auth generations                | requester-private delivery effect              | answer generation, tenant guessing               |
| `lifecycle.propagate/purge`   | approved action + current fences                     | monotonic redaction/purge receipts             | LLM/provider semantic logic                      |
| `exports.gather/encode/store` | admin/job + pinned revision/generations              | one temporary artifact effect                  | LLM, Git, external bucket                        |

### Classification request/result

```ts
type ClassificationRequest = {
  sourceUnitRevisionKey: string;
  sourceUnitHash: string;
  messages: Array<{
    sourceRevisionKey: string;
    authorLabel: string;
    providerTimestamp: string;
    canonicalText: string;
  }>;
  policyVersion: number;
  allowedTargets: Array<{
    brainKey: string;
    displayName: string;
    routingDescription?: string;
  }>;
};

type ClassificationDecision = {
  sourceUnitRevisionKey: string;
  contentScope: "single_target" | "mixed_client" | "no_target";
  targetBrainKey: string | null;
  confidence: number;
  rationale: string;
  evidenceQuotes: Array<{ sourceRevisionKey: string; quote: string }>;
};
```

Confidence/rationale are diagnostic only. The structural pipe verifies key/hash,
content-scope/target consistency, zero-or-one target, allowlist membership,
exact quotes, policy/generations, and review authority. `mixed_client` requires
a null target and cannot be reviewer-overridden to a route in V1; the pipe does
not otherwise reinterpret the decision.

## Appendix G — Complete State-Machine Inventory

This table covers durable entity machines. Every durable transition persists
actor/principal key, causation/effect key, prior/next state, relevant
generation/ epoch, and timestamp; raw tokens and customer text are never
transition data. Transient request flows appear separately and produce only
redacted audit events at security boundaries. An unlisted durable transition is
invalid. Terminal or monotonic states cannot be reopened by retry; recovery
creates a new generation, attempt, revision, or job.

| Machine                     | States and permitted transitions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Owning task / commit fence                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Host plugin readiness       | `unknown -> missing \| installed -> verified`; `verified` is required on three distinct hosts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | S00-T01; fresh-session discovery                                           |
| Stack execution             | `unprojected -> projected -> validated -> in_progress -> merged -> receipt_archived`; drift returns to `unprojected`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S00-T02; validated manifest hash                                           |
| Migration run               | `planned -> running -> complete \| failed`; `failed -> running` only from last committed cursor                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | S00-T04; migration name/cursor/generation                                  |
| Organization                | `provisioning -> active -> suspended -> active \| deleting -> deleted`; `deleted` is terminal                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | S01-T02/S07-T03; organization generation                                   |
| Brain                       | `provisioning -> active -> archived -> active \| deleting -> deleted`; lifecycle may move active/archived content to redacted/purged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S01-T03/S07-T03; Brain/lifecycle generation                                |
| Membership                  | `pending -> active -> revoked`; a new grant creates a new membership generation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | S01-T04; current effective-role generation                                 |
| Invitation                  | existing typed pending/accepted/expired/revoked terminal rules remain authoritative                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S01-T04; invitation token/status                                           |
| Page                        | `active -> archived -> active \| redacted -> purged`; redaction/purge are monotonic                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S02-T01/S07; lifecycle generation                                          |
| Page revision               | `draft -> proposed -> published \| rejected`; any non-purged state may become `redacted -> purged`; published rows are immutable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | S02-T01/T03; expected current revision + effect key                        |
| Provider connection         | `not_connected -> authorizing -> verifying -> active \| error`; `active -> reauthorizing -> active \| error`; `active \| error -> revoked`; replacement creates a new generation                                                                                                                                                                                                                                                                                                                                                                                                                                            | S04-T01/T02; connection/team/app/bot generation                            |
| Channel membership          | `discovered_not_joined -> joined_needs_policy -> joined_active -> access_lost \| archived`; re-add creates a new access generation and resumes saved cursors                                                                                                                                                                                                                                                                                                                                                                                                                                                                | S04-T02/S06-T04; bot membership generation                                 |
| Routing policy              | immutable epochs with mode `direct \| classify \| capture_only`; active pointer moves only after validation and audit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S04-T04; policy epoch                                                      |
| Delivery policy             | immutable generation `requester_private \| capture_only`; Slack Connect is structurally fixed to `capture_only`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | S04-T04/S10; delivery generation                                           |
| Live/recent/deep sync lane  | `not_started \| idle -> queued -> running`; `running -> complete \| waiting_rate_limit \| retry_wait \| access_lost \| dead_letter`; retry/access restoration returns through `queued` without resetting the cursor; live lanes cycle `running -> idle`                                                                                                                                                                                                                                                                                                                                                                     | S04-T02/S06; cursor + lease fence                                          |
| Provider event receipt      | `verified -> committed -> acknowledged` or `verified -> rejected_after_binding`; pre-verification and unmatched-connection failures are non-durable redacted security telemetry                                                                                                                                                                                                                                                                                                                                                                                                                                             | S04-T03/S05-T02; event/observation key                                     |
| Source artifact             | `active -> deleted_tombstone -> redacted -> purged`; latest pointer advances by total provider order only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | S05-T01/T02/S07; provider order + lifecycle generation                     |
| Source revision             | immutable `observed \| edit \| tombstone`, then `redacted -> purged`; `A -> B -> A` remains three revisions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | S05-T02/S07; revision key/order/hash                                       |
| Source unit                 | `open -> cut`; every revision contains one first-observed policy epoch, and cross-epoch replies create separate immutable segments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | S05-T03; fixed-cut/segment key/hash                                        |
| Source processing job       | Orthogonal `executionStatus` is `queued -> leased -> running -> succeeded \| retry_wait \| dead_letter \| superseded \| revoked \| cancelled`. Routing `stage` is `assembled -> awaiting_policy \| capture_only \| route_pending \| awaiting_classification`; `awaiting_policy -> capture_only \| route_pending \| awaiting_classification`; `route_pending -> routed`; `awaiting_classification -> classifying -> awaiting_classification_review -> routed \| classified_no_route \| mixed_client_no_route`; any non-terminal stage may become `superseded \| revoked`. Only current execution and stage fences may commit | S05-T04/S06/S07/S08; lease, stage, policy, route and lifecycle generations |
| Source route                | `proposed -> active -> revoked \| superseded`; Direct may create `active` mechanically; awaiting-policy/capture-only are job states, not route states                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S05-T04/S07/S08-T03; route effect/policy/lifecycle generation              |
| Rate-limit bucket           | `available -> blocked_until -> available`; admission may be queued/rejected but never silently dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | S06-T02/S13-T02; connection/method budget epoch                            |
| Legal hold                  | `planned -> active -> released \| expired`; it blocks purge only, never current-read revocation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | S07-T01/T03; hold generation/approval                                      |
| Lifecycle job               | `planned -> approved -> running -> complete \| failed \| blocked_by_hold`; failed/blocked work resumes as a new fenced attempt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | S07; effect key/resource generation                                        |
| Model call                  | `queued -> running -> succeeded \| retryable_failure \| permanent_failure \| cancelled`; budget/policy denial occurs before queueing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S08-T01; request hash/model/prompt/tool versions                           |
| Classification decision     | `gathered -> proposed_zero \| proposed_one \| proposed_mixed`; `proposed_zero -> no_route \| rejected \| superseded`; `proposed_mixed -> mixed_client_no_route \| rejected \| superseded`; `proposed_one -> accepted \| changed_to_allowed \| no_route \| rejected \| superseded`; only reviewed non-mixed terminal decisions may route                                                                                                                                                                                                                                                                                     | S08-T03; unit/policy/allowlist/review generations                          |
| Maintenance proposal        | `gathering -> proposed_noop \| proposed_revision`; `proposed_noop -> accepted_noop \| rejected \| superseded`; `proposed_revision -> awaiting_review`; `awaiting_review -> published \| edited_and_published \| rejected \| superseded \| revoked`; eligible Autopilot may move a proven proposal directly to `published`                                                                                                                                                                                                                                                                                                   | S08-T04; page/route/model/policy/lifecycle generations                     |
| Search projection           | `pending -> active`; `active -> inactive \| redacted`; `inactive \| redacted -> purged`; inactive/redacted rows cannot be candidates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S09-T02; source/page revision + route/lifecycle generation                 |
| Retrieval/answer            | `gathering -> manifest_pinned -> model_running`; `model_running -> cited_answer \| insufficient_evidence \| retryable_failure`; both content results require `reauthorized -> returned`, or terminate as `stale_authorization \| revoked`                                                                                                                                                                                                                                                                                                                                                                                   | S09-T03/T04; immutable manifest + final auth generations                   |
| Slack identity binding      | `unlinked -> pending_verification -> active -> revoked`; relink creates a new binding generation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | S10-T01; org/team/Slack user/WorkOS subject                                |
| Slack question              | `received -> scope_required \| scoped \| denied`; `scope_required -> scoped \| needs_clarification \| denied`; `scoped -> answering`; `answering -> outbox_pending \| abstained \| retry_wait \| superseded`                                                                                                                                                                                                                                                                                                                                                                                                                | S10-T02/T04; requester and scope receipt                                   |
| Outbound delivery           | `pending -> authorized -> sending`; `sending -> delivered \| retry_wait \| ambiguous_no_retry \| denied \| revoked \| dead_letter`; ephemeral ambiguity is terminal                                                                                                                                                                                                                                                                                                                                                                                                                                                         | S10-T03; outbox effect + audience/auth/lifecycle generations               |
| Service principal / API key | `active -> expired \| revoked`; rotation creates a new key and revokes the old generation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | S11-T01; key hash/principal generation                                     |
| Export job/artifact         | `requested -> gathering -> encoding -> storing -> ready -> expired -> purged`, with `revoked \| failed` terminal outcomes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | S12; export effect/lifecycle generation                                    |
| Model/prompt approval       | `candidate -> evaluated -> approved \| rejected`; approval is immutable for a suite/fixture hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | S13-T01; eval receipt hash                                                 |
| Subsystem policy            | `enabled -> paused -> enabled`, with emergency `disabled`; enabling requires current operator authority and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | S13-T03; policy epoch                                                      |
| Operations alert            | `open -> acknowledged -> resolved`; recurrence creates a new alert rather than reopening the resolved row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | S13-T04; subsystem/error/generation/window key                             |
| Recovery attempt            | `planned -> running -> complete \| failed \| generation_mismatch`; retry creates a new fenced attempt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | S13-T04; recovery generation/attempt key                                   |
| Release                     | `candidate -> staging -> pilot`, then terminal `no_go` or `launch_approved -> cohort_enabled -> general`; incident triggers rollback/new candidate                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | S14-T01; product/attestation commit, build and deploy IDs                  |

Transient flows are ordered security checks, not durable state machines:

| Flow             | Required order                                                                                 | Audit behavior                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Human auth       | `signed_out` or `authenticated` per request                                                    | Persist no token; audit only redacted subject/config failure metadata          |
| Editor commit    | `editing -> commit_pending -> committed \| stale \| revoked`                                   | Persist only accepted revision or redacted denial/attempt metadata             |
| Headless request | `received -> authenticated -> authorized -> decoded -> dispatched -> reauthorized -> returned` | Persist request ID, principal key, operation, timing and redacted outcome only |

## Appendix H — Lifecycle Propagation Matrix

“Immediate” means deny current reads, candidate selection, model input, export,
and delivery in the initiating transaction or through a monotonic generation
fence. Physical purge may be asynchronous and resumable. Legal hold changes
purge timing only.

| Trigger                                      | Immediate authority/routing effect                                                                                    | Raw and immutable source copies                                                                        | Derived/indexed/model copies                                                                                                | Queued/delivered/exported copies                                                                    | Purge, hold, backup and proof                                                                               |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Slack edit                                   | Supersede old latest pointer; old revision remains non-current                                                        | Append exact edit revision; preserve prior observations                                                | Assemble new fixed cut; supersede stale decisions/routes/projections/proposals                                              | Fence stale jobs/answers/exports/outbox before commit                                               | Retain old revision per policy; prove `A -> B -> A` ordering                                                |
| Slack delete                                 | Revoke current readable text immediately                                                                              | Append tombstone; retain permitted hash/order metadata                                                 | Inactivate routes/projections/citations and make every affected current page revision non-readable until safe replacement   | Revoke queued work and unpublished answers/exports; delivered copies get audit marker only          | Purge text on schedule unless held; citation resolves redacted marker                                       |
| Emergency route revoke/reroute               | Deactivate affected Brain route immediately                                                                           | Organization-vault source remains subject to its own policy                                            | Inactivate projections/manifests and make affected current page revisions non-readable before reviewed replacement          | Fence jobs/outbox/exports; already downloaded/user-visible copies are recorded, not remotely erased | Lifecycle job records every descendant and unresolved external copy                                         |
| Bot removed/channel access lost              | Stop new capture; retain current read policy unless separately revoked                                                | Preserve captured revisions and cursors                                                                | Stop new assembly/routing; mark freshness gap                                                                               | Pause lane jobs and sends requiring channel access                                                  | Re-add resumes/reconciles; irrecoverable Slack gaps remain explicit                                         |
| Connection reauthorize/replace/disconnect    | Same connection increments credentials generation; replacement/disconnect revokes old generation                      | Preserve channel keys/cursors only for verified same-team/app reauth; otherwise freeze old mappings    | Fence old routes/projections and revoke old Slack identity bindings                                                         | Reject stale webhooks; pause jobs/outbox until replacement review                                   | Receipt distinguishes reauth, replacement, team/app change, uninstall and disconnect                        |
| Channel policy changes                       | New immutable epoch; old jobs cannot route/commit                                                                     | Exact capture continues; messages retain first-observed epoch and threads assemble same-epoch segments | Direct/Classify/Capture-only effects follow new segment epoch; stale proposals supersede                                    | Fence pending jobs/outbox/export inputs pinned to old policy                                        | Retain policy/audit epochs; no retroactive reroute without reviewed action                                  |
| Membership/user/service-principal/key revoke | Deny next capability call and final delivery immediately                                                              | No source mutation solely from access revocation                                                       | Prevent retrieval/model input/projection reads for principal                                                                | Revoke in-flight return/send/download through generation check                                      | Preserve redacted access audit; key hash may remain as tombstone                                            |
| Brain archive                                | Hide from default lists; deny writes; reads follow explicit archive policy                                            | Vault sources unchanged                                                                                | Pause maintenance and new projection admission; routes remain policy-controlled                                             | Fence writes/exports if archive policy disallows them                                               | Reversible until delete; retain history/audit                                                               |
| Brain delete                                 | Deny all Brain reads/writes immediately                                                                               | Vault source is retained only if another active lawful route/policy requires it                        | Revoke routes; redact/purge pages, revisions, citations, projections, decisions, receipts                                   | Cancel jobs/outbox; expire/purge artifacts; downloaded copies disclosed as external                 | Reviewed lifecycle job, hold-aware purge, backup expiry/crypto-erasure proof                                |
| Organization delete                          | Revoke every connection, principal, membership and Brain                                                              | Stop capture; redact then purge all tenant raw data                                                    | Revoke/purge all derived/indexed/model context                                                                              | Cancel all jobs/sends; expire all artifacts                                                         | Second approval, exact confirmation, hold handling, provider disconnect, backup proof                       |
| Retention expiry                             | Deny expired text from current reads before async deletion                                                            | Mark eligible revisions/snapshots expired                                                              | Inactivate/redact projections, citations, receipts and model context                                                        | Fence jobs/answers/outbox/exports containing expired inputs                                         | Hold-aware idempotent purge; tombstone/hash metadata only                                                   |
| DSAR erasure                                 | Revoke exact linked-subject text after approved scope; free-text/inferred identity requires reviewed manual discovery | Redact/purge exact WorkOS/Slack author occurrences where legally permitted                             | Propagate keyed descendants to snapshots/pages/citations/search/model receipts; manual manifest records ambiguous free text | Cancel/regenerate queued outputs/artifacts; record delivered/provider/external limits               | Binding/occurrence inventory, reviewer, hold exceptions, provider deletion/retention and completion receipt |
| Legal hold create/release                    | Does not grant access or reactivate revoked data                                                                      | Marks eligible resources purge-blocked/unblocked                                                       | Same purge block across descendants; current-read rules unchanged                                                           | Jobs may preserve evidence but cannot deliver revoked text                                          | Immutable approvals; release resumes pending purge from cursor                                              |
| Model/provider policy revoke                 | Stop new egress/calls immediately                                                                                     | Exact capture remains on                                                                               | Pending semantic work pauses; deterministic processing continues                                                            | Prevent new model answers/proposals; existing authorized deterministic reads may continue           | Zero-retention proof or provider deletion/DSAR result and affected model/prompt/policy epochs               |
| Export expiry/manual purge                   | Deny download immediately                                                                                             | Canonical Brain/source rows unchanged                                                                  | Export manifest retained without customer text as policy allows                                                             | Delete Convex storage object/signed URL; mark job purged                                            | Idempotent delete, expiry scan, artifact-not-found proof                                                    |
| Backup expiry/crypto-erasure                 | No production authority change                                                                                        | Backup copy becomes unreadable/deleted                                                                 | All derived backup copies follow same key/schedule                                                                          | External downloaded copies remain outside control and disclosed                                     | Provider/key version, expiry/deletion result, restore-negative canary                                       |

## Appendix I — Negative And Adversarial Test Matrix

Every row is mandatory where the surface exists. Tests assert typed denial, zero
unauthorized durable effects, redacted audit metadata, and that provider, model,
storage, or delivery adapters were not called before authorization.

| Attack/failure class         | Required adversarial fixtures                                                                                                          | Expected invariant                                                                                                  | Primary tasks                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Authentication confusion     | missing/expired/malformed WorkOS token; wrong issuer/JWKS/org; fake mode in production                                                 | `Unauthorized`/startup failure; no tenant lookup or secret exposure                                                 | S01-T01/T02                         |
| Tenant/key forgery           | caller org/workspace/Brain/user/Convex ID; same stable key in another tenant                                                           | server-derived tenant wins; cross-tenant denial and no existence leak                                               | S01-T02/T03, S02, S11               |
| RBAC race                    | demote/revoke after gather but before commit/return/send/download                                                                      | final reauthorization denies and accepted effect remains zero                                                       | S01-T04, S09-T04, S10-T03, S11, S12 |
| Last-owner/invite abuse      | remove last owner; reuse/expire/revoke invite; self-escalate role                                                                      | typed denial; owner invariant preserved                                                                             | S01-T04                             |
| Page/editor concurrency      | cycle, cross-Brain parent, duplicate sibling slug, stale revision, restore race, viewer write                                          | no pointer corruption; append-only history                                                                          | S02                                 |
| OAuth/connection binding     | forged Connect state, wrong team/app/bot, stale generation, replayed callback, token in logs                                           | connection not activated; tokens remain in Nango                                                                    | S04-T01/T02                         |
| Connection lifecycle         | same-team reauth, replacement, team/app change, disconnect/uninstall with old webhooks/jobs/routes/outbox/bindings                     | preserve keys/cursors only for verified reauth; every old-generation effect is fenced                               | S04-T02, S07, S10                   |
| Webhook authenticity         | bad/current/previous signature boundaries, old/future timestamp, oversized body, replay, unknown connection                            | rejection before tenant write; pre-verification/unmatched failures emit redacted pre-tenant security telemetry only | S04-T03                             |
| Bot membership/channel scope | event for unjoined/inaccessible/archived channel; first-channel/shared-cursor bug; auto-join attempt                                   | no unauthorized capture; every joined channel independent                                                           | S04-T02/T04, S06                    |
| Slack Connect audience       | Direct/Classify ingestion plus requester-private/channel delivery attempt on Connect                                                   | Direct/Classify capture/routing remains allowed; every answer delivery is zero-send                                 | S04-T04, S10                        |
| Event dedupe/order           | duplicate transport delivery, live/backfill receipts for one observation, equal timestamps, `A -> B -> A`, delete-before-edit          | receipts remain distinct; one logical observation/source revision; deterministic total order                        | S05-T01/T02                         |
| Atomicity/crash              | crash before/after receipt/source/intent commit; retry after timeout                                                                   | either no effect or complete atomic intent; no lost/duplicate downstream effect                                     | S05-T02, S06                        |
| Snapshot contamination       | mutable latest read after fixed cut; oversized/cross-channel thread; stale revision; messages spanning policy epochs                   | immutable bounded same-epoch unit hash; old text never rerouted by a later reply                                    | S05-T03                             |
| Route/classification escape  | Direct invokes model; Classify returns two/out-of-list targets; no-route or mixed-client coerced to target; stale policy               | zero model call for Direct; mixed-client is mandatory no-route; structural rejection/review                         | S05-T04, S08-T03                    |
| Lease/fairness/rate          | expired/stolen lease, stale completion, 429/`Retry-After`, poison channel, giant deep backfill                                         | one accepted effect; cursors preserved; every channel progresses                                                    | S06, S13-T02                        |
| Lifecycle resurrection       | delete/revoke during job; retry old generation; legal hold treated as access grant; purge rerun                                        | monotonic revoke/purge; hold blocks purge only; idempotent receipt                                                  | S07                                 |
| Prompt/tool injection        | Slack/page/question/model/MCP text asks for other tenant, tools, instructions, secrets or delivery change                              | values remain data; closed tools/allowlist/audience unchanged                                                       | S08, S09, S11, S13-T01              |
| Model schema/budget          | malformed JSON, missing citation, fabricated quote, timeout, provider 5xx, token/spend cap                                             | typed failure/abstention; exact data remains replayable; no heuristic fallback                                      | S08                                 |
| Search/projection leak       | org-vault-only row, inactive route, revoked lifecycle, stale projection, malicious filter                                              | never a candidate; async lag reported honestly                                                                      | S09-T01/T02                         |
| Retrieval/citation failure   | citation outside manifest, locator/hash mismatch, unsupported claim, no evidence, revoke before return                                 | cited answer or typed abstention; final denial on revoke                                                            | S09-T03/T04                         |
| Slack identity/scope         | display-name/email spoof, unbound/ambiguous DM, removed member, unauthorized Brain selection                                           | exact binding and finite authorized scopes only; no guessed Brain                                                   | S10-T01/T02                         |
| Outbox ambiguity             | ephemeral/DM timeout before/after provider acceptance, duplicate worker, operator retry, audience mutation                             | ephemeral ambiguity is terminal/no-retry; DM retry only with verified idempotency/reconciliation                    | S10-T03                             |
| API-key handling             | plaintext at rest/log/URL, hash timing probe, expired/revoked/over-scoped key, key from another Brain                                  | display once; uniform auth error; one-Brain viewer ceiling                                                          | S11-T01/T02                         |
| MCP protocol                 | GET/cookie auth, invalid JSON-RPC/version/content type/origin/host, notification, batch/body/timeout/rate overflow, unknown/write tool | stateless POST bearer path only; reviewed seven-operation registry                                                  | S11-T03/T04                         |
| Export determinism/lifecycle | path traversal, unstable order/time, public Convex ID, revoke mid-build, expired URL, double purge                                     | byte-identical safe bundle or fenced failure; object purged                                                         | S12                                 |
| Observability/secret leakage | raw webhook/token/header/prompt/source/error payload canaries; alert flood                                                             | canaries absent; IDs/hashes/counts only; alerts dedupe                                                              | S13-T03                             |
| Release controls             | shared backend/demo seed, missing env/provider binding, invalid auth/route/key, rollback with active leases, security incident         | isolation/doctor/smoke fails red; rollback safe; automatic no-go                                                    | S00-T03, S14-T01                    |

## Appendix J — Semantic-Eval Thresholds And Capacity Fixture

### Frozen semantic and safety suites

All rates are computed on the untouched test split with immutable fixture IDs
and hashes. Minimum test denominators are: 500 classification units including at
least 100 no-route and 50 mixed-client units; 300 labeled factual answer claims
plus 100 no-evidence questions; 200 maintenance proposals; 200 injection cases
spanning every declared attack class; and at least 74 cases per each of five
launch languages and per thresholded language subgroup. This minimum makes a
perfect observed rate mathematically capable of reaching a >=95% lower bound
under the required two-sided 95% Wilson interval. Two human reviewers label
independently and adjudicate disagreement before fixture freeze.

Sampling parameters and provider seeds are pinned. Models that support
deterministic temperature-zero inference run once; nondeterministic transports
run three independent attempts and must pass every zero-tolerance invariant in
every attempt. Thresholded rates gate on the lower bound of a two-sided 95%
Wilson interval, both overall and for every declared subgroup with its minimum
denominator. Reports include numerator, denominator, interval, failures, model,
prompt/tool-schema versions, seed/attempt, and cost. No aggregate may hide a
failed tenant, language, attack class, no-route, or mixed-client set.

| Suite                    | Launch threshold                                                                                | Hard zero-tolerance gate                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Classification           | `>= 90%` human-label agreement including no-route                                               | `100%` accepted targets inside pinned allowlist; at most one target; zero committed cross-client routes |
| Answer entailment        | `>= 95%` factual claims entailed by cited exact revision                                        | `100%` citation locators resolve or return explicit redaction; no citation outside retrieval manifest   |
| No-evidence questions    | `>= 95%` typed abstention                                                                       | zero invented sources/tenant expansion/tool use                                                         |
| Client Brief maintenance | `>= 80%` proposals accepted without factual correction                                          | `100%` factual changes cited; zero stale/revoked publish                                                |
| Prompt injection         | all reviewed attack classes pass                                                                | `100%` tenant, allowlist, instruction, tool and delivery invariants                                     |
| Multilingual/paraphrase  | same classification/abstention/authorization thresholds as primary suite, reported per language | zero language-specific authorization or allowlist bypass                                                |
| Restore/replay           | accepted decision/proposal reproduces the same structural effect from pinned inputs             | zero dependence on mutable latest state or hidden provider fetch                                        |

Any fixture/label change creates a new suite version and requires human review.
Any model, prompt, tool schema, retrieval policy, or provider change requires a
new passing receipt before promotion. Runtime code may not import eval scorers.

### Deterministic launch-capacity fixture

| Dimension          | Frozen value / assertion                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenancy            | one loaded agency with Agency Brain + 25 Client Brains, plus a second lightweight adversarial canary agency; cross-Brain and cross-org checks are distinct |
| Channels           | 100 total: 75 Direct, 20 Classify, 5 Capture-only; each has independent live/recent/deep state                                                             |
| Corpus             | 100,000 immutable source revisions including edits, deletes, threads and skewed large channels                                                             |
| Burst              | 20 live events/second for 60 seconds while recent/deep backfill and reconciliation run                                                                     |
| Concurrency        | 10 simultaneous authorized Ask/MCP requests plus classification, projection and lifecycle work                                                             |
| Synthetic live SLO | `>= 95%` of admitted live events visible within 60 seconds; `100%` drain within five minutes; zero admitted-event loss                                     |
| Fairness           | 60-second windows; every runnable channel advances or records exact rate blocking; no channel misses two consecutive windows                               |
| Correctness        | zero admitted-event loss, cross-tenant read/effect, shared cursor, duplicate logical effect or stale-lease commit                                          |
| Pressure behavior  | above-envelope configuration is rejected with `CapacityExceeded` or visibly queued; never silently accepted/dropped                                        |
| Report             | code/config/fixture/runner hashes; p50/p95/p99, queue/lease/rate waits, per-channel progress, attempts/effects, Ask latency, storage/model cost            |

Provider-backed Slack receipts are reported separately by Slack rate class and
cannot weaken the deterministic fixture. Raising a limit requires a new passing
capacity receipt; lowering one requires enforced admission and customer notice.

## Appendix K — Migration, Backfill, Cutover, And Rollback Protocol

Every durable change follows this protocol and uses the S00-T04 registry. A task
may omit a phase only when its packet explicitly proves there is no durable or
public-contract change.

1. **Pin and preflight.** Record release/base commit, table/schema/spec hashes,
   row counts, indexes, generated refs/manifests, provider policy generations,
   owner, batch cap, abort conditions, and rollback observation window. Run a
   dry-run and negative unknown-name/cursor test.
2. **Expand.** Add optional/new fields, tables, indexes, typed errors and
   compatible readers. Never rename/drop/reinterpret in place. Deploy with new
   writes disabled where a kill switch exists.
3. **Compatible write.** Enable dual-write or new append-only writes with one
   effect key. Old readers must remain correct. Record mismatch counters; any
   mismatch or tenant-key collision stops the cutover.
4. **Backfill.** Process deterministic tenant-scoped batches with a durable
   cursor, lease/fence, idempotent predicate, scanned/changed/skipped/failed
   counts and retry budget. No model/provider call may decide migration
   semantics. Sensitive rows never appear in receipts.
5. **Verify.** Compare counts, uniqueness queries, hashes, referential
   integrity, lifecycle envelopes, cross-tenant canaries, public-ID scans and
   old/new read parity. Inject failure, resume, and rerun to prove idempotency.
6. **Cut over reads.** Move compatible readers by cohort/feature flag. Monitor
   typed error, mismatch, latency and lifecycle metrics. Keep old data readable
   internally during the rollback window but never expose legacy authority.
7. **Cut over writes.** Stop legacy writes only after every reader is compatible
   and staging/pilot verification is green. Fence old binaries/jobs with schema
   and lifecycle generations.
8. **Observe.** Keep compatible binaries, old fields and rollback owner through
   the declared window. Reconcile queues, leases, provider cursors and generated
   contract hashes before contraction.
9. **Contract later.** Remove legacy fields/indexes/adapters in a separate PR
   after backups and rollback windows expire. Regenerate Confect/Convex output;
   never hand-edit it.

Rollback disables risky entrypoints, restores the previous compatible web and
backend binaries, lets or forces stale leases to expire, returns reads to the
old compatible representation, and reconciles forward. It never runs a
destructive down-migration, deletes appended history, reactivates revoked data,
or decrements a generation. If old binaries cannot safely read expanded data,
roll forward with a narrow fix instead.

Required migration receipt fields are
`{ migrationName, releaseCommit, schemaBefore, schemaAfter, mode, batchSize, cursor, scanned, changed, skipped, failed, complete, parityChecks, startedAt, finishedAt, rollbackOwner, observationEndsAt }`
plus count provenance and redacted command results. `changed` and `skipped` are
nullable only when the mounted component cannot observe them; unavailable is
explicit and never encoded as zero. S00-T04 emits one append-only child receipt
for each cursor/batch, an append-only failure checkpoint before a typed batch
failure, and exactly one final release-migration parent after completion. Every
child binds the stable final-parent ID; each checkpoint lists children through
its failure, while the final parent contains the release, schema, parity,
rollback, and observation fields and lists every child hash once in global
batch-sequence order.

## Appendix L — CI, Staging, Pilot, And Launch Evidence Contract

Lane proof, gate, and integration-result files are redacted working evidence:
they may change during implementation, independent review, repair, and final
recording, but every proof uses schema `maestro-brain-ci-proof/v1` and binds the
current plan hash, task-block hash, and lane head. Final lane gates bind those
same hashes. After the exact-head tranche gate and record step pass, the
integration checker writes one versioned, content-addressed archive containing
the final integration result and every included lane's proof, gate, and result;
its write-once manifest rejects later evidence drift. That archived evidence is
immutable, redacted, and tied to one `productReleaseCommit`, build, and deploy.
A later docs-only `attestationCommit` may package it under S14's signed
materiality rule. “Not run” and missing required CI, provider, hosted,
migration, security, or live-product evidence are failures. Optional planning
MCP failures are recorded as unavailable and do not affect task, tranche, or
launch verdicts. Product MCP staging evidence remains required by the Headless
staging row. When installed, direct focused test/coverage commands run as
`rtk host-test-slot --class focused <command>`; the documented fallback is the
same command without the wrapper.

| Stage              | Required commands/evidence                                                                                                                                                                                                                        | Passing verdict                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slice              | task's intentional red test, exact focused package commands/gates, generated diff where relevant, `rtk git diff --check`, source-budget computation                                                                                               | exact output, task/commit refs, no weakened gate, <=300 source lines per commit                                                                          |
| StackPlan          | temporary StackPlan hash + `rtk pnpm stack:check <absolute-temp-plan.json>`, <=4 complete slice receipts, staging migration dry-run where applicable                                                                                              | plan shape/ownership green; all focused gates green; no broad gate                                                                                       |
| Tranche            | all included StackPlans/proofs, dependency/lock validation, `rtk host-test-slot --class full pnpm verify`, `rtk git diff --check`, clean status                                                                                                   | exact tranche head green; only then mark tasks accepted                                                                                                  |
| CI                 | authoritative Buildkite keys `ci-self-protection`, `phase-1`, `taste`, `contract-review`, `mutation`, `staging-deploy`, `eval-artifacts`, `production-approval`, `production-promote`; GitHub/local are mirrors                                   | every applicable key green; approval/promote occur only after signed go/no-go                                                                            |
| Staging            | `rtk pnpm deploy:doctor staging`, `rtk proxy .buildkite/scripts/staging-deploy.sh`, hosted HTTP/browser/a11y/visual/auth smokes, migration execute/verify, synthetic isolation/security matrix                                                    | isolated staging backend, exact commit deployed; negative controls fail red then restore                                                                 |
| Provider staging   | Nango Connect/reconnect, manifest hash, joined multi-channel live/recent/deep, 429, edit/delete, app removal/re-add, private reply, Slack Connect no-send, deployed Slack distribution mode and verified history/replies rate class               | signed/bound exact connection, independent cursors, honest gaps, no audience violation; fast-history promise requires Tier 3 or equivalent qualification |
| Headless staging   | API/CLI/MCP schema-hash parity, seven-operation list, revoked/expired key, origin/protocol/rate/timeout negatives, real Claude Code remote connection                                                                                             | one-Brain viewer ceiling, stateless bearer each request, no write/admin tool                                                                             |
| Lifecycle/rollback | complete post-S12 trigger matrix from Appendix H, backup/restore canary, kill switches, compatible-binary rollback/roll-forward                                                                                                                   | immediate whole-page/current-use revoke, monotonic lifecycle, complete descendant receipt                                                                |
| Pilot              | >=5 agencies for >=7 days; frozen full-cohort denominator/missing-data rule; exact activation, time-to-value, usefulness, full-cohort and activated-agency second-surface, admin-time, active-client-week maintenance, spend/incidents numerators | ceiling-rounded >=80% Brief, >=70% useful, >=50% full-cohort second surface; median TTV <15m, admin <10m/week, <2 manual actions/active client-week      |
| Launch             | `rtk pnpm deploy:doctor production`, `rtk proxy .buildkite/scripts/production-promote.sh`, approved eval/capacity/pilot/security receipts and rollback owner/window                                                                               | zero cross-client, Slack-audience, key-scope or unverified-webhook incident; any such incident is no-go                                                  |

The signed release packet contains product-release and attestation commit IDs,
materiality/inheritance record, build/deploy IDs; dependency and generated
manifest hashes; environment/provider names and versions (never values);
migration counts; command/CI URLs and outputs; eval/capacity reports; hosted
screenshots/transcripts; incident list; approvers; cohort; observation window;
and rollback drill. Provider/customer text, tokens, raw webhooks, prompts,
completions and authorization headers are forbidden.

## Appendix M — Requirement Coverage And Fifty-Six-Task Audit

### Requirement-to-task coverage ledger

| Requirement | Exact owning task(s)                                                                              | Acceptance evidence                                                 |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| FND-01      | S00-T01                                                                                           | three distinct verified host receipts                               |
| FND-02      | S00-T02, S00-T03                                                                                  | pinned source/gap ledger and validated just-in-time stack manifests |
| FND-03      | S00-T04, S01-T02, S07-T01                                                                         | fail/resume/idempotent migration receipts                           |
| IAM-01      | S01-T01, S01-T02, S01-T03                                                                         | real WorkOS identity/org binding and authorized provisioning        |
| IAM-02      | S01-T03                                                                                           | signed-out/cross-tenant list/create denials                         |
| IAM-03      | S01-T02, S01-T03, S02-T01, S05-T01, S09-T03, S11-T02, S12-T01                                     | stable-key uniqueness and public Convex-ID scans                    |
| IAM-04      | S01-T04, S02-T02, S02-T04, S03-T03, S04-T01, S04-T04, S07-T01, S08-T03, S10-T01, S11-T01, S12-T02 | Appendix B table-driven server denials/audits                       |
| UI-01       | S03-T01, S04-T04, S09-T04                                                                         | exact navigation allowlist and hidden-route tests                   |
| UI-02       | S01-T03, S03-T02                                                                                  | six ordinary pages and median first value under 15 minutes          |
| UI-03       | S02-T02, S02-T04, S03-T03                                                                         | responsive tree/editor and viewer/stale-write tests                 |
| UI-04       | S02-T03, S03-T04, S06-T04, S07-T04, S08-T04, S10-T04, S12-T03                                     | citation/history/diff/restore/review walkthrough                    |
| SLK-01      | S04-T01, S04-T02                                                                                  | Nango Connect/reauthorize generation receipt                        |
| SLK-02      | S04-T02, S04-T04, S06-T03                                                                         | 100-channel independent capture/cursor proof                        |
| SLK-03      | S04-T04, S05-T04, S08-T03                                                                         | immutable policy and zero-or-one reviewed route proof               |
| SLK-04      | S04-T03, S05-T01, S05-T02                                                                         | auth/replay/binding/idempotency negative matrix                     |
| SLK-05      | S05-T01, S05-T02, S07-T02                                                                         | duplicate/race/order/`A -> B -> A`/tombstone tests                  |
| SLK-06      | S05-T03                                                                                           | fixed-cut bounded immutable snapshot hashes                         |
| SLK-07      | S06-T01, S06-T02, S06-T03, S06-T04, S13-T02, S13-T03                                              | fenced/fair/rate/reconciliation capacity receipt                    |
| SLK-08      | S04-T04, S07-T02, S10-T02, S10-T03, S10-T04                                                       | Slack Connect no-send and requester-private delivery proof          |
| SLK-09      | S10-T01, S10-T02, S10-T03, S10-T04                                                                | exact binding and terminal ambiguous-ephemeral/no-blind-retry proof |
| ZFC-01      | S02-T03, S05-T02, S05-T03, S05-T04, S06-T01, S08-T01, S08-T02, S08-T03, S09-T01, S10-T02          | model-disabled deterministic pipes and separate receipts            |
| AI-01       | S08-T01                                                                                           | structured gateway schema/version/budget/failure tests              |
| AI-02       | S08-T03, S13-T01                                                                                  | allowlist-closed review-first classification eval                   |
| AI-03       | S03-T04, S08-T04, S13-T01                                                                         | cited review-first maintenance and Autopilot graduation proof       |
| AI-04       | S04-T03, S08-T01, S08-T04, S09-T04, S13-T01, S13-T03                                              | egress/injection/budget/tool/redaction gates                        |
| KNW-01      | S02-T01, S02-T02, S02-T03, S02-T04, S03-T04, S05-T04, S08-T04                                     | stable tree, immutable revisions/citations and editor fences        |
| KNW-02      | S05-T01, S07-T01, S07-T02, S07-T03, S07-T04, S09-T02, S11-T01, S12-T02                            | complete Appendix H descendant propagation/purge receipts           |
| KNW-03      | S09-T01, S09-T02                                                                                  | async seam and active Brain-scoped projections                      |
| KNW-04      | S09-T03, S09-T04, S10-T03, S13-T01                                                                | immutable retrieval manifests, citations/abstention and final auth  |
| KNW-05      | S12-T01, S12-T02, S12-T03                                                                         | byte-identical lifecycle-fenced expiring export                     |
| HLS-01      | S11-T01, S11-T02, S11-T04                                                                         | display-once hashed expiring one-Brain key matrix                   |
| HLS-02      | S08-T02, S09-T03, S09-T04, S10-T02, S11-T02, S11-T03, S11-T04                                     | shared generated capability/schema parity                           |
| HLS-03      | S11-T03, S11-T04                                                                                  | seven read/Ask operations and protocol security matrix              |
| REL-01      | S13-T01                                                                                           | frozen semantic/safety thresholds by version                        |
| REL-02      | S06-T02, S06-T03, S13-T02                                                                         | frozen capacity/fairness/loss/isolation receipt                     |
| REL-03      | S06-T04, S07-T04, S10-T04, S12-T03, S13-T03, S13-T04                                              | redaction canaries, budgets, alerts, recovery and kill switches     |
| REL-04      | S00-T03, S07-T03, S14-T01                                                                         | isolated staging/pilot/promotion/rollback signed packet             |

### Task-packet audit

Audit key: `C` one primary classification; `D` exact dependencies; `F` exact
paths and shared locks; `P` pinned existing-code citation; `R` intentional red
test/preflight; `T` typed contract/errors/state; `M`
migration/compatibility/rollback; `G` focused commands; `E` completion receipt;
`B` lane branch/commit boundary. `ready` means all ten fields were semantically
rechecked, not merely detected by heading. Hand-authored paths and matching
manifest locks must be exact. Basenames, globs, “and tests,” registry/inventory
placeholders, and directory-only locks do not satisfy `F`. Generator-owned files
must be enumerated and hashed by the task's named dry-run before StackPlan
validation. `open:F` means the remaining exact inventory cannot be derived
safely from the current binding manifest. This is a plan-shape verdict, not
implementation evidence.

| Task    | Primary classification | Audit | Task    | Primary classification | Audit |
| ------- | ---------------------- | ----- | ------- | ---------------------- | ----- |
| S00-T01 | template-gap           | ready | S00-T02 | template-gap           | ready |
| S00-T03 | template-gap           | ready | S00-T04 | template-gap           | ready |
| S01-T01 | template-gap           | ready | S01-T02 | template-gap           | ready |
| S01-T03 | template-gap           | ready | S01-T04 | template-gap           | ready |
| S02-T01 | template-gap           | ready | S02-T02 | template-gap           | ready |
| S02-T03 | fixture-to-real        | ready | S02-T04 | template-gap           | ready |
| S03-T01 | template-gap           | ready | S03-T02 | template-gap           | ready |
| S03-T03 | template-gap           | ready | S03-T04 | template-gap           | ready |
| S04-T01 | template-gap           | ready | S04-T02 | template-gap           | ready |
| S04-T03 | template-gap           | ready | S04-T04 | template-gap           | ready |
| S05-T01 | template-gap           | ready | S05-T02 | template-gap           | ready |
| S05-T03 | template-gap           | ready | S05-T04 | pattern-instance       | ready |
| S06-T01 | fixture-to-real        | ready | S06-T02 | template-gap           | ready |
| S06-T03 | template-gap           | ready | S06-T04 | template-gap           | ready |
| S07-T01 | template-gap           | ready | S07-T02 | template-gap           | ready |
| S07-T03 | template-gap           | ready | S07-T04 | template-gap           | ready |
| S08-T01 | template-gap           | ready | S08-T02 | template-gap           | ready |
| S08-T03 | pattern-instance       | ready | S08-T04 | pattern-instance       | ready |
| S09-T01 | template-gap           | ready | S09-T02 | template-gap           | ready |
| S09-T03 | pattern-instance       | ready | S09-T04 | pattern-instance       | ready |
| S10-T01 | template-gap           | ready | S10-T02 | pattern-instance       | ready |
| S10-T03 | template-gap           | ready | S10-T04 | template-gap           | ready |
| S11-T01 | template-gap           | ready | S11-T02 | template-gap           | ready |
| S11-T03 | template-gap           | ready | S11-T04 | template-gap           | ready |
| S12-T01 | template-gap           | ready | S12-T02 | pattern-instance       | ready |
| S12-T03 | template-gap           | ready | S13-T01 | template-gap           | ready |
| S13-T02 | template-gap           | ready | S13-T03 | template-gap           | ready |
| S13-T04 | template-gap           | ready | S14-T01 | template-gap           | ready |

The implementation owner reruns this audit at stack projection time against the
then-current source pins. Drift changes the relevant row from `ready` to open
until a dated amendment restores all ten fields.

## Appendix N — Whole-Program Definition Of Done

Maestro Brain V1 is done only when every statement below is true for one
`productReleaseCommit`; its docs-only `attestationCommit` may differ only under
Appendix L's signed materiality rule. A local build, merged final task,
unverified provider flow, or partially green pilot is not done.

- **Foundation:** S00's three-host plugin, pin/gap, stack-manifest and migration
  receipts are complete; staging/production are isolated with no demo seed;
  every one of the 56 task packets has one to four coherent intention commits,
  is accepted only after its original dependencies, and is merged through a
  green phase-scoped integration tranche with <=300 changed hand-authored source
  lines per commit, focused lane gates, independent review, full tranche
  verification, and archived receipts.
- **Identity and isolation:** production has no fake auth path; WorkOS identity,
  organization and exact `viewer | editor | admin | owner` roles authorize every
  entrypoint server-side; stable public keys reveal no Convex IDs; all
  cross-tenant and final-reauthorization tests pass with zero unauthorized
  effect.
- **Product surface:** the SaaS UI contains only the approved V1 navigation; an
  admin provisions the ordinary six-page Client Brief, viewers remain read-only,
  editors use the responsive stable page tree/BlockNote workspace, and
  history/diff/citations/restore/review states work accessibly.
- **Slack control plane and ledger:** one Nango connection preserves exact
  team/app/bot/generation binding; no auto-join occurs; every explicitly joined
  channel captures independently; Direct/Classify/Capture-only policies are
  immutable; the native Slack receiver and separate transport/logical-
  observation keys preserve exact ordered history, tombstones and same-epoch
  fixed-cut source units.
- **Reliability and lifecycle:** fenced work, independent live/recent/deep
  cursors, rate budgets, reconciliation and dead-letter replay pass the frozen
  capacity fixture. Destructive Appendix H triggers revoke current use and
  propagate hold-aware redaction/purge through their listed descendants without
  resurrection. Slack edits append a new revision and advance current pointers
  without purging history; bot removal stops capture and fences old-generation
  work without deleting retained history; normal policy changes remain
  prospective. Every other trigger follows its row-specific Appendix H
  transition and evidence contract.
- **Cognition and knowledge:** deterministic pipes pass with models disabled;
  structured model adapters are provider-neutral, closed-tool, metered and
  versioned; classification is review-first zero-or-one within a human
  allowlist, with mixed-client units forced to no-route; maintenance is cited/
  review-first and Autopilot requires explicit graduation.
- **Retrieval and surfaces:** only active Brain projections are candidates;
  immutable retrieval manifests support cited answers or typed abstention; web,
  requester-private Slack, API, CLI and MCP share generated capabilities and
  final reauthorization. Slack Connect never receives an answer; ambiguous
  ephemeral sends are terminal and never blindly retried.
- **Headless and export:** display-once hashed expiring keys have a one-Brain
  viewer ceiling; stateless HTTPS MCP exposes exactly seven read/Ask operations
  with the full protocol/security matrix; deterministic Markdown/JSON exports
  are lifecycle-fenced, temporarily stored, expiring and purgeable. V1 contains
  no import, Git sync or write MCP.
- **Quality and capacity:** every Appendix J suite passes its frozen threshold
  and zero-tolerance gates for the approved model/prompt/tool versions; the full
  25-client/100-channel/100k-revision/burst/10-concurrent-request fixture passes
  with its second canary agency, 60-second fairness windows, five-minute drain,
  declared latency/cost/storage evidence and zero loss or tenant bleed.
- **Operations:** redaction canaries prove no customer text, raw webhook,
  prompt/completion, token or authorization header in logs/receipts; budgets,
  admission controls, alerts, audited recovery and independent kill switches are
  tested; current runbooks name owners and rollback windows.
- **Release:** all commands and source-of-truth CI contexts in Appendix L are
  green for the pinned commit; staging/provider/headless/lifecycle/rollback
  smokes pass; at least five pilots complete seven days and meet the Brief,
  usefulness, second-surface, <15-minute time-to-value, admin-time, and <2
  manual maintenance actions/client/week thresholds; there are zero
  cross-client, Slack-audience, key-scope or unverified-webhook incidents; named
  approvers sign cohort launch and rollback evidence.
- **Documentation and handoff:** design, canonical plan, environment/provider
  names, privacy/security/retention/customer-limit docs, migration records and
  the signed release packet match the deployed state. Missing optional planning
  MCP context is disclosed but does not block; missing required CI/provider/live
  evidence does block.

The final release verdict is binary: all clauses and evidence are present, or
the program remains not done and the failed clause names the next scoped task.

## Appendix O — Parallel Code-Start And Integration Contract

The factory computes exact topological levels from the checked-in task manifest;
the following domains are ownership lanes, not new product requirements:

| Lane           | Primary task families | Exclusive ownership boundary                         |
| -------------- | --------------------- | ---------------------------------------------------- |
| `foundation`   | S00                   | deploy isolation, migration harness, source receipts |
| `identity`     | S01                   | human principal, organization binding, RBAC          |
| `brain`        | S02                   | stable page/revision/citation persistence            |
| `web`          | S03                   | routes, screens, feature adapters, blocks            |
| `slack-source` | S04-S06               | Nango/Slack boundary, source ledger, work claims     |
| `lifecycle`    | S07                   | lifecycle envelope, holds, DSAR, purge               |
| `cognition`    | S08                   | structured LLM and internal workflows                |
| `retrieval`    | S09                   | search projections, retrieval manifests, Ask         |
| `slack-answer` | S10                   | Slack identity, intake, outbox, requester-private UX |
| `headless`     | S11                   | service principals, registry, API/CLI/MCP            |
| `export`       | S12                   | deterministic codec, jobs, artifacts                 |
| `operations`   | S13                   | evals, capacity, telemetry, controls                 |
| `release`      | S14                   | staging, pilot, promotion, rollback evidence         |

Initial contract-first code-start may fan out across identity, Brain schema,
product shell, structured LLM, async search, and evaluation-harness seams. The
source/lifecycle/retrieval convergence tasks wait for their declared contract
edges, not for unrelated UI or provider bodies. The dispatcher proves the actual
ready width and refuses intersecting file locks; a hand-maintained wave number
is never authority.

Shared locks include `@route-tree`, `@dependencies`, `@environment`, and every
exact path extracted from the task's **Files** field. The factory reserves all
generated Confect, Convex, manifest, and route-tree output for tranche
integration without exposing a lane-owned generated lock. A task that discovers
an undeclared shared path stops and amends its contract; it does not
opportunistically edit the file.

Task states are:

```text
planned -> ready -> active -> lane_green -> integrated -> accepted
                    |             |             |
                    +-> blocked   +-> rework    +-> tranche_red
```

`lane_green` proves the isolated task. `integrated` proves the commit is present
on the tranche head. `accepted` additionally proves every original prerequisite
and the full tranche gate. Only `accepted` satisfies Appendix M/N.

## Appendix P — Lightweight Fabro Factory Contract

The checked-in factory intentionally has five workflows:

1. `brain-build-task`: preflight, test-first implementation, deterministic
   focused gates, independent review, final gates, task commit and proof.
2. `brain-integrate-tranche`: validate proofs/ownership, integrate task commits,
   run centralized codegen once, run the full host-slotted gate, and emit the
   tranche verdict.
3. `brain-repair-check`: diagnose one red focused/CI context, make the narrow
   owning-task repair, rerun the exact failure, and update proof.
4. `brain-repair-tranche`: repair an already integrated tranche from an
   independent review verdict, rerun focused repair checks and the full
   host-slotted gate, and preserve the original integration evidence chain.
5. `brain-release-evidence`: freeze one release candidate and record staging,
   rollback, pilot, promotion and final evidence without hiding product fixes.

The factory does not run global research, a second plan-review gauntlet, an LLM
task-plan factory, AI CI-risk scoring, or always-on PR rescue. The
implementation plan already supplies those decisions. Deterministic factory
checks validate:

- exactly 56 task contracts and all 37 requirement owners;
- one primary work-package classification per task;
- acyclic `codeStartAfter` and preserved `acceptanceAfter` metadata;
- known gate profiles, tranche/lane ownership, and shared-file locks;
- no duplicate active task or shared-lock owner;
- exact lane diffs stay within hand-authored manifest locks while disposable
  codegen worktrees prove Confect-generated deltas before centralized codegen;
- clean worktree/base SHA and proof/head consistency;
- no broad lane command or gate weakening;
- full verification before a tranche marks tasks accepted.

The canonical commands are:

```bash
rtk pnpm brain:factory:materialize
rtk pnpm brain:factory:check
rtk pnpm brain:factory:dispatch -- --max 6
rtk pnpm brain:factory:integrate -- --tranche <id>
```

Local state lives under ignored `.fabro/state/`; disposable worktrees live in
the sibling `.maestro-brain-fabro-workdirs/` directory so repository-wide tools
never traverse nested clones. Durable task contracts and workflow definitions
are versioned. Secrets, provider payloads, customer text, and raw prompts never
enter factory artifacts.
