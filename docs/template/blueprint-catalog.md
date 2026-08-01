# Blueprint Catalog

Blueprints are packages of opinion for common B2B AI/GTM implementation apps.
They make the first fork fast without locking client-specific business logic
into template core.

Status note: `source-grounded-gtm-brain` is the default implemented generator
blueprint. `gtm-implementation` is an optional implemented blueprint pack for
more specific B2B GTM software. `saas` is the implemented general-purpose path
for tenant-aware subscription products. The other blueprints are strategic
catalog targets until their generator support, seed data, tests, and handoff
docs land. Do not present a planned blueprint as a working quickstart path.

## `source-grounded-gtm-brain`

Status: implemented generator baseline.

Use this for a GTM or client-context Brain with sources, context packs, grounded
briefs, workflow receipts, and headless access.

- Domain nouns: workspace, source, source set, context pack, capability,
  workflow, agent, Trust Receipt.
- Source types: markdown, links, notes, uploaded documents, approved CRM export.
- First capability: `summarizeSource`.
- First workflow: `sourceGroundedPlan`.
- First agent grants: read sources, create context pack, run grounded workflow,
  create Trust Receipt.
- Required providers: Convex, fake/local LLM gateway, local storage.
- Optional providers: WorkOS, PostHog, Dodo, MailerSend, OpenRouter-compatible
  LLM, object storage, search/vector provider.
- UI routes: `/brain`, `/sources`, `/workflows`, `/capabilities`, `/agents`,
  `/runs`, `/api`, `/settings`.
- Headless surfaces: API, CLI, MCP, OpenAPI/Scalar.
- Eval fixtures: groundedness, citation presence, refusal on missing source,
  policy pinning, receipt completeness.
- Demo data: synthetic markdown notes, safe links, context pack, workflow run,
  Trust Receipt.
- Delete or rename for a fork: generic demo names, sample proof points, fake
  source bodies, and sample provider posture.

## `implementation-consulting-brain`

Status: planned blueprint pack.

Use this for a client implementation workspace with discovery intake,
integration mapping, project workflows, risk register, and operator/admin
surfaces.

- Domain nouns: client, discovery answer, integration, milestone, risk,
  approval, deliverable, operator note.
- Source types: intake forms, markdown notes, links, call summaries, integration
  manifests.
- First capability: `summarizeDiscovery`.
- First workflow: `implementationPlan`.
- First agent grants: read discovery, draft integration map, create risk
  register, request approval.
- Required providers: Convex, fake/local LLM gateway, local storage.
- Optional providers: WorkOS, PostHog, MailerSend, project-management adapter,
  CRM adapter, Drive/Notion adapter.
- UI routes: `/onboarding`, `/brain`, `/integrations`, `/workflows`, `/runs`,
  `/admin`, `/settings`.
- Headless surfaces: API, CLI, MCP.
- Eval fixtures: requirement extraction, integration risk labeling, approval
  gating, handoff completeness.
- Demo data: discovery questionnaire, integration shortlist, risk register,
  implementation workflow receipt.
- Delete or rename for a fork: consulting-specific stage names, synthetic
  discovery answers, placeholder integration names.

## `gtm-implementation`

Status: optional implemented blueprint pack.

Use this for account-centric B2B GTM apps that need account briefs, buying
committee context, CRM/Drive/Notion connector seams, and reporting surface seams
without putting GTM business logic into template core.

- Domain nouns: account, person, buying committee, source, account brief,
  follow-up action, pipeline stage.
- Source types: markdown, links, notes, CRM export, Drive document.
- First capability: `buildAccountBrief`.
- First workflow: `gtmAccountResearch`.
- First agent grants: read account/person/source context, draft account brief,
  identify missing evidence, request approval before external action.
- Required providers: Convex, fake/local LLM gateway, local storage.
- Optional providers: WorkOS, PostHog, Dodo, MailerSend, CRM, Drive, Notion,
  OpenRouter-compatible LLM, object storage.
- UI routes: `/brain`, `/sources`, `/workflows`, `/capabilities`,
  `/integrations`, `/notifications`, `/billing`, `/analytics`.
- Headless surfaces: API, CLI, MCP.
- Demo data: `.example` accounts, fake people, synthetic source notes.
- Delete or rename for a fork: every synthetic account/person/source fixture and
  all generated reporting surface seams that do not match client language.

## `saas`

Status: implemented general-purpose blueprint.

Use this for a conventional tenant-aware SaaS product that needs the template's
authentication, billing, durable workflow, provider, and production-readiness
patterns without GTM-specific nouns.

- Domain nouns: organization, member, workflow, subscription, plus generated
  product-specific nouns.
- First capability: `coreWorkflow`.
- First workflow: `productWorkflow`.
- First agent grants: explicit access to the generated product capability and
  workflow only.
- Generator path: `template:add-client-domain` followed by
  `template:add-capability` for the first useful customer outcome.
- Required gates: Confect contracts and route-tree validation, followed by the
  generated capability's behavior tests.
- Headless surfaces: web, API, CLI, and MCP when intentionally exposed.
- Do not claim native or offline application support; map those requirements to
  an explicit template gap and portable handoff.

## `internal-ops-agent-workspace`

Status: planned blueprint pack.

Use this for an internal workflow/agent system with tickets, approvals,
notifications, and operational dashboards.

- Domain nouns: ticket, queue, approval, escalation, notification, runbook,
  operator, incident.
- Source types: markdown runbooks, links, notes, ticket exports, status events.
- First capability: `triageRequest`.
- First workflow: `approvalEscalation`.
- First agent grants: read runbooks, classify request, create approval, send
  notification through approved seam.
- Required providers: Convex, fake/local notification seam, fake/local LLM
  gateway.
- Optional providers: WorkOS, PostHog, MailerSend, Slack/Teams adapter, storage.
- UI routes: `/runs`, `/workflows`, `/agents`, `/notifications`, `/health`,
  `/admin`, `/settings`.
- Headless surfaces: API, CLI, MCP.
- Eval fixtures: escalation policy, notification idempotency, approval denial,
  audit completeness.
- Demo data: synthetic tickets, approval policy, workflow events, operator
  receipt.
- Delete or rename for a fork: sample queue labels, fake runbooks, placeholder
  notification targets.

## `custom-domain-ai-app`

Status: planned lowest-assumption generator path.

Use this as the lowest-assumption path for a client-specific app with custom
nouns and private packages.

- Domain nouns: generated by `template:add-client-domain`.
- Source types: markdown, links, notes until a reviewed source owner exists.
- First capability: generated by `template:add-capability`.
- First workflow: generated by `template:add-workflow`.
- First agent grants: explicit grants to generated capabilities and workflows.
- Required providers: Convex and fake/local provider posture.
- Optional providers: selected during discovery and documented in the env
  manifest.
- UI routes: start with `/brain`, `/workflows`, `/capabilities`, `/api`, and
  `/settings`.
- Headless surfaces: API, CLI, MCP when the operation is intentionally exposed.
- Eval fixtures: generated alongside the first capability or workflow.
- Demo data: synthetic seed data only.
- Delete or rename for a fork: all generic nouns that do not match the client
  language.
