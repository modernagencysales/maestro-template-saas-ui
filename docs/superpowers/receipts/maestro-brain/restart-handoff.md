# Maestro Brain Planning Restart Handoff

**Created:** 2026-07-14

**Status:** superseded/completed; retained as restart history

**Purpose:** durable handoff from `lappy` to the `headless` tmux session while
the local computer restarts.

## Active Objective

Finish and validate the exhaustive implementation plan at:

`docs/superpowers/plans/2026-07-14-maestro-brain-agency-context-os-implementation-plan.md`

The approved source specification is:

`docs/superpowers/specs/2026-07-14-maestro-brain-agency-context-os-design.md`

This is a planning/documentation task only. Do not begin product implementation.

## Completed State

- The canonical design and implementation plan were completed and then revised
  after three additional independent structural, security/lifecycle, and
  verification/release audits.
- Fifteen implementation stacks and fifty-six task packets now run through S14.
- Appendices A-N are present, including the corrected durable state machines,
  lifecycle/negative matrices, reproducible eval/capacity contract, migration/
  release evidence, requirement ledger, task audit, and Definition of Done.
- The revision adds pre-data staging/production isolation, native Slack Events
  verification, separate transport/logical observation identity, mandatory
  mixed-client no-route, same-epoch thread segments, immediate whole-page
  revocation, terminal ambiguous-ephemeral delivery, exact pilot metrics, and a
  product-release versus attestation evidence contract.
- This handoff is historical; the canonical design and plan are authoritative.

## Non-Negotiable Decisions

- Use `maestro-template-saas-ui`, not another Maestro fork.
- Reuse exact roles `viewer | editor | admin | owner`.
- Convex Codex plugin install on all three working computers is implementation
  gate S00-T01: `codex plugin add convex@openai-curated`.
- Deterministic pipes and model cognition stay separate under ZFC.
- One agency Slack connection; multiple explicitly joined channels are
  mandatory; no auto-join or one-channel sampling.
- Nango owns OAuth/token refresh/API proxy/history/actions; Maestro owns the
  native signed Events receiver, exact capture, cursors, routing, lifecycle, and
  delivery authorization.
- Slack Connect may ingest through Direct or Classify, but its delivery policy
  is capture-only. Internal Slack answers are requester-private; channel
  membership never grants full-Brain read access.
- Classify is review-first and chooses zero or exactly one Brain from a finite
  human-selected allowlist.
- External API/MCP is read-only and one-Brain-scoped.
- Analytics/connectors, file ingestion, re-import, Git sync, write MCP, weekly
  digests, and content generation are later.
- Every slice is classified as `fixture-to-real`, `pattern-instance`, or
  `template-gap`; maximum 300 changed source lines and four slices per stack.
- Keep one canonical Markdown plan. Generate temporary stack JSON immediately
  before implementation only.

## Existing Review Context

Six independent reviews were incorporated across the original and post-restart
passes. Their most important corrections were: real auth/tenancy first; stable
keys before public contracts; capture-only Slack Connect; immutable
content-bearing snapshots before model classification; one committed effect over
at-least-once attempts; total ordering/fencing for edits and stale jobs;
lifecycle propagation across raw and derived copies; server-derived tenant
authorization; signed/replay-safe webhook binding; current-role reauthorization
before Slack/API/MCP delivery; async workspace-scoped search projections; and
stateless bearer-authenticated MCP.

Do not spawn new reviewers unless the user explicitly asks again.

## Repo Rules

- Read `/Users/headless/.codex/RTK.md`, repo `AGENTS.md`, and
  `.claude/skills/planning/SKILL.md` before editing.
- Prefix every shell command with `rtk`.
- Use `apply_patch` for edits.
- Preserve unrelated work and generated files.
- Do not hand-edit Confect/Convex generated files.
- Do not claim a gate passed without exact output.

## Required Final Validation

Run from the repo root:

```bash
rtk pnpm exec prettier --write docs/superpowers/plans/2026-07-14-maestro-brain-agency-context-os-implementation-plan.md docs/superpowers/specs/2026-07-14-maestro-brain-agency-context-os-design.md docs/superpowers/receipts/maestro-brain/restart-handoff.md
rtk pnpm exec prettier --check docs/superpowers/plans/2026-07-14-maestro-brain-agency-context-os-implementation-plan.md docs/superpowers/specs/2026-07-14-maestro-brain-agency-context-os-design.md docs/superpowers/receipts/maestro-brain/restart-handoff.md
rtk pnpm check:docs-freshness
rtk git diff --check
rtk just verify-full
rtk git status --short
```

Commit only the three documentation files above unless the user explicitly
changes scope. Push the active branch so the local machine can resume from it
after restart.
