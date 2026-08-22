# Customer Target Contract

`pnpm maestro -- create` is the only supported factory-to-app boundary. It
consumes an immutable reviewed release and writes a separate customer target; it
never turns the live factory checkout into the customer product.

## Create contract

Every current generated customer target includes the mandatory upstream-derived
Saas UI frontend chassis. It is not an optional application pattern. Paid source
remains private, preserves `docs/licenses/saas-ui/` notices, and is never
projected into a public package or artifact.

```bash
# Preview: no writes.
pnpm maestro -- create <target> \
  --name "My App" \
  --outcome "Track client requests" \
  --demo-only

# Materialize the reviewed preview.
pnpm maestro -- create <target> \
  --name "My App" \
  --outcome "Track client requests" \
  --demo-only \
  --write
```

The customer choices are the app name, first user outcome, and demo-only
posture. Preview lists exact writes, omissions, collisions, and total bytes
without changing the source or target. `--write` is the only create approval.

A successful target contains `template-instance.json` with:

- immutable release version, tag, tagged source commit, and source/composition
  checksum;
- CLI and Agent Pack compatibility;
- ownership authority identifier, manifest path, checksum, and extension seams;
- blueprint identity and exact plan digest;
- visible app name, first-outcome seed, and demo-only posture.

The public create composition binds generated output to a clean checkout whose
HEAD exactly equals the reviewed immutable release tag. `template-instance.json`
records the release version, tag, tagged commit, and a composition checksum. An
untagged commit, including a clean commit beyond the tag, fails closed before
preview or materialization and is never projected as a customer release.

The output contains exactly one next command: start the new target. Git
initialization and the pinned frozen dependency install are listed separately,
in that order, with `requiresApproval: true` and `executed: false`; create never
runs them. Initializing the generated target as its own Git repository before
installation prevents package prepare hooks from discovering or changing an
unrelated parent worktree. The generated Lefthook installer independently
requires the resolved Git top-level to equal the generated app root and skips
installation when only an ancestor worktree exists.

## Immutable release authority

`0.2.0-alpha.2` is the first external-tester release in this series. The older
`v0.1.0-alpha.1` golden manifest remains fixture-only; `0.2.0-alpha.1` remains
immutable historical evidence. New behavior is issued as a new release and tag,
never by moving an existing tag or editing an existing sealed release.

Materialization verifies all of the following before it can write:

1. The requested tag exists and contains the exact ownership manifest bytes.
2. The reviewed source commit is an ancestor of that tag.
3. A Git archive of that commit matches the recorded source checksum.
4. The ownership and blueprint manifests match their compiled checksums.
5. The current target plan exactly matches the reviewed blueprint entries.
6. Every copied, generated, omitted, and preserved path has one reviewed owner.

Missing, stale, or mismatched authority fails closed.

## Generated-customer authority

A generated target does not need the factory's historical Git tags in its own
repository. Customer preflight binds package, CLI, Agent Pack, and template
facts to the release recorded in `template-instance.json`. The packaged
customer-context manifest lives at
`docs/template/customer-context.manifest.json`; agents may install its reviewed
host guidance without depending on factory-only paths.

Both normal package-script invocation and an extra leading pnpm `--` separator
are normalized by the generated CLI. These are equivalent:

```bash
pnpm maestro -- preflight --mode fake
pnpm maestro -- -- preflight --mode fake
```

## Filesystem and transaction safety

The source archive, live factory root, home directory, filesystem root, and
target must be distinct after real-path resolution. macOS aliases such as `/var`
and `/private/var` are compared canonically. Create stages and hash-verifies
writes, then promotes them only if preflight evidence is unchanged. Interrupted
writes use the bounded journal recovery contract; rollback removes only
journaled, hash-confirmed output.

Outcome recipes add another boundary: they re-preview the canonical generators,
bind the exact plan and clean-preflight fingerprints, stage every operation, and
retain the journal and receipt. Unsafe paths, symlinks, non-regular files,
collisions, dirty targets, stale fingerprints, and unreviewed generators are
refused.

## Deliberately outside create

Create does not install packages, initialize or commit Git, authenticate Convex,
launch MCP, select production, import a prior app, choose live providers, run a
server, or overwrite an existing file. Those are separate decisions with their
own commands and evidence.
