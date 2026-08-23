# v0.2.0-alpha.8 to v0.2.0-alpha.9 migration notes

This release republishes the repaired customer artifact with immutable tag
ancestry that satisfies production create verification. It does not change
durable data and does not require a data migration.

Rollback uses the required pre-upgrade Git commit or the immutable alpha.8 tag.
Existing customer data and table names are unchanged, so no data rollback
receipt is required.
