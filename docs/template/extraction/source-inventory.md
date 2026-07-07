# Source Inventory

This inventory defines what the template may keep, what must be generalized,
what may appear only as a synthetic example, and what must never be copied from
Maestro. The source repo is `/Users/headless/maestro`; this template repo starts
with clean extraction history and deliberately does not preserve Maestro's full
git history.

## Keep As Generic Primitive

- Convex workspace tenancy, auth wrappers, role gates, and server-derived
  authority.
- WorkOS/AuthKit workspace provisioning and membership flows.
- Capability discipline, backend layer law, and policy-gated execution.
- Workflow graph model and React Flow command/reducer/editor architecture.
- Brain markdown, links, sources, context packs, evidence, freshness, and trust
  receipts.
- Headless registry projected to API, CLI, MCP, and Scalar docs.
- LLM gateway, policy registry, model refs, kill switches, usage telemetry, and
  spend controls.
- PostHog, Dodo, email lifecycle, notifications, storage, admin/support/audit,
  data lifecycle, API keys, search, feature flags, release operations, Notion
  Kit, and CI/CD gates.

## Generalize Before Copy

- `posts` -> documents, artifacts, outputs, or extension-specific deliverables.
- `client` as tenant -> workspace.
- `client` as business subject -> subject, account, or an extension-specific
  noun.
- `lead magnet` -> asset recipe or publication.
- `call transcript` -> source intake.
- `LinkedIn analytics` -> external performance signal.
- `Voice DNA` -> style guide, preference memory, or brand profile.
- Launch-specific routes -> generic first-run, onboarding, health, and reviewer
  routes.
- Maestro-specific prompts -> synthetic template prompts with no customer,
  launch, or investor-sensitive facts.

## Example Only

- GTM/content workflows that demonstrate the architecture without becoming core
  template assumptions.
- Subject-specific UI after redaction and synthetic fixture replacement.
- Provider webhook examples that use fake payloads and fake ids.
- Billing, email, and analytics examples that use fake plans, fake recipients,
  and fake events.

## Drop

- Maestro launch copy.
- Client-private prompts, examples, transcripts, source material, screenshots,
  and investor-sensitive launch docs.
- Secrets, API keys, webhook payloads, raw provider logs, and support artifacts.
- Legacy prototype routes with no reusable value.
- Duplicated frontend systems superseded by Saas UI and the current block layer.
- Product-specific LinkedIn, creator, launch, or agency assumptions unless they
  are converted into generic examples.

## Defer

- Capture/voice sidecar.
- ProseMirror/BlockNote collaborative editing.
- Full vector/RAG retrieval.
- Broad Maestro Confect migration.
- Live production provider provisioning.

## Source Specs And PR Streams

Primary architecture sources:

- `/Users/headless/maestro/docs/superpowers/specs/2026-07-01-maestro-template-repo-architecture.md`
- `/Users/headless/maestro/docs/superpowers/plans/2026-07-01-maestro-template-repo-execution-plan.md`

Representative reusable streams to mine deliberately:

- Historical frontend shell streams: PR #1385, #1400, #1390, #1397, #1383,
  #1384, #1259, #1249, #1254, and the `canonical-nk-*` stream. Treat these as
  source history, not the active frontend target for this fork.
- Workflow builder and React Flow: PR #869, #1374, and #1370.
- Living Knowledge: PR #1031, #1035, #1038, #1039, #1040, #1047, #1048, #1053,
  #1057, #1063, #1069, #1072, #1073, #1104, #1151, #1167, #1172, and #1195.
- Brain: PR #421, #422, #653-#667, and #1349.
- Headless/API/CLI/MCP: PR #736-#749, #1184, #1186, #1187, #1188, and #1331.
- Platform and operations: PR #2, #423-#427, #801, #843, #849-#855, #864, #1311,
  #1314, #1317, #1362, and #1366-#1408.
- Access, admin, support, and privacy lifecycle: PR #67, #85, #1359, #1376, and
  launch docs around audit, support, export/delete, and incident handling.
- Onboarding and demo workspace: PR #468-#471 plus safe demo data and seeding
  boundary docs.
- Capture, voice, and source intake: PR #390-#398, #914, #950, and related voice
  relay/browser capture/manual transcript docs.
- Storage, media, export, and collaboration: PR #948, #1408, asset storage,
  review-token, ProseMirror, BlockNote, and media boundary docs.
- Observability, release, and rollback: PR #294 plus PostHog readiness, SLO,
  deploy smoke, staging parity, provider outage, rollback, and release artifact
  docs.
- Architecture, coding rules, and test-safety: `AGENTS.md`,
  `docs/architecture.md`, `docs/rule-coverage.md`, backend scaffold playbooks,
  custom lint rules, and `tooling/quality/*` gates.
- API versioning, commercial operations, and lifecycle email streams.

Open PRs are design input, not automatically trusted production code. Prefer
merged source for the first template branch and port open-PR ideas deliberately
after review.
