# Canonical gate recipes — the names are a contract consumed by local dev,
# CI, and agent SOPs alike. Each recipe delegates to the pnpm/turbo gate CI
# already runs; this file adds NO new logic, only the canonical names.
# Recipe names are pinned by tooling/quality/check-ci-completeness.mts.
#
# verify = the fast gate chain. Mutation and hosted smoke are slow gates that
# run as separate scheduled/manual CI jobs, not in verify.

verify: check-fmt lint typecheck test test-tooling check-deps check-knip check-debt check-gates check-generators check-system-catalog build

check-fmt:
    pnpm check:format

lint:
    pnpm lint

typecheck:
    pnpm typecheck

test:
    sh -c 'if command -v host-test-slot >/dev/null 2>&1; then host-test-slot --class full pnpm test; else pnpm test; fi'

test-tooling:
    pnpm test:tooling

test-workflow:
    pnpm test:workflow

test-pr-backlog:
    pnpm test:pr-backlog

evals:
    pnpm evals

build:
    pnpm build

check-deps:
    pnpm check:deps

check-knip:
    pnpm check:knip

check-debt:
    pnpm check:debt

check-gates:
    pnpm check:gates

check-generators:
    pnpm check:generators

check-system-catalog:
    pnpm check:system-catalog

check-convex:
    pnpm check:convex

coverage:
    pnpm check:coverage-ratchet

mutation:
    bash .buildkite/scripts/mutation.sh

verify-full:
    sh -c 'if command -v host-test-slot >/dev/null 2>&1; then host-test-slot --class full pnpm verify; else pnpm verify; fi'
