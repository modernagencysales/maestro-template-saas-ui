# App Idea Evaluator Funnel Design

Date: 2026-07-31

Status: approved design awaiting written-spec review

## Summary

Build a public acquisition and conversion funnel for nontechnical people who
have an app idea but do not know whether it is good or what it will take to
build. The free experience evaluates the idea, constructively roasts its weak
points, improves it, and produces a useful Buildability Report. A paid Complete
Build Pack turns the evaluated idea into an implementation-grade deliverable for
a developer, agency, coding agent, or Maestro-based build.

The core promise is:

> Tell me if my idea is good. Know what it will take.

The product boundary is:

> Free: Should I build this?

> Paid: Exactly how should I build it?

The first payment purchases the Complete Build Pack. That payment becomes a
credit toward a later Maestro template purchase.

## Purpose And Success Criteria

The funnel succeeds when it gives a nontechnical founder an honest, concrete
answer without requiring them to understand product-management or software
architecture terminology, and when qualified founders can pay to turn that
answer into an actionable build plan.

The launch must prove the complete journey:

1. A visitor starts from a public landing page.
2. The visitor describes an app idea and answers adaptive follow-up questions.
3. The system produces a useful free evaluation at a bounded model cost.
4. The visitor can save, resume, revise, download, and share the free report.
5. The visitor can purchase a Complete Build Pack.
6. A verified payment grants the correct entitlement exactly once.
7. The premium pipeline produces a resumable, versioned Build Pack.
8. Qualified reports receive an honest Maestro mapping and offer.
9. Product analytics show conversion and unit economics without exposing idea
   contents or sensitive report data.

## Scope Guard

This design includes the acquisition page, free evaluation, free report,
identity-by-verified-email, report persistence, sharing, checkout, payment
entitlement, premium generation, downloads, report library, Maestro mapping,
transactional email, analytics, cost controls, and support/admin visibility
required to operate the funnel.

It does not turn the public evaluator into a general-purpose chat product. It
does not add unrelated functionality to the existing internal reference-app
routes. It does not promise market success, legal advice, guaranteed costs, or
automatic production deployment. It does not require live auth for the first
anonymous evaluation, and it does not expose provider SDKs or secrets to the
browser.

The existing internal template dashboard remains separate from the public
funnel. Shared UI primitives and provider seams may be reused, but public funnel
routes use their own product language and navigation.

## Audience

The primary customer is nontechnical, has an app idea, and is considering an AI
builder, freelancer, agency, or coding agent. They do not want an MCP server,
architecture review, or generic specification generator. They want to know:

- Is the idea good enough to pursue?
- What is weak or unclear?
- How could it be better?
- What is the smallest useful version?
- What will it take to build?
- What should I do next?

## Product Principles

### Honest before promotional

The free verdict is never blurred or withheld. Maestro is recommended only when
the idea is sufficiently clear and the template is a credible fit. Poor ideas
are improved and reevaluated rather than pushed directly to checkout.

### Constructive roast

The product speaks like a sharp, experienced friend who wants the customer to
succeed. Each roast must:

1. Say the uncomfortable thing.
2. Explain why it matters.
3. Show how to improve it.
4. Give one concrete next move.

Humor is limited to low-stakes evaluation and onboarding copy. Errors, payments,
privacy, lost work, safety, and destructive actions remain calm and literal.

### Cheap free evaluation, materially better paid output

The free experience is a bounded evaluator, not an autonomous research agent.
The paid experience is different in evidence, reasoning depth, artifact quality,
and implementation detail, not merely longer prose.

### Deterministic truth around model judgment

Models extract, question, critique, rewrite, and explain. Versioned schemas,
rubrics, entitlements, state machines, cost limits, and validation determine
what is accepted and what the product may claim.

## Funnel

```text
Landing
  -> Start evaluation
  -> Describe idea
  -> Adaptive intake
  -> Free evaluation
  -> Email verification and saved report
  -> Free report / revise / share
  -> Complete Build Pack preview
  -> Checkout
  -> Verified webhook entitlement
  -> Premium generation
  -> Build Pack / downloads
  -> Maestro fit and offer
  -> Template purchase or implementation handoff
```

The main measurement path is:

```text
landing_viewed
  -> evaluation_started
  -> evaluation_completed
  -> email_verified
  -> free_report_viewed
  -> checkout_started
  -> build_pack_purchased
  -> build_pack_completed
  -> maestro_offer_viewed
  -> maestro_purchased
```

## Public Information Architecture

The public funnel contains:

- `/`: landing page and sample verdicts;
- `/evaluate`: conversational intake and progress;
- `/evaluate/:evaluationId`: resumable intake;
- `/report/:reportId`: private free report and revision actions;
- `/share/:shareToken`: revocable, redacted share view;
- `/checkout/:reportId`: offer summary and checkout initiation;
- `/checkout/return`: payment return and webhook-pending recovery;
- `/build-pack/:packId/generating`: resumable premium progress;
- `/build-pack/:packId`: premium viewer and downloads;
- `/library`: verified-email report and Build Pack history;
- `/maestro/:packId`: personalized Maestro mapping and offer;
- `/privacy`, `/terms`, and `/support`.

Public pages use a focused shell rather than the internal workspace sidebar.

## Landing Page

The hero leads with:

> Tell me if your app idea is good.

> Know what it will take to build it.

Supporting copy:

> Get an honest evaluation, a constructive roast, and a clearer version of your
> idea. Free.

Primary action:

> Roast my app idea

The page demonstrates concrete sample results, the constructive nature of the
roast, what the free report contains, and the boundary between free evaluation
and paid implementation planning. It does not lead with models, agents, MCP,
specifications, architecture, or infrastructure lock-in.

## Guided Intake

The intake captures:

- idea in the founder's own words;
- intended customer;
- painful problem;
- current workaround or alternative;
- proposed solution;
- reason a customer would switch;
- acquisition or distribution path;
- monetization expectation;
- founder advantage;
- required integrations and data;
- budget and desired launch timing;
- sensitive-data or regulated-domain indicators.

The conversation shows progress and asks one clear question at a time. The
system does not ask a fixed questionnaire when an answer already supplies the
information. It asks follow-ups only for missing high-impact rubric evidence, up
to a configured maximum.

Anonymous progress is stored against an opaque session identifier. The browser
stores only the opaque identifier, never model credentials or authoritative
entitlement state.

## Evaluation Rubric

The free verdict is derived from a versioned rubric. Each dimension has a score,
confidence, supporting answer references, and an explanation:

- customer specificity;
- problem severity;
- problem frequency;
- evidence of existing effort or spend;
- solution clarity;
- meaningful differentiation;
- version-one feasibility;
- distribution credibility;
- monetization credibility;
- founder advantage;
- operational and regulatory risk;
- Maestro/template fit.

The overall score is a deterministic weighted projection of validated dimension
scores. The model may propose scores and evidence, but the server validates
ranges, required evidence, contradictions, and rubric version before publishing
a result.

Verdicts are selected deterministically from score patterns rather than from a
free-form model label. Supported launch verdicts are:

- `worth-testing`;
- `promising-but-blurry`;
- `strong-problem-weak-solution`;
- `good-product-unclear-distribution`;
- `feature-rather-than-business`;
- `crowded-but-winnable`;
- `too-expensive-for-version-one`;
- `needs-a-different-customer`;
- `do-not-build-yet`.

The report explains uncertainty and never represents a score as a prediction of
commercial success.

## Free Model Policy

The free policy uses the existing OpenRouter-compatible gateway with a separate
configurable model identifier, strict token limits, and explicit spend
accounting. It is designed to remain provider- and model-portable.

The default free workflow permits:

1. One structured extraction call after the initial idea.
2. Up to the configured number of short follow-up turns.
3. One structured evaluation call.
4. One bounded report-composition call when deterministic templates alone are
   insufficient.

It does not permit web research, tool calls, open-ended agent loops, multi-agent
execution, arbitrary file generation, or premium sections.

Free output is schema-constrained. Invalid output is repaired once with a small
correction prompt; a second invalid result returns a recoverable error and
preserves the intake.

Cost controls include:

- `LLM_FREE_MODEL` separate from the premium model;
- per-call input and output token ceilings;
- per-evaluation call ceiling;
- per-session and per-verified-email evaluation allowance;
- IP/device abuse signals without treating IP as identity;
- daily free-tier spend cap and kill switch;
- usage receipts attached to the evaluation;
- deterministic fake mode for development and tests.

The product records actual provider usage when available and a conservative
estimate otherwise. Marketing copy never depends on a specific model name.

## Free Buildability Report

Every completed free evaluation includes:

- verdict and overall score;
- dimension scores with evidence and confidence;
- constructive one-paragraph roast;
- strongest element;
- biggest weakness;
- rewritten stronger version of the idea;
- ideal first customer;
- smallest version worth testing;
- essential screens and primary workflow;
- likely complexity and cost band with assumptions;
- three biggest traps;
- seven-day validation experiment;
- three questions to answer before building;
- plain-language explanation of what it will take;
- recommended next path: validate, revise, AI builder, developer/agency, coding
  agent, or Maestro.

The report supports loading, generation-in-progress, ready/read, revision,
revision failure, share, download, and expired/revoked states.

The share card contains a redacted summary such as:

> Your app idea scored 72/100
>
> Verdict: Good product, unclear distribution
>
> Brutal truth: You know what to build, but not how customers will find it.

Users choose whether to create a share link. Idea content is private by default.
Share links are opaque, revocable, and exclude intake answers, personal data,
payment data, internal receipts, and sensitive-risk notes.

## Identity And Saving

An anonymous visitor may complete one evaluation without creating an account.
Email verification is required to save across devices, revise beyond the
anonymous allowance, download durable artifacts, purchase, or access the
library.

The email flow uses a single-use, expiring verification link. Verification
claims the anonymous evaluation idempotently. The implementation may later
replace this seam with WorkOS without changing evaluation ownership contracts.

## Conversion And Offer

The free report shows a useful preview of the premium gap:

> You know whether this is worth pursuing. Now find out exactly what should be
> built.

Available actions are:

- `Keep my free app map`;
- `Get the complete Build Pack`;
- `Start building with Maestro` when fit requirements are satisfied;
- `Improve and evaluate again` when the idea is not ready.

The premium preview names exclusive sections and shows representative artifact
structure without fabricating locked content before it is generated.

## Checkout And Entitlement

Dodo is the checkout and webhook provider behind the existing billing seam. The
server creates checkout sessions; the browser never receives the provider API
key. A successful return page is not authoritative proof of purchase.

The verified, idempotent webhook grants:

- one Complete Build Pack entitlement for the report;
- a recorded Maestro credit equal to the eligible purchase amount;
- the right to resume or regenerate failed premium stages without repurchase.

Webhook event ids and dedupe keys prevent duplicate grants. A payment return
whose webhook has not arrived displays a pending state, polls boundedly, and
offers recovery rather than claiming failure or granting access prematurely.

Refund, dispute, and revocation events update entitlement status without
deleting previously generated audit evidence. Download policy after revocation
is explicit and enforced server-side.

## Premium Model Policy And Pipeline

The premium policy uses `LLM_PREMIUM_MODEL`, larger but bounded context and
completion budgets, and multiple checkpointed stages. Provider choices remain
configurable through the gateway and allowlist.

Stages are:

1. **Normalize**: compile the approved intake and free evaluation into a
   canonical product brief.
2. **Challenge**: identify unsupported assumptions, contradictions, and fatal
   risks.
3. **Research**: investigate current alternatives, competitors, and publicly
   supportable demand signals with citations when research is enabled.
4. **Design**: define the smallest credible product, screens, workflows, data,
   integrations, approvals, and exclusions.
5. **Specify**: write implementation-grade requirements and acceptance criteria.
6. **Review**: check completeness, consistency, feasibility, unsafe claims, and
   missing application states.
7. **Compile**: produce one versioned Build Pack and export artifacts.
8. **Map to Maestro**: project the approved pack onto template patterns and
   identify gaps honestly.

Each stage has typed input, typed output, model receipt, prompt-policy version,
cost record, status, attempt count, and failure. Completed stages are immutable
inputs to later stages for that version. Retrying a failed stage does not rerun
completed stages unless the user creates a new Build Pack version.

Premium generation has a per-pack spend cap, global daily cap, timeout, retry
policy, provider kill switch, and operator-visible failure reason. If a paid
pack cannot complete automatically, the customer's entitlement remains active
and support can resume it.

## Complete Build Pack

The paid deliverable contains:

- executive product brief;
- refined positioning;
- target customer and problem definition;
- alternatives and competitor analysis with citations when researched;
- assumptions and evidence quality;
- version-one scope;
- explicit exclusions;
- screen inventory;
- user journeys;
- workflows and business rules;
- data model and data lifecycle;
- integrations and provider posture;
- permissions and human approvals;
- loading, empty, ready/read, ready/edit, skipped, success, typed failure, and
  transport failure states where applicable;
- security, privacy, billing, and regulatory considerations;
- acceptance criteria;
- phased implementation roadmap;
- cost and complexity drivers;
- agency briefing;
- coding-agent kickoff prompt;
- unresolved decisions;
- Maestro implementation mapping.

The web viewer presents sections as readable product documentation. Exports
include Markdown and a print-ready HTML/PDF path. Export generation is
deterministic from the stored Build Pack document rather than another model
call.

## Maestro Mapping

A Maestro mapping includes:

- recommended blueprint;
- domain nouns;
- first capability;
- first workflow;
- first agent and grants when needed;
- required and optional providers;
- fake-first development posture;
- public and headless surfaces;
- generator-backed work packages;
- fixture-to-real replacements;
- template gaps and resolution paths;
- focused validation gates;
- template-fit score and explanation;
- personalized project-start instructions;
- coding-agent handoff prompt.

The mapping follows the repo's planning vocabulary:

- `pattern-instance` for generator-backed known shapes;
- `fixture-to-real` for existing contract bodies that need production
  persistence or providers;
- `template-gap` for missing patterns that need a backlog reference and
  promotion/import path.

The system must not label planned blueprints as implemented or imply that a
generated scaffold is a completed production app.

## Domain Boundaries

The implementation is divided into independently testable units:

### Evaluation domain

Owns anonymous sessions, intake answers, rubric versions, scores, verdicts, free
reports, revisions, and report state transitions.

### Model orchestration domain

Owns tier-specific model policy, structured calls, receipts, prompt versions,
cost caps, stage execution, retry rules, and provider failures. It does not own
checkout or UI state.

### Identity domain

Owns verification challenges and ownership claims. It does not infer payment
entitlements from email possession.

### Commerce domain

Owns checkout sessions, webhook verification, purchases, refunds, Maestro
credits, and entitlements. It does not generate reports.

### Build Pack domain

Owns premium stage checkpoints, versioned pack documents, exports, and Maestro
mappings. It requires an active entitlement to start or access paid content.

### Sharing domain

Owns redacted snapshots, opaque share tokens, expiry, and revocation. It never
serves the mutable private report directly.

### Lifecycle domain

Owns transactional notifications and funnel analytics events. Analytics payloads
contain ids, states, dimensions, and numeric summaries, not raw idea or report
text.

## Data Model

The durable model includes focused tables or equivalent owners for:

- `evaluationSessions`;
- `evaluationAnswers`;
- `evaluationRubricVersions`;
- `evaluationReports`;
- `evaluationReportVersions`;
- `emailVerificationChallenges`;
- `reportOwnerships`;
- `reportShareSnapshots`;
- `checkoutSessions`;
- `purchases`;
- `buildPackEntitlements`;
- `maestroCredits`;
- `buildPacks`;
- `buildPackStages`;
- `buildPackExports`;
- `modelReceipts` or references to the existing receipt owner;
- `funnelEvents` or approved PostHog event projection;
- `supportIncidents` for paid-generation recovery.

Tables use workspace or public-funnel ownership boundaries as appropriate,
indexed opaque identifiers, server timestamps, idempotency keys, and explicit
status literals. Raw webhook payloads, secrets, and unrestricted model prompts
are not persisted.

## State Machines

Evaluation status:

```text
draft -> collecting -> ready-to-evaluate -> evaluating -> completed
                                      |-> failed-recoverable
completed -> revising -> completed
```

Purchase status:

```text
created -> checkout-open -> payment-pending -> paid
                                     |-> failed
paid -> refunded | disputed
```

Build Pack status:

```text
not-started -> queued -> running -> completed
                           |-> failed-recoverable
                           |-> needs-support
completed -> superseded-by-new-version
```

Transitions are validated server-side. Client routes render state; they do not
invent it.

## Security, Privacy, And Safety

- Treat all idea and research text as untrusted data, never as model or tool
  instructions.
- Separate system policy, trusted report context, user text, and tool results.
- Validate every model result against an Effect schema before persistence.
- Allowlist premium research tools and destinations.
- Do not allow model output to initiate checkout, grant entitlement, send email,
  publish a share link, or start Maestro generation without a typed server
  action.
- Redact provider payloads and never log full idea/report bodies by default.
- Encrypt or provider-protect sensitive durable content according to the
  deployment posture.
- Support report deletion and share revocation while retaining minimal billing
  and audit records required for reconciliation.
- Rate-limit anonymous evaluation, verification requests, revisions, checkout
  creation, and generation retries.
- Add bot protection only when measured abuse requires it; preserve an
  accessible fallback.
- Refuse or safely redirect prohibited, harmful, or clearly illegal app ideas.
- Present legal, medical, financial, safety-critical, and regulated-domain
  uncertainty plainly.

## Error And Recovery Design

User-facing errors say what happened and what to do next. They contain no
provider names unless that information helps recovery.

Required recoveries include:

- invalid or contradictory intake: point to the answer that needs clarification;
- interrupted anonymous session: restore from the opaque session id;
- model timeout or rate limit: preserve answers and allow a bounded retry;
- invalid model schema: repair once, then return a recoverable generation
  failure;
- free spend cap reached: keep the draft and provide an honest availability
  message;
- expired verification link: issue a new link without losing the report;
- duplicate submission: return the existing idempotent operation;
- checkout creation failure: retain the report and allow retry;
- webhook delay: show payment-pending and reconcile asynchronously;
- duplicate webhook: acknowledge without duplicate entitlement;
- premium stage failure: resume from the failed checkpoint;
- entitlement inconsistency: deny paid access safely and create a support
  incident;
- export failure: preserve the completed pack and regenerate the export only;
- expired or revoked share link: explain that the owner disabled access.

## Analytics And Unit Economics

Capture the funnel events named earlier plus:

- question reached and abandoned;
- evaluation duration;
- model-call count and estimated/actual cost;
- rubric and verdict distribution;
- free report revision rate;
- share creation and view rate;
- premium preview engagement;
- checkout failure and webhook latency;
- premium stage duration, retries, and cost;
- export usage;
- Maestro-fit distribution;
- conversion by verdict and template-fit band;
- refund, dispute, and support-recovery rate.

Never capture raw idea text, answers, roast text, report sections, email
addresses, payment details, prompt bodies, or model outputs in PostHog.

Operational dashboards must make free cost per completed report, paid gross
margin, generation success rate, and funnel conversion visible.

## Quality Targets

- A nontechnical visitor can understand the promise and start without learning
  product jargon.
- The free report is useful without payment and never hides its verdict.
- The roast is specific, evidenced, constructive, and non-abusive.
- Identical validated score patterns produce the same verdict.
- Free usage has a hard bounded maximum cost per evaluation.
- Paid generation cannot begin without an active entitlement.
- Payment webhooks and all generation stages are idempotent.
- A paid generation failure never requires repurchase.
- The customer can resume every long-running state.
- The product never claims researched evidence without citations.
- The Maestro recommendation is conditional and identifies template gaps.
- All user-facing routes work with keyboard and screen reader navigation and
  provide visible focus, labeled fields, announced errors, and meaningful
  progress states.
- Responsive layouts preserve reading order and actions at narrow widths.

## Test Plan

### Landing and navigation

- Hero and primary action use approved language.
- Public shell excludes internal workspace navigation.
- Sample verdicts do not expose real customer data.
- Keyboard, focus order, landmarks, headings, and reduced-motion behavior pass.

### Intake behavior

- Loading state restores a saved session.
- Empty state starts with one clear idea prompt.
- Ready/read state shows prior answers and progress.
- Ready/edit state permits correction without losing later valid answers.
- Adaptive questions skip already-satisfied evidence.
- Contradictory answers request specific clarification.
- Network and model failures preserve all accepted answers.
- Completion advances only when required rubric evidence exists.

### Free evaluation

- Rubric weighting and verdict mapping use property-based boundary tests.
- Model output cannot bypass schema or deterministic verdict selection.
- Every verdict has a constructive report fixture.
- Roast fixtures satisfy uncomfortable-point, reason, improvement, and next move
  requirements.
- Free policy enforces call, token, retry, and spend ceilings.
- Prompt-injection fixtures remain data and cannot change policy.
- Fake mode is deterministic and requires no secrets.

### Free report

- Generation-in-progress, ready/read, ready/edit, expired, and recoverable error
  states render.
- Revision success creates a new version without mutating the prior version.
- Revision failure retains the current report.
- Share creation is explicit and excludes private fields.
- Share revocation and expiry deny access.
- Download contains the same canonical report content as the web view.

### Identity

- Verification links are single-use and expire.
- Resend invalidates or supersedes the intended challenge safely.
- Anonymous report claim is idempotent.
- One user cannot claim another opaque report without the valid challenge.

### Checkout and commerce

- Checkout success, cancellation, provider failure, and retry render.
- Return URLs do not grant entitlement.
- Valid signed webhook grants once.
- Invalid signature grants nothing.
- Duplicate webhook grants nothing additional.
- Refund and dispute transitions update access according to policy.
- Delayed webhook shows and resolves the pending state.
- Maestro credit equals the eligible recorded purchase amount.

### Premium pipeline

- Unauthorized and unentitled starts fail with typed errors.
- Each stage validates its input and output.
- Completed stages are not rerun after a later failure.
- Retry resumes the failed stage.
- Spend-cap and provider-limit failures are recoverable.
- Review detects missing loading, empty, read, edit, success, and failure
  states.
- Research claims without citations fail compilation.
- Compile output is internally consistent across scope, screens, workflows,
  data, and acceptance criteria.
- New versions preserve earlier packs and exports.

### Maestro mapping

- Implemented blueprints are distinguished from planned blueprints.
- Work packages are valid `pattern-instance`, `fixture-to-real`, or
  `template-gap` records.
- Pattern instances name generator commands and focused gates.
- Template gaps name a resolution path and do not masquerade as supported
  output.
- Low-fit reports do not receive a misleading primary Maestro recommendation.

### Analytics and privacy

- Required events fire once across success and failure flows.
- Event schemas reject raw idea, answer, report, prompt, model-output, email,
  and payment fields.
- Analytics remain disabled without consent where required by product policy.

### End-to-end journeys

- Anonymous visitor completes and views a free report.
- Visitor verifies email, resumes, revises, downloads, and shares.
- Visitor purchases, waits through webhook delay, and receives one entitlement.
- Premium generation fails mid-pipeline, resumes, and completes without
  repurchase.
- Customer downloads the pack and views an honest Maestro mapping.
- Refund or revocation updates access and support state correctly.

## Rollout

### Slice 1: Free evaluator

Ship the public shell, landing page, intake domain, bounded free model policy,
rubric, verdict, and free report. Use fake billing and no premium generation.

### Slice 2: Identity, persistence, sharing, and analytics

Add email verification, cross-device library, revision history, redacted share
snapshots, downloads, funnel events, and cost dashboards.

### Slice 3: Checkout and entitlement

Promote the Dodo seam to live checkout and signed webhook handling, with
payment-pending recovery and Build Pack entitlements.

### Slice 4: Complete Build Pack

Add checkpointed premium stages, research citations, versioned pack viewer,
exports, retry/support recovery, and premium unit economics.

### Slice 5: Maestro conversion

Add template-fit scoring, blueprint mapping, generator-backed work packages,
template credit, personalized handoff, and the Maestro offer.

### Slice 6: Operational hardening

Add measured abuse defenses, support/admin tools, refund/dispute handling,
retention/deletion operations, accessibility audit, visual regression coverage,
and production launch verification.

Each slice must keep earlier journeys operational and pass focused gates before
the next slice begins.

## Architecture Fit With The Existing Template

The repo already provides reusable foundations:

- TanStack Start public routing and a deployed web app;
- Confect/Convex typed contracts and durable data;
- Effect schemas, typed errors, and provider layers;
- OpenRouter-compatible LLM gateway with redaction and spend caps;
- Dodo-shaped checkout, webhook, usage, credit, and entitlement seams;
- PostHog consent and provider seam;
- MailerSend fake-first notifications;
- UI primitives for AI state, receipts, policies, and progress;
- generator-backed work and plan-shape validation.

The funnel should extend those contracts rather than create a parallel backend
or a second provider framework. Existing contract fixtures may be replaced with
production implementations where appropriate, while customer-specific evaluation
and Build Pack behavior remains a focused product layer rather than generic
template-core assumptions.

## Decisions

1. The free product is genuinely useful and does not blur the verdict.
2. The free agent is a bounded evaluator using a low-cost configurable model.
3. The paid Build Pack uses stronger checkpointed model stages.
4. The first payment buys the Build Pack and becomes Maestro credit.
5. Email verification is the initial identity seam; anonymous evaluation is
   allowed.
6. Dodo is the payment provider behind server-owned checkout and verified
   webhooks.
7. OpenRouter remains the model gateway with separate free and premium model
   policies.
8. Reports, packs, stages, receipts, and exports are versioned and resumable.
9. Maestro recommendations are conditional, evidence-based, and honest about
   template gaps.
10. The public funnel is visually and navigationally separate from the internal
    reference workspace.

## Preserved Language

The approved source language is maintained in
`docs/design-intake/2026-07-31-app-idea-evaluator-language-bank.md`. Product
copy work should draw from that bank and preserve quoted phrases unless a later
decision explicitly replaces them.
