# Client Fork Upgrade Guide

Client forks should upgrade from tagged template releases.

## Upgrade Flow

1. Read the template changelog.
2. Run
   `pnpm template:upgrade -- --from <client-version> --to <template-version>`.
3. Run
   `pnpm --dir tooling/release exec tsx src/index.ts client-release <template-version> <client-version>`.
4. Review changed packages, env vars, migrations, generated contract diffs, and
   manual review items.
5. Compare the fork's selected blueprint against
   [blueprint-catalog.md](./blueprint-catalog.md).
6. Confirm generated or private-package slices still follow
   [generator-output-contract.md](./generator-output-contract.md).
7. Review immutable workflow and capability releases using the
   [workflow versioning guide](./workflow-versioning.md). Published versions
   must remain byte-identical; upgrade behavior through additive drafts.
8. Apply migrations in staging.
9. Run fake and live-provider smokes.
10. Update the handoff packet using
    [client-handoff-packet.md](./client-handoff-packet.md).
11. Promote only from the verified commit.

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
