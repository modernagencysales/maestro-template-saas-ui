# v0.2.0-alpha.4 to v0.2.0-alpha.5 migration notes

This release repairs immutable release provenance without product or data
changes. It does not require a data migration.

Rollback uses the required pre-upgrade Git commit or the immutable alpha.4 tag.
Existing customer data and table names are unchanged, so no data rollback
receipt is required.
