# Executable Outcome Recipes

`pnpm maestro -- add` turns a reviewed outcome recipe into one closed generator
plan. It does not invent files or run generator commands one at a time.

## Add a CRUD entity

Preview first:

```bash
pnpm maestro -- add crud-business-entity \
  --answer entityName=Request \
  --answer canonicalOwner=access-and-tenancy \
  --answer tenantScope=workspace \
  --answer sensitivity=internal \
  --answer pii=none \
  --answer exportMode=json \
  --answer deleteMode=delete \
  --answer retention=retain-until-workspace-delete \
  --answer appendOnly=false \
  --json
```

Every lifecycle choice is explicit. Maestro never derives tenant scope, export,
deletion, or retention from a generic sensitive-data answer.

The preview is non-mutating. Its `data.confirmationCommand` is the exact
copy/paste write command, including the reviewed plan and clean preflight
fingerprints. Users should copy that command; they do not need to construct or
understand either fingerprint. `--privacy-reviewed` confirms that the displayed
data posture and file operations were reviewed.

The write recomputes the canonical generator previews and preflight. It refuses
changed answers, changed generator output, a dirty target, stale fingerprints,
collisions, unsafe paths, symlinks, and unreviewed generators. All files are
staged before the first target write and applied under one durable transaction.
If any later operation fails, earlier operations are restored from the journaled
backup.

If the process stops between filesystem renames, the next write first runs the
same recovery routine exposed by the transaction adapter. Recovery authenticates
the durable journal, rechecks the canonical root and exact reviewed authority,
and compares the target, stage, and backup regular-file hashes. It rolls back to
the exact preimages only when those facts mechanically prove the action; missing
or tampered evidence fails closed instead of guessing. Recovery is idempotent,
so repeating it after another interruption is safe.

Successful writes retain:

- `.maestro/recipe-transactions/<plan>/attempt-0001/transaction.json`
- `.maestro/recipe-transactions/<plan>/attempt-0001/receipt.json`
- the provenance files named in the receipt

The receipt binds the recipe and execution versions, redacted answer digest,
generator contract versions, exact plan and preflight fingerprints, operation
paths, candidate commit, and template-instance fingerprint when available.

Every attempt is numbered and retained. An interrupted attempt that is safely
recovered remains as evidence, and a retry uses the next number. An applied
attempt rejects replay of the same reviewed plan. A journal with a bad digest,
wrong roots or fingerprints, unsafe paths, symlinks, non-regular files, or an
unprovable preimage also fails closed without asking a novice to inspect or
repair a partially written repository.
