# App idea funnel launch audit

Audit date: 2026-08-02

## Proven product requirements

| Area                                  | Authoritative evidence                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product language and free value       | Approved language bank; landing/report component tests; the desktop/mobile functional and visual Playwright journeys.                                                                                                     |
| Free model economics                  | Evaluator model-policy tests; integration gateway/spend tests; server-only environment/provider boundary gates; persisted receipt and global UTC-day spend tests.                                                         |
| Ownership and persistence             | Evaluator state and report-revision capability tests; claim/share/delete Confect tests; desktop/mobile email claim, append-only revision persistence, share revocation, and deletion browser journeys.                    |
| Commerce                              | Dodo raw-body signature tests; checkout and webhook capability tests; delayed-return UI tests; refund/dispute entitlement and credit revocation tests.                                                                    |
| Complete Build Pack                   | Thirteen pipeline tests cover entitlement, eight checkpoint leases, retry, support resume, refund between stages, citations, and receipts. Desktop/mobile retry proves completed checkpoint retention without repurchase. |
| Maestro handoff                       | Evaluator mapping, generator catalog, server-owned offer, and credit tests; desktop/mobile low-fit journey proves CTA suppression and portable handoff.                                                                   |
| Analytics and privacy                 | Strict discriminated event schemas; consent-provider tests; transition deduplication; fresh-versus-replay evaluation telemetry tests; secret scan and PostHog readiness gate.                                             |
| Accessibility and responsive behavior | `app-idea-funnel.accessibility.spec.ts`: 8 passing tests across desktop/mobile, including core and auxiliary public routes, axe, keyboard/focus/error behavior, 320px reflow, and 200% text sizing.                       |
| Visual evidence                       | `app-idea-funnel.visual.spec.ts`: canonical desktop/mobile snapshots for landing, intake, report, library, checkout, progress, Build Pack, and Maestro.                                                                   |
| Operations                            | `app-idea-funnel-operations.md`, durable support incidents, specific operator-reason validation, entitlement recheck, checkpoint-preserving resume, and public support IDs.                                               |

## Launch implementation reproof

Final implementation branch: `codex/app-idea-launch` at `60307f669`.

- Durable Buildability Report Lead fires only after the report is saved/claimed;
  replay and provider-failure paths remain deduplicated.
- The sanitized Admaxxer visitor ID is carried in checkout metadata, never in a
  URL or authorization token.
- Verified Dodo payments bind product, amount, currency, checkout, and report
  metadata before entitlement or equal Maestro credit. Live mode fails closed
  when the expected `$29` amount/product configuration is absent.
- Admaxxer Purchase is retried by payment ID until `admaxxerReportedAt` is
  durable; provider failure does not create a second purchase or credit.
- A controlled live `$1 USD` Build Pack mapping is supported through the canary
  environment bindings; it is not provisioned or charged yet.

## Fresh focused verification

Current-main reproof on 2026-08-02:

- Functional and accessibility Playwright: 26/26 passed across desktop and
  mobile Chromium on the long-lived reviewed server at `127.0.0.1:4177`.
- Visual Playwright: 2/2 passed across desktop and mobile Chromium with the
  progress snapshot using the same dynamic masks as the stable capture path.
- Web funnel, lifecycle, consent, analytics, support, and recovery tests:
  201/201 passed.
- Evaluator commerce, support, event-schema, cost-policy, report, Build Pack,
  and mapping tests: 66/66 passed.
- Convex focused capability evidence includes 13/13 Build Pack pipeline tests,
  10/10 data-lifecycle tests, 4/4 app-idea funnel capability tests, and 2/2
  commerce capability tests.
- PR #16 is merged at `4aa0b268a96a2c748018f39fb4e19679923b7c43`; the required
  GitHub quality check passed. Qlty Cloud remained optional and was not
  branch-required.

- Functional Playwright: 18/18 passed across desktop and mobile Chromium,
  including append-only revision, delayed-webhook recovery, post-refund
  generation denial, checkpoint retry, and low-fit Maestro suppression.
- Accessibility Playwright: 8/8 passed across desktop and mobile Chromium.
- Visual Playwright: 2/2 eight-surface journeys passed at the existing
  tolerance.
- Lifecycle: 15/15 Build Pack/commerce tests and 14/14 support/recovery UI tests
  passed.
- Analytics: evaluator, provider, consent, transition dedupe, and replay
  suppression suites passed; evaluator, Convex, and web typechecks passed.
- Repository coverage ratchet passed with 1,004 tests: 78.03% lines, 84.50%
  functions, 80.24% branches, and 78.03% statements.
- Static/contract gates passed: route tree, frontend Effect boundary,
  environment boundary, provider boundary, logging boundary, Confect contracts,
  workflow graph boundary, schema migration notes, PostHog readiness, web static
  smoke, and secret canaries.
- `host-test-slot --class full pnpm verify` passed on 2026-08-01, including
  format, lint, repository typecheck, strict Effect diagnostics, package/tooling
  tests, production build, coverage/type-coverage ratchets, generated-file
  drift, generator shape checks, Confect contracts/manifest, dependency
  boundaries, secret scanning, PostHog readiness, auth bypass, and Qlty.

## Unresolved launch gates

1. `template:workflow-output-smoke` reached Convex ref generation and stopped
   because `CONVEX_DEPLOYMENT` is not configured in this worktree. Run it in the
   configured Convex environment; do not weaken or fake the connection.
2. The authorized Woodpecker release path is pending repository activation.
   Bitwarden does not yet contain all required `TEMPLATE_STAGING_*` and
   `TEMPLATE_PRODUCTION_*` Cloudflare, Convex, and hosted-URL bindings. Generic
   credentials are intentionally not substituted for environment-isolated
   release authority.
3. Cloudflare Pages still serves its 2026-07-02 deployment, which predates the
   funnel merge. Production and staging live-page verification therefore remain
   pending until the authorized release bindings are provisioned.
4. Live Dodo `$1` Build Pack canary, refund/revocation, Admaxxer Purchase, and
   Meta CAPI evidence require owner-approved card entry and provider access.
5. Read-only Pages secret listing for `maestro-template-saas-ui` production
   returned no configured secrets; the isolated `TEMPLATE_PRODUCTION_*` bindings
   must be provisioned through the authorized Woodpecker path.

The implementation, focused journeys, and required GitHub quality gate are
verified. Production launch verification still requires the configured Convex
workflow output smoke and an authorized staging-to-production deployment.
