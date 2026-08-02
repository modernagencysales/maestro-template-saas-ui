# Integrations

Integrations are Effect services with fake, test, and live layers. The template
must run without live credentials. Adapter boundaries live in
`packages/integrations/src/index.ts` and return Effect programs with typed,
public-safe provider errors.

## Default Families

- `LlmGateway`
- `PolicyResolver`
- `Flags`
- `Billing`
- `Analytics`
- `ErrorReporter`
- `Email`
- `Notifications`
- `Storage`
- `Search`
- `Jobs`
- `Connectors`
- `Documents`
- `Operations`

## Concrete Adapter Targets

- WorkOS/AuthKit for auth and organizations.
- PostHog for analytics.
- Dodo for billing.
- Provider-neutral email with Postmark as the live adapter: `outbound` for
  transactional templates and `broadcast` for explicitly opted-in marketing.
- OpenRouter-compatible LLM provider through an OpenAI-compatible client
  surface.
- Local feature flag definitions plus durable `ops.flags` workspace policy
  records for fake-safe rollout and kill-switch checks.

Resend, Sentry, Slack/webhooks, CRM, drive, and Notion connectors are optional
adapters.

## Email And Postmark

Application code depends on the neutral `EmailProvider` contract in
`packages/integrations/src/email.ts`. Live Postmark calls use the `outbound`
stream for transactional templates and the `broadcast` stream for marketing.
Transactional messages disable open and link tracking; broadcasts include
per-recipient results and RFC 8058 one-click unsubscribe headers.

Configure the server-only token and separate verified senders from
`.env.example`. Create the `verify-report-email`, `build-pack-ready`,
`workspace-invitation`, `notification-digest`, and `simple-broadcast` template
aliases before enabling live delivery. Marketing callers must persist explicit
opt-in, recheck suppression immediately before dispatch, and retry only
transient failures. Authenticate Postmark webhooks with the documented Basic
Auth variables and normalize bounce, complaint, and subscription-change events
without storing raw payloads.

Before production, verify DKIM and return-path DNS, send to Postmark's sandbox
or black-hole addresses, test hard and soft bounces, and warm traffic gradually.

## PostHog Backend Event Capture

PostHog backend capture covers Confect mutation and action failures only. Wrap
Effect programs with `withMutationErrorCapture(functionPath, effect)` or
`withActionErrorCapture(functionPath, effect)` so failed effects emit the
`template.confect.failure` event before the original Effect cause is re-failed.

The event contract is intentionally small and public-safe:

- `functionPath`, such as `brain/pages.createMarkdown`
- `kind`, either `mutation` or `action`
- public error tag
- redacted public message
- stable cause hash
- optional workspace and user identifiers when already available

Capture is best-effort. PostHog delivery errors are dropped by the capture path
and must not replace, mask, or retry the original application failure. Query
capture is not included in this slice because Confect query context does not
provide the scheduler required by the PostHog Convex component.

## ErrorReporter

`packages/observability` also exposes a provider-neutral `ErrorReporter`
contract for Sentry-class exception tracking. The template reporter is fake-safe
by default and normalizes every report into a small public-safe event:

- `type: "template.error"`
- sanitized error name and generic public message
- deterministic fingerprint
- severity, handled status, release, and environment
- redacted context and string tags

Reporter delivery is best-effort. Sink failures return a dropped retryable
result and must not replace the original application failure. Client forks can
wire Sentry, PostHog exception capture, or another provider behind the same
event shape after approving release names, environment names, source-map upload,
and privacy posture.

## Rules

- Decode config through typed config modules.
- Redact provider errors.
- Redact common secret field names for every provider, then apply
  provider-specific redaction.
- Verify webhook signatures and replay windows.
- Keep raw provider payloads out of logs and public errors.
- Add fake-mode smoke tests before live setup.
- Live mode validates required env var names before an adapter can be
  constructed.

## Billing And Dodo

Dodo remains fake-first in the template. Live Dodo calls stay behind
`packages/integrations/src/dodo.ts`, while `packages/convex/confect/ops/billing`
stores the reusable billing state:

- `applyWebhook` persists Dodo webhook event identity after provider
  normalization, returns `duplicate` for exact replay, and rejects dedupe-key
  reuse with mismatched payload identity
- `recordUsage` is persistence-backed: it validates workspace-scoped idempotency
  keys, requires an active entitlement with remaining credits, writes a durable
  usage event, writes an append-only credit-ledger debit, and increments
  entitlement usage
- entitlements model seats, credits, and feature limits without hard-coding a
  pricing plan
- seat checks return typed failures instead of silently over-provisioning

Fake billing receipts redact customer and provider metadata. Webhook
normalization also redacts raw payload `data`, so tests and logs can inspect
event identity without leaking customer emails, Dodo customer IDs, checkout
session IDs, or signatures.

## Inspect Readiness

The provider catalog lives in `packages/integrations/src/index.ts`. It declares
fake/test/live posture, required live env var names, redacted fields, adapter
construction, and deterministic fake/test/live-ready receipts for each provider.
Inspect it through:

```bash
pnpm exec tsx apps/cli/src/index.ts integrations report fake
pnpm exec tsx apps/cli/src/index.ts integrations report live
pnpm --dir packages/integrations test
```

Live mode reports missing env var names only; it must not print secret values.
Fake and test modes construct adapters without secrets and return redacted
receipts through the Effect error channel. Live mode is a configured boundary:
client apps replace the deterministic `live-ready` receipts with SDK-backed
provider calls inside the same adapter shape.
