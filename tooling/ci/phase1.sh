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

# check:secret-canaries shells out to gitleaks. Qlty is advisory in a separate
# controller step and never affects the deterministic root verdict.
"$(dirname "$0")/install-gitleaks.sh"
export PATH="${HOME}/.local/bin:${PATH}"

pnpm verify
pnpm template:workflow-output-smoke
