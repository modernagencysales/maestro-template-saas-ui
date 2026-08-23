# Template Release Process

Client forks consume tagged template releases. Random file copying from template
`main` is not a supported upgrade path.

Customer create additionally requires the published tag to resolve to the exact
manifest commit and source-archive checksum. A `fixture-only` manifest may pass
contract tests but must never materialize a target. See the
[customer target contract](./customer-target-contract.md).

## Release Steps

1. Run focused tests for changed packages.
2. Run `pnpm review:readiness`.
3. Run `pnpm check:generators`, `pnpm check:confect-contracts`,
   `pnpm check:workflow-graph-boundary`, and security gates.
4. Build the web app and run static smoke.
5. Write release notes with changed packages, env changes, migrations, generated
   contract diffs, private-package compatibility, and rollback notes.
6. Run
   `pnpm --dir tooling/release exec tsx src/index.ts client-release <template-version> <client-version>`
   for any client fork being promoted from this release.
7. Publish the immutable tag and archive, then record and verify their exact
   commit and checksum before marking its customer manifest materializable.

For composed customer releases, the immutable tag must target the exact CI-green
release-branch head whose sealed `release.sourceCommit` is an ancestor. Do not
tag a squash-only merge commit: identical tree contents do not preserve the
ancestry proof required by production `maestro create`. Before pushing the tag,
require both `git merge-base --is-ancestor <source> <tag-target>` and a clean
release-seal check on that exact target. After publication, run untouched create
and frozen install from a fresh detached tag checkout before advancing a
launcher or public default.

## Alpha.3 Candidate Stop Boundary

The Confect 10 / Effect 4 candidate prepares `v0.2.0-alpha.3` /
`maestro-template-v0.2.0-alpha.3` as a new immutable release. It must never
rewrite `v0.2.0-alpha.2`, and preparation does not authorize publication or a
public-default change.

The controlled release sequence is:

1. Merge the exact candidate head.
2. Run connected Convex generation and the broad exact-head gates in the
   controlled lane.
3. Seal a new alpha.3 directory from that exact clean commit.
4. Publish the immutable tag and archive.
5. Verify tag resolution, archive checksum, manifest checksum, and untouched
   customer materialization from the published tag.
6. Review and merge a separate change to the production composition and
   quickstart default.
7. Repeat the untouched-create acceptance against the published tag.

Stop before step 3 without explicit release authority. Stop before step 6 unless
published-tag materialization is verified and the default switch has separate
review.

## Deploy Alert Plans

Release tooling does not send Slack or webhook messages directly. Instead,
failed deploy doctor reports and refused production promotion plans include a
redacted alert plan with severity, title, body, stable `dedupeKey`, and metadata
that contains only names and deployment identifiers. Client forks can hand that
plan to `packages/notifications` `createAlertService` after choosing their live
alert sink.

## Client Upgrade

Use:

```bash
pnpm template:upgrade -- --from <client-version> --to <template-version>
pnpm --dir tooling/release exec tsx src/index.ts client-release <template-version> <client-version>
```

The report should identify changed packages, env var names, migration notes,
Confect/OpenAPI/CLI/MCP contract diffs, handoff artifacts, and manual review
items.

## Rollback

Keep rollback simple:

- restore the prior deployed artifact;
- restore the prior template tag in the client fork;
- revert generated contract changes only through reviewed commits;
- keep provider credential changes outside git.
