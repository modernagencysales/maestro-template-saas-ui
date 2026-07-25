# INTEGRATION_REQUEST: register `check:recipes`

B currently owns the two shared wiring hotspots. After that lease closes, apply
only these mechanical registrations:

1. In root `package.json`, add
   `"check:recipes": "tsx tooling/quality/check-recipes.mts"` to `scripts`.
2. In `tooling/quality/src/check-definitions.mts`, add the canonical required
   diagnostic-registry descriptor for gate id `recipes`, argv/rerun
   `["pnpm", "check:recipes"]`, canonical doc
   `docs/template/recipes/index.generated.json`, focused paths
   `packages/template-core/src/recipes`, `docs/template/recipes`,
   `tooling/agent-pack/src/recipes.ts`, and `tooling/quality/check-recipes.mts`,
   with semantic rule id `WP-4.3`.

The checker itself is behavioral and must continue to run directly; the shared
descriptor must not replace its live owner, command, index, or semantic-ledger
validation.
