# App idea funnel launch audit

Audit date: 2026-08-01

## Proven product requirements

| Area                                  | Authoritative evidence                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product language and free value       | Approved language bank; landing/report component tests; the desktop/mobile functional and visual Playwright journeys.                                                                                                       |
| Free model economics                  | Evaluator model-policy tests; integration gateway/spend tests; server-only environment/provider boundary gates; persisted receipt and global UTC-day spend tests.                                                           |
| Ownership and persistence             | Evaluator state and report-revision capability tests; claim/share/delete Confect tests; desktop/mobile email claim, share revocation, and deletion browser journeys.                                                        |
| Commerce                              | Dodo raw-body signature tests; checkout and webhook capability tests; delayed-return UI tests; refund/dispute entitlement and credit revocation tests.                                                                      |
| Complete Build Pack                   | Thirteen pipeline tests cover entitlement, eight checkpoint leases, retry, support resume, refund between stages, citations, and receipts. Viewer/export tests prove canonical section parity and visible research sources. |
| Maestro handoff                       | Evaluator mapping, generator catalog, server-owned offer, credit, and low/planned-fit UI tests.                                                                                                                             |
| Analytics and privacy                 | Strict discriminated event schemas; consent-provider tests; transition deduplication; fresh-versus-replay evaluation telemetry tests; secret scan and PostHog readiness gate.                                               |
| Accessibility and responsive behavior | `app-idea-funnel.accessibility.spec.ts`: 8 passing tests across desktop/mobile, including core and auxiliary public routes, axe, keyboard/focus/error behavior, 320px reflow, and 200% text sizing.                         |
| Visual evidence                       | `app-idea-funnel.visual.spec.ts`: canonical desktop/mobile snapshots for landing, intake, report, library, checkout, progress, Build Pack, and Maestro.                                                                     |
| Operations                            | `app-idea-funnel-operations.md`, durable support incidents, specific operator-reason validation, entitlement recheck, checkpoint-preserving resume, and public support IDs.                                                 |

## Fresh focused verification

- Functional Playwright: 12/12 passed across desktop and mobile Chromium,
  including delayed-webhook recovery and post-refund generation denial.
- Accessibility Playwright: 8/8 passed across desktop and mobile Chromium.
- Visual Playwright: 2/2 eight-surface journeys passed at the existing
  tolerance.
- Lifecycle: 15/15 Build Pack/commerce tests and 14/14 support/recovery UI tests
  passed.
- Analytics: evaluator, provider, consent, transition dedupe, and replay
  suppression suites passed; evaluator, Convex, and web typechecks passed.
- Static/contract gates passed: route tree, frontend Effect boundary,
  environment boundary, provider boundary, logging boundary, Confect contracts,
  workflow graph boundary, schema migration notes, PostHog readiness, web static
  smoke, and secret canaries.

## Unresolved launch gates

1. `template:workflow-output-smoke` reached Convex ref generation and stopped
   because `CONVEX_DEPLOYMENT` is not configured in this worktree. Run it in the
   configured Convex environment; do not weaken or fake the connection.
2. Generator-connected Convex checks remain configured-environment evidence.
3. Repository-wide format, lint, typecheck, build, and the full
   `host-test-slot --class full pnpm verify` gate remain intentionally paused
   pending Brain/#3638 clearance.
4. Manual Woodpecker proof remains intentionally paused pending the same
   clearance.

The funnel is not launch-verified until all four gate entries in the checklist
are checked with current authoritative output.
