# Woodpecker Template Deployment Design

Date: 2026-08-02

Status: approved for implementation planning

## Summary

Migrate `maestro-template-saas-ui` from its obsolete Buildkite release surface
to the Woodpecker control plane already used by Maestro. Woodpecker becomes the
only repository CI and deployment orchestrator. Bitwarden Secrets Manager
remains the durable operator source for credentials used by local workers, and
the Woodpecker repository secret store receives the minimum values needed by
hosted deployment jobs.

The migration must preserve the existing guarded release behavior: pull-request
verification is secretless until trusted policy passes, staging and production
use distinct Convex identities and deploy keys, provider actions require
external promotion authority, staging produces an immutable receipt, and
production can promote only the exact accepted staged commit.

## Goals

- Activate `modernagencysales/maestro-template-saas-ui` in Woodpecker.
- Run deterministic pull-request verification through Woodpecker.
- Deploy the backend before the frontend for both environments.
- Prove staging with backend, static, browser, accessibility, and visual
  canaries before production becomes eligible.
- Require an explicit production deployment event for the accepted staging SHA.
- Store durable provider bindings in Bitwarden and scoped runtime copies in
  Woodpecker without exposing their values in source, logs, receipts, or chat.
- Remove Buildkite as an active or documented release authority.
- Deploy the already-merged app-idea funnel and verify its live public pages.

## Non-Goals

- Rework the app-idea funnel product or add new funnel features.
- Replace Cloudflare Pages, Convex, GitHub, or Bitwarden.
- Introduce a second CI system or retain Buildkite as a fallback.
- Put the promotion-authority private signing key in the application repository,
  Bitwarden worker environment, Woodpecker, or deployment receipts.
- Share a Convex deployment or deploy key between staging and production.

## Architecture

### Repository pipelines

The repository will contain two native Woodpecker pipeline documents:

- `.woodpecker/verify.yml` handles non-draft pull requests and manual proof. A
  pinned Node image first runs trusted CI self-protection without deployment
  secrets. Deterministic verification runs only after that step succeeds.
- `.woodpecker/deploy.yml` handles Woodpecker `deployment` events whose target
  is exactly `staging` or `production`. Each target has a separate step and a
  separate environment-secret mapping.

The pipeline structure follows the active Maestro Woodpecker conventions: pinned
container digests, explicit Linux/AMD64 CI labels, bounded clone history,
`failure: cancel`, and exact event conditions.

### Neutral CI scripts

Active scripts move from `.buildkite/scripts` to `tooling/ci`. Script names and
interfaces describe their behavior rather than a vendor. The Woodpecker YAML is
thin: it maps Woodpecker variables and secrets into the existing release
contract, then invokes the neutral scripts.

The migration updates every test, release policy, quality definition, and
runbook that currently treats `.buildkite` as authoritative. No active quality
gate may parse or require the removed Buildkite pipeline.

### Environment identities

Production currently has a deploy key whose public prefix targets
`prod:exciting-cat-536`. Implementation will validate its authenticated Convex
team/project ownership and corresponding credential-free HTTPS origin before
adopting it as production.

Staging must be a separate Convex deployment with a different identity, URL, and
deploy key. If an appropriate isolated deployment already exists, it is adopted
after validation. Otherwise, the authenticated Convex account creates one.
`project.config.json` records expected public identities while actual
coordinates remain externally bound.

Cloudflare continues to use two existing Pages projects:

- staging: `maestro-template-staging`, branch `staging`;
- production: `maestro-template`, branch `main`.

### Credential ownership

Bitwarden is the durable source available to future headless workers. It holds
the twelve environment-specific bindings already defined by the environment
manifest: three public/server coordinates and three provider credentials per
environment.

Woodpecker receives repository-scoped copies under lower-case secret names that
are mapped explicitly to the uppercase application variables. Secrets are
limited to deployment events. Pull-request verification does not receive
provider deployment credentials.

The existing `WOODPECKER_API_TOKEN` in Bitwarden authorizes repository
activation, secret administration, pipeline launch, and monitoring at
`https://ci.maestrogtm.com`. Secret values are passed directly from the
Bitwarden-loaded environment to the Woodpecker CLI and are never printed.

## Release Flow

1. A pull request runs trusted self-protection and deterministic verification.
2. The reviewed migration merges into `main`.
3. A Woodpecker staging deployment event targets the exact `main` commit.
4. Staging validates promotion authority and Convex identity, deploys Convex,
   seeds the fixed demo workspace, and passes backend liveness.
5. The frontend builds against the exact staging Convex URL, deploys to the
   staging Pages project, and passes static, HTTP, functional browser,
   accessibility, and visual canaries.
6. The job records and preserves an immutable staging receipt containing only
   public coordinates and hashes.
7. Production is launched as a distinct Woodpecker deployment event for the
   exact staged SHA. The operator action is the approval boundary.
8. Production independently validates its authority and provider identities,
   deploys backend then frontend, runs the same canaries, and writes a
   production receipt.
9. Live funnel routes are verified against both hosted origins.

## Failure Handling

- Missing or malformed bindings fail before provider transport.
- Cross-swapped, shared, or mismatched Convex identities fail before deploy.
- Missing or rejected promotion authority fails closed.
- A failed staging canary prevents a production event from being launched.
- A production failure preserves the last known-good deployment and its receipt;
  it does not trigger an unreviewed raw provider rollback.
- Provider `402`, `429`, and usage-limit responses remain environmental failures
  and do not cause product-code mutation.
- Woodpecker orchestration cancellation is distinguished from a concrete failing
  command before repair work begins.

## Testing

Implementation follows TDD for the repository contracts:

- pipeline contract tests fail while Buildkite remains authoritative and pass
  only when both Woodpecker pipelines have the required event, dependency,
  image, label, and secret boundaries;
- deployment-authority tests consume the neutral script paths and reject secret
  leakage into preflight steps;
- environment and release-policy tests prove distinct public coordinates and
  secret mappings;
- stale-reference tests reject active Buildkite release references;
- `woodpecker-cli lint` validates both pipeline documents;
- focused release, quality, project-config, and secret-canary suites run through
  `host-test-slot`;
- hosted staging and production journeys provide final functional,
  accessibility, and visual evidence.

Broad local verification remains subject to the shared full-test semaphore.
Manual Woodpecker deployment proof begins only after the migration PR is merged
and repository secrets are provisioned.

## Acceptance Criteria

- The repository has no active Buildkite pipeline or Buildkite-specific deploy
  script path.
- Woodpecker recognizes and lints verification and deployment pipelines.
- The template repository is active in Woodpecker and required repository
  secrets exist without their values appearing in logs.
- Bitwarden contains all twelve environment-specific bindings for future
  workers.
- Convex staging and production identities are valid and distinct.
- Pull-request verification passes without deployment credentials.
- Staging deploys the merged funnel and all hosted canaries pass.
- Production promotes the exact staged commit and all hosted canaries pass.
- `https://maestro-template-staging.pages.dev` and
  `https://maestro-template.pages.dev` render the app-idea funnel rather than
  the July 2 dashboard deployment.
- The operations and launch audits name Woodpecker, not Buildkite, as the active
  release control plane.
