# Canonical gate recipes — the names are a contract consumed by local dev,
# CI, and agent SOPs alike. Each recipe delegates to the pnpm/turbo gate CI
# already runs; this file adds NO new logic, only the canonical names.
# Recipe names are pinned by tooling/quality/check-ci-completeness.mts.
#
# verify is the complete deterministic promotion chain. Mutation and hosted
# smoke remain scheduled/manual jobs.

verify:
    sh -c 'if command -v host-test-slot >/dev/null 2>&1; then host-test-slot --class full pnpm verify; else pnpm verify; fi'

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

test-convex-compat:
    pnpm test:convex-compat

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

check-system-topology:
    pnpm check:system-topology

check-data-resources:
    pnpm check:data-resources

check-promotion-boundary:
    pnpm check:promotion-boundary

check-convex:
    pnpm check:convex

check-convex-compat:
    pnpm check:convex-compat


check-convex-ai-files:
    pnpm check:convex-ai-files

check-agent-pack:
    pnpm check:agent-pack

check-workflow-output-smoke:
    pnpm template:workflow-output-smoke

check-workflow-semantics:
    pnpm check:workflow-semantics

check-workflow-fast:
    pnpm check:workflow:fast

coverage:
    pnpm check:coverage-ratchet

mutation:
    bash .buildkite/scripts/mutation.sh

verify-full:
    just verify
