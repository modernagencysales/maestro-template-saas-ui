#!/usr/bin/env bash
set -euo pipefail

# Hosted agents are bare: install pinned node/pnpm and run frozen install.
source "$(dirname "$0")/setup.sh"

if [[ -n "${GRAPHITE_TOKEN:-}" ]]; then
  echo "Graphite CI optimizer configured"
else
  echo "Graphite CI optimizer not configured; continuing with full local gates"
fi

if [[ -n "${SECRET_SCANNER_VERSION:-}" ]]; then
  echo "Secret scanner version target: ${SECRET_SCANNER_VERSION}"
fi

# check:secret-canaries shells out to gitleaks and check:qlty to qlty (both
# fail closed on CI); hosted agents are bare, so install the pinned binaries.
"$(dirname "$0")/install-gitleaks.sh"
"$(dirname "$0")/install-qlty.sh"
export PATH="${HOME}/.local/bin:${PATH}"

pnpm verify
pnpm check:ci-completeness
pnpm check:config-drift
pnpm check:deps
pnpm check:knip
pnpm check:route-tree
pnpm check:coverage-ratchet
pnpm check:types-coverage
pnpm check:gates
pnpm check:debt
pnpm check:generators
pnpm check:docs-freshness
pnpm check:generated-files
pnpm check:confect-contracts
pnpm check:confect-compat
pnpm check:workflow-semantics
pnpm check:workflow-graph-boundary
pnpm check:schema-migration-notes
pnpm check:system-catalog
pnpm check:system-topology
pnpm check:data-resources
pnpm check:promotion-boundary
pnpm check:layer-boundaries
pnpm check:secret-canaries
pnpm check:sbom-license
pnpm check:headless-surface-contract
pnpm check:posthog-readiness
pnpm check:auth-demo-bypass
pnpm check:pr-health
pnpm check:unresolved-review-threads
pnpm check:merge-conflicts
pnpm check:qlty
