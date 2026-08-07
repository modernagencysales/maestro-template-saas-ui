# Operations Runbook

## Deploy

1. Run deterministic verification.
2. Review [env-manifest.md](./env-manifest.md) for required provider names,
   fake-mode behavior, and rotation posture.
3. Confirm the independent deployment-authority control plane is already live.
   Its typed `packages/convex/convex/convex.config.ts` environment declaration
   must require `PROMOTION_AUTHORITY_MODE=authority` exactly and declare
   `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL` only for that independent
   authority runtime. The environment manifest and this runbook are the other
   two required copies of that contract. Never add the private key to
   Woodpecker, the application staging/production environments, receipts, logs,
   or provider coordinates. Set its HTTPS base origin as
   `PROMOTION_AUTHORITY_ENDPOINT` and supply the externally reviewed
   `TRUSTED_DEPLOY_ROOT_SHA256`. The endpoint must not be the target Convex
   origin and neither value may be bootstrapped by this run. Provision
   `TRUSTED_CI_SELF_PROTECTION_COMMIT` as an exact immutable commit; Woodpecker
   executes that commit's setup, deploy-authority verifier, and secretless
   self-protection script instead of their mutable-checkout copies. A missing,
   symbolic, unavailable, or mismatched trusted commit is a terminal failure
   before credentialed jobs. Confirm Woodpecker also has distinct
   `TEMPLATE_STAGING_CONVEX_*` and `TEMPLATE_PRODUCTION_CONVEX_*` bindings. Run
   `node scripts/_project-config.mjs assert-isolated-convex`; missing bindings,
   shared deployment identities, cross-swapped environment identities, an
   internally mismatched deployment/URL pair, or a `.convex.cloud`/
   `.convex.site` alias are terminal failures. After scoped credentials arrive,
   `assert-convex-deploy-key <environment>` verifies only the key's public
   deployment prefix without logging or serializing the key. Deploy doctor is an
   additional presence/configuration check, not a substitute for this identity
   check.
4. Run provider fake smokes.
5. Run `pnpm build` and `pnpm smoke:web-static`.
6. Deploy staging from the exact commit. The pipeline consumes one secretless
   preflight, then the guarded Convex and Cloudflare routes independently
   authorize their provider action. The deploy scripts overwrite any inherited
   `VITE_CONVEX_URL` with the exact selected environment binding before building
   the hosted application.
7. Require the backend liveness canary after Convex deployment. After Pages
   deployment, require `pnpm smoke:hosted`, `pnpm smoke:hosted:browser`,
   `pnpm smoke:hosted:a11y`, and `pnpm smoke:hosted:visual`. Upload the guarded
   deployment receipt only after all five canaries pass and before staging
   records `staged-sha` or production completes.
8. Promote production through the human approval block with the same
   independent-control-plane requirements.

If the authority endpoint or trusted root is unavailable, mismatched, unsafe, or
points at the target Convex origin, stop. Do not inject the authority signing
key into Woodpecker, compute a replacement trust root inside CI, self-deploy the
authority from the application pipeline, or invoke raw provider deploy commands.

## CI And AI Gate Verdicts

Use [verification-receipts.md](./verification-receipts.md) when consuming or
archiving Maestro gate evidence. It defines required versus advisory posture,
evidence strength, unavailable states, and receipt staleness; the underlying
gate commands remain authoritative.

Deterministic gates are authoritative in the required Woodpecker verification
pipeline. The PR firewall runs bounded AI review: it freezes the first blocking
set, permits at most two repair rounds, and escalates remaining findings. When
invoked, they are additional review signals and must fail closed when provider
auth or a parseable JSON/text verdict is missing.

Local fake-mode checks:

```bash
tooling/ci/taste.sh --mode fake
tooling/ci/contract-review.sh --mode fake
pnpm check:pr-health -- --mode fake
pnpm check:unresolved-review-threads -- --mode fake
pnpm check:merge-conflicts -- --mode fake
```

For a manual AI review, retain the command output with the review evidence. The
AI gates are valid only when their output contains a parseable pass verdict
accepted by `tooling/quality/extract-ai-verdict.mts`; missing verdicts are
failures.

Woodpecker deterministic log retrieval:

```bash
woodpecker-cli pipeline ps modernagencysales/maestro-template-saas-ui <pipeline-number>
woodpecker-cli pipeline log show modernagencysales/maestro-template-saas-ui <pipeline-number> <step-number>
```

The required pipeline exposes `trusted-ci-policy` and `verify` logs. It does not
currently run `taste` or `contract-review`; retain those commands' direct output
when they are invoked manually.

## Main Branch Promotion Policy

`main` is PR-only: block deletion and force pushes, require GitHub's native
resolved-conversation policy, and require only the observed
`ci/woodpecker/pr/verify` context. Qlty, unresolved-review-thread reporting,
merge-conflict reporting, AI, and firewall signals remain visible advisory
evidence; they are not merge requirements. Never invent a required context name,
because that can deadlock the branch.

Enable repository auto-merge. Ordinary product PRs may merge automatically when
Woodpecker verification passes and GitHub's resolved-conversation policy is
satisfied. Require code-owner review only for paths listed in
`.github/CODEOWNERS`: architecture catalogs, durable schema/data contracts,
security/access, generators/gates, CI, and deploy/release control. Do not
restore a wildcard owner, which would turn every exploratory product change into
a manual approval bottleneck.

When changing the required workflow or rule, first push the workflow on a PR,
observe the exact check context with `gh pr checks`, and only then update the
ruleset. Confirm afterward with `gh api repos/{owner}/{repo}/rulesets` and a
green test PR.

GitHub review state:

```bash
gh pr checks --watch
gh pr view --json reviewDecision,mergeStateStatus,statusCheckRollup
gh pr view --json reviews,latestReviews
```

Fix deterministic failures first. Then use AI verdict text as review guidance:
turn each concrete concern into a code change, doc change, or explicit rejected
assumption in the PR notes. Do not mark AI gates as passed from memory or from
an unparseable model response.

## Rollback

No blocked or pre-closure commit is a rollback seed. Freeze deployment, create
the first immutable reviewed successor containing the complete guarded path,
then provision that exact SHA externally as `TRUSTED_ROLLBACK_SEED_COMMIT`. Its
first protected production deployment is seed-only: record accurate live
provider coordinates and the guarded receipt, but keep automated rollback
unavailable until a later receipt names the seed (or a descendant) as its prior
release. The rollback entrypoint validates the seed and target as exact 40/64
hex SHAs, confirms the seed commit exists, and requires
`git merge-base --is-ancestor "$TRUSTED_ROLLBACK_SEED_COMMIT" "$CI_COMMIT_SHA"`.
If any check fails, freeze deployment and require a separately reviewed recovery
plan; never copy or execute the new entrypoint against a pre-seed checkout.

1. Download the immutable guarded deployment receipt for the release being
   rolled back. It must contain the current and prior Convex commit/deployment,
   Cloudflare project/branch/version, hosted URL, and Woodpecker pipeline
   number.
2. Check out the receipt's `previousConvexCommitSha`; obtain fresh deployment
   authority for that exact commit and set `RUN_ROLLBACK=true` only after the
   production approval block.
3. Bind `ROLLBACK_RECEIPT_PATH`, `ROLLBACK_RECEIPT_BUILD_ID`,
   `ROLLBACK_CLOUDFLARE_DEPLOYMENT_VERSION`, and the `PRODUCTION_PREVIOUS_*`
   coordinates to the reviewed release being replaced. The rollback entrypoint
   compares every public receipt coordinate: environment, source build ID,
   checked-out target commit/deployment, release-being-replaced commit and
   deployment, Cloudflare project/branch/current/prior versions, and hosted URL.
   Any alteration fails before provider action. Public receipt fields reject
   secret-, token-, credential-, authorization-, and deploy-key-shaped strings;
   deploy keys and other credential values are never serialized.
4. Run `tooling/ci/rollback-promote.sh`. It verifies the receipt before provider
   commands, routes both providers through `guardedDeploy.ts`, runs the backend
   and hosted canaries, and emits a new append-only rollback receipt.
5. If any coordinate, authority binding, canary, or receipt is unavailable,
   freeze deployment. Do not invoke raw Convex or Cloudflare commands.

## Provider Outage

1. Enable the relevant kill switch or fake fallback.
2. Confirm user-facing typed failure states.
3. Audit queued jobs and retries.
4. Reconcile provider state after recovery.
5. Emit an outbound alert through `packages/notifications` with a stable
   `dedupeKey`; alert payload metadata is redacted before it reaches sinks.
   Deploy doctor and production promotion failures already include a redacted
   alert plan in their JSON report; forks can route that plan into their chosen
   Slack/webhook sink.

## Incident

1. Classify severity.
2. Freeze risky deploys.
3. Preserve logs without exposing secrets.
4. Notify affected operators.
5. Write the remediation and regression-test plan.

## Support Access

Support access requires role authority, reason, scoped resource, audit event,
and expiry.

## Billing Reconciliation

Reconcile provider ledger events, local credit ledger, webhook idempotency, and
manual adjustments.

## Data Export And Delete

Use `packages/convex/confect/ops/dataLifecycle.ts` and
[data-lifecycle.md](./data-lifecycle.md). Do not manually query or delete
customer data outside audited flows.

The current lifecycle planner covers the workspace-owned resource inventory in
[data-lifecycle.md](./data-lifecycle.md), including DSAR request audit rows,
feature flag policies, notification records, and notification preferences.
Deletion requires the typed confirmation phrase generated by the planner, and
template DSAR requests remain dry-run audit records until a client fork wires
legal-approved export bundle or deletion execution.

## Health

The liveness contract lives in `packages/convex/confect/ops/health.spec.ts`,
with implementation in `packages/convex/confect/ops/health.impl.ts`. It reports
runtime, Confect registration, provider posture, environment, commit SHA, and
check timestamp. Fake mode is expected to pass without live provider secrets;
test/live modes should be paired with deploy doctor evidence.

The `/health` web route renders the fake-safe operator health board for local
and hosted review. It combines runtime health checks with provider readiness
metadata from `@maestro-template/integrations` and shows only environment names
when live provider setup is missing or invalid.

## Backup And Restore

Run restore drills in fake or staging mode before production reliance.
