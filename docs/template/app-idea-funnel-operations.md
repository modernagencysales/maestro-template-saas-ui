# App idea funnel operations

## Product contract

- Free answers: **Should I build this?** The verdict and Buildability Report are
  useful, unblurred, and downloadable.
- Paid answers: **Exactly how should I build it?** The Complete Build Pack is a
  durable, versioned artifact, not a chat transcript.
- The first eligible Build Pack purchase creates an equal-value Maestro credit.
- A checkout return is never proof of payment. Only a verified, idempotently
  applied Dodo webhook creates or revokes entitlement.

## Provider posture

Local and test environments use deterministic fake providers. Live operation
requires Dodo, OpenRouter-compatible models, Postmark email, and PostHog to pass
the environment and provider-boundary checks before traffic is enabled.

Free and premium model calls use different environment-selected models and
independent daily ceilings. Free calls have no tools or research and enforce
per-evaluation call, input-token, output-token, repair, and spend limits before
transport. Premium work starts only after active entitlement and checkpoints
each stage.

## Funnel states

### Evaluation

`draft → collecting → ready-to-evaluate → evaluating → completed`

Recoverable model or transport failure moves to `failed-recoverable` while
retaining answers. Revision appends a report version; it never overwrites the
previous report snapshot.

### Checkout

`ready → redirecting → payment-pending → entitled`

The return route always enters `payment-pending`. It polls durable commerce
state and offers recovery instructions. It cannot write entitlement.

### Complete Build Pack

`queued → running → completed`

Each of normalize, challenge, research, design, specify, review, compile, and
map-to-Maestro records attempts and immutable completed output. A recoverable
failure retries that stage only. Repeated or non-recoverable failure becomes
`needs-support`; an operator may resume it without a new purchase.

## Support playbooks

### Payment remains pending

1. Ask for the public support ID, never card details.
2. Check the normalized checkout and webhook records.
3. Confirm webhook signature verification and provider event ID.
4. If Dodo reports payment succeeded but no verified event arrived, request a
   provider retry. Do not manually trust the return URL.
5. If manual reconciliation is required, record the provider payment ID,
   operator reason, and idempotency key before granting.

### Build Pack generation fails

1. Locate the pack and failed stage by support ID.
2. Confirm entitlement is active and completed stage outputs are intact.
3. Classify provider `402`, `429`, or usage-limit responses as infrastructure
   blockers; do not mutate product logic.
4. Resume the failed stage after capacity returns. Confirm earlier attempt
   counts and outputs are unchanged.
5. Escalate to manual review when citation or schema validation repeatedly
   fails. Never persist undecoded model output as the canonical pack.

### Refund or dispute

1. Apply the verified provider event idempotently.
2. Revoke unconsumed entitlement and record the normalized financial state.
3. Preserve the purchase, credit, receipt, and webhook audit history.
4. Do not delete a completed artifact without the separate data-lifecycle
   operation requested by its owner.

## Privacy and deletion

Analytics accepts only allowlisted identifiers, state labels, durations, model
call counts, and estimated cost. Ideas, answers, reports, prompts, model output,
email addresses, and payment content are forbidden properties.

Deleting an evaluation removes private answers and reports according to the data
lifecycle, revokes its share tokens, and prevents new pack starts. Financial
records retain only the minimum normalized fields required by policy.

## Health signals

Track aggregate counts and durations for evaluation start/completion, report
save, checkout start, entitlement grant, pack stage completion/failure, export,
and Maestro offer selection. Alert on elevated free cost, schema repair rate,
webhook signature failures, payment-pending age, or paid packs in
`failed-recoverable`/`needs-support`.
