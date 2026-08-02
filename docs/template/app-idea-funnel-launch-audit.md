# App idea funnel launch audit

Audit date: 2026-08-01

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

## Fresh focused verification

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
2. Manual Woodpecker proof has not been run from this worktree. It is remote CI
   evidence, not a substitute for the configured Convex workflow smoke.

The implementation and local repository gates are verified. Production launch
verification still requires the configured Convex workflow output smoke and the
normal remote CI proof for the eventual PR.
