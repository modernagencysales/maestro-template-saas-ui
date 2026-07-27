# Client Fork Upgrade Guide

Client forks should upgrade from immutable tagged template releases after those
releases actually exist. This repository currently has no `maestro-template-*`
Git tags. The checked-in `v0.1.0-alpha.1` manifest is fixture-only and
unpublished; it is not an available recovery source.

## Template Instance Compatibility

`packages/template-core/src/templateInstance/` is the canonical authority for
the template-instance schema and its pack, CLI, template, workflow-schema, and
compatibility-set versions. Its `compatibility.current` and
`compatibility.previous` entries are the only host-range, support-state,
release-availability, release-evidence, and deprecation-date claims.
Documentation and consumers must project those values rather than restating
them.

Compatibility returns one stable `compatible`, `migratable`, `unsupported`, or
`newer` packet. Every packet includes a code, read-only continuation safety, the
last supported pack/CLI/template tag, one recovery action, and canonical schema
provenance plus the exact axis and reason that controlled the decision. V1 does
not infer broad SemVer support. It recognizes only exact declared identities and
values for schema, tag, compatibility set, pack, CLI, template, workflow schema,
legacy Agent Pack/CLI ranges, host ranges, support, and provenance. A higher
integer schema, workflow-schema, or compatibility-set value is newer; every
missing, malformed, unknown, reordered-with-different-values, or other
mismatched axis fails closed and never reports compatible.

The current and previous strings are declared tag identities, not evidence that
Git tags exist. The previous `v0.1.0-alpha.1` identity is modeled as
`planned`/`unavailable` with `fixture-only` evidence. Its pure instance-schema
normalization can be inspected, but there is no published previous-tag upgrade
or restore path. Do not tell a user to restore that tag. Until release authority
publishes and binds a real tag, preserve the input and continue read-only.

The generator migration is pure and versioned. It can normalize the prior
instance shapes without writing a file. It accepts only exact supported integer
schema versions or the positively identified, closed legacy V0 generator shape;
missing identity, fractional/non-finite versions, unknown versions, and future
versions return a non-mutating resolution.

The extension contract is closed. Authority objects (`versions`,
`compatibility`, `support`, and `provenance`) reject unknown nested fields.
Customer data is preserved only in the named top-level seams `blueprint`,
`ownership`, `personalization`, and `customerExtension`; the declared legacy V0
application projection fields; or a non-empty top-level `x-<namespace>` seam.
Other top-level fields are rejected. Canonical serialization normalizes object
key order, so insertion order does not change acceptance or output. Keep the
original file in Git or dry-run evidence before any separately authorized write.
This contract does not provide an upgrade apply engine or a reverse migration.

## Upgrade Flow

1. Read the template changelog.
2. Resolve `template-instance.json` compatibility and stop on `unsupported`,
   `newer`, or a `planned-unavailable` migration basis; read-only inspection
   remains safe.
3. Run
   `pnpm template:upgrade -- --from <client-version> --to <template-version>`.
4. Run
   `pnpm --dir tooling/release exec tsx src/index.ts client-release <template-version> <client-version>`.
5. Review changed packages, env vars, migrations, generated contract diffs, and
   manual review items.
6. Compare the fork's selected blueprint against
   [blueprint-catalog.md](./blueprint-catalog.md).
7. Confirm generated or private-package slices still follow
   [generator-output-contract.md](./generator-output-contract.md).
8. Review immutable workflow and capability releases using the
   [workflow versioning guide](./workflow-versioning.md). Published versions
   must remain byte-identical; upgrade behavior through additive drafts.
9. Apply separately authorized migrations in staging.
10. Run fake and live-provider smokes.
11. Update the handoff packet using
    [client-handoff-packet.md](./client-handoff-packet.md).
12. Promote only from the verified commit.

## Conflict Policy

Client-specific code belongs in extension packages. If a fork changed template
core files, convert those changes into extension seams before upgrading.

## Command Output

`template:upgrade` emits a JSON report with:

- changed packages;
- environment changes;
- migration review items;
- generated contract diffs;
- manual review checklist;
- commands to run before promotion.

`client-release` emits a JSON report with:

- compatibility status;
- required checks;
- generated intake, implementation brief, provider checklist, handoff packet,
  env manifest, release process, and `template-instance.json` status.
