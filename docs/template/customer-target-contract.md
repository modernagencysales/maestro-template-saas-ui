# Customer Target Contract

`pnpm maestro -- create` is the only customer-facing factory-to-app boundary. It
consumes a reviewed tagged release through the customer release manifest and
never copies the current factory checkout.

## Create

```bash
pnpm maestro -- create <target> --name "My App" --outcome "Track client requests"
pnpm maestro -- create <target> --name "My App" --outcome "Track client requests" --demo-only --write
```

The three customer choices are app name, first user outcome, and demo-only
posture. Preview is the default. It lists exact writes, omissions, collisions,
and total install bytes without changing the source or target. `--write` is the
only create write approval and still refuses dirty sources, unsafe roots,
changed preflight evidence, collisions, and ambiguous non-empty targets.

Successful materialization writes `template-instance.json` with:

- immutable release version, tag, commit, and source-archive checksum;
- CLI and Agent Pack compatibility;
- ownership manifest path, checksum, and extension seams;
- visible app name, first-outcome seed, and demo-only posture.

The output contains exactly one next command: start the new target. Dependency
installation and Git initialization are listed separately with
`requiresApproval: true` and `executed: false`; create never runs them.

## Immutable release requirement

The checked-in `v0.1.0-alpha.1` golden manifest remains `fixture-only`. It is
contract evidence, not a materializable release. Root release composition must
resolve an existing immutable tag to the exact manifest commit and archive
checksum, verify the ownership-manifest checksum, and then supply the accepted
customer materializer. Missing, stale, or mismatched bindings fail closed.

## Safety boundary

The source archive, live factory root, home, filesystem root, and target must be
separate under resolved-path checks. Writes are staged, hash-verified, and
promoted only after unchanged preflight. Interrupted writes use the bounded
journal recovery contract; rollback removes only journaled, hash-confirmed
output.

Create does not install packages, initialize Git, authenticate Convex, launch
MCP, select production, import a prior app, choose providers or workflows, or
silently overwrite files.
