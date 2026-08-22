# How To Add A Data Lifecycle Resource

For a new durable table, use the table generator and classify the resource at
creation time:

```bash
pnpm template:add-table -- \
  --name sourceArchive \
  --system knowledge-brain \
  --disposition extend \
  --tenant-scope workspace \
  --sensitivity confidential \
  --pii customer-content \
  --export-mode json \
  --delete-mode delete \
  --retention retain-until-workspace-delete
```

## Files Created

- Confect table scaffold.
- Canonical system ownership update.
- Machine-readable lifecycle, tenancy, sensitivity, and PII metadata.
- Schema migration decision.
- Generator provenance.

After specializing the generated fields, run `pnpm data-resources:generate`. The
generated runtime projection drives the DSAR export/delete and retention
planners; do not edit it directly.

## Tests

- export manifest includes allowed fields;
- delete removes or blocks correctly;
- provider storage mapping;
- audit event;
- workspace isolation.

## Gates

- `pnpm --dir packages/convex test dataLifecycle`
- `pnpm --dir apps/web test src/features/data-map`
- `pnpm check:schema-migration-notes`
- `pnpm check:data-resources`
- `pnpm check:system-catalog`
