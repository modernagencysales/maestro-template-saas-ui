# Existing Applications

Treat an existing application as read-only prior art during adoption planning.
Default to a separate, clean Maestro target; never copy source files or infer
architecture from a universal scan.

The host and application owner must explicitly classify each reviewed path as
`preserve`, `port`, `replace`, or `delete`, with a rationale. Record exact
source, target, and worktree roots; baseline evidence; editable target
boundaries; identity, tenant, and data mappings; compatibility requirements;
cutover evidence; deletion timing; approval; and rollback.

Reject overlapping roots or dirty targets. An in-place plan is exceptional: it
requires one clean exact worktree, a specific justification, a bounded editable
path, and evidence-backed rollback. Deletion must wait until an approved cutover
and remain source-restorable. Previewing a work package returns JSON; it does
not copy, edit, delete, install, authenticate, or deploy anything.
