# App idea evaluator persistence migration

## Scope

Adds durable anonymous evaluation sessions, answer evidence, versioned free
reports, checkout state, paid Build Pack entitlements, checkpointed Build Pack
stages, exports, Maestro credits, and support incidents.

## Additive tables

- `evaluationSessions`: opaque-session ownership, current state, cost counters,
  timestamps, and optional verified account owner.
- `evaluationAnswers`: one answer per session/question with revision timestamps.
- `evaluationReports`: current report pointer and ownership state.
- `evaluationReportVersions`: append-only report snapshots and rubric version.
- `emailVerificationChallenges`: expiring, single-use hashed tokens bound to a
  report and hashed email identity.
- `reportOwnerships`: verified report claims keyed by hashed opaque owner token
  for cross-device library access.
- `evaluationShares`: revocable public snapshot tokens. Private answers are
  never copied into a share snapshot.
- `checkoutSessions`: provider checkout identity and payment-pending state.
- `purchases`: normalized webhook-confirmed purchase lifecycle.
- `buildPackEntitlements`: active or revoked access derived only from verified
  provider webhooks.
- `maestroCredits`: append-only credit equal to the eligible first Build Pack
  purchase amount.
- `buildPacks`: canonical paid artifact and source report version.
- `buildPackStages`: immutable completed stage outputs and recoverable attempts.
- `buildPackExports`: deterministic export metadata.
- `supportIncidents`: resumable paid-generation escalation state.

## Indexes and invariants

- Session access tokens are stored as SHA-256 hashes and compared after hashing.
- `evaluationAnswers` is unique by session and question.
- Report versions are append-only and indexed by report/version.
- Verification tokens and owner-access tokens are never stored in plaintext;
  consuming a verification challenge is an idempotent, single-use transition.
- Provider webhook IDs and purchase IDs are unique idempotency boundaries.
- Checkout return URLs never create a purchase or entitlement.
- One first-purchase Maestro credit exists per report; duplicate webhook
  delivery returns the existing records.
- Completed Build Pack stage output is immutable. Retry starts at the first
  recoverable failed stage and does not rerun completed stages.
- Refund or dispute events revoke unconsumed access without deleting financial
  history.

## Data handling

Idea text, answers, prompts, model output, email addresses, and payment payloads
remain server-only and never enter analytics properties. Provider payloads are
redacted before operational logging. Public shares project only verdict, score,
roast, strongest element, biggest weakness, and improved idea.

## Rollout and rollback

This migration is additive. Deploy tables and contracts before enabling the
public funnel flag. Rollback disables new starts and checkout creation while
preserving report access, paid entitlements, ledger history, and resumable pack
generation. Do not drop the tables during rollback.
