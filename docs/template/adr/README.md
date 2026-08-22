# Architecture Decision Records

Use an ADR only for consequential cross-cutting decisions: system or authority
ownership, tenant/trust boundaries, durable-data posture, provider authority,
published workflow semantics, compatibility escapes, or supported host ranges.
Routine features, fixes, styling, and generated pattern instances do not need
one.

ADR identity and lifecycle facts live in the `maestro-adr-metadata` JSON block;
checks validate that structure and its catalog links. They do not grade prose.
IDs are stable `ADR-NNNN` values. Accepted history is never rewritten: an
accepted successor names each prior ADR in `supersedes`, while each prior ADR
becomes `superseded` and names the successor in `supersededBy`.

Copy [`template.md`](template.md), replace every placeholder, and preview the
operation before writing. `migration` and `rollback` must be explicit even when
the answer is “none,” including the reason.
