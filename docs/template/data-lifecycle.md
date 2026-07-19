# Data Lifecycle

The template ships a small, explicit lifecycle and DSAR planner rather than a
broad data deleter. It is intentionally conservative: it documents export,
retention, and delete posture for resources that exist in the template today,
builds fake-safe export/delete request plans, plans retention jobs as dry-runs,
and requires typed confirmation before destructive workspace delete work.

Authoritative implementation:

- `packages/convex/confect/ops/dataLifecycle.ts`
- `packages/convex/confect/ops/dataLifecycle.spec.ts`
- `packages/convex/confect/ops/dataLifecycle.impl.ts`
- `packages/convex/confect/tables/dsarRequests.ts`
- `apps/web/src/routes/_workspace.data-lifecycle.tsx`
- `apps/web/src/features/data-lifecycle/data-lifecycle-surface.tsx`
- `packages/convex/test/data-lifecycle.test.ts`
- `packages/convex/test/data-lifecycle-ops.test.ts`

Every schema addition that stores workspace-owned data must declare:

- owner module
- export posture
- delete posture
- retention rule

These fields must be documented before a resource is promoted from
generated/client-specific code into the template core.

Every hand-authored table must also have exactly one owner in
`docs/template/system-catalog.json`. `pnpm check:system-catalog` compares that
catalog to `packages/convex/confect/tables/*.ts`, so a new table cannot land as
an unowned parallel subsystem. Extend an existing system by default; a new
system requires a reviewed introduction decision.

## DSAR Request Planning

`buildWorkspaceDsarPlan` creates a plan-only request for workspace export or
delete:

- export requests produce an export manifest for every current lifecycle
  resource, including markdown, JSON, and redacted JSON modes.
- delete requests require the exact phrase `delete <workspaceId>` before they
  can reach `ready-for-review`.
- legal holds block delete plans even when the confirmation phrase is correct.
- delete entries are always `executable: false` in the template. A client fork
  must wire audited Confect mutations, approval checks, and legal signoff before
  executing deletion or redaction.

`ops.dataLifecycle.createDsarRequest` persists that same plan as a
tenant-guarded audit row in `dsarRequests`. The mutation verifies workspace
access, records the requesting user, stores export/delete plan metadata, and
remains dry-run only. `ops.dataLifecycle.listDsarRequests` lets authorized
workspace viewers review those audit rows without direct database access.
Together they are the review/audit handoff point before a client fork wires real
export bundle generation, redaction, deletion, or legal-hold workflows.

The `/data-lifecycle` web route consumes those generated refs when Convex is
configured and falls back to fake-safe dry-run rows otherwise. It is a request
review surface, not a fulfillment console: all rows remain `dryRunOnly`, and
delete/redaction execution stays an explicit client-fork promotion.

## Retention Job Planning

`buildRetentionJobPlan` turns retention rules into a dry-run job plan with an
audit window, next review timestamp, and per-resource actions. The template does
not schedule destructive retention cron work by default. Client forks should use
the dry-run plan as the review artifact before enabling scheduled deletion,
redaction, or legal-hold-aware retention execution.

## Current Resources

The planner covers these workspace-owned resources:

- `workspaces`
- `workspaceMembers`
- `brainPages`
- `workflowRuns`
- `workflowStageRuns`
- `workflowRunEvents`
- `workflowRunEvidenceSnapshots`
- `workflowRunContextManifests`
- `usageEvents`
- `creditLedger`
- `entitlements`
- `webhookEvents`
- `dsarRequests`
- `featureFlagPolicies`
- `notificationRecords`
- `notificationPreferences`
- `apiKeys`
- `invitations`
- `documents`
- `documentVersions`
- `documentAnnotations`
- `concepts`
- `claims`
- `citations`
- `contextPacks`
- `transformDefinitions`
- `transformRuns`
- `transformBlocks`
- `actionJobs`
- `actionApprovals`
- `actionTriggers`
- `actionDigests`
- `versionedEntries`
- `versionFreshness`

## Export Posture

Brain pages and co-editing documents export as markdown with JSON metadata.
Knowledge concepts, claims, citations, and context packs export as JSON and may
also be projected into Open Knowledge Format. Document versions and annotations
export as JSON so reviewer comments, agent suggestions, and version provenance
remain inspectable. Generic versioned entries and freshness markers export as
JSON so any workspace-owned entity can be audited without mutating history.
Transform definitions, runs, and blocks export as JSON so input hashes, output
hashes, source IDs, policy snapshots, model receipts, and Trust Receipt
projection remain reviewable. Action jobs and trigger config export as JSON so
external-write intent, approval posture, scheduler config, and idempotency keys
remain inspectable. Action approvals and digests export as redacted JSON:
approval links expose token hashes only, and digest exports never include raw
customer or provider metadata. Entitlements and feature flag policies export as
JSON so seat, credit, feature limit, rollout, and kill-switch posture remain
auditable. Webhook events export as redacted JSON: provider, event ID, signature
timestamp, and dedupe state are retained without raw provider payloads. DSAR
request rows export as redacted JSON so fulfillment review state is auditable
without exposing unnecessary subject metadata. Notification records export as
redacted JSON so recipient/action metadata stays bounded while delivery audit
state remains reviewable. Notification preferences export as JSON because they
are workspace-member channel settings. Operational, workflow, usage, and ledger
records export as JSON. Sensitive identity, invitation, and API key resources
export as redacted JSON.

## Delete Posture

Customer content can be deleted with the workspace. Co-editing documents and
annotations follow workspace delete, while append-only document versions may be
retained for a configured audit window when a client enables legal, compliance,
or approval workflows. Concepts, claims, citations, and context packs follow
workspace delete by default because they are structured overlays on customer
Brain content. Generic versioned entries are retained as audit provenance;
version freshness rows delete with the workspace entity because they are mutable
operational state. Transform definitions delete with the workspace, while
transform runs and blocks are retained for the audit window because they explain
generated outputs. Action jobs, approvals, and digest deliveries are retained
for the audit window because they explain external side effects and reviewer
decisions; action triggers delete with workspace automation settings. DSAR
request rows retain fulfillment review posture. Feature flag policies and
notification preferences delete with workspace configuration. Notification
records retain redacted delivery audit state. Audit, workflow, usage, and
financial ledger records are retained as audit anchors. API keys and invitations
are redacted or revoked rather than exposing secret material. Entitlements and
payment webhook events are retained for billing, seat, and support
reconciliation.

## Retention Rules

The implemented retention hooks are:

- Brain pages: retain until workspace delete.
- Documents: retain until workspace delete.
- Document versions: append-only; retain until workspace delete by default, or
  for the configured audit window when approval/compliance mode is enabled.
- Document annotations: retain until the target document is deleted.
- Concepts: retain until workspace delete.
- Claims: retain until workspace delete.
- Citations: retain until the claim/source is deleted.
- Context packs: retain until workspace delete; regenerate from cited sources
  when freshness expires.
- Transform definitions: retain until workspace delete.
- Transform runs: retain for the audit window.
- Transform blocks: retain for the audit window.
- Action jobs: retain for the audit window.
- Action approvals: hash or redact review token material on export.
- Action triggers: retain until workspace delete.
- Action digests: redact customer and provider metadata on export.
- Entitlements: retain for the audit window.
- Webhook events: hash or redact provider payloads on export.
- DSAR requests: retain for the audit window.
- Feature flag policies: retain until workspace delete.
- Notification records: hash or redact recipient/action metadata on export.
- Notification preferences: retain until workspace delete.
- Versioned entries: append-only; retain for the audit window.
- Version freshness: retain until workspace delete.
- API keys: hash or redact on export.
- Workflow runs: retain for the audit window.
- Credit ledger: retain for reconciliation.

Future client forks may add resources, but they must update this planner, DSAR
plans, retention job expectations, and tests in the same change.
