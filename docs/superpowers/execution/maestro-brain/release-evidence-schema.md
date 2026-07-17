# Canonical S14-T01 Release Evidence Packet

`release-result.json` uses `maestro-brain-release-evidence/v1` and is accepted
only by `tooling/brain-factory/src/release-evidence-check.mts`. The checker is
the executable schema; this note defines the operator-facing contract.

The packet binds one `productReleaseCommit`, `buildId`, and `deployId`. It
contains the exact Buildkite contexts named by Appendix L and separate passed,
commit-bound receipts for staging, provider, headless, lifecycle, migration,
eval, capacity, and production promotion. Each receipt records a stable ID,
evidence SHA-256, and the exact check inventory exported by the checker. A
generic `status: passed`, GitHub mirror, missing check, extra substitute, or
receipt for another commit is not evidence.

The pilot freezes its cohort hash and uses every completed seven-day agency as
the denominator. Missing responses count as failures. Brief acceptance,
usefulness, and full-cohort second-surface numerators must respectively reach
`ceil(0.80 * denominator)`, `ceil(0.70 * denominator)`, and
`ceil(0.50 * denominator)`. The activated-agency second-surface metric is
reported separately. Median time-to-value is strictly below 15 minutes, median
weekly admin time strictly below 10 minutes, and maintenance is strictly below
two actions per active client-week with zero-action weeks included.

Rollback records the prior compatible release, rollback ID, distinct
roll-forward ID, owner, deploy ID, and evidence hash. Reverse-migration IDs must
be empty; compatible binary restore, forward reconciliation, and monotonic
lifecycle preservation must all be true.

When `attestationCommit` equals `productReleaseCommit`, inheritance is exactly
`{ "inherited": false }`. Otherwise the materiality record must bind both
commits, list only `docs/` changes, use the same approvers, name every
unaffected receipt and Buildkite key, and include distinct old/new packet hashes
plus its signature hash. Any source, dependency, generated, migration, provider,
model/prompt/tool-schema, environment, or capacity change requires a new
candidate rather than inheritance.

`signatureSha256` is deterministic: recursively sort object keys, retain array
order, serialize compact JSON after removing `signatureSha256`, and hash the
UTF-8 bytes with SHA-256. The final gate recomputes it; a plausible-looking but
stale digest fails closed.
