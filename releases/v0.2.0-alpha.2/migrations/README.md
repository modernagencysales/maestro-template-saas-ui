# v0.2.0-alpha.1 to v0.2.0-alpha.2 migration notes

This tester release changes factory guidance, customer CLI closure, generated
record-contract paths, and starter governance. It does not require a data
migration.

File upgrade must remove the old nested
`packages/convex/confect/records/records.{spec,impl}.ts` paths before using the
flat `packages/convex/confect/records.{spec,impl}.ts` contract. Regenerate
Confect and Convex projections after the file upgrade. Existing customer data
and table names are unchanged.

Rollback uses the required pre-upgrade Git commit. No data rollback receipt is
required because the transition performs no data-changing execution.
