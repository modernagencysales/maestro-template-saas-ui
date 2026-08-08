# Template Quickstart

This walkthrough exercises the same path an external tester should use. It
creates a separate Launch Tracker app, establishes a clean baseline, uses the
generated CLI to inspect the architecture, previews a change, and starts the app
without live accounts or secrets.

## 1. Prepare the factory

## 10-Minute Local Fake Mode

From a fresh template or generated-customer checkout, validate the package
manager before invoking any workspace command:

```bash
node scripts/bootstrap-preflight.mjs
npx --yes pnpm@10.12.1 install --frozen-lockfile
```

This dependency-free preflight reads the exact version from `packageManager`,
rejects an ambient mismatch, and prints the same pinned `npx` recovery command.
Use that recovery when Corepack reports a signing-key error. Run generators only
after the frozen install succeeds. If the ambient pnpm remains mismatched, keep
the `npx --yes pnpm@10.12.1` prefix on every later pnpm command.

For a customer app, preview a reviewed release first:

```bash
git clone https://github.com/modernagencysales/maestro-template-saas-ui.git
cd maestro-template-saas-ui
git checkout maestro-template-v0.2.0-alpha.2
node scripts/maestro-bootstrap.mjs
```

Run the install command printed by bootstrap. With current Corepack that is:

```bash
node scripts/bootstrap-preflight.mjs
npx --yes pnpm@10.12.1 install --frozen-lockfile
pnpm maestro -- start
```

If Corepack is unavailable or rejects its signing metadata, use the pinned
fallback printed by the same check:

```bash
node scripts/bootstrap-preflight.mjs
npx --yes pnpm@10.12.1 install --frozen-lockfile
pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Client Brain" --write
pnpm template:intake -- --name "Client Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write
pnpm template:systems -- --query knowledge
pnpm template:add-client-domain -- --name customerContext --system knowledge-brain --disposition extend --write
pnpm template:handoff -- --mode fake --write
pnpm maestro -- start
```

Bootstrap also rejects the wrong Node major and prints repository-local
`git config user.name` and `git config user.email` repairs before the first
required commit.

The tag matters. Customer creation is bound to an immutable release manifest,
source commit, source archive checksum, and blueprint checksum. A random copy of
the factory branch is not a release.

## 2. Preview and create Launch Tracker

1. Run `node scripts/bootstrap-preflight.mjs`, then install dependencies with
   the exact pinned command it prints.
2. Review `.env.example` and [env-manifest.md](./env-manifest.md). Keep the fake
   defaults unless this is a test/live provider setup. Leave `VITE_CONVEX_URL`
   blank for fake-safe local web mode.
3. Generate the default client fork scaffold:
   `pnpm template:quickstart -- --name "Client Brain" --write`.
4. Generate the first discovery brief with
   `pnpm template:intake -- --name "Client Brain" --write`.
5. Check fake-mode readiness with `pnpm template:doctor -- --mode fake`.
6. Seed deterministic demo context with
   `pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write`.
7. Change the first client noun with
   `pnpm template:add-client-domain -- --name customerContext --system knowledge-brain --disposition extend --write`.
8. Start the app with `pnpm maestro -- start`.
9. Review the generated implementation brief at
   `docs/template/generated/implementation-brief.md`.
10. Preview the handoff packet with
    `pnpm template:handoff -- --mode fake --write`.

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
  --write
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

See the [Preflight guide](./preflight.md) for the facts it checks, its read-only
boundary, and the difference between the concise, detailed, and JSON views.

## 3. Ask the generated app what it supports

```bash
cd ../launch-tracker
pnpm maestro -- recipes list
pnpm maestro -- recipes show crud-business-entity
pnpm template:systems -- --query workspace
```

The default starter is a neutral chassis with a draft `@wip` first-outcome
contract. It deliberately contains no product entity, record-management system,
`records` table, or `/records` route. System lookup is part of the method:
identify the reviewed owner for the first real domain before adding a product
slice.

Useful inspection files are:

- `template-instance.json` — immutable release and app personalization facts.
- `docs/template/system-catalog.json` — canonical responsibility and table
  ownership.
- `docs/template/product-topology.json` — routes, capabilities, workflows, and
  provider relationships.
- `docs/template/data-resources.json` — tenant, export, deletion, and retention
  posture.
- `AGENTS.md` — rules for agents working in the generated app.

## 4. Plan the first business entity

The default chassis does not provide a ready-made CRUD owner. Keep the first
outcome as `@wip` until its product noun, tenancy, lifecycle, and canonical
owner are reviewed. Then choose the matching recipe and use the system catalog
to confirm that owner before supplying its exact name to the recipe.

```bash
pnpm maestro -- recipes show crud-business-entity
pnpm template:systems -- --query "your-domain-noun"
```

`records-example` remains an internal optional reference composition with its
own record flow and `/records` route; it is not selected by the create CLI. The
default recipe path is non-mutating until its reviewed preview prints an exact
confirmation command. Copy that command unchanged to write. The write
re-previews every generator, stages all files, refuses collisions or changed
evidence, and retains a recovery journal and receipt under
`.maestro/recipe-transactions/`.

If you only want to understand the machine contract, add `--json`. If you want
all diagnostics and context facts, add `--details`.

For automation, invoke the repository-owned launcher directly. It preserves the
CLI's stdout, stderr, signals, and exit code without package-manager banners:

```bash
node maestro-template.mjs describe
node maestro-template.mjs preflight --mode fake --json
```

## 5. Verify the affected contracts

Run the focused gates named by the recipe. For the CRUD recipe they include:

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

The successful write prints these commands in dependency order. The web build
regenerates TanStack's route tree before TypeScript checks the new file route.
Generated route, Confect, and Convex files are outputs, not hand-editing
surfaces.

Review and commit the verified recipe transaction before starting. Start runs
preflight again and intentionally requires a clean target so it cannot confuse
unreviewed generated drift with the app you approved:

```bash
git status --short
git add .
git commit -m "feat: add Milestone slice"
```

## 6. Start in fake mode

```bash
pnpm maestro -- start --mode fake
```

Start uses a strict port, waits for `/health`, and only then prints the app URL.
Fake mode starts the web app without a Convex account or live provider secret.
Use `--mode local` only for the reviewed local Convex stack and `--mode dev`
only with an authenticated personal development deployment. See
[Start Modes](./start-modes.md).

The first app proof is that the neutral chassis starts cleanly in fake mode and
continues to label its unimplemented first outcome as `@wip`. After a reviewed
product slice is added, exercise that slice's promised loading, empty, error,
read, edit, and mutation states before promoting its contract.

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
