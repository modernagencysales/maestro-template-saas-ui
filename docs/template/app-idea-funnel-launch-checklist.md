# App idea funnel launch checklist

## Product and language

- [ ] Landing promise reads “Tell me if your app idea is good.” and “Know what
      it will take to build it.”
- [ ] Primary acquisition action reads “Roast my app idea”.
- [ ] Free report reveals the verdict, evidence, constructive roast, improved
      concept, and next steps without blur or payment.
- [ ] Paid copy explains the exact Complete Build Pack contents and
      first-purchase Maestro credit without implying guaranteed commercial
      success.
- [ ] Low Maestro fit recommends taking the spec elsewhere.

## Free evaluation economics

- [ ] Free and premium models are separately configured and server-only.
- [ ] Free call, input/output token, repair, per-evaluation spend, and daily
      spend limits fail closed before provider transport.
- [ ] Free evaluation has no research, browsing, tools, or multi-agent loop.
- [ ] Structured model output decodes before persistence; malformed output uses
      at most the configured repair allowance.

## Persistence and ownership

- [ ] Anonymous access tokens are opaque and stored only as hashes.
- [ ] Answers survive transport/model failure and can be edited.
- [ ] Report revision appends a version.
- [ ] Email verification safely claims an anonymous report.
- [ ] Share snapshots exclude private answers and can be revoked.
- [ ] Library loading, empty, ready, and failure states are tested.

## Commerce

- [ ] Checkout is created server-side with report and product metadata.
- [ ] Return URL shows payment pending and cannot grant entitlement.
- [ ] Raw-body signature, timestamp freshness, and provider event ID are
      checked.
- [ ] Duplicate webhooks create one purchase, entitlement, and Maestro credit.
- [ ] Refund and dispute fixtures revoke access correctly.
- [ ] Provider failure and delayed webhook journeys recover without repurchase.

## Complete Build Pack

- [ ] Active entitlement is required before generation.
- [ ] All eight stages checkpoint decoded output and record cost receipts.
- [ ] Retry resumes the failed stage without rerunning completed stages.
- [ ] Research claims require citations and sources are displayed.
- [ ] Viewer and Markdown/print exports use the same canonical section IDs.
- [ ] Paid failures expose a support ID and resumable operator action.

## Maestro handoff

- [ ] Mapping uses the existing generator/blueprint catalog.
- [ ] Planned blueprints are never presented as executable.
- [ ] Template gaps include backlog references and resolution paths.
- [ ] Handoff contains nouns, capabilities, workflows, providers, work packages,
      gates, and a coding-agent prompt.
- [ ] Equal purchase credit is visible and applied once.

## Privacy, accessibility, and operations

- [ ] Analytics schemas reject idea, answer, report, prompt, output, email, and
      payment content.
- [ ] Data deletion, share revocation, refund, and support-resume journeys pass.
- [ ] Every public route works with keyboard navigation, visible focus, useful
      landmarks, labels, error announcements, 200% zoom, and 320px reflow.
- [ ] Desktop and narrow visual evidence covers landing, intake, report,
      checkout, progress, Build Pack, library, and Maestro offer.
- [ ] Operations runbook and support escalation paths are reviewed.

## Gates

- [ ] Focused package, web, Convex, workflow, and Playwright suites pass through
      `host-test-slot`.
- [ ] Format, lint, typecheck, build, route, frontend, environment, provider,
      logging, Confect, workflow, migration, secret, and PostHog checks pass.
- [ ] Generator-connected Convex checks pass in their configured environment.
- [ ] `host-test-slot --class full pnpm verify` passes without weakening gates.
