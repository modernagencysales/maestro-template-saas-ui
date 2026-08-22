# v0.1.0-alpha.1 to v0.2.0-alpha.1 migration notes

This directory is the reviewed migration leaf for the only supported V1
transition: `v0.1.0-alpha.1` to `v0.2.0-alpha.1`. Older, skipped, unknown, and
newer origins are unsupported; transitions must not be composed.

The manifest pins the exact source and destination release-manifest hashes and
the reviewed migration handoff fixture and planner hashes. `plan.ts` consumes
those facts as inert input. It does not read or write files, execute the
operator command, contact Convex, or perform network requests.

Sequence: expand schema, deploy backward-compatible code, preview redacted
counts, run the separately authorized migration, hold the compatibility window,
then contract. File upgrade remains separate from data-changing execution and
requires its verified migration receipt.

Replanning the exact accepted fingerprint after completion returns
`already-applied`. Any other completion fingerprint fails closed. Code rollback
uses the required pre-upgrade Git commit; data recovery follows the separately
reviewed migration receipt and is never a side effect of this release planner.
