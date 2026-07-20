# How To Add A Brain Schema

Use the canonical table generator for durable Brain state:

```bash
pnpm template:add-table -- --name customerBrief --system knowledge-brain --disposition extend --tenant-scope workspace --sensitivity confidential --pii customer-content --export-mode markdown --delete-mode delete --retention retain-until-workspace-delete
```

## Files Created

- Effect schema.
- Confect table or group updates.
- Source Set or Evidence View projection when needed.
- Context pack mapping.
- Trust Receipt metadata.
- Tests, docs, and migration note for durable changes.

## Tests

- markdown/link import;
- Source Set resolution;
- Evidence Snapshot;
- Evidence View;
- freshness decay;
- context pack;
- quote/source grounding;
- export and delete.

## Gates

- `pnpm --dir packages/convex test brain`
- `pnpm check:schema-migration-notes`
- `pnpm check:data-resources`
- `pnpm check:system-catalog`
- `pnpm check:confect-contracts`
