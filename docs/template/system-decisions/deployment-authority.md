# deployment-authority

Disposition: introduce Decision owner: Maestro template maintainers Status: real

## Distinct Lifecycle

Deployment Authority verifies whether an exact commit may perform an exact
deployment action against a named staging or production target. Its lifecycle
reads externally provisioned trusted issuers, signed approvals, complete
workflow census snapshots, and signed verdicts, then atomically consumes each
authorized action once. This is global/environment release-control state, not a
workspace feature or a workspace data-subject lifecycle.

## Existing Systems Considered

- `workflow-runtime`: supplies immutable run and publication evidence to the
  census, but must not authorize deployment of the runtime that produced it.
- `action-automation`: owns workspace-facing external-action jobs and human
  approvals; deployment approval is environment operator authority across
  workspaces and has a separate signed trust and consumption lifecycle.
- `policy-and-prompts`: owns workspace-scoped policy/configuration. It may
  express rollout policy but cannot mint or consume release authority.
- `data-lifecycle`: classifies this state and records its lifecycle posture; it
  does not own release decisions or include global authority state in DSARs.

## Authority And Persistence

- Canonical entrypoints:
  - `packages/convex/confect/deploy/authority.spec.ts`
  - `packages/convex/confect/deployAuthority/admin.ts`
  - `packages/convex/confect/deployAuthority/http.ts`
  - `packages/convex/confect/deployAuthority/store.ts`
- Implemented responsibilities: bind signed approvals, verdicts, and complete
  census evidence to an exact environment, target, and commit; verify configured
  trusted issuers; issue short-lived authorization; consume each action exactly
  once.
- Six tables: `deployAuthorityIssuers`, `deployAuthorityAuditEvents`,
  `deployApprovals`, `deployCensusSnapshots`, `deployVerdicts`, and
  `deployActionConsumptions`.
- The HTTP endpoint and release CLI are projections of this authority. Workflow
  Runtime is a read-only evidence dependency, not a second authority.
- The authority control plane must already be live before either deployment
  pipeline runs. `PROMOTION_AUTHORITY_ENDPOINT` names only its independent HTTPS
  origin and must not resolve to the target environment's Convex origin.
- Preflight is consumed exactly once by the secretless pipeline step. The
  credentialed deploy scripts do not consume a second preflight; each guarded
  Convex and Cloudflare action still consumes its own exact-scope authorization.
- The Ed25519 signing key is authority-side only. The typed Convex environment
  declares `PROMOTION_AUTHORITY_MODE` and
  `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL`; readiness and consumption
  prove that the private key matches the one active issuer before any one-time
  action mutation. Woodpecker receives only the public verification key and
  externally pinned trust-root hash, never the private key.

## Migration And Preservation

This introduces canonical ownership without rewriting existing records.
Authenticated issuer, approval, census, and verdict provisioning authorities are
implemented behind explicit authority mode and operator claims. Provisioning,
rotation, retirement, and audit writes are append-only; a transition is refused
before the issuer history would cross its permanent bound. Audit export uses a
total-order timestamp-and-event cursor so equal-timestamp evidence is lossless.
Preserve exact scope binding, runtime-key/active-issuer proof, signature/hash
verification, fail-closed census validation, expiry checks, append-only
evidence, and one-time action consumption. Existing records remain global and
excluded from workspace export/delete plans. The application deployment may not
self-bootstrap its own authority, compute or replace the external trusted root,
fall back to the target Convex deployment, or bypass an unavailable authority.
Missing independent control-plane readiness is a deployment refusal, not a
recoverable setup path inside the deploy job.

## Terminal Condition

The real system is correctly bounded when all six tables have one catalog owner
and lifecycle contract, authenticated provisioning remains origin-bound, the
HTTP authority validates its typed runtime key against the active issuer before
consumption, audit pagination is lossless, the issuer ceiling cannot be crossed,
and promotion-boundary tests pass. Product topology continues to treat Workflow
Runtime as read-only evidence, never a second deployment authority.
