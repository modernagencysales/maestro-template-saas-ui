# Client Handoff Packet

Generate a concrete packet with `pnpm template:handoff -- --mode fake --write`
and update it before any client or investor review.

## Status Labels

- `real`: implemented and verified.
- `fake`: deterministic local behavior used for demos and tests.
- `seam`: provider boundary exists; live adapter is pending client setup.
- `planned`: documented but not implemented.

## Checklist

- Commands run and timestamps.
- Hosted URL and deployment target.
- Current template release or upgrade target.
- Selected blueprint.
- Intake status and link to `docs/template/generated/client-intake.md`.
- Provider posture for WorkOS, PostHog, Dodo, email/Postmark, LLM, storage,
  search, notifications, observability, and payments.
- Required secret names, without values.
- Migrations and generated-code steps.
- Live-provider swaps still required.
- Known seams and planned work.
- Security notes, including auth, tenancy, CSP, webhook verification, redaction,
  and secret handling.
- Data lifecycle notes for retention, export, delete, and audit.
- Verification evidence: tests, static gates, hosted smoke, visual smoke, and
  reviewer readiness.

## Rules

- Never include secret values, customer data, raw provider payloads, or private
  transcripts.
- Keep fake-mode claims explicit.
- Link the implementation brief, generated intake brief, env manifest, upgrade
  report, and release notes.
