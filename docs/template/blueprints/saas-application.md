# SaaS Application Blueprint

Status: implemented generator blueprint. Classification: `template-gap`, backlog
`AP-008 generic application blueprint`.

## Outcome

`saas-application` is the workflow-optional starting point for an ordinary
workspace SaaS application. Its default projection is a neutral chassis; it does
not invent a product entity, CRUD route, or workflow runtime.

```bash
pnpm maestro -- create ../my-app --name "My App" --outcome "Deliver the first customer outcome"
pnpm maestro -- create ../my-app --name "My App" --outcome "Deliver the first customer outcome" --write
pnpm --dir ../my-app maestro -- start --mode fake
```

Create previews the separate target, every write, and every collision. Write
refuses all collisions; it never silently replaces an existing path. Start runs
from the materialized target so `template-instance.json` supplies the
personalized name and first outcome.

Start keeps deterministic strict ports. If a shared service owns a default,
leave that owner alone and rerun with explicit `--web-port`, `--convex-port`,
`--convex-site-port`, and `--readiness-port` values as applicable; Maestro
validates the range and uniqueness before spawning anything. The current
TanStack/Vite hosting artifact is `apps/web/dist/client`. A fork introducing
Astro owns a separate declared and tested artifact path.

## Canonical Composition

The mandatory chassis retains workspace tenancy, deployment authority, headless
infrastructure, provider seams, and the draft first-outcome contract. Two
source-controlled optional patterns are canonical:

- `records-example`: complete synthetic seeds, table, Confect functions,
  adapters, screen, route, typed product contract, Playwright acceptance proof,
  generated registrations, governance metadata, docs, and provenance;
- `workflow-automation`: workflow package, runtime source, tables, generated
  bindings, scripts, dependencies, catalog/topology facts, and lockfile
  importer.

Factory patterns remain under source control even when a generated customer
target omits them. Internal composition selects them through
`buildSaasApplicationTargetPlan({ patterns: [...] })`; there is no parallel
manifest, plugin discovery system, or create CLI flag.

This blueprint does not introduce a second shell, state adapter, feature model,
Confect tree, or Convex access path.

## Fake, Local, And Provider Posture

The neutral fake posture is deterministic behavior, not a green placeholder.
When `records-example` is selected, its workspace-scoped store performs
create/list/read with synthetic records. Local mode uses generated Confect refs
only for materialized systems. Missing local or live setup reports unavailable
behavior and cannot claim success.

No live provider, plugin, MCP server, GTM pack, agency behavior, or
customer-specific rule is required. Every handoff/readiness entry uses one of
`real`, `fake`, `seam`, or `unavailable`.

## Optional Automation

The base blueprint has no workflow. Selecting `workflow-automation` restores the
maintained runtime closure. A product workflow must still prove supported
semantics, stable versions, principal reauthorization, bounded payloads, and
cleanup; selection alone makes none of those product claims.

## Records Example Sources

- `examples/saas-application/seed/workspace.json`
- `examples/saas-application/seed/records.json`
- `examples/saas-application/seed/source.json`
- `examples/saas-application/seed/crud-scenario.json`
- `examples/saas-application/seed/source/` (the executable table, Confect,
  adapter, feature, screen, and route source copied by the blueprint)

These files remain factory reference material unless `records-example` is
selected. All values are public synthetic fixtures. Replace them through the
renamed entity contract, never with copied customer files.
