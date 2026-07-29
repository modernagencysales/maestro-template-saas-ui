# deployment-authority

Disposition: introduce Decision owner: Maestro template maintainers Status:
approved

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
  - `packages/convex/confect/deployAuthority/http.ts`
  - `packages/convex/confect/deployAuthority/store.ts`
- Implemented responsibilities: bind signed approvals, verdicts, and complete
  census evidence to an exact environment, target, and commit; verify configured
  trusted issuers; issue short-lived authorization; consume each action exactly
  once.
- Tables: `deployAuthorityIssuers`, `deployApprovals`, `deployCensusSnapshots`,
  `deployVerdicts`, and `deployActionConsumptions`.
- The HTTP endpoint and release CLI are projections of this authority. Workflow
  Runtime is a read-only evidence dependency, not a second authority.
- The authority control plane must already be live before either deployment
  pipeline runs. `PROMOTION_AUTHORITY_ENDPOINT` names only its independent HTTPS
  origin and must not resolve to the target environment's Convex origin.
- Preflight is consumed exactly once by the secretless pipeline step. The
  credentialed deploy scripts do not consume a second preflight; each guarded
  Convex and Cloudflare action still consumes its own exact-scope authorization.
- The Ed25519 signing key is authority-side only. Buildkite and this repository
  receive the public verification key and externally pinned trust-root hash,
  never `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL`.

## Migration And Preservation

This introduces canonical ownership for the mixed implementation; it does not
replace storage or rewrite records. Issuer, approval, census, and verdict
provisioning are external and unavailable in the shipped template. Adding those
writes requires a separately reviewed operator authority and migration. The only
implemented table write is append-only deployment-action consumption. Preserve
exact scope binding, signature/hash verification, fail-closed census validation,
expiry checks, append-only signed evidence, and one-time action consumption.
Existing records remain global and excluded from workspace export/delete plans.
The application deployment may not self-bootstrap its own authority, compute or
replace the external trusted root, fall back to the target Convex deployment, or
bypass an unavailable authority. Missing independent control-plane readiness is
a deployment refusal, not a recoverable setup path inside the deploy job.

## Terminal Condition

The mixed system is correctly bounded when all five tables have one catalog
owner and lifecycle contract, unavailable provisioning is explicit, the HTTP
authority endpoint uses the canonical durable store for verification and
consumption, the promotion boundary tests pass, and product topology records the
headless authority as a Workflow Runtime evidence consumer. It becomes `real`
only after reviewed issuer, approval, census, and verdict provisioning
authorities ship with migration and lifecycle proof.
