# Template Quickstart

This walkthrough exercises the same path an external tester should use. It
creates a separate Launch Tracker app, establishes a clean baseline, uses the
generated CLI to inspect the architecture, previews a change, and starts the app
without live accounts or secrets.

## 1. Prepare the factory

Requirements: Git, Node 22, Corepack, and pnpm.

```bash
git clone https://github.com/modernagencysales/maestro-template-saas-ui.git
cd maestro-template-saas-ui
git checkout maestro-template-v0.2.0-alpha.2
corepack enable
pnpm install --frozen-lockfile
```

The tag matters. Customer creation is bound to an immutable release manifest,
source commit, source archive checksum, and blueprint checksum. A random copy of
the factory branch is not a release.

## 2. Preview and create Launch Tracker

Preview first. This command does not create the target directory:

```bash
pnpm maestro -- create ../launch-tracker \
  --name "Launch Tracker" \
  --outcome "Track launch tasks and blockers" \
  --demo-only
```

Review the listed writes, omissions, collisions, release facts, and privacy
notice. Then approve that exact materialization:

```bash
pnpm maestro -- create ../launch-tracker \
  --name "Launch Tracker" \
  --outcome "Track launch tasks and blockers" \
  --demo-only \
  --write \
  --privacy-reviewed
```

Create prints the remaining commands in order. Run them rather than guessing:

```bash
git -C ../launch-tracker init
pnpm --dir ../launch-tracker install --frozen-lockfile
git -C ../launch-tracker add .
git -C ../launch-tracker commit -m "chore: initialize app from Maestro"
pnpm --dir ../launch-tracker maestro -- preflight --mode fake
```

The baseline commit is intentional. Preflight and recipe writes require a clean
target so they can distinguish their changes from yours. Create never runs Git,
package installation, authentication, or a server on your behalf.

## 3. Ask the generated app what it supports

```bash
cd ../launch-tracker
pnpm maestro -- recipes list
pnpm maestro -- recipes show crud-business-entity
pnpm template:systems -- --query records
```

The starter already contains the canonical `record-management` system, one
workspace-owned `records` table, lifecycle metadata, and the `/records` route.
System lookup is part of the method: reuse or extend an existing owner instead
of introducing another subsystem with a different noun.

Useful inspection files are:

- `template-instance.json` — immutable release and app personalization facts.
- `docs/template/system-catalog.json` — canonical responsibility and table
  ownership.
- `docs/template/product-topology.json` — routes, capabilities, workflows, and
  provider relationships.
- `docs/template/data-resources.json` — tenant, export, deletion, and retention
  posture.
- `AGENTS.md` — rules for agents working in the generated app.

## 4. Preview a second business entity

This example adds a `Milestone` table and visible slice under the existing
record-management authority:

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

The default is a non-mutating preview. It prints an exact confirmation command
containing the reviewed plan fingerprint and clean-preflight fingerprint. Copy
that command unchanged to write. The write re-previews every generator, stages
all files, refuses collisions or changed evidence, and retains a recovery
journal and receipt under `.maestro/recipe-transactions/`.

If you only want to understand the machine contract, add `--json`. If you want
all diagnostics and context facts, add `--details`.

## 5. Verify the affected contracts

Run the focused gates named by the recipe. For the CRUD recipe they include:

```bash
pnpm confect:codegen
pnpm confect:manifest
pnpm --dir apps/web build
pnpm check:system-catalog
pnpm check:data-resources
pnpm check:schema-migration-notes
pnpm check:confect-contracts
pnpm --dir apps/web typecheck
```

The successful write prints these commands in dependency order. The web build
regenerates TanStack's route tree before TypeScript checks the new file route.
Generated route, Confect, and Convex files are outputs, not hand-editing
surfaces.

## 6. Start in fake mode

```bash
pnpm maestro -- start --mode fake
```

Start uses a strict port, waits for `/health`, and only then prints the app URL.
Fake mode starts the web app without a Convex account or live provider secret.
Use `--mode local` only for the reviewed local Convex stack and `--mode dev`
only with an authenticated personal development deployment. See
[Start Modes](./start-modes.md).

The first app proof is simple: open `/records`, create a record, return to the
list, and open its detail. Verify loading, empty, error, list, detail, and
create states. The neutral `record` noun is meant to be renamed.

## The method in one page

```text
preflight
  -> inspect recipes and canonical ownership
  -> preview exact operations
  -> review privacy, lifecycle, and collisions
  -> write with unchanged authority fingerprints
  -> run focused deterministic gates
  -> start in fake mode
```

Use the smallest primitive that fits:

- A table and route for ordinary workspace CRUD.
- A capability when policy, approval, audit, entitlement, or cross-resource
  validation is required.
- A workflow when work must pause, retry, wait, or resume.
- An agent only when a nondeterministic actor needs explicit tools to choose
  among reviewed operations.

Uncertain behavior begins under `template:prototype`. Learned behavior is
promoted by re-scaffolding through the matching `template:add-*` command; an
experiment is never imported directly into production.

## Before sharing a generated app

At minimum, run:

```bash
pnpm check:format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:system-catalog
pnpm check:system-topology
pnpm check:data-resources
```

Then commit the generated receipt and relevant provenance alongside the code.
Use `pnpm verify` for the exhaustive handoff gate.
