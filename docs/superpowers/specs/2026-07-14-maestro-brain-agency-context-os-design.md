# Maestro Brain: Agency Context OS Design

**Status:** Proposed V1 product specification  
**Date:** 2026-07-14  
**Canonical implementation base:**
[`modernagencysales/maestro-template-saas-ui@123adb1`](https://github.com/modernagencysales/maestro-template-saas-ui/tree/123adb18c0abfe81fe98dd531c910b6cf493c8dd)

## Decision

Build this as a focused product on top of the Maestro SaaS UI template, not as a
generic template and not as another version of the existing content product.

The product promise is:

> Connect the agency's Slack once and give every teammate and agent current,
> cited, version-controlled client context through web, Slack, Claude Code, and
> MCP.

The governing product principle is:

> Opinionated about mechanics; flexible about ontology and storage.

Maestro Brain is opinionated about exact capture, tenant isolation, provenance,
revisions, citations, retrieval, and delivery. It is deliberately unopinionated
about the customer's page tree, vocabulary, Brain taxonomy, LLM, and eventual
storage adapter.

Non-negotiable V1 invariants:

- one agency Slack connection supports every channel the bot is explicitly added
  to;
- no joined channel is sampled, silently skipped, or forced to share another
  channel's cursor;
- bot membership authorizes ingestion only; every Brain read, answer, edit,
  review, export, and policy change is separately authorized through the
  template's existing RBAC;
- the user selects which channels route directly and which channels receive AI
  classification;
- every Classify channel has a human-selected finite target-Brain allowlist;
- a V1 classification routes a complete source unit to zero or exactly one
  allowed Brain; ambiguous units require review, while any unit containing
  evidence for multiple clients is structurally forced to `no_route` because V1
  has no target-safe span splitting;
- deterministic capture commits before and independently of every model call;
- model decisions return typed data that a separate pipe validates and applies
  mechanically;
- model and provider work is at-least-once; idempotent commit pipes accept one
  logical effect across duplicate attempts;
- realtime streaming remains healthy even when classification, maintenance, or
  historical backfill is unavailable;
- Slack Connect may ingest through Direct or Classify, but its delivery policy
  is capture-only in V1; a Slack channel is never a read grant for the full
  aggregated Brain.

This is a small, strong product if it remains a context control plane. It
becomes a weak product if it expands into a connector catalog, analytics
warehouse, workflow builder, Slack replacement, or content-generation suite
before the core loop is excellent.

## Why This Is A Product

Agencies do not want to administer a knowledge graph. They want the right client
context to already be present when a person or agent needs it. A database alone
does not deliver that outcome.

The paid job is the complete loop:

1. Capture exact source material without asking an LLM to be the database.
2. Keep clients isolated even though the agency uses one shared Slack workspace.
3. Maintain readable client Brains without daily librarian work.
4. Show where every claim came from and what changed.
5. Deliver the same context in the web app, authorized Slack responses, and
   external agents.

[Unblocked](https://getunblocked.com/index.md) validates the broader
context-engine category: it connects fragmented engineering sources, resolves
context, and serves it through MCP, CLI, and API. Maestro Brain's wedge is
different and specific: multi-client agency tenancy, Slack-to-client routing, an
editable Notion-like Brain, and source-backed autonomous maintenance.

The template remains the reusable factory underneath. The customer buys the
operating outcome, not the factory.

## V1 In One Sentence

One agency connects one Slack workspace, invites `@Maestro` into multiple
channels within the declared launch envelope, then either binds each channel
directly to a Brain or explicitly selects it for review-first AI classification
across an allowed set of Brains. Context streams continuously into the app and
client-scoped MCP; authorized Slack users can ask without turning channel
membership into Brain access.

## The Simplest V1 That Is Still Good

### Included

- One agency organization with one agency Brain and multiple client Brains
  inside a declared launch capacity envelope.
- One Nango-managed Slack connection per agency organization.
- Multiple public, private, and Slack Connect channels to which an administrator
  explicitly adds the Maestro bot.
- Multiple channels feeding the same client Brain, with an independent live
  stream, cursor, backfill, and health state for every channel.
- Deterministic message, edit, deletion, thread, author, timestamp, permalink,
  and channel capture.
- **Direct** routing for dedicated channels and optional **Classify** routing
  for user-selected mixed channels. Classification can target only Brains
  explicitly allowed by an administrator, returns zero or one target, and is
  review-first in the pilot.
- One opinionated, editable Client Brief inside a Notion-like BlockNote surface
  in the SaaS UI/Chakra shell.
- Source citations, page history, diffs, and one-click restoration.
- Cited Brain-maintenance proposals with Review first as the pilot default,
  explicit administrator-controlled Autopilot, and a complete audit trail.
- Client-scoped search, web "Ask this Brain," read-only remote MCP, and
  RBAC-authorized ephemeral/DM Slack answers for internal workspace members.
- Manual notes and links through the editor.
- Deterministic Markdown/JSON export.
- A read-only, client-scoped MCP token minted only by an authorized Brain
  administrator.

### Declared Launch Envelope

V1 is not marketed as unbounded. The release configuration declares one tested
capacity profile and prevents an organization from silently exceeding it. The
initial acceptance fixture is:

- one agency organization and one connected Slack workspace;
- one agency Brain plus 25 active client Brains;
- 100 joined channels: 75 Direct, 20 Classify, and 5 Capture only;
- 100,000 retained source revisions in the synthetic history fixture;
- a 20-event-per-second live burst for 60 seconds while backfill is active; and
- 10 concurrent authorized Ask/MCP requests.

The loaded profile remains one agency, but the harness also provisions a second
lightweight canary agency solely for adversarial cross-organization reads, key
collisions, commits, and deliveries. Cross-Brain checks inside the loaded agency
do not substitute for this tenant-isolation canary.

Provider-backed Slack tests run separately against the launch-supported Slack
rate class. Raising an envelope value requires a passing capacity receipt;
lowering one requires visible onboarding enforcement and customer-facing limits.

Staging and production use distinct Convex deployments, deploy credentials,
data, storage, provider connections, and WorkOS/Nango callback configuration.
The template's shared read-only demo backend and `demo/showcase` seed are
forbidden once tenant implementation begins. Backend-first staging deployment,
explicit promotion, and compatible rollback must be proven before real pilot
data is admitted.

### Explicitly Later

- Facebook, Google Ads, CRM, warehouse, call-recording, and other data sources.
- ClickHouse Cloud, customer performance analytics, and "How is this client
  performing?"
- Blank/imported Brain autonomy, file uploads, re-import, and write-capable MCP.
- Automated extraction/OCR of Slack-hosted files and arbitrary linked pages. V1
  preserves visible file/link metadata and permalinks.
- Automatic GitHub repository mirroring. A later GitHub/Nango connection can
  automate the deterministic export bundle.
- Vector search as a default dependency. V1 uses direct reads, recency windows,
  and workspace-scoped full-text retrieval. A semantic adapter is optional when
  evidence proves it is needed.
- Classification that can discover or route to a Brain outside the user's
  selected target set.
- Multi-target classification of one source unit. A later version may route
  target-specific cited spans rather than copying one complete thread into
  multiple Brains.
- Channel-wide full-Brain answers and Slack Connect answers. V1 shared channels
  are capture-only; internal answers are private to an authorized requester.
- Weekly digests and automatic Autopilot graduation.
- Customer portals, approvals, publishing, content generation, campaigns,
  workflow building, and analytics dashboards.

### Never In This Product's Core

- A Slack clone.
- A home-grown connector platform.
- AI-authored raw source records.
- A required taxonomy, folder structure, or frontmatter ceremony.
- Silent AI overwrites.
- Implicit cross-client retrieval.
- Automatically joining every public channel in a customer's Slack workspace.
- Letting a model expand its classification target allowlist or mutate the
  underlying channel policy.
- Treating Slack channel membership, a model-selected Brain key, or a
  caller-supplied tenant key as authorization.

## Product Model

### Tenancy

| Product noun         | Target runtime meaning                     | Rule                                       |
| -------------------- | ------------------------------------------ | ------------------------------------------ |
| Agency               | WorkOS-backed internal organization        | Security and billing tenant                |
| Agency Brain         | One workspace with `kind = agency`         | Internal operating context                 |
| Client Brain         | One workspace with `kind = client`         | Hard retrieval and write boundary          |
| Brain membership     | Existing workspace membership plus role    | Canonical authorization source             |
| Slack identity       | Verified team/user binding to Maestro user | Never inferred from display name or email  |
| Slack connection     | One organization-scoped Nango connection   | Never reconnect per client                 |
| Streaming channel    | A channel where the exact bot is a member  | Explicit opt-in ingestion boundary only    |
| Classification scope | Selected channel plus allowed Brains       | Human-defined boundary for model selection |
| Delivery audience    | Requester plus Slack response destination  | Separately authorized from ingestion       |
| Source vault         | Organization-scoped exact source ledger    | Not directly exposed to a client           |
| Source route         | Direct or model-proposed projection        | Active only after authorized commit/review |

The existing template already has durable organizations, workspaces,
memberships, invitations, role ordering, workspace access resolution, and audit
events. Roles are exactly `viewer`, `editor`, `admin`, and `owner`
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/roles.ts#L1-L18)).
Direct workspace membership grants client-specific access, while an active
organization administrator receives a capped administrator baseline across the
organization's workspaces
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/auth.ts#L118-L249)).
Its workspace schema is organization-owned and indexed by organization
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/tables/workspaces.ts#L4-L18)),
and the web provider already supports a list of workspaces and an active
selection
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/providers/workspace.tsx#L10-L69)).
V1 extends those primitives instead of inventing a parallel permission system.

The integration is not complete today. The root still supplies fake AuthKit and
workspace operations
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/routes/__root.tsx#L45-L66)),
and `auth.workspaces.list` is presently a public unfiltered query
([contract](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/auth/workspaces.spec.ts#L1-L11),
[implementation](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/auth/workspaces.impl.ts#L8-L16)).
Real AuthKit-to-Convex identity, WorkOS organization mapping, and authorized
workspace provisioning are therefore WP0 launch work, not inherited capability.

### V1 Role And Capability Matrix

| Scope               | Minimum role | Capabilities                                                                                                          |
| ------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Client Brain        | `viewer`     | read pages/routed sources, search, Ask, use a read-only token already granted to that Brain                           |
| Client Brain        | `editor`     | viewer rights plus edit pages, deposit manual context, review maintenance proposals, restore revisions                |
| Client Brain        | `admin`      | editor rights plus members, Brain policy, Autopilot, exports, and Brain-scoped API keys                               |
| Client Brain        | `owner`      | admin rights plus ownership transfer and Brain deletion                                                               |
| Agency organization | `admin`      | Slack connection, channel routing policies, Classify allowlists/reviews, retention, model egress, historical reroutes |
| Agency organization | `owner`      | admin rights plus organization ownership, billing, and organization deletion                                          |

Every capability enforces its minimum role on the server through the shared
access layer. UI visibility is convenience, not authorization. API/MCP keys are
workspace-bound service principals with explicit scopes and a role ceiling; only
an authorized Brain administrator can mint or revoke them.

### Stable Identity

Public contracts use stable strings, never Convex document IDs:

- `agencyKey`
- `brainKey`
- `pageKey`
- `sourceKey`
- `sourceRevisionKey`
- `pageRevisionKey`
- `connectionKey`

Production Maestro already demonstrates stable page keys, route handles,
aliases, export paths, and parent relationships
([source](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/packages/convex/convex/schema/brainPages.ts#L22-L83)).
Bring that identity shape into this fork before adding public MCP contracts.

## First-Run Experience

The activation path should take less than 15 minutes:

1. Sign in, provision the WorkOS-backed agency, and name it.
2. An organization administrator clicks **Connect Slack** once through Nango.
3. Create or confirm the first client Brain.
4. In Slack, use **Add apps** or `/invite @Maestro` in one channel that should
   feed that Brain. Add more channels after first value.
5. Maestro detects bot membership through the event fast path or the next Nango
   channel reconciliation and immediately records the channel as **Needs routing
   policy**. New events can enter the organization vault without being visible
   to any client yet.
6. In Connections, choose **Send every conversation to [Brain]**, **AI routes
   each conversation among [Brains] (Beta)**, or **Capture only**. The first is
   runtime Direct. Beta classification selects a finite allowlist, returns zero
   or one target, and requires an organization administrator to review the
   proposal. Agency Brain is an ordinary Direct destination. A bounded model
   call may suggest configuration, but a human confirms the policy.
7. The channel becomes **Streaming** immediately. A recent-history backfill is
   prioritized for fast value; deeper history continues independently in the
   background.
8. Maestro creates the standard editable Client Brief.
9. Maestro opens the Brief and asks the maintenance model for the first cited
   summary. The model returns either a cited proposal or typed
   insufficient-evidence result while backfill continues.
10. An authorized user confirms the first useful proposal and copies a
    client-scoped read-only Claude Code/MCP configuration.

The onboarding does not ask the agency to design an ontology, choose a vector
database, manage prompts, or understand source pipelines.

### Pilot Client Brief

V1 creates one small, editable starting set:

- Overview
- Stakeholders
- Decisions
- Commitments and next steps
- Risks and open questions
- Proof and assets

These are ordinary pages, not schema types. They can be renamed, nested,
deleted, or replaced after activation. The pilot evaluates maintenance against
this standard artifact before Blank/imported Brain autonomy ships.

## Daily Experience

The product should be inboxless by default:

- Slack capture and reconciliation happen continuously.
- Every joined channel streams independently into the organization source vault.
- Direct channels project deterministically into one Brain.
- User-selected Classify channels call a model after capture and propose zero or
  exactly one allowed Brain.
- A classification failure never blocks capture or another channel's stream.
- The maintenance model decides which assembled threads warrant cited page
  revisions after a fixed quiet period.
- Review first is the pilot default. A Brain administrator may explicitly enable
  Autopilot only after reviewing that Brain's evaluation evidence; model
  self-confidence never grants publication authority.
- A model may return a typed no-op. Revision budgets prevent noisy page churn.
- Unapproved Classify proposals remain only in the organization vault and are
  not client-readable.
- Any agent edit can be inspected and reverted in one click.

The operator can switch Brain maintenance between **Review first**,
**Autopilot**, and **Off**. Channel **Capture only** is separate: exact source
capture continues, while routing and model work pause. Removing the bot is the
only V1 action that stops channel capture, and any resulting history recovery is
reported as best effort rather than guaranteed.

## User Interface

Use the corrected SaaS UI fork and keep the visible product intentionally small.
The fork already pins Chakra, SaaS UI, SaaS UI Pro, BlockNote, and Convex
ProseMirror sync as one web stack
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/package.json#L14-L47)).

### Global Navigation

- **Clients** — client list, freshness, connection state, and recent changes.
- **Agency Brain** — internal agency context.
- **Connections** — Slack connection, channel access, sync health, and exports.
- **Settings** — members, tokens, retention, and model/autopilot policy.

Search/Ask is a global command, not another dashboard route.

Do not expose the template's Workflows, Capabilities, Agents, Runs, Billing,
Analytics, Data Map, or API catalog in customer navigation. Those primitives may
remain underneath the product, but the current generic route registry is much
larger than this product requires
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/navigation/workspace.ts#L37-L179)).

### Connections: Channel Control Plane

The Slack connection page is not a generic integrations catalog. Its main
surface is a selectable channel table:

| Column     | Purpose                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| Select     | Bulk-configure multiple joined channels                                        |
| Channel    | Name, public/private/Slack Connect badges, stable external ID                  |
| Bot access | Joined, needs app invite, or access lost                                       |
| Routing    | Needs policy, Send all to one Brain, AI routes (Beta), or Capture only         |
| Targets    | One Direct Brain or the explicit Classify allowlist                            |
| Delivery   | Capture-only, private authorized answers, or later channel-authorized delivery |
| Live       | Streaming state, last event, and current lag                                   |
| History    | Recent/deep backfill state, progress, and last error                           |

Bulk actions use operator language: **Send every conversation to [Brain]**, **AI
routes each conversation among [Brains] (Beta)**, and **Capture only**. Choosing
Beta classification opens a required multi-select of target Brains and a
recent-thread preview. The saved policy shows the exact allowlist; it cannot be
empty. Changing it creates a new policy version and does not silently rewrite
historical routes.

This is how an operator selects the channels to classify. There is no implicit
"classify all Slack" mode. Classify proposals enter a visible administrator
review queue with source preview, proposed zero-or-one target, rationale,
evidence, age, and **Accept**, **Change target**, or **No route** actions. The
queue is not exposed to client Brain viewers.

Only organization administrators can configure Slack, routing, classification,
retention, or delivery. Non-admins see the health of channels feeding Brains
they can access but cannot enumerate the organization vault or other clients'
channel directory.

### Client Brain Layout

Desktop uses three composable regions inside the existing business shell:

```text
┌─────────────────┬──────────────────────────────────┬─────────────────────┐
│ Client + pages  │ Editable BlockNote page          │ Sources / history   │
│                 │                                  │ (contextual drawer) │
└─────────────────┴──────────────────────────────────┴─────────────────────┘
```

- Left: client switcher, page tree, favorites, add page, search.
- Center: page title, freshness, edit state, BlockNote document; viewers render
  read-only and editors or higher may save.
- Right: toggled Sources, citations, page history, and diff/restore views.
- Top command: Ask this Brain.
- Mobile: page tree and evidence panel become drawers; the editor remains the
  primary surface.

The current `/brain` route is only a generic three-card placeholder
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/saas-ui/business-shell.tsx#L501-L587)).
Replace that surface; do not add a second app shell.

Production Maestro provides reusable behavioral prior art for the page/sidebar
composition
([workspace composition](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/apps/web/src/features/brain/brain-workspace-content.tsx#L108-L155),
[page tree](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/apps/web/src/features/brain/brain-page-tree.tsx#L57-L118)).
Port the behavior and view models, then render them with SaaS UI/Chakra
primitives. Do not import the production app's Notion Kit shell or product-wide
CSS.

## Trust Architecture

### Two Visible Layers

#### 1. Deterministic Source Ledger

This layer stores normalized source facts exactly:

- provider and connection
- channel and thread identifiers
- message identifier and version
- provider event identifier and observation order
- author identifier and display snapshot
- exact normalized text
- provider timestamps
- permalink and source locator
- content hash
- capture timestamp
- edit/delete state

Provider delivery is at-least-once. Transport receipts and logical source
observations have different identities. A transport receipt is unique by the
verified delivery/event identifier. A logical source observation is unique by
connection generation, stable provider object key, provider revision
discriminator (`edited.ts`, tombstone revision, or equivalent), and canonical
hash; one observation may cite multiple live/backfill/reconciliation receipts.
This lets a live event and a history page converge while preserving a real
`A -> B -> A` edit sequence. Out-of-order observations append, while provider
timestamp, revision discriminator, and a deterministic receipt tie-breaker form
the total order that updates the latest pointer. Edits append source revisions;
deletions append tombstones. Neither overwrites history metadata.

#### 2. Versioned Brain Pages

Pages are editable, source-backed views over the ledger. A human or model may
create a page revision. Every revision records:

- prior revision
- human, agent, import, reconcile, or restore causation
- actor and model receipt when applicable
- content hash
- exact source revision citations
- created time
- publish state

AI content is never relabeled as raw source truth. A citation resolves to the
exact source revision used at generation time, even if the Slack message is
later edited.

The template already contains the right append-only vocabulary and table shape
([contract](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/template-core/src/versioning.ts#L1-L36),
[table](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/tables/versionedEntries.ts#L4-L35)).
Its current Confect versioning implementation is still a fixed-time
`Effect.succeed` fixture rather than persistence
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/ops/versioning.impl.ts#L36-L160)).
The existing public versioning and knowledge contracts also accept
caller-supplied workspace strings and do not declare the authorization failures
this product needs. V1 therefore performs deliberate contract-and-schema
migrations with internal commit functions and server-derived workspace access;
it does not merely replace fixture bodies or create a competing revision system.

### Retention, Redaction, And Revocation

Append-only audit metadata does not mean indefinite cleartext retention.
Organization administrators configure a runtime retention policy. A Slack
deletion immediately removes the prior text from current reads, search, model
inputs, and new exports; after the configured grace period, Maestro purges or
crypto-erases protected text while retaining only non-sensitive tombstone/hash
metadata.

Every lifecycle action has an explicit propagation matrix covering source
revisions, source-unit snapshots, classification attempts, routes, search
projections, page revisions, citations, retrieval receipts, queued jobs,
exports, and backups:

- Slack edit or delete;
- bot removal or connection replacement;
- normal prospective route change;
- emergency route revocation;
- retention expiry or legal hold;
- Brain deletion, organization deletion, and DSAR.

Revocation fences pending commits, deactivates routes and indexes, blocks
current retrieval, and immediately makes an affected current page revision
non-readable until a reviewed safe replacement becomes current. V1 does not
attempt selective claim redaction without block/claim-level provenance. A
citation whose text has been erased resolves to an explicit redacted marker,
never stale cleartext. Previously downloaded exports are reported as outside
Maestro's control.

Connection lifecycle is explicit: same-connection reauthorization preserves
stable channel keys and cursors while incrementing the credential generation;
connection replacement, team/app change, disconnect, or uninstall revokes the
old generation, rejects stale webhooks, pauses old channel lanes, fences queued
jobs/routes/projections/outbox rows, and revokes Slack identity bindings until
the exact replacement is reviewed. Model providers used with customer text must
have an approved zero-retention/no-training contract or a documented deletion/
DSAR API and retention window; otherwise they are not launch-eligible.

DSAR scope is deterministic for exact linked identities: WorkOS subject,
organization membership, verified Slack `(team_id, user_id)`, source-author
keys, and every descendant row keyed from those occurrences. Free-text mentions
or inferred identity are not deleted automatically in V1; they enter a reviewed
manual-discovery plan whose included/excluded resources and reviewer are part of
the DSAR receipt.

### Zero Framework Cognition

The architecture follows Zero Framework Cognition (ZFC): dumb, observable pipes
surround explicit model calls. Code owns mechanism and policy enforcement.
Models own semantic decisions. The two must never blur into a helper function
that quietly performs both.

This matches the template's existing layer law: workflows compose capabilities,
agents call capabilities/workflows, and provider adapters remain behind those
boundaries
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/AGENTS.md#L8-L20),
[source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/AGENTS.md#L50-L58)).

#### Required separation

```text
Slack event or backfill page
  -> CAPTURE TRANSACTION (no model)
     validate envelope -> dedupe -> normalize -> hash -> append source revision
     -> append durable assembly intent with pinned policy epoch
  -> WEBHOOK ACK

Durable processing worker, only after capture commit
  -> SOURCE-UNIT ASSEMBLY PIPE (reads/writes; no model)
     gather latest message revisions as of a fixed cut
     -> append immutable bounded source-unit snapshot + classification intent
  -> POLICY DISPATCH PIPE (no model)
     no policy: retain as awaiting_policy
     direct: produce the confirmed one-Brain route command mechanically
     classify: build a closed request from snapshot + pinned finite Brain allowlist
  -> CLASSIFICATION MODEL ADAPTER (LLM provider only; Classify mode only)
     select zero or one allowed Brain -> return typed proposal + diagnostics
  -> RBAC REVIEW GATE (Classify mode in V1; no model)
     organization admin accepts, changes to another allowed target, or selects no route
  -> ROUTE COMMIT PIPE (no model)
     validate auth/schema/allowlist/policy epoch -> append one logical route effect
  -> MAINTENANCE GATHER PIPE (reads only; no model)
     load the routed source unit, current pages, and exact citation candidates
  -> MAINTENANCE MODEL ADAPTER (LLM provider only)
     select pages -> propose cited page revisions
  -> REVISION COMMIT PIPE (no model)
     validate structure/citations/policy -> append or reject mechanically
```

The capture transaction writes the source revision, event receipt, and durable
assembly intent atomically. Enqueuing work is data persistence, not a model
call. A worker claims that intent only after commit. It assembles and persists a
source-unit revision from exact message revisions as of one fixed cut; the model
never dereferences database keys. Direct and Classify processing share this
durable handoff, but Direct never crosses the LLM boundary.

No model call runs inside webhook capture. A model adapter may call only the
configured LLM provider and must return typed data plus a receipt; it cannot
fetch Slack/Nango data or mutate the database. Gather and commit capabilities
perform those effects on either side of the adapter.

| Runtime unit           | Allowed effects                                                   | Forbidden dependency                 | Boundary result                                              |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------ |
| Capture pipe           | verify Nango envelope; write source, receipt, and assembly intent | LLM or AI SDK                        | immutable source revision plus durable intent                |
| Source-unit assembler  | repository reads; append bounded snapshot and next intent         | LLM and provider SDKs                | immutable source-unit revision at a fixed cut                |
| Classification adapter | call configured LLM with a closed content-bearing request         | Slack, Nango, database reader/writer | typed proposal and model receipt returned to caller          |
| RBAC review gate       | authorize reviewer and persist accept/change/no-route             | LLM and provider SDKs                | reviewed route command                                       |
| Route commit pipe      | validate and write route/status                                   | LLM, Slack, Nango                    | one logical append-only route effect or typed rejection      |
| Maintenance gather     | repository/search reads                                           | LLM, database writer                 | immutable bounded context pack                               |
| Maintenance adapter    | call configured LLM with that context pack                        | Slack, Nango, database reader/writer | typed revision proposal and model receipt returned to caller |
| Revision commit pipe   | validate and write revision/citations                             | LLM and provider SDKs                | one logical append-only page revision or typed rejection     |

#### Code may do only mechanical work

- authenticate and authorize callers;
- parse and validate typed envelopes;
- enforce bot membership, existing RBAC, tenant equality, human-selected target
  allowlists, and delivery policy;
- deduplicate events, compute hashes, and apply provider observation ordering;
- group messages by Slack thread identifiers;
- serialize, persist, index, paginate, and checkpoint;
- enforce fixed budgets, timeouts, concurrency, and approval policy;
- honor provider rate limits and typed errors;
- schedule fair queue work using fixed operational policy;
- verify that citations resolve to supplied source revisions;
- fence stale jobs and enforce optimistic concurrency against the current source
  unit, policy epoch, route generation, and page revision;
- apply a valid model decision without changing its meaning.

Fixed round-robin fairness, bounded concurrency, a configured quiet window, and
provider-supplied `Retry-After` are operational mechanisms, not local cognition:
they never inspect source meaning. If prioritization or scheduling would depend
on what a message means, its client relevance, or its importance, that decision
belongs in a model call instead of the queue implementation.

#### Models own every semantic decision

- whether a captured item is relevant to any allowed Brain;
- which one allowed Brain should receive it, or none;
- whether two statements conflict or supersede one another;
- which existing page should change or whether a new page is useful;
- what a source means, how important it is, and how to summarize it;
- which gathered evidence supports an answer;
- whether the available evidence is sufficient.

#### Forbidden ZFC violations

- keyword lists such as `done`, `client`, or brand-name substring routing;
- regex-based semantic classification;
- local weighted scoring, ranking, or synonym tables;
- fallback decision trees that guess a client or page after model failure;
- parsing model prose for status or intent;
- code "improving" or reranking a valid model decision;
- coupling capture success to classification or summarization success.

Classification receives a closed request. It includes the immutable bounded
source-unit snapshot itself, not keys the adapter would need to dereference. The
allowed targets contain stable Brain keys plus a pinned display name and
optional human-authored routing description; the model does not browse the
organization or discover more targets. Slack text is delimited as untrusted data
and cannot change trusted instructions, authorization, tool grants, or accepted
effects. The classification adapter has no provider, retrieval, or write tools.

```ts
type ClassificationRequest = {
  sourceUnitRevisionKey: string;
  sourceUnitHash: string;
  messages: Array<{
    sourceRevisionKey: string;
    authorLabel: string;
    providerTimestamp: string;
    canonicalText: string;
  }>;
  policyVersion: number;
  allowedTargets: Array<{
    brainKey: string;
    displayName: string;
    routingDescription?: string;
  }>;
};
```

It returns a closed structured result such as:

```ts
type ClassificationDecision = {
  sourceUnitRevisionKey: string;
  targetBrainKey: string | null;
  confidence: number;
  rationale: string;
  evidenceQuotes: Array<{ sourceRevisionKey: string; quote: string }>;
};
```

The validation pipe verifies that a non-null `targetBrainKey` is in the pinned
allowlist, the source-unit key/hash and evidence quotes resolve, and all fields
are structurally valid. Model confidence is diagnostic only; it never grants
access or publication. An organization administrator then accepts the proposal,
changes it to another allowed target, or selects no route. The commit pipe
applies that reviewed command mechanically. A valid null target becomes
`classified_no_route`; code does not invent a fallback.

Capture, assembly, cognition, review, and commit have separate idempotency keys,
attempts, status, latency, cost, and error records. External calls and workers
execute at least once: duplicate model attempts are permitted, but fencing
tokens, compare-and-set completion, and unique effect keys allow only one
logical accepted decision, route, or page revision. A stale source-unit or page
job becomes `superseded` instead of publishing after newer evidence. If
classification is unavailable, the exact source remains durable as
`awaiting_classification`, other channels continue streaming, and the job can be
replayed with the pinned policy, prompt, model, and tool-schema versions.

### Autonomous Maintenance Rules

AI is allowed to:

- propose zero or one target Brain from a human-approved classification
  allowlist;
- score relevance within an already bound Brain;
- choose likely existing pages;
- draft a page revision;
- summarize a source thread;
- answer a question over retrieved evidence;
- suggest a new page;
- mark a page as possibly stale.

AI is not allowed to:

- invent source rows, timestamps, authors, links, or hashes;
- mutate a raw source revision;
- change channel routing policies or allowed target sets;
- add a target Brain that is not in the channel's classification allowlist;
- reinterpret or override the routing policy returned by code;
- silently delete page content;
- retrieve across client boundaries;
- publish an uncited factual revision in Autopilot mode.

Every model decision is derived data with a model/prompt receipt. Changing the
model must not change the source ledger or public identifiers.

The template's LLM gateway already provides an OpenRouter-shaped seam and a
validated completion envelope with estimated usage
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/llm.ts#L53-L95),
[source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/llm.ts#L167-L248)).
Its live transport is still a text-only placeholder. V1 must add a real
provider-neutral transport, schema-constrained structured output, Effect
decoding, provider/model/usage receipts, canonical request/response hashes, and
typed malformed-output errors behind that seam. Do not put model SDKs in Slack
handlers or web features. A pinned request is auditable and replayable; LLM
output is never described as reproducible.

## Slack And Nango Boundary

### Decision

Nango owns Slack connection infrastructure. Maestro owns context semantics.

| Nango owns                     | Maestro owns                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| OAuth and connection UI        | Agency/client tenancy and RBAC                                                       |
| Token refresh and storage      | Exact normalized source ledger                                                       |
| Slack API proxy                | Exact bot identity, membership, and routing policies                                 |
| Channel/history API operations | Directory scheduling, per-channel cursors, queues, health                            |
| Slack read/send actions        | Native Slack Events receiver, raw-signature/replay verification, normalization       |
| OAuth callback metadata        | Slack identity binding, delivery authorization, revisions, retrieval, answers, audit |

Nango's maintained Slack docs show user authorization, proxied channel access,
prebuilt syncs, and actions
([source](https://github.com/NangoHQ/nango/blob/0bef47367085384c037a0ccca83c7d5bfc696d7f/docs/api-integrations/slack.mdx#L7-L87)).
Its webhook guide warns that unmatched raw events may arrive without a
connection wrapper. V1 therefore does not use Nango forwarding as its trust
boundary. The Slack app points Events API traffic to Maestro's narrow native
receiver; Nango remains the OAuth/token/API/action boundary.

Before WP2 starts, pin the Slack app manifest, bot scopes, event subscriptions,
and native raw-body signature contract. Every accepted event must pass Slack
signature verification, timestamp/replay-window checks, request-size limits, and
secret-rotation policy, then bind
`providerConfigKey + connectionId + connectionGeneration + team_id + api_app_id`
to exactly one active organization. Unmatched or unverifiable raw payloads
create redacted health metadata only; tenant inference is forbidden.

Nango is not a complete conversational Slackbot or multi-tenant ingestion
runtime. Maestro still needs a thin bot handler and a product-specific
per-channel ingestion coordinator. It does not need a second token store or a
generic connector framework.

### Bot Membership Is The Ingestion Switch

Installing the Slack app authorizes the workspace connection. It does not grant
Maestro permission to ingest every channel. A channel becomes eligible only when
a user explicitly adds `@Maestro` to it.

Nango uses the bot token as the default Slack proxy credential while separately
supporting user tokens
([source](https://github.com/NangoHQ/nango/blob/0bef47367085384c037a0ccca83c7d5bfc696d7f/docs/api-integrations/slack/slack-user-access-tokens.mdx#L7-L36)).
V1 ingestion pins the bot-token identity: call `auth.test` on connection,
persist `team_id`, `api_app_id`, and `bot_user_id`, and interpret `is_member`
only for that exact bot. Never treat the installing user's membership as bot
membership.

Nango's channel model already exposes both `is_member` and the Slack Connect
flags `is_shared`, `is_org_shared`, and `is_ext_shared`
([source](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/channels.ts#L6-L24)).
Its optional `joinPublicChannels` behavior can automatically join every public
channel
([source](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/channels.ts#L37-L39),
[source](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/channels.ts#L147-L163)).
Keep that option disabled. Explicit membership is a privacy boundary and a much
clearer product gesture.

Detect membership changes through Slack events when available and reconcile them
against Nango's channel sync. Slack documents
[`member_joined_channel`](https://docs.slack.dev/reference/events/member_joined_channel/)
for public and private channels, but reconciliation remains necessary because
the fast-path event can be delayed, missed, or shaped differently when the bot
itself is the joining member.

Each joined channel has one primary state:

| State          | Meaning                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `needs_policy` | Bot is a member; exact events enter the agency vault as `awaiting_policy`, but no client can read them |
| `streaming`    | A Direct or Classify routing policy is active; Agency Brain uses Direct                                |
| `capture_only` | Exact capture continues, while routing and model work are suspended                                    |
| `access_lost`  | The bot was removed or scopes no longer permit reads; recovery is best effort                          |
| `error`        | A provider, verification, or normalization failure needs retry/operator attention                      |

Backfill state is separate: `not_started`, `recent`, `deep`, `complete`, or
`error`. Live streaming must not wait for historical backfill.

V1 routing rules are deliberately bounded:

- multiple Direct channels may feed the same Brain within the launch capacity
  envelope;
- a Direct channel feeds exactly one Brain;
- **Send to Agency Brain** is a Direct policy whose one target is the agency
  Brain, not a separate runtime mode;
- a Classify channel has an administrator-selected finite target allowlist and
  proposes zero or exactly one Brain for each complete source unit;
- Direct is the recommended mode for dedicated client channels;
- Slack Connect may ingest through Direct or Classify, but its delivery policy
  is always capture-only in V1;
- Classify is an explicit mode for selected mixed internal channels, never a
  workspace-wide default;
- a channel rename does not change policy because Slack channel ID is stable;
- changing a Direct target or Classify allowlist creates an immutable policy
  epoch and is prospective by first-observed time by default;
- a thread revision never mixes policy epochs: messages retain their
  first-observed epoch and assembly emits same-epoch segments; a reply after a
  policy change starts a new segment and cannot reroute earlier-epoch text;
- moving or revoking historical source routes requires a separate explicit,
  audited action;
- `capture_only` never creates a recovery gap because exact capture continues;
- bot removal or lost access may create an unrecoverable gap when Slack
  retention expires or messages are edited/deleted before reconciliation;
- an unconfigured channel remains in the agency vault and cannot answer from a
  client Brain.

Confirming a channel's first policy creates bounded processing jobs for source
units captured since the bot joined and an explicit provider-time backfill
interval. Each source is assigned one policy epoch transactionally. Normal
changes affect sources first observed after the new epoch. Emergency revocation
increments a fence generation, cancels pending commits, deactivates routes and
search projections, and starts derived-data remediation.

Slack Connect is a channel property, not another login. Expose the
shared-channel flags and channel metadata to the optional
configuration-suggestion model, but do not match client names in code. A
human-confirmed routing policy is still required before client access.

### Two Independent Ingestion Paths

#### Live event path

Slack sends live Events API requests to a narrow Maestro-owned receiver. Maestro
verifies Slack's native signature over the raw bytes; Nango continues to own
OAuth, token refresh, Slack API proxying, bounded history calls, and send
actions. Maestro then:

1. verifies Slack's native signature/raw-body timestamp, replay window, and
   active connection generation;
2. verifies `team_id`, app/bot identity, bot membership, and organization
   binding;
3. deduplicates the Slack transport receipt, then converges it with any
   live/backfill/reconciliation receipt on the logical observation key;
4. snapshots the active routing-policy epoch, if one exists;
5. atomically appends the event receipt, exact organization-scoped source
   revision, and durable assembly intent; `needs_policy` becomes
   `awaiting_policy`, while `capture_only` stops after exact capture;
6. commits and acknowledges before any LLM, route projection, backfill, or slow
   retrieval work runs;
7. lets a separate worker assemble the deterministic thread snapshot, route
   Direct sources mechanically, or create a Classify proposal for review.

This is the path that makes "add the bot and context starts streaming" true.
Backfill, summarization, and page maintenance are asynchronous consumers.

Classification operates on deterministic source units, normally a Slack thread
identified by `thread_ts` or a standalone message. A fixed quiet-window policy
may debounce rapid replies, but code does not decide that a conversation is
semantically "finished." A new reply creates a new source-unit revision and a
new at-least-once cognitive attempt over the updated evidence. Older in-flight
attempts are fenced as `superseded` before route or page commit.

#### Historical backfill and reconciliation path

Nango's message sync is useful starting code, not production-ready ingestion. It
fetches messages, thread replies, and per-channel checkpoints, but currently
processes only `allChannels.slice(0, 1)`
([source](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/syncs/messages-received.ts#L70-L93)).

Do not merely change that line to `allChannels` and accumulate every message in
one invocation. That would trade the one-channel bug for timeouts, starvation,
and unbounded memory.

Use Nango for authorization and Slack API proxying, while a durable Maestro
workflow schedules bounded work for one channel at a time. Each channel stores
its own history cursor, latest observed timestamp, oldest completed timestamp,
fenced lease generation, attempt count, next retry time, and typed last error. A
fair queue rotates across channels so one large client cannot block every other
stream.

Backfill runs in two stages:

1. **Recent:** fetch a fixed, bounded newest-message/time window first, then let
   the answer model return either a cited answer or typed insufficient-evidence
   result. The backfill scheduler never reads meaning to decide when to stop.
2. **Deep:** continue through history to the configured retention boundary in
   the background.

Every batch is bounded. It either commits normalized observations and the next
cursor together, or commits observations first and advances the cursor through
compare-and-set only after all writes succeed. It respects Slack's `Retry-After`
and can resume on another worker. Live events and backfill use the same logical
observation key while retaining separate transport receipts, so races converge
on one source revision. Scheduled reconciliation re-reads a recent overlap
window to repair missed edit/delete events.

Required multi-channel properties:

- no connection-wide `allMessages` accumulator;
- no shared cursor across channels;
- at most one valid fenced lease generation for a channel;
- configurable organization-level concurrency and rate budget;
- connection-and-method-level rate budgets with priority for live capture and
  outbound delivery over recent and deep history;
- fair progress across small and large channels;
- retryable/permanent typed errors, bounded attempts, dead-letter state, and
  administrator replay;
- live streaming continues while deep backfill is throttled or failed;
- removing the bot stops future capture and marks `access_lost` without deleting
  retained history;
- re-adding the bot resumes from the saved cursor, reconciles what Slack still
  exposes, and reports any `gap_unrecoverable` interval honestly.

### Slack Rate-Limit Launch Risk

Slack's current documentation gives `conversations.history` and
`conversations.replies` Tier 3 limits for Marketplace and internal
customer-built apps, but limits new commercially distributed non-Marketplace
apps to one request per minute and 15 objects per response
([history](https://docs.slack.dev/reference/methods/conversations.history/),
[replies](https://docs.slack.dev/reference/methods/conversations.replies/),
checked 2026-07-14).

That restriction does not prevent realtime Events API streaming, but it can make
deep multi-channel history import take hours or days. Before promising fast
historical onboarding, verify whether the Nango-hosted or Maestro-owned Slack
app qualifies for Tier 3 limits. If not, Slack Marketplace approval is a launch
dependency for fast backfill. Until then, product status and SLAs must clearly
separate **Streaming live** from **History caught up**.

### Thin Slackbot

Capture permission, requester permission, and delivery permission are three
different checks. Adding `@Maestro` authorizes capture only; it never authorizes
every channel member to retrieve the full aggregated Brain.

Before a user can ask from Slack, they sign in to Maestro and complete a
one-time link that binds verified `(team_id, slack_user_id)` to their Maestro
user. Display-name or email matching is never sufficient. Bindings are revocable
and rechecked against current WorkOS/Convex membership and role on every
request.

Use the verified native `app_mention` and DM events. The handler:

1. verifies, deduplicates, persists, and acknowledges the forwarded event
   without waiting for a model;
2. starts a separate answer job and resolves the active Slack identity binding;
3. resolves a Direct target mechanically or calls the shared typed
   scope-selection capability over the intersection of the channel policy and
   Brains the requester may access;
4. requires at least `viewer` through the existing workspace access resolver;
5. calls the same server-authorized `brain.answers.ask` capability used by web
   and MCP; caller-supplied tenant IDs are ignored or rejected;
6. commits an outbound-delivery intent with a unique answer key before sending;
7. renders a sanitized answer with compact citations, `asOf`, and freshness.

The scope-selection capability returns one authorized `brainKey` or a typed
`needs_clarification` result. The transport handler only validates and renders
that result; it contains no client-name matcher, fallback tree, prompt, or
retrieval logic.

V1 delivery policy is deliberately conservative:

- Slack Connect channels are capture-only and never receive a full-Brain answer.
- Internal channel mentions return an ephemeral threaded answer visible only to
  the authorized requester.
- DMs require the same identity binding and Brain role check. A free-text client
  name is resolved by the closed scope-selection model over authorized Brains;
  an interactive picker resolves mechanically.
- Channel-wide answers are later work requiring an explicit administrator policy
  and an audience/corpus model that proves every recipient may see every cited
  source.

Nango already maintains a `chat.postEphemeral` action with `user_id` and
optional `thread_ts`
([source](https://github.com/NangoHQ/integration-templates/blob/e286bd20c5795f9e8bfbc9053e65669941c08c89/integrations/slack/actions/send-ephemeral-message.ts#L4-L35)).
Use it for internal-channel V1 answers. Ephemeral delivery is at-most-once:
persist the outbox effect before the call and never retry an ambiguous timeout,
because ephemeral history cannot be reliably reconciled. Report the outcome as
unknown and let the requester create a new answer request with a new effect key.
DM delivery may retry only behind a provider action with a verified idempotency
or reconciliation contract. Mechanically identify and suppress the bot's own
answer events from maintenance/classification while retaining a receipt. Escape
mass mentions and unsafe links before delivery.

The Vercel AI SDK Slackbot is useful behavioral prior art for fetching thread
context and replying in a thread
([thread reader](https://github.com/vercel-labs/ai-sdk-slackbot/blob/7d84809865ba4624a38eab4dd6dbb2aecc3758bc/lib/slack-utils.ts#L72-L107),
[mention handler](https://github.com/vercel-labs/ai-sdk-slackbot/blob/7d84809865ba4624a38eab4dd6dbb2aecc3758bc/lib/handle-app-mention.ts#L29-L56)).
Do not deploy its static `SLACK_BOT_TOKEN` client architecture
([source](https://github.com/vercel-labs/ai-sdk-slackbot/blob/7d84809865ba4624a38eab4dd6dbb2aecc3758bc/lib/slack-utils.ts#L5-L8))
beside Nango.

Use the AI SDK, if selected, behind the shared LLM/answer adapter for model
streaming and provider portability. The Slack handler itself remains a thin
transport adapter and contains no independent prompts or answer logic.

## Retrieval: When To Use RAG

"RAG" is not a storage strategy and does not automatically mean vectors.

Expose dumb, server-scoped retrieval tools:

1. **Page read** by stable page key.
2. **Source read** by exact citation, thread, or message locator.
3. **Recent source list** with explicit time/channel filters.
4. **Full-text candidate search** with an explicit query and bounded result cap.
5. **Optional semantic candidate search** behind the same provider-neutral seam.

The request never establishes a tenant by supplying `workspaceId`,
`workspaceSlug`, or `brainKey`. The authenticated principal resolves one Brain
server-side, and the retrieval capability checks its current effective role
before it reads pages or searches an index. Search can see only active,
non-redacted `workspaceSearchProjections` produced from pages and source routes
already authorized for that Brain. Organization-vault rows never enter the
candidate corpus directly.

If the caller names a page, source, or explicit filters, the corresponding tool
executes mechanically. For an open-ended question, the answer model decides
which retrieval tools and queries to use, selects evidence from their
candidates, and returns cited text plus a retrieval manifest. The application
does not use a local decision tree to choose "the best" retrieval path.

Every Ask run pins an immutable candidate manifest before the answer call. It
records the principal, Brain, query and filters, exact page/source revision
keys, projection version, policy epochs, route/revocation generations, and a
canonical hash. The model can cite only entries in that manifest. Immediately
before web return, MCP return, or Slack delivery, the response pipe re-resolves
the principal's current Brain role and compares every pinned generation. A role
revocation, route revocation, deletion, or redaction fails with a typed stale
authorization result; it never returns the now-forbidden answer.

Database/search-provider ordering may bound a candidate page, but it is not the
final semantic judgment. Do not add local keyword boosts, custom weights,
synonym tables, or token-overlap reranking. The model selects the evidence used
for the answer. If it judges the gathered evidence insufficient, it returns a
typed insufficient-evidence decision instead of answering from model memory.

The template's current search seam is useful fake/test prior art, but its live
adapter and `query` return synchronously
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/search/src/index.ts#L57-L64)).
A direct Convex query cannot satisfy that contract. V1 deliberately migrates the
live search service to an asynchronous Effect interface and adds a durable,
workspace-scoped projection writer. Convex full-text search is the first live
candidate provider; vectors remain an optional adapter. The existing
token-overlap scorer stays a fake/test fixture rather than product cognition.

### Prompt-Injection Boundary

Slack messages, imported text in later versions, manual pages, user questions,
MCP arguments, search snippets, model output, and provider metadata are all
untrusted data. They are never concatenated into trusted system instructions or
allowed to define tools, tenant scope, target allowlists, delivery audience, or
commit policy.

Each classification, maintenance, and answer adapter receives a versioned
trusted instruction envelope, a closed tool/schema grant, and a separately
delimited immutable content manifest. Answer adapters have read-only retrieval
tools; classification and maintenance adapters receive already-gathered content
and no Slack, Nango, auth, or database tools. Pipes decode structured output,
verify cited revisions and accepted effects, and enforce the same closed
boundaries regardless of how source text is worded. MCP exposes named product
capabilities, not a generic "run this prompt with Brain access" tool.

## Auth Has Four Separate Trust Bindings

| Binding                      | V1 owner                  | Purpose                                       |
| ---------------------------- | ------------------------- | --------------------------------------------- |
| Human to Maestro             | WorkOS/AuthKit            | User, agency organization, current RBAC       |
| Maestro to Slack             | Nango                     | Provider OAuth, tokens, syncs, actions        |
| Slack human to Maestro human | Maestro verified link     | `(team_id, slack_user_id)` to current user    |
| External agent to one Brain  | Maestro service principal | Client-scoped read-only MCP/API authorization |

Nango does not authenticate Claude Code to Maestro. It authenticates Maestro to
Slack and future source providers. Slack identity is never inferred from an
email address or display name: a signed-in Maestro user completes a short-lived,
single-use link flow that binds the exact Slack team and user IDs. Every Slack
request loads that binding and then resolves current workspace RBAC again.

For V1, a Brain administrator creates a display-once, expiring, revocable,
client-scoped key and copies a ready-to-paste remote MCP configuration. The key
represents a workspace-owned service principal, not the creator's browser
session. Its granted scopes are intersected with a fixed `viewer` role ceiling;
V1 cannot mint write, admin, workflow, or cross-Brain keys. Every call also
checks the Brain and organization status plus the current service-principal and
workspace revocation generations. A Claude Code project can therefore connect
only to the one client Brain it is meant to read.

API-key creation, metadata listing, expiry changes, and revocation are
human-authenticated server capabilities requiring current Brain `admin` access.
The secret is displayed once, only its hash is stored, and a key can never mint
or modify another key. Emergency organization or Brain revocation invalidates
all affected keys without waiting for their individual expiry.

The template already defines hashed, scoped, expiring API keys and constant-time
verification
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/headless/auth.ts#L9-L38),
[source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/headless/auth.ts#L109-L196)).
Those utilities accept caller-supplied workspace/user fields and are not
authenticated CRUD capabilities. Bearer resolution is also not wired into the
HTTP adapter; the current request helper accepts caller workspace identity and
even contains a demo slug map
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/httpRequest.ts#L6-L10),
[source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/httpRequest.ts#L40-L56)).
The template backlog accurately labels the real resolver absent
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/porting-backlog.md#L451-L467)).
Treat authenticated key lifecycle, secure remote MCP transport, and server-owned
tenant injection as launch work, not finished infrastructure.

## Headless Contract

Web, Slack, API, CLI, and MCP must call the same server capabilities. V1 exposes
only the read surface to external agents:

| Operation              | Required scope | Purpose                                     |
| ---------------------- | -------------- | ------------------------------------------- |
| `brain.pages.list`     | `brain:read`   | List the authorized page tree               |
| `brain.pages.get`      | `brain:read`   | Get a current page and citations            |
| `brain.pages.history`  | `brain:read`   | List revision metadata and causation        |
| `brain.sources.search` | `brain:read`   | Search active routed source projections     |
| `brain.sources.get`    | `brain:read`   | Resolve one exact, non-redacted citation    |
| `brain.context.get`    | `brain:read`   | Return bounded context, not an AI answer    |
| `brain.answers.ask`    | `brain:ask`    | Return a cited answer and immutable receipt |

All read responses include `brainKey`, `asOf`, and `freshness`. Generated
answers include `retrievalReceiptKey` and citations to immutable source
revisions. The transport rejects tenant fields in tool arguments. After bearer
authentication it injects the service principal's server-owned workspace and
Brain IDs, resolves current access, verifies the operation's manifest exposure,
and only then dispatches a generated Confect ref.

The template already generates MCP tool descriptors from Confect manifest
metadata
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/manifest/mcp.ts#L17-L25)).
The current Brain contract exposes `createMarkdown` to MCP but keeps `list` web
only
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/brain/pages.spec.ts#L52-L99)),
and the repo has no deployable MCP protocol transport. Extend the manifest and
add one remote Streamable HTTP transport; do not hand-maintain a second tool
registry.

The V1 transport is stateless Streamable HTTP:

- HTTPS `POST /mcp` only; no long-lived server session, resumable stream, or
  cookie authentication;
- a bearer key is required on every request and never accepted in a URL;
- authentication, revocation, rate limiting, and Brain resolution happen before
  tool-argument decoding or execution;
- browser `Origin` is denied unless explicitly allowlisted, CORS is denied by
  default, and no ambient web credentials are accepted;
- MCP protocol version, JSON-RPC envelope, `Accept`/`Content-Type`, body size,
  batch size, timeout, and cancellation are bounded and validated;
- tool names and schemas come only from the reviewed generated manifest;
- token/IP rate limits, request IDs, redacted typed errors, and security headers
  apply to every response; and
- raw authorization headers, tool payloads, customer text, and model prompts are
  never logged.

`GET`, session-resumption, and server-initiated notifications are later only if
a concrete agent use case needs them. Statelessness keeps V1 useful to Claude
Code and similar clients without adding a second session-security system.

## Storage And Git Portability

### V1 Default

Convex is the managed canonical store for source state, routes, pages,
revisions, citations, sync checkpoints, and realtime editor state.

That is a product default, not a permanent public contract. Capabilities speak
in stable keys and domain records. Convex IDs stay inside repository adapters.

### Portable Bundle

An authorized Brain administrator can export deterministically:

```text
manifest.json
pages/<stable-export-path>.md
sources/index.jsonl
citations/index.jsonl
revisions/pages.jsonl
revisions/sources.jsonl
```

The same state at the same revision produces byte-identical files in a stable
sort order. Raw provider tokens and provider payloads are never exported.
Message text export follows the agency's retention/export policy.

Export is one-way in V1. A job pins an authorized Brain revision and lifecycle
generation, excludes or explicitly marks redacted data, aborts if either changes
before publication, writes only a short-lived encrypted artifact, and returns an
expiring download URL. Temporary server artifacts and failed partial bundles are
purged on schedule. The audit receipt records the manifest hash and policy, not
raw exported text. A downloaded copy is outside Maestro's control and the UI
says so plainly.

Production Maestro already has deterministic Markdown page export with stable
paths and link rewriting
([source](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/packages/convex/convex/capabilities/brain/exports.ts#L27-L86)).
The template also has a Markdown/OKF codec and source/citation model
([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/template-core/src/knowledge.ts#L25-L83),
[source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/template-core/src/knowledge.ts#L219-L250)).
Port the production export behavior into the generic codec/capability boundary.

### Honest Git Posture

V1 does not claim that a Git repository is a drop-in replacement for Convex
realtime editing. It provides deterministic export and keeps repository
interfaces storage-neutral. V1 does not read from or write to a customer's Git
repository.

V1.1 may add two explicit modes:

- **Mirror:** Convex remains canonical and commits the portable bundle to an
  agency-owned repository.
- **External-authoritative pages:** Git is canonical for pages; Convex imports
  and reconciles page revisions while retaining the realtime source ledger.

This is safer and more useful than pretending an arbitrary Git folder can
replace realtime tenancy, webhooks, indexing, and editor sync.

## Data Model

Extend the Confect schema with these durable concepts:

| Table/concept                | Tenant columns                    | Essential contract                                                                                                                                                      |
| ---------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `providerConnections`        | `organizationId`                  | Stable connection key, provider, Nango connection ID, `teamId`, `apiAppId`, `botUserId`, connection generation, status; one active Slack connection per organization    |
| `slackIdentityBindings`      | `organizationId`, `userId`        | Verified `teamId + slackUserId`, single-use link receipt, verified/revoked times, binding generation; one active Maestro user per Slack identity in an organization     |
| `sourceChannels`             | `organizationId`, connection key  | Stable channel key, external channel ID, name, shared/private flags, exact-bot membership, capture state; unique by connection generation plus channel ID               |
| `channelRoutingPolicies`     | `organizationId`, channel key     | Immutable epoch; `direct \| classify \| capture_only`; one Direct Brain or finite Classify descriptors; review policy, actor, effective cut, route generation           |
| `channelDeliveryPolicies`    | `organizationId`, channel key     | Immutable audience generation and `capture_only \| requester_private`; Slack Connect is structurally capture-only in V1                                                 |
| `channelSyncStates`          | `organizationId`, channel key     | Separate live/recent/deep cursors, fenced lease generation, retry time, lag, access gap, typed last error                                                               |
| `providerEventReceipts`      | `organizationId`, connection key  | Provider event ID, signature/replay receipt, provider revision/order discriminator, canonical hash, outcome; unique logical observation key                             |
| `sourceArtifacts`            | `organizationId`, channel key     | Stable provider object key, thread key, latest ordered revision pointer, lifecycle state                                                                                |
| `sourceRevisions`            | `organizationId`, source key      | Immutable canonical text/blocks, author/time snapshots, permalink, provider order, observation sequence, hash, tombstone, lifecycle fields                              |
| `sourceUnits`                | `organizationId`, channel key     | Stable thread-or-message key, latest snapshot pointer, assembly generation                                                                                              |
| `sourceUnitRevisions`        | `organizationId`, source-unit key | Immutable content-bearing ordered source-revision snapshot, fixed cut, assembly-policy version, canonical hash                                                          |
| `sourceProcessingJobs`       | `organizationId`, source-unit key | Stage, pinned policy/prompt/model/tool-schema versions, idempotency/effect key, lease and fence generations, attempts, CAS status, retry/error, lifecycle fields        |
| `classificationDecisions`    | `organizationId`, source-unit key | Exactly one nullable `targetBrainKey`, evidence, diagnostic confidence, model receipt, review action/actor; unique accepted decision per unit revision and policy epoch |
| `sourceRoutes`               | `organizationId`, `workspaceId`   | Brain/source-unit revisions, included source revisions, origin, policy epoch, route/revocation generations, active interval, unique logical route effect                |
| `brainPages`                 | `organizationId`, `workspaceId`   | Stable page key, tree/current-revision pointers, archive/favorite state, lifecycle fields; unique stable key and sibling slug within a Brain                            |
| `pageRevisions`              | `organizationId`, `workspaceId`   | Immutable BlockNote/Markdown snapshot, parent, hash, causation, actor/model receipt, publish and lifecycle state                                                        |
| `citations`                  | `organizationId`, `workspaceId`   | Page/answer revision, exact source revision, quote/range/locator, redacted-resolution state                                                                             |
| `workspaceSearchProjections` | `organizationId`, `workspaceId`   | Exact page/source revision, projection version, policy/route/lifecycle generations, searchable text, active/redacted state; unique projection effect                    |
| `retrievalReceipts`          | `organizationId`, `workspaceId`   | Principal, query/filters, immutable candidate/result manifests, generation snapshot, hashes, model receipt, delivery status                                             |
| `apiKeys`                    | `organizationId`, `workspaceId`   | Hashed secret, display prefix, scopes, `viewer` ceiling, service-principal generation, expiry/revocation/last-used metadata                                             |
| `outboundDeliveryOutbox`     | `organizationId`, `workspaceId`   | Requester binding, team/channel/user destination, answer receipt, audience/revocation generations, unique effect key, attempts, Slack timestamp, terminal state         |
| `retentionPoliciesAndJobs`   | `organizationId`                  | Policy epoch, legal holds, affected resource keys, redaction/purge action, fence generation, approvals, receipts, completion state                                      |

Every durable row carries `organizationId`; every Brain-readable row also
carries `workspaceId`, and commits verify that the workspace belongs to that
organization. Public stable keys are unique inside their tenant and resolve to
internal Convex IDs only after authorization. Provider identifiers are unique
only inside the active connection generation. Indexes accelerate lookup but
never constitute an access check.

Every content-bearing or derived row shares a lifecycle envelope:
`active | redacted | purged`, `redactionGeneration`, optional `purgeAfter`, and
optional legal-hold reference. Every asynchronous commit compares its pinned
policy epoch, route/revocation generation, lifecycle generation, and lease fence
to current state. A mismatch produces `superseded` or `revoked`, never a stale
write. Unique effect keys plus compare-and-set completion turn at-least-once
workers into one logical accepted effect.

The organization-scoped vault lets capture begin when the bot joins, before a
routing policy exists. A confirmed Direct policy projects sources into one
workspace mechanically. A confirmed Classify policy pre-authorizes a finite set
of possible targets; a separate model decision selects within that set. Every
client read joins through an active route and re-verifies the caller's workspace
authority. Model output cannot expand or change the policy. A classification
decision stores one nullable target, never an array. The persisted
content-bearing source-unit revision makes every classification and maintenance
call auditable and replayable against the same evidence even after a Slack
thread receives more replies; model output itself is not claimed to be
reproducible.

Production Maestro's source-unit model is useful prior art for separating an
exact source, reviewable evidence, and downstream routing
([model](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/docs/architecture/source-unit-knowledge-model.md),
[schema](https://github.com/modernagencysales/maestro/blob/c8b644c154af91f7e6b67b31861fd6b7eaa211b1/packages/convex/convex/schema/sourceUnits.ts#L85-L140)).
Reuse the separation, not its content-specific unit taxonomy.

## Context OS Principles To Keep

The external Context OS project reports that mandatory taxonomy and ontology
files became unused ceremony, then replaced them with a simpler two-layer,
read-before-act, deposit-after-act model
([source](https://github.com/jacob-dietle/context-os/blob/b31051f5a7837c70b9e5d7b81f8a055801877741/README.md#L11-L29),
[source](https://github.com/jacob-dietle/context-os/blob/b31051f5a7837c70b9e5d7b81f8a055801877741/README.md#L82-L90)).

Keep:

- read existing context before acting;
- durable deposits after useful work;
- citations and linked knowledge;
- a simple lifecycle;
- later usage heat and co-access telemetry.

Do not import:

- mandatory taxonomy/ontology files;
- heavy frontmatter as the canonical schema;
- a filesystem layout as the runtime database;
- an unfinished proprietary CLI as a product dependency.

## Existing Versus Gap Matrix

| Capability                     | What exists now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Truth for this V1                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SaaS UI/Chakra shell           | Real business shell and pinned provider                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Reuse it; simplify navigation and replace the placeholder Brain without adding a second shell                                                                                                                                                                                                                                                                                                                                                        |
| WorkOS/AuthKit web integration | Database-backed user/organization/workspace/access primitives exist, but the root injects fake auth/workspace operations and workspace listing is public/unfiltered ([root](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/apps/web/src/routes/__root.tsx#L45-L66), [query](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/auth/workspaces.impl.ts#L8-L16)) | WP0 must wire real AuthKit identity, organization mapping, authorized provisioning, and server-filtered workspace listing                                                                                                                                                                                                                                                                                                                            |
| RBAC                           | Canonical roles and effective workspace resolution are real ([roles](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/roles.ts#L1-L18), [resolver](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/access/auth.ts#L118-L249))                                                                                                   | Reuse as the only authorization source; migrate every Brain/Slack/headless contract to call it server-side                                                                                                                                                                                                                                                                                                                                           |
| Brain page persistence         | Real Confect list/create persistence and an internal editor snapshot mutation exist, but public contracts still take workspace IDs and have incomplete operations ([contract](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/brain/pages.spec.ts#L16-L99))                                                                                                                                                               | Deliberate stable-key/auth contract migration plus tree/update/archive/history behavior                                                                                                                                                                                                                                                                                                                                                              |
| Client/Brain UI generator      | `template:add-client-domain` emits only domain JSON and a README ([generator](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/generators/src/index.ts#L1086-L1140))                                                                                                                                                                                                                                                                       | The Notion-like Client Brief route is a frontend template gap; do not claim the generator creates it                                                                                                                                                                                                                                                                                                                                                 |
| BlockNote realtime sync        | Reusable Convex ProseMirror editor component ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/editor-react/src/BlockNoteSyncEditor.tsx#L20-L66))                                                                                                                                                                                                                                                                                | Mount it in the Brain surface and add the required RBAC-aware controls                                                                                                                                                                                                                                                                                                                                                                               |
| Page versioning and knowledge  | Tables/types exist, but runtime bodies are fixtures and public specs lack this product's server-derived authorization                                                                                                                                                                                                                                                                                                                                                                                         | Migrate specs and persistence deliberately; this is not a body-only fixture swap ([versioning](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/ops/versioning.impl.ts#L36-L160), [knowledge](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/ops/knowledge.impl.ts#L9-L103)) |
| Data lifecycle                 | Explicit resource planner and DSAR audit handoff                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Real deletion/redaction/retention remains absent and is required for the new source/derived tables ([status](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/docs/template/data-lifecycle.md#L30-L63))                                                                                                                                                                                   |
| Search                         | Provider-neutral deterministic fake/test seam                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Its live contract is synchronous; migrate to async Effect search and add authorized Convex projections before a live adapter ([contract](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/search/src/index.ts#L57-L64))                                                                                                                                                          |
| API keys and HTTP              | Hashing/table/verification primitives plus generated headless metadata                                                                                                                                                                                                                                                                                                                                                                                                                                        | Add authenticated admin CRUD, role ceilings, bearer principal resolution, server-owned workspace injection, and fail-closed dispatch; current HTTP helper accepts caller tenant identity                                                                                                                                                                                                                                                             |
| MCP                            | Tool descriptors generated from Confect manifest                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Add reviewed Brain read operations and a real stateless Streamable HTTP transport; descriptors are not a deployable MCP server                                                                                                                                                                                                                                                                                                                       |
| Slack/Nango                    | Nango supplies auth/proxy, channel/message starting templates, and send actions; the stock message sync processes one channel                                                                                                                                                                                                                                                                                                                                                                                 | Add native Slack Events signature verification, disable auto-join, and add exact binding/membership, independent capture/backfill, identity linking, routing, and requester-private delivery                                                                                                                                                                                                                                                         |
| Workpool                       | `@convex-dev/workpool` is mounted with fixed retry defaults, but enqueue/status/background work are demo seams ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/convex/confect/jobs/workpool.ts#L18-L86))                                                                                                                                                                                                                       | Replace the fixture behavior with fenced, fair, tenant-aware source and cognition work                                                                                                                                                                                                                                                                                                                                                               |
| LLM gateway                    | Provider seam, spend cap, receipts, and fake path; live transport returns placeholder text ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/packages/integrations/src/llm.ts#L167-L248))                                                                                                                                                                                                                                                 | Add real structured transport, schemas, hashes, receipts, malformed-output errors, and eval fixtures                                                                                                                                                                                                                                                                                                                                                 |
| Workflow generator             | Production-target durable graph and public start/status/approve wrappers                                                                                                                                                                                                                                                                                                                                                                                                                                      | Current output exposes control operations to web/API/CLI/MCP ([source](https://github.com/modernagencysales/maestro-template-saas-ui/blob/123adb18c0abfe81fe98dd531c910b6cf493c8dd/tooling/generators/src/index.ts#L1803-L1875))                                                                                                                                                                                                                     | Add an internal-only workflow mode before using it for capture-driven cognition; never expose model-maintenance controls publicly |
| Git portability                | Codec in the template; mature deterministic exporter in Maestro                                                                                                                                                                                                                                                                                                                                                                                                                                               | Port export only; re-import and repository sync remain later                                                                                                                                                                                                                                                                                                                                                                                         |
| Product UI                     | Generic reference dashboard with many routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Ship only Clients, Agency Brain, Connections, Settings, and global Ask/Search                                                                                                                                                                                                                                                                                                                                                                        |

## Implementation Work Packages

Each package follows the repo's required classification vocabulary.

### WP0 — Real Identity, Tenancy, RBAC, And Stable Keys

**Classification:** `template-gap TB-AUTHKIT-01` plus deliberate contract/schema
migrations over the existing access primitives.

- Replace fake root AuthKit and workspace operations with the real server auth
  adapter.
- Map WorkOS users and organizations to exactly one local principal/tenant and
  make workspace provisioning/listing server-authorized.
- Centralize current-principal loading and `viewer | editor | admin | owner`
  enforcement for web, Slack, public Confect, API, and MCP entrypoints.
- Add Brain kind/client metadata and stable public keys with a migration for
  existing workspaces/pages; never expose Convex IDs in new public contracts.
- Migrate existing Brain, versioning, and knowledge specs that accept
  caller-owned workspace identity; declare `Unauthorized`/`Forbidden` failures
  explicitly.
- Pin organization-admin baseline behavior to the existing resolver and the V1
  role matrix rather than creating Brain-specific roles.

Focused gates:

- real AuthKit identity and organization-provisioning integration tests;
- authorized workspace-list and cross-organization denial tests;
- table-driven role matrix tests for every initial Brain capability;
- stable-key migration/uniqueness tests and no-public-Convex-ID checks;
- `pnpm check:auth-demo-bypass`;
- `pnpm check:confect-contracts`;
- `pnpm check:schema-migration-notes`.

### WP1 — Product Shell And Opinionated Client Brief

**Classification:** `pattern-instance` for domain metadata plus
`template-gap TB-BRAIN-UI-01` for the real frontend.

- Run `pnpm template:add-client-domain -- --name clients --write` only for
  `generated/domains/clients/*`; do not claim it scaffolds a route or screen.
- Add a backlog correction for the frontend-route playbook/generator mismatch.
- Keep `/brain`, add the Clients surface through route -> screen -> feature ->
  blocks, and replace the generic placeholder inside the existing SaaS UI shell.
- Mount the existing BlockNote/Convex sync component with viewer read-only and
  editor-or-higher write behavior.
- Ship the standard editable Client Brief, page tree, evidence drawer, history,
  and restore flow; Blank/import/file onboarding remains later.
- Remove non-product routes from visible navigation without deleting reusable
  template packages.
- Promote a reusable split-pane Brain block only after the product instance
  proves the contract.

Focused gates:

- `pnpm --dir apps/web test src/features/clients src/features/brain`;
- role-aware editor/viewer and restore-as-new-revision tests;
- `pnpm check:route-tree`;
- `pnpm check:layer-boundaries`;
- `pnpm smoke:web-static`.

### WP2 — Slack Connection, Source Ledger, Workpool, And Lifecycle

**Classification:** `fixture-to-real` for `jobs/workpool` plus
`template-gap TB-SOURCE-01` and `template-gap TB-SOURCE-LIFECYCLE-01`.

The documented `template:add-source-type` command is not registered. Implement
the first generalized source-ingestion pattern through Confect tables/specs, a
provider-neutral integration interface, and a Nango Slack adapter; promote a
generator only after schema and lifecycle behavior stabilize.

- Add the Nango Connect boundary and pin the native Slack Events raw-signature
  security contract.
- Disable auto-join and implement exact bot membership, organization/connection
  generation binding, channel directory reconciliation, and channel policies.
- Support bulk Direct, Classify, and Capture only policies with finite
  administrator-selected Classify targets and requester-private delivery policy.
- Persist the transport receipt, converged logical observation/source revision,
  and durable assembly intent in one fast transaction and acknowledge before
  downstream work.
- Replace demo workpool behavior with fair per-channel live/recent/deep work,
  independent cursors, fenced leases, typed retries, dead-letter/replay, and
  Slack `Retry-After` handling.
- Implement source artifacts/revisions, content-bearing source-unit snapshots,
  policy epochs, processing jobs, routes, search-projection intents, and
  lifecycle generations.
- Implement real edit/delete/redaction/purge propagation, legal holds, DSAR,
  bot-removal/access-loss handling, and lifecycle receipts across every derived
  resource.
- Expose channel live/history state separately and make the Slack
  Marketplace/rate-class decision explicit before launch promises.

Focused gates:

- native-signature, wrong-team/app/connection, replay-window, rotation, and
  oversized-webhook denial tests;
- source normalization/property, duplicate delivery, `A -> B -> A` revision
  order, edit, delete, and tombstone tests;
- crash-after-capture and stale-lease/policy/revocation fencing tests;
- live/backfill race, cursor resume, removal/re-add, rate-limit, and
  no-starvation tests;
- the full declared capacity fixture with deep backfill active;
- lifecycle propagation tests across snapshots, decisions, routes, pages,
  citations, indexes, jobs, receipts, outbox, and export artifacts;
- `pnpm check:provider-boundary`;
- `pnpm check:logging-boundary`;
- `pnpm check:secret-canaries`.

### WP3 — Structured Cognition, Revisions, And Review

**Classification:** capability `pattern-instance` plus
`template-gap TB-AUTHORIZED-KNOWLEDGE-01`, `template-gap TB-STRUCTURED-LLM-01`,
and `template-gap TB-INTERNAL-WORKFLOW-01`.

- Migrate `ops/versioning` and `ops/knowledge` specs, tables, and bodies
  together to current-principal authorization and real persistence. Do not
  perform a body-only fixture swap.
- Generate cognition capability scaffolds with
  `pnpm template:add-capability -- --name <name> --exposure workflow --write` so
  they never enter API/CLI/MCP metadata; then deliberately migrate their caller
  contract to internal-only execution.
- Do not use the current workflow generator unchanged: it creates public
  web/API/CLI/MCP controls. Add an internal-only generator mode, or implement
  the first internal workflow as a reviewed template gap and promote that
  pattern.
- Implement gather -> classification model -> RBAC review -> route commit and
  gather -> maintenance model -> review/Autopilot gate -> revision commit as
  separately observable steps.
- Upgrade the shared LLM seam to schema-constrained structured requests/results,
  provider-neutral transport, prompt/model/tool-schema versions, usage and
  request/response hashes, and typed malformed-output failures.
- Keep classification zero-or-one, review-first, closed to the pinned allowlist,
  and independent of model confidence. Mixed-client units are mandatory
  `no_route` and cannot be reviewer-overridden in V1. Keep all semantic page/
  evidence choices in model calls and all safety/persistence work in pipes.
- Enforce the prompt-injection and dependency boundaries for classification,
  maintenance, answers, future imports, and MCP.

Focused gates:

- Direct mode makes zero classification calls and capture succeeds with the LLM
  disabled;
- zero-or-one decision schema, out-of-allowlist rejection, reviewed no-route,
  and no confidence-based commit tests;
- stale source/policy/page/revocation generation jobs cannot commit;
- architecture tests pin capture/gather/model/review/commit imports and prove
  cognition operations are absent from web/API/CLI/MCP manifests;
- exact citation, restore-as-new-revision, uncited publication denial, and model
  swap/source-ledger invariance tests;
- multilingual and adversarial prompt-injection fixtures;
- classifier and maintenance semantic eval thresholds from Acceptance Criteria.

### WP4 — Async Search, Ask, Private Slack Delivery, And MCP

**Classification:** public capability `pattern-instance` plus
`template-gap TB-ASYNC-SEARCH-01` and `template-gap TB-HEADLESS-01`.

- Generate only the reviewed public read/Ask capabilities with
  `pnpm template:add-capability -- --name <name> --exposure headless --write`,
  then replace starter tenant args with server-injected principal scope.
- Migrate `packages/search` to an asynchronous Effect contract and implement
  authorized `workspaceSearchProjections` plus a Convex full-text candidate
  provider. Keep vectors optional.
- Build one Ask capability that pins an immutable candidate manifest, returns
  structured citations/receipt or insufficient evidence, and reauthorizes before
  response.
- Add human-authenticated API-key create/list/revoke, `viewer`-ceiling service
  principals, bearer resolution, rate limits, and server-owned workspace
  injection.
- Add the stateless Streamable HTTP MCP transport projected from the same
  generated manifest and a copyable Claude Code configuration per Client Brain.
- Add Slack identity linking, thin Nango-backed mention/DM intake, shared scope
  selection and Ask capabilities, a fenced outbound outbox, and ephemeral/DM
  requester-only delivery. Slack Connect remains capture-only.

Focused gates:

- authorization-before-search and reauthorization-before-response race tests;
- search-projection revocation/redaction and immutable candidate-manifest tests;
- web/Slack/API/MCP capability parity and no surface-local prompt/heuristic
  tests;
- key creation authorization, display-once hashing, role ceiling,
  expired/revoked/wrong-Brain/generation denial tests;
- MCP method/content/protocol/origin/CORS/body/batch/timeout/rate-limit security
  tests and manifest drift checks;
- Slack identity spoofing, unbound user, ambiguous DM, Slack Connect,
  ephemeral-audience, and terminal ambiguous-ephemeral/no-retry tests;
- citation resolution, entailment, insufficient-evidence, and prompt-injection
  evals.

### WP5 — Deterministic Export And Launch Hardening

**Classification:** `template-gap TB-BRAIN-EXPORT-01`, importing proven Maestro
export behavior only.

- Port stable paths, deterministic ordering, Markdown link rewriting, and
  manifest generation from production Maestro.
- Fence export against role, route, and lifecycle changes; apply source-text
  retention/redaction policy and purge short-lived generated artifacts.
- Add sync-health/security alerts, dead-letter operator recovery, spend/rate
  budgets, and redacted launch observability. Weekly digests remain later.
- Run the declared capacity, semantic quality, audience-safety, and pilot-value
  suites; publish their receipts with the release.
- Run `just verify-full` only after every focused gate is green. `just verify`
  alone is not the final release gate.

Focused gates:

- byte-identical repeated-export tests at one pinned revision;
- redacted/deleted source exclusion and export-revocation race tests;
- no Convex IDs, raw provider payloads, or secrets in bundles;
- expiry and purge tests for generated server artifacts;
- `pnpm check:docs-freshness`;
- `pnpm check:secret-canaries`;
- `just verify-full`.

## Acceptance Criteria

### Activation And Product Surface

- A real AuthKit user provisions or joins only their WorkOS-backed agency and
  sees only Brains authorized by current workspace RBAC; the fake demo identity
  path is absent in production.
- An agency administrator connects one Slack workspace through Nango without
  entering a raw token. Accessible regular, private, and Slack Connect channels
  appear with exact-team/app/bot metadata.
- No public channel is joined automatically. Adding the exact `@Maestro` bot
  makes a channel `needs_policy` without another OAuth flow, and exact capture
  begins in the organization vault.
- Bulk channel policy supports Direct, Classify with a non-empty finite
  allowlist, and Capture only. Confirming a first policy processes already
  captured source units without stranding or double-routing them.
- The first Client Brain opens to the editable standard Client Brief. Under the
  launch-supported Slack rate class, its first reviewable cited proposal or
  explicit insufficient-evidence result appears within 15 minutes.
- Customer navigation contains Clients, Agency Brain, Connections, and Settings
  only, plus global Ask/Search. No content generation, campaigns, workflow
  builder, analytics, or connector marketplace appears in V1.

### RBAC, Identity, And Tenant Isolation

- Table-driven tests exercise `viewer | editor | admin | owner` for every web,
  Slack, API, and MCP capability. UI hiding is never the only control.
- Every entrypoint resolves the current organization/workspace role server-side;
  caller-supplied organization, workspace, Brain, user, or Convex IDs are
  rejected as authority.
- Bot membership grants capture only. It never grants a channel member, Slack
  user, API key, or model access to a Client Brain.
- Slack requests require a non-revoked verified `(team_id, slack_user_id)`
  binding and current Brain `viewer` access. Display-name/email spoofing,
  unbound users, ambiguous DMs, and removed members fail closed.
- Only a current Brain `admin` can create/list/revoke a Brain API key. Its
  secret is shown once, stored hashed, and constrained to read/Ask scopes with a
  `viewer` role ceiling.
- User, membership, route, Brain, organization, service-principal, and key
  revocation take effect on the next capability call and fence in-flight
  responses before delivery.
- Cross-client denial events retain redacted audit metadata and never customer
  text. No client read can return an organization-vault-only or inactive-route
  source.

### Multi-Channel Capture And Slack Audience Safety

- Every joined, accessible channel captures live events independently, including
  Capture only channels. There is no first-channel, sampled-channel, or
  shared-cursor behavior.
- Direct and Classify policies affect routing/model work only. Capture only
  keeps exact capture running while suspending both; removing the bot is what
  stops new capture.
- A large or failed deep backfill does not delay another channel's live capture,
  recent backfill, Ask delivery, or reconciliation. Live and history status are
  always shown separately.
- Each channel exposes last live event, lag, recent/deep cursor and progress,
  retry/dead-letter state, access loss, and last redacted typed error.
- Bot removal marks `access_lost`; re-add resumes from the saved cursor,
  reconciles Slack-visible history, and reports unrecoverable gaps rather than
  claiming completeness.
- Slack Connect channels are structurally capture-only for delivery. Internal
  channel answers use `chat.postEphemeral` for the verified requester; DMs go
  only to that requester. V1 never posts a full-Brain answer to a channel.
- The outbound outbox persists audience, authorization generations, and a unique
  effect key before send. An ambiguous ephemeral timeout is terminal and never
  retried; a new requester action creates a new logical answer request. DM retry
  requires a verified provider idempotency/reconciliation contract.

### Verified Webhooks, Deterministic Ledger, And Fencing

- Accepted live events pass Slack native raw-body signature verification,
  timestamp/replay-window, request-size, secret-rotation, exact
  team/app/connection generation, and exact bot-membership checks. Unmatched or
  unverifiable payloads never enter a tenant.
- Repeated event delivery creates one logical observation. A live/backfill race
  creates one logical source revision. A real `A -> B -> A` edit sequence
  retains all three ordered observations, and a deletion appends a tombstone.
- Event receipt, exact source revision, and durable assembly intent commit
  atomically before acknowledgement. A crash immediately afterward cannot lose
  the intent or create two logical downstream effects.
- External/model work may run more than once. Unique effect keys, leases,
  compare-and-set completion, and fence generations permit one accepted route,
  revision, projection, export, or delivery effect.
- A job pinned to an old source-unit revision, policy epoch, page revision,
  route/revocation generation, lifecycle generation, or lease cannot commit and
  becomes `superseded` or `revoked`.
- Slack 429 responses honor `Retry-After` without losing per-channel cursors.
  Provider tokens, authorization headers, raw webhooks, prompts, and customer
  text never appear in product logs.

### Zero Framework Cognition And Classification

- Source capture, edit/delete ordering, dedupe, assembly, checkpointing, and
  Direct routing pass with the LLM disabled. Direct mode makes zero
  classification calls.
- Only an explicitly configured Classify channel invokes classification. Its
  request contains the immutable content-bearing source-unit snapshot and the
  pinned finite allowlist; the adapter cannot fetch other data or use tools.
- The classifier returns zero or exactly one target. An out-of-allowlist target,
  stale snapshot, unresolved evidence quote, malformed result, or multiple
  targets fails structurally.
- Any unit containing evidence assigned to multiple clients is structurally
  forced to `no_route`; review cannot override it in V1.
- Classify is review-first. An organization administrator accepts, changes to a
  different allowed target, or selects no route. Confidence is diagnostic and
  never grants routing, Brain access, or publication.
- A model timeout/outage leaves exact source durable and replayable. Code never
  guesses a fallback target, client, page, or answer through keywords, regexes,
  weighted ranking, synonym tables, or semantic decision trees.
- Valid model output is applied without local reinterpretation. Capture,
  assembly, classification, review, route commit, maintenance, and revision
  commit expose separate attempts, latency, cost, status, and receipts.
- Prompt-injection fixtures in Slack text, pages, questions, model output, and
  MCP arguments cannot change trusted instructions, tenant scope, target set,
  tools, delivery audience, or accepted effects.

### Brain Maintenance And Lifecycle

- A human with the required role can create, rename, nest, edit, archive,
  favorite, and restore a page. Viewers are read-only. Restore creates a new
  revision and never erases prior audit history.
- Every human/model save is inspectable. Every factual model proposal has exact
  source-revision citations; an uncited factual Autopilot revision cannot
  publish.
- Review first is the pilot default. Capture only affects channel routing/model
  work, while Brain Off stops maintenance publication. Model confidence cannot
  enable Autopilot.
- The starter Client Brief pages remain ordinary pages and can be renamed,
  nested, or replaced without breaking citations, search, or maintenance.
- Slack deletion, emergency route revocation, retention expiry, DSAR, Brain
  deletion, and organization deletion propagate to source snapshots, decisions,
  routes, pages, citations, search projections, jobs, retrieval receipts, outbox
  rows, generated exports, and backups according to the lifecycle matrix.
- Current reads/search/model inputs/exports stop exposing revoked or deleted
  text immediately. Later purge or crypto-erasure leaves only approved
  tombstone/hash metadata; citations resolve to a redacted marker. Legal holds
  block purge but not access revocation.

### Retrieval, Semantic Quality, And Surface Parity

- Authorization occurs before candidate retrieval, and current authority plus
  all pinned generations are rechecked immediately before web/MCP return or
  Slack delivery.
- Every Ask receipt pins an immutable manifest of exact candidate revisions,
  projection version, filters, policy/route/lifecycle generations, results, and
  hashes. Citations can resolve only inside that manifest.
- Web, Slack, API, and MCP call the same retrieval/Ask capability. No surface
  has a private prompt, tenant matcher, evidence selector, or fallback
  heuristic.
- Every answer includes resolvable citations, `asOf`, freshness, and a retrieval
  receipt. Insufficient evidence returns a typed abstention rather than model
  memory.
- On a frozen, human-labeled multi-client route set, classification reaches at
  least 90% agreement including no-route examples, 100% of accepted targets stay
  inside the pinned allowlist, and zero cross-client routes are committed.
- On the frozen answer eval, at least 95% of factual claims are entailed by
  their cited source revision, 100% of citation locators resolve or explicitly
  report redaction, and at least 95% of no-evidence questions abstain.
- On the frozen Client Brief maintenance eval, 100% of factual changes are cited
  and at least 80% of proposals are accepted by reviewers without factual
  correction. Scores are reported by model and prompt version, not hidden in a
  single aggregate.
- Adversarial and multilingual evals must pass the same authorization,
  allowlist, abstention, and prompt-injection safety invariants.

### Read-Only MCP And API

- Claude Code or another MCP client connects with one expiring, revocable
  Client-Brain service-principal key and can list/read pages, resolve/search
  sources, get bounded context, and Ask with citations.
- V1 exposes no external capture, page write/restore, workflow control, API-key
  administration, generic prompt execution, or cross-Brain enumeration tool.
- The stateless Streamable HTTP endpoint requires bearer auth on every request,
  rejects tenant fields, has no cookie/session fallback, and passes the declared
  origin/CORS/protocol/body/batch/timeout/rate-limit security fixtures.
- Generated manifest, API, CLI, and MCP schemas stay in sync, and no public
  payload contains a Convex ID.

### Export And Git Portability

- Exporting the same authorized Brain revision twice is byte-identical and uses
  only stable public keys and paths.
- Deleted, revoked, expired, or non-exportable text is excluded or marked
  redacted according to the pinned policy. A lifecycle or access change before
  publication fences the export.
- Generated server artifacts use expiring URLs and are purged on schedule. The
  UI states that already-downloaded copies are outside Maestro's control.
- V1 has no re-import or automatic Git synchronization. Git remains optional;
  built-in history, restore, search, and MCP work without it.

### Capacity, Reliability, And Pilot Value

- The full declared launch-envelope fixture passes with live capture, deep
  history, classification, search projection, and 10 concurrent authorized Ask
  requests active; every channel makes progress. A second lightweight canary
  agency continuously attempts adversarial cross-organization reads, key
  collisions, commits, and deliveries.
- In the synthetic adapter fixture, 95% of live events become visible in the
  source ledger within 60 seconds and one large channel cannot starve another.
  Provider-backed SLAs are published separately by Slack rate class.
- The product blocks or explicitly queues configuration above the verified
  envelope; it never accepts it and silently drops channels, events, or jobs.
- Before general V1 launch, at least five design-partner agencies complete a
  minimum seven-day observation window. Thresholds use exact integer numerators
  with ceiling rounding: at least 80% get an accepted Client Brief proposal, at
  least 70% rate a cited answer useful, at least 50% use Slack or MCP in
  addition to web during week one, median time to first reviewable cited
  proposal or explicit insufficient-evidence result is under 15 minutes, median
  Brain administration stays under ten minutes per active agency per week, and
  each active client averages fewer than two manual Brain-maintenance actions
  per week.
- The pilot has zero cross-client disclosure, Slack audience, key-scope, or
  unverified-webhook incidents. Any such incident blocks launch regardless of
  aggregate adoption scores.

## Success Metrics

- **Activation:** connected Slack + bot added to at least two channels +
  confirmed routing policies + first cited answer.
- **Time to value:** median under 15 minutes.
- **Live freshness:** 95% of joined-and-bound Slack events visible within 60
  seconds, with reconciliation for missed events.
- **Channel coverage:** 100% of joined and policy-configured channels have
  independent health and make fair progress; zero channels are silently skipped.
- **Backfill:** recent and deep progress are measured separately by Slack rate
  class; the UI never reports "synced" while deep history is incomplete.
- **Classification coverage:** 100% of Classify routes stay inside their pinned
  target allowlist, choose no more than one Brain, and retain
  model/policy/review receipts.
- **Answer trust:** at least 95% cited-claim entailment and 95% no-evidence
  abstention on the frozen eval.
- **Maintenance trust:** 100% citation coverage and at least 80% factual
  reviewer acceptance on the frozen Client Brief eval.
- **Isolation:** zero cross-client source disclosures.
- **Autonomy:** fewer than two manual Brain-maintenance actions per active
  client per week.
- **Usefulness:** at least 50% of activated agencies use a second surface (Slack
  or MCP) within the first week.

## Final Product Test

If an agency owner can say the following after one onboarding session, V1 is the
right product:

> "I connected Slack once, added Maestro to the channels I care about, and every
> client Brain stays current. I can see exactly where it came from, and my team
> or any agent can use it without me maintaining another system."

Anything that does not improve that sentence is outside V1.
