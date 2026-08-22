#!/usr/bin/env bash
set -euo pipefail

# Coverage runs in its own secretless, disposable workflow workspace.
source tooling/ci/setup.sh
bash tooling/ci/install-gitleaks.sh
export PATH="${HOME}/.local/bin:${PATH}"

pnpm exec playwright install --with-deps chromium
pnpm check:coverage-ratchet
