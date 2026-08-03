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
pnpm template:workflow-output-smoke
pnpm check:pr-health
pnpm check:unresolved-review-threads
pnpm check:merge-conflicts
