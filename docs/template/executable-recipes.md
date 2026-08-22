# Executable Outcome Recipes

`pnpm maestro -- add` turns one reviewed product outcome into one closed,
transactional generator plan. It does not invent files or execute a loose chain
of commands.

## Discover recipes

```bash
pnpm maestro -- recipes list
pnpm maestro -- recipes show crud-business-entity
```

The shipped catalog includes workspace CRUD, validated file import, and
approval-backed automation. `recipes show` explains consequential questions, the
minimum primitive, provider posture, migration risks, focused gates, done state,
and when not to use the recipe.

An unknown outcome returns adjacent recipes and a `template-gap`; it does not
silently substitute a different architecture.

## Add a CRUD entity

First find the existing owner:

```bash
pnpm template:systems -- --query records
```

Then preview the recipe:

```bash
pnpm maestro -- add crud-business-entity \
  --answer entityName=Milestone \
  --answer canonicalOwner=record-management \
  --answer tenantScope=workspace \
  --answer sensitivity=internal \
  --answer pii=none \
  --answer exportMode=json \
  --answer deleteMode=delete \
  --answer retention=retain-until-workspace-delete \
  --answer appendOnly=false
```

Every lifecycle choice is explicit. Maestro never infers tenant scope, export,
deletion, PII, or retention from a generic “sensitive” answer.

Preview is non-mutating. Human output prints the exact confirmation command;
JSON output exposes the same value at `data.confirmationCommand`. It contains:

- all reviewed answers;
- `--write`.

Copy that command unchanged. The write recomputes the reviewed generator plan
and clean-target preflight before changing files. If any relevant fact changes,
the write refuses and asks for a new preview.

## What the write guarantees

Before the first target write, Maestro:

1. Re-runs every reviewed generator preview.
2. Recomputes the canonical plan and clean-preflight fingerprints.
3. Refuses changed answers, dirty worktrees, collisions, unsafe paths, symlinks,
   non-regular files, and unreviewed generators.
4. Stages every file and records its expected preimage and output hash.
5. Applies the plan under one durable transaction.

If a later operation fails, earlier operations are restored from the journaled
backup. If the process stops between filesystem renames, the next write runs the
same recovery routine first. Recovery authenticates the journal, canonical root,
authority, fingerprints, and regular-file hashes. It rolls back only when those
facts mechanically prove the action; ambiguous or tampered evidence fails
closed.

Recovery is idempotent. Repeating it after another interruption is safe.

## Evidence retained

Successful writes retain:

```text
.maestro/recipe-transactions/<plan>/attempt-0001/transaction.json
.maestro/recipe-transactions/<plan>/attempt-0001/receipt.json
```

The receipt binds the recipe and execution versions, redacted answer digest,
generator contract versions, exact plan and preflight fingerprints, operation
paths, candidate commit, and template-instance fingerprint when available.
Provenance files named by the generators are retained alongside the change.

Every attempt is numbered. A safely recovered attempt remains as evidence, and a
retry uses the next number. An applied attempt rejects replay of the same
reviewed plan.

## After the write

Run the focused gates listed by the recipe. For `crud-business-entity`:

```bash
pnpm confect:codegen
pnpm confect:manifest
pnpm format
pnpm --dir apps/web build
pnpm check:system-catalog
pnpm check:data-resources
pnpm check:schema-migration-notes
pnpm check:confect-contracts
pnpm --dir apps/web typecheck
```

The successful write prints codegen and focused gates in dependency order. The
web build regenerates TanStack's route tree before the route typecheck. Inspect
the receipt, then commit generated files, governance updates, focused tests,
provenance, and receipt as one coherent product slice.
