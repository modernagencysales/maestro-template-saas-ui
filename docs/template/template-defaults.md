# Template Defaults And Extension Paths

This page is the decision record for what the private template ships by default
versus what a client fork must deliberately enable. It prevents the starter from
drifting into either a thin demo or a fake all-in-one SaaS product.

The rule: the template default must be safe in fake mode, deterministic in
tests, and useful for a first client build. Anything that requires live provider
ownership, legal signoff, or customer-specific policy starts as an extension
path with an explicit promotion gate.

## Decision Matrix

| Surface            | Template default                                                                                                                                                                                                                            | Extension path                                                                                                                                    | Promotion gate                                                                                                                            | Proof                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Billing            | Fake-first Dodo-shaped billing contracts plus durable entitlement-gated usage recording, webhook event persistence, usage events, and append-only credit-ledger debits.                                                                     | Live checkout, portal, pricing packages, tax, invoices, refunds, webhook domain effects, and provider reconciliation.                             | Paid fork only after Dodo sandbox smoke, webhook idempotency, env manifest signoff, and billing owner approval.                           | `packages/integrations/src/dodo.ts`, `packages/convex/confect/ops/billing.*`, `docs/template/integrations.md`, `docs/template/env-manifest.md`.                                                                                                          |
| Notifications      | Provider boundary, generator path, redacted notification/email seams, generated-ref backed in-app center, durable notification tables, read state, and channel preferences.                                                                 | Digests, Slack/webhook alerts, provider-backed delivery, and live deliverability.                                                                 | Fork enables when it has recipient policy, opt-out posture, template copy, provider credentials, and failure alert routing.               | `packages/notifications`, `packages/convex/confect/ops/notifications.*`, `apps/web/src/routes/_app/$workspace/_dashboard/notifications.tsx`, `docs/template/how-to-add-notification.md`, `docs/template/client-handoff-packet.md`.                       |
| Feature flags      | Fake-safe local definitions plus durable per-workspace `ops.flags` policies with list/evaluate/upsert contracts and disabled live side-effect defaults.                                                                                     | Route generated product surfaces through `ops.flags.evaluate` and add client-specific live rollout approvals.                                     | Fork enables only after owner-approved rollout policy, kill-switch review, and live-provider promotion signoff.                           | `packages/integrations/src/flags.ts`, `packages/convex/confect/ops/flags.*`, `packages/convex/confect/tables/featureFlagPolicies.ts`, `packages/convex/test/flags.test.ts`.                                                                              |
| Retention and DSAR | Data lifecycle planner, tenant-guarded dry-run DSAR request persistence, generated-ref backed `/data-lifecycle` request review, export/delete request plans, legal-hold blocking, dry-run retention job planning, and per-resource posture. | Audited scheduled retention execution, live legal-hold workflow, destructive DSAR fulfillment mutations, and client-specific processor inventory. | Production fork only after legal/compliance signoff and resource-specific tests update the lifecycle planner.                             | `packages/convex/confect/ops/dataLifecycle.*`, `packages/convex/confect/tables/dsarRequests.ts`, `apps/web/src/routes/_app/$workspace/_dashboard/data-lifecycle.tsx`, `packages/convex/test/data-lifecycle*.test.ts`, `docs/template/data-lifecycle.md`. |
| Deploy promotion   | Release, smoke, backup/restore, rollback, and doctor tooling as guarded scripts and docs.                                                                                                                                                   | Environment-specific staging-to-production promotion, domains, Worker/Pages secrets, live smoke, and incident hooks.                              | Fork promotes only after provider env signoff, hosted smoke on the client domain, secret scan, rollback proof, and signed handoff packet. | `tooling/release`, `docs/template/template-release-process.md`, `docs/template/client-handoff-packet.md`, `project.config.json`.                                                                                                                         |

## Default Bar

### Public app-idea funnel

The template includes the complete funnel in deterministic fake mode: public
landing and intake, a useful free report, browser-local test checkout, verified
fake webhook transition, resumable eight-stage Build Pack, report library,
revocable public snapshot, lifecycle email intent, and conditional Maestro
handoff. The original Saas UI business dashboard remains available at
`/dashboard`.

Live OpenRouter, Dodo, Postmark email, durable Confect wiring, pricing, tax, and
traffic promotion are extension steps. A fork promotes them only after provider
credentials, spend ceilings, webhook replay/signature tests, privacy copy,
retention policy, support ownership, and hosted browser smoke are approved.

A surface belongs in the template default when all of these are true:

- It runs without live secrets.
- It has fake or test provider behavior that cannot charge, email, mutate an
  external system, or leak customer data.
- It is useful to every serious B2B AI app fork.
- It has typed contracts, docs, and focused tests.
- It participates in the Day-0 factory loop or is required to verify that loop.

## Extension Bar

A surface stays an extension path when any of these are true:

- It requires live provider ownership or account-specific configuration.
- It depends on pricing, legal, compliance, retention, or recipient policy.
- It would create customer-visible side effects.
- Its correct UX depends on the client domain, not the generic template.
- It can be generated or documented without blocking the starter baseline.

## Promotion Checklist

When a client fork promotes an extension into production behavior, the same
change must update:

- `template-instance.json` provider posture.
- `docs/template/generated/implementation-brief.md`.
- `docs/template/generated/provider-checklist.md`.
- `docs/template/generated/handoff-packet.md`.
- `docs/template/env-manifest.md` or the fork-specific env manifest.
- Focused tests for the promoted provider, lifecycle, route, or deploy path.

Do not promote live billing, notification delivery, retention deletion, or
production deploy promotion by changing only environment variables. Promotion is
a code, docs, test, and handoff event.
