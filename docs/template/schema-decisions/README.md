# Schema Decisions

`pnpm template:add-table` creates one decision here for every proposed durable
table. Review the decision before approving the table for production.

Each decision records the canonical system, tenancy, sensitivity, PII,
export/delete/retention posture, append-only status, write authority, indexes,
backfill, compatibility window, and rollback plan. The deterministic
`check:data-resources` gate proves that the decision path exists and that the
table, system catalog, lifecycle catalog, and generated runtime projection stay
aligned.
