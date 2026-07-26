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

Successful writes retain:

- `.maestro/recipe-transactions/<plan>/transaction.json`
- `.maestro/recipe-transactions/<plan>/receipt.json`
- the provenance files named in the receipt

The receipt binds the recipe and execution versions, redacted answer digest,
generator contract versions, exact plan and preflight fingerprints, operation
paths, candidate commit, and template-instance fingerprint when available.

An existing transaction directory is never silently replayed. A completed or
interrupted journal fails closed so an operator can inspect the retained
evidence before choosing a new reviewed plan.
