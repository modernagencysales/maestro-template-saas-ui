# How To Add A Private Package

```bash
pnpm template:private-package:dry-run -- --fixture examples/generic-ai-ops --system <canonical-id> --disposition reuse|extend
pnpm template:private-package:import -- --fixture examples/generic-ai-ops --system <canonical-id> --disposition reuse|extend --write
```

## Files Created

Private package imports may add workflows, capabilities, agents,
transformations, source types, blocks, prompts, fixtures, docs, and tests. The
generator creates a redaction-aware package plan, README, source index,
capability contract modules, and workflow graph modules under
`private-packages/<package>/`. Client packages can then promote reviewed
capabilities, workflows, docs, and tests into the owning Confect modules. The
package is not a runtime dependency: production code cannot import it or allow
it to register tables, routes, headless operations, jobs, or providers.

## Tests

- dry-run diff;
- fixture redaction;
- imported source-module shape;
- generated Confect validity;
- data-map metadata;
- migration notes;
- focused package tests.

## Gates

- `pnpm template:private-package:dry-run -- --fixture <path> --system <canonical-id> --disposition reuse|extend`
- `pnpm check:promotion-boundary`
- `pnpm check:confect-contracts`
- `pnpm check:schema-migration-notes`
- `pnpm check:secret-canaries`
