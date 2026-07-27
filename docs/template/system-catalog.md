# Canonical System Catalog

This catalog answers one question before code exists:

> Which existing system owns this responsibility, and should this change reuse
> it, extend it, or explicitly introduce a new system?

The machine-readable source of truth is
[`system-catalog.json`](./system-catalog.json). It owns every hand-authored
Confect table exactly once and points to the canonical implementation
entrypoints. [`product-topology.json`](./product-topology.json) maps production
capabilities, workflows, agents, jobs, routes, headless gateways, and provider
seams to those systems. Run an exact lookup before planning or scaffolding:

```bash
pnpm template:systems
pnpm template:systems -- --query auth
pnpm template:systems -- --query workflowRuns
```

Aliases are reviewed navigation terms, not a semantic-duplication algorithm.
Exact lookup and schema ownership are deterministic. The PR contract reviewer
handles meaning-level questions such as whether “customer memory” is really a
second Knowledge Brain.

## Change Contract

Every product plan and generated backend slice records one disposition:

- `reuse`: call or project the canonical system without adding authority;
- `extend`: add a capability, workflow, table, or surface to the canonical
  owner;
- `introduce`: create a genuinely new lifecycle only after a reviewed system
  decision adds it to `system-catalog.json`;
- `replace` or `retire`: use an explicit migration and feature-preservation
  plan; never build the replacement in parallel and switch casually.

Generators accept canonical IDs only through `--system` and require
`--disposition reuse|extend`. If no current system fits, write a decision under
`docs/template/system-decisions/`, add the approved system to the catalog, then
scaffold it with `extend`. A new table is incomplete until it is owned in the
catalog and its lifecycle posture is documented.

Do not make one table equal one system. Tables are persistence resources owned
by a product lifecycle or shared primitive. Actor-specific UI, API, CLI, MCP,
and agent wrappers are projections/delegates of the same owner, not new systems.

## Access And Tenancy

Canonical ID: `access-and-tenancy`. Reuse it for authentication, authorization,
organizations, workspaces, membership, invitations, API keys, and access audit
events.

## Knowledge Brain

Canonical ID: `knowledge-brain`. Reuse it for source-backed pages, knowledge,
concepts, claims, citations, retrieval, RAG, and context packs.

## Document Collaboration

Canonical ID: `document-collaboration`. Reuse it for editable documents,
versions, annotations, collaborative editing, and editor sync.

## Workflow Runtime

Canonical ID: `workflow-runtime`. Reuse it for durable orchestration, workflow
runs, stages, events, context/evidence snapshots, run links, retry, and control.

## Action Automation

Canonical ID: `action-automation`. Reuse it for queued external actions,
triggers, approvals, digests, and action idempotency.

## Billing And Entitlements

Canonical ID: `billing-and-entitlements`. Reuse it for plans, subscriptions,
entitlements, usage, quotas, credits, payments, and billing webhook receipts.

## Policy And Prompts

Canonical ID: `policy-and-prompts`. Reuse it for versioned policies, scoped
configuration, prompts, feature flags, rollout, and kill switches.

## Notifications

Canonical ID: `notifications`. Reuse it for notification records, recipient
preferences, delivery state, inbox/read state, email, and alerts.

## Transforms

Canonical ID: `transforms`. Reuse it for transform definitions, executions,
block lineage, processing hashes, and transform evidence.

## Generic Versioning

Canonical ID: `generic-versioning`. Reuse it only when a domain does not have a
specialized version aggregate. Document versions remain owned by Document
Collaboration.

## Data Lifecycle

Canonical ID: `data-lifecycle`. Reuse it for DSAR, export, retention, redaction,
privacy, and guarded deletion planning. Every other system still owns the
lifecycle metadata for its own tables.

## Deployment Authority

Canonical ID: `deployment-authority`. Reuse it for environment-level release
approval, signed deploy verdicts, trusted issuers, complete workflow census
evidence, and one-time promotion-action consumption. It consumes immutable
Workflow Runtime evidence but does not own workflow execution, and its global
release-control records are not workspace DSAR data.

## Introducing A System

An introduction decision must state:

1. the user-visible lifecycle and responsibility that no current system owns;
2. exact current-system matches considered and why extension is wrong;
3. canonical entrypoints and any new tables;
4. actor surfaces as projections/delegates, not separate authorities;
5. migration and feature-preservation steps if replacing anything;
6. implementation status (`real`, `mixed`, or `fixture`) and terminal condition.

The deterministic catalog gate then proves that IDs, aliases, responsibilities,
and table ownership are unique; all table files are covered; and every canonical
entrypoint and decision document resolves. `pnpm check:system-topology` proves
that production resources have a canonical owner or generator provenance.
