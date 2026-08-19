# Generated Pro registry consumer

This fixture reads the generated Pro registry from `public/r`, installs every
published block and hook through the CLI install planner, and resolves absolute
public-registry dependencies from the generated public registry. It has no
network fallback.

Both commands generate the public and Pro registries before running:

```sh
pnpm --filter @saas-ui-pro/registry test:consumer
pnpm --filter @saas-ui-pro/registry test:consumer:acceptance
```

The focused test checks complete graph and lock coverage, canonical hashes,
idempotency, deterministic output, declared package dependencies, and source
portability. The acceptance command additionally strictly type-checks every
installed TypeScript file and builds a minimal Next.js application. It reuses
the repository's already-installed package contents and does not run a package
manager or access the network.
