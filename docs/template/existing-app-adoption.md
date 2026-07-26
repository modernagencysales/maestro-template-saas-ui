# Existing-Application Adoption

Adoption preserves useful prior behavior while moving implementation through
Maestro’s canonical boundaries. Planning is dry-run and source-read-only.

## Default: separate target

- Source: `/workspace/existing-app`, retained as prior art.
- Template: the reviewed tagged Maestro release and compatibility set.
- Target: `/workspace/maestro-app`, a separate clean worktree.
- Work package: explicit mappings, editable boundaries, caller-owned
  preserve/port/replace/delete decisions, cutover evidence, approval, and
  rollback.

Build and verify the target independently. Keep the source available until the
reviewed cutover is complete. A delete decision is not authority to delete; it
must be deferred behind approved cutover evidence and a source-restorable
rollback.

## Exceptional: in place

Use one source/target root only when the worktree is clean, the application
already fits the reviewed boundaries, a narrow editable path is declared, and
the package contains an explicit justification plus tested rollback evidence.
Otherwise create a separate target.

The planning artifact never copies source files or executes migration, cutover,
deletion, authentication, provider, or deployment actions.
