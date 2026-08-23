# v0.2.0-alpha.6 to v0.2.0-alpha.7 migration notes

This release removes factory-only workflow tooling from generated customer
targets and repairs inherited release-path authority replacement. It does not
change durable data and does not require a data migration.

Rollback uses the required pre-upgrade Git commit or the immutable alpha.6 tag.
Existing customer data and table names are unchanged, so no data rollback
receipt is required.
