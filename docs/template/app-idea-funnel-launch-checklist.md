# App idea funnel launch checklist

Audited against current source and focused evidence on 2026-08-01. See
`app-idea-funnel-launch-audit.md` for the evidence map and unresolved gates.

## Product and language

- [x] Landing promise reads “Tell me if your app idea is good.” and “Know what
      it will take to build it.”
- [x] Primary acquisition action reads “Roast my app idea”.
- [x] Free report reveals the verdict, evidence, constructive roast, improved
      concept, and next steps without blur or payment.
- [x] Paid copy explains the exact Complete Build Pack contents and
      first-purchase Maestro credit without implying guaranteed commercial
      success.
- [x] Low Maestro fit recommends taking the spec elsewhere and suppresses the
      Maestro build CTA.

## Free evaluation economics

- [x] Free and premium models are separately configured and server-only.
- [x] Free call, input/output token, repair, per-evaluation spend, and daily
      spend limits fail closed before provider transport.
- [x] Free evaluation has no research, browsing, tools, or multi-agent loop.
- [x] Structured model output decodes before persistence; malformed output uses
      at most the configured repair allowance.

## Persistence and ownership

- [x] Anonymous access tokens are opaque and stored only as hashes.
- [x] Answers survive transport/model failure and can be edited.
- [x] Report revision appends and persists a version while retaining version 1.
- [x] Email verification safely claims an anonymous report.
- [x] Share snapshots exclude private answers and can be revoked.
- [x] Library loading, empty, ready, and failure states are tested.

## Commerce

- [x] Checkout is created server-side with report and product metadata.
- [x] Return URL shows payment pending and cannot grant entitlement.
- [x] Raw-body signature, timestamp freshness, and provider event ID are
      checked.
- [x] Duplicate webhooks create one purchase, entitlement, and Maestro credit.
- [x] Refund and dispute fixtures revoke access correctly.
- [x] Provider failure and delayed webhook journeys recover without repurchase.

## Complete Build Pack

- [x] Active entitlement is required before generation.
- [x] All eight stages checkpoint decoded output and record cost receipts.
- [x] Desktop/mobile retry resumes the failed stage without rerunning completed
      stages or requiring another purchase.
- [x] Research claims require citations and sources are displayed.
- [x] Viewer and Markdown/print exports use the same canonical section IDs.
- [x] Paid failures expose a support ID and resumable operator action.

## Maestro handoff

- [x] Mapping uses the existing generator/blueprint catalog.
- [x] Planned blueprints are never presented as executable.
- [x] Template gaps include backlog references and resolution paths.
- [x] Handoff contains nouns, capabilities, workflows, providers, work packages,
      gates, and a coding-agent prompt.
- [x] Equal purchase credit is visible and applied once.

## Privacy, accessibility, and operations

- [x] Analytics schemas reject idea, answer, report, prompt, output, email, and
      payment content.
- [x] Data deletion, share revocation, refund, and support-resume journeys pass.
- [x] Every public route works with keyboard navigation, visible focus, useful
      landmarks, labels, error announcements, 200% zoom, and 320px reflow.
- [x] Desktop and narrow visual evidence covers landing, intake, report,
      checkout, progress, Build Pack, library, and Maestro offer.
- [x] Operations runbook and support escalation paths are reviewed.

## Paid traffic attribution

- [x] PageView remains browser-side and consent-aware.
- [x] Lead fires once after a durable Buildability Report, not on typing or
      provider failure.
- [x] The sanitized Admaxxer visitor ID crosses into Dodo metadata without
      entering URLs or authorization state.
- [x] Verified payment binds product, actual amount, currency, checkout, and
      report before entitlement or equal Maestro credit.
- [x] Admaxxer Purchase retries by Dodo payment ID until `admaxxerReportedAt` is
      durable; missing live configuration fails closed.
- [ ] Live `$1` Build Pack canary, refund/revocation, and Meta CAPI trace remain
      owner/provider-gated.

## Gates

- [x] Focused package, web, Convex, workflow, and Playwright suites pass through
      `host-test-slot`.
- [x] Format, lint, typecheck, build, route, frontend, environment, provider,
      logging, Confect, workflow, migration, secret, and PostHog checks pass.
- [ ] Generator-connected Convex checks pass in their configured environment.
- [x] `host-test-slot --class full pnpm verify` passes without weakening gates.
