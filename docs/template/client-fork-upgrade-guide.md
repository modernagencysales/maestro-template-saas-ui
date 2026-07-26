# Client Fork Upgrade Guide

Client forks should upgrade from tagged template releases.

## Template Instance Compatibility

`packages/template-core/src/templateInstance/` is the canonical authority for
the template-instance schema and its pack, CLI, template, workflow-schema, and
compatibility-set versions. Its `compatibility.current` and
`compatibility.previous` entries are the only host-range, support-state, and
deprecation-date claims. Documentation and consumers must project those values
rather than restating them.

Compatibility returns one stable `compatible`, `migratable`, `unsupported`, or
`newer` packet. Every packet includes a code, read-only continuation safety, the
last supported pack/CLI/template tag, one recovery action, and canonical schema
provenance. V1 does not infer broad SemVer support: only the current tag and
exactly one previous tag are recognized. Older, skipped, or unknown release
identities are unsupported; a higher schema or compatibility-set version is
newer than this tool.

The generator migration is pure and versioned. It can normalize the prior
instance shapes without writing a file, and it preserves unknown top-level
customer extension fields. Keep the original file in Git or dry-run evidence
before a caller writes migrated bytes. This contract does not provide an upgrade
apply engine or a reverse migration.

## Upgrade Flow

1. Read the template changelog.
2. Resolve `template-instance.json` compatibility and stop on `unsupported` or
   `newer`; read-only inspection remains safe.
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
