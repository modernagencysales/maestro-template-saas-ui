# Porting Backlog: maestro → maestro-template

The running list of generic, reusable pieces that exist in the Maestro
production app (`modernagencysales/maestro`) and should be brought into this
template to make its seams real. This is deliberately exhaustive; not everything
here is urgent. See
[`how-this-relates-to-maestro.md`](./how-this-relates-to-maestro.md) for why the
two repos differ.

> **Execution note:** this file is the exhaustive inventory. Use
> [`porting-roadmap.md`](./porting-roadmap.md) for execution order, dependency
> sequencing, and "do not start yet" guardrails. The current `main` app shell,
> fake seed fixtures, hosted Saas UI business app, and visual tests are
> authoritative over older app files from the backlog branch.

Current readiness commands and the maturity model are authoritative for the
current template baseline. This backlog is a historical inventory of reusable
machinery and can lag recently merged implementation work; treat stale per-item
status text as backlog context, not readiness evidence. A `no` or `partial`
entry here means "not yet part of the generic reusable kit," not necessarily
"the current starter is incomplete."

## How to read this

- **Priority** — HIGH / MED / LOW for a diligence-grade, genuinely-useful shell.
- **Template status** — `no` (absent), `partial` (thin/related code exists),
  `stub` (one-line placeholder package/file), `fake-stub` (a same-named gate
  that only does substring/`existsSync` checks and must be replaced with the
  real implementation).
- **Path** — source in maestro, under `packages/convex/convex/` unless another
  root is given.

> ⚠️ **Everything ported is REWRITTEN in Confect/Effect — never copy-pasted.**
> maestro is plain Convex (`defineTable`, `query|mutation|action`,
> `ConvexError`, ad-hoc validators). The template's contract default is
> Confect/Effect, so every item below is a _translation_, not a lift:
>
> - tables → `Table.make(() => Schema.Struct({...}))`
> - functions → `FunctionSpec` (args/returns/errors as `Schema`) +
>   `FunctionImpl`
> - control flow → `Effect` (`Effect.gen`, typed `Schema.TaggedError`, not
>   thrown `ConvexError`); side effects behind Effect services
> - pure domain/`checks` helpers port most directly; capability _mutations_
>   (Sections A/R) and adapters (C) need the most reshaping into Effect. Ops/CLI
>   scripts (Section S deploy/tooling) stay Node `.mjs`/`.mts` — Confect applies
>   to the Convex backend, not the shell scripts. Treat maestro as the reference
>   implementation to learn the logic from, then re-express it.

Exclude maestro's business domain everywhere (LinkedIn/harvest, lead magnets,
campaigns, ghostwriting, GTM playbooks). Port the machinery, not the content.

## The four knowledge primitives

The point of this template is to ship the fundamental primitives every B2B SaaS
is built from — **generate** knowledge, **transform** it into another form,
**edit / visualize** it, and **act** on it — so a custom build reuses them
instead of rebuilding them. Each maps to sections below:

| Primitive            | What it means                                                                                                         | Sections      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Generate**         | produce knowledge (LLM calls, agents, ingestion, claims/concepts)                                                     | C, D, E, I, P |
| **Transform**        | turn knowledge from one form into another (workflows, transformation ledger, markdown/format conversion, projections) | F, P          |
| **Edit / visualize** | edit and see knowledge (co-editing docs, canvas, dashboards, tables, boards, timelines)                               | L, N, Q       |
| **Act**              | do something with knowledge (publish, deliver, schedule, approve, headless API)                                       | G, H, Q       |

Cross-cutting under all four: multi-tenancy & access (A), secrets/crypto (B),
**change tracking & versioning (O)**, billing/usage (H), quality gates (K), and
Convex component wiring (M).

---

## A. Multi-tenancy, identity & access control

> The items here are the **schema + domain** layer (tables and pure helpers).
> The multi-tenant _capability layer_ — the mutations/state-machines that
> actually run provisioning, roles, invites, and cross-tenant sharing, plus the
> enforcement holes — is the fiddly, expensive half and is itemized separately
> in **Section R**. Port A and R together; A alone is not a working tenancy
> layer.

1. **Organizations + org membership** — HIGH — no. `schema/organizations.ts`,
   `schema/organizationMembers.ts`, `domain/organization.ts`,
   `checks/organizationRole.ts`. The account tier above the workspace (org →
   workspaces), org roles, WorkOS-org mapping.
2. **Workspace members + role lattice** — HIGH — no.
   `schema/workspaceMembers.ts`, `checks/workspaceRole.ts`,
   `domain/membership.ts`. Who may act in a workspace + role rank order
   (`roleAtLeast`/`capRole`/`highestRole`). Template `workspaces` has no
   membership model.
3. **Member-permission gates (one source for client + server)** — MED — no.
   `checks/workspaceMemberPermissions.ts`. Shared min-role predicates that pin
   UI affordances and backend checks to a single definition.
4. **Workspace guest grants (cross-tenant sharing)** — MED — no.
   `schema/workspaceGuestGrants.ts`, `domain/guestGrant.ts`. Revocable scoped
   access from one org into another's workspace.
5. **Invitations (workspace or org)** — MED — no. `schema/invitations.ts`,
   `domain/invitation.ts`. Email-invite lifecycle, role re-validated on accept.
6. **Access-control accessor (`require*` helpers)** — HIGH — no.
   `adapters/auth.ts`. The one module that decides tenancy: `requireIdentity`,
   `requireUser`, `requireWorkspaceMember`, `requireOrganizationMember`,
   `assertOwningSide`; identity always from `ctx.auth`, opaque denials.
7. **Tenancy-scoped function wrappers** — HIGH — no. `adapters/functions.ts`.
   `workspaceQuery/Mutation/Action` + `organizationQuery/Mutation` verifying
   membership at a definition-site `minRole` and injecting verified scope into
   `ctx` (handlers never trust a caller-supplied `workspaceId`).
8. **Action-side tenancy bridge** — HIGH — no. `adapters/tenantAccess.ts`.
   `internalQuery` that `workspaceAction` calls via `ctx.runQuery` to re-verify
   membership (actions have no `ctx.db`).
9. **Idempotency-key validator** — MED — partial.
   `packages/convex/confect/shared/idempotencyKey.ts` now provides bounded
   URL-safe caller-key validation, with
   `packages/convex/test/shared-idempotency-key.test.ts` coverage. The headless
   executor rejects missing, padded, too-long, or non-URL-safe keys before
   external API/CLI/MCP-style writes dispatch, and the first real capability
   (`sourceGroundedBrief`) now rejects padded caller keys with typed
   `ValidationFailed` errors before fake/live execution.
   `ops.billing.recordUsage` now validates workspace-scoped usage idempotency
   keys before durable usage and ledger writes, and the notification email seam
   rejects padded/non-URL-safe delivery keys before sending while generating
   URL-safe action-digest keys. Dodo webhook normalization now emits URL-safe
   dedupe keys, and `ops.billing.applyWebhook` validates dedupe keys before
   persisting webhook event identity. The agent runtime also sanitizes malformed
   caller keys before recording denied/failed tool calls.
   `ops.versioning.append`, `ops.versioning.restore`, and
   `ops.versioning.reconcile` now validate version ledger idempotency keys
   before returning append-only history rows. `ops.transforms.runTransform` now
   validates transform run ledger keys before returning completed run receipts.
   `ops.coediting.createDocument`, `ops.coediting.appendVersion`, and
   `ops.coediting.createAnnotation` now validate document collaboration keys
   before deriving document/annotation ids or returning version receipts.
   Workflow ownership now validates workflow-run reservation keys before reading
   or inserting `workflowRuns`. `packages/integrations` fake billing ledger
   helpers and the generic billing checkout provider seam now reject malformed
   caller keys before deriving ledger, usage, or receipt IDs.
   `packages/template-core` versioning helpers now reject malformed versioning
   keys before storing append-only entries or deriving reconciliation keys.
   `packages/integrations` LLM completion receipts now reject malformed optional
   caller keys before preserving them in fake/live-ready receipts. Confect and
   `packages/template-core` action trigger idempotency keys and action digest
   dedupe keys are now URL-safe when generated from config hashes or time
   ranges. Remaining work: adopt the shared validator across every remaining
   durable ledger path that accepts caller-supplied idempotency keys.
10. **Workspace bootstrap/provision provider (web)** — MED — no.
    `apps/web/src/providers/workspace.tsx`. Idempotent first-sign-in
    provisioning self-heal, then exposes active `workspaceId` via context.

## B. Secrets, crypto & environment

11. **Typed env accessor with whitespace rejection** — HIGH — partial.
    `packages/convex/confect/shared/env.ts` now owns typed required/optional env
    reads, fake-mode live-secret bypass, `killSwitchOn()` / `LLM_DISABLED`, and
    `EnvConfigError` failures for missing, blank, and whitespace-contaminated
    required values. `packages/convex/test/shared-env.test.ts` pins the
    contract. `packages/integrations` provider readiness now reports
    whitespace-contaminated live env names without exposing values, and the CLI
    live readiness report surfaces those names from its allowlisted env decoder.
    The WorkOS AuthKit seam also rejects whitespace-contaminated live env values
    while reporting only env names. The web Vite env shim rejects
    whitespace-contaminated configured `VITE_CONVEX_URL` values instead of
    silently trimming them. `check:env-boundary` now fails product code that
    reads `process.env`, `import.meta.env`, or `Deno.env` outside the approved
    CLI, web, and Convex env boundary files. Remaining work: route every future
    backend integration through this shared accessor.
12. **Shared Web-Crypto token primitives** — HIGH — partial.
    `packages/convex/confect/shared/tokenCrypto.ts` provides Web Crypto
    `hmacSha256Base64Url`, `sha256Base64Url`, `base64Url{Encode,Decode}`,
    `constantTimeEqual`, and stable fingerprint support with
    `packages/convex/test/shared-token-crypto.test.ts`. Remaining work: add the
    exact hex-hash helper if a fork needs stored `sha256Hex(token)` rows.
13. **base64url byte helpers** — MED — partial.
    `packages/convex/confect/shared/base64Url.ts` re-exports the byte-level
    base64url helpers from the shared token-crypto module. Remaining work: add
    stricter malformed-input classification if signed external tokens need
    user-facing parse errors.
14. **Signed-token sign/verify/hash pattern** — MED — no.
    `checks/reviewTokenCrypto.ts`, `checks/agentDoorCrypto.ts`. HMAC-signed
    `<payload>.<hmac>` tokens; format checked before signature so shape errors
    never leak HMAC truthiness; store only `sha256Hex(token)`; injected
    `now`/`nonce`.
15. **Server nonce seam** — LOW — partial.
    `packages/convex/confect/shared/nonce.ts` provides deterministic test nonce
    sequences and a Web Crypto random-byte nonce seam, covered by
    `packages/convex/test/shared-clock-nonce.test.ts`. Remaining work: adopt
    this seam in every future token/id path that would otherwise reach for
    ambient randomness.
16. **Content fingerprint helper** — LOW — partial.
    `packages/convex/confect/shared/fingerprint.ts` re-exports stable sorted-key
    fingerprinting from the shared token-crypto module, with tests. Remaining
    work: apply it to future dedup/change-detection tables as those tables land.
17. **Closed error-code catalog + `typedError`** — MED — partial.
    `adapters/errors.ts`. Literal-union `ErrorCode`
    (`UNAUTHENTICATED`/`NO_WORKSPACE_ACCESS`/`RATE_LIMITED`/`SPEND_CAP_EXCEEDED`/
    `LLM_DISABLED`/…) + `typedError`/`isConvexError`. Template has Effect
    `TaggedError`s over a different surface; port the closed-code discipline.
18. **Server clock seam** — LOW — partial.
    `packages/convex/confect/shared/clock.ts` exposes Effect Clock-backed
    `currentTimeMillis`, `currentDate`, and `currentIso`, with `TestClock`
    coverage in `packages/convex/test/shared-clock-nonce.test.ts`. Remaining
    work: migrate any future persisted time-dependent logic through this seam.

## C. Provider adapters / integrations

19. **LLM gateway (single provider door)** — HIGH — no. `adapters/llm.ts` (+
    `llm.test.ts`, `llm.spend.test.ts`, `llm.agentModel.test.ts`). One-shot
    `complete()` + `buildAgentModel()` (AI-SDK `LanguageModelV3` wrapped with
    gateway middleware). The only place a model instance is constructed; bakes
    in kill-switch, rate-limit, spend-cap, telemetry. Provider swap = one file.
    **Replaces the template's canned `createProviderAdapter` for LLM.** 19b.
    **Narrow OpenRouter response parser** — LOW — no. `adapters/llmResponse.ts`.
    Defensive JSON parsing of the provider result.
20. **Global LLM kill-switch** — HIGH — partial.
    `packages/convex/confect/shared/env.ts` includes `killSwitchOn()` for
    `LLM_DISABLED`, and `packages/integrations/src/llm.ts` honors `LLM_DISABLED`
    in the starter LLM gateway. Remaining work: route every live model/agent
    execution path through the same gate before a fork enables production AI
    calls.
21. **Per-caller rate limiter** — HIGH — no (component not installed).
    `adapters/rateLimit.ts` (+ test) on `@convex-dev/rate-limiter`. Token-bucket
    `enforceLlmRateLimit` throwing `RATE_LIMITED`; reusable route + per-token
    limiter helpers.
22. **Daily spend-cap enforcement** — HIGH — no. `adapters/spend.ts` (+ test).
    Per-workspace daily cents bucket; consumes a pre-call estimate and throws
    `SPEND_CAP_EXCEEDED` before the provider is hit.
23. **Pure pre-call cost estimator** — HIGH — no. `domain/spend.ts`.
    Tokenizer-free conservative cents estimate (chars→tokens + output reserve +
    blended rate + floor); dollars→cents. Pure, property-testable.
24. **PostHog telemetry adapter + `$ai_generation` capture** — HIGH — stub
    (`packages/observability`). `adapters/posthog.ts`,
    `adapters/llmAgentTelemetry.ts`. Single analytics door via `@posthog/convex`
    (creds on the component, never in code); LLM-analytics event contract;
    "quarantined mirror" pattern (capture failure never breaks the call).
25. **WorkOS AuthKit client seam** — HIGH — no. `adapters/workos.ts`. Constructs
    the single `AuthKit` client from typed env; exposes `registerRoutes`. The
    canonical fail-closed WorkOS integration.
26. **WorkOS route wrapper + signature classifier** — MED — no.
    `adapters/workosRoutes.ts`, `checks/workosSignatureError.ts`. Maps signature
    failures to closed 401 codes.
27. **Convex auth trust config** — HIGH — no. `auth.config.ts`. Derives trusted
    JWT issuer/jwks from AuthKit; without it `getUserIdentity()` is always null.
28. **Payment webhook → credit ledger (Standard Webhooks verified)** — MED — no.
    `adapters/dodoWebhookRoutes.ts` (+ `dodoWebhookRouteConfig/Types/Results`,
    `checks/dodoWebhook*`). Signature-verified, deduped webhook applying
    credit-added/deducted/low-balance events. Pattern is generic; name is Dodo.
29. **Email delivery mechanism (provider-neutral ESP seam)** — HIGH — stub
    (`packages/notifications`). `adapters/leadMagnetEmailDelivery.ts`,
    `adapters/emailProviderEvents.ts`, `checks/emailProviderEvents.ts`. Send via
    injectable `fetch` (bearer key, idempotency header, attachments) + normalize
    delivery/open callbacks. Real content for the empty notifications package.
30. **Convex file-storage pattern** — MED — stub (`packages/storage`).
    `capabilities/conversations/audioTranscriptions.ts`,
    `schema/corpusMedia.ts`, `domain/audioTranscription.ts`. `storageId`
    persistence + upload-URL/download flows. Real content for the empty storage
    package.
31. **OpenRouter STT transcription adapter** — LOW — no.
    `adapters/openRouterTranscription.ts`. Single STT door (bytes→base64,
    kill-switch honored, normalized `{text,durationMs}`). Opt-in for voice apps.

## D. Policy-as-data & prompt registry

32. **Policies table (policy-is-data)** — HIGH — no. `schema/policies.ts`,
    `schema/policyFields.ts`, `domain/policy.ts`. Append-only versioned per-kind
    tunable values with kind-validated `data` (the one blessed `v.any()`), scope
    level + status + activation provenance.
33. **Policy resolver (fold + locale + snapshot pinning)** — HIGH — no.
    `adapters/policy.ts`. `getPolicy` (latest-active folded, system→workspace
    nearest-wins), `getPolicyVersion` (pinned), `resolveSnapshot` (kickoff
    pinning with provenance); pure `foldPolicyChain`/`selectForLocale`.
34. **Name-keyed prompt-override resolver + gateway seam** — HIGH — no.
    `adapters/policyRead.ts`. `resolvePromptOverride`/`resolvePinnedPrompt` +
    `resolveForGateway` internalQuery the action-side gateway calls over
    `runQuery`.
35. **PolicyKind framework + registry** — HIGH — no. `policy/kinds/types.ts`,
    `policy/kinds/index.ts`. `PolicyKind<T>` meta (validator + merge + seed +
    `validateData` + `evalRequired`) and an exhaustive registry deriving a union
    validator + membership guard.
36. **Generic AI policy kinds (spend_limits, agent, prompt)** — MED — no.
    `policy/kinds/{spendLimits,agent,prompt}.ts`. Domain-neutral seed kinds:
    daily USD cap, agent config, prompt-override (`evalRequired: true`).
37. **Typed agent-config reader** — MED — no. `adapters/policyAgentConfig.ts`.
    Resolves the active `agent` policy into a typed
    `{instructions, model, enabledTools, starterPrompts, policyId, version}`.
38. **Prompt registry: `definePrompt`/`PromptRef` branded constructor** — HIGH —
    no. `policy/prompts/types.ts`. Module-private symbol brand so
    model-id/system/ temperature live only in prompt modules and the gateway
    accepts a `PromptRef`, never a raw model id.
39. **XML user-prompt hardening helper** — MED — no.
    `policy/prompts/xmlUserPrompt.ts`. Wraps untrusted input in an escaped XML
    tag separated from the instruction (prompt-injection containment).
40. **Prompt registry tables (families + immutable versions)** — HIGH — no.
    `schema/promptRegistry.ts`, `domain/promptRegistry.ts`. First-class prompt
    families + immutable versions (body/model/temperature/evalPolicy/status) so
    LLM provenance pins the exact historical prompt row.

## E. Agent runtime

41. **Generic tool-calling agent runtime** — HIGH — no. `agents/runtime.ts` (+
    test). `runAgentTurn` on `@convex-dev/agent`: builds granted tools,
    constructs the Agent on the policy-driven model via `buildAgentModel`,
    resolves/continues a scoped thread, runs one turn. Pure plumbing; tools
    re-verify tenancy.
42. **Typed tool surface (`defineTools`)** — HIGH — no. `agents/defineTools.ts`
    (+ test). Constructs a name→`ToolDef` map binding public query/mutation refs
    to model-facing description + input schema + optional pure `present` shaper;
    public-only refs (agent can only do what a user can under the same auth).
43. **Agent thread entrypoints (assistant seat)** — MED — no.
    `agents/assistant.ts` (+ tests). `startThread`/`continueThread`/
    `listThreadMessages` thin `workspaceAction`/`workspaceQuery` shells;
    idempotency-keyed; streaming message pagination. Drop the credit-gate
    wrapper, keep the shell.

## F. Workflow engine

44. **Workflow graph runner + entrypoint** — HIGH — no. `workflows/runGraph.ts`,
    `adapters/workflowGraphRunner.ts`, `adapters/workflowGraphRunnerTypes.ts`,
    `adapters/workflowRunCompletionWriters.ts`. Generic interpreter that walks
    nodes/edges over `@convex-dev/workflow` steps, resolving conditions, joins,
    per-node args. **Replaces the template's canned `run_template_001`
    receipt.**
45. **Workflow graph model + validation + condition DSL** — HIGH — no.
    `domain/workflowGraph.ts`, `domain/workflowGraphs.ts`,
    `domain/workflowGraphValidation.ts`, `domain/workflowCondition.ts`,
    `domain/workflowTemplateDefinitions.ts`, `schema/workflowGraphFields.ts`,
    `schema/workflowGraphRunFields.ts`. Node/edge/retry/join validator types + a
    pure edge-condition DSL.
46. **Capability dispatch** — HIGH — no.
    `adapters/workflowGraphCapabilityDispatch.ts`. Validates a node's I/O
    contract then invokes the resolved internal action/mutation/query ref.
47. **Per-node observation + semantic status** — HIGH — no.
    `adapters/workflowGraphNodeObservation.ts`,
    `domain/workflowNodeSemanticStatus.ts`, `domain/workflowStatus.ts`,
    `schema/workflowStageRuns.ts`, `schema/workflowRunEvents.ts`,
    `schema/workflowRuns.ts`. Stage row per node + normalized status; run/stage/
    event tables.
48. **Evidence snapshots + trust receipts** — HIGH — no.
    `adapters/workflowEvidence.ts`, `domain/workflowEvidence.ts`,
    `adapters/workflowEvidenceHashing.ts`,
    `schema/workflowRunEvidenceSnapshots.ts`. Evidence-snapshot drafts +
    `WorkflowTrustReceipt` (materiality classes) + `stableHash`. The "trust
    receipt" the template's visual tests already anticipate.
49. **Run context manifest** — HIGH — no.
    `adapters/workflowRunContextManifestWriter.ts`,
    `domain/workflowRunContextManifest.ts`,
    `domain/workflowRunContextManifestMetadata.ts`,
    `schema/workflowRunContextManifests.ts`. Per-run manifest (graph hash,
    input/output refs, transformation-version + evidence-snapshot ids) for
    reproducibility.
50. **Workflow runs + model-execution records (tables/repos)** — HIGH — no.
    `schema/workflowRuns.ts`, `schema/modelExecutionRecords.ts`,
    `schema/workflowRunEvents.ts`, `repos/workflow/runsRepo.ts`,
    `repos/workflow/modelExecutionRecordsRepo.ts`. Run-ownership index + safe
    model-usage receipts (model/provider/routing/fallback/tokens).
51. **Intelligence observer + mutation/model-record writers** — MED — no.
    `adapters/workflowGraphIntelligenceObserver.ts`,
    `adapters/workflowMutationWriter.ts`,
    `adapters/workflowModelExecutionRecordWriter.ts`,
    `domain/modelExecutionRecord.ts`. Post-node hooks that persist model
    receipts + a reusable `writeWorkflowMutationEntries` helper.
52. **Evidence lineage / replay / quality signals** — MED — no.
    `adapters/workflowEvidenceLineage.ts`, `domain/evidenceSnapshotReplay.ts`,
    `domain/evidenceQualitySignals.ts`, `domain/evidenceView.ts`,
    `domain/brainLineage.ts`. Replay trust labels + quality signals (pure
    modules; lineage couples to Brain tables the template already has).
53. **Reusable component/transformation versioning** — MED — no.
    `adapters/workflowComponents.ts`, `adapters/workflowComponentRecords.ts`,
    `adapters/workflowComponentInserts.ts`,
    `adapters/workflowComponentProjections.ts`,
    `adapters/workflowTransformationVersionInserts.ts`,
    `domain/workflowIntelligence.ts`, `schema/workflowIntelligence.ts`.
    Versioned source-set/transformation "components" with optimistic-version
    guards.
54. **Improvement proposals (eval-gated)** — MED — no.
    `adapters/workflowImprovementProposals.ts`,
    `adapters/workflowImprovementProposalRows.ts`,
    `domain/workflowImprovementProposals.ts`. Propose a graph/template change,
    gate on evals before promotion.
55. **Workflow schedules (cron-recipe engine)** — MED — no.
    `schema/workflowSchedules.ts`, `domain/workflowSchedule.ts`,
    `schema/workflowTriggers.ts`, `domain/workflowTriggers/`,
    `adapters/workflowTriggerQueries.ts`, `adapters/workflowRunTrigger.ts`.
    Per-workspace scheduled recipes: cadence union + timezone, lease-based
    concurrency, missed-run policy, evidence-changed gate.
56. **Template/trigger registry queries** — MED — no.
    `adapters/workflowTemplateQueries.ts`, `schema/workflowTemplates.ts`.
    Bounded indexed reads for workflow templates + versioning.
57. **Runner test-support fixtures** — MED — no.
    `workflows/testSupport/runGraphFixtures.ts`,
    `workflows/__tests__/runGraphTestFixtures.ts`.
    `testGraph`/`edge`/`startNode` builders to test any graph (exclude business
    fixture content).
58. **Workflow projection / cockpit / typed errors** — LOW — no.
    `domain/workflowProjection.ts`, `domain/workflowCockpit.ts`,
    `domain/workflowExecution.ts`, `domain/workflowErrors.ts`. Pure projections
    for run listing/cockpit + typed workflow errors.
59. **Performance attribution scaffold** — LOW — no.
    `adapters/workflowPerformance.ts`, `adapters/workflowPerformanceReads.ts`,
    `adapters/workflowPerformanceProjections.ts`. Output-trait rows +
    attribution rebuild projections (port the shell; leave lead-gen sources
    behind).

## G. Capability registry & headless surfaces (API / CLI / MCP / OpenAPI)

60. **Capability/workflow type + name-grammar contracts** — HIGH — partial.
    `registry/types.ts`. `CapabilityEntry`/`WorkflowEntry` types +
    `parseCapabilityName` (`<domain>.<resource>.<verb>`) +
    `parseWorkflowStepId`. Template's `CapabilityDefinition` is a flat record
    with no grammar.
61. **Capability entry builder helpers** — HIGH — no.
    `registry/capabilityEntryBuilders.ts`.
    `publicWorkspaceQuery/Mutation/Action`
    - internal variants that stamp visibility/kind/authScope/minRole defaults.
62. **Registry aggregation + alias-collision detection** — HIGH — partial.
    `registry/capabilities.ts`. `CAPABILITY_REGISTRY` aggregator +
    `capabilityNames`/`findCapability`/`findAliasCollisions` (machinery only,
    exclude maestro entry lists).
63. **Workflow registry model + ref extraction** — MED — partial.
    `registry/workflows.ts`. `WorkflowEntry` (states/terminal/resumable/retry/
    lineage) + `workflowStepIds`/`workflowCapabilityRefs` extractors.
64. **Typed internal capability-ref map** — MED — no.
    `registry/capabilityRefs.ts`.
    `INTERNAL_{ACTION,MUTATION,QUERY}_CAPABILITY_REFS` maps +
    `requireInternalCapabilityRefs` generated-ref guard. Template dispatches by
    string-matching in memory.
65. **HeadlessSurfaceEntry contract + describe/catalog types** — HIGH — partial.
    `domain/describe.ts`. `HeadlessSurfaceKind`, `Protocol`
    (`openapi|cli|mcp|a2a`), `AuthScope`, full `HeadlessSurfaceEntry`
    (refs/statusRef/artifactTypes/entitlement). Template's `HeadlessSurface` is
    3 fields.
66. **Registry→surface projection** — HIGH — partial (faked).
    `registry/headlessSurfaces.ts`. Derives surfaces from the capability + agent
    registries (not a hand-listed cartesian product like the template's).
67. **Function-schema registry (validator export map)** — HIGH — no.
    `adapters/headlessSchemas.ts`. Reads `exportArgs()`/`exportReturns()` off
    real functions — the single schema source OpenAPI/CLI/MCP all read so
    transports can't drift.
68. **Schema-derived OpenAPI builder** — HIGH — partial (faked).
    `domain/openapi.ts` (+ `openapiTypes.ts`, `checks/openApiSchema.ts`).
    `buildOpenApiDocument` from real Convex validators
    (`convexValidatorToOpenApiSchema`), bearer security, per-surface tags.
    Template hand-builds a fixed schema.
69. **MCP tool-manifest projection** — HIGH — partial (faked).
    `adapters/mcp.ts`. Projects the OpenAPI doc into an MCP tool manifest with
    resolved schemas + annotations + hard invariants. Template returns a shared
    input schema and canned results.
70. **Executable REST adapter + route registration** — HIGH — partial (faked).
    `adapters/apiRoutes.ts`. `/headless/*` pipeline: authenticate → surface
    lookup → access check → arg parse → entitlement → usage preflight →
    dispatch.
71. **Registry-driven surface dispatch** — HIGH — partial (faked).
    `adapters/apiRouteDispatch.ts`. `functionKindForSurface` + `dispatchSurface`
    routing to `runQuery/runMutation/runAction` + `api.a.b.c → a/b:c` path
    translation.
72. **API request/response helpers (tenant injection, error envelope)** — MED —
    partial. `adapters/apiRouteRequests.ts`, `adapters/apiRouteResponses.ts`.
    `injectWorkspaceId` (server-derived, rejects caller-supplied id), typed
    public-error category map, `requestIdFor`.
73. **API-key bearer auth resolver** — MED — no. `adapters/apiAuth.ts` (+
    `domain/apiKeys.ts`, `domain/apiScopes.ts`). `resolveApiBearerToken`: parse
    `Bearer`, hash-compare with pepper, timing-safe, expiry/status, typed
    `ApiPrincipal`.
74. **Surface entitlement preflight** — MED — no.
    `adapters/apiRouteEntitlements.ts`. `checkSurfaceEntitlement` + 403 mapping
    that redacts entitlement failures.
75. **Idempotent API usage attribution/preflight** — MED — no.
    `adapters/apiRouteUsagePreflight.ts`, `adapters/apiUsageAttribution.ts`,
    `repos/billing/apiUsageRepo.ts`. Requires `idempotency-key` on writes,
    records usage, returns replay/conflict/ok (200-replay / 409-conflict).
76. **OpenAPI HTTP route with rate-limit + telemetry** — MED — partial.
    `adapters/openapi.ts`. Serves `/openapi.json` with per-route + global
    rate-limit (429 + retry-after), IP-bucket telemetry, `noindex`/cache
    headers.
77. **HTTP router composition-root constraint** — LOW — partial. `http.ts`.
    Route-registration-only root ("external HTTP enters ONLY here"). Template's
    `confect/http.ts` mixes registration with inline handlers.
78. **Token-gated public HTTP surface pattern** — LOW — no.
    `adapters/agentDoorRoutes.ts`, `adapters/reviewLinkRoutes.ts`,
    `checks/agentDoorRoute.ts`. Anonymous/token door: origin allowlist → route
    rate-limit → per-token rate-limit → dispatch, each fail-closed.

## H. Billing, credits, entitlements & usage

79. **Credit ledger + billing plan/package tables** — HIGH — partial.
    `creditLedger`, `usageEvents`, `entitlements`, `billingPlans`, and
    `webhookEvents` Confect tables exist. `ops.billing.recordUsage` now
    validates workspace-scoped idempotency, requires an active entitlement with
    remaining credits, writes a durable usage event, writes an append-only
    `llm_usage` debit, and increments entitlement usage. Remaining work:
    balance-before/after projections, refund linkage, customer/package
    assignments, and provider reconciliation.
80. **Credit gate lifecycle + saga** — HIGH — no.
    `adapters/creditGateLifecycle.ts`, `domain/creditSaga.ts`,
    `domain/creditPreflight.ts`,
    `checks/{creditAction,creditGatePolicy, creditGateRefund}.ts`. Quote →
    deduct → settle/refund credit state machine with a persisted projection.
81. **Feature entitlements preflight** — HIGH — no. `adapters/entitlements.ts`,
    `domain/headlessEntitlements.ts`, `domain/billing.ts`,
    `checks/entitlementFeature.ts`. `requireEntitlement`/
    `requireWorkspaceEntitlement` gating surfaces on plan features.
82. **Idempotency + webhook dedup + usage-event tables** — HIGH — partial. Usage
    recording now has a workspace-scoped idempotent replay guard and immutable
    usage log. Webhook table shape and dedupe normalization exist, and
    `ops.billing.applyWebhook` now persists Dodo webhook event identity, returns
    `duplicate` for exact replay, and rejects dedupe-key reuse with mismatched
    payload identity. Remaining work: webhook domain effects, provider event
    replay projection, and surface-specific usage idempotency adoption.

## I. Data schema, knowledge & RAG

83. **Audit events table** — HIGH — partial (doctrine only).
    `schema/auditEvents.ts`, `domain/auditEvent.ts`,
    `repos/policy/auditEvents.ts`, `capabilities/access/auditEvents.ts`.
    Workspace-scoped admin action log. Template documents the doctrine but ships
    no table.
84. **Provenance / executor shape** — HIGH — no. `schema/provenance.ts`,
    `schema/coeditProvenance.ts`. Domain-neutral `executor` union (user |
    agent{sessionId,runId} | system{key}) + `accountableProvenanceFields`.
85. **Knowledge-source ingestion tables** — HIGH — partial (`brainPages` only).
    `schema/sources.ts`, `schema/sourceChunks.ts`, `schema/brainSources.ts`,
    `schema/knowledgeFiles.ts`, `domain/chunking.ts`, `domain/sourceUnit.ts`.
    Raw source → chunk → extracted lifecycle, sourceHash dedup, source kinds.
86. **RAG retrieval chunks (vector + search index pattern)** — HIGH — no (fills
    `search` stub). `schema/brainRetrievalChunks.ts` (`.vectorIndex` 1536-dim +
    filterFields), `schema/claims.ts` (`.searchIndex`),
    `domain/brainRetrieval.ts`. The canonical Convex RAG shape.
87. **Migrations component pattern** — LOW — partial. maestro migrations usage
    of `@convex-dev/migrations` (already installed in the template's
    convex.config — wire an example migration).
88. **crons.ts static-kickoff pattern** — LOW — no. `crons.ts`. "Static interval
    → dispatcher mutation" for scheduled internal kickoffs (distinct from the
    per-workspace schedule engine in item 55).
89. **Collaborative document sync service** — MED — no.
    `documentProsemirrorSync.ts` on `@convex-dev/prosemirror-sync`, access-gated
    via `verifyDocumentAccess`. Self-contained collaborative-editing backend.
90. **Generic `checks/` utility library** — MED — no.
    `checks/{slug, requiredString,json,parseJson,convexId,convexJsonValue,whitespace,stringCase, validatorSchema}.ts`.
    Pure, tested, domain-neutral helpers embodying the "named rule in checks/,
    never inline" doctrine the template already preaches.
91. **Retention/privacy lifecycle implementation** — HIGH — partial (doctrine
    only). `checks/corpusArtifactPrivacy.ts` + redaction patterns. Implement the
    classification/retention/export-manifest/deletion-receipt/legal-hold layer
    the template's `data-lifecycle.md` already describes (and `workspaces`
    already carries `dataClassification`).

## J. Eval harness

92. **Pure eval scoring core** — HIGH — no. `domain/evalScore.ts`. `scoreCases`
    (green = `failed === 0`) + `runFixtures` (injected-judge fan-out). The
    shared core both CI and in-app eval paths grade against.
93. **Prompt-eval CI runner + report** — HIGH — partial (`tooling/evals` is an
    empty stub). `tooling/quality/run-evals.mts`,
    `tooling/quality/eval-report.mts`; `evals` script. Auto-discovers
    `*.eval.ts`, runs, scores, emits JSON/markdown, exits non-zero on
    miscalibration. "No prompt change ships without a green eval."
94. **Launch eval gate (fixture-drift hashing)** — MED — no.
    `tooling/quality/launch-eval-gate.mts`. Verifies required eval fixtures
    exist and haven't drifted (SHA hashing + required-label checks) before
    release.
95. **Workflow eval-suites store** — LOW — no. `adapters/workflowEvalSuites.ts`,
    `domain/workflowEvalSuites.ts`, `schema/workflowEvalSuites.ts`,
    `schema/workflowEvalResults.ts`. Durable per-workspace eval
    suites/cases/results.

## K. Quality gates & CI (replace the template's fake-stubs)

96. **knip (unused code/export/dep)** — HIGH — fake-stub. `knip.json` +
    `check:knip` + `knip` devDep. Template `check-knip.mts` is a
    `descriptorFor("knip")` shim.
97. **dependency-cruiser (layer-graph enforcement)** — HIGH — fake-stub.
    `dependency-cruiser.config.cjs` + `check:deps`. Enforces one-way layer graph
    / no cycles.
98. **type-coverage --at-least 100** — HIGH — fake-stub.
    `check:types-coverage` + `type-coverage` devDep. Fails on any implicit
    `any`.
99. **vitest coverage ratchet** — HIGH — fake-stub.
    `tooling/quality/check-coverage-ratchet.mts` + `coverage-baseline.json`.
    Coverage may only rise. Dependency-light (needs the `json-summary`
    reporter).
100.  **Stryker mutation testing** — MED — fake-stub.
      `packages/convex/ stryker.conf.json`, `tooling/quality/run-mutation.mts`.
      Real mutation-score gate. Template `mutation.sh` echoes "ok".
101.  **gitleaks secret scan** — HIGH — partial.
      `tooling/quality/secret-scan.mts` (checksum-pinned gitleaks 8.30.1) +
      hardened `.gitleaks.toml` (`useDefault`, canary + artifact rules).
      Template ships a single-rule gitleaks config + fake canary check.
102.  **qlty (duplication + scan)** — MED — partial. `.qlty/qlty.toml` +
      `install-qlty.sh`. Template `check-qlty.mts` really spawns `qlty check`
      but has no config, so it no-ops.
103.  **lefthook git hooks** — MED — no. `lefthook.yml` (pre-commit prettier;
      pre-push debt/typecheck/lint/deps/knip/gates) + `lefthook` devDep. Shifts
      deterministic gates left.
104.  **check-config-drift (live resolved config)** — HIGH — fake-stub.
      `tooling/quality/check-config-drift.mts` + `config-drift-pins.mts`.
      Asserts live eslint `--print-config` still matches pinned thresholds (not
      a text-grep).
105.  **check-ci-completeness (gates protect themselves)** — HIGH — fake-stub.
      `tooling/quality/check-ci-completeness.mts`. Asserts the pipeline still
      contains every required gate job; deleting a gate to pass = red.
106.  **count-debt (zero-debt AST counter)** — HIGH — fake-stub.
      `tooling/quality/count-debt.mts` + `check:debt --assert-zero`. Computes
      oversized/unhomed files, dumping-ground names, unjustified constants,
      undefended prompts; asserts 0.
107.  **check-security-patterns (secure-coding AST lints)** — HIGH — no.
      `tooling/quality/check-security-patterns.mts`. Flags
      fetch-without-timeout, non-constant-time secret compares, token-in-URL,
      sensitive DOM attrs, raw error render.
108.  **check-joined-row-workspace-guard** — HIGH — no.
      `tooling/quality/check-joined-row-workspace-guard.mts`. AST check that a
      row loaded via another row's id proves `joined.workspaceId` matches the
      active workspace before use (catches the top multi-tenant data-leak bug
      class).
109.  **check-auth-demo-bypass** — MED — fake-stub.
      `tooling/quality/check-auth-demo-bypass.mts`. Demo mode may never weaken
      auth gates (banned-token scan).
110.  **check-http-gate (fail-closed ordering)** — MED — no.
      `tooling/quality/check-http-gate.mts`. AST-asserts the public HTTP door
      runs origin → route-bucket → token-bucket before dispatch. Pairs with
      item 78.
111.  **check-workflow-shape + observability** — MED — no.
      `tooling/quality/check-workflow-shape.mts`,
      `check-workflow-observability.mts`. One `defineWorkflow` export per
      module; progress keyed by generic `workflowId`.
112.  **Registry/contract gates** — MED — fake-stub/absent.
      `tooling/quality/check-capability-registry.mts`,
      `check-headless-surface-contract.mts`, `check-headless-api-compat.mts` (+
      baseline fixture). Registry name/alias discipline, surface protocol
      discipline, additive-vs-breaking API diff. Port with the registry
      substrate (items 60–71).
113.  **check-generators (pit-of-success)** — MED — fake-stub.
      `tooling/quality/check-generators.mts`. Runs codegen with throwaway names,
      then lints the output.
114.  **check-dependency-audit** — MED — no.
      `tooling/quality/check-dependency-audit.mts`. Spawns `pnpm audit`, parses
      vuln counts, thresholds.
115.  **check-ultimate-bug-scanner (check:ubs)** — MED — no.
      `tooling/quality/check-ultimate-bug-scanner.mts` + `install-ubs.sh`. Runs
      the external bug scanner over changed files with a suppression baseline.
116.  **AI review gates (contract-review + taste)** — MED — fake-stub.
      `tooling/quality/contract-review.mts` (+ `contract-review-rubric.md`),
      `taste-review.mts`, `ai-gate-fallback-verdict.mts`,
      `ai-gate-log-verdict.mts`, `post-ai-gate-comment.mts`. Real LLM judges
      over PR diffs (OpenRouter primary, OpenAI fail-closed fallback) emitting
      `*_VERDICT_JSON`. Template versions print a hardcoded `verdict=pass`.
      Requires API keys.
117.  **Buildkite CI orchestration** — HIGH — fake-stub.
      `.buildkite/pipeline.yml` (+ deploy/schedule),
      `.buildkite/scripts/{phase1,ai-gates,ci-self-protection, mutation,auto-fix,affected-verify}.sh` +
      `install-{gitleaks,qlty,ubs}.sh`. The real 3-phase pipeline
      (self-protection → deterministic gates → AI gates). Template scripts are
      ~300 B stubs.
118.  **check-rule-coverage / check-stacking-wiring /
      check-contract-review-surface** — LOW — no.
      `tooling/quality/{check-rule-coverage,check-stacking-wiring, check-contract-review-surface}.mts`.
      Deterministic "wired-but-undocumented / accidentally-removed" pins.

## L. Frontend / app shell

119. **TanStack Start + Router bootstrap** — HIGH — no.
     `apps/web/src/{router.tsx,start.ts,routes/__root.tsx,routeTree.gen.ts}`.
     SSR router, root document, request middleware, file-based route tree.
     Template has no routing.
120. **Convex + @convex-dev/react-query data layer** — HIGH — no.
     `apps/web/src/router.tsx` (`ConvexQueryClient` + `QueryClient`),
     `routes/__root.tsx` (`ConvexProviderWithAuth`). The client↔Convex wiring
     injected into router context. Template instantiates no client.
121. **WorkOS AuthKit auth flow (web)** — HIGH — no.
     `apps/web/src/adapters/workos-*.ts`, `adapters/route-auth.ts`,
     `providers/auth.tsx` (`AuthGate`), routes `sign-in|sign-up|callback`.
     Server middleware, cookie session, protected-route loader, client auth
     gate.
122. **App shell composition (sidebar/topbar/search)** — HIGH — partial.
     `apps/web/src/saas-ui/business-shell.tsx` now owns the starter business
     shell. Remaining work is to deepen the shell with real command search,
     route registry state, and authenticated workspace context.
123. **Theme scope + dark mode** — HIGH — no. Replace the old evaluated Notion
     palette idea with a Saas UI/Chakra color mode policy that is portal-safe
     and verified against TanStack Start SSR.
124. **Reusable layout/block library** — HIGH — partial.
     `packages/ui/src/blocks/*` and Saas UI primitives are the approved
     direction. Remaining work is to promote repeated business-shell patterns
     into reusable blocks without reintroducing route-local UI systems.
125. **Empty / loading / skeleton states** — MED — no.
     `apps/web/src/components/blocks/{empty-state,skeleton-grid,skeleton-stack, surface-skeleton,progress-bar}.tsx`.
126. **Route-level error boundary** — MED — no.
     `apps/web/src/features/maestro-workspace/workspace-view-boundary.tsx`.
     Class boundary with `getDerivedStateFromError` + accessible fallback.
127. **Real workflow canvas (React Flow)** — HIGH — partial (read-only stub).
     `apps/web/src/features/workflows/workflow-canvas-surface.tsx`,
     `workflow-canvas-state.ts`, `components/node-types/*`, `edge-types/*`.
     Typed custom node/edge renderers, view states, selection.
128. **Interactive workflow editor (dnd + config panels)** — HIGH — no.
     `apps/web/src/features/workflows/workflow-canvas-editor-*`,
     `components/panels/*` (uses `@dnd-kit/*` + `@dagrejs/dagre`). Drag-to-add,
     per-node/edge config forms, validation, auto-layout.
129. **Collaborative document editor (prosemirror-sync + BlockNote)** — HIGH —
     no. `apps/web/src/features/documents/*`, `features/editor/*`.
     `@blocknote/react` synced via `@convex-dev/prosemirror-sync/blocknote`.
     _(The full human+agent tracked-proposal surface built on this is Section N,
     items 139–175.)_
130. **Saas UI design-system canon + boundary guards** — MED — no. Add
     AST/source tests that forbid route-local one-off layout systems and require
     Saas UI/shared primitives for business-app surfaces.
131. **Design-system / component gallery screen** — MED — no. Add a live gallery
     for the Saas UI/shared primitive set once enough reusable blocks exist to
     justify it.
132. **Saas UI settings surface** — MED — partial.
     `apps/web/src/saas-ui/business-shell.tsx` includes a plain settings route.
     Remaining work is to extract reusable settings sections and wire durable
     settings mutations.
133. **Navigation / sidebar route registry** — MED — partial (static).
     `apps/web/src/navigation/*`, `components/shell/workspace-sidebar-icons.ts`.
     Declarative nav model (ids/labels/icons/app-modes). Template nav is a
     frozen 8-item array.
134. **Client + server env/config adapters** — MED — no.
     `apps/web/src/adapters/{env,server-env,react-resizable-panels.ssr, route-head}.ts`.
     Validated `VITE_*`/server env accessors + SSR shims.
135. **Voice relay WebSocket server** — MED — stub. `apps/voice-relay/src/*`
     (`server.ts`, `relaySession.ts`, `relayBridge.ts`, `wsAdapter.ts`,
     `transcriptionAvailability.ts`). Real self-contained voice seam. Template's
     `apps/voice-relay` is a single placeholder.
136. **Browser voice / live-call capture** — MED — no.
     `apps/web/src/features/talk/{browser-talk-recorder,browser-content-call-*, live-transcript-panel,live-content-call-cockpit}.*`.
     Mic capture + live transcript cockpit that pairs with the relay server.
137. **i18n provider (intlayer)** — LOW — no. `apps/web/src/providers/i18n.tsx`,
     `apps/web/src/i18n/*`. Standard i18n seam.

## M. Convex component wiring (enabling prerequisites)

138. **Install the missing convex.config components** — HIGH — partial.
     `packages/convex/convex/convex.config.ts`. Template installs `workpool`,
     `workflow`, `migrations`. maestro also installs `posthog`, `rate-limiter`,
     `agent` (`@convex-dev/agent`), `prosemirror-sync`, `workos-authkit`, `dodo`
     — plus `API_KEY_PEPPER` env. Enables items 21, 24, 25, 28, 41–43, 89.

## N. Human + agent collaborative editing (tracked proposals)

The flagship co-editing surface: BlockNote/ProseMirror documents where **both
humans and agents author proposed changes** (block-level insert/delete/replace
"suggestions") that are reviewed and accepted/rejected, with full provenance of
who — human, agent, or system — proposed and resolved each one. None of this is
in the template yet; it needs the `@convex-dev/prosemirror-sync`,
`@blocknote/*`, and `@tiptap/pm` deps installed (see item 176).

**How it works end to end.** Live document state is owned by
`@convex-dev/prosemirror-sync` behind one `syncApi` registration gated by
workspace-role access checks. A _proposed change_ is a row in
`documentAnnotations` — a block-level `insert|delete|replace` carrying the
`blockId` + ProseMirror anchor, before/after BlockNote JSON, plain-text
original/suggested/reason, a `source` (`agent|human|lint`), the anchoring
`documentVersionId` (optimistic-concurrency guard), and author provenance
(`authorUserId` for humans, `agentThreadId` for agents). An agent proposes via
leaf tools (`proposeDocumentBlockReplace/Insert/Delete`), constrained by a
persona prompt + policy kind to "propose tracked suggestions only, never apply
directly." On **Accept**, the capability re-checks version currency, replays the
change onto the latest snapshot via a pure transform, records a new
`documentVersions` row (`cause: "annotation_accept"` + provenance), flips the
annotation to `accepted`, and appends a `documentEvents` audit row; **Reject**
terminalizes + logs. The UI subscribes to the annotation list and renders a
suggestion rail + accept/reject cards, an in-editor pending-highlight overlay
(via a declaration-only editor-bridge seam), and a provenance/process timeline.

maestro has two variants: the newer generic **document**-scoped stack (port
this) and an older **piece**-scoped Studio stack (reference only). Strip
lead-magnet `documentOwner` variants, the `brainPage` sync-target branch, and
the piece variant unless you want its live-`transform` approach as a reference.

_(Provenance/executor shape is item 84 — shared with this feature.)_

### Schema

139. **documents table** — HIGH — no. `schema/documents.ts`. Document root:
     workspace, owner union, status, `currentVersionId` pointer (trim app owner
     variants).
140. **documentVersions table** — HIGH — no. `schema/documentVersions.ts`.
     Append-only semantic snapshots (`contentHash`, `version`,
     `parentVersionId`, `cause`, `causationId`, author provenance).
141. **documentAnnotations table (tracked-change model)** — HIGH — no.
     `schema/documentAnnotations.ts`. The proposed-change table:
     kind/type/source/status, block anchor, before/after blocks, excerpts,
     version anchor, resolution fields, indexes incl.
     `by_document_status_source`.
142. **documentEvents table (collaboration audit log)** — HIGH — no.
     `schema/documentEvents.ts`. Append-only actor/kind/subject/summary log
     (`annotation_created/accepted/rejected`, `snapshot_recorded`,
     `version_restored`, …).

### Backend — lifecycle capabilities

143. **Annotation lifecycle (propose/accept/reject)** — HIGH — no.
     `capabilities/documents/annotations.ts`. `list` +
     `propose{Replace,Insert, Delete}` (version-guarded) + `accept` (re-check
     version → transform → new version → event) + `reject`.
144. **Bulk accept by source** — MED — no.
     `capabilities/documents/annotationsBulk.ts`. `acceptAllBySource`,
     race-tolerant.
145. **Document versions capability** — HIGH — no.
     `capabilities/documents/versions.ts`. `recordSnapshotImpl` (dedup by
     contentHash, provenance-tagged, emits event), `getLatest`, `list`,
     `restore`.
146. **Document events writer/reader** — HIGH — no.
     `capabilities/documents/events.ts`. `insertDocumentEvent` + `list` for the
     timeline.
147. **Editor access gates** — HIGH — no.
     `capabilities/content/editorAccess.ts`. `verifyDocumentTargetAccess` /
     `readDocumentTargetWorkspaceId` — role-gated, IDOR-safe opaque denial.
148. **Documents CRUD + agent context** — MED — no.
     `capabilities/documents/documents.ts`, `capabilities/documents/context.ts`.
     Get/create + agent-facing document context read.

### Backend — sync registration & pure logic

149. **ProseMirror adapter** — HIGH — no. `adapters/prosemirror.ts`. The one
     `ProsemirrorSync` instance + memoised headless `getBlockNoteSchema()`.
150. **Document sync registration** — HIGH — no. `documentProsemirrorSync.ts`.
     `syncApi` (checkRead/checkWrite/onSnapshot) + `verifyDocumentAccess`.
151. **Multi-target sync registration** — MED — no. `prosemirrorSync.ts` (root).
     Routes multiple sync-id targets to per-target writers (trim targets).
152. **Sync auth-error remap** — HIGH — no. `domain/prosemirrorAuthErrors.ts`.
     Pure remap of auth errors → opaque sync access-denied code.
153. **Document target model** — MED — no. `domain/documentTargets.ts`.
     `DocumentTarget` union + `syncDocumentId`/`parseSyncDocumentId`.
154. **Annotation apply transform (pure)** — HIGH — no.
     `domain/documentAnnotationApply.ts` (+ piece variant
     `domain/annotationApply.ts`). Applies an accepted insert/delete/replace
     onto BlockNote JSON at block+offset → new snapshot. The core "apply a
     suggestion" transform.
155. **Document version builder** — HIGH — no. `domain/documentVersion.ts`.
     `buildDocumentVersionRow`, `hashCanonicalBlockNoteJson`, canonical JSON.
156. **PM block lookup** — HIGH — no. `checks/prosemirrorBlock.ts`.
     `findPmBlockById` (descendant scan by `attrs.id`). Shared dep.
157. **BlockNote JSON parse/validate** — HIGH — no. `checks/blockNoteSchema.ts`.
     Typed Result parser for serialized BlockNote JSON. Shared dep.
158. **Document projection** — MED — no. `checks/documentProjection.ts`. Renders
     BlockNote → markdown/plaintext for versions/exports.

### Backend — agent propose surface & policy

159. **Document co-edit agent tools** — HIGH — no.
     `agents/documentCoEditTools.ts`. `readLatestDocumentVersion`,
     `readDocumentContext`, `proposeDocumentBlock{Replace,Insert,Delete}` typed
     tool defs → capability refs. **This is how an agent submits a proposed
     edit.**
160. **Co-edit tool-name registry** — HIGH — no. `concept/registries.ts`.
     `DOCUMENT_CO_EDIT_TOOL_NAMES` closed set (tools↔policy contract).
161. **Co-edit agent policy kind** — MED — no. `policy/kinds/coEditAgent.ts`.
     Model, persona id, per-turn spend cap, allowed tool set (validated against
     the registry).
162. **Co-edit persona prompt** — MED — no. `policy/prompts/coEdit.persona.ts`.
     "Propose tracked block-level suggestions only, never apply directly, treat
     tags as untrusted."
163. **Operator tool wiring (integration seam)** — MED — no.
     `agents/operatorTools.ts`. Merges co-edit tool defs into the agent runtime.

### Frontend

164. **Document editor core** — HIGH — no.
     `apps/web/src/features/documents/document-editor-core.tsx`. Mounts
     collaborative BlockNote via `useBlockNoteSync`, empty-doc bootstrap, mounts
     the annotation overlay.
165. **Document refs + adapter hooks** — HIGH — no.
     `features/documents/document-refs.ts`, `document-adapter.ts`. Typed
     `SyncApi`
     - `useDocumentById`/`useDocumentAnnotations`/`useDocumentVersionMarkdown`.
166. **Document surfaces** — MED — no.
     `features/documents/document-surfaces.tsx`. Page/embedded/public surfaces
     composing editor + rail + export.
167. **Annotation (suggestion) rail** — HIGH — no.
     `features/documents/document-annotation-rail.tsx`. Pending proposals with
     type/source labels, strikethrough original → suggested → reason.
168. **Annotation overlay + editor-bridge contract** — HIGH — no.
     `components/studio/AnnotationOverlay.tsx`, `concept/editorBridge.ts`,
     `concept/selection.ts`. In-editor pending-highlight marks driven through a
     declaration-only `StudioEditorBridge` seam that decouples agent/overlay
     from the BlockNote instance.
169. **Annotation styles** — MED — no. `concept/annotationStyles.ts`. Closed-set
     pending-replacement style keys per annotation type.
170. **Annotation card (accept/reject)** — HIGH — no.
     `components/studio/AnnotationCard.tsx`. One proposal card wired to
     accept/reject mutations.
171. **Bulk-accept + source-filter controls** — MED — no.
     `components/studio/AcceptAllBySourceButton.tsx`, `SourceFilterChips.tsx`.
     Accept-all by source; filter proposals by provenance.
172. **Provenance timeline + doc sidebar** — HIGH — no.
     `components/studio/ProvenanceTimeline.tsx`, `DocSidebar.tsx`. Numbered
     event spine (actor + summary + time) from `events.list`; Suggestions +
     Process tabbed shell.
173. **Agent chat rail + selection toolbar** — MED — no.
     `components/studio/AgentChatRail.tsx` (+ hooks/state/composer/messages),
     `SelectionToolbar.tsx`. Chat rail that starts/continues a document-scoped
     agent thread injecting `<document-context>` — how a human asks the agent to
     propose; selection-scoped instruction affordance.

### Tests & deps

174. **Co-edit test suites** — MED — no. Backend:
     `capabilities/documents/{annotations,annotationsBulk,versions}.test.ts`,
     `documentProsemirrorSync.test.ts`,
     `domain/documentAnnotationApply.test.ts`,
     `checks/{prosemirrorBlock,blockNoteSchema}.test.ts`,
     `policy/kinds/coEditAgent.test.ts`, `agents/documentCoEditTools.test.ts`,
     `policy/prompts/coEdit.persona.{test,eval}.ts`. Frontend:
     `document-editor-core.test.tsx`, `AnnotationOverlay.test.ts`,
     `AnnotationCard.test.ts`, `ProvenanceTimeline.test.ts`, etc.
175. **Co-edit vendor deps** — HIGH — no. Install
     `@convex-dev/prosemirror-sync`, `@blocknote/core`, `@blocknote/react`,
     `@tiptap/pm` (+ `@convex-dev/agent` for the chat rail) and add
     `prosemirror-sync` to `convex.config.ts` (see item 138). Prerequisite for
     the whole section.

## O. Change tracking & versioning primitives (cross-cutting)

The generic "track how any record changes over time" kit — generalized beyond
documents so any entity in a custom build gets versioning, history, soft-delete,
and audit for free. Items 177–178, 182, 189, 190 form one coherent "versioned
record" module; 179–181, 191 are the operations/guards on top. (Note: maestro
registers `@convex-dev/migrations` but never uses it — there is no real
migration example to port; the component in the template is scaffolding only.)

177. **Generalized versioned-entry primitive** — HIGH — no.
     `schema/conceptVersions.ts`, `schema/brainEntryVersions.ts`. Append-only
     `entryId + monotonic version + status(proposed/active/superseded/discarded)
     - parent/supersedes chain + actor union +
       provenance`, keyed by a stable string id. Generalizes doc-specific `documentVersions`
       to any entity.
178. **Activate-and-supersede-siblings + corruption guard** — HIGH — no.
     `repos/brain/conceptsRepo.ts`, `repos/policy/policiesRepo.ts`. Promote one
     version to `active` and demote prior active row(s) in one txn; fails closed
     if it ever finds >1 active sibling. The "only one live version per lineage"
     state machine.
179. **Content-hash dedup on append** — HIGH — no.
     `capabilities/documents/versions.ts` (`canReuseLatestVersion`),
     `domain/documentVersion.ts`. Skip writing a new version when canonical
     content hash equals the latest. Keeps ledgers from bloating on no-op
     writes.
180. **Restore/rollback by forward-append** — HIGH — no.
     `capabilities/documents/versions.ts` (`restoreImpl`). "Restore version N"
     re-appends N's content as a new head with `cause: "version_restore"` +
     `causationId`; never mutates history.
181. **Mutable freshness/decay side-table (ledger/side-table split)** — HIGH —
     no. `schema/conceptFreshness.ts`, `domain/brainFreshness.ts`. Recomputable
     `staleAfter/lastVerified/useCount/status(fresh/decaying/stale)` kept OFF
     the append-only ledger so it can be backfilled idempotently. The reusable
     retention/TTL/staleness pattern.
182. **`cause` + `causationId` provenance taxonomy** — MED — no.
     `schema/documentVersions.ts`. Every version/event records WHY it was
     written
     - a link to the causing row/action. Cheap event-sourcing lineage for any
       change-tracked table.
183. **Revocable soft-delete via `revokedAt`** — MED — no.
     `schema/workspaceGuestGrants.ts`,
     `capabilities/access/workspaceGuestGrants.ts`. Tombstone by stamping
     `revokedAt`; liveness is a null-check, not a time comparison (avoids
     ambient-time bugs); reversible.
184. **Single-live-row upsert + tombstone duplicates** — MED — no.
     `capabilities/access/workspaceGuestGrants.ts` (`upsertLiveGrant`). Enforce
     one live row per logical key, self-healing against dup rows in-txn.
185. **Idempotent upsert/reconcile + metadata-match conflict guard** — MED —
     partial. `repos/workflow/linksRepo.ts`. Dedup on `idempotencyKey`;
     reconcile if present; throw on key-reuse with different metadata
     (optimistic-concurrency flavor, richer than plain webhook dedup).
186. **Expiring single-use token (TTL + consume-once)** — MED — no.
     `schema/reviewTokens.ts`, `schema/linkedinOAuthStates.ts` (`expiresAt` +
     `consumedAt`/`lastUsedAt`). Reusable for share/magic/invite links, OAuth
     state.
187. **Subject-keyed append-only activity log** — MED — partial (see item
     142/83). `schema/editEvents.ts`. `actor + kind + subjectId + summary + at`,
     indexed `by_subject_at`/`by_workspace_at`. Generalizes
     `documentEvents`/`auditEvents` to any subject — a reusable
     activity-feed/timeline shape.
188. **Before/after change-capture with deferred classification** — MED — no.
     `schema/edits.ts`. Record the raw `before`/`after` diff now; a later agent
     pass fills in `classification(taste/defect/operational)`. Change-learning /
     drift-detection pattern.
189. **Head-pointer + immutable history** — MED — no. `schema/documents.ts`
     (`currentVersionId`). Mutable head pointer updated atomically alongside the
     append-only log — O(1) "get current" without scanning history.
190. **`nextVersion` monotonic allocation helper** — LOW — no.
     `domain/policy.ts` (`nextVersionFrom`), `domain/concept.ts`. Pure
     `max(existing)+1` per lineage; underpins every versioned table.
191. **Read-cap corruption guards for lineage reads** — MED — no.
     `repos/brain/conceptsRepo.ts`, `repos/policy/policiesRepo.ts`. Every
     history/active read `.take(CAP)`s and throws a typed corruption error if
     the cap is hit — bounds replay cost, turns silent growth into a loud
     failure.

## P. Knowledge model, markdown & format transformation (generate + transform)

The heart of a knowledge app: how structured knowledge is represented
(claims/concepts/citations/evidence), converted between forms (BlockNote ↔
markdown ↔ plaintext), and transformed form-A → form-B through a versioned,
audited ledger. maestro's knowledge spine is domain-neutral (only a few enum
values lean GTM). Shared editor deps: `checks/blockNoteSchema.ts`,
`checks/prosemirrorBlock.ts`, `checks/documentProjection.ts` are already listed
(items 156–158).

### Knowledge model (claims / concepts / citations / evidence)

192. **Concept-version ledger + concept-kinds registry** — HIGH — no.
     `schema/conceptVersions.ts`, `concept/kinds/{index,types}.ts`,
     `domain/concept.ts`, `repos/brain/conceptsRepo.ts`. A versioned
     knowledge-atom store with a pluggable-kind registry (`claim` + versioning
     are generic; `position`/`procedure` are the swappable kinds). The
     knowledge-model layer on top of item 177.
193. **Claims + claim citations (evidence primitive)** — HIGH — no.
     `schema/claims.ts`, `schema/claimCitations.ts`, `domain/claimMarkdown.ts`,
     `checks/computeConceptId.ts`. Claim atom (epistemics, provenance,
     lifecycle)
     - citations storing an exact quote + paragraph-range locator + valid/stale/
       rejected status.
194. **Groundedness predicate** — HIGH — no. `checks/grounding.ts`.
     `isGrounded (quote, chunkText)` + `isGroundedClaim` (≥1 citation). The
     minimal floor under the whole evidence model.
195. **Brain citations / brain sources** — MED — no. `schema/brainCitations.ts`,
     `schema/brainSources.ts`. Page-scoped source-linking with quote + JSON
     location.
196. **Piece grounding (claims backing an output)** — MED — no.
     `schema/pieceGrounding.ts`, `domain/pieceGrounding.ts`. Attaches
     `{claim, source}[]` to any generated artifact.
197. **Draft fact-check record** — MED — no. `domain/draftFactCheck.ts`,
     `schema/draftFactChecks.ts`. Frozen per-claim grounded/ungrounded/opinion
     attestation over generated text.
198. **Draft source provenance (span → source)** — MED — no.
     `schema/draftSourceProvenance.ts`, `domain/draftSourceProvenance.ts`.
     "Where did this sentence come from" trail from output spans to source
     units.
199. **Evidence view (evidence → prompt block)** — HIGH — no.
     `domain/evidenceView.ts`, `domain/evidenceSnapshotReplay.ts`.
     Deterministic, stable-hashed projection of knowledge snapshots
     (lane/freshness/confidence) into a prompt-ready markdown block. High value
     for any RAG/agent app.
200. **Context pack (budgeted concepts → markdown)** — HIGH — no.
     `domain/contextPack.ts`, `capabilities/brain/contextPacks.ts`,
     `schema/contextPackRuns.ts`. `selectWithinBudget` packs active concepts
     into a token-bounded markdown context block.
201. **Use-knowledge workflow step** — MED — no. `domain/useKnowledgeStep.ts`.
     Resolves a source-set (latest-active vs pinned) into an evidence snapshot +
     view for a workflow step. "Inject knowledge into a step" primitive.
202. **Source-unit extraction → brain proposals** — HIGH — no.
     `domain/sourceUnit.ts`,
     `capabilities/knowledge/{extractSourceUnits, sourceUnits,sourceUnitBrainProposals}.ts`.
     Extract evidence receipts from ingested material and propose brain
     claims/concepts.

### Markdown / format serializers & parsers

203. **formatTransfer (multi-surface serializer)** — HIGH — no.
     `domain/formatTransfer.ts`. BlockNote JSON → plaintext / markdown /
     (unicode bold-italic for platforms that render markdown literally). The
     core rich-text → surface renderer.
204. **BlockNote inline walkers** — HIGH — no. `checks/blockNoteInline.ts`. Pure
     walkers over inline content trees (text runs, styles, hrefs). Reused by
     every serializer.
205. **Markdown escaper** — MED — no. `checks/markdownText.ts`. Escapes markdown
     special chars/newlines. Small but load-bearing under every markdown
     emitter.
206. **Brain markdown codec (YAML frontmatter import/export)** — HIGH — no.
     `domain/brain/brainMarkdownCodec.ts`. Encode/decode frontmatter (type,
     stablePageKey, exportPath, aliases, tags) while realtime stays BlockNote
     JSON. Generic page-store markdown import/export.
207. **Brain markdown syntax (wiki-links + slugs)** — MED — no.
     `checks/brainMarkdownSyntax.ts`. Parse `brain://page/…` links, slug
     normalization, markdown link extraction. Generic wiki/docs primitive.
208. **Document serialization wrapper** — MED — no.
     `domain/brain/documentSerialization.ts`. BlockNote snapshot →
     `{plainText, markdown}` convenience projector.
209. **Citation marker detector** — LOW — no. `checks/citationMarker.ts`. Regex
     detection of `[…]`/`cite:` markers. Tiny eval/lint helper.
210. **Export/preview capabilities** — MED — no.
     `capabilities/content/draftExports.ts`,
     `capabilities/documents/exports.ts`,
     `capabilities/content/formatPreviews.ts`. Read-only "render this doc as
     plaintext/markdown/other" endpoints. _Note: no PDF/DOCX/CSV/HTML libraries
     exist in either repo — maestro's format story is BlockNote/ProseMirror JSON
     ↔ markdown/plaintext only. "Export to PDF/docx/CSV" is a genuine greenfield
     gap, not a port._

### Transform ledger (form-A → form-B machinery)

211. **Transformation versions/definitions registry** — HIGH — no.
     `schema/transformationVersions.ts`,
     `domain/{transformationVersionContracts,transformationSharedDetail, transformationSharing}.ts`.
     A versioned, shareable, policy-governed catalog of transforms (kind =
     prompt/llm_step/playbook/deterministic_check, with drift/example/evidence
     policies). The "transform knowledge A → B" registry.
212. **Transform step executor** — HIGH — no. `domain/transformStep.ts`,
     `capabilities/content/transforms.ts`. Deterministic transform node: input
     key → output key under a grounding mode, emits an evidence-view artifact.
213. **Traced transformation blocks (block → role → evidence)** — HIGH — no.
     `schema/tracedTransformationBlocks.ts`,
     `domain/tracedTransformationBlock.ts`. Output blocks tagged with passage
     keys, semantic role (headline/hook/claim/cta…), factuality, and support
     refs. Every output block knows its role + backing evidence.
214. **Transformation support ledger (groundedness audit)** — HIGH — no.
     `schema/transformationSupportLedger.ts`,
     `domain/transformationSupportLedger.ts`. claimed_support /
     unsupported_candidate / required_support_missing →
     verified/rejected/missing, with review + eval triggers.
215. **Transformation drift alert (downstream staleness)** — MED — no.
     `domain/transformationDriftAlert.ts`, `schema/pieceRefreshImpacts.ts`.
     Detects when an upstream change should refresh downstream outputs.
216. **Trust receipt projection** — HIGH — no. `domain/trustReceipt.ts`,
     `capabilities/workflow/trustReceipts.test.ts`. Deterministic bundle of
     graph hash + policy/model refs + execution records + evidence + support
     ledger → an auditable receipt. (Complements the workflow evidence tables,
     item 48.)
217. **OKF — Open Knowledge Format (KB → markdown file tree)** — HIGH — no.
     `domain/okf.ts`, `capabilities/brain/exports.ts`. Byte-deterministic
     serializer of active concepts + history to a git-friendly markdown tree
     (`concepts/<kind>/<id>.md`, `index.md`, `log.md`). "Export your whole
     knowledge base to a markdown repo."
218. **Living-knowledge reason-code taxonomy** — LOW — no.
     `domain/livingKnowledgeReasonCodes.ts`. Canonical reason codes projected
     across eval/piece/receipt/refresh targets.

## Q. Visualize & act primitives (edit/visualize + act)

Reusable presentation and action surfaces — charts/boards/tables to _see_
knowledge and publish/approve/schedule surfaces to _act_ on it. The visualize
primitives use local/shared primitives without chart library dependencies; the
act primitives keep a pluggable provider/destination seam.

### Visualize

219. **Dense selection data-grid** — HIGH — no.
     `apps/web/src/components/blocks/dense-selection-table.tsx`. Selectable,
     toolbar-topped, column-aligned data table (select-all, per-row marks, empty
     state). Every B2B app needs a multi-select grid over records.
220. **Kanban board primitive** — HIGH — no.
     `apps/web/src/features/nk-gallery/components/kanban.tsx` (+
     `kanban-core.ts`, `kanban-drag.ts`, `hooks/use-kanban-*`). Accessible
     drag-and-drop column/card board with keyboard announcements. Reusable
     status board for any entity.
221. **Calendar / scheduling grid** — MED — no.
     `apps/web/src/features/nk-gallery/components/CalendarGrid.tsx` (+
     `calendar-grid-model.ts`, `hooks/use-calendar-clock.ts`). Monthly grid with
     per-day item pills + selection; presentation-only. Pairs with item 226.
222. **Funnel / stage visualization** — MED — no.
     `apps/web/src/components/blocks/attribution-funnel-blocks.tsx`. Funnel
     stage block + trend card + leaderboard table. Universal conversion/stage
     view (drop the "attribution" naming).
223. **Metric tiles + dashboard grid + performance ribbon** — MED — partial
     (`StatGrid` exists).
     `apps/web/src/components/blocks/{metric-row,dashboard-grid, dashboard-page,performance-ribbon,workspace-metric-card}.tsx`.
     Richer KPI tiles, responsive grid, compact top-metrics ribbon with tone.
224. **Analytics ribbon / trend strip** — MED — no.
     `apps/web/src/features/nk-gallery/components/AnalyticsRibbon.tsx` (+
     `analytics-ribbon-model.ts`). Top-of-dashboard summary with a derived trend
     model split from the view.
225. **Status / coverage / health board** — MED — partial (`StatusPill` exists).
     `apps/web/src/features/data-map/workspace-data-map.tsx`,
     `features/health/health-dashboard.tsx`. "Is each subsystem wired / healthy"
     cards with badges.
226. **Lineage / provenance panel** — MED — no.
     `apps/web/src/components/blocks/workflow-lineage-blocks.tsx`. Read-only
     lineage panel chrome (section/body/list/item); callers supply nodes.
227. **Diff / divergence view model** — MED — no.
     `packages/convex/convex/domain/workflowTriggers/divergenceView.ts` (+
     `snapshotReplayComparison.ts`). Node-by-node "what changed between
     run/version A and B" comparison model.
228. **Progress track** — LOW — no.
     `apps/web/src/components/blocks/progress-bar.tsx`. Compact horizontal
     progress bar. (Provenance timeline is already item 172.)

### Act

229. **Publish jobs + durable scheduled-publish workflow** — HIGH — no.
     `capabilities/publishing/publishJobs.ts`, `workflows/scheduledPublish.ts`.
     Queue an approved artifact, schedule it, run a durable workflow to push it
     out with failure-reason capture/retry. The core "publish/deliver to an
     external destination on a schedule" primitive; provider is a pluggable
     adapter.
230. **Approval / review gate (exceptions + alerts + toolbar)** — HIGH — no.
     `capabilities/content/{reviewExceptions,reviewView,reviewExceptionScans, reviewExceptionAlerts}.ts`;
     UI `components/blocks/client-review-blocks.tsx`,
     `features/studio/studio-review-toolbar.tsx`. Human approval gate before an
     artifact ships, with rule-exception scanning + alerting + accept/reject.
231. **Tokenized external review share links** — HIGH — no (see also item 78).
     `capabilities/content/reviewTokens.ts`, `adapters/reviewLinkRoutes.ts`, UI
     `AgencyReviewShareLinkPanel`. Mint/revoke/resolve anonymous links so
     external stakeholders review without an account.
232. **Living-knowledge refresh scheduler + refresh inbox** — HIGH — no.
     `packages/convex/convex/domain/workflowTriggers/{schedule,scheduleGate, scheduleConcurrency,refreshInbox,proposedRefreshDraft,refreshAuditLog, pieceRefreshImpact}.ts`.
     Detect stale knowledge → schedule a re-run → propose refreshed drafts into
     a review inbox → audit-log. Marquee "keep knowledge fresh + act"
     capability. (Pairs with the schedule engine, item 55.)
233. **Generic trigger-config surface** — HIGH — partial (see items 55–56).
     `apps/web/src/components/blocks/workflow-trigger-blocks.tsx`. Compact
     automation controls (option grid + status row) to configure "run this on
     schedule/event."
234. **Content scheduling + schedule-health signal** — MED — no.
     `capabilities/content/scheduledPosts.ts`,
     `capabilities/content/scheduleHealth.ts`. Assign artifacts to calendar
     slots + a health signal when the schedule is under-filled. Pairs with the
     calendar grid (item 221).
235. **Actionable work-queue row + approval band** — MED — no.
     `apps/web/src/components/blocks/work-queue-row.tsx`,
     `ClientReviewApprovalBand`. "Queue of items awaiting an action" rows +
     approve/request-changes band.
236. **Periodic digest snapshot** — LOW — no.
     `capabilities/content/weeklySnapshots.ts`. Roll workspace state into a
     periodic snapshot for digests/reports. (Artifact export surface is item
     210; email/outbound delivery seam is item 29.)

## R. Multi-tenant lifecycle capability layer (the fiddly, load-bearing half)

Section A ships the tenancy _tables and pure helpers_. This section is the
_capability layer_ — the mutations and state machines that actually run
multi-tenancy — plus the enforcement holes. An audit confirmed **A alone is not
a shippable tenancy layer**; these are the expensive, security-sensitive parts
you cannot cut. All are `no` in the template. **Rewrite every one in
Confect/Effect** (`FunctionSpec`/`FunctionImpl`, `Effect.gen`, tagged errors) —
these are exactly the intricate mutations where a careless copy-paste from
maestro's plain Convex would reintroduce bugs.

237. **Effective-role resolver (max over three access paths)** — HIGH — no.
     `adapters/auth.ts` (`resolveRoleCandidates`, `highestCandidate`,
     `VIA_PRECEDENCE`, `singleLiveInternal`, `resolveGuestRole`). Effective
     workspace role = max of (org-admin baseline, direct membership valid only
     while still an org member, cross-org guest capped by the granting org's
     live grant), member>org>guest tiebreak, fail-loud on >1 live internal row /
     grant. The single most intricate, most security-sensitive piece of the
     whole spine.
238. **Server-side provisioning / self-heal mutation** — HIGH — no.
     `capabilities/access/workspaces.ts` (`ensureProvisioned`,
     `provisionPersonalWorkspace`, `ensureUser`, `ensurePersonalOrganization`,
     `ensure{Organization,Workspace}OwnerMembership`). Idempotent first-sign-in
     chain that builds identity → user → personal org → org-owner → personal
     workspace → workspace-owner, tombstone-safe against duplicates. Without it
     a signed-in user can never acquire a tenant. (Item 10 is only the web
     provider.)
239. **Workspace member RBAC lifecycle mutations** — HIGH — no.
     `capabilities/access/workspaceMembers.ts` (`changeMemberRole`,
     `removeMember`, `transferOwnership`, `listWorkspaceMembers`).
     Escalation-safe lattice (can't grant above your role or act on someone
     ranked above you), last-owner protection, atomic promote-then-step-down
     ownership transfer (never 0-owner/2-owner). Item 2 captured only the
     role-rank helpers.
240. **Cross-tenant grant + guest-staffing capabilities** — HIGH — no.
     `capabilities/access/workspaceGuestGrants.ts` + `guestGrants.ts`
     (`grantWorkspaceAccess`, `revokeWorkspaceAccess`, `upsertLiveGrant`,
     `revokeLiveGrants`, `addOrgMemberAsGuest`, `staffGuest`). Owning-side
     issue/revoke (revoke instantly cuts every guest of that org),
     single-live-row upsert with in-txn tombstoning, staffing by
     `orgMembershipId` (never a caller-supplied user id), capped at
     `grant.maxRole`. Item 4 was schema only.
241. **Invitation accept/decline lifecycle** — HIGH — no.
     `capabilities/access/invitationResponses.ts` (`acceptInvitation`,
     `declineInvitation`, `loadForVerifiedInvitee`, `ensureInternalMembership`).
     Normalized-email exact match returning one opaque error _before_
     status/expiry checks (never leaks an invite exists for someone else),
     expiry + role re-validation, single-live membership write, idempotent
     decline. The actual invite→join path. Item 5 was schema only.
242. **Invitation issue/cancel/list (owning-side)** — MED — no.
     `capabilities/access/workspaceInvitations.ts` (`inviteToWorkspace`,
     `cancelWorkspaceInvitation`, `listWorkspaceInvitations`). `admin`
     min-role + `assertOwningSide` (a guest can't invite); cancel verifies
     ownership first.
243. **Email normalizer for invite matching** — MED — no. `checks/email.ts`
     (`normalizeEmail`, `isValidEmail`). Binds an invite to a verified identity;
     a blank/whitespace email normalizes to `""` = "no verified email" so blanks
     never match. Load-bearing under 241; not in item 90's list.
244. **Suspension/archival ENFORCEMENT in the access gate** — HIGH — no _(latent
     maestro bug — fix on port)_. `schema/organizations.ts` (`suspended`),
     `schema/workspaces.ts` (`archived`) vs `adapters/auth.ts`. The gate only
     checks `deletedAt`; **nothing checks `status`**, so a suspended org keeps
     full access. The template must wire status into the gate (or drop the
     field) — do not inherit this hole.
245. **Seat counting / seat-limit enforcement** — MED — no _(greenfield hole)_.
     `schema/billing.ts` (`includedSeats`, `billingMode: "seat"`). Seats are
     modeled but **nothing counts live members against them** on invite/accept.
     The billing↔tenancy join; without it seat plans are decorative. Build it.
246. **Active-workspace selection / switching / default** — MED — no
     _(greenfield hole)_. `apps/web/src/providers/workspace.tsx` just takes
     `workspaces[0]`. Any user in >1 workspace needs deterministic active-tenant
     selection + a switcher
     - persistence. Extends item 10.
247. **Tenant lifecycle ops (rename / settings / suspend / delete / offboard /
     export)** — MED — no _(greenfield hole)_. Absent in maestro.
     Workspaces/orgs carry `deletedAt`/`status` but nothing sets them. Creation
     without rename/suspend/delete/per-tenant export is not a shippable admin
     story. Build on top of the retention doctrine (item 91).
248. **Org-tier RBAC management + WorkOS org-membership/directory sync** — MED —
     no _(greenfield hole)_. `capabilities/access/organizations.ts` is
     read-only; no org-member invite/role/remove mutations and no WorkOS
     `organization_membership`/directory-sync webhook. The org tier has no
     management surface or external identity sync yet.
249. **Audit-of-admin-actions wiring** — MED — partial. Access lifecycle
     planners emit events for role changes, removals, ownership transfers, and
     invitations, member/invitation impls persist them to `accessAuditEvents`,
     and `check:access-audit-events` pins the wiring. Remaining work: extend the
     same durable audit discipline to every future admin/org/tenant lifecycle
     surface. Isolation-safety requirement.
250. **Member "leave" + suspended/disabled member state** — LOW — no.
     `capabilities/access/workspaceMembers.ts`. No self-service leave for a
     non-admin; membership is only live/tombstoned, no temporary
     suspended/disabled state. Rounds out invite→join→leave→remove.

## S. Starter-kit essentials & gaps (i18n, a11y, UX, deploy, ops)

The cross-cutting things a serious B2B SaaS starter kit ships that a
domain-first extraction misses. Marked **Port** (real maestro code to translate)
or **Greenfield** (absent in both repos — build it). Backend/Convex items get
the Confect/Effect rewrite; frontend items are React/TSX; deploy/ops items stay
Node scripts. Honest headline: maestro is a strong design-system + shell +
co-editing base, but most of these UX/ops safety nets are **greenfield in both
repos**.

### Frontend / i18n / a11y / UX

251. **Deep i18n build-out** — HIGH — Port seam + Greenfield. maestro's i18n is
     a smoke seam only (`apps/web/intlayer.config.ts` locked to English, one
     dictionary key, zero `useIntlayer` call sites; `<html lang="en">`
     hard-coded). Needs multi-locale config, locale routing + switcher,
     copy→catalog migration, pluralization. Item 137 captured only the thin
     seam.
252. **`Intl` formatting utilities (date/number/currency/relative-time)** — MED
     — Port + harden. `apps/web/src/adapters/date-label.ts` calls bare
     `toLocaleDateString` with no locale/timezone. Centralize a
     locale+tz-injected formatter boundary (currency for billing, relative-time
     for activity).
253. **RTL + per-workspace/user locale + timezone plumbing** — MED — Greenfield.
     Persist locale/timezone on the workspace/member record; drive `dir`/`lang`.
254. **Localized transactional emails** — LOW/MED — Greenfield (on captured seam
     29). Locale-selected email templates + formatting.
255. **a11y test harness (axe/jest-axe + Playwright)** — HIGH — partial.
     `tests/e2e/hosted-reference-app.accessibility.spec.ts` runs hosted
     desktop/mobile Playwright checks plus axe WCAG scans on key reference
     routes via `pnpm smoke:hosted:a11y`. Remaining work: add fork-specific axe
     coverage as generated client routes/forms land.
256. **Focus management / focus-trap / skip-link utilities** — MED — partial.
     `TemplateRouteFocusBoundary` and `TemplateMainContent` provide app-level
     route-change focus and skip-to-content targets, with
     `TemplateWorkspaceShell` and standalone routes wired to
     `template-main-content`. `TemplateDialog` and `useTemplateDialogFocusTrap`
     provide modal focus trapping, Escape close, and return-focus behavior for
     closeable surfaces. Remaining work: wire every product modal/dialog/popover
     surface into the shared primitive as those surfaces land.
257. **Screen-reader live-region announcer** — MED — partial.
     `TemplateRouteFocusBoundary` renders a polite route-change announcement
     driven by `describeRouteAnnouncement`. Toasts also emit through an
     aria-live region, and `TemplateToastProvider` exposes polite/assertive
     screen-reader announcement helpers with danger toasts treated as alerts.
     The onboarding continuation action now emits fake-ready, live-blocked, and
     ready-to-handoff feedback through the shared toast provider. Remaining
     work: wire every future real mutation-specific save/error path across
     product surfaces into those helpers.
258. **`useReducedMotion` runtime hook** — LOW — partial. `packages/workflow-ui`
     now exposes `useWorkflowReducedMotion` and gates React Flow edge animation
     through `shouldAnimateWorkflowEdge` so runtime canvas motion respects
     `prefers-reduced-motion`; CSS still backs this up for rendered edges.
     Remaining work: reuse the hook for any future JS/canvas animation outside
     workflow-ui.
259. **Global toast / notification-emitter system** — HIGH — partial. The
     reusable `TemplateToastProvider` now exposes an imperative
     `useTemplateToast` API with dismiss and auto-dismiss behavior.
     `/onboarding` uses the provider for its continuation action, and
     `/notifications` routes generated `ops.notifications.markRead`
     success/error results through the shared mutation-toast adapter. Remaining
     work: wire future real mutation success/error paths across product surfaces
     into the provider.
260. **In-app notification center (table + UI + prefs)** — MED — partial.
     `packages/notifications` now owns the starter notification-center model:
     fake/test/live-ready delivery state, in-app/email/digest preferences,
     in-app filtering, unread counts, and read-receipt planning.
     `ops.notifications` now persists in-app records and per-recipient
     preferences in Confect `notificationRecords` and `notificationPreferences`
     tables, with workspace-member-scoped list, mark-read, preference upsert,
     and internal record mutations. `TemplateNotificationCenter` renders the
     bell/inbox surface with unread state, open actions, and channel
     preferences, and `/notifications` uses generated `ops.notifications` refs
     when Convex is configured while retaining a fake-safe fallback route.
     Remaining work: add digest scheduling and provider-backed delivery in
     client forks.
261. **Form library + validation / dirty-state / autosave** — HIGH — partial.
     `apps/web/src/forms/starter-form.ts` provides the reusable starter
     validation, dirty-state detection, route leave guard, and autosave planner.
     Remaining work: promote the primitive into every generated client form,
     connect autosave to durable mutations, and add fork-specific axe coverage
     as real form-heavy routes land.
262. **Designed error surfaces (404 / 500 / root error + global pending)** — MED
     — Partial port + build. `router.tsx` ships throwaway not-found/pending
     one-liners; the error-boundary _pattern_ is item 126.
263. **Offline / network-retry UX** — LOW/MED — partial. Root route UX now
     detects browser online/offline state, shows a connection banner for
     offline/degraded states, and exposes a retry action to reload the current
     route. Remaining work: mutation retry over Convex live queries.
264. **SEO/social meta helper + `public/` assets** — MED — partial.
     `apps/web/src/adapters/route-head.ts` centralizes canonical, manifest,
     favicon, Open Graph, and Twitter metadata for the root route.
     `apps/web/public` now includes `manifest.webmanifest`, `robots.txt`,
     `sitemap.xml`, `favicon.svg`, and `social-card.svg`. Remaining work: client
     forks should replace canonical domains, social art, sitemap entries, and
     page-specific descriptions before public launch.
265. **Cookie consent + legal pages (terms, privacy)** — MED — partial. `/legal`
     ships reviewable privacy, terms, and cookie/analytics placeholder sections.
     `CookieConsentBoundary` stores an explicit accepted/declined decision and
     keeps analytics capture disabled until acceptance. Remaining work: client
     forks must replace placeholder legal copy, approved retention periods,
     analytics purpose text, and opt-out instructions before enabling live
     telemetry.
266. **PWA (web manifest + service worker + installability)** — LOW —
     Greenfield.
267. **First-run onboarding wizard / empty-first-workspace / checklist / tour**
     — MED/HIGH — partial. `/onboarding` now renders a tested setup checklist
     derived from the setup surface model, including workspace identity,
     provider readiness, source-backed Brain, and first Trust Receipt steps.
     Remaining work: persist checklist progress per workspace, add a guided
     tour, and connect first-workspace provisioning to a real activation flow.
268. **Global keyboard-shortcut registry + shortcuts-help overlay** — LOW/MED —
     small Port + build. `workspace-search.tsx` owns ⌘K only; a central
     registry + "?" cheat-sheet so shortcuts aren't re-implemented per feature.
269. **Command-palette actions + data search (beyond nav)** — LOW/MED — extends
     item 122. Today ⌘K is navigation-only; make it run commands and search over
     workspace entities.
270. **Notification/email preferences + digest UI** — LOW — Greenfield. Per-user
     channel/frequency prefs feeding the ESP seam (item 29).

### Deploy / ops / infra / DX

271. **Deploy pipeline (staging → promote → prod)** — HIGH — Port.
     `.buildkite/pipeline.deploy.yml`, `.buildkite/scripts/deploy.sh`. Real
     2-env Buildkite deploy with a manual `promote-production` block gating the
     exact staged SHA. Template ships only a static `wrangler pages deploy`
     stub. *(Note: the template runtime is static Cloudflare Pages; maestro is
     Cloudflare Workers
     - TanStack Start SSR + Convex — this is a runtime upgrade, not a copy.)*
272. **Deploy toolchain scripts** — HIGH — Port.
     `scripts/{doctor-deploy,smoke-deploy,apply-worker-vars,build-worker-secrets, sync-project-config,deploy-doctor-env}.mjs`.
     Env-name mapping, Worker var/secret assembly (secrets never via argv),
     pre-deploy doctor, post-deploy live smoke. Node scripts — no `scripts/` dir
     in the template.
273. **Deploy source-of-truth config + drift check** — HIGH — Port.
     `project.config.json` + `sync:project-config`. Per-env worker names,
     domains, canonical→per-env env-name groups in one declarative file; drift
     is a red gate.
274. **Deploy-time env-presence gate** — HIGH — Port.
     `scripts/check-convex-production-env.mjs`, `check:convex-deploy-env`.
     Proves required Convex/Worker env names exist before cutover (never
     printing values), fails closed. Catches the top cause of broken prod.
275. **Error tracking / ErrorReporter (Sentry-class)** — HIGH — partial.
     `packages/observability` exposes a provider-neutral `ErrorReporter`
     contract with recursive redaction, release/environment metadata, severity,
     handled status, deterministic fingerprints, fake/test/live-ready delivery,
     and dropped retryable sink failures. Remaining work: wire a live provider
     such as Sentry or PostHog exception capture, source-map upload, release
     creation, and hosted verification in client forks.
276. **Structured ops logging + correlation-id propagation** — MED — Greenfield
     / partial (`requestIdFor`, item 72). Redaction-aware structured log seam
     threading a request/trace id through capability → action → provider.
277. **Backend health / liveness surface** — MED — partial.
     `packages/convex/confect/ops/health.*` now exposes a Confect `liveness`
     public query with typed fake/test/live reports, runtime and Confect
     registration checks, provider-posture guidance, environment, commit SHA,
     and check timestamp. `packages/convex/test/health.test.ts` pins the schema
     contract, and [operations-runbook.md](./operations-runbook.md) documents
     deploy-doctor pairing for test/live modes. Remaining work: add
     workspace-scoped subsystem coverage for status-board style uptime probes
     when forks wire live Brain, scheduling, provider, and tenant health
     signals.
278. **Workpool job pattern (bounded concurrency + retry/backoff)** — MED —
     Port. `capabilities/references/creatorEnrichmentRuns.ts` on
     `@convex-dev/workpool`. Idempotent enqueued jobs with concurrency caps +
     retry (component already in the template's convex.config per item 138; the
     usage pattern is the gap).
279. **Idempotent system seeder + demo-workspace bootstrap** — MED — Port.
     `policy/seed.ts` (existence-guarded system rows, runs every deploy),
     `domain/seedWorkspace.ts`. Boot a new build with sane defaults + a demoable
     workspace via one command. Strip GTM content; rewrite in Confect.
280. **Test factory/fixture library + convex-test conventions** — MED — Port
     (partial). `domain/seedWorkspace.ts`, `**/__fixtures__/*`, playwright
     `apps/web/e2e/`. Schema-valid row builders + the convex-test harness the
     captured gates (J/K) assume exists. Item 57 covers only graph fixtures.
281. **Feature flags / gradual rollout / kill switches** — MED — partial.
     `packages/integrations/src/flags.ts` provides fake-safe local flag
     definitions, deterministic workspace rollout buckets, internal/workspace
     audience checks, and explicit kill-switch env overrides for live billing,
     notifications, and AI generation. `/onboarding` setup copy now includes a
     rollout and kill-switch readiness step. Confect `featureFlagPolicies` and
     `ops.flags` now provide durable per-workspace list/evaluate/upsert
     contracts while preserving starter-safe disabled defaults for live side
     effects. Remaining work: connect generated product surfaces to the
     evaluator before client-specific live rollout.
282. **Retention/TTL/erasure cron + DSAR export/delete** — MED (compliance-HIGH)
     — partial. `packages/convex/confect/ops/dataLifecycle.ts` now covers the
     current resource inventory, DSAR export manifests, DSAR delete plans, exact
     delete confirmation, legal-hold blocking, dry-run retention job planning,
     and tenant-guarded audited DSAR request persistence through
     `ops.dataLifecycle`. `packages/convex/test/data-lifecycle*.test.ts` pins
     those contracts. Remaining work: wire actual export bundles,
     redaction/delete execution, scheduled cron, legal-hold records, and
     client-specific processor inventory before a production fork fulfills live
     DSAR or retention actions.
283. **HTTP security headers (CSP / HSTS / X-Frame / nosniff /
     Referrer-Policy)** — MED — partial. Convex HTTP routes expose
     `securityHeaders` and `packages/convex/test/http-docs.test.ts` verifies
     CSP, HSTS, `X-Frame-Options: DENY`, nosniff, and no-referrer headers. The
     static Cloudflare Pages app now ships `apps/web/public/_headers` with CSP,
     HSTS, frame, nosniff, referrer, and permissions-policy defaults, and
     `apps/web/src/security-headers.test.ts` pins the contract. Remaining work:
     remove the static shell's `script-src 'unsafe-inline'` allowance when the
     TanStack Start render path supports nonce/hash-based inline bootstrap
     scripts, and mirror/verify equivalent headers if a fork moves to Workers
     SSR.
284. **Ops alerting — outbound Slack/webhook** — MED — partial.
     `packages/notifications` exposes a redacted fake/test/live-ready alert seam
     with stable `dedupeKey` handling, and release tooling now attaches redacted
     alert plans to failed deploy doctor reports and refused production
     promotions. Remaining work: add a live Slack/webhook sink in client forks
     and extend alert plans to spend-cap trips and webhook-dedup conflicts.
285. **Comprehensive `.env.example` / env manifest across services** — MED —
     partial. `docs/template/env-manifest.json` is now the machine-readable
     source of truth and is checked against `.env.example`, provider
     descriptors, generator secret lists, Convex component env, setup UI
     readiness copy, and `project.config.json` required deploy secrets.
     `docs/template/env-manifest.md` remains the human guide with owner,
     fake-mode, production, and rotation posture. `pnpm template:doctor` reads
     provider requirements from the manifest, and `pnpm deploy:doctor` consumes
     the JSON manifest to expand deploy env groups into concrete missing env
     names without printing values. Remaining work: wire future
     voice-relay/client-fork services to consume the JSON manifest directly
     instead of maintaining parallel lists.
286. **Pagination convention/helper** — LOW — Port (convention).
     `paginationOpts`/ `.paginate()` used ad hoc at ~16 sites; ship one
     cursor-pagination pattern.
287. **Transactional email template rendering** — LOW — Greenfield (extends item
     29). Versioned, testable templates for invite/receipt/onboarding emails.
288. **Outbound webhooks for integrators** — LOW — Greenfield. Section G
     captures inbound; add signed outbound event delivery with retry so
     integrators subscribe instead of poll.

---

## Suggested first slice (diligence-grade MVP)

If you do one vertical, do this: component wiring (138) → env + crypto + errors
(11, 12, 17) → tenancy spine (1–2, 5–8) → LLM gateway + guardrails + telemetry
(19–24) → policy-as-data + prompt registry (32–35, 38) → agent runtime (41–42) →
one real capability + eval (92–93) → replace the gate stubs with the real
dependency-light gates (96–99, 104–108). That yields a shell that actually makes
a guarded, observable model call behind real multi-tenant auth, with real gates
proving it — which is the honest version of the story the template currently
only stages.
