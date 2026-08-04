# Product Contracts

## Decision

Introduce `product-contracts` as the shared primitive that compiles and verifies
executable product contracts, gates public-surface activation, and correlates
trusted scenario observations with independently reported runtime identity.
Existing product systems own the behavior under test; Workflow Runtime and
Deployment Authority own durable product workflows and releases, not disposable
acceptance execution.

Canonical entrypoints are `tooling/acceptance`, `features/support`, and
`packages/convex/confect/runtime`. The current implementation is real and owns
only the `contractEvidence` table.

## Contract Evidence Lifecycle

`contractEvidence` contains restricted, acceptance-only identity and behavioral
correlation data. It exists only in the disposable acceptance backend, is
drained atomically after each scenario, is never exported, and is unavailable in
production. The table is mutable because draining deletes verified rows.
