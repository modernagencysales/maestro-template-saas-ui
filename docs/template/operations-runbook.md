# Operations Runbook

## Deploy

1. Run deterministic verification.
2. Review [env-manifest.md](./env-manifest.md) for required provider names,
   fake-mode behavior, and rotation posture.
3. Confirm the independent deployment-authority control plane is already live.
   Set its HTTPS base origin as `PROMOTION_AUTHORITY_ENDPOINT` and supply the
   externally reviewed `TRUSTED_DEPLOY_ROOT_SHA256`. The endpoint must not be
   the target Convex origin and neither value may be bootstrapped by this run.
4. Run provider fake smokes.
5. Run `pnpm build` and `pnpm smoke:web-static`.
6. Deploy staging from the exact commit. The pipeline consumes one secretless
   preflight, then the guarded Convex and Cloudflare routes independently
   authorize their provider action.
7. Run `pnpm smoke:hosted` or the provider-specific deploy smoke.
8. Promote production through the human approval block with the same
   independent-control-plane requirements.

If the authority endpoint or trusted root is unavailable, mismatched, unsafe, or
points at the target Convex origin, stop. Do not inject the authority signing
key into Buildkite, compute a replacement trust root inside CI, self-deploy the
authority from the application pipeline, or invoke raw provider deploy commands.

## CI And AI Gate Verdicts

Use [verification-receipts.md](./verification-receipts.md) when consuming or
archiving Maestro gate evidence. It defines required versus advisory posture,
evidence strength, unavailable states, and receipt staleness; the underlying
gate commands remain authoritative.

Deterministic gates are authoritative and run before AI gates. AI gates are
additional review signals and must fail closed when provider auth, parseable
JSON/text verdicts, or Buildkite metadata are missing.

Local fake-mode checks:

```bash
.buildkite/scripts/taste.sh --mode fake
.buildkite/scripts/contract-review.sh --mode fake
pnpm check:pr-health -- --mode fake
pnpm check:unresolved-review-threads -- --mode fake
pnpm check:merge-conflicts -- --mode fake
```

Buildkite verdict retrieval:

```bash
buildkite-agent meta-data get staged-sha
buildkite-agent artifact download "*taste*" .
buildkite-agent artifact download "*contract-review*" .
```

If Buildkite artifacts are unavailable, read the step logs for `taste`,
`contract-review`, `check:pr-health`, `check:unresolved-review-threads`, and
`check:merge-conflicts`. The AI gates are valid only when their output contains
a parseable pass verdict accepted by `tooling/quality/extract-ai-verdict.mts`;
missing verdicts are failures.

## Main Branch Promotion Policy

`main` is PR-only: block deletion and force pushes, require resolved
conversations, and require the GitHub `Required quality / quality` status. Add
Buildkite contexts only after they are observed on a pull request; never invent
a required context name, because that can deadlock the branch.

Enable repository auto-merge. Ordinary product PRs may merge automatically when
the required status and conversations are green. Require code-owner review only
for paths listed in `.github/CODEOWNERS`: architecture catalogs, durable
schema/data contracts, security/access, generators/gates, CI, and deploy/release
control. Do not restore a wildcard owner, which would turn every exploratory
product change into a manual approval bottleneck.

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

1. Identify the last staged commit with passing deploy smoke.
2. Validate schema compatibility and generated contract diffs.
3. Run rollback validation.
4. Promote the rollback commit.
5. Record incident notes and follow-up tests.

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
