# Private Package Guide

Private packages let client-specific capabilities, workflows, agents,
transformations, source types, blocks, prompts, and fixtures live outside the
template core.

## Import Rules

- Start from a blueprint in [blueprint-catalog.md](./blueprint-catalog.md) and
  keep client-specific nouns in the private package until reviewed.
- Run dry-run first.
- Inspect generated diffs.
- Keep imported modules under `private-packages/<package>/` until review.
- Require docs, tests, data-map metadata, and migration notes.
- Follow [generator-output-contract.md](./generator-output-contract.md) before
  promoting any imported capability or workflow.
- Do not bypass Confect contract checks.
- Do not import secrets or customer data.

## Upgrade Rules

Private packages should target a template release. When the template upgrades,
rerun dry-run import and fix contract diffs deliberately.

## Commands

```bash
pnpm template:private-package:dry-run -- --fixture examples/generic-ai-ops --system <canonical-id> --disposition reuse|extend
pnpm template:private-package:import -- --fixture examples/generic-ai-ops --system <canonical-id> --disposition reuse|extend --write
```

The dry-run emits a redaction-aware package plan. Import writes the plan,
README, package index, capability contract modules, workflow graph modules, and
its provenance record only when `--write` is explicit.

Preview and import read only the fixture's `template-package.json`; they do not
read seed data or secrets and make no network requests. Import recomputes that
bounded plan immediately before exclusive file creation. The writes prevent
overwrites, but are not journal-atomic: if a filesystem failure interrupts an
import, remove only the newly created paths reported by the command, then rerun.

Imported capability modules include the promotion command, typed-error posture,
and expected API/CLI/MCP surfaces. Imported workflow modules include a durable
graph seed with source, capability, approval, and Trust Receipt nodes. Promote
only reviewed modules into the owning Confect groups.
