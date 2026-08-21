# Maestro Brain Demo

The canonical product demo lives on `product/maestro-brain`. It is distinct from
the reusable template on `main` and from temporary `codex/*` integration
branches.

## Launch

```bash
git fetch origin product/maestro-brain
git switch product/maestro-brain
git pull --ff-only
pnpm demo:brain
```

The command fails closed when the checkout is dirty, the branch is wrong, the
canonical remote is ahead, or the selected port is occupied. It builds the app
in fake-safe mode, serves it at `http://127.0.0.1:5199/clients`, verifies the
visible product navigation, rejects generic showcase markers, records a
screenshot and receipt under `/tmp/maestro-brain-demo`, and only then opens the
browser.

Use `pnpm demo:brain -- --verify-only --no-open` for CI or a preflight without a
persistent server. Use `--port <number>` only when the canonical port is
intentionally unavailable; the launcher never kills or reuses another process.

## What the identity badge means

The shell shows the product, branch, short commit, runtime mode, and backend
posture. `fake / not configured` proves the product screens and navigation, not
live authenticated data. A staging or production claim requires its own hosted
smoke receipt for the exact commit.

## Promotion rule

Promote an integration commit by merging it into `product/maestro-brain`,
running `pnpm demo:brain -- --verify-only`, and pushing the branch. Do not demo
directly from a temporary agent branch. Tag important external demos from the
verified canonical commit.
