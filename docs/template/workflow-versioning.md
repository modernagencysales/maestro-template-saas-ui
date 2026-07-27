# Workflow Versioning And Publication

Workflow and workflow-callable capability releases are immutable once published.
Author new behavior as a new version; never edit a published graph, runner,
completion callback, capability binding, or resolved source closure.

## Lifecycle

- `draft` releases are editable and unavailable to normal starts.
- `published` releases are content-addressed and may start new runs.
- `retired` releases reject new starts while retaining every artifact required
  by active or restartable runs.

Phase 1 publishes only the isolated `publicationFixture`. Application workflows
remain draft until the complete semantic and release gates are accepted.

## Commands

```bash
pnpm template:bump-capability -- --name <name> --from <N> --to <N+1>
pnpm template:bump-capability -- --name <name> --from <N> --to <N+1> --write
pnpm template:bump-workflow -- --name <name> --from <N> --to <N+1>
pnpm template:bump-workflow -- --name <name> --from <N> --to <N+1> --write
pnpm template:publish-capability -- --name <name> --version <N>
pnpm template:publish-workflow -- --name <name> --version <N>
```

A bump copies a published or retired release into the next draft version. It
does not modify the source release. Workflow bumps report added, removed, and
reordered stable step names for review.

Publish capabilities before workflows that bind them. Publication refuses draft
or incomplete dependencies, application workflow publication during Phase 1,
overwritten versions, incomplete fingerprints, or source bytes that do not match
the recursively resolved authority descriptor.

## Exact Resolution

Generated starts select workflow ID and version from the generated publication
registry. The selected entry pins the graph hash, runner and completion refs,
kickoff profiles, events, lifecycle contract, runtime interpreter, and exact
capability and subworkflow versions. A pending v1 step therefore keeps its v1
capability after v2 is published.

The trusted publication manifest records the full relative-import closure and
artifact checksums. CI compares it with the actual PR merge base; caller input
cannot choose a different history. Validate a publication with:

```bash
pnpm check:workflow-version-immutability -- \
  --comparison-base <actual-pr-merge-base> \
  --publication-manifest docs/template/generated/workflow-publications.json
```

## Retirement And Rollback

Retirement is the safe response for an urgent defect: stop new starts, record
the incident disposition, and preserve code for active/restartable runs.
Rollback selects a prior published start entry. Never delete or mutate an old
runner, completion ref, capability release, or interpreter closure while a run
can still reference it.
