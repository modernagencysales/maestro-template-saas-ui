# Maestro SaaS App Factory

Maestro is an opinionated TypeScript app factory for building workspace-safe
SaaS and AI products. It gives you a polished Saas UI shell, Convex persistence,
typed Confect/Effect contracts, fake-safe local development, and a CLI that
guides both people and coding agents through reviewed changes.

The factory produces a separate customer app. You build in that generated app;
you do not turn this repository into the product or copy files from `main`.

> Release status: `0.2.0-alpha.2` is intended for hands-on testing. Use it for
> prototypes and feedback, not production data. Please open a GitHub issue with
> the command you ran, the concise CLI output, and the generated receipt when a
> step fails.

## Build a small app

Requirements: Git, Node 22, Corepack, and pnpm.

```bash
git clone https://github.com/modernagencysales/maestro-template-saas-ui.git
cd maestro-template-saas-ui
git checkout maestro-template-v0.2.0-alpha.2
corepack enable
pnpm install --frozen-lockfile

# Preview: no target files are written.
pnpm maestro -- create ../launch-tracker \
  --name "Launch Tracker" \
  --outcome "Track launch tasks and blockers" \
  --demo-only

# Write the exact reviewed plan.
pnpm maestro -- create ../launch-tracker \
  --name "Launch Tracker" \
  --outcome "Track launch tasks and blockers" \
  --demo-only \
  --write \
  --privacy-reviewed
```

Create prints the remaining copy/paste commands: initialize Git, install the
frozen dependency graph, make the baseline commit, run preflight, and start in
fake mode. It does not silently install, commit, authenticate, or launch a
service for you.

After following those commands:

```bash
cd ../launch-tracker
pnpm maestro -- recipes list
pnpm template:systems -- --query records
pnpm maestro -- start --mode fake
```

Open the URL printed after `/health` becomes ready. The generated starter has a
workspace-owned record flow with loading, empty, error, list, detail, and create
states. Rename `record` to the first useful noun in your product.

The detailed walkthrough is in
[Template Quickstart](./docs/template/quickstart.md).

## How Maestro works

Maestro uses one repeatable loop:

```text
orient -> preview -> review -> write -> verify -> commit -> run
```

1. `maestro preflight` checks the host, repository, release authority, and
   fake/local/live posture.
2. `maestro recipes` shows supported outcomes; `template:systems` finds the
   canonical owner so a change does not create a duplicate subsystem.
3. `maestro add` or a `template:*` generator previews exact files and gates.
4. Writes require explicit approval and unchanged fingerprints. Multi-file
   recipes use a recoverable transaction and retain a receipt.
5. Focused gates prove the affected contract before the app is started.
6. Review and commit the verified change; start requires a clean target.

For example, preview a second workspace-owned entity:

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

The preview prints the exact confirmation command with its plan and preflight
fingerprints. Run that returned command unchanged to apply the transaction. See
[Executable Outcome Recipes](./docs/template/executable-recipes.md).

## Architecture contract

```text
web routes -> screens -> features -> blocks -> Saas UI/shared primitives
client hooks -> @confect/react refs -> Confect specs -> Convex functions
agents -> workflows -> capabilities -> domain/checks -> schema
API/CLI/MCP -> headless registry -> the same capabilities/workflows as web
storage/notifications/observability -> Effect services -> provider adapters
```

The starter is opinionated without being a dead-end. Keep the shared shell and
customize through feature adapters, blocks, design tokens, generated routes,
canonical systems, and typed contracts. Fake providers remain the default until
a fork explicitly configures and verifies a live adapter.

## Guidance for people and agents

- [AGENTS.md](./AGENTS.md) is the operational contract for coding agents.
- [Template Quickstart](./docs/template/quickstart.md) is the tester path.
- [App Factory Guide](./docs/template/app-factory-guide.md) explains the method.
- [Customer Target Contract](./docs/template/customer-target-contract.md)
  explains release and write safety.
- [System Catalog](./docs/template/system-catalog.md) and
  [Product Topology](./docs/template/product-topology.md) define ownership.
- [Start Modes](./docs/template/start-modes.md) explains fake, local, and dev.

## Verification

During development, run the focused gates printed by the generator. Before a
handoff, run:

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

`pnpm verify` is the exhaustive repository gate and can take considerably
longer. A green presence audit is not behavioral proof; use the command output
and generated receipts as the evidence.
