# Promotion Boundary

The repository has two intentionally different zones:

- `experiments/` and `private-packages/` are safe places to explore with fake
  data and incomplete ideas.
- `apps/` and `packages/` are production-candidate code and must satisfy the
  canonical system, product topology, data lifecycle, and layer contracts.

Strictness applies when code crosses into the production zone. Sandbox code is
never imported by production code and cannot register durable tables, routes,
headless operations, scheduled jobs, or providers.
`pnpm check:promotion-boundary` checks both rules. Dependency Cruiser
independently pins the import direction.

## Start An Experiment

First search for an existing owner and implementation:

```bash
pnpm template:systems -- --query "<responsibility>"
pnpm template:prototype -- --name <name> --system <canonical-id> --disposition reuse|extend --hypothesis "<what we expect to learn>" --write
```

The prototype generator creates `experiments/<system>/<name>/experiment.json`, a
README, a source entrypoint, and ownership provenance. The contract states the
hypothesis, canonical owner, reuse/extend decision, absence of production
registrations, and intended promotion command.

Inside that directory, use local adapters, rough UI, throwaway algorithms, and
synthetic fixtures as needed. Do not use real customer data or secrets.

## Promote What Worked

Promotion is a re-scaffold, not an import or directory move:

1. Record the result and rejected alternatives in the experiment README.
2. Run the command in `experiment.json` (normally `template:add-feature`) to
   create the production vertical slice.
3. Port only the understood behavior into generated contracts and adapters.
4. If durable data is needed, use `template:add-table` with its complete
   lifecycle posture. Never copy a schema registration out of the sandbox.
5. Run the generated focused tests, `pnpm check:promotion-boundary`,
   `pnpm check:system-topology`, and `pnpm check:data-resources`. Defer
   `pnpm verify` to the delivery batch: run it once on the immutable final head,
   with Woodpecker as the blocking verification authority.
6. Request contract review for overlapping responsibilities and authority.

Private-package imports follow the same rule. Dry-run and import commands
require `--system` and `--disposition`, remain isolated under
`private-packages/`, and promote reviewed capability/workflow contracts only
through the canonical generators.
